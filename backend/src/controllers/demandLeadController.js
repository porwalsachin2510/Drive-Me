import Lead, { LEAD_STAGES } from "../models/Lead.js"
import DemandEmployee from "../models/DemandEmployee.js"
import DemandCampaign from "../models/DemandCampaign.js"
import { generateCommissionsForLead } from "./demandCommissionController.js"
import { captureLead, notifyAssignedEmployee } from "../Services/leadIntakeService.js"
import { resolveDisplayCurrency, fromBase, toBase } from "../Services/displayCurrency.js"

// Leads store `estimatedValue` in the platform base currency. Convert it to the
// admin's chosen display currency on the way out, and convert admin-entered
// values back to base on the way in.
const serializeLead = (lead, dc) => {
    const obj = typeof lead?.toObject === "function" ? lead.toObject() : lead
    return { ...obj, estimatedValue: fromBase(obj.estimatedValue || 0, dc), currency: dc }
}

// Basic server-side validation helpers for public/untrusted intake.
const isValidEmail = (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const isValidPhone = (v) => typeof v === "string" && v.replace(/[^\d]/g, "").length >= 7

/**
 * A lead can ONLY be worked by a FIELD employee (Sales Representative).
 * FINANCE staff exist to pay commissions/approved expenses — they never work
 * leads. This guard is the single source of truth used by every assignment
 * path (manual create, reassign, bulk-assign) so a finance employee can never
 * end up owning a lead.
 *
 * @returns {Promise<{ ok:true, emp } | { ok:false, code:number, message:string }>}
 */
const resolveAssignableEmployee = async (employeeId) => {
    const emp = await DemandEmployee.findById(employeeId).select("_id fullName email portalRole status region")
    if (!emp) return { ok: false, code: 404, message: "Employee not found" }
    if (emp.status !== "ACTIVE") {
        return { ok: false, code: 400, message: `${emp.fullName} is inactive and cannot be assigned leads.` }
    }
    if (emp.portalRole !== "FIELD") {
        return {
            ok: false,
            code: 422,
            message: `${emp.fullName} is a Finance employee. Leads can only be assigned to Field employees (Sales Representatives).`,
        }
    }
    return { ok: true, emp }
}

// @desc    List leads with filters
// @route   GET /api/demand/leads
export const getLeads = async (req, res) => {
    try {
        const {
            search, leadCategory, partnerType, stage, assignedTo, campaign,
            region, territory, source, page = 1, limit = 50,
        } = req.query

        const query = {}
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
        if (leadCategory) query.leadCategory = leadCategory
        if (partnerType) query.partnerType = partnerType
        if (stage) query.stage = stage
        if (assignedTo) query.assignedTo = assignedTo === "unassigned" ? null : assignedTo
        if (campaign) query.campaign = campaign
        if (region) query.region = region
        if (territory) query.territory = territory
        if (source) query.source = source

        const displayCurrency = resolveDisplayCurrency(req)
        const leadsRaw = await Lead.find(query)
            .populate("assignedTo", "fullName employeeCode")
            .populate("campaign", "name")
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean()
        const leads = leadsRaw.map((l) => serializeLead(l, displayCurrency))

        const total = await Lead.countDocuments(query)

        // Stage distribution for the current filter set (excluding pagination)
        const stageCounts = await Lead.aggregate([
            { $match: query },
            { $group: { _id: "$stage", count: { $sum: 1 } } },
        ])
        const stages = LEAD_STAGES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {})
        stageCounts.forEach((s) => { stages[s._id] = s.count })

        res.json({
            success: true,
            currency: displayCurrency,
            data: {
                leads,
                currency: displayCurrency,
                stages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        })
    } catch (error) {
        console.error("[demand] getLeads error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch leads" })
    }
}

// @desc    Get single lead with full activity trail
// @route   GET /api/demand/leads/:id
export const getLeadById = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate("assignedTo", "fullName employeeCode email phone")
            .populate("campaign", "name channel")
            .populate("activities.employee", "fullName employeeCode")
        if (!lead) return res.status(404).json({ success: false, message: "Lead not found" })
        const displayCurrency = resolveDisplayCurrency(req)
        res.json({ success: true, currency: displayCurrency, data: serializeLead(lead, displayCurrency) })
    } catch (error) {
        console.error("[demand] getLeadById error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch lead" })
    }
}

