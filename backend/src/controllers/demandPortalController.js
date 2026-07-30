import jwt from "jsonwebtoken"
import crypto from "crypto"
import mongoose from "mongoose"
import DemandEmployee from "../models/DemandEmployee.js"
import Lead, { LEAD_STAGES } from "../models/Lead.js"
import DemandExpense, { EXPENSE_CATEGORIES } from "../models/DemandExpense.js"
import DemandCommission from "../models/DemandCommission.js"
import DemandNotification from "../models/DemandNotification.js"
import User from "../models/User.js"
import { sendEmail } from "../Services/emailService.js"
import { generateCommissionsForLead } from "./demandCommissionController.js"
import { uploadToCloudinary } from "../Config/Cloudinary.js"
import { resolveRegistrationCountry, buildLocalePayload } from "../Config/localizationConfig.js"
import WithdrawalRequest from "../models/WithdrawalRequest.js"
import {
    getStaffWalletSummary,
    getOrCreateStaffWallet,
    buildStaffUserInfo,
    settleCommissionPayment,
    settleExpensePayment,
} from "../Services/staffWalletService.js"

const monthKey = (d = new Date()) => {
    const dt = new Date(d)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
}

const generatePortalToken = (employee) =>
    jwt.sign(
        {
            demandEmployeeId: employee._id,
            portalRole: employee.portalRole,
            kind: "DEMAND_PORTAL",
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || "7d" }
    )

// @desc    Staff Portal login (field rep / finance officer)
// @route   POST /api/demand-portal/login   (public)
export const portalLogin = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" })
        }

        // password has select:false so we must explicitly request it
        const employee = await DemandEmployee.findOne({ email: email.toLowerCase() }).select("+password")
        if (!employee) {
            return res.status(401).json({ success: false, message: "Invalid credentials" })
        }
        if (!employee.hasPortalAccess || !employee.password) {
            return res.status(403).json({
                success: false,
                message: "Portal access has not been enabled for this account. Please contact your admin.",
            })
        }
        if (employee.status !== "ACTIVE") {
            return res.status(403).json({ success: false, message: "Your account is inactive. Please contact your admin." })
        }

        const isValid = await employee.comparePassword(password)
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Invalid credentials" })
        }

        employee.lastLogin = new Date()
        await employee.save()

        const token = generatePortalToken(employee)
        res.cookie("demandPortalToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.json({
            success: true,
            message: "Login successful",
            token,
            employee: employee.toJSON(),
        })
    } catch (error) {
        console.error("[portal] login error:", error)
        res.status(500).json({ success: false, message: "Login failed" })
    }
}

// @desc    Logged-in staff profile + light summary
// @route   GET /api/demand-portal/me
export const getMe = async (req, res) => {
    try {
        const employee = await DemandEmployee.findById(req.demandEmployeeId).populate(
            "reportingManager",
            "fullName employeeCode"
        )
        if (!employee) return res.status(404).json({ success: false, message: "Employee not found" })
        res.json({ success: true, data: employee })
    } catch (error) {
        console.error("[portal] getMe error:", error)
        res.status(500).json({ success: false, message: "Failed to load profile" })
    }
}

/* ============================ FIELD (Rahul) ============================ */

// @desc    List MY assigned leads
// @route   GET /api/demand-portal/leads
export const getMyLeads = async (req, res) => {
    try {
        const { search, stage } = req.query
        const query = { assignedTo: req.demandEmployeeId }
        if (stage) query.stage = stage
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { contactPerson: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
                { leadCode: { $regex: search, $options: "i" } },
                { company: { $regex: search, $options: "i" } },
            ]
        }

        const leads = await Lead.find(query)
            .populate("campaign", "name")
            .sort({ assignedAt: -1, createdAt: -1 })

        // Stage distribution across ALL my leads (ignores the stage filter)
        const stageAgg = await Lead.aggregate([
            { $match: { assignedTo: new mongoose.Types.ObjectId(req.demandEmployeeId) } },
            { $group: { _id: "$stage", count: { $sum: 1 } } },
        ])
        const stages = LEAD_STAGES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {})
        stageAgg.forEach((s) => { stages[s._id] = s.count })

        // Leads needing attention: freshly assigned (not yet contacted) or overdue follow-up
        const now = new Date()
        const newlyAssigned = leads.filter((l) => l.stage === "ASSIGNED").length
        const dueFollowUps = leads.filter(
            (l) => l.nextFollowUpDate && new Date(l.nextFollowUpDate) <= now && !["ONBOARDED", "ACTIVE", "LOST"].includes(l.stage)
        ).length

        res.json({ success: true, data: { leads, stages, newlyAssigned, dueFollowUps } })
    } catch (error) {
        console.error("[portal] getMyLeads error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch leads" })
    }
}

