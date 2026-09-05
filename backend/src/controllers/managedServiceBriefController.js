import mongoose from "mongoose"
import axios from "axios"
import * as XLSX from "xlsx"
import ManagedServiceBrief from "../models/ManagedServiceBrief.js"
import Contract from "../models/Contract.js"
import Quotation from "../models/Quotation.js"
import User from "../models/User.js"
import { logManagedActivity } from "../utils/operationContext.js"
import { createNotification } from "../Services/notificationService.js"
import { broadcastManagedBriefUpdate } from "../Services/socketService.js"
import { isCustomerRole, isPartnerRole } from "../utils/roleFamilies.js"
import { uploadToCloudinary } from "../Config/Cloudinary.js"
import CorporateEmployee from "../models/CorporateEmployee.js"
import Route from "../models/Route.js"
import { parseBriefDocuments } from "../utils/briefDocumentParser.js"

/**
 * Normalize an incoming array of brief-document descriptors to only the fields
 * we persist. Used when the corporate re-saves the brief (e.g. adds a revised
 * version) so we never trust arbitrary client fields.
 */
const sanitizeBriefDocuments = (documents = []) =>
    (Array.isArray(documents) ? documents : [])
        .filter((d) => d && String(d.url || "").trim())
        .map((d) => ({
            fileName: String(d.fileName || "").trim(),
            url: String(d.url).trim(),
            publicId: String(d.publicId || "").trim(),
            fileType: String(d.fileType || "").trim(),
            fileSize: Number(d.fileSize) || 0,
            version: Number(d.version) > 0 ? Number(d.version) : 1,
            uploadedById: d.uploadedById || null,
            uploadedByName: String(d.uploadedByName || "").trim(),
            uploadedAt: d.uploadedAt || new Date(),
        }))

/**
 * POST /api/managed-service-brief/upload-documents
 * Uploads one or more requirement documents (Excel, PDF, Word, CSV, images) to
 * Cloudinary and returns their descriptors. The customer uploads BEFORE the
 * quotation/brief exists, so the returned descriptors travel in the brief
 * payload and get persisted onto the brief at submit time. Only customer roles
 * (CORPORATE / SCHOOL_CUSTOMER) may upload.
 */
export const uploadBriefDocuments = async (req, res) => {
    try {
        if (!isCustomerRole(req.userRole)) {
            return res.status(403).json({
                success: false,
                message: "Only customer accounts can upload requirement documents.",
            })
        }

        const files = req.files || []
        if (!files.length) {
            return res.status(400).json({
                success: false,
                message: "No files received. Attach at least one document.",
            })
        }

        const uploaderName = await (async () => {
            try {
                const user = await User.findById(req.userId).select("fullName companyName")
                return user?.companyName || user?.fullName || "Customer"
            } catch {
                return "Customer"
            }
        })()

        const uploaded = []
        for (const file of files) {
            const result = await uploadToCloudinary(file, "driveme/managed-service-briefs")
            uploaded.push({
                fileName: file.originalname,
                url: result.secure_url,
                publicId: result.public_id,
                fileType: file.mimetype,
                fileSize: file.size,
                version: 1,
                uploadedById: req.userId,
                uploadedByName: uploaderName,
                uploadedAt: new Date(),
            })
        }

        res.json({
            success: true,
            message: `${uploaded.length} document(s) uploaded.`,
            data: { documents: uploaded },
        })
    } catch (error) {
        console.error("[managedServiceBrief] uploadBriefDocuments error:", error?.message)
        res.status(500).json({
            success: false,
            message: error?.message || "Failed to upload documents.",
        })
    }
}

/**
 * Compute live SLA / progress metrics for a brief. Pure function over the brief
 * document — no DB writes. Used by getBrief and the metrics endpoint so both
 * corporate and partner see the same numbers.
 */
export const computeBriefMetrics = (brief) => {
    const items = [
        ...(brief.routeRequests || []),
        ...(brief.employeeRoster || []),
    ]
    const total = items.length
    const now = Date.now()
    const slaHours = brief?.sla?.fulfillmentSlaHours || 72
    const submittedAt = brief.submittedAt ? new Date(brief.submittedAt).getTime() : null

    let pending = 0
    let inProgress = 0
    let fulfilled = 0
    let approved = 0
    let rejected = 0
    let pendingReview = 0
    let overdue = 0

    for (const it of items) {
        const f = it.fulfillment || {}
        if (f.status === "PENDING") pending++
        else if (f.status === "IN_PROGRESS") inProgress++
        else if (f.status === "FULFILLED") fulfilled++

        if (f.approvalStatus === "APPROVED") approved++
        else if (f.approvalStatus === "REJECTED") rejected++
        else if (f.approvalStatus === "PENDING_REVIEW") pendingReview++

        // An item is overdue if it is not yet fulfilled and the SLA window
        // (submittedAt + slaHours) has elapsed.
        if (submittedAt && f.status !== "FULFILLED") {
            const deadline = submittedAt + slaHours * 3600 * 1000
            if (now > deadline) overdue++
        }
    }

    const completionPct = total === 0 ? 0 : Math.round((fulfilled / total) * 100)
    const approvalPct = total === 0 ? 0 : Math.round((approved / total) * 100)
    // On-time = fulfilled items that were fulfilled within the SLA window.
    let onTime = 0
    for (const it of items) {
        const f = it.fulfillment || {}
        if (f.status === "FULFILLED" && f.fulfilledAt && submittedAt) {
            const deadline = submittedAt + slaHours * 3600 * 1000
            if (new Date(f.fulfilledAt).getTime() <= deadline) onTime++
        }
    }
    const onTimePct = fulfilled === 0 ? 0 : Math.round((onTime / fulfilled) * 100)

    return {
        total,
        pending,
        inProgress,
        fulfilled,
        approved,
        rejected,
        pendingReview,
        overdue,
        completionPct,
        approvalPct,
        onTimePct,
        slaHours,
        targetCompletionDate: brief?.sla?.targetCompletionDate || null,
    }
}

/**
 * Auto-link fulfillment.
 * -----------------------
 * When a B2B partner creates a real operational entity (a route or an employee)
 * on behalf of a corporate on a MANAGED contract, and they indicated WHICH brief
 * item that entity fulfils (explicit briefItemId), we automatically mark that
 * brief item FULFILLED, link the created entity, notify the corporate for review,
 * log the activity and broadcast the live update.
 *
 * This is intentionally defensive: it must NEVER throw into the primary create
 * flow (creating the route/employee must still succeed even if the brief link
 * fails). All failures are swallowed and logged.
 *
 * @param {Object} params
 * @param {String} params.contractId   - the MANAGED contract id
 * @param {String} params.section      - "routeRequests" | "employeeRoster"
 * @param {String} params.briefItemId  - the brief sub-document _id to fulfil
 * @param {String} params.entityId     - the created entity's _id (route/employee)
 * @param {String} params.entityType   - "ROUTE" | "EMPLOYEE" | ...
 * @param {String} params.actorId      - the acting user's id (the partner)
 * @param {String} params.actorRole    - "B2B_PARTNER" (or "CORPORATE")
 * @returns {Promise<boolean>} true when an item was auto-fulfilled
 */
