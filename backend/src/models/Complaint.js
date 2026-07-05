import mongoose from "mongoose"

/**
 * Complaint
 * ---------
 * Operational complaints raised against a MANAGED-service contract. Real-world
 * managed-transport platforms track complaint volume and, crucially, how fast
 * the operator resolves them (complaint resolution time is a core SLA metric).
 *
 * A complaint can be raised by the corporate client, one of its employees, or
 * logged by the B2B partner. The partner (operator) is responsible for
 * resolving it. On resolution we snapshot how many hours it took and whether
 * that breached the contract's complaint-resolution SLA, so SLA dashboards and
 * penalty calculations have durable, per-complaint data to work with.
 */
const complaintSchema = new mongoose.Schema(
    {
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
            index: true,
        },
        contractNumber: String,
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        fleetOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // Who raised it
        raisedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        raisedByName: String,
        raisedByRole: {
            type: String,
            enum: ["CORPORATE", "CORPORATE_EMPLOYEE", "B2B_PARTNER"],
            default: "CORPORATE",
        },

        // Optional link to the trip the complaint is about
        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
            default: null,
        },

        category: {
            type: String,
            enum: [
                "LATE_PICKUP",
                "NO_SHOW_VEHICLE",
                "DRIVER_BEHAVIOR",
                "VEHICLE_CONDITION",
                "ROUTE_ISSUE",
                "OVERCROWDING",
                "SAFETY",
                "BILLING",
                "OTHER",
            ],
            default: "OTHER",
        },
        severity: {
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            default: "MEDIUM",
        },
        subject: { type: String, required: true },
        description: { type: String, default: "" },

        status: {
            type: String,
            enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
            default: "OPEN",
            index: true,
        },

        // Resolution tracking (SLA)
        firstResponseAt: { type: Date, default: null },
        resolvedAt: { type: Date, default: null },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        resolvedByName: { type: String, default: null },
        resolutionNote: { type: String, default: "" },
        // Hours elapsed between creation and resolution (snapshot at resolve).
        resolutionHours: { type: Number, default: null },
        // Whether resolution exceeded the contract's complaintResolutionHours SLA.
        breachedSla: { type: Boolean, default: false },

        // Threaded updates / partner responses
        updates: [
            {
                message: String,
                byId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                byName: String,
                byRole: { type: String, enum: ["CORPORATE", "CORPORATE_EMPLOYEE", "B2B_PARTNER"] },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
)

complaintSchema.index({ contractId: 1, status: 1 })
complaintSchema.index({ contractId: 1, createdAt: -1 })

const Complaint = mongoose.models.Complaint || mongoose.model("Complaint", complaintSchema)

export default Complaint