// Helper: fetch a lead and guarantee it belongs to the calling employee
const findMyLead = async (leadId, employeeId) => {
    // Populate the campaign target so role inference has a fallback signal for
    // loosely-typed leads. Mongoose still persists populated refs correctly on
    // save (it stores the _id), so this is safe for the stage/onboard writes.
    const lead = await Lead.findById(leadId).populate("campaign", "name target")
    if (!lead) return { error: "notfound" }
    if (String(lead.assignedTo) !== String(employeeId)) return { error: "forbidden" }
    return { lead }
}

// @desc    Get one of MY leads with the full activity trail
// @route   GET /api/demand-portal/leads/:id
export const getMyLeadById = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate("campaign", "name channel target")
            .populate("activities.employee", "fullName employeeCode")
        if (!lead) return res.status(404).json({ success: false, message: "Lead not found" })
        if (String(lead.assignedTo) !== String(req.demandEmployeeId)) {
            return res.status(403).json({ success: false, message: "This lead is not assigned to you" })
        }
        res.json({ success: true, data: lead })
    } catch (error) {
        console.error("[portal] getMyLeadById error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch lead" })
    }
}

// @desc    Advance the workflow stage on MY lead (+ log an activity)
// @route   PATCH /api/demand-portal/leads/:id/stage
export const updateMyLeadStage = async (req, res) => {
    try {
        const { stage, note, nextFollowUpDate, attachments, lostReason } = req.body
        if (!LEAD_STAGES.includes(stage)) {
            return res.status(400).json({ success: false, message: "Invalid stage" })
        }
        // Field staff cannot self-assign or "un-assign" leads through this endpoint.
        if (["NEW"].includes(stage)) {
            return res.status(400).json({ success: false, message: "You cannot move a lead back to NEW" })
        }

        const { lead, error } = await findMyLead(req.params.id, req.demandEmployeeId)
        if (error === "notfound") return res.status(404).json({ success: false, message: "Lead not found" })
        if (error === "forbidden") return res.status(403).json({ success: false, message: "This lead is not assigned to you" })

        // Onboarding is NOT a plain stage flip — it must create/link a real
        // platform User account. Force it through the dedicated onboard flow so
        // "onboarded" always means "a registered user exists". A lead can only
        // become ACTIVE once it has been onboarded (i.e. has a linked user).
        if (stage === "ONBOARDED" && !lead.onboardedUser) {
            return res.status(400).json({
                success: false,
                code: "USE_ONBOARD_FLOW",
                message: "To onboard this lead you must register the customer/partner. Use the Onboard action.",
            })
        }
        if (stage === "ACTIVE" && !lead.onboardedUser) {
            return res.status(400).json({
                success: false,
                message: "Onboard this lead (register the user) before marking it Active.",
            })
        }

        lead.stage = stage
        lead.nextFollowUpDate = nextFollowUpDate || null

        if (stage === "CONTACTED" && !lead.contactedAt) lead.contactedAt = new Date()
        if (stage === "ACTIVE" && !lead.activatedAt) lead.activatedAt = new Date()
        if (stage === "LOST") {
            lead.lostAt = new Date()
            lead.lostReason = lostReason || ""
        }

        lead.activities.push({
            stage,
            note: note || "",
            employee: req.demandEmployeeId,
            nextFollowUpDate: nextFollowUpDate || null,
            attachments: Array.isArray(attachments) ? attachments : [],
        })

        await lead.save()
        res.json({
            success: true,
            message: `Lead moved to ${stage}`,
            data: lead,
            commissionsCreated: 0,
        })
    } catch (error) {
        console.error("[portal] updateMyLeadStage error:", error)
        res.status(500).json({ success: false, message: "Failed to update lead stage" })
    }
}

// @desc    Add a follow-up / note activity on MY lead (no stage change)
// @route   POST /api/demand-portal/leads/:id/activity
export const addMyLeadActivity = async (req, res) => {
    try {
        const { note, nextFollowUpDate, attachments } = req.body
        const { lead, error } = await findMyLead(req.params.id, req.demandEmployeeId)
        if (error === "notfound") return res.status(404).json({ success: false, message: "Lead not found" })
        if (error === "forbidden") return res.status(403).json({ success: false, message: "This lead is not assigned to you" })

        lead.activities.push({
            stage: lead.stage,
            note: note || "",
            employee: req.demandEmployeeId,
            nextFollowUpDate: nextFollowUpDate || null,
            attachments: Array.isArray(attachments) ? attachments : [],
        })
        if (nextFollowUpDate) lead.nextFollowUpDate = nextFollowUpDate

        await lead.save()
        res.json({ success: true, message: "Activity added", data: lead })
    } catch (error) {
        console.error("[portal] addMyLeadActivity error:", error)
        res.status(500).json({ success: false, message: "Failed to add activity" })
    }
}

// Platform roles a field employee may onboard a lead into.
const ONBOARDABLE_ROLES = ["COMMUTER", "CORPORATE", "B2C_PARTNER", "B2B_PARTNER"]
const ROLES_REQUIRING_TERMS = ["CORPORATE", "B2C_PARTNER", "B2B_PARTNER"]