export const autoFulfillBriefItem = async ({
    contractId,
    section,
    briefItemId,
    entityId,
    entityType,
    actorId,
    actorRole,
}) => {
    try {
        if (!contractId || !briefItemId) return false
        if (!["routeRequests", "employeeRoster"].includes(section)) return false
        if (!mongoose.Types.ObjectId.isValid(briefItemId)) return false

        const contract = await Contract.findById(contractId).select(
            "corporateOwnerId fleetOwnerId serviceMode contractNumber",
        )
        if (!contract || contract.serviceMode !== "MANAGED") return false

        const brief = await ManagedServiceBrief.findOne({ contractId })
        if (!brief) return false

        const item = brief[section].id(briefItemId)
        if (!item) return false

        // If it is already fulfilled AND approved, don't disturb it.
        if (
            item.fulfillment?.status === "FULFILLED" &&
            item.fulfillment?.approvalStatus === "APPROVED"
        ) {
            return false
        }

        let actorName = "Partner"
        if (actorId) {
            const actor = await User.findById(actorId).select("fullName companyName").lean()
            actorName = actor?.companyName || actor?.fullName || "Partner"
        }

        item.fulfillment.status = "FULFILLED"
        item.fulfillment.fulfilledBy = actorId || null
        item.fulfillment.fulfilledByName = actorName
        item.fulfillment.fulfilledAt = new Date()
        item.fulfillment.approvalStatus = "PENDING_REVIEW"
        if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
            item.fulfillment.linkedEntityId = entityId
        }
        if (entityType) item.fulfillment.linkedEntityType = entityType
        item.fulfillment.note =
            item.fulfillment.note ||
            `Auto-linked to the ${entityType?.toLowerCase() || "entity"} created on ${new Date().toLocaleString()}.`

        // Advance the overall brief status.
        if (brief.status === "SUBMITTED" || brief.status === "ACCEPTED") {
            brief.status = "IN_PROGRESS"
        }

        const allItems = [...brief.routeRequests, ...brief.employeeRoster]
        const allApproved =
            allItems.length > 0 &&
            allItems.every(
                (i) =>
                    i.fulfillment.status === "FULFILLED" &&
                    i.fulfillment.approvalStatus === "APPROVED",
            )
        if (allApproved) {
            brief.status = "COMPLETED"
            brief.completedAt = new Date()
        } else if (brief.status === "COMPLETED") {
            brief.status = "IN_PROGRESS"
            brief.completedAt = null
        }

        await brief.save()

        const itemLabel =
            item.label || item.name || (section === "routeRequests" ? "route request" : "employee")

        await logManagedActivity(contractId, {
            action: "SERVICE_BRIEF_ITEM_AUTO_FULFILLED",
            description: `Partner auto-fulfilled "${itemLabel}" by creating a ${entityType?.toLowerCase() || "entity"}.`,
            entityType: "SERVICE_BRIEF",
            entityId: brief._id,
            performedBy: actorId,
            performedByRole: actorRole || "B2B_PARTNER",
            performedByName: actorName,
            meta: { section, briefItemId, linkedEntityId: entityId, linkedEntityType: entityType },
        })

        await createNotification({
            userId: brief.corporateOwnerId,
            type: "MANAGED_ITEM_FULFILLED",
            title: "Operations item ready for review",
            message: `${actorName} set up "${itemLabel}" on contract ${contract.contractNumber} and linked it to your brief. Review and approve it.`,
            data: {
                contractId: contractId.toString(),
                briefId: brief._id.toString(),
                section,
                itemId: briefItemId.toString(),
                linkedEntityId: entityId ? entityId.toString() : null,
                linkedEntityType: entityType || null,
            },
        })

        broadcastManagedBriefUpdate(
            {
                corporateOwnerId: brief.corporateOwnerId,
                b2bPartnerId: brief.b2bPartnerId,
                contractId,
            },
            { event: "ITEM_AUTO_FULFILLED", actorRole: actorRole || "B2B_PARTNER" },
        )

        return true
    } catch (error) {
        // Never break the primary create operation.
        console.error("[managedServiceBrief] autoFulfillBriefItem error:", error.message)
        return false
    }
}

/**
 * Resolve the contract and validate that the requester is allowed to touch its
 * managed-service brief. Returns { contract, role } or sends an error response.
 *
 * - CORPORATE requester must own the contract (corporateOwnerId).
 * - B2B_PARTNER requester must be the contract's fleet owner (fleetOwnerId).
 * - Contract must be MANAGED.
 */
const resolveBriefAccess = async (req, res) => {
    const { contractId } = req.params

    if (!mongoose.Types.ObjectId.isValid(contractId)) {
        res.status(400).json({ success: false, message: "Invalid contract id." })
        return null
    }

    const contract = await Contract.findById(contractId).select(
        "corporateOwnerId fleetOwnerId serviceMode contractNumber financials",
    )

    if (!contract) {
        res.status(404).json({ success: false, message: "Contract not found." })
        return null
    }

    if (contract.serviceMode !== "MANAGED") {
        res.status(403).json({
            success: false,
            message: "Service briefs are only available for managed-service contracts.",
        })
        return null
    }

    // Normalise customer/partner families to canonical side labels so school
    // users share this managed-service brief pipeline with corporate users.
    let role = null
    if (isCustomerRole(req.userRole) && contract.corporateOwnerId.toString() === req.userId) {
        role = "CORPORATE"
    } else if (isPartnerRole(req.userRole) && contract.fleetOwnerId.toString() === req.userId) {
        role = "B2B_PARTNER"
    }

    if (!role) {
        res.status(403).json({
            success: false,
            message: "You do not have access to this contract's service brief.",
        })
        return null
    }

    return { contract, role }
}

/**
 * Build a managed-service billing summary from the contract's financials.
 * For MANAGED contracts the B2B partner earns a `serviceCharge` component of
 * the `totalAmount`. We surface the split so both parties see, in the
 * contract's own currency (AED for UAE, KWD for Kuwait, etc.), what is being
 * billed for the managed operation.
 */
const computeBillingSummary = (contract) => {
    const f = contract.financials || {}
    const currency = f.currency || "AED"
    const totalAmount = Number(f.totalAmount) || 0
    const serviceCharge = Number(f.serviceCharge) || 0
    return {
        currency,
        totalAmount,
        serviceCharge,
        // The fleet/operational cost is whatever remains after the mgmt charge.
        operationalAmount: Math.max(totalAmount - serviceCharge, 0),
    }
}

// Find or lazily create the brief document for a contract.
const getOrCreateBrief = async (contract) => {
    let brief = await ManagedServiceBrief.findOne({ contractId: contract._id })
    if (!brief) {
        brief = await ManagedServiceBrief.create({
            contractId: contract._id,
            corporateOwnerId: contract.corporateOwnerId,
            b2bPartnerId: contract.fleetOwnerId,
            status: "DRAFT",
        })
    }
    return brief
}

/**
 * GET /api/managed-service-brief/:contractId
 * Both corporate and partner can read the brief.
 */
export const getBrief = async (req, res) => {
    try {
        const access = await resolveBriefAccess(req, res)
        if (!access) return

        const brief = await getOrCreateBrief(access.contract)

        res.json({
            success: true,
            data: {
                brief,
                viewerRole: access.role,
                contractNumber: access.contract.contractNumber,
                metrics: computeBriefMetrics(brief),
                billing: computeBillingSummary(access.contract),
            },
        })
    } catch (error) {
        console.error("[managedServiceBrief] getBrief error:", error)
        res.status(500).json({ success: false, message: "Failed to load service brief." })
    }
}

/**
 * PUT /api/managed-service-brief/:contractId
 * Corporate edits the brief content. Only allowed while DRAFT / SUBMITTED /
 * IN_PROGRESS (i.e. not COMPLETED). Partner cannot edit content.
 */
