import mongoose from "mongoose"

/**
 * DemandCommission
 * ----------------
 * A commission earned by a demand-generation employee. Generated
 * automatically from DemandCommissionRule triggers (e.g. an onboarding)
 * or added manually by an admin. Feeds employee earnings and the
 * financial dashboard.
 */

const demandCommissionSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DemandEmployee",
            required: true,
            index: true,
        },
        rule: { type: mongoose.Schema.Types.ObjectId, ref: "DemandCommissionRule", default: null },
        lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
        campaign: { type: mongoose.Schema.Types.ObjectId, ref: "DemandCampaign", default: null },

        trigger: { type: String, default: "" },
        calcType: { type: String, enum: ["FIXED", "PERCENTAGE"], default: "FIXED" },
        amount: { type: Number, required: true, min: 0 },

        // YYYY-MM the commission is attributed to (for monthly aggregation)
        month: { type: String, index: true },

        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "PAID"],
            default: "PENDING",
            index: true,
        },
        note: { type: String, trim: true, default: "" },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        // When a Finance-portal officer (a DemandEmployee) approves/pays, we record
        // them here since approvedBy references the admin User collection.
        handledByEmployee: { type: mongoose.Schema.Types.ObjectId, ref: "DemandEmployee", default: null },
        paidAt: { type: Date, default: null },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
)

demandCommissionSchema.index({ createdAt: -1 })
demandCommissionSchema.index({ employee: 1, month: 1 })

export default mongoose.model("DemandCommission", demandCommissionSchema)