// Map a lead's category / partner type (and, as a fallback, the campaign it
// came in under) to the platform User role it was intended for. This is what
// the onboarding form defaults to — a lead that enquired as a B2B partner is
// pre-selected as B2B_PARTNER, not silently defaulted to Commuter.
const roleForLead = (lead) => {
    if (lead.partnerType === "B2B") return "B2B_PARTNER"
    if (lead.partnerType === "B2C") return "B2C_PARTNER"
    if (lead.partnerType === "CORPORATE") return "CORPORATE"
    if (lead.leadCategory === "PARTNER") {
        // Partner lead with no explicit sub-type — fall back to the campaign
        // target so pre-existing / loosely-typed leads still resolve correctly.
        const target = lead.campaign?.target
        if (target === "B2B_PARTNER") return "B2B_PARTNER"
        if (target === "B2C_PARTNER") return "B2C_PARTNER"
        if (target === "CORPORATE") return "CORPORATE"
        return "B2B_PARTNER"
    }
    if (lead.leadCategory === "CUSTOMER") return "COMMUTER"
    // Untyped lead: last-resort inference from the campaign target.
    const target = lead.campaign?.target
    if (target === "B2B_PARTNER") return "B2B_PARTNER"
    if (target === "B2C_PARTNER") return "B2C_PARTNER"
    if (target === "CORPORATE") return "CORPORATE"
    return "COMMUTER"
}

// Normalise the payment-methods payload (may arrive as a JSON string via
// multipart FormData, a CSV string, or a real array).
const parsePaymentMethods = (raw) => {
    if (Array.isArray(raw)) return raw.filter(Boolean)
    if (typeof raw === "string" && raw.trim()) {
        try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) return parsed.filter(Boolean)
        } catch {
            return raw.split(",").map((s) => s.trim()).filter(Boolean)
        }
    }
    return []
}

