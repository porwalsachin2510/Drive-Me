import Lead from "../models/Lead.js"
import DemandEmployee from "../models/DemandEmployee.js"
import DemandCampaign from "../models/DemandCampaign.js"
import DemandNotification from "../models/DemandNotification.js"
import { sendEmail } from "./emailService.js"

/**
 * leadIntakeService
 * -----------------
 * Central, reusable pipeline that turns a raw enquiry (public form, webhook,
 * or CSV row) into a real, attributed Lead with:
 *   1. Duplicate detection  (append activity to an existing OPEN lead instead
 *      of creating a duplicate)
 *   2. Auto-attribution      (source + campaign set from the tracking slug)
 *   3. Auto-assignment        (optional per-campaign round-robin / by-region)
 *   4. Notifications          (in-app DemandNotification + email to the rep)
 *
 * Every admin/portal path funnels through this so behaviour stays consistent.
 */

// Stages that mean the lead is still "in play" for duplicate detection.
const OPEN_STAGES = ["NEW", "ASSIGNED", "CONTACTED", "FOLLOW_UP", "INTERESTED", "DOCUMENTATION_PENDING"]

const norm = (v) => (typeof v === "string" ? v.trim() : v)
const normEmail = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "")
const normPhone = (v) => (typeof v === "string" ? v.replace(/[^\d+]/g, "") : "")

// Map a campaign's acquisition `target` to how the lead should be typed.
// A "B2B Partner" campaign only ever collects B2B partners, a "Corporate"
// campaign collects corporates, etc. This is what guarantees a lead who came
// in wanting to be a partner is later onboarded as that partner role — and
// not silently defaulted to a Commuter.
const TARGET_TO_TYPING = {
    CUSTOMER: { leadCategory: "CUSTOMER", partnerType: null },
    B2B_PARTNER: { leadCategory: "PARTNER", partnerType: "B2B" },
    B2C_PARTNER: { leadCategory: "PARTNER", partnerType: "B2C" },
    CORPORATE: { leadCategory: "PARTNER", partnerType: "CORPORATE" },
}

/**
 * Decide a lead's { leadCategory, partnerType } from (in priority order):
 *   1. A campaign with a SPECIFIC target (not ALL) — the acquisition intent.
 *   2. Explicit typing passed in the payload (admin/CSV/webhook overrides).
 *   3. The caller's default category.
 */
export const deriveLeadTyping = ({ campaign, data = {}, defaultCategory = "CUSTOMER" }) => {
    const target = campaign?.target
    if (target && target !== "ALL" && TARGET_TO_TYPING[target]) {
        return { ...TARGET_TO_TYPING[target] }
    }

    const explicitCategory = ["CUSTOMER", "PARTNER"].includes(data.leadCategory) ? data.leadCategory : null
    const explicitPartner = ["B2B", "B2C", "CORPORATE"].includes(data.partnerType) ? data.partnerType : null
    if (explicitCategory === "PARTNER") {
        return { leadCategory: "PARTNER", partnerType: explicitPartner || null }
    }
    if (explicitCategory === "CUSTOMER") {
        return { leadCategory: "CUSTOMER", partnerType: null }
    }

    const cat = ["CUSTOMER", "PARTNER"].includes(defaultCategory) ? defaultCategory : "CUSTOMER"
    return { leadCategory: cat, partnerType: cat === "PARTNER" ? explicitPartner : null }
}

/**
 * Find an existing OPEN lead matching the same phone or email so we can
 * de-duplicate instead of creating a second record for the same person.
 */
export const findDuplicateOpenLead = async ({ phone, email }) => {
    const or = []
    const p = normPhone(phone)
    const e = normEmail(email)
    if (p) or.push({ phone: p })
    if (e) or.push({ email: e })
    if (or.length === 0) return null
    return Lead.findOne({ $or: or, stage: { $in: OPEN_STAGES } }).sort({ createdAt: -1 })
}

/**
 * Pick the next FIELD employee (Sales Representative) for auto-assignment.
 *
 * Only FIELD staff work leads — FINANCE staff are excluded entirely, so a
 * finance officer can never be auto-assigned a lead.
 *
 * - ROUND_ROBIN: rotate through all active field reps using a persisted cursor.
 * - REGION: narrow to field reps whose region matches the lead's region, then
 *   round-robin within that subset so, when a region has MANY field reps, the
 *   load is shared fairly instead of always hitting the same person. Falls
 *   back to all active field reps when the region has none.
 */
const pickAssignee = async (campaign, lead) => {
    let employees = await DemandEmployee.find({ status: "ACTIVE", portalRole: "FIELD" })
        .sort({ createdAt: 1 })
        .select("_id fullName email region")
    if (!employees.length) return null

    const strategy = campaign?.autoAssign?.strategy || "ROUND_ROBIN"

    if (strategy === "REGION" && lead.region) {
        const regional = employees.filter(
            (e) => (e.region || "").toLowerCase() === String(lead.region).toLowerCase()
        )
        if (regional.length) employees = regional
    }

    const prevIndex = Number.isInteger(campaign?.autoAssign?.lastAssignedIndex)
        ? campaign.autoAssign.lastAssignedIndex
        : -1
    const nextIndex = (prevIndex + 1) % employees.length
    const chosen = employees[nextIndex]

    // Persist the cursor so the next lead goes to the next rep. We update the
    // exact path to avoid clobbering concurrent edits to the campaign.
    try {
        await DemandCampaign.updateOne(
            { _id: campaign._id },
            { $set: { "autoAssign.lastAssignedIndex": nextIndex } }
        )
    } catch (e) {
        console.error("[leadIntake] failed to persist round-robin cursor:", e.message)
    }

    return chosen
}