export const updateBrief = async (req, res) => {
    try {
        const access = await resolveBriefAccess(req, res)
        if (!access) return

        if (access.role !== "CORPORATE") {
            return res.status(403).json({
                success: false,
                message: "Only the corporate client can edit the service brief.",
            })
        }

        const brief = await getOrCreateBrief(access.contract)

        if (brief.status === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "This brief is completed and can no longer be edited.",
            })
        }

        const {
            summary,
            comments,
            documents,
            serviceStartDate,
            pointOfContact,
            workLocations,
            routeRequests,
            employeeRoster,
            sla,
        } = req.body

        if (summary !== undefined) brief.summary = summary
        if (comments !== undefined) brief.comments = comments
        if (Array.isArray(documents)) brief.documents = sanitizeBriefDocuments(documents)
        if (serviceStartDate !== undefined) brief.serviceStartDate = serviceStartDate || null
        if (pointOfContact !== undefined) brief.pointOfContact = pointOfContact
        if (sla !== undefined && sla) {
            if (sla.targetCompletionDate !== undefined)
                brief.sla.targetCompletionDate = sla.targetCompletionDate || null
            if (sla.fulfillmentSlaHours !== undefined && Number(sla.fulfillmentSlaHours) > 0)
                brief.sla.fulfillmentSlaHours = Number(sla.fulfillmentSlaHours)
        }

        // When the corporate replaces list sections, preserve existing fulfillment
        // data for items that still exist (matched by _id) so partner progress isn't lost.
        if (Array.isArray(workLocations)) brief.workLocations = workLocations
        if (Array.isArray(routeRequests)) {
            brief.routeRequests = mergeFulfillment(brief.routeRequests, routeRequests)
        }
        if (Array.isArray(employeeRoster)) {
            brief.employeeRoster = mergeFulfillment(brief.employeeRoster, employeeRoster)
        }

        await brief.save()

        res.json({ success: true, message: "Service brief saved.", data: { brief } })
    } catch (error) {
        console.error("[managedServiceBrief] updateBrief error:", error)
        res.status(500).json({ success: false, message: "Failed to save service brief." })
    }
}

// Keep partner fulfillment info when the corporate re-saves a list section.
const mergeFulfillment = (existingItems = [], incomingItems = []) => {
    const existingById = new Map(
        existingItems.map((it) => [it._id?.toString(), it.fulfillment]),
    )
    return incomingItems.map((incoming) => {
        const prevFulfillment =
            incoming._id && existingById.get(incoming._id.toString())
        if (prevFulfillment) {
            return { ...incoming, fulfillment: prevFulfillment }
        }
        return incoming
    })
}

/**
 * POST /api/managed-service-brief/:contractId/submit
 * Corporate submits the brief to the partner (DRAFT -> SUBMITTED).
 */
export const submitBrief = async (req, res) => {
    try {
        const access = await resolveBriefAccess(req, res)
        if (!access) return

        if (access.role !== "CORPORATE") {
            return res.status(403).json({
                success: false,
                message: "Only the corporate client can submit the service brief.",
            })
        }

        const brief = await getOrCreateBrief(access.contract)

        if (brief.status === "COMPLETED") {
            return res.status(400).json({ success: false, message: "This brief is already completed." })
        }

        brief.status = "SUBMITTED"
        brief.submittedAt = new Date()
        // Re-submitting (e.g. after a clarification request) resets the partner
        // acknowledgement so they must accept the updated brief again.
        brief.partnerResponse = {
            status: "NONE",
            respondedBy: null,
            respondedByName: null,
            respondedAt: null,
            note: "",
        }
        await brief.save()

        const actor = await User.findById(req.userId).select("fullName companyName").lean()
        await logManagedActivity(access.contract._id, {
            action: "SERVICE_BRIEF_SUBMITTED",
            description: "Corporate submitted the managed-service brief to the partner.",
            entityType: "SERVICE_BRIEF",
            entityId: brief._id,
            performedBy: req.userId,
            performedByRole: "CORPORATE",
            performedByName: actor?.companyName || actor?.fullName,
            meta: {
                routeRequests: brief.routeRequests.length,
                employees: brief.employeeRoster.length,
                workLocations: brief.workLocations.length,
            },
        })

        // Notify the B2B partner that a brief is now ready for them to execute.
        await createNotification({
            userId: brief.b2bPartnerId,
            type: "MANAGED_BRIEF_SUBMITTED",
            title: "New managed-service brief",
            message: `${actor?.companyName || actor?.fullName || "A corporate client"} submitted an operations brief for contract ${access.contract.contractNumber}. ${brief.routeRequests.length} route request(s) and ${brief.employeeRoster.length} employee(s) to set up.`,
            data: {
                contractId: access.contract._id.toString(),
                briefId: brief._id.toString(),
                contractNumber: access.contract.contractNumber,
            },
        })

        broadcastManagedBriefUpdate(
            {
                corporateOwnerId: brief.corporateOwnerId,
                b2bPartnerId: brief.b2bPartnerId,
                contractId: access.contract._id,
            },
            { event: "BRIEF_SUBMITTED", actorRole: "CORPORATE" },
        )

        res.json({ success: true, message: "Service brief submitted to partner.", data: { brief } })
    } catch (error) {
        console.error("[managedServiceBrief] submitBrief error:", error)
        res.status(500).json({ success: false, message: "Failed to submit service brief." })
    }
}

/**
 * POST /api/managed-service-brief/:contractId/respond
 * Partner acknowledges a SUBMITTED brief: ACCEPT (agree to operate, execution
 * may begin) or REQUEST_CLARIFICATION (send it back to the corporate with a
 * question — a message is recorded and the corporate is notified). This is the
 * real-world two-way handshake that gates execution on the partner's agreement.
 */