// @desc    Onboard MY lead — register (or link) the real platform User,
//          move the lead to ONBOARDED, generate the commission and email the
//          new user a secure password-setup link.
// @route   POST /api/demand-portal/leads/:id/onboard
export const onboardMyLead = async (req, res) => {
    try {
        const {
            fullName, email, phone, countryCode, whatsappNumber, note,
            role: requestedRole,
            acceptedPaymentMethods,
            companyName, companyAddress,
            serviceType, yearsOfExperience, serviceDescription,
            termsAccepted, termsVersion,
        } = req.body

        const { lead, error } = await findMyLead(req.params.id, req.demandEmployeeId)
        if (error === "notfound") return res.status(404).json({ success: false, message: "Lead not found" })
        if (error === "forbidden") return res.status(403).json({ success: false, message: "This lead is not assigned to you" })

        if (lead.onboardedUser) {
            return res.status(400).json({ success: false, message: "This lead has already been onboarded" })
        }

        // Resolve the role the account is being registered into. The field
        // employee picks it in the onboarding form (defaulted to the lead's
        // intended role); we validate it and fall back to the lead's own
        // typing so we never register the wrong kind of account.
        const role = ONBOARDABLE_ROLES.includes(requestedRole) ? requestedRole : roleForLead(lead)
        const paymentMethods = parsePaymentMethods(acceptedPaymentMethods)
        const termsWasAccepted = termsAccepted === true || termsAccepted === "true"

        const finalEmail = String(email || lead.email || "").toLowerCase().trim()
        const finalName = String(fullName || lead.contactPerson || lead.name || "").trim()
        const finalPhone = String(whatsappNumber || phone || lead.phone || "").trim()
        if (!finalEmail) {
            return res.status(400).json({ success: false, message: "An email address is required to onboard this lead" })
        }
        if (!finalName) {
            return res.status(400).json({ success: false, message: "A full name is required to onboard this lead" })
        }
        if (!finalPhone) {
            return res.status(400).json({ success: false, message: "A contact/WhatsApp number is required to onboard this lead" })
        }

        // ===== Role-specific required fields (mirror of the public Register form) =====
        if (role === "CORPORATE" && (!companyName || !String(companyName).trim())) {
            return res.status(400).json({ success: false, message: "Company name is required to onboard a Corporate account" })
        }
        if (role === "B2C_PARTNER") {
            if (!serviceType || !String(serviceType).trim()) {
                return res.status(400).json({ success: false, message: "Service type is required to onboard a B2C Partner" })
            }
            if (!yearsOfExperience && yearsOfExperience !== 0 && yearsOfExperience !== "0") {
                return res.status(400).json({ success: false, message: "Years of experience is required to onboard a B2C Partner" })
            }
        }
        if ((role === "B2B_PARTNER" || role === "B2C_PARTNER") && paymentMethods.length === 0) {
            return res.status(400).json({ success: false, message: "Select at least one payment method for this partner" })
        }
        if (ROLES_REQUIRING_TERMS.includes(role) && !termsWasAccepted) {
            return res.status(400).json({ success: false, message: "The customer/partner must accept the Terms & Conditions to be onboarded" })
        }

        // Duplicate-identity guard: this email must not already belong to a
        // demand-generation employee (a person cannot be both staff and a
        // customer/partner on the same identity).
        const employeeConflict = await DemandEmployee.findOne({ email: finalEmail }).select("email")
        if (employeeConflict) {
            return res.status(409).json({
                success: false,
                code: "IDENTITY_IN_USE",
                message: "This email belongs to an internal employee account and cannot be onboarded as a customer/partner.",
            })
        }

        // ===== Upload any submitted documents/images to Cloudinary =====
        let profileImageUrl = null
        let tradeLicenseUrl = null
        let companyLogoUrl = null
        try {
            if (req.files?.profileImage?.[0]) {
                profileImageUrl = (await uploadToCloudinary(req.files.profileImage[0], "driveme/profiles", "profile")).secure_url
            }
            if (req.files?.tradeLicense?.[0]) {
                tradeLicenseUrl = (await uploadToCloudinary(req.files.tradeLicense[0], "driveme/documents", "trade-license")).secure_url
            }
            if (req.files?.companyLogo?.[0]) {
                companyLogoUrl = (await uploadToCloudinary(req.files.companyLogo[0], "driveme/logos", "company-logo")).secure_url
            }
        } catch (uploadErr) {
            console.error("[portal] onboarding file upload failed:", uploadErr?.message)
        }

        let user = await User.findOne({ email: finalEmail })
        let userWasCreated = false
        let setupUrl = null

        if (user) {
            // Reuse the existing platform account — just attribute it to this
            // acquisition. We do NOT create a duplicate or touch its password.
            user.acquisition = {
                lead: lead._id,
                acquiredByEmployee: req.demandEmployeeId,
                onboardedAt: new Date(),
                source: "DEMAND_GENERATION",
            }
            await user.save()
        } else {
            // Create a real, ACTIVE platform account. The user has no password
            // yet — we email them a secure setup link (staff onboarded on their
            // behalf, so no OTP flow here).
            const passwordSetupToken = crypto.randomBytes(32).toString("hex")
            const passwordSetupTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

            // Stamp the account's country / nationality from the dialing code
            // (same signal the public registration uses) so currency, payouts
            // and routing are consistent from day one.
            const registrationCountry = resolveRegistrationCountry({ countryCode: countryCode || "+965" })
            const locale = buildLocalePayload(registrationCountry)

            const userData = {
                role,
                fullName: finalName,
                email: finalEmail,
                whatsappNumber: finalPhone,
                countryCode: countryCode || "+965",
                country: locale.country,
                nationality: locale.countryName,
                acceptedPaymentMethods: paymentMethods,
                status: "ACTIVE",
                activatedAt: new Date(),
                // Random placeholder password (model requires one & hashes it).
                // Replaced when the user completes the setup link.
                password: crypto.randomBytes(16).toString("hex"),
                isPasswordSet: false,
                passwordSetupToken,
                passwordSetupTokenExpiry,
                ...(profileImageUrl ? { profileImage: profileImageUrl } : {}),
                acquisition: {
                    lead: lead._id,
                    acquiredByEmployee: req.demandEmployeeId,
                    onboardedAt: new Date(),
                    source: "DEMAND_GENERATION",
                },
            }

            // ===== Role-specific fields (parity with the Register page) =====
            if (role === "CORPORATE") {
                userData.companyName = String(companyName).trim()
                userData.companyAddress = companyAddress ? String(companyAddress).trim() : null
                if (tradeLicenseUrl) userData.tradeLicense = tradeLicenseUrl
                if (companyLogoUrl) userData.companyLogo = companyLogoUrl
            } else if (role === "B2B_PARTNER") {
                userData.companyName = (companyName && String(companyName).trim()) || lead.company || null
                userData.fleetManagement = []
                if (companyLogoUrl) userData.companyLogo = companyLogoUrl
            } else if (role === "B2C_PARTNER") {
                userData.serviceType = serviceType || null
                userData.yearsOfExperience = yearsOfExperience !== undefined && yearsOfExperience !== "" ? Number(yearsOfExperience) : null
                userData.serviceDescription = serviceDescription || null
                userData.routeListings = []
            } else {
                // COMMUTER — no company/partner specifics.
                userData.companyName = null
            }

            // Terms & Conditions acceptance snapshot for roles that require it.
            if (ROLES_REQUIRING_TERMS.includes(role) && termsWasAccepted) {
                userData.termsAndConditions = {
                    accepted: true,
                    acceptedAt: new Date(),
                    version: termsVersion || "1.0.0",
                    ipAddress: req.ip || req.headers["x-forwarded-for"] || "unknown",
                }
            }

            user = new User(userData)
            await user.save()
            userWasCreated = true

            const base = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0]
            setupUrl = `${base}/set-password?token=${passwordSetupToken}`
            // Fire-and-forget the invite email; onboarding must not fail if SMTP does.
            sendEmail(
                finalEmail,
                "Welcome to DriveMe — set up your account",
                `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color:#e11d48;">Welcome to DriveMe, ${finalName}!</h2>
                    <p>Your account has been created. Set your password to start using DriveMe.</p>
                    <div style="background:#f5f5f5;padding:14px;border-radius:8px;margin:16px 0;">
                        <p style="margin:0;"><strong>Login email:</strong> ${finalEmail}</p>
                    </div>
                    <a href="${setupUrl}" style="background:#e11d48;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Set your password</a>
                    <p style="color:#666;font-size:13px;margin-top:16px;">This link expires in 7 days. If you didn't expect this, you can ignore this email.</p>
                </div>
                `
            ).catch((e) => console.error("[portal] onboarding invite email failed:", e?.message))
        }

        // Advance the lead and record the onboarding linkage.
        lead.stage = "ONBOARDED"
        lead.onboardedAt = lead.onboardedAt || new Date()
        lead.onboardedUser = user._id
        lead.onboardedByEmployee = req.demandEmployeeId
        // keep the lead's contact fields in sync with what was registered
        if (!lead.email) lead.email = finalEmail
        if (!lead.contactPerson) lead.contactPerson = finalName
        if (!lead.phone) lead.phone = finalPhone
        // Reconcile the lead's own typing with the role it was actually
        // onboarded as, so the lead record and the created account never
        // disagree (fixes leads that were captured with the wrong type).
        if (role === "COMMUTER") {
            lead.leadCategory = "CUSTOMER"
            lead.partnerType = null
        } else {
            lead.leadCategory = "PARTNER"
            lead.partnerType = role === "B2B_PARTNER" ? "B2B" : role === "B2C_PARTNER" ? "B2C" : "CORPORATE"
        }
        lead.nextFollowUpDate = null
        lead.activities.push({
            stage: "ONBOARDED",
            note: note || `Onboarded as ${role} — ${finalName} (${finalEmail})${userWasCreated ? "" : " (linked to existing account)"}`,
            employee: req.demandEmployeeId,
        })

        // Guaranteed commission for the acquiring field employee. Generation is
        // idempotent (keyed on the lead + rule commission documents), so we call
        // it unconditionally — never gated on the `commissionGenerated` latch,
        // which could have been flipped by an earlier stage change without a
        // commission ever being created.
        const commissionsCreated = await generateCommissionsForLead(lead, null)
        lead.commissionGenerated = true

        await lead.save()

        res.status(201).json({
            success: true,
            message: userWasCreated
                ? "Lead onboarded — account created and a password-setup email was sent."
                : "Lead onboarded — linked to the existing platform account.",
            data: lead,
            userCreated: userWasCreated,
            user: { _id: user._id, email: user.email, role: user.role, status: user.status },
            commissionsCreated: commissionsCreated.length,
        })
    } catch (error) {
        console.error("[portal] onboardMyLead error:", error)
        res.status(500).json({ success: false, message: "Failed to onboard lead" })
    }
}