/**
 * Notify a field rep (in-app + best-effort email) that a lead landed on them.
 */
export const notifyAssignedEmployee = async (employee, lead, campaign) => {
    if (!employee) return
    const leadLabel = lead.name || lead.contactPerson || lead.phone || lead.email || "New lead"
    const title = "New lead assigned to you"
    const message = `${leadLabel} (${lead.leadCode}) has been assigned to you${campaign?.name ? ` from campaign "${campaign.name}"` : ""
        }. Open your Field Portal to start working it.`

    // 1) In-app notification (real DB write) for the Staff Portal bell.
    try {
        await DemandNotification.create({
            employee: employee._id || employee,
            type: "LEAD_ASSIGNED",
            title,
            message,
            lead: lead._id,
            campaign: campaign?._id || lead.campaign || null,
            data: { leadCode: lead.leadCode, stage: lead.stage },
        })
    } catch (e) {
        console.error("[leadIntake] in-app notification failed:", e.message)
    }

    // 2) Best-effort email (reuses the shared email service). Never blocks intake.
    if (employee.email) {
        try {
            await sendEmail(
                employee.email,
                `New lead assigned: ${leadLabel}`,
                `<p>Hi ${employee.fullName || "there"},</p>
                 <p>A new lead has just been assigned to you:</p>
                 <ul>
                   <li><strong>Lead:</strong> ${leadLabel}</li>
                   <li><strong>Code:</strong> ${lead.leadCode}</li>
                   ${lead.phone ? `<li><strong>Phone:</strong> ${lead.phone}</li>` : ""}
                   ${lead.email ? `<li><strong>Email:</strong> ${lead.email}</li>` : ""}
                   ${campaign?.name ? `<li><strong>Campaign:</strong> ${campaign.name}</li>` : ""}
                 </ul>
                 <p>Please log in to your Field Portal to contact them.</p>`
            )
        } catch (e) {
            console.error("[leadIntake] assignment email failed:", e.message)
        }
    }
}

/**
 * Capture a lead from any external/bulk source.
 *
 * @param {Object}  opts
 * @param {Object}  opts.campaign   A DemandCampaign document (already loaded).
 * @param {Object}  opts.data       Raw lead fields (name, phone, email, ...).
 * @param {String}  opts.source     Where the lead came from (e.g. "Public Form").
 * @param {String}  [opts.defaultCategory="CUSTOMER"]
 * @returns {Promise<{ lead, created:boolean, duplicate:boolean, assigned:boolean }>}
 */
export const captureLead = async ({ campaign, data = {}, source = "Direct", defaultCategory = "CUSTOMER" }) => {
    const phone = normPhone(data.phone)
    const email = normEmail(data.email)

    // ---- 1. Duplicate detection ----
    const existing = await findDuplicateOpenLead({ phone, email })
    if (existing) {
        existing.activities.push({
            stage: existing.stage,
            note: `Duplicate enquiry received via ${source}${campaign?.name ? ` (campaign: ${campaign.name})` : ""
                }${data.message ? ` — "${String(data.message).slice(0, 300)}"` : ""}`,
            employee: existing.assignedTo || null,
        })
        // If the existing lead was never attributed to a campaign, attribute it now.
        if (!existing.campaign && campaign?._id) existing.campaign = campaign._id
        await existing.save()
        return { lead: existing, created: false, duplicate: true, assigned: !!existing.assignedTo }
    }

    // ---- 2. Build the new lead (auto-attributed) ----
    // Type the lead from the campaign target first (the real acquisition
    // intent), then any explicit payload typing, then the default. This is
    // what stops a partner enquiry being mis-labelled as a customer/commuter.
    const { leadCategory, partnerType } = deriveLeadTyping({ campaign, data, defaultCategory })
    const lead = new Lead({
        leadCategory,
        partnerType,
        partnerSubType: data.partnerSubType || "",
        name: norm(data.name) || norm(data.contactPerson) || "Unnamed Lead",
        contactPerson: norm(data.contactPerson) || "",
        email,
        phone,
        company: norm(data.company) || "",
        source,
        campaign: campaign?._id || null,
        region: norm(data.region) || campaign?.region || "",
        territory: norm(data.territory) || "",
        estimatedValue: Number(data.estimatedValue) || 0,
        stage: "NEW",
    })

    lead.activities.push({
        stage: "NEW",
        note: `Lead captured via ${source}${campaign?.name ? ` — campaign "${campaign.name}"` : ""}${data.message ? ` — "${String(data.message).slice(0, 300)}"` : ""
            }`,
        employee: null,
    })

    // ---- 3. Optional auto-assignment ----
    let assignee = null
    if (campaign?.autoAssign?.enabled) {
        assignee = await pickAssignee(campaign, lead)
        if (assignee) {
            lead.assignedTo = assignee._id
            lead.assignedAt = new Date()
            lead.stage = "ASSIGNED"
            lead.activities.push({
                stage: "ASSIGNED",
                note: `Auto-assigned to ${assignee.fullName} (${campaign.autoAssign.strategy})`,
                employee: assignee._id,
            })
        }
    }

    await lead.save()

    // ---- 4. Notify the assigned rep ----
    if (assignee) {
        await notifyAssignedEmployee(assignee, lead, campaign)
    }

    return { lead, created: true, duplicate: false, assigned: !!assignee }
}

export default { captureLead, findDuplicateOpenLead, notifyAssignedEmployee }