export const respondToBrief = async (req, res) => {
    try {
        const access = await resolveBriefAccess(req, res)
        if (!access) return

        if (access.role !== "B2B_PARTNER") {
            return res.status(403).json({
                success: false,
                message: "Only the partner can accept or request clarification on a brief.",
            })
        }

        const { decision, note } = req.body
        if (!["ACCEPT", "REQUEST_CLARIFICATION"].includes(decision)) {
            return res.status(400).json({
                success: false,
                message: "Decision must be ACCEPT or REQUEST_CLARIFICATION.",
            })
        }

        const brief = await getOrCreateBrief(access.contract)

        // The partner can only respond to a brief that has actually been handed
        // to them (SUBMITTED). Drafts aren't visible for action; briefs already
        // in progress/completed have moved past the acknowledgement stage.
        if (brief.status !== "SUBMITTED") {
            return res.status(400).json({
                success: false,
                message:
                    brief.status === "DRAFT"
                        ? "This brief has not been submitted yet."
                        : "This brief has already been accepted or is in progress.",
            })
        }

        if (decision === "REQUEST_CLARIFICATION" && (!note || !note.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please describe what needs clarification.",
            })
        }

        const actor = await User.findById(req.userId).select("fullName companyName").lean()
        const actorName = actor?.companyName || actor?.fullName || "Partner"

        if (decision === "ACCEPT") {
            brief.status = "ACCEPTED"
            brief.partnerResponse = {
                status: "ACCEPTED",
                respondedBy: req.userId,
                respondedByName: actorName,
                respondedAt: new Date(),
                note: note?.trim() || "",
            }
            if (note && note.trim()) {
                brief.messages.push({
                    senderId: req.userId,
                    senderName: actorName,
                    senderRole: "B2B_PARTNER",
                    message: note.trim(),
                    createdAt: new Date(),
                })
            }
        } else {
            // Clarification requested: the brief stays SUBMITTED (execution is
            // still blocked) but we record the request + message so the corporate
            // can answer / update the brief and re-submit.
            brief.partnerResponse = {
                status: "CLARIFICATION_REQUESTED",
                respondedBy: req.userId,
                respondedByName: actorName,
                respondedAt: new Date(),
                note: note.trim(),
            }
            brief.messages.push({
                senderId: req.userId,
                senderName: actorName,
                senderRole: "B2B_PARTNER",
                message: note.trim(),
                createdAt: new Date(),
            })
        }

        await brief.save()

        await logManagedActivity(access.contract._id, {
            action: decision === "ACCEPT" ? "SERVICE_BRIEF_ACCEPTED" : "SERVICE_BRIEF_CLARIFICATION_REQUESTED",
            description:
                decision === "ACCEPT"
                    ? "Partner accepted the managed-service brief and will begin execution."
                    : `Partner requested clarification on the brief: ${note.trim()}`,
            entityType: "SERVICE_BRIEF",
            entityId: brief._id,
            performedBy: req.userId,
            performedByRole: "B2B_PARTNER",
            performedByName: actorName,
            meta: { decision, note: note?.trim() || "" },
        })

        await createNotification({
            userId: brief.corporateOwnerId,
            type: decision === "ACCEPT" ? "MANAGED_BRIEF_ACCEPTED" : "MANAGED_BRIEF_CLARIFICATION",
            title: decision === "ACCEPT" ? "Partner accepted your brief" : "Partner needs clarification",
            message:
                decision === "ACCEPT"
                    ? `${actorName} accepted your operations brief for contract ${access.contract.contractNumber} and will begin setting everything up.`
                    : `${actorName} has a question about your brief for contract ${access.contract.contractNumber}: ${note.trim()}`,
            data: {
                contractId: access.contract._id.toString(),
                briefId: brief._id.toString(),
                decision,
            },
        })

        broadcastManagedBriefUpdate(
            {
                corporateOwnerId: brief.corporateOwnerId,
                b2bPartnerId: brief.b2bPartnerId,
                contractId: access.contract._id,
            },
            {
                event: decision === "ACCEPT" ? "BRIEF_ACCEPTED" : "BRIEF_CLARIFICATION_REQUESTED",
                actorRole: "B2B_PARTNER",
            },
        )

        res.json({
            success: true,
            message:
                decision === "ACCEPT"
                    ? "Brief accepted. You can now start fulfilling items."
                    : "Clarification request sent to the corporate client.",
            data: { brief, metrics: computeBriefMetrics(brief) },
        })
    } catch (error) {
        console.error("[managedServiceBrief] respondToBrief error:", error)
        res.status(500).json({ success: false, message: "Failed to submit response." })
    }
}

/**
 * PATCH /api/managed-service-brief/:contractId/items/:section/:itemId/fulfillment
 * Partner marks a route-request or roster item as IN_PROGRESS / FULFILLED.
 * section is "routeRequests" | "employeeRoster".
 */
