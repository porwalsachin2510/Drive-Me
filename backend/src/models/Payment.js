import mongoose from "mongoose"

const paymentSchema = new mongoose.Schema(
    {
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
        },
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        fleetOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        advanceAmount: {
            type: Number,
            required: true,
        },
        securityDepositAmount: {
            type: Number,
            required: true,
        },
        adminCommission: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        fleetOwnerAmount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: "AED",
            enum: ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"],
        },
        paymentType: {
            type: String,
            required: true,
            enum: ["advance", "final", "security"],
            default: "advance",
        },
        description: {
            type: String,
        },
        paymentMethod: {
            type: String,
            required: true,
            enum: ["CARD", "BANK_TRANSFER", "WALLET", "CASH", "KNET", "APPLE_PAY", "GOOGLE_PAY"],
        },
        paymentProvider: {
            type: String,
            enum: ["STRIPE", "TAP", "MANUAL"],
            required: true,
        },
        gatewayTransactionId: {
            type: String,
            sparse: true,
        },
        gatewaySessionId: {
            type: String,
            sparse: true,
        },
        gatewayReference: {
            type: String,
            unique: true,
            sparse: true,
        },
        status: {
            type: String,
            default: "PENDING",
            enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED", "CANCELLED"],
        },
        verificationStatus: {
            type: String,
            default: "PENDING",
            enum: ["PENDING", "VERIFIED", "REJECTED", "AUTO_VERIFIED"],
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        verifiedAt: {
            type: Date,
        },
        paymentMetadata: {
            cardType: String,
            cardLast4: String,
            bankName: String,
            accountNumber: String,
            paymentLink: String,
            paymentUrl: String,
            country: String,
        },
        failureReason: {
            type: String,
        },
    },
    { timestamps: true },
)

export default mongoose.model("Payment", paymentSchema)