// @desc    Create lead
// @route   POST /api/demand/leads
export const createLead = async (req, res) => {
    try {
        const { name, leadCategory } = req.body
        if (!name || !leadCategory) {
            return res.status(400).json({ success: false, message: "Name and lead category are required" })
        }

        const displayCurrency = resolveDisplayCurrency(req)
        const assignedTo = req.body.assignedTo || null

        // Enforce: only Field (Sales Rep) employees may own a lead.
        if (assignedTo) {
            const check = await resolveAssignableEmployee(assignedTo)
            if (!check.ok) return res.status(check.code).json({ success: false, message: check.message })
        }

        const lead = new Lead({
            ...req.body,
            partnerType: leadCategory === "PARTNER" ? req.body.partnerType || null : null,
            // Value is entered in the admin's display currency; store in base.
            estimatedValue: toBase(Number(req.body.estimatedValue) || 0, displayCurrency),
            assignedTo,
            stage: assignedTo ? "ASSIGNED" : "NEW",
            assignedAt: assignedTo ? new Date() : null,
            createdBy: req.userId,
        })

        lead.activities.push({
            stage: lead.stage,
            note: assignedTo ? "Lead created and assigned" : "Lead created",
            employee: assignedTo,
            nextFollowUpDate: req.body.nextFollowUpDate || null,
        })

        await lead.save()

        // Notify the assigned rep (in-app + email) so they don't have to poll.
        if (assignedTo) {
            const emp = await DemandEmployee.findById(assignedTo).select("_id fullName email")
            const campaign = lead.campaign ? await DemandCampaign.findById(lead.campaign).select("name") : null
            await notifyAssignedEmployee(emp, lead, campaign)
        }

        res.status(201).json({ success: true, message: "Lead created", currency: displayCurrency, data: serializeLead(lead, displayCurrency) })
    } catch (error) {
        console.error("[demand] createLead error:", error)
        res.status(500).json({ success: false, message: "Failed to create lead" })
    }
}

// @desc    Update lead core fields
// @route   PUT /api/demand/leads/:id
export const updateLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
        if (!lead) return res.status(404).json({ success: false, message: "Lead not found" })

        const displayCurrency = resolveDisplayCurrency(req)
        const editable = [
            "name", "contactPerson", "email", "phone", "company", "source",
            "campaign", "territory", "region", "partnerType",
            "partnerSubType", "leadCategory", "nextFollowUpDate",
        ]
        editable.forEach((f) => {
            if (req.body[f] !== undefined) lead[f] = req.body[f]
        })
        // estimatedValue is entered in the display currency; persist in base.
        if (req.body.estimatedValue !== undefined) {
            lead.estimatedValue = toBase(Number(req.body.estimatedValue) || 0, displayCurrency)
        }

        await lead.save()
        res.json({ success: true, message: "Lead updated", currency: displayCurrency, data: serializeLead(lead, displayCurrency) })
    } catch (error) {
        console.error("[demand] updateLead error:", error)
        res.status(500).json({ success: false, message: "Failed to update lead" })
    }
}

// @desc    Assign / reassign a lead to an employee
// @route   PATCH /api/demand/leads/:id/assign
export const assignLead = async (req, res) => {
    try {
        const { employeeId, note } = req.body
        const lead = await Lead.findById(req.params.id)
        if (!lead) return res.status(404).json({ success: false, message: "Lead not found" })

        if (employeeId) {
            const check = await resolveAssignableEmployee(employeeId)
            if (!check.ok) return res.status(check.code).json({ success: false, message: check.message })
        }

        const isReassign = !!lead.assignedTo
        lead.assignedTo = employeeId || null
        lead.assignedAt = employeeId ? new Date() : lead.assignedAt
        if (employeeId && ["NEW"].includes(lead.stage)) lead.stage = "ASSIGNED"

        lead.activities.push({
            stage: lead.stage,
            note: note || (isReassign ? "Lead reassigned" : "Lead assigned"),
            employee: employeeId || null,
        })

        await lead.save()

        // Alert the newly assigned rep (skip on un-assign).
        if (employeeId) {
            const emp = await DemandEmployee.findById(employeeId).select("_id fullName email")
            const campaign = lead.campaign ? await DemandCampaign.findById(lead.campaign).select("name") : null
            await notifyAssignedEmployee(emp, lead, campaign)
        }

        const populated = await lead.populate("assignedTo", "fullName employeeCode")
        const displayCurrency = resolveDisplayCurrency(req)
        res.json({ success: true, message: "Lead assignment updated", currency: displayCurrency, data: serializeLead(populated, displayCurrency) })
    } catch (error) {
        console.error("[demand] assignLead error:", error)
        res.status(500).json({ success: false, message: "Failed to assign lead" })
    }
}

