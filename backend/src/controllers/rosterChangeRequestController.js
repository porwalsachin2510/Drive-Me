import mongoose from "mongoose"
import RosterChangeRequest from "../models/RosterChangeRequest.js"
import ManagedServiceBrief from "../models/ManagedServiceBrief.js"
import Contract from "../models/Contract.js"
import User from "../models/User.js"
import { logManagedActivity } from "../utils/operationContext.js"
import { createNotification } from "../Services/notificationService.js"
import { broadcastManagedBriefUpdate } from "../Services/socketService.js"

/**
 * rosterChangeRequestController
 * -----------------------------
 * Continuous roster/route change-request workflow for MANAGED contracts.
 * Corporate raises requests; partner processes them; completion mutates the
 * live ManagedServiceBrief roster/routes. See RosterChangeRequest model header.
 */

const CHANGE_TYPES = RosterChangeRequest.CHANGE_TYPES
const EMPLOYEE_TYPES = ["ADD_EMPLOYEE", "REMOVE_EMPLOYEE", "MODIFY_EMPLOYEE"]
const ADD_TYPES = ["ADD_EMPLOYEE", "ADD_ROUTE"]
const TARGET_TYPES = ["REMOVE_EMPLOYEE", "MODIFY_EMPLOYEE", "REMOVE_ROUTE", "MODIFY_ROUTE"]

/**
 * Resolve the contract and validate the requester may touch its roster change
 * requests. Mirrors the brief's access model:
 *  - CORPORATE must own the contract (corporateOwnerId)
 *  - B2B_PARTNER must be the contract's fleet owner (fleetOwnerId)
 *  - Contract must be MANAGED
 * Returns { contract, role } or sends an error response and returns null.
 */
const resolveAccess = async (req, res) => {
    const { contractId } = req.params

    if (!mongoose.Types.ObjectId.isValid(contractId)) {
        res.status(400).json({ success: false, message: "Invalid contract id." })
        return null
    }

    const contract = await Contract.findById(contractId).select(
        "corporateOwnerId fleetOwnerId serviceMode contractNumber sla",
    )

    if (!contract) {
        res.status(404).json({ success: false, message: "Contract not found." })
        return null
    }

    if (contract.serviceMode !== "MANAGED") {
        res.status(403).json({
            success: false,
            message: "Roster change requests are only available for managed-service contracts.",
        })
        return null
    }

    let role = null
    if (req.userRole === "CORPORATE" && contract.corporateOwnerId.toString() === req.userId) {
        role = "CORPORATE"
    } else if (req.userRole === "B2B_PARTNER" && contract.fleetOwnerId.toString() === req.userId) {
        role = "B2B_PARTNER"
    }

    if (!role) {
        res.status(403).json({
            success: false,
            message: "You do not have access to this contract's roster changes.",
        })
        return null
    }

    return { contract, role }
}

const getActorName = async (userId) => {
    const actor = await User.findById(userId).select("fullName companyName").lean()
    return actor?.companyName || actor?.fullName || "User"
}

// Generate a per-contract sequential request number, e.g. "RCR-000004".
const nextRequestNumber = async (contractId) => {
    const count = await RosterChangeRequest.countDocuments({ contractId })
    return `RCR-${String(count + 1).padStart(6, "0")}`
}

// Compute live SLA/aging metrics over a set of requests for the dashboard header.
const computeSummary = (requests) => {
    const now = Date.now()
    const summary = {
        total: requests.length,
        open: 0,
        acknowledged: 0,
        inProgress: 0,
        completed: 0,
        rejected: 0,
        cancelled: 0,
        overdue: 0,
        active: 0, // OPEN + ACKNOWLEDGED + IN_PROGRESS
    }
    for (const r of requests) {
        if (r.status === "OPEN") summary.open++
        else if (r.status === "ACKNOWLEDGED") summary.acknowledged++
        else if (r.status === "IN_PROGRESS") summary.inProgress++
        else if (r.status === "COMPLETED") summary.completed++
        else if (r.status === "REJECTED") summary.rejected++
        else if (r.status === "CANCELLED") summary.cancelled++

        const isActive = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"].includes(r.status)
        if (isActive) {
            summary.active++
            const created = new Date(r.createdAt).getTime()
            const deadline = created + (r.completeSlaHours || 72) * 3600 * 1000
            if (now > deadline) summary.overdue++
        }
    }
    return summary
}

