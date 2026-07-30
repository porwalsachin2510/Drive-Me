import Lead from "../models/Lead.js"
import DemandEmployee from "../models/DemandEmployee.js"
import DemandCommission from "../models/DemandCommission.js"
import DemandExpense from "../models/DemandExpense.js"
import { resolveDisplayCurrency, fromBase } from "../Services/displayCurrency.js"

const parseRange = (from, to, field = "createdAt") => {
    const range = {}
    if (from) range.$gte = new Date(from)
    if (to) {
        const end = new Date(to)
        end.setHours(23, 59, 59, 999)
        range.$lte = end
    }
    return Object.keys(range).length ? { [field]: range } : {}
}

/**
 * Unified report endpoint.
 * @route GET /api/demand/reports?type=<type>&from=&to=
 * Supported types: employee, team, region, campaign, customer, partner,
 * expenses, salaries, commissions, targets, monthly, yearly
 */
export const getReport = async (req, res) => {
    try {
        const { type = "monthly", from, to } = req.query
        // Money columns are stored in the platform base currency; convert them to
        // the admin's selected display currency so reports match every other tab.
        const displayCurrency = resolveDisplayCurrency(req)
        const toDisp = (v) => fromBase(v, displayCurrency)

        switch (type) {
            case "employee": {
                const dateMatch = parseRange(from, to)
                const employees = await DemandEmployee.find().lean()
                const rows = await Promise.all(
                    employees.map(async (emp) => {
                        const leads = await Lead.countDocuments({ assignedTo: emp._id, ...dateMatch })
                        const onboarded = await Lead.countDocuments({
                            assignedTo: emp._id,
                            stage: { $in: ["ONBOARDED", "ACTIVE"] },
                            ...dateMatch,
                        })
                        const comm = await DemandCommission.aggregate([
                            { $match: { employee: emp._id, ...parseRange(from, to) } },
                            { $group: { _id: null, total: { $sum: "$amount" } } },
                        ])
                        return {
                            employee: emp.fullName,
                            employeeCode: emp.employeeCode,
                            region: emp.region,
                            department: emp.department,
                            leads,
                            onboarded,
                            conversionRate: leads > 0 ? Math.round((onboarded / leads) * 100) : 0,
                            commission: toDisp(comm[0]?.total || 0),
                        }
                    })
                )
                return res.json({ success: true, currency: displayCurrency, data: { type, currency: displayCurrency, columns: ["employee", "employeeCode", "region", "department", "leads", "onboarded", "conversionRate", "commission"], rows } })
            }

            case "team":
            case "region": {
                const rows = await Lead.aggregate([
                    { $match: { region: { $ne: "" }, ...parseRange(from, to) } },
                    {
                        $group: {
                            _id: "$region",
                            leads: { $sum: 1 },
                            onboarded: { $sum: { $cond: [{ $in: ["$stage", ["ONBOARDED", "ACTIVE"]] }, 1, 0] } },
                            lost: { $sum: { $cond: [{ $eq: ["$stage", "LOST"] }, 1, 0] } },
                        },
                    },
                    { $sort: { leads: -1 } },
                ])
                return res.json({
                    success: true,
                    currency: displayCurrency,
                    data: {
                        type,
                        currency: displayCurrency,
                        columns: ["region", "leads", "onboarded", "lost", "conversionRate"],
                        rows: rows.map((r) => ({
                            region: r._id,
                            leads: r.leads,
                            onboarded: r.onboarded,
                            lost: r.lost,
                            conversionRate: r.leads > 0 ? Math.round((r.onboarded / r.leads) * 100) : 0,
                        })),
                    },
                })
            }

            case "campaign": {
                const rows = await Lead.aggregate([
                    { $match: { campaign: { $ne: null }, ...parseRange(from, to) } },
                    {
                        $group: {
                            _id: "$campaign",
                            leads: { $sum: 1 },
                            onboarded: { $sum: { $cond: [{ $in: ["$stage", ["ONBOARDED", "ACTIVE"]] }, 1, 0] } },
                        },
                    },
                    { $lookup: { from: "demandcampaigns", localField: "_id", foreignField: "_id", as: "campaign" } },
                    { $unwind: "$campaign" },
                    { $sort: { leads: -1 } },
                ])
                return res.json({
                    success: true,
                    currency: displayCurrency,
                    data: {
                        type,
                        currency: displayCurrency,
                        columns: ["campaign", "channel", "budget", "leads", "onboarded", "conversionRate"],
                        rows: rows.map((r) => ({
                            campaign: r.campaign.name,
                            channel: r.campaign.channel,
                            budget: toDisp(r.campaign.budget || 0),
                            leads: r.leads,
                            onboarded: r.onboarded,
                            conversionRate: r.leads > 0 ? Math.round((r.onboarded / r.leads) * 100) : 0,
                        })),
                    },
                })
            }

            case "customer":
            case "partner": {
                const match = { ...parseRange(from, to) }
                if (type === "customer") match.leadCategory = "CUSTOMER"
                else match.leadCategory = "PARTNER"
                const leads = await Lead.find(match)
                    .populate("assignedTo", "fullName")
                    .sort({ createdAt: -1 })
                    .lean()
                return res.json({
                    success: true,
                    currency: displayCurrency,
                    data: {
                        type,
                        currency: displayCurrency,
                        columns: ["leadCode", "name", "partnerType", "stage", "assignedTo", "region", "estimatedValue", "createdAt"],
                        rows: leads.map((l) => ({
                            leadCode: l.leadCode,
                            name: l.name,
                            partnerType: l.partnerType || "-",
                            stage: l.stage,
                            assignedTo: l.assignedTo?.fullName || "Unassigned",
                            region: l.region || "-",
                            estimatedValue: toDisp(l.estimatedValue || 0),
                            createdAt: l.createdAt,
                        })),
                    },
                })
            }

            case "expenses": {
                const expenses = await DemandExpense.find(parseRange(from, to, "date"))
                    .populate("employee", "fullName")
                    .sort({ date: -1 })
                    .lean()
                return res.json({
                    success: true,
                    currency: displayCurrency,
                    data: {
                        type,
                        currency: displayCurrency,
                        columns: ["employee", "category", "amount", "date", "approvalStatus", "paymentStatus"],
                        rows: expenses.map((e) => ({
                            employee: e.employee?.fullName || "-",
                            category: e.category,
                            amount: toDisp(e.amount),
                            date: e.date,
                            approvalStatus: e.approvalStatus,
                            paymentStatus: e.paymentStatus,
                        })),
                    },
                })
            }

            case "salaries": {
                const employees = await DemandEmployee.find().lean()
                return res.json({
                    success: true,
                    currency: displayCurrency,
                    data: {
                        type,
                        currency: displayCurrency,
                        columns: ["employee", "employeeCode", "employeeType", "department", "monthlySalary", "allowances", "total"],
                        rows: employees.map((e) => {
                            const allowances = (e.allowances || []).reduce((s, a) => s + (a.amount || 0), 0)
                            return {
                                employee: e.fullName,
                                employeeCode: e.employeeCode,
                                employeeType: e.employeeType,
                                department: e.department,
                                monthlySalary: toDisp(e.monthlySalary || 0),
                                allowances: toDisp(allowances),
                                total: toDisp((e.monthlySalary || 0) + allowances),
                            }
                        }),
                    },
                })
            }

            case "commissions": {
                const commissions = await DemandCommission.find(parseRange(from, to))
                    .populate("employee", "fullName")
                    .populate("lead", "leadCode")
                    .sort({ createdAt: -1 })
                    .lean()
                return res.json({
                    success: true,
                    currency: displayCurrency,
                    data: {
                        type,
                        currency: displayCurrency,
                        columns: ["employee", "lead", "trigger", "amount", "status", "month", "createdAt"],
                        rows: commissions.map((c) => ({
                            employee: c.employee?.fullName || "-",
                            lead: c.lead?.leadCode || "-",
                            trigger: c.trigger,
                            amount: toDisp(c.amount),
                            status: c.status,
                            month: c.month,
                            createdAt: c.createdAt,
                        })),
                    },
                })
            }

            case "targets": {
                const employees = await DemandEmployee.find({ status: "ACTIVE" }).lean()
                const rows = await Promise.all(
                    employees.map(async (emp) => {
                        const onboarded = await Lead.countDocuments({
                            assignedTo: emp._id,
                            stage: { $in: ["ONBOARDED", "ACTIVE"] },
                            ...parseRange(from, to),
                        })
                        return {
                            employee: emp.fullName,
                            employeeCode: emp.employeeCode,
                            target: emp.monthlyTarget || 0,
                            achieved: onboarded,
                            achievement: emp.monthlyTarget > 0 ? Math.round((onboarded / emp.monthlyTarget) * 100) : 0,
                        }
                    })
                )
                return res.json({ success: true, currency: displayCurrency, data: { type, currency: displayCurrency, columns: ["employee", "employeeCode", "target", "achieved", "achievement"], rows } })
            }

            case "yearly":
            case "monthly":
            default: {
                const groupFormat = type === "yearly" ? "%Y" : "%Y-%m"
                const leadRows = await Lead.aggregate([
                    { $match: parseRange(from, to) },
                    {
                        $group: {
                            _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
                            leads: { $sum: 1 },
                            onboarded: { $sum: { $cond: [{ $in: ["$stage", ["ONBOARDED", "ACTIVE"]] }, 1, 0] } },
                            lost: { $sum: { $cond: [{ $eq: ["$stage", "LOST"] }, 1, 0] } },
                        },
                    },
                    { $sort: { _id: -1 } },
                ])
                // Enrich with commission + expense totals per period
                const rows = await Promise.all(
                    leadRows.map(async (r) => {
                        const period = r._id
                        const commMatch = type === "yearly"
                            ? { $expr: { $eq: [{ $substr: ["$month", 0, 4] }, period] } }
                            : { month: period }
                        const comm = await DemandCommission.aggregate([
                            { $match: commMatch },
                            { $group: { _id: null, total: { $sum: "$amount" } } },
                        ])
                        const exp = await DemandExpense.aggregate([
                            { $match: { ...commMatch, approvalStatus: "APPROVED" } },
                            { $group: { _id: null, total: { $sum: "$amount" } } },
                        ])
                        return {
                            period,
                            leads: r.leads,
                            onboarded: r.onboarded,
                            lost: r.lost,
                            conversionRate: r.leads > 0 ? Math.round((r.onboarded / r.leads) * 100) : 0,
                            commissions: toDisp(comm[0]?.total || 0),
                            expenses: toDisp(exp[0]?.total || 0),
                        }
                    })
                )
                return res.json({
                    success: true,
                    currency: displayCurrency,
                    data: { type, currency: displayCurrency, columns: ["period", "leads", "onboarded", "lost", "conversionRate", "commissions", "expenses"], rows },
                })
            }
        }
    } catch (error) {
        console.error("[demand] getReport error:", error)
        res.status(500).json({ success: false, message: "Failed to generate report" })
    }
}
