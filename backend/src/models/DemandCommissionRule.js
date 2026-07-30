import mongoose from "mongoose"

/**
 * DemandCommissionRule
 * --------------------
 * Configurable business rules that drive automatic commission
 * calculation. When a lead is onboarded (or on monthly/campaign events)
 * the matching active rules generate DemandCommission records for the
 * responsible employee.
 */

export const COMMISSION_TRIGGERS = [
    "CUSTOMER_ONBOARDED",
    "B2B_PARTNER_ONBOARDED",
    "B2C_PARTNER_ONBOARDED",
    "CORPORATE_ONBOARDED",
    "CAMPAIGN_INCENTIVE",
    "MONTHLY_PERFORMANCE",
]

const demandCommissionRuleSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: "" },
        trigger: {
            type: String,
            enum: COMMISSION_TRIGGERS,
            required: true,
            index: true,
        },
        // FIXED -> flat `amount`; PERCENTAGE -> `percentage` of lead estimatedValue
        calcType: {
            type: String,
            enum: ["FIXED", "PERCENTAGE"],
            default: "FIXED",
        },
        amount: { type: Number, default: 0, min: 0 },
        percentage: { type: Number, default: 0, min: 0, max: 100 },

        // Optional monthly performance thresholds (for MONTHLY_PERFORMANCE)
        minOnboardings: { type: Number, default: 0, min: 0 },

        active: { type: Boolean, default: true, index: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
)

export default mongoose.model("DemandCommissionRule", demandCommissionRuleSchema)