// @desc    MY expenses
// @route   GET /api/demand-portal/expenses
export const getMyExpenses = async (req, res) => {
    try {
        const expenses = await DemandExpense.find({ employee: req.demandEmployeeId }).sort({ date: -1 })
        const totalPaid = expenses.filter((e) => e.paymentStatus === "PAID").reduce((s, e) => s + e.amount, 0)
        const pendingApproval = expenses.filter((e) => e.approvalStatus === "PENDING").reduce((s, e) => s + e.amount, 0)
        res.json({ success: true, data: expenses, totalPaid, pendingApproval })
    } catch (error) {
        console.error("[portal] getMyExpenses error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch expenses" })
    }
}

// @desc    Submit MY expense (starts PENDING approval)
// @route   POST /api/demand-portal/expenses
export const submitMyExpense = async (req, res) => {
    try {
        const { category, amount } = req.body
        if (!category || !EXPENSE_CATEGORIES.includes(category)) {
            return res.status(400).json({ success: false, message: "Valid category is required" })
        }
        if (amount === undefined || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "A valid amount is required" })
        }

        const expense = await DemandExpense.create({
            employee: req.demandEmployeeId,
            category,
            amount: Number(amount),
            date: req.body.date || Date.now(),
            description: req.body.description || "",
            receiptUrl: req.body.receiptUrl || "",
            month: monthKey(req.body.date),
            approvalStatus: "PENDING",
            paymentStatus: "UNPAID",
        })
        res.status(201).json({ success: true, message: "Expense submitted for approval", data: expense })
    } catch (error) {
        console.error("[portal] submitMyExpense error:", error)
        res.status(500).json({ success: false, message: "Failed to submit expense" })
    }
}