/**
 * Apply a COMPLETED change request onto the contract's ManagedServiceBrief so the
 * brief roster / routes reflect current reality. Idempotent via appliedToBrief.
 * Returns a short description of what was applied (or null if nothing).
 */
const applyChangeToBrief = async (request) => {
    if (request.appliedToBrief) return null

    const brief = await ManagedServiceBrief.findOne({ contractId: request.contractId })
    if (!brief) return null

    const section = EMPLOYEE_TYPES.includes(request.type) ? "employeeRoster" : "routeRequests"
    let applied = null

    if (request.type === "ADD_EMPLOYEE" || request.type === "ADD_ROUTE") {
        const item = { ...(request.payload || {}), fulfillment: { status: "PENDING" } }
        brief[section].push(item)
        applied = `Added ${section === "employeeRoster" ? "employee" : "route"} to the live roster.`
    } else if (request.type === "REMOVE_EMPLOYEE" || request.type === "REMOVE_ROUTE") {
        if (request.targetItemId) {
            const sub = brief[section].id(request.targetItemId)
            if (sub) {
                sub.deleteOne()
                applied = `Removed ${section === "employeeRoster" ? "employee" : "route"} from the live roster.`
            }
        }
    } else if (request.type === "MODIFY_EMPLOYEE" || request.type === "MODIFY_ROUTE") {
        if (request.targetItemId) {
            const sub = brief[section].id(request.targetItemId)
            if (sub) {
                const patch = request.payload || {}
                Object.keys(patch).forEach((k) => {
                    if (k === "fulfillment" || k === "_id") return
                    sub[k] = patch[k]
                })
                applied = `Updated ${section === "employeeRoster" ? "employee" : "route"} details on the live roster.`
            }
        }
    }

    if (applied) {
        await brief.save()
        request.appliedToBrief = true
        request.briefId = brief._id
    }
    return applied
}

const notifyCounterparty = async (request, toRole, { title, message }) => {
    const userId = toRole === "CORPORATE" ? request.corporateOwnerId : request.b2bPartnerId
    try {
        await createNotification({
            userId,
            type: "MANAGED_ROSTER_CHANGE",
            title,
            message,
            data: {
                contractId: request.contractId.toString(),
                requestId: request._id.toString(),
                requestNumber: request.requestNumber,
                changeType: request.type,
                status: request.status,
            },
        })
    } catch (err) {
        console.error("[rosterChange] notify error:", err.message)
    }
}

const broadcast = (request, contract, actorRole, event) => {
    broadcastManagedBriefUpdate(
        {
            corporateOwnerId: request.corporateOwnerId,
            b2bPartnerId: request.b2bPartnerId,
            contractId: contract._id,
        },
        { event, actorRole },
    )
}

