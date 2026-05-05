import mongoose from "mongoose"

const commissionSettingsSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        role: {
            type: String,
            enum: ["CORPORATE", "B2B_PARTNER", "B2C_PARTNER"],
            required: true,
        },
        // Default commission rate for this user (0-100%)
        // B2B Partner: Contract Commission (on contract payments)
        // B2C Partner: Booking Commission (on commuter bookings)
        defaultCommissionRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 20,
        },
        // Custom rates for specific transaction types
        customRates: [
            {
                rateType: {
                    type: String,
                    enum: ["CONTRACT", "BOOKING", "MONTHLY_PASS", "NEGOTIATION", "EMI"],
                    required: true,
                },
                rate: {
                    type: Number,
                    min: 0,
                    max: 100,
                    required: true,
                },
                description: String,
                effectiveFrom: {
                    type: Date,
                    default: Date.now,
                },
                effectiveUntil: Date,
            },
        ],
        // Commission rate when admin negotiates for Corporate user (0-100%)
        // Corporate: Negotiation Commission (on savings achieved through negotiation)
        negotiationCommissionRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 25, // Default 25% of savings
        },
        // EMI Payment Commission Settings
        emiCommissionSettings: {
            // Commission rate on each EMI payment
            emiCommissionRate: {
                type: Number,
                min: 0,
                max: 100, // Allow up to 100% for custom EMI rates
                default: 20, // Default 20%
            },
            // Commission rate on late fee collected
            lateFeeCommissionRate: {
                type: Number,
                min: 0,
                max: 100,
                default: 0, // No commission on late fees by default
            },
            // Late fee percentage charged to corporate
            lateFeePercentage: {
                type: Number,
                min: 0,
                max: 50,
                default: 2, // 2% late fee
            },
            // Grace period in days before late fee applies
            gracePeriodDays: {
                type: Number,
                min: 0,
                max: 30,
                default: 0, // No grace period by default
            },
            // Number of overdue installments before service suspension warning
            overdueWarningThreshold: {
                type: Number,
                min: 1,
                max: 12,
                default: 2,
            },
            // Number of overdue installments before service suspension
            suspensionThreshold: {
                type: Number,
                min: 1,
                max: 12,
                default: 3,
            },
        },
        // Track who set these rates
        setBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        // History of rate changes
        rateHistory: [
            {
                previousRate: Number,
                newRate: Number,
                rateType: String, // 'default' or specific type
                changedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                changedAt: {
                    type: Date,
                    default: Date.now,
                },
                reason: String,
            },
        ],
        // Terms acceptance tracking
        termsAcceptedAt: Date,
        termsVersion: String,
        // Whether commission is currently active for this user
        isActive: {
            type: Boolean,
            default: true,
        },
        notes: String,
    },
    {
        timestamps: true,
    }
)

// Ensure unique settings per user
commissionSettingsSchema.index({ userId: 1 }, { unique: true })

// Static method to get commission rate for a user
commissionSettingsSchema.statics.getCommissionRate = async function (userId, rateType = null) {
    const settings = await this.findOne({ userId, isActive: true })

    if (!settings) {
        return 20 // Default fallback to 20%
    }

    // Check for custom rate for specific type FIRST (highest priority)
    if (rateType && settings.customRates?.length > 0) {
        const now = new Date()
        const customRate = settings.customRates.find(
            (r) =>
                r.rateType === rateType &&
                new Date(r.effectiveFrom) <= now &&
                (!r.effectiveUntil || new Date(r.effectiveUntil) >= now)
        )
        if (customRate) {
            return customRate.rate
        }
    }

    // For EMI type, check emiCommissionSettings as fallback
    if (rateType === "EMI" && settings.emiCommissionSettings?.emiCommissionRate) {
        return settings.emiCommissionSettings.emiCommissionRate
    }
    
    return settings.defaultCommissionRate
}

// Static method to calculate commission for a user
commissionSettingsSchema.statics.calculateCommission = async function (userId, amount, rateType = null) {
    const rate = await this.getCommissionRate(userId, rateType)
    const commission = (amount * rate) / 100
    const partnerAmount = amount - commission

    return {
        totalAmount: amount,
        adminCommission: commission,
        partnerAmount: partnerAmount,
        appliedRate: rate,
    }
}

const CommissionSettings = mongoose.model("CommissionSettings", commissionSettingsSchema)

export default CommissionSettings
