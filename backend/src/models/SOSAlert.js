import mongoose from "mongoose";

// SOS / safety alert raised by an employee (or driver) during a managed trip.
// This is the "panic button" surface that real employee-transport platforms
// (MoveInSync, Routematic, Swvl Business) ship as standard. An alert fans out in
// real time to the corporate owner, the managing B2B partner, and admins, and
// snapshots the employee's registered emergency contacts for follow-up.
const sosTimelineSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            enum: ["RAISED", "ACKNOWLEDGED", "RESPONDER_ASSIGNED", "RESOLVED", "CANCELLED", "NOTE"],
            required: true,
        },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        byName: String,
        byRole: String,
        note: String,
        at: { type: Date, default: Date.now },
    },
    { _id: false },
);

const sosAlertSchema = new mongoose.Schema(
    {
        // Human-friendly sequential identifier e.g. SOS-000001
        alertNumber: {
            type: String,
            unique: true,
            index: true,
        },

        // Who raised it
        raisedByUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        raisedByRole: String,
        raisedByName: String,
        raisedByPhone: String,
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CorporateEmployee",
        },

        // Context
        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
        },
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // corporate owner
        },
        b2bPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        emergencyType: {
            type: String,
            enum: ["SOS", "SAFETY", "MEDICAL", "ACCIDENT", "HARASSMENT", "VEHICLE_BREAKDOWN", "OTHER"],
            default: "SOS",
        },
        message: String,

        location: {
            lat: Number,
            lng: Number,
            address: String,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED", "CANCELLED"],
            default: "ACTIVE",
            index: true,
        },

        acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        acknowledgedByName: String,
        acknowledgedAt: Date,
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        resolvedByName: String,
        resolvedAt: Date,
        resolutionNotes: String,

        // Snapshot of the employee's registered emergency contacts at alert time
        notifiedContacts: [
            {
                name: String,
                relationship: String,
                phoneNumber: String,
            },
        ],

        timeline: [sosTimelineSchema],
    },
    { timestamps: true },
);

sosAlertSchema.index({ companyId: 1, status: 1 });
sosAlertSchema.index({ b2bPartnerId: 1, status: 1 });
sosAlertSchema.index({ contractId: 1, createdAt: -1 });
sosAlertSchema.index({ raisedByUserId: 1, createdAt: -1 });

// Generate a sequential alert number before saving new documents.
sosAlertSchema.pre("save", async function (next) {
    if (this.isNew && !this.alertNumber) {
        try {
            const last = await this.constructor
                .findOne({})
                .sort({ createdAt: -1 })
                .select("alertNumber")
                .lean();
            let nextNum = 1;
            if (last?.alertNumber) {
                const parsed = parseInt(last.alertNumber.replace("SOS-", ""), 10);
                if (!Number.isNaN(parsed)) nextNum = parsed + 1;
            }
            this.alertNumber = `SOS-${String(nextNum).padStart(6, "0")}`;
        } catch (err) {
            this.alertNumber = `SOS-${Date.now()}`;
        }
    }
    next();
});

const SOSAlert = mongoose.model("SOSAlert", sosAlertSchema);

export default SOSAlert;
