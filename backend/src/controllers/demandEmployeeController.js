import DemandEmployee from "../models/DemandEmployee.js"
import Lead from "../models/Lead.js"
import User from "../models/User.js"
import DemandSalaryPayment from "../models/DemandSalaryPayment.js"
import WithdrawalRequest from "../models/WithdrawalRequest.js"
import { resolveDisplayCurrency, fromBase, toBase } from "../Services/displayCurrency.js"
import {
    getStaffWalletSummary,
    payStaffFromTreasury,
    notifyStaff,
} from "../Services/staffWalletService.js"

// Salaries, allowances and salary history are stored in the platform base
// currency. Convert them to the admin's display currency on the way out.
const convAllowancesOut = (allowances, dc) =>
    (Array.isArray(allowances) ? allowances : []).map((a) => {
        const o = typeof a?.toObject === "function" ? a.toObject() : a
        return { ...o, amount: fromBase(o.amount || 0, dc) }
    })

const convAllowancesToBase = (allowances, dc) =>
    (Array.isArray(allowances) ? allowances : []).map((a) => {
        const o = typeof a?.toObject === "function" ? a.toObject() : a
        return { ...o, amount: toBase(Number(o.amount) || 0, dc) }
    })

const serializeEmployee = (emp, dc) => {
    const o = typeof emp?.toObject === "function" ? emp.toObject() : emp
    return {
        ...o,
        monthlySalary: fromBase(o.monthlySalary || 0, dc),
        allowances: convAllowancesOut(o.allowances, dc),
        salaryHistory: (Array.isArray(o.salaryHistory) ? o.salaryHistory : []).map((h) => ({
            ...h,
            monthlySalary: fromBase(h.monthlySalary || 0, dc),
            allowances: convAllowancesOut(h.allowances, dc),
        })),
        currency: dc,
    }
}

// @desc    List demand-generation employees (with search / filters)
// @route   GET /api/demand/employees
export const getEmployees = async (req, res) => {
    try {
        const { search, status, department, employeeType, region, portalRole, page = 1, limit = 50 } = req.query
        const query = {}

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { employeeCode: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ]
        }
        if (status) query.status = status
        if (department) query.department = department
        if (employeeType) query.employeeType = employeeType
        if (region) query.region = region
        // Filter by portal role (e.g. only FIELD reps who can own leads).
        if (portalRole && ["FIELD", "FINANCE"].includes(portalRole)) query.portalRole = portalRole

        const employees = await DemandEmployee.find(query)
            .populate("reportingManager", "fullName employeeCode")
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean()

        const total = await DemandEmployee.countDocuments(query)
        const displayCurrency = resolveDisplayCurrency(req)

        // Attach live workload (active assigned leads) per employee
        const withWorkload = await Promise.all(
            employees.map(async (emp) => {
                const activeLeads = await Lead.countDocuments({
                    assignedTo: emp._id,
                    stage: { $nin: ["ONBOARDED", "ACTIVE", "LOST"] },
                })
                return { ...serializeEmployee(emp, displayCurrency), activeLeads }
            })
        )

        res.json({
            success: true,
            currency: displayCurrency,
            data: {
                employees: withWorkload,
                currency: displayCurrency,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        })
    } catch (error) {
        console.error("[demand] getEmployees error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch employees" })
    }
}

// @desc    Get single employee with detail
// @route   GET /api/demand/employees/:id
export const getEmployeeById = async (req, res) => {
    try {
        const employee = await DemandEmployee.findById(req.params.id).populate(
            "reportingManager",
            "fullName employeeCode"
        )
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" })
        }
        const displayCurrency = resolveDisplayCurrency(req)
        res.json({ success: true, currency: displayCurrency, data: serializeEmployee(employee, displayCurrency) })
    } catch (error) {
        console.error("[demand] getEmployeeById error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch employee" })
    }
}

