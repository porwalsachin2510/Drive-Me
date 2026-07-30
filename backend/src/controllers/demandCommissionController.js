import DemandCommission from "../models/DemandCommission.js"
import DemandCommissionRule from "../models/DemandCommissionRule.js"
import { resolveDisplayCurrency, fromBase, toBase } from "../Services/displayCurrency.js"
import { settleCommissionPayment } from "../Services/staffWalletService.js"

const monthKey = (d = new Date()) => {
    const dt = new Date(d)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
}

const triggerForLead = (lead) => {
    if (lead.leadCategory === "CUSTOMER") return "CUSTOMER_ONBOARDED"
    if (lead.partnerType === "B2B") return "B2B_PARTNER_ONBOARDED"
    if (lead.partnerType === "B2C") return "B2C_PARTNER_ONBOARDED"
    if (lead.partnerType === "CORPORATE") return "CORPORATE_ONBOARDED"
    return null
}

// Sensible default onboarding commissions (in platform BASE currency). These
// are seeded ONCE per trigger if an admin hasn't configured any active rule,
// so a field employee always earns a commission the moment they onboard a
// lead. They are ordinary DemandCommissionRule records and remain fully
// editable/removable from the admin Commissions tab.
const DEFAULT_RULE_SEEDS = {
    CUSTOMER_ONBOARDED: { name: "Customer Onboarding (default)", amount: 50 },
    B2C_PARTNER_ONBOARDED: { name: "B2C Partner Onboarding (default)", amount: 150 },
    B2B_PARTNER_ONBOARDED: { name: "B2B Partner Onboarding (default)", amount: 500 },
    CORPORATE_ONBOARDED: { name: "Corporate Onboarding (default)", amount: 500 },
}

/**
 * Return the active rules for a trigger. If none exist yet, lazily seed the
 * default rule for that trigger so onboarding always generates a commission.
 */
const getActiveRulesForTrigger = async (trigger) => {
    let rules = await DemandCommissionRule.find({ trigger, active: true })
    if (rules.length === 0 && DEFAULT_RULE_SEEDS[trigger]) {
        const seed = DEFAULT_RULE_SEEDS[trigger]
        const created = await DemandCommissionRule.create({
            name: seed.name,
            description: "Auto-created default rule. Edit or replace it from the Commissions tab.",
            trigger,
            calcType: "FIXED",
            amount: seed.amount, // stored in base currency
            active: true,
        })
        rules = [created]
    }
    return rules
}

/**
 * Reusable helper — generates commission records for a lead that just
 * reached the ONBOARDED stage, based on active commission rules. Also
 * applies a campaign incentive if the lead is attributed to a campaign.
 * Returns the created commission documents.
 */
export const generateCommissionsForLead = async (lead, userId = null) => {
    const created = []
    const trigger = triggerForLead(lead)
    if (!trigger || !lead.assignedTo) return created

    const leadId = lead._id
    // `lead.campaign` may be an ObjectId or a populated document — normalise it.
    const campaignId = lead.campaign?._id || lead.campaign || null

    const rules = await getActiveRulesForTrigger(trigger)
    for (const rule of rules) {
        // Idempotency is keyed on real data (the existing commission documents
        // for this lead + rule), NOT on the lead's `commissionGenerated` flag.
        // This means the helper is safe to call repeatedly and self-heals any
        // lead that reached ONBOARDED without a commission ever being created.
        const alreadyExists = await DemandCommission.countDocuments({ lead: leadId, rule: rule._id })
        if (alreadyExists) continue

        const amount =
            rule.calcType === "PERCENTAGE"
                ? ((lead.estimatedValue || 0) * (rule.percentage || 0)) / 100
                : rule.amount || 0
        if (amount <= 0) continue

        const commission = await DemandCommission.create({
            employee: lead.assignedTo,
            rule: rule._id,
            lead: leadId,
            campaign: campaignId,
            trigger,
            calcType: rule.calcType,
            amount,
            month: monthKey(),
            status: "PENDING",
            note: `Auto: ${rule.name} for lead ${lead.leadCode}`,
            createdBy: userId,
        })
        created.push(commission)
    }

    // Campaign-based incentive (flat per onboarding) — also idempotent.
    if (campaignId) {
        const incentiveExists = await DemandCommission.countDocuments({
            lead: leadId,
            trigger: "CAMPAIGN_INCENTIVE",
        })
        if (!incentiveExists) {
            const DemandCampaign = (await import("../models/DemandCampaign.js")).default
            const campaign = await DemandCampaign.findById(campaignId)
            if (campaign && campaign.incentivePerOnboarding > 0) {
                const commission = await DemandCommission.create({
                    employee: lead.assignedTo,
                    lead: leadId,
                    campaign: campaign._id,
                    trigger: "CAMPAIGN_INCENTIVE",
                    calcType: "FIXED",
                    amount: campaign.incentivePerOnboarding,
                    month: monthKey(),
                    status: "PENDING",
                    note: `Campaign incentive: ${campaign.name}`,
                    createdBy: userId,
                })
                created.push(commission)
            }
        }
    }

    return created
}