// @desc    MY earned commissions
// @route   GET /api/demand-portal/commissions
export const getMyCommissions = async (req, res) => {
    try {
        const commissions = await DemandCommission.find({ employee: req.demandEmployeeId })
            .populate("lead", "leadCode name")
            .populate("campaign", "name")
            .populate("rule", "name")
            .sort({ createdAt: -1 })

        const summary = commissions.reduce(
            (acc, c) => {
                acc.total += c.amount
                if (c.status === "PENDING") acc.pending += c.amount
                if (c.status === "APPROVED") acc.approved += c.amount
                if (c.status === "PAID") acc.paid += c.amount
                return acc
            },
            { total: 0, pending: 0, approved: 0, paid: 0 }
        )
        res.json({ success: true, data: commissions, summary })
    } catch (error) {
        console.error("[portal] getMyCommissions error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch commissions" })
    }
}

/* ============================ FINANCE ============================ */

// @desc    Commissions queue for finance (defaults to non-paid)
// @route   GET /api/demand-portal/finance/commissions
export const getFinanceCommissions = async (req, res) => {
    try {
        const { status, month } = req.query
        const query = {}
        if (status) query.status = status
        if (month) query.month = month

        const commissions = await DemandCommission.find(query)
            .populate("employee", "fullName employeeCode")
            .populate("lead", "leadCode name")
            .populate("campaign", "name")
            .populate("rule", "name")
            .sort({ createdAt: -1 })

        const summary = commissions.reduce(
            (acc, c) => {
                if (c.status === "PENDING") acc.pending += c.amount
                if (c.status === "APPROVED") acc.approved += c.amount
                if (c.status === "PAID") acc.paid += c.amount
                return acc
            },
            { pending: 0, approved: 0, paid: 0 }
        )
        res.json({ success: true, data: commissions, summary })
    } catch (error) {
        console.error("[portal] getFinanceCommissions error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch commissions" })
    }
}

// @desc    Approve / pay a commission
// @route   PATCH /api/demand-portal/finance/commissions/:id/status
export const financeUpdateCommissionStatus = async (req, res) => {
    try {
        const { status } = req.body
        if (!["PENDING", "APPROVED", "PAID"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" })
        }
        const commission = await DemandCommission.findById(req.params.id)
        if (!commission) return res.status(404).json({ success: false, message: "Commission not found" })

        // Real money moves only on the transition INTO "PAID" (never twice).
        const isNewlyPaid = status === "PAID" && commission.status !== "PAID"

        commission.status = status
        commission.handledByEmployee = req.demandEmployeeId
        if (status === "PAID") commission.paidAt = new Date()
        await commission.save()

        if (isNewlyPaid) {
            const result = await settleCommissionPayment(commission)
            if (!result.success) {
                // Roll the status back so finance can retry; no money moved.
                commission.status = "APPROVED"
                commission.paidAt = null
                await commission.save()
                return res.status(400).json({ success: false, message: result.message || "Failed to pay commission into wallet" })
            }
        }

        res.json({ success: true, message: `Commission marked ${status}`, data: commission })
    } catch (error) {
        console.error("[portal] financeUpdateCommissionStatus error:", error)
        res.status(500).json({ success: false, message: "Failed to update commission" })
    }
}

// @desc    Approved / pending expenses queue for finance
// @route   GET /api/demand-portal/finance/expenses
export const getFinanceExpenses = async (req, res) => {
    try {
        const { approvalStatus, paymentStatus, month } = req.query
        const query = {}
        if (approvalStatus) query.approvalStatus = approvalStatus
        if (paymentStatus) query.paymentStatus = paymentStatus
        if (month) query.month = month

        const expenses = await DemandExpense.find(query)
            .populate("employee", "fullName employeeCode")
            .sort({ date: -1 })

        const summary = expenses.reduce(
            (acc, e) => {
                if (e.approvalStatus === "APPROVED" && e.paymentStatus === "UNPAID") acc.approvedUnpaid += e.amount
                if (e.paymentStatus === "PAID") acc.paid += e.amount
                if (e.approvalStatus === "PENDING") acc.pendingApproval += e.amount
                return acc
            },
            { approvedUnpaid: 0, paid: 0, pendingApproval: 0 }
        )
        res.json({ success: true, data: expenses, summary })
    } catch (error) {
        console.error("[portal] getFinanceExpenses error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch expenses" })
    }
}

// @desc    Approve / reject a pending expense (finance)
// @route   PATCH /api/demand-portal/finance/expenses/:id/approval
export const financeUpdateExpenseApproval = async (req, res) => {
    try {
        const { approvalStatus, rejectionReason } = req.body
        if (!["APPROVED", "REJECTED"].includes(approvalStatus)) {
            return res.status(400).json({ success: false, message: "Invalid approval status" })
        }
        const expense = await DemandExpense.findById(req.params.id)
        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" })

        expense.approvalStatus = approvalStatus
        expense.approvedAt = new Date()
        if (approvalStatus === "REJECTED") {
            expense.rejectionReason = rejectionReason || ""
            expense.paymentStatus = "UNPAID"
        }
        await expense.save()
        res.json({ success: true, message: `Expense ${approvalStatus.toLowerCase()}`, data: expense })
    } catch (error) {
        console.error("[portal] financeUpdateExpenseApproval error:", error)
        res.status(500).json({ success: false, message: "Failed to update approval" })
    }
}