// @desc    Create employee
// @route   POST /api/demand/employees
export const createEmployee = async (req, res) => {
    try {
        const {
            fullName, email, phone, employeeType, department, designation,
            reportingManager, territory, region, status, joiningDate,
            monthlySalary, allowances, monthlyTarget,
            hasPortalAccess, portalRole, password,
        } = req.body

        if (!fullName || !email) {
            return res.status(400).json({ success: false, message: "Full name and email are required" })
        }

        const normalizedEmail = email.toLowerCase().trim()

        const exists = await DemandEmployee.findOne({ email: normalizedEmail })
        if (exists) {
            return res.status(400).json({ success: false, message: "An employee with this email already exists" })
        }

        // Duplicate-identity guard: an email/phone already used by a platform
        // account (customer, partner, driver, corporate or admin) cannot be
        // re-registered as a demand-generation employee. This prevents the same
        // person existing twice under two different roles in one application.
        const userConflict = await User.findOne({
            $or: [
                { email: normalizedEmail },
                ...(phone ? [{ whatsappNumber: phone }] : []),
            ],
        }).select("email role")
        if (userConflict) {
            return res.status(409).json({
                success: false,
                code: "IDENTITY_IN_USE",
                message:
                    `This ${userConflict.email === normalizedEmail ? "email" : "phone number"} already belongs to a platform account (role: ${userConflict.role}). ` +
                    "The same person cannot also be registered as a demand-generation employee. Use a different email/phone.",
            })
        }

        // If portal login is enabled, a password (min 6 chars) is required.
        const portalEnabled = !!hasPortalAccess
        if (portalEnabled && (!password || String(password).length < 6)) {
            return res.status(400).json({
                success: false,
                message: "A password of at least 6 characters is required to enable portal access",
            })
        }

        // Salary & allowances are entered in the display currency; store in base.
        const displayCurrency = resolveDisplayCurrency(req)
        const salary = toBase(Number(monthlySalary) || 0, displayCurrency)
        const baseAllowances = convAllowancesToBase(allowances, displayCurrency)
        const employee = new DemandEmployee({
            fullName,
            email,
            phone,
            employeeType,
            department,
            designation,
            reportingManager: reportingManager || null,
            territory,
            region,
            status,
            joiningDate: joiningDate || Date.now(),
            monthlySalary: salary,
            allowances: baseAllowances,
            monthlyTarget: Number(monthlyTarget) || 0,
            salaryHistory: salary > 0
                ? [{ monthlySalary: salary, allowances: baseAllowances, effectiveDate: joiningDate || Date.now(), note: "Initial salary" }]
                : [],
            hasPortalAccess: portalEnabled,
            portalRole: ["FIELD", "FINANCE"].includes(portalRole) ? portalRole : "FIELD",
            password: portalEnabled ? password : null,
            createdBy: req.userId,
        })

        await employee.save()
        res.status(201).json({ success: true, message: "Employee created", currency: displayCurrency, data: serializeEmployee(employee, displayCurrency) })
    } catch (error) {
        console.error("[demand] createEmployee error:", error)
        res.status(500).json({ success: false, message: "Failed to create employee" })
    }
}