export const updateItemFulfillment = async (req, res) => {
    try {
        const access = await resolveBriefAccess(req, res)
        if (!access) return

        if (access.role !== "B2B_PARTNER") {
            return res.status(403).json({
                success: false,
                message: "Only the partner can update fulfillment status.",
            })
        }

        const { section, itemId } = req.params
        const { status, linkedEntityId, linkedEntityType, note } = req.body

        if (!["routeRequests", "employeeRoster"].includes(section)) {
            return res.status(400).json({ success: false, message: "Invalid brief section." })
        }
        if (!["PENDING", "IN_PROGRESS", "FULFILLED"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid fulfillment status." })
        }

        const brief = await getOrCreateBrief(access.contract)

        // Real-world handshake: the partner must ACCEPT the brief before they can
        // start executing against it. A brief that is still SUBMITTED (awaiting
        // the partner's acknowledgement) cannot have its items fulfilled yet.
        if (brief.status === "SUBMITTED" && brief.partnerResponse?.status !== "ACCEPTED") {
            return res.status(400).json({
                success: false,
                message:
                    "Accept the brief before updating fulfillment. Review the requirements and click Accept (or Request clarification) first.",
            })
        }

        const item = brief[section].id(itemId)
        if (!item) {
            return res.status(404).json({ success: false, message: "Brief item not found." })
        }

        const actor = await User.findById(req.userId).select("fullName companyName").lean()
        const actorName = actor?.companyName || actor?.fullName || "Partner"

        item.fulfillment.status = status
        item.fulfillment.note = note || item.fulfillment.note || ""
        if (linkedEntityId && mongoose.Types.ObjectId.isValid(linkedEntityId)) {
            item.fulfillment.linkedEntityId = linkedEntityId
        }
        if (linkedEntityType) {
            item.fulfillment.linkedEntityType = linkedEntityType
        }
        if (status === "FULFILLED") {
            item.fulfillment.fulfilledBy = req.userId
            item.fulfillment.fulfilledByName = actorName
            item.fulfillment.fulfilledAt = new Date()
            // Fulfilled work now awaits corporate review (two-way handshake).
            item.fulfillment.approvalStatus = "PENDING_REVIEW"
        } else {
            // Moving away from FULFILLED clears any prior review state.
            item.fulfillment.approvalStatus = "NONE"
            item.fulfillment.reviewedBy = null
            item.fulfillment.reviewedByName = null
            item.fulfillment.reviewedAt = null
        }

        // Auto-advance the overall brief status once the partner starts working.
        if (brief.status === "SUBMITTED" || brief.status === "ACCEPTED") {
            brief.status = "IN_PROGRESS"
        }

        // A brief is only COMPLETED when every item is FULFILLED *and* the
        // corporate has APPROVED it. Otherwise it stays IN_PROGRESS.
        const allItems = [...brief.routeRequests, ...brief.employeeRoster]
        const allApproved =
            allItems.length > 0 &&
            allItems.every(
                (i) =>
                    i.fulfillment.status === "FULFILLED" &&
                    i.fulfillment.approvalStatus === "APPROVED",
            )
        if (allApproved) {
            brief.status = "COMPLETED"
            brief.completedAt = new Date()
        } else if (brief.status === "COMPLETED") {
            brief.status = "IN_PROGRESS"
            brief.completedAt = null
        }

        await brief.save()

        await logManagedActivity(access.contract._id, {
            action: "SERVICE_BRIEF_ITEM_UPDATED",
            description: `Partner marked a ${section === "routeRequests" ? "route request" : "roster"
                } item as ${status}.`,
            entityType: "SERVICE_BRIEF",
            entityId: brief._id,
            performedBy: req.userId,
            performedByRole: "B2B_PARTNER",
            performedByName: actorName,
            meta: { section, itemId, status },
        })

        // When the partner fulfils an item, alert the corporate that it is
        // ready for their review/approval.
        if (status === "FULFILLED") {
            const itemLabel =
                item.label || item.name || (section === "routeRequests" ? "route request" : "employee")
            await createNotification({
                userId: brief.corporateOwnerId,
                type: "MANAGED_ITEM_FULFILLED",
                title: "Operations item ready for review",
                message: `${actorName} fulfilled "${itemLabel}" on contract ${access.contract.contractNumber}. Review and approve it.`,
                data: {
                    contractId: access.contract._id.toString(),
                    briefId: brief._id.toString(),
                    section,
                    itemId,
                },
            })
        }

        broadcastManagedBriefUpdate(
            {
                corporateOwnerId: brief.corporateOwnerId,
                b2bPartnerId: brief.b2bPartnerId,
                contractId: access.contract._id,
            },
            { event: "ITEM_FULFILLMENT_UPDATED", actorRole: "B2B_PARTNER" },
        )

        res.json({
            success: true,
            message: "Fulfillment updated.",
            data: { brief, metrics: computeBriefMetrics(brief) },
        })
    } catch (error) {
        console.error("[managedServiceBrief] updateItemFulfillment error:", error)
        res.status(500).json({ success: false, message: "Failed to update fulfillment." })
    }
}

/**
 * PATCH /api/managed-service-brief/:contractId/items/:section/:itemId/review
 * Corporate reviews a partner-fulfilled item: APPROVED accepts the work,
 * REJECTED sends it back (item returns to IN_PROGRESS for rework).
 */
export const reviewItem = async (req, res) => {
    try {
        const access = await resolveBriefAccess(req, res)
        if (!access) return

        if (access.role !== "CORPORATE") {
            return res.status(403).json({
                success: false,
                message: "Only the corporate client can review fulfilled items.",
            })
        }

        const { section, itemId } = req.params
        const { decision, reviewNote } = req.body

        if (!["routeRequests", "employeeRoster"].includes(section)) {
            return res.status(400).json({ success: false, message: "Invalid brief section." })
        }
        if (!["APPROVED", "REJECTED"].includes(decision)) {
            return res.status(400).json({ success: false, message: "Decision must be APPROVED or REJECTED." })
        }

        const brief = await getOrCreateBrief(access.contract)
        const item = brief[section].id(itemId)
        if (!item) {
            return res.status(404).json({ success: false, message: "Brief item not found." })
        }
        if (item.fulfillment.status !== "FULFILLED") {
            return res.status(400).json({
                success: false,
                message: "Only fulfilled items can be reviewed.",
            })
        }

        const actor = await User.findById(req.userId).select("fullName companyName").lean()
        const actorName = actor?.companyName || actor?.fullName || "Corporate"

        item.fulfillment.approvalStatus = decision
        item.fulfillment.reviewedBy = req.userId
        item.fulfillment.reviewedByName = actorName
        item.fulfillment.reviewedAt = new Date()
        item.fulfillment.reviewNote = reviewNote || ""

        if (decision === "REJECTED") {
            // Send it back to the partner for rework.
            item.fulfillment.status = "IN_PROGRESS"
        }

        // Recompute overall completion (all FULFILLED + APPROVED => COMPLETED).
        const allItems = [...brief.routeRequests, ...brief.employeeRoster]
        const allApproved =
            allItems.length > 0 &&
            allItems.every(
                (i) =>
                    i.fulfillment.status === "FULFILLED" &&
                    i.fulfillment.approvalStatus === "APPROVED",
            )
        if (allApproved) {
            brief.status = "COMPLETED"
            brief.completedAt = new Date()
        } else if (brief.status === "COMPLETED") {
            brief.status = "IN_PROGRESS"
            brief.completedAt = null
        }

        await brief.save()

        await logManagedActivity(access.contract._id, {
            action: decision === "APPROVED" ? "SERVICE_BRIEF_ITEM_APPROVED" : "SERVICE_BRIEF_ITEM_REJECTED",
            description: `Corporate ${decision === "APPROVED" ? "approved" : "rejected"} a ${section === "routeRequests" ? "route request" : "roster"
                } item.`,
            entityType: "SERVICE_BRIEF",
            entityId: brief._id,
            performedBy: req.userId,
            performedByRole: "CORPORATE",
            performedByName: actorName,
            meta: { section, itemId, decision, reviewNote: reviewNote || "" },
        })

        const itemLabel =
            item.label || item.name || (section === "routeRequests" ? "route request" : "employee")
        await createNotification({
            userId: brief.b2bPartnerId,
            type: decision === "APPROVED" ? "MANAGED_ITEM_APPROVED" : "MANAGED_ITEM_REJECTED",
            title: decision === "APPROVED" ? "Work approved" : "Rework requested",
            message:
                decision === "APPROVED"
                    ? `${actorName} approved "${itemLabel}" on contract ${access.contract.contractNumber}.`
                    : `${actorName} requested changes to "${itemLabel}" on contract ${access.contract.contractNumber}.${reviewNote ? ` Note: ${reviewNote}` : ""}`,
            data: {
                contractId: access.contract._id.toString(),
                briefId: brief._id.toString(),
                section,
                itemId,
                decision,
            },
        })

        // When everything is approved, congratulate both parties.
        if (brief.status === "COMPLETED") {
            await createNotification({
                userId: brief.b2bPartnerId,
                type: "MANAGED_BRIEF_COMPLETED",
                title: "Managed operations complete",
                message: `All operations for contract ${access.contract.contractNumber} have been approved by the client.`,
                data: { contractId: access.contract._id.toString(), briefId: brief._id.toString() },
            })
            await createNotification({
                userId: brief.corporateOwnerId,
                type: "MANAGED_BRIEF_COMPLETED",
                title: "Managed operations complete",
                message: `All operations for contract ${access.contract.contractNumber} are now live and approved.`,
                data: { contractId: access.contract._id.toString(), briefId: brief._id.toString() },
            })
        }

        broadcastManagedBriefUpdate(
            {
                corporateOwnerId: brief.corporateOwnerId,
                b2bPartnerId: brief.b2bPartnerId,
                contractId: access.contract._id,
            },
            { event: `ITEM_${decision}`, actorRole: "CORPORATE" },
        )

        res.json({
            success: true,
            message: `Item ${decision.toLowerCase()}.`,
            data: { brief, metrics: computeBriefMetrics(brief) },
        })
    } catch (error) {
        console.error("[managedServiceBrief] reviewItem error:", error)
        res.status(500).json({ success: false, message: "Failed to review item." })
    }
}

/**
 * POST /api/managed-service-brief/:contractId/messages
 * Either party posts a clarification message on the brief.
 */
export const postMessage = async (req, res) => {
    try {
        const access = await resolveBriefAccess(req, res)
        if (!access) return

        const { message } = req.body
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: "Message cannot be empty." })
        }

        const brief = await getOrCreateBrief(access.contract)
        const actor = await User.findById(req.userId).select("fullName companyName").lean()
        const senderName = actor?.companyName || actor?.fullName || access.role

        brief.messages.push({
            senderId: req.userId,
            senderName,
            senderRole: access.role,
            message: message.trim(),
            createdAt: new Date(),
        })
        await brief.save()

        // Notify the *other* party about the new message.
        const recipientId =
            access.role === "CORPORATE" ? brief.b2bPartnerId : brief.corporateOwnerId
        await createNotification({
            userId: recipientId,
            type: "MANAGED_BRIEF_MESSAGE",
            title: "New message on managed brief",
            message: `${senderName}: ${message.trim().slice(0, 120)}`,
            data: {
                contractId: access.contract._id.toString(),
                briefId: brief._id.toString(),
            },
        })

        broadcastManagedBriefUpdate(
            {
                corporateOwnerId: brief.corporateOwnerId,
                b2bPartnerId: brief.b2bPartnerId,
                contractId: access.contract._id,
            },
            { event: "BRIEF_MESSAGE", actorRole: access.role },
        )

        res.json({ success: true, message: "Message posted.", data: { brief } })
    } catch (error) {
        console.error("[managedServiceBrief] postMessage error:", error)
        res.status(500).json({ success: false, message: "Failed to post message." })
    }
}

/* ============================================================================
 * QUOTATION-STAGE BRIEF
 * ----------------------------------------------------------------------------
 * The brief is authored by the corporate at QUOTATION-request time (before any
 * contract exists) so the B2B partner can read the real operational
 * requirements — work locations & shifts, route coverage, employee roster —
 * BEFORE it prices and returns a quote. Once a contract is created from the
 * quotation the same brief is stamped with `contractId` and drives the
 * contract-stage fulfilment/approval loop handled by the functions above.
 *
 * At quotation stage only read / edit / submit / message make sense: item
 * fulfilment & review only begin once real operations start on the contract.
 * ==========================================================================*/