const logActivity = async (contract, request, { action, description, role, name }) => {
    try {
        await logManagedActivity(contract._id, {
            action,
            description,
            entityType: "ROSTER_CHANGE_REQUEST",
            entityId: request._id,
            performedBy: request.raisedBy,
            performedByRole: role,
            performedByName: name,
            meta: {
                requestNumber: request.requestNumber,
                changeType: request.type,
                status: request.status,
            },
        })
    } catch (err) {
        console.error("[rosterChange] logActivity error:", err.message)
    }
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                          */
/* ------------------------------------------------------------------ */

// GET /api/roster-change/:contractId?status=&type=
export const listRequests = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return

        const filter = { contractId: access.contract._id }
        if (req.query.status && RosterChangeRequest.STATUSES.includes(req.query.status)) {
            filter.status = req.query.status
        }
        if (req.query.type && CHANGE_TYPES.includes(req.query.type)) {
            filter.type = req.query.type
        }

        const requests = await RosterChangeRequest.find(filter)
            .sort({ createdAt: -1 })
            .lean()

        // Summary is always over ALL requests for the contract, not the filtered
        // view, so the header counts stay stable while filtering.
        const allForSummary = filter.status || filter.type
            ? await RosterChangeRequest.find({ contractId: access.contract._id })
                .select("status completeSlaHours createdAt")
                .lean()
            : requests

        res.json({
            success: true,
            data: {
                requests,
                summary: computeSummary(allForSummary),
                viewerRole: access.role,
                contractNumber: access.contract.contractNumber,
            },
        })
    } catch (error) {
        console.error("[rosterChange] listRequests error:", error)
        res.status(500).json({ success: false, message: "Failed to load roster change requests." })
    }
}

// POST /api/roster-change/:contractId  (CORPORATE raises a change)
export const createRequest = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return

        if (access.role !== "CORPORATE") {
            return res.status(403).json({
                success: false,
                message: "Only the corporate client can raise roster change requests.",
            })
        }

        const { type, priority, reason, requestedEffectiveDate, targetItemId, payload } = req.body

        if (!CHANGE_TYPES.includes(type)) {
            return res.status(400).json({ success: false, message: "Invalid change type." })
        }

        const isEmployee = EMPLOYEE_TYPES.includes(type)
        const section = isEmployee ? "employeeRoster" : "routeRequests"

        // Validate payload / target depending on the change type.
        if (ADD_TYPES.includes(type)) {
            if (!payload || typeof payload !== "object") {
                return res.status(400).json({ success: false, message: "Change details are required." })
            }
            if (isEmployee && !String(payload.name || "").trim()) {
                return res.status(400).json({ success: false, message: "Employee name is required." })
            }
            if (!isEmployee && !String(payload.label || "").trim()) {
                return res.status(400).json({ success: false, message: "Route label is required." })
            }
        }

        let targetItemLabel = ""
        if (TARGET_TYPES.includes(type)) {
            if (!targetItemId || !mongoose.Types.ObjectId.isValid(targetItemId)) {
                return res.status(400).json({
                    success: false,
                    message: "Select which roster item this change targets.",
                })
            }
            // Snapshot the target label from the current brief for the audit trail.
            const brief = await ManagedServiceBrief.findOne({ contractId: access.contract._id })
            const sub = brief?.[section]?.id(targetItemId)
            if (!sub) {
                return res.status(404).json({
                    success: false,
                    message: "The targeted roster item no longer exists.",
                })
            }
            targetItemLabel = sub.name || sub.label || ""
        }

        const actorName = await getActorName(req.userId)
        const slaComplete = access.contract?.sla?.complaintResolutionHours || 72

        const request = await RosterChangeRequest.create({
            contractId: access.contract._id,
            corporateOwnerId: access.contract.corporateOwnerId,
            b2bPartnerId: access.contract.fleetOwnerId,
            requestNumber: await nextRequestNumber(access.contract._id),
            type,
            status: "OPEN",
            priority: ["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority) ? priority : "NORMAL",
            reason: reason || "",
            requestedEffectiveDate: requestedEffectiveDate || null,
            targetSection: TARGET_TYPES.includes(type) ? section : null,
            targetItemId: TARGET_TYPES.includes(type) ? targetItemId : null,
            targetItemLabel,
            payload: ADD_TYPES.includes(type) || type.startsWith("MODIFY") ? payload || {} : {},
            raisedBy: req.userId,
            raisedByName: actorName,
            raisedByRole: "CORPORATE",
            completeSlaHours: slaComplete,
            timeline: [
                {
                    action: "CREATED",
                    status: "OPEN",
                    byId: req.userId,
                    byName: actorName,
                    byRole: "CORPORATE",
                    note: reason || "",
                    at: new Date(),
                },
            ],
        })

        await logActivity(access.contract, request, {
            action: "ROSTER_CHANGE_RAISED",
            description: `Corporate raised roster change ${request.requestNumber} (${type}).`,
            role: "CORPORATE",
            name: actorName,
        })
        await notifyCounterparty(request, "B2B_PARTNER", {
            title: "New roster change request",
            message: `${actorName} raised ${request.requestNumber} (${labelForType(type)}) on contract ${access.contract.contractNumber}.`,
        })
        broadcast(request, access.contract, "CORPORATE", "ROSTER_CHANGE_CREATED")

        res.status(201).json({ success: true, message: "Change request submitted.", data: { request } })
    } catch (error) {
        console.error("[rosterChange] createRequest error:", error)
        res.status(500).json({ success: false, message: "Failed to create change request." })
    }
}