// @desc    Update employee core details
// @route   PUT /api/demand/employees/:id
export const updateEmployee = async (req, res) => {
    try {
        const employee = await DemandEmployee.findById(req.params.id).select("+password")
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" })
        }

        const editable = [
            "fullName", "phone", "employeeType", "department", "designation",
            "reportingManager", "territory", "region", "status", "joiningDate", "monthlyTarget",
        ]
        editable.forEach((field) => {
            if (req.body[field] !== undefined) {
                employee[field] = req.body[field] === "" && field === "reportingManager" ? null : req.body[field]
            }
        })

        // ===== Portal access management =====
        let releasedLeads = 0
        if (req.body.portalRole !== undefined && ["FIELD", "FINANCE"].includes(req.body.portalRole)) {
            const wasField = employee.portalRole === "FIELD"
            employee.portalRole = req.body.portalRole
            // Switching a field rep to finance means they can no longer own
            // leads — release any they currently hold so nothing is stranded
            // with a finance employee.
            if (wasField && req.body.portalRole === "FINANCE") {
                // An untouched ASSIGNED lead should fall back to NEW once its
                // owner can no longer work it.
                await Lead.updateMany(
                    { assignedTo: employee._id, stage: "ASSIGNED" },
                    { $set: { stage: "NEW" } }
                )
                const result = await Lead.updateMany(
                    { assignedTo: employee._id },
                    {
                        $set: { assignedTo: null },
                        $push: {
                            activities: {
                                stage: "NEW",
                                note: `Unassigned automatically: ${employee.fullName} was moved to a Finance role and can no longer own leads. Please reassign to a Field employee.`,
                                employee: null,
                            },
                        },
                    }
                )
                releasedLeads = result.modifiedCount || 0
            }
        }
        // A new password may be provided to (re)set login credentials.
        if (req.body.password) {
            if (String(req.body.password).length < 6) {
                return res.status(400).json({ success: false, message: "Password must be at least 6 characters" })
            }
            employee.password = req.body.password
        }
        if (req.body.hasPortalAccess !== undefined) {
            const enable = !!req.body.hasPortalAccess
            if (enable && !employee.password) {
                return res.status(400).json({
                    success: false,
                    message: "Set a password before enabling portal access for this employee",
                })
            }
            employee.hasPortalAccess = enable
        }

        await employee.save()
        const displayCurrency = resolveDisplayCurrency(req)
        const message = releasedLeads > 0
            ? `Employee updated. ${releasedLeads} lead(s) were released and need reassigning to a Field employee.`
            : "Employee updated"
        res.json({ success: true, message, releasedLeads, currency: displayCurrency, data: serializeEmployee(employee, displayCurrency) })
    } catch (error) {
        console.error("[demand] updateEmployee error:", error)
        res.status(500).json({ success: false, message: "Failed to update employee" })
    }
}

// @desc    Update salary (creates a salary-history entry)
// @route   PUT /api/demand/employees/:id/salary
export const updateSalary = async (req, res) => {
    try {
        const { monthlySalary, allowances, effectiveDate, note } = req.body
        const employee = await DemandEmployee.findById(req.params.id)
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" })
        }

        const salaryInput = Number(monthlySalary)
        if (isNaN(salaryInput) || salaryInput < 0) {
            return res.status(400).json({ success: false, message: "Valid monthly salary is required" })
        }

        // Salary & allowances are entered in the display currency; store in base.
        const displayCurrency = resolveDisplayCurrency(req)
        const salary = toBase(salaryInput, displayCurrency)
        const newAllowances = Array.isArray(allowances)
            ? convAllowancesToBase(allowances, displayCurrency)
            : employee.allowances
        employee.monthlySalary = salary
        employee.allowances = newAllowances
        employee.salaryEffectiveDate = effectiveDate || Date.now()
        employee.salaryHistory.push({
            monthlySalary: salary,
            allowances: newAllowances,
            effectiveDate: effectiveDate || Date.now(),
            note: note || "",
        })

        await employee.save()
        res.json({ success: true, message: "Salary updated", currency: displayCurrency, data: serializeEmployee(employee, displayCurrency) })
    } catch (error) {
        console.error("[demand] updateSalary error:", error)
        res.status(500).json({ success: false, message: "Failed to update salary" })
    }
}

// @desc    Delete employee
// @route   DELETE /api/demand/employees/:id
export const deleteEmployee = async (req, res) => {
    try {
        const employee = await DemandEmployee.findById(req.params.id)
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" })
        }
        // Unassign any leads before removing the employee
        await Lead.updateMany({ assignedTo: employee._id }, { $set: { assignedTo: null } })
        await employee.deleteOne()
        res.json({ success: true, message: "Employee deleted" })
    } catch (error) {
        console.error("[demand] deleteEmployee error:", error)
        res.status(500).json({ success: false, message: "Failed to delete employee" })
    }
}

const monthKey = (d = new Date()) => {
    const dt = new Date(d)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
}