// Resolve the quotation and validate the requester may touch its brief.
// - CORPORATE requester must own the quotation (corporateOwnerId).
// - B2B_PARTNER requester must be the quotation's fleetOwnerId.
// - Quotation must be MANAGED.
const resolveBriefAccessByQuotation = async (req, res) => {
    const { quotationId } = req.params

    if (!mongoose.Types.ObjectId.isValid(quotationId)) {
        res.status(400).json({ success: false, message: "Invalid quotation id." })
        return null
    }

    const quotation = await Quotation.findById(quotationId).select(
        "corporateOwnerId fleetOwnerId serviceMode quotationNumber status",
    )

    if (!quotation) {
        res.status(404).json({ success: false, message: "Quotation not found." })
        return null
    }

    if (quotation.serviceMode !== "MANAGED") {
        res.status(403).json({
            success: false,
            message: "Service briefs are only available for managed-service quotations.",
        })
        return null
    }

    // Family-aware normalisation (school users included).
    let role = null
    if (isCustomerRole(req.userRole) && quotation.corporateOwnerId.toString() === req.userId) {
        role = "CORPORATE"
    } else if (
        isPartnerRole(req.userRole) &&
        quotation.fleetOwnerId?.toString() === req.userId
    ) {
        role = "B2B_PARTNER"
    }

    if (!role) {
        res.status(403).json({
            success: false,
            message: "You do not have access to this quotation's service brief.",
        })
        return null
    }

    return { quotation, role }
}

// Find or lazily create the brief document for a quotation.
const getOrCreateBriefByQuotation = async (quotation) => {
    let brief = await ManagedServiceBrief.findOne({ quotationId: quotation._id })
    if (!brief) {
        brief = await ManagedServiceBrief.create({
            quotationId: quotation._id,
            corporateOwnerId: quotation.corporateOwnerId,
            b2bPartnerId: quotation.fleetOwnerId,
            status: "DRAFT",
        })
    }
    return brief
}

/**
 * GET /api/managed-service-brief/quotation/:quotationId
 * Both the corporate and the targeted partner can read the quotation-stage brief.
 */
export const getBriefByQuotation = async (req, res) => {
    try {
        const access = await resolveBriefAccessByQuotation(req, res)
        if (!access) return

        const brief = await getOrCreateBriefByQuotation(access.quotation)

        res.json({
            success: true,
            data: {
                brief,
                viewerRole: access.role,
                stage: "QUOTATION",
                quotationNumber: access.quotation.quotationNumber,
                quotationStatus: access.quotation.status,
                metrics: computeBriefMetrics(brief),
            },
        })
    } catch (error) {
        console.error("[managedServiceBrief] getBriefByQuotation error:", error)
        res.status(500).json({ success: false, message: "Failed to load service brief." })
    }
}

/**
 * PUT /api/managed-service-brief/quotation/:quotationId
 * Corporate edits the quotation-stage brief content. Partner cannot edit.
 */
export const updateBriefByQuotation = async (req, res) => {
    try {
        const access = await resolveBriefAccessByQuotation(req, res)
        if (!access) return

        if (access.role !== "CORPORATE") {
            return res.status(403).json({
                success: false,
                message: "Only the corporate client can edit the service brief.",
            })
        }

        const brief = await getOrCreateBriefByQuotation(access.quotation)

        if (brief.status === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "This brief is completed and can no longer be edited.",
            })
        }

        const {
            summary,
            comments,
            documents,
            serviceStartDate,
            pointOfContact,
            workLocations,
            routeRequests,
            employeeRoster,
            sla,
        } = req.body

        if (summary !== undefined) brief.summary = summary
        if (comments !== undefined) brief.comments = comments
        if (Array.isArray(documents)) brief.documents = sanitizeBriefDocuments(documents)
        if (serviceStartDate !== undefined) brief.serviceStartDate = serviceStartDate || null
        if (pointOfContact !== undefined) brief.pointOfContact = pointOfContact
        if (sla !== undefined && sla) {
            if (sla.targetCompletionDate !== undefined)
                brief.sla.targetCompletionDate = sla.targetCompletionDate || null
            if (sla.fulfillmentSlaHours !== undefined && Number(sla.fulfillmentSlaHours) > 0)
                brief.sla.fulfillmentSlaHours = Number(sla.fulfillmentSlaHours)
        }

        if (Array.isArray(workLocations)) brief.workLocations = workLocations
        if (Array.isArray(routeRequests)) {
            brief.routeRequests = mergeFulfillment(brief.routeRequests, routeRequests)
        }
        if (Array.isArray(employeeRoster)) {
            brief.employeeRoster = mergeFulfillment(brief.employeeRoster, employeeRoster)
        }

        await brief.save()

        res.json({ success: true, message: "Service brief saved.", data: { brief } })
    } catch (error) {
        console.error("[managedServiceBrief] updateBriefByQuotation error:", error)
        res.status(500).json({ success: false, message: "Failed to save service brief." })
    }
}

/**
 * POST /api/managed-service-brief/quotation/:quotationId/submit
 * Corporate submits the quotation-stage brief to the partner (-> SUBMITTED) so
 * the partner can factor it into their quote.
 */
export const submitBriefByQuotation = async (req, res) => {
    try {
        const access = await resolveBriefAccessByQuotation(req, res)
        if (!access) return

        if (access.role !== "CORPORATE") {
            return res.status(403).json({
                success: false,
                message: "Only the corporate client can submit the service brief.",
            })
        }

        const brief = await getOrCreateBriefByQuotation(access.quotation)

        if (brief.status === "COMPLETED") {
            return res.status(400).json({ success: false, message: "This brief is already completed." })
        }

        brief.status = "SUBMITTED"
        brief.submittedAt = new Date()
        await brief.save()

        const actor = await User.findById(req.userId).select("fullName companyName").lean()

        // Let the targeted partner know a brief is attached to the quote request.
        await createNotification({
            userId: brief.b2bPartnerId,
            type: "MANAGED_BRIEF_SUBMITTED",
            title: "Operations brief attached to a quotation",
            message: `${actor?.companyName || actor?.fullName || "A corporate client"} attached an operations brief to quotation ${access.quotation.quotationNumber}. Review the ${brief.routeRequests.length} route request(s) and ${brief.employeeRoster.length} employee(s) before you quote.`,
            data: {
                quotationId: access.quotation._id.toString(),
                briefId: brief._id.toString(),
                quotationNumber: access.quotation.quotationNumber,
            },
        })

        broadcastManagedBriefUpdate(
            {
                corporateOwnerId: brief.corporateOwnerId,
                b2bPartnerId: brief.b2bPartnerId,
                quotationId: access.quotation._id,
            },
            { event: "BRIEF_SUBMITTED", actorRole: "CORPORATE" },
        )

        res.json({ success: true, message: "Service brief submitted to partner.", data: { brief } })
    } catch (error) {
        console.error("[managedServiceBrief] submitBriefByQuotation error:", error)
        res.status(500).json({ success: false, message: "Failed to submit service brief." })
    }
}

/**
 * POST /api/managed-service-brief/quotation/:quotationId/messages
 * Either party posts a clarification message on the quotation-stage brief.
 */
