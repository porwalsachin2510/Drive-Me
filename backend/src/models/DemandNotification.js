import mongoose from "mongoose"

/**
 * DemandNotification
 * ------------------
 * In-app notifications for the Demand Generation Staff Portal. These are
 * scoped to a `DemandEmployee` (field rep / finance officer) — NOT to the
 * auth `User` collection — so they are kept separate from the main
 * `Notification` model used by customers, partners and drivers.
 *
 * Primary use: alert a field rep (e.g. Rahul) the instant a lead is
 * auto-assigned to them by the lead-capture pipeline, without them having to
 * manually refresh their lead list.
 */

const demandNotificationSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DemandEmployee",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: [
                "LEAD_ASSIGNED",
                "LEAD_CAPTURED",
                "FOLLOW_UP_DUE",
                "COMMISSION_EARNED",
                "GENERAL",
            ],
            default: "GENERAL",
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
        campaign: { type: mongoose.Schema.Types.ObjectId, ref: "DemandCampaign", default: null },
        data: { type: mongoose.Schema.Types.Mixed, default: {} },
        isRead: { type: Boolean, default: false, index: true },
        readAt: { type: Date, default: null },
    },
    { timestamps: true }
)

demandNotificationSchema.index({ employee: 1, isRead: 1, createdAt: -1 })

export default mongoose.model("DemandNotification", demandNotificationSchema)