// @desc    Pay an approved expense
// @route   PATCH /api/demand-portal/finance/expenses/:id/payment
export const financeUpdateExpensePayment = async (req, res) => {
    try {
        const { paymentStatus } = req.body
        if (!["UNPAID", "PAID"].includes(paymentStatus)) {
            return res.status(400).json({ success: false, message: "Invalid payment status" })
        }
        const expense = await DemandExpense.findById(req.params.id)
        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" })
        if (paymentStatus === "PAID" && expense.approvalStatus !== "APPROVED") {
            return res.status(400).json({ success: false, message: "Only approved expenses can be paid" })
        }

        const isNewlyPaid = paymentStatus === "PAID" && expense.paymentStatus !== "PAID"

        expense.paymentStatus = paymentStatus
        expense.paidAt = paymentStatus === "PAID" ? new Date() : null
        expense.paidByEmployee = paymentStatus === "PAID" ? req.demandEmployeeId : null
        await expense.save()

        if (isNewlyPaid) {
            const result = await settleExpensePayment(expense)
            if (!result.success) {
                expense.paymentStatus = "UNPAID"
                expense.paidAt = null
                expense.paidByEmployee = null
                await expense.save()
                return res.status(400).json({ success: false, message: result.message || "Failed to reimburse expense into wallet" })
            }
        }

        res.json({ success: true, message: `Expense marked ${paymentStatus.toLowerCase()}`, data: expense })
    } catch (error) {
        console.error("[portal] financeUpdateExpensePayment error:", error)
        res.status(500).json({ success: false, message: "Failed to update payment" })
    }
}

// @desc    Payout summary per employee (commissions + approved expenses owed)
// @route   GET /api/demand-portal/finance/summary
export const getFinancePayoutSummary = async (req, res) => {
    try {
        const employees = await DemandEmployee.find({ status: "ACTIVE" })
            .select("fullName employeeCode monthlySalary")
            .lean()

        const rows = await Promise.all(
            employees.map(async (emp) => {
                const [commAgg, expAgg] = await Promise.all([
                    DemandCommission.aggregate([
                        { $match: { employee: emp._id } },
                        { $group: { _id: "$status", total: { $sum: "$amount" } } },
                    ]),
                    DemandExpense.aggregate([
                        { $match: { employee: emp._id, approvalStatus: "APPROVED", paymentStatus: "UNPAID" } },
                        { $group: { _id: null, total: { $sum: "$amount" } } },
                    ]),
                ])
                const comm = { PENDING: 0, APPROVED: 0, PAID: 0 }
                commAgg.forEach((c) => { comm[c._id] = c.total })
                const expensesDue = expAgg[0]?.total || 0
                const commissionsDue = comm.PENDING + comm.APPROVED
                return {
                    _id: emp._id,
                    fullName: emp.fullName,
                    employeeCode: emp.employeeCode,
                    monthlySalary: emp.monthlySalary || 0,
                    commissionsPending: comm.PENDING,
                    commissionsApproved: comm.APPROVED,
                    commissionsPaid: comm.PAID,
                    expensesDue,
                    totalDue: commissionsDue + expensesDue,
                }
            })
        )

        const totals = rows.reduce(
            (acc, r) => {
                acc.commissionsDue += r.commissionsPending + r.commissionsApproved
                acc.expensesDue += r.expensesDue
                acc.totalDue += r.totalDue
                return acc
            },
            { commissionsDue: 0, expensesDue: 0, totalDue: 0 }
        )

        res.json({ success: true, data: rows.filter((r) => r.totalDue > 0 || r.commissionsPaid > 0), totals })
    } catch (error) {
        console.error("[portal] getFinancePayoutSummary error:", error)
        res.status(500).json({ success: false, message: "Failed to build payout summary" })
    }
}

/* ============================ WALLET (any staff) ============================ */