export const postMessageByQuotation = async (req, res) => {
    try {
        const access = await resolveBriefAccessByQuotation(req, res)
        if (!access) return

        const { message } = req.body
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: "Message cannot be empty." })
        }

        const brief = await getOrCreateBriefByQuotation(access.quotation)
        const actor = await User.findById(req.userId).select("fullName companyName").lean()
        const senderName = actor?.companyName || actor?.fullName || access.role

        brief.messages.push({
            senderId: req.userId,
            senderName,
            senderRole: access.role,
            message: message.trim(),
            createdAt: new Date(),
        })
        await brief.save()

        const recipientId =
            access.role === "CORPORATE" ? brief.b2bPartnerId : brief.corporateOwnerId
        await createNotification({
            userId: recipientId,
            type: "MANAGED_BRIEF_MESSAGE",
            title: "New message on managed brief",
            message: `${senderName}: ${message.trim().slice(0, 120)}`,
            data: {
                quotationId: access.quotation._id.toString(),
                briefId: brief._id.toString(),
            },
        })

        broadcastManagedBriefUpdate(
            {
                corporateOwnerId: brief.corporateOwnerId,
                b2bPartnerId: brief.b2bPartnerId,
                quotationId: access.quotation._id,
            },
            { event: "BRIEF_MESSAGE", actorRole: access.role },
        )

        res.json({ success: true, message: "Message posted.", data: { brief } })
    } catch (error) {
        console.error("[managedServiceBrief] postMessageByQuotation error:", error)
        res.status(500).json({ success: false, message: "Failed to post message." })
    }
}

/* ==========================================================================
 * BRIEF -> OPERATIONS IMPORT
 * ==========================================================================
 * A managed-service brief is never a single route or a single employee. Both the
 * customer (CORPORATE / SCHOOL_CUSTOMER) and the operating partner (B2B_PARTNER /
 * SCHOOL_PARTNER) hold the SAME requirement document, so either side must be able
 * to turn it into real operational records without retyping every row.
 *
 * These endpoints power the "Import Routes" / "Import Employees" screens. They
 * only ever READ and normalize: nothing is created here. Creation happens through
 * the existing operational endpoints (assign-route / bulk-upload employees) so
 * duplicate detection, trip generation, activity logging and brief auto-fulfilment
 * all behave exactly as they do for a manually added record.
 * ========================================================================== */

/** Collapse a string to a comparison key (lowercase, alphanumerics only). */
const compareKey = (value) =>
    String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")

/** Identity of a route for duplicate detection: its label, else from->to. */
const routeIdentity = (route = {}) => {
    const label = compareKey(route.label)
    if (label) return label
    return `${compareKey(route.fromArea)}>${compareKey(route.toWorkLocation)}`
}

/**
 * Endpoint identity of a route: strictly its from->to (plus trip direction so a
 * genuine outbound and its reverse return leg stay distinct). Used as a SECOND
 * dedup key so a typed brief row and a document row for the same physical route
 * collapse into one even when their labels differ. Returns "" when endpoints are
 * unknown, so it never accidentally merges two unrelated label-only rows.
 */
const routeEndpointIdentity = (route = {}) => {
    const from = compareKey(route.fromArea)
    const to = compareKey(route.toWorkLocation)
    if (!from && !to) return ""
    return `${from}>${to}`
}

/** Identity of a person: email wins, else name + phone. */
const personIdentity = (person = {}) => {
    const email = compareKey(person.email)
    if (email) return `e:${email}`
    return `n:${compareKey(person.name)}:${compareKey(person.phone)}`
}

/** Shape a structured brief routeRequest sub-document as an import candidate. */
const routeCandidateFromBriefItem = (item) => ({
    // Structured items carry the brief sub-document id, which is what lets the
    // created route auto-fulfil the brief item on the corporate's dashboard.
    briefItemId: String(item._id),
    sourceKey: `brief:${item._id}`,
    source: "BRIEF",
    documentName: "",
    sourceRow: null,
    label: item.label || "",
    fromArea: item.fromArea || "",
    toWorkLocation: item.toWorkLocation || "",
    // Canonical trip-type fields (mirror the manual Assign Route form). A
    // structured brief item may only carry the legacy direction/window fields,
    // so derive the trip type when it isn't set explicitly.
    tripType:
        item.tripType ||
        (String(item.direction || "").toUpperCase() === "BOTH" &&
        (item.shiftLogoutTime || item.returnStartTime)
            ? "ROUND_TRIP"
            : "ONE_WAY"),
    pickupStartTime: item.pickupStartTime || item.pickupWindowStart || "",
    pickupEndTime: item.pickupEndTime || item.pickupWindowEnd || "",
    returnStartTime: item.returnStartTime || item.shiftLogoutTime || "",
    returnEndTime: item.returnEndTime || "",
    outboundStops: item.outboundStops || item.stops || [],
    returnStops: item.returnStops || [],
    direction: item.direction || "BOTH",
    shiftLoginTime: "",
    shiftLogoutTime: item.shiftLogoutTime || item.returnStartTime || "",
    pickupWindowStart: item.pickupWindowStart || item.pickupStartTime || "",
    pickupWindowEnd: item.pickupWindowEnd || item.pickupEndTime || "",
    numberOfTrips: 1,
    headcount: Number(item.headcount) || 0,
    preferredVehicleType: item.preferredVehicleType || "",
    operatingDays:
        item.operatingDays && item.operatingDays.length
            ? item.operatingDays
            : ["MON", "TUE", "WED", "THU", "FRI"],
    stops: item.outboundStops || item.stops || [],
    notes: item.notes || "",
    fulfillmentStatus: item.fulfillment?.status || "PENDING",
    alreadyFulfilled: item.fulfillment?.status === "FULFILLED",
})

/** Shape a structured brief roster sub-document as an import candidate. */
const employeeCandidateFromBriefItem = (item) => ({
    briefItemId: String(item._id),
    sourceKey: `brief:${item._id}`,
    source: "BRIEF",
    documentName: "",
    sourceRow: null,
    name: item.name || "",
    email: item.email || "",
    phone: item.phone || "",
    employeeCode: item.employeeCode || "",
    department: item.department || "",
    designation: item.designation || "",
    homeAddress: item.homeAddress || "",
    pickupArea: item.pickupArea || item.homeAddress || "",
    workLocation: item.workLocation || "",
    workLocationAddress: "",
    city: "",
    shiftLabel: item.shiftLabel || "",
    preferredRouteLabel: item.preferredRouteLabel || "",
    passMonths: Number(item.passMonths) > 0 ? Number(item.passMonths) : 1,
    // Per-passenger pass start date if the customer supplied one; otherwise
    // getImportCandidates falls back to the brief's service start date.
    passStartDate: item.passStartDate || "",
    notes: item.assignmentHint || "",
    fulfillmentStatus: item.fulfillment?.status || "PENDING",
    alreadyFulfilled: item.fulfillment?.status === "FULFILLED",
})

/**
 * GET /api/managed-service-brief/:contractId/import-candidates
 *
 * Returns every route and every person that could be created from the brief,
 * merged from TWO sources and de-duplicated against each other:
 *
 *   1. STRUCTURED brief items (brief.routeRequests / brief.employeeRoster) — the
 *      rows the customer typed into the portal. These carry a briefItemId, so
 *      importing them auto-fulfils the matching brief item.
 *   2. PARSED rows from the requirement document(s) the customer attached. This
 *      is the realistic path: the customer uploads the Excel they already have
 *      (dozens/hundreds of rows) and never retypes it into the portal.
 *
 * When a document row matches a structured item (same route label / same person)
 * the structured item wins, because only it can auto-fulfil the brief.
 *
 * Rows that already exist as real records (a route with the same from->to on this
 * contract, or an employee with the same email) are flagged `alreadyExists` so the
 * UI can pre-deselect them instead of creating duplicates.
 *
 * Available to BOTH the customer and the partner — they share the same document.
 */
