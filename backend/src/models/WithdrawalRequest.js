import mongoose from "mongoose"

const withdrawalRequestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        walletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true,
        },
        // Request Details
        requestId: {
            type: String,
            required: true,
            unique: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: "AED",
            enum: ["AED", "KWD", "SAR", "BHD", "OMR", "QAR", "USD", "EUR"],
        },
        // Bank Details
        bankName: {
            type: String,
            required: true,
        },
        bankCode: {
            type: String,
        },
        iban: {
            type: String,
            required: true,
        },
        accountHolderName: {
            type: String,
            required: true,
        },
        // Country for payment gateway selection
        country: {
            type: String,
            enum: ["UAE", "KW", "SA", "BH", "OM", "QA"],
            default: "UAE",
        },
        // Status
        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "FAILED"],
            default: "PENDING",
        },
        // Payment Method (how the admin will process the payment)
        paymentMethod: {
            type: String,
            enum: ["MANUAL", "STRIPE", "TAP", "BANK_TRANSFER"],
            default: "MANUAL",
        },
        // Processing Details
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        processedAt: {
            type: Date,
        },
        approvedAt: {
            type: Date,
        },
        completedAt: {
            type: Date,
        },
        rejectedAt: {
            type: Date,
        },
        // Admin Notes
        adminNotes: {
            type: String,
        },
        rejectionReason: {
            type: String,
        },
        // Transaction Reference (external payment reference)
        transactionReference: {
            type: String,
        },
        // Gateway payout ID (Stripe transfer ID or TAP transfer ID)
        gatewayPayoutId: {
            type: String,
        },
        gatewayStatus: {
            type: String,
        },
        paymentProof: {
            type: String, // URL to payment proof document/screenshot
        },
        // User Info (denormalized for easier display)
        userInfo: {
            fullName: String,
            email: String,
            phone: String,
            role: String,
        },
        // Wallet Transaction ID reference
        walletTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        // Stripe Connect or TAP destination account (for automatic payouts)
        destinationAccountId: {
            type: String, // User's Stripe Connect account ID or TAP destination ID
        },
        // Metadata
        metadata: {
            type: mongoose.Schema.Types.Mixed,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
)

// Indexes
withdrawalRequestSchema.index({ userId: 1, status: 1 })
withdrawalRequestSchema.index({ status: 1, createdAt: -1 })
withdrawalRequestSchema.index({ requestId: 1 })
withdrawalRequestSchema.index({ country: 1, status: 1 })

// Pre-save middleware
withdrawalRequestSchema.pre("save", function (next) {
    this.updatedAt = new Date()
    next()
})

// Generate unique request ID
withdrawalRequestSchema.statics.generateRequestId = function () {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `WR-${timestamp}-${random}`
}

// Detect country from currency
withdrawalRequestSchema.statics.getCountryFromCurrency = function (currency) {
    const currencyToCountry = {
        AED: "UAE",
        KWD: "KW",
        SAR: "SA",
        BHD: "BH",
        OMR: "OM",
        QAR: "QA",
    }
    return currencyToCountry[currency] || "UAE"
}

// Get recommended payment gateway based on country
withdrawalRequestSchema.statics.getRecommendedGateway = function (country) {
    // UAE uses Stripe, Kuwait uses TAP
    if (country === "KW") {
        return "TAP"
    }
    return "STRIPE"
}

export default mongoose.model("WithdrawalRequest", withdrawalRequestSchema)