// @desc    MY wallet: balance, earnings, transactions + withdrawal requests
// @route   GET /api/demand-portal/wallet
export const getMyWallet = async (req, res) => {
    try {
        const employee = await DemandEmployee.findById(req.demandEmployeeId)
        if (!employee) return res.status(404).json({ success: false, message: "Employee not found" })

        const summary = await getStaffWalletSummary(employee)
        const withdrawals = await WithdrawalRequest.find({
            userId: req.demandEmployeeId,
            ownerModel: "DemandEmployee",
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()

        res.json({ success: true, data: { ...summary, withdrawals } })
    } catch (error) {
        console.error("[portal] getMyWallet error:", error)
        res.status(500).json({ success: false, message: "Failed to load wallet" })
    }
}

// @desc    Request a withdrawal from MY staff wallet (admin processes it in Finance)
// @route   POST /api/demand-portal/wallet/withdraw
export const requestStaffWithdrawal = async (req, res) => {
    try {
        const { amount, bankName, iban, accountHolderName, bankCode } = req.body
        const amt = Number(amount)
        if (!amt || amt <= 0) {
            return res.status(400).json({ success: false, message: "A valid amount is required" })
        }
        if (!bankName || !String(bankName).trim()) {
            return res.status(400).json({ success: false, message: "Bank name is required" })
        }
        if (!iban || !String(iban).trim()) {
            return res.status(400).json({ success: false, message: "IBAN / account number is required" })
        }
        if (!accountHolderName || !String(accountHolderName).trim()) {
            return res.status(400).json({ success: false, message: "Account holder name is required" })
        }

        const employee = await DemandEmployee.findById(req.demandEmployeeId)
        if (!employee) return res.status(404).json({ success: false, message: "Employee not found" })

        const wallet = await getOrCreateStaffWallet(employee)
        if (!wallet) return res.status(500).json({ success: false, message: "Wallet unavailable" })
        if ((wallet.balance || 0) < amt) {
            return res.status(400).json({ success: false, message: "Insufficient wallet balance" })
        }

        // Debit the wallet immediately and mark the transaction PENDING — mirrors
        // the customer/partner withdrawal flow so the balance can't be double-spent
        // while the admin processes it. A rejection refunds it (admin Finance flow).
        wallet.transactions.push({
            type: "WITHDRAWAL",
            amount: -amt,
            description: `Withdrawal to ${bankName} - ${accountHolderName}`,
            bankAccount: iban,
            bankCode: bankCode || "",
            bankName,
            accountHolderName,
            status: "PENDING",
            reference: `SWR-${Date.now().toString(36).toUpperCase()}`,
            createdAt: new Date(),
        })
        wallet.balance -= amt
        wallet.totalWithdrawals = (wallet.totalWithdrawals || 0) + amt
        await wallet.save()
        const walletTransactionId = wallet.transactions[wallet.transactions.length - 1]._id

        const withdrawal = await WithdrawalRequest.create({
            userId: employee._id,
            ownerModel: "DemandEmployee",
            walletId: wallet._id,
            requestId: WithdrawalRequest.generateRequestId(),
            amount: amt,
            currency: wallet.currency || "AED",
            bankName,
            bankCode: bankCode || "",
            iban,
            accountHolderName,
            country: "UAE",
            status: "PENDING",
            userInfo: buildStaffUserInfo(employee),
            walletTransactionId,
            metadata: { source: "DEMAND_PORTAL", employeeCode: employee.employeeCode },
        })

        res.status(201).json({
            success: true,
            message: "Withdrawal request submitted. The admin will process your payment.",
            data: { withdrawal, newBalance: wallet.balance },
        })
    } catch (error) {
        console.error("[portal] requestStaffWithdrawal error:", error)
        res.status(500).json({ success: false, message: "Failed to submit withdrawal request" })
    }
}

/* ============================ NOTIFICATIONS ============================ */

// @desc    List MY in-app notifications (newest first) + unread count
// @route   GET /api/demand-portal/notifications
export const getMyNotifications = async (req, res) => {
    try {
        const { unreadOnly } = req.query
        const query = { employee: req.demandEmployeeId }
        if (unreadOnly === "true") query.isRead = false

        const notifications = await DemandNotification.find(query)
            .populate("lead", "leadCode name stage")
            .sort({ createdAt: -1 })
            .limit(50)

        const unreadCount = await DemandNotification.countDocuments({
            employee: req.demandEmployeeId,
            isRead: false,
        })

        res.json({ success: true, data: notifications, unreadCount })
    } catch (error) {
        console.error("[portal] getMyNotifications error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch notifications" })
    }
}

// @desc    Mark a single notification read
// @route   PATCH /api/demand-portal/notifications/:id/read
export const markNotificationRead = async (req, res) => {
    try {
        const notif = await DemandNotification.findOneAndUpdate(
            { _id: req.params.id, employee: req.demandEmployeeId },
            { $set: { isRead: true, readAt: new Date() } },
            { new: true }
        )
        if (!notif) return res.status(404).json({ success: false, message: "Notification not found" })
        res.json({ success: true, data: notif })
    } catch (error) {
        console.error("[portal] markNotificationRead error:", error)
        res.status(500).json({ success: false, message: "Failed to update notification" })
    }
}

// @desc    Mark ALL my notifications read
// @route   PATCH /api/demand-portal/notifications/read-all
export const markAllNotificationsRead = async (req, res) => {
    try {
        await DemandNotification.updateMany(
            { employee: req.demandEmployeeId, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        )
        res.json({ success: true, message: "All notifications marked read" })
    } catch (error) {
        console.error("[portal] markAllNotificationsRead error:", error)
        res.status(500).json({ success: false, message: "Failed to update notifications" })
    }
}