// Total monthly cost = base salary + recurring allowances (all in base currency)
const computeMonthlyGross = (employee) => {
    const base = Number(employee.monthlySalary) || 0
    const allowances = (Array.isArray(employee.allowances) ? employee.allowances : [])
        .reduce((sum, a) => sum + (Number(a?.amount) || 0), 0)
    return base + allowances
}

// @desc    Admin: view a staff member's wallet, salary history and withdrawals
// @route   GET /api/demand/employees/:id/wallet
export const getEmployeeWallet = async (req, res) => {
    try {
        const employee = await DemandEmployee.findById(req.params.id)
        if (!employee) return res.status(404).json({ success: false, message: "Employee not found" })

        const summary = await getStaffWalletSummary(employee)
        const [salaryPayments, withdrawals] = await Promise.all([
            DemandSalaryPayment.find({ employee: employee._id }).sort({ createdAt: -1 }).limit(24).lean(),
            WithdrawalRequest.find({ userId: employee._id, ownerModel: "DemandEmployee" })
                .sort({ createdAt: -1 }).limit(24).lean(),
        ])

        const currentMonth = monthKey()
        const paidThisMonth = salaryPayments.some((p) => p.month === currentMonth)

        res.json({
            success: true,
            data: {
                ...summary,
                monthlyGross: computeMonthlyGross(employee),
                currentMonth,
                paidThisMonth,
                salaryPayments,
                withdrawals,
            },
        })
    } catch (error) {
        console.error("[demand] getEmployeeWallet error:", error)
        res.status(500).json({ success: false, message: "Failed to load employee wallet" })
    }
}

// @desc    Admin: pay a staff member's salary for a month into their wallet
// @route   POST /api/demand/employees/:id/pay-salary
export const payEmployeeSalary = async (req, res) => {
    try {
        const employee = await DemandEmployee.findById(req.params.id)
        if (!employee) return res.status(404).json({ success: false, message: "Employee not found" })

        const displayCurrency = resolveDisplayCurrency(req)
        const month = req.body.month || monthKey()

        // Amount: explicit override (in display currency -> base) or computed gross.
        let amountBase
        if (req.body.amount != null && req.body.amount !== "") {
            const amt = Number(req.body.amount)
            if (!amt || amt <= 0) return res.status(400).json({ success: false, message: "Invalid salary amount" })
            amountBase = toBase(amt, displayCurrency)
        } else {
            amountBase = computeMonthlyGross(employee)
        }
        if (amountBase <= 0) {
            return res.status(400).json({ success: false, message: "This employee has no salary configured" })
        }

        // Guard against double-paying the same month (unique index also enforces this).
        const already = await DemandSalaryPayment.findOne({ employee: employee._id, month })
        if (already) {
            return res.status(409).json({ success: false, message: `Salary for ${month} has already been paid` })
        }

        const result = await payStaffFromTreasury({
            employee,
            amount: amountBase,
            currency: "AED",
            embeddedType: "SALARY",
            description: `Salary for ${month}`,
            reference: `SAL-${employee._id}-${month}`,
            metadata: { source: "DEMAND_SALARY", month },
            actingUserId: req.userId,
        })
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message || "Failed to pay salary" })
        }

        const payment = await DemandSalaryPayment.create({
            employee: employee._id,
            month,
            amount: amountBase,
            currency: "AED",
            paidBy: req.userId,
            walletTransactionRef: result.reference,
            note: req.body.note || "",
        })

        await notifyStaff(employee._id, {
            type: "GENERAL",
            title: "Salary credited",
            message: `Your salary for ${month} (AED ${amountBase.toLocaleString()}) has been credited to your wallet.`,
            data: { month, amount: amountBase },
        })

        res.status(201).json({
            success: true,
            message: `Salary for ${month} paid`,
            currency: displayCurrency,
            data: {
                payment: { ...payment.toObject(), amount: fromBase(payment.amount, displayCurrency), currency: displayCurrency },
            },
        })
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: "Salary for this month has already been paid" })
        }
        console.error("[demand] payEmployeeSalary error:", error)
        res.status(500).json({ success: false, message: "Failed to pay salary" })
    }
}