// @desc    Advance / update the workflow stage and log an activity
// @route   PATCH /api/demand/leads/:id/stage
export const updateLeadStage = async (req, res) => {
    try {
        const { stage, note, nextFollowUpDate, attachments, lostReason } = req.body
        if (!LEAD_STAGES.includes(stage)) {
            return res.status(400).json({ success: false, message: "Invalid stage" })
        }

        const lead = await Lead.findById(req.params.id)
        if (!lead) return res.status(404).json({ success: false, message: "Lead not found" })

        lead.stage = stage
        lead.nextFollowUpDate = nextFollowUpDate || null

        if (stage === "CONTACTED" && !lead.contactedAt) lead.contactedAt = new Date()
        if (stage === "ONBOARDED" && !lead.onboardedAt) lead.onboardedAt = new Date()
        if (stage === "ACTIVE" && !lead.activatedAt) lead.activatedAt = new Date()
        if (stage === "LOST") {
            lead.lostAt = new Date()
            lead.lostReason = lostReason || ""
        }

        lead.activities.push({
            stage,
            note: note || "",
            employee: lead.assignedTo || null,
            nextFollowUpDate: nextFollowUpDate || null,
            attachments: Array.isArray(attachments) ? attachments : [],
        })

        // Auto-generate commissions when the lead reaches ONBOARDED. Generation
        // is idempotent (keyed on the lead + rule commission documents), so it
        // is safe even if the lead was previously onboarded — it will only ever
        // create the commissions that are actually missing.
        let commissionsCreated = []
        if (stage === "ONBOARDED") {
            commissionsCreated = await generateCommissionsForLead(lead, req.userId)
            lead.commissionGenerated = true
        }

        await lead.save()
        const displayCurrency = resolveDisplayCurrency(req)
        res.json({
            success: true,
            message: `Lead moved to ${stage}`,
            currency: displayCurrency,
            data: serializeLead(lead, displayCurrency),
            commissionsCreated: commissionsCreated.length,
        })
    } catch (error) {
        console.error("[demand] updateLeadStage error:", error)
        res.status(500).json({ success: false, message: "Failed to update lead stage" })
    }
}

// @desc    Add a follow-up / note activity without changing stage
// @route   POST /api/demand/leads/:id/activity
export const addActivity = async (req, res) => {
    try {
        const { note, nextFollowUpDate, attachments } = req.body
        const lead = await Lead.findById(req.params.id)
        if (!lead) return res.status(404).json({ success: false, message: "Lead not found" })

        lead.activities.push({
            stage: lead.stage,
            note: note || "",
            employee: lead.assignedTo || null,
            nextFollowUpDate: nextFollowUpDate || null,
            attachments: Array.isArray(attachments) ? attachments : [],
        })
        if (nextFollowUpDate) lead.nextFollowUpDate = nextFollowUpDate

        await lead.save()
        const displayCurrency = resolveDisplayCurrency(req)
        res.json({ success: true, message: "Activity added", currency: displayCurrency, data: serializeLead(lead, displayCurrency) })
    } catch (error) {
        console.error("[demand] addActivity error:", error)
        res.status(500).json({ success: false, message: "Failed to add activity" })
    }
}

// @desc    Bulk assign leads (by campaign / territory selection)
// @route   POST /api/demand/leads/bulk-assign
export const bulkAssignLeads = async (req, res) => {
    try {
        const { leadIds, employeeId } = req.body
        if (!Array.isArray(leadIds) || leadIds.length === 0 || !employeeId) {
            return res.status(400).json({ success: false, message: "leadIds and employeeId are required" })
        }
        const check = await resolveAssignableEmployee(employeeId)
        if (!check.ok) return res.status(check.code).json({ success: false, message: check.message })
        const emp = check.emp

        const leads = await Lead.find({ _id: { $in: leadIds } })
        for (const lead of leads) {
            lead.assignedTo = employeeId
            lead.assignedAt = new Date()
            if (lead.stage === "NEW") lead.stage = "ASSIGNED"
            lead.activities.push({ stage: lead.stage, note: "Bulk assigned", employee: employeeId })
            await lead.save()
            await notifyAssignedEmployee(emp, lead, null)
        }
        res.json({ success: true, message: `${leads.length} leads assigned to ${emp.fullName}` })
    } catch (error) {
        console.error("[demand] bulkAssignLeads error:", error)
        res.status(500).json({ success: false, message: "Failed to bulk assign leads" })
    }
}