// @route POST /api/demand/commissions/reconcile
// @desc  Backfill missing commissions for leads that are already onboarded.
//        Self-heals historical leads whose `commissionGenerated` latch was
//        flipped (e.g. by earlier versions of the onboarding flow) without a
//        commission ever being written. Fully idempotent — running it twice
//        never creates duplicates.
export const reconcileCommissions = async (req, res) => {
    try {
        const Lead = (await import("../models/Lead.js")).default
        const leads = await Lead.find({
            onboardedUser: { $ne: null },
            assignedTo: { $ne: null },
        }).populate("campaign", "name target incentivePerOnboarding")

        let leadsFixed = 0
        let commissionsCreated = 0
        for (const lead of leads) {
            const createdForLead = await generateCommissionsForLead(lead, req.userId)
            if (createdForLead.length > 0) {
                leadsFixed += 1
                commissionsCreated += createdForLead.length
                if (!lead.commissionGenerated) {
                    lead.commissionGenerated = true
                    await lead.save()
                }
            }
        }

        res.json({
            success: true,
            message: commissionsCreated
                ? `Reconciled ${commissionsCreated} commission(s) across ${leadsFixed} onboarded lead(s).`
                : "All onboarded leads already have their commissions.",
            data: { leadsScanned: leads.length, leadsFixed, commissionsCreated },
        })
    } catch (error) {
        console.error("[demand] reconcileCommissions error:", error)
        res.status(500).json({ success: false, message: "Failed to reconcile commissions" })
    }
}

// ---------- Commission Rules ----------

// @route GET /api/demand/commission-rules
export const getRules = async (req, res) => {
    try {
        const displayCurrency = resolveDisplayCurrency(req)
        const rulesRaw = await DemandCommissionRule.find().sort({ createdAt: -1 }).lean()
        const rules = rulesRaw.map((r) => ({ ...r, amount: fromBase(r.amount || 0, displayCurrency), currency: displayCurrency }))
        res.json({ success: true, currency: displayCurrency, data: rules })
    } catch (error) {
        console.error("[demand] getRules error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch commission rules" })
    }
}