export const getImportCandidates = async (req, res) => {
    try {
        const access = await resolveBriefAccess(req, res)
        if (!access) return

        const brief = await getOrCreateBrief(access.contract)

        // --- 1. Structured brief items -------------------------------------
        const routeCandidates = (brief.routeRequests || []).map(routeCandidateFromBriefItem)
        const employeeCandidates = (brief.employeeRoster || []).map(
            employeeCandidateFromBriefItem,
        )

        const seenRoutes = new Set(routeCandidates.map(routeIdentity))
        // Endpoint identity (from->to) catches the common case where the customer
        // TYPED a route into the portal and ALSO attached the same route in the
        // requirement document with a different label. Label-only dedup misses
        // those and the route ends up created twice (the "4 routes from 2" bug).
        const seenRouteEndpoints = new Set(
            routeCandidates.map(routeEndpointIdentity).filter(Boolean),
        )
        const seenPeople = new Set(employeeCandidates.map(personIdentity))

        // --- 2. Rows parsed out of the attached requirement document(s) -----
        // Never throws: unreadable/non-spreadsheet attachments come back as
        // warnings so one bad file can't break the whole import screen.
        const parsed = await parseBriefDocuments(brief.documents || [])

        for (const row of parsed.routes) {
            const identity = routeIdentity(row)
            const endpointIdentity = routeEndpointIdentity(row)
            // Skip the document row if either its label OR its from->to endpoints
            // already appear among the structured/earlier candidates.
            if (identity && seenRoutes.has(identity)) continue
            if (endpointIdentity && seenRouteEndpoints.has(endpointIdentity)) continue
            if (identity) seenRoutes.add(identity)
            if (endpointIdentity) seenRouteEndpoints.add(endpointIdentity)
            routeCandidates.push({
                ...row,
                briefItemId: null,
                fulfillmentStatus: "PENDING",
                alreadyFulfilled: false,
            })
        }

        for (const row of parsed.employees) {
            const identity = personIdentity(row)
            if (identity && seenPeople.has(identity)) continue
            if (identity) seenPeople.add(identity)
            employeeCandidates.push({
                ...row,
                briefItemId: null,
                fulfillmentStatus: "PENDING",
                alreadyFulfilled: false,
            })
        }

        // --- 3. Flag rows that already exist as real records ---------------
        const existingRoutes = await Route.find({ contractId: access.contract._id })
            .select("fromLocation toLocation")
            .lean()
        const existingRouteKeys = new Set(
            existingRoutes.map((r) => `${compareKey(r.fromLocation)}>${compareKey(r.toLocation)}`),
        )

        const candidateEmails = employeeCandidates
            .map((e) => String(e.email || "").trim().toLowerCase())
            .filter(Boolean)
        const existingEmails = new Set()
        if (candidateEmails.length > 0) {
            const existingEmployees = await CorporateEmployee.find({
                companyId: access.contract.corporateOwnerId,
                "personalInfo.email": { $in: candidateEmails },
            })
                .select("personalInfo.email")
                .lean()
            existingEmployees.forEach((e) => {
                if (e.personalInfo?.email) existingEmails.add(e.personalInfo.email.toLowerCase())
            })
        }

        const routes = routeCandidates.map((r) => ({
            ...r,
            alreadyExists:
                r.alreadyFulfilled ||
                existingRouteKeys.has(
                    `${compareKey(r.fromArea || r.label)}>${compareKey(r.toWorkLocation)}`,
                ),
        }))

        const employees = employeeCandidates.map((e) => ({
            ...e,
            // The pass should start on the contract's service start date recorded
            // in the brief, so an imported passenger's monthly pass (and the trips
            // generated at invitation time) begin on the same day a manually added
            // passenger's would when the customer picks that date by hand.
            passStartDate: e.passStartDate || brief.serviceStartDate || null,
            alreadyExists:
                e.alreadyFulfilled ||
                existingEmails.has(String(e.email || "").trim().toLowerCase()),
        }))

        res.json({
            success: true,
            data: {
                viewerRole: access.role,
                contractNumber: access.contract.contractNumber,
                briefStatus: brief.status,
                serviceStartDate: brief.serviceStartDate,
                routes,
                employees,
                documents: parsed.documents,
                warnings: parsed.warnings,
                counts: {
                    routesFromBrief: routes.filter((r) => r.source === "BRIEF").length,
                    routesFromDocuments: routes.filter((r) => r.source === "DOCUMENT").length,
                    employeesFromBrief: employees.filter((e) => e.source === "BRIEF").length,
                    employeesFromDocuments: employees.filter((e) => e.source === "DOCUMENT")
                        .length,
                },
            },
        })
    } catch (error) {
        console.error("[managedServiceBrief] getImportCandidates error:", error)
        res.status(500).json({
            success: false,
            message: "Failed to read the brief's importable routes and people.",
        })
    }
}

/**
 * GET /api/managed-service-brief/importable-contracts
 *
 * The customer's Employee Management screen is company-wide, not per contract, so
 * it has no contract id to import against. This lists every MANAGED contract the
 * caller is a party to that actually has a brief worth importing, so the UI can
 * ask "import from which contract?".
 *
 * Works for customers (they own the contract) and partners (they operate it).
 */
export const listImportableContracts = async (req, res) => {
    try {
        const isCustomer = isCustomerRole(req.userRole)
        const isPartner = isPartnerRole(req.userRole)

        if (!isCustomer && !isPartner) {
            return res.status(403).json({
                success: false,
                message: "Only managed-service customers and partners can import from a brief.",
            })
        }

        const contracts = await Contract.find({
            serviceMode: "MANAGED",
            ...(isCustomer ? { corporateOwnerId: req.userId } : { fleetOwnerId: req.userId }),
        })
            .select("contractNumber corporateOwnerId fleetOwnerId status createdAt")
            .populate("corporateOwnerId", "companyName fullName")
            .populate("fleetOwnerId", "companyName fullName")
            .sort({ createdAt: -1 })
            .lean()

        if (contracts.length === 0) {
            return res.json({ success: true, data: { contracts: [] } })
        }

        const briefs = await ManagedServiceBrief.find({
            contractId: { $in: contracts.map((c) => c._id) },
        })
            .select("contractId status routeRequests employeeRoster documents")
            .lean()

        const briefByContract = new Map(briefs.map((b) => [String(b.contractId), b]))

        const data = contracts
            .map((c) => {
                const brief = briefByContract.get(String(c._id))
                if (!brief) return null
                const routeCount = (brief.routeRequests || []).length
                const rosterCount = (brief.employeeRoster || []).length
                const documentCount = (brief.documents || []).length
                // Nothing to import from an empty brief with no attachments.
                if (routeCount === 0 && rosterCount === 0 && documentCount === 0) return null
                return {
                    contractId: String(c._id),
                    contractNumber: c.contractNumber,
                    status: c.status,
                    briefStatus: brief.status,
                    counterpartName: isCustomer
                        ? c.fleetOwnerId?.companyName || c.fleetOwnerId?.fullName || "Partner"
                        : c.corporateOwnerId?.companyName ||
                          c.corporateOwnerId?.fullName ||
                          "Customer",
                    routeCount,
                    rosterCount,
                    documentCount,
                }
            })
            .filter(Boolean)

        res.json({ success: true, data: { contracts: data } })
    } catch (error) {
        console.error("[managedServiceBrief] listImportableContracts error:", error)
        res.status(500).json({
            success: false,
            message: "Failed to list contracts you can import a brief from.",
        })
    }
}