// @desc    Delete lead
// @route   DELETE /api/demand/leads/:id
export const deleteLead = async (req, res) => {
    try {
        const lead = await Lead.findByIdAndDelete(req.params.id)
        if (!lead) return res.status(404).json({ success: false, message: "Lead not found" })
        res.json({ success: true, message: "Lead deleted" })
    } catch (error) {
        console.error("[demand] deleteLead error:", error)
        res.status(500).json({ success: false, message: "Failed to delete lead" })
    }
}

/* ============================ AUTOMATIC INTAKE ============================ */

// @desc    Public: campaign meta for the enquiry form (no auth)
// @route   GET /api/demand/public/campaigns/:slug
export const getPublicCampaign = async (req, res) => {
    try {
        const campaign = await DemandCampaign.findOne({ slug: req.params.slug })
            .select("name description target channel status region")
            .lean()
        if (!campaign) {
            return res.status(404).json({ success: false, message: "Campaign not found" })
        }
        if (["COMPLETED", "PAUSED"].includes(campaign.status)) {
            return res.status(403).json({ success: false, message: "This campaign is no longer accepting enquiries." })
        }
        // Only expose what the public form needs.
        res.json({
            success: true,
            data: {
                name: campaign.name,
                description: campaign.description,
                target: campaign.target,
                region: campaign.region,
            },
        })
    } catch (error) {
        console.error("[demand] getPublicCampaign error:", error)
        res.status(500).json({ success: false, message: "Failed to load campaign" })
    }
}

// @desc    Public: capture a lead from the enquiry form (no auth, rate-limited)
// @route   POST /api/demand/public/leads/:slug
export const publicCreateLead = async (req, res) => {
    try {
        const { name, phone, email, category, message, company } = req.body

        // ---- Validation ----
        if (!name || !String(name).trim()) {
            return res.status(400).json({ success: false, message: "Name is required" })
        }
        if (!phone && !email) {
            return res.status(400).json({ success: false, message: "A phone number or email is required" })
        }
        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ success: false, message: "Please enter a valid phone number" })
        }
        if (email && !isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address" })
        }

        const campaign = await DemandCampaign.findOne({ slug: req.params.slug })
        if (!campaign) {
            return res.status(404).json({ success: false, message: "Campaign not found" })
        }
        if (["COMPLETED", "PAUSED"].includes(campaign.status)) {
            return res.status(403).json({ success: false, message: "This campaign is no longer accepting enquiries." })
        }

        const leadCategory = category === "PARTNER" ? "PARTNER" : "CUSTOMER"
        const result = await captureLead({
            campaign,
            source: "Public Form",
            defaultCategory: leadCategory,
            data: { name, phone, email, company, message, leadCategory },
        })

        return res.status(201).json({
            success: true,
            message: result.duplicate
                ? "Thanks! We already have your enquiry and our team will reach out shortly."
                : "Thank you! Your enquiry has been received. Our team will contact you soon.",
            duplicate: result.duplicate,
        })
    } catch (error) {
        console.error("[demand] publicCreateLead error:", error)
        res.status(500).json({ success: false, message: "Something went wrong. Please try again." })
    }
}