// @route POST /api/demand/commission-rules
export const createRule = async (req, res) => {
    try {
        const { name, trigger, calcType, amount, percentage } = req.body
        if (!name || !trigger) {
            return res.status(400).json({ success: false, message: "Name and trigger are required" })
        }
        const displayCurrency = resolveDisplayCurrency(req)
        const rule = await DemandCommissionRule.create({
            ...req.body,
            // FIXED amount is entered in the display currency; store in base.
            amount: toBase(Number(amount) || 0, displayCurrency),
            percentage: Number(percentage) || 0,
            createdBy: req.userId,
        })
        const data = { ...rule.toObject(), amount: fromBase(rule.amount || 0, displayCurrency), currency: displayCurrency }
        res.status(201).json({ success: true, message: "Rule created", currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] createRule error:", error)
        res.status(500).json({ success: false, message: "Failed to create rule" })
    }
}

// @route PUT /api/demand/commission-rules/:id
export const updateRule = async (req, res) => {
    try {
        const displayCurrency = resolveDisplayCurrency(req)
        const update = { ...req.body }
        if (update.amount !== undefined) update.amount = toBase(Number(update.amount) || 0, displayCurrency)
        const rule = await DemandCommissionRule.findByIdAndUpdate(req.params.id, update, {
            new: true,
            runValidators: true,
        })
        if (!rule) return res.status(404).json({ success: false, message: "Rule not found" })
        const data = { ...rule.toObject(), amount: fromBase(rule.amount || 0, displayCurrency), currency: displayCurrency }
        res.json({ success: true, message: "Rule updated", currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] updateRule error:", error)
        res.status(500).json({ success: false, message: "Failed to update rule" })
    }
}

// @route DELETE /api/demand/commission-rules/:id
export const deleteRule = async (req, res) => {
    try {
        const rule = await DemandCommissionRule.findByIdAndDelete(req.params.id)
        if (!rule) return res.status(404).json({ success: false, message: "Rule not found" })
        res.json({ success: true, message: "Rule deleted" })
    } catch (error) {
        console.error("[demand] deleteRule error:", error)
        res.status(500).json({ success: false, message: "Failed to delete rule" })
    }
}

// ---------- Earned Commissions ----------

// @route GET /api/demand/commissions
export const getCommissions = async (req, res) => {
    try {
        const { employee, status, month, trigger } = req.query
        const query = {}
        if (employee) query.employee = employee
        if (status) query.status = status
        if (month) query.month = month
        if (trigger) query.trigger = trigger

        const displayCurrency = resolveDisplayCurrency(req)
        const commissionsRaw = await DemandCommission.find(query)
            .populate("employee", "fullName employeeCode")
            .populate("lead", "leadCode name")
            .populate("campaign", "name")
            .populate("rule", "name")
            .sort({ createdAt: -1 })
            .lean()

        const commissions = commissionsRaw.map((c) => ({ ...c, amount: fromBase(c.amount || 0, displayCurrency), currency: displayCurrency }))
        const totalAmount = commissions.reduce((s, c) => s + (c.amount || 0), 0)
        res.json({ success: true, currency: displayCurrency, data: commissions, totalAmount })
    } catch (error) {
        console.error("[demand] getCommissions error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch commissions" })
    }
}

// @route POST /api/demand/commissions  (manual entry)
export const createCommission = async (req, res) => {
    try {
        const { employee, amount } = req.body
        if (!employee || amount === undefined) {
            return res.status(400).json({ success: false, message: "Employee and amount are required" })
        }
        const displayCurrency = resolveDisplayCurrency(req)
        const commission = await DemandCommission.create({
            ...req.body,
            // Manual amount is entered in the display currency; store in base.
            amount: toBase(Number(amount), displayCurrency),
            month: req.body.month || monthKey(),
            createdBy: req.userId,
        })
        const data = { ...commission.toObject(), amount: fromBase(commission.amount || 0, displayCurrency), currency: displayCurrency }
        res.status(201).json({ success: true, message: "Commission added", currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] createCommission error:", error)
        res.status(500).json({ success: false, message: "Failed to add commission" })
    }
}

// @route PATCH /api/demand/commissions/:id/status
export const updateCommissionStatus = async (req, res) => {
    try {
        const { status } = req.body
        if (!["PENDING", "APPROVED", "PAID"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" })
        }
        const commission = await DemandCommission.findById(req.params.id)
        if (!commission) return res.status(404).json({ success: false, message: "Commission not found" })

        // Money moves once, only on the transition into PAID.
        const isNewlyPaid = status === "PAID" && commission.status !== "PAID"

        commission.status = status
        if (status === "APPROVED") commission.approvedBy = req.userId
        if (status === "PAID") commission.paidAt = new Date()
        await commission.save()

        if (isNewlyPaid) {
            const result = await settleCommissionPayment(commission, { actingUserId: req.userId })
            if (!result.success) {
                commission.status = "APPROVED"
                commission.paidAt = null
                await commission.save()
                return res.status(400).json({ success: false, message: result.message || "Failed to pay commission into wallet" })
            }
        }

        const displayCurrency = resolveDisplayCurrency(req)
        const data = { ...commission.toObject(), amount: fromBase(commission.amount || 0, displayCurrency), currency: displayCurrency }
        res.json({ success: true, message: `Commission marked ${status}`, currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] updateCommissionStatus error:", error)
        res.status(500).json({ success: false, message: "Failed to update commission" })
    }
}

// @route DELETE /api/demand/commissions/:id
export const deleteCommission = async (req, res) => {
    try {
        const commission = await DemandCommission.findByIdAndDelete(req.params.id)
        if (!commission) return res.status(404).json({ success: false, message: "Commission not found" })
        res.json({ success: true, message: "Commission deleted" })
    } catch (error) {
        console.error("[demand] deleteCommission error:", error)
        res.status(500).json({ success: false, message: "Failed to delete commission" })
    }
}