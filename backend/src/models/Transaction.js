import mongoose from "mongoose"

const transactionSchema = new mongoose.Schema(
    {
        walletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: ["CREDIT", "DEBIT", "HOLD"],
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: "KWD",
            enum: ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"],
        },
        category: {
            type: String,
            required: true,
            enum: ["PAYMENT_RECEIVED", "COMMISSION_EARNED", "WITHDRAWAL", "REFUND", "ADJUSTMENT", "SECURITY_DEPOSIT", "NEGOTIATION_COMMISSION", "COMMISSION_REFUND",
                "COMMISSION_REVERSAL",
                "EARNINGS_REVERSAL",
                "CANCELLATION_FEE",
                "BOOKING_PAYMENT",
                "PAYOUT_REQUESTED"],
        },
        description: {
            type: String,
            required: true,
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: "referenceModel",
        },
        referenceModel: {
            type: String,
            enum: ["Payment", "Payout", "Contract", "AdminNegotiation", "B2CPassengerBooking", "CorporateBooking", "WithdrawalRequest"],
        },
        fromUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        fromName: {
            type: String,
        },
        toUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        toName: {
            type: String,
        },
        balanceBefore: {
            type: Number,
            required: true,
        },
        balanceAfter: {
            type: Number,
            required: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
        },
    },
    { timestamps: true },
)

transactionSchema.index({ walletId: 1, createdAt: -1 })
transactionSchema.index({ userId: 1, createdAt: -1 })
transactionSchema.index({ referenceId: 1 })

export default mongoose.model("Transaction", transactionSchema)