const labelForType = (type) =>
    ({
        ADD_EMPLOYEE: "Add employee",
        REMOVE_EMPLOYEE: "Remove employee",
        MODIFY_EMPLOYEE: "Modify employee",
        ADD_ROUTE: "Add route",
        MODIFY_ROUTE: "Modify route",
        REMOVE_ROUTE: "Remove route",
    })[type] || type

/**
 * PATCH /api/roster-change/:contractId/:requestId/status
 * Drives the partner-side pipeline (ACKNOWLEDGED / IN_PROGRESS / COMPLETED /
 * REJECTED) and the corporate-side CANCELLED. Enforces legal transitions and
 * role permissions, records the timeline entry, applies completed changes to the
 * brief, notifies the counterparty and broadcasts the live update.
 */
export const updateStatus = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return

        const { requestId } = req.params
        const { status: nextStatus, note } = req.body

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }
        if (!RosterChangeRequest.STATUSES.includes(nextStatus)) {
            return res.status(400).json({ success: false, message: "Invalid status." })
        }

        const request = await RosterChangeRequest.findOne({
            _id: requestId,
            contractId: access.contract._id,
        })
        if (!request) {
            return res.status(404).json({ success: false, message: "Change request not found." })
        }

        // Permission + transition matrix.
        const partnerTransitions = {
            OPEN: ["ACKNOWLEDGED", "IN_PROGRESS", "REJECTED"],
            ACKNOWLEDGED: ["IN_PROGRESS", "REJECTED"],
            IN_PROGRESS: ["COMPLETED", "REJECTED"],
        }
        const corporateTransitions = {
            OPEN: ["CANCELLED"],
            ACKNOWLEDGED: ["CANCELLED"],
        }

        const allowed =
            access.role === "B2B_PARTNER"
                ? partnerTransitions[request.status] || []
                : corporateTransitions[request.status] || []

        if (!allowed.includes(nextStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot move a ${request.status} request to ${nextStatus}.`,
            })
        }

        if (nextStatus === "REJECTED" && !String(note || "").trim()) {
            return res.status(400).json({
                success: false,
                message: "A reason is required when rejecting a request.",
            })
        }

        const actorName = await getActorName(req.userId)
        const now = new Date()

        request.status = nextStatus
        if (nextStatus === "ACKNOWLEDGED") request.acknowledgedAt = now
        else if (nextStatus === "IN_PROGRESS") {
            request.startedAt = request.startedAt || now
            if (!request.acknowledgedAt) request.acknowledgedAt = now
        } else if (nextStatus === "COMPLETED") {
            request.completedAt = now
            request.resolutionNote = note || request.resolutionNote || ""
        } else if (nextStatus === "REJECTED") {
            request.rejectedAt = now
            request.resolutionNote = note || ""
        } else if (nextStatus === "CANCELLED") {
            request.cancelledAt = now
        }

        // On completion, mutate the live brief roster/routes with real DB write.
        let appliedNote = null
        if (nextStatus === "COMPLETED") {
            appliedNote = await applyChangeToBrief(request)
        }

        request.timeline.push({
            action: nextStatus,
            status: nextStatus,
            byId: req.userId,
            byName: actorName,
            byRole: access.role,
            note: appliedNote ? `${note ? note + " — " : ""}${appliedNote}` : note || "",
            at: now,
        })

        await request.save()

        await logActivity(access.contract, request, {
            action: `ROSTER_CHANGE_${nextStatus}`,
            description: `${access.role === "CORPORATE" ? "Corporate" : "Partner"} set ${request.requestNumber} to ${nextStatus}.`,
            role: access.role,
            name: actorName,
        })

        // Notify the other party.
        const toRole = access.role === "CORPORATE" ? "B2B_PARTNER" : "CORPORATE"
        await notifyCounterparty(request, toRole, {
            title: `Roster change ${nextStatus.toLowerCase()}`,
            message: `${request.requestNumber} (${labelForType(request.type)}) was ${nextStatus.toLowerCase()} by ${actorName}.`,
        })
        broadcast(request, access.contract, access.role, `ROSTER_CHANGE_${nextStatus}`)

        res.json({
            success: true,
            message: `Request ${nextStatus.toLowerCase()}.`,
            data: { request },
        })
    } catch (error) {
        console.error("[rosterChange] updateStatus error:", error)
        res.status(500).json({ success: false, message: "Failed to update change request." })
    }
}

// POST /api/roster-change/:contractId/:requestId/comment  (either party)
export const addComment = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return

        const { requestId } = req.params
        const { note } = req.body

        if (!String(note || "").trim()) {
            return res.status(400).json({ success: false, message: "Message cannot be empty." })
        }
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }

        const request = await RosterChangeRequest.findOne({
            _id: requestId,
            contractId: access.contract._id,
        })
        if (!request) {
            return res.status(404).json({ success: false, message: "Change request not found." })
        }

        const actorName = await getActorName(req.userId)
        request.timeline.push({
            action: "COMMENT",
            byId: req.userId,
            byName: actorName,
            byRole: access.role,
            note: note.trim(),
            at: new Date(),
        })
        await request.save()

        const toRole = access.role === "CORPORATE" ? "B2B_PARTNER" : "CORPORATE"
        await notifyCounterparty(request, toRole, {
            title: "New message on roster change",
            message: `${actorName} commented on ${request.requestNumber}.`,
        })
        broadcast(request, access.contract, access.role, "ROSTER_CHANGE_COMMENT")

        res.json({ success: true, message: "Comment added.", data: { request } })
    } catch (error) {
        console.error("[rosterChange] addComment error:", error)
        res.status(500).json({ success: false, message: "Failed to add comment." })
    }
}

// GET /api/roster-change/:contractId/targets  (roster/route items for target pickers)
export const getTargets = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return

        const brief = await ManagedServiceBrief.findOne({ contractId: access.contract._id })
            .select("employeeRoster routeRequests")
            .lean()

        const employees = (brief?.employeeRoster || []).map((e) => ({
            _id: e._id,
            name: e.name,
            employeeCode: e.employeeCode,
            department: e.department,
            workLocation: e.workLocation,
            shiftLabel: e.shiftLabel,
        }))
        const routes = (brief?.routeRequests || []).map((r) => ({
            _id: r._id,
            label: r.label,
            fromArea: r.fromArea,
            toWorkLocation: r.toWorkLocation,
        }))

        res.json({ success: true, data: { employees, routes } })
    } catch (error) {
        console.error("[rosterChange] getTargets error:", error)
        res.status(500).json({ success: false, message: "Failed to load roster targets." })
    }
}