// @desc    Webhook intake for external sources (Meta/Google Lead Ads, Zapier)
// @route   POST /api/demand/webhooks/leads/:slug
// @access  Secured by per-campaign secret (Bearer token or ?token=)
export const webhookCreateLead = async (req, res) => {
    try {
        const campaign = await DemandCampaign.findOne({ slug: req.params.slug })
        if (!campaign) {
            return res.status(404).json({ success: false, message: "Campaign not found" })
        }

        // Authenticate with the per-campaign secret.
        const provided =
            req.headers.authorization?.replace(/^Bearer\s+/i, "").trim() ||
            req.query.token ||
            req.headers["x-webhook-token"] ||
            req.body.token
        if (!provided || provided !== campaign.webhookSecret) {
            return res.status(401).json({ success: false, message: "Invalid or missing webhook token" })
        }

        // External payloads vary wildly; map the common Lead-Ads / Zapier fields.
        const b = req.body || {}
        const data = {
            name: b.name || b.full_name || b.fullName || b.first_name || "",
            contactPerson: b.contactPerson || b.contact_name || "",
            phone: b.phone || b.phone_number || b.mobile || b.contact_number || "",
            email: b.email || b.email_address || "",
            company: b.company || b.company_name || b.organization || "",
            message: b.message || b.notes || b.comments || "",
            region: b.region || b.city || b.state || "",
            leadCategory: b.category === "PARTNER" || b.leadCategory === "PARTNER" ? "PARTNER" : "CUSTOMER",
        }

        if (!data.name && !data.phone && !data.email) {
            return res.status(400).json({ success: false, message: "Payload must include at least a name, phone or email" })
        }

        const result = await captureLead({
            campaign,
            source: b.source || "Webhook",
            data,
        })

        return res.status(201).json({
            success: true,
            message: result.duplicate ? "Duplicate — appended to existing lead" : "Lead captured",
            leadCode: result.lead.leadCode,
            duplicate: result.duplicate,
            assigned: result.assigned,
        })
    } catch (error) {
        console.error("[demand] webhookCreateLead error:", error)
        res.status(500).json({ success: false, message: "Failed to process webhook" })
    }
}

// @desc    Admin: bulk-import leads from a parsed CSV/Excel (rows of objects)
// @route   POST /api/demand/leads/bulk-import
export const bulkImportLeads = async (req, res) => {
    try {
        const { rows, campaign: campaignId, source } = req.body
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ success: false, message: "No rows to import" })
        }
        if (rows.length > 5000) {
            return res.status(400).json({ success: false, message: "Import is limited to 5000 rows at a time" })
        }

        let campaign = null
        if (campaignId) {
            campaign = await DemandCampaign.findById(campaignId)
            if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" })
        }

        const summary = { total: rows.length, created: 0, duplicates: 0, skipped: 0, errors: [] }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] || {}
            const name = row.name || row.Name || row.fullName || row["Full Name"] || row.contactPerson
            const phone = row.phone || row.Phone || row.mobile || row.Mobile || ""
            const email = row.email || row.Email || ""

            // A row must have a name and at least one contact channel.
            if (!name || (!phone && !email)) {
                summary.skipped += 1
                summary.errors.push({ row: i + 2, reason: "Missing name or contact (phone/email)" })
                continue
            }
            if (email && !isValidEmail(email)) {
                summary.skipped += 1
                summary.errors.push({ row: i + 2, reason: `Invalid email: ${email}` })
                continue
            }

            try {
                const result = await captureLead({
                    campaign,
                    source: source || "CSV Import",
                    defaultCategory:
                        (row.category || row.leadCategory || "").toUpperCase() === "PARTNER" ? "PARTNER" : "CUSTOMER",
                    data: {
                        name,
                        phone,
                        email,
                        company: row.company || row.Company || "",
                        contactPerson: row.contactPerson || row["Contact Person"] || "",
                        region: row.region || row.Region || "",
                        territory: row.territory || row.Territory || "",
                        estimatedValue: row.estimatedValue || row["Estimated Value"] || 0,
                        message: row.message || row.Message || row.notes || "",
                        leadCategory: (row.category || row.leadCategory || "").toUpperCase() === "PARTNER" ? "PARTNER" : "CUSTOMER",
                        partnerType: row.partnerType || row["Partner Type"] || null,
                    },
                })
                if (result.duplicate) summary.duplicates += 1
                else summary.created += 1
            } catch (rowErr) {
                summary.skipped += 1
                summary.errors.push({ row: i + 2, reason: rowErr.message })
            }
        }

        res.json({
            success: true,
            message: `Imported ${summary.created} lead(s), ${summary.duplicates} duplicate(s) merged, ${summary.skipped} skipped`,
            summary,
        })
    } catch (error) {
        console.error("[demand] bulkImportLeads error:", error)
        res.status(500).json({ success: false, message: "Failed to import leads" })
    }
}