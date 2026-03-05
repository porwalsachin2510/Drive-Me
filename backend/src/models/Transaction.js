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
        category: {
            type: String,
            required: true,
            enum: ["PAYMENT_RECEIVED", "COMMISSION_EARNED", "WITHDRAWAL", "REFUND", "ADJUSTMENT", "SECURITY_DEPOSIT"],
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
            enum: ["Payment", "Payout", "Contract"],
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
