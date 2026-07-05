import mongoose from "mongoose"

/**
 * RosterChangeRequest
 * -------------------
 * The continuous "change request" flow for MANAGED-service contracts.
 *
 * A ManagedServiceBrief captures the INITIAL operational spec (work locations,
 * routes, employee roster). But in the real world employees join and leave every
 * day, addresses change, and routes need tweaking. Editing the static brief does
 * not give either side an auditable, SLA-tracked workflow.
 *
 * This model is that workflow: the CORPORATE raises a structured change request
 * (add / remove / modify an employee, or add / modify / remove a route). The
 * B2B_PARTNER then processes it through a status pipeline
 * (OPEN -> ACKNOWLEDGED -> IN_PROGRESS -> COMPLETED / REJECTED), and on
 * completion the change is applied to the brief's live roster / route list so the
 * brief always reflects the current operational reality.
 *
 * Every state transition is recorded on `timeline` for a full audit trail, and
 * SLA timers (acknowledge / complete) let the SLA dashboard measure partner
 * responsiveness on ongoing changes, not just the initial setup.
 */

const CHANGE_TYPES = [
    "ADD_EMPLOYEE",
    "REMOVE_EMPLOYEE",
    "MODIFY_EMPLOYEE",
    "ADD_ROUTE",
    "MODIFY_ROUTE",
    "REMOVE_ROUTE",
]

const STATUSES = [
    "OPEN", // raised by corporate, partner not yet acknowledged
    "ACKNOWLEDGED", // partner has seen it and accepted it into their queue
    "IN_PROGRESS", // partner is actively working on it
    "COMPLETED", // partner finished; change applied to the brief
    "REJECTED", // partner cannot / will not do it (with reason)
    "CANCELLED", // corporate withdrew the request
]

const timelineEntrySchema = new mongoose.Schema(
    {
        action: { type: String, required: true }, // e.g. "CREATED", "ACKNOWLEDGED", "COMMENT"
        status: { type: String, enum: STATUSES, default: null },
        byId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        byName: { type: String, default: "" },
        byRole: { type: String, enum: ["CORPORATE", "B2B_PARTNER"], default: null },
        note: { type: String, default: "" },
        at: { type: Date, default: Date.now },
    },
    { _id: true },
)

const rosterChangeRequestSchema = new mongoose.Schema(
    {
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
            index: true,
        },
        briefId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ManagedServiceBrief",
            default: null,
        },
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        b2bPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // Human-friendly per-contract sequential reference (e.g. "RCR-000004").
        requestNumber: { type: String, required: true },

        type: { type: String, enum: CHANGE_TYPES, required: true },
        status: { type: String, enum: STATUSES, default: "OPEN", index: true },
        priority: {
            type: String,
            enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
            default: "NORMAL",
        },

        // Free-text business reason for the change (corporate-supplied).
        reason: { type: String, default: "" },
        // When the corporate wants the change to take effect operationally.
        requestedEffectiveDate: { type: Date, default: null },

        // For MODIFY_* / REMOVE_* — which brief sub-document this targets.
        targetSection: {
            type: String,
            enum: ["employeeRoster", "routeRequests", null],
            default: null,
        },
        targetItemId: { type: mongoose.Schema.Types.ObjectId, default: null },
        // Snapshot of the target's label/name at request time (audit friendly).
        targetItemLabel: { type: String, default: "" },

        // The change data:
        //  - ADD_EMPLOYEE / MODIFY_EMPLOYEE -> a roster employee shape
        //  - ADD_ROUTE / MODIFY_ROUTE       -> a route request shape
        //  - REMOVE_*                        -> not required
        payload: { type: mongoose.Schema.Types.Mixed, default: {} },

        raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        raisedByName: { type: String, default: "" },
        raisedByRole: { type: String, enum: ["CORPORATE", "B2B_PARTNER"], default: "CORPORATE" },

        // SLA windows (hours) for this change, snapshotted from the contract SLA
        // (or defaults) so historical requests keep the terms they were raised under.
        acknowledgeSlaHours: { type: Number, default: 24 },
        completeSlaHours: { type: Number, default: 72 },

        acknowledgedAt: { type: Date, default: null },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        rejectedAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
        resolutionNote: { type: String, default: "" },

        // Whether the completed change was actually written onto the brief roster
        // / route list. Guards against double-application.
        appliedToBrief: { type: Boolean, default: false },

        timeline: [timelineEntrySchema],
    },
    { timestamps: true },
)

rosterChangeRequestSchema.index({ contractId: 1, status: 1 })
rosterChangeRequestSchema.index({ contractId: 1, createdAt: -1 })

rosterChangeRequestSchema.statics.CHANGE_TYPES = CHANGE_TYPES
rosterChangeRequestSchema.statics.STATUSES = STATUSES

const RosterChangeRequest =
    mongoose.models.RosterChangeRequest ||
    mongoose.model("RosterChangeRequest", rosterChangeRequestSchema)

export default RosterChangeRequest
