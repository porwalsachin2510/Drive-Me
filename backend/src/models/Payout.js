import mongoose from "mongoose"

const payoutSchema = new mongoose.Schema(
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
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: "AED",
        },
        payoutMethod: {
            type: String,
            required: true,
            enum: ["BANK_TRANSFER", "WALLET", "CASH"],
        },
        bankDetails: {
            bankName: String,
            accountNumber: String,
            accountHolderName: String,
            iban: String,
            swiftCode: String,
        },
        walletDetails: {
            walletProvider: String,
            walletPhone: String,
            walletEmail: String,
        },
        status: {
            type: String,
            default: "PENDING",
            enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"],
        },
        gatewayTransferId: {
            type: String,
            sparse: true,
        },
        gatewayProvider: {
            type: String,
            enum: ["STRIPE", "TAP", "MANUAL"],
        },
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        processedAt: {
            type: Date,
        },
        failureReason: {
            type: String,
        },
        notes: {
            type: String,
        },
    },
    { timestamps: true },
)

payoutSchema.index({ userId: 1, createdAt: -1 })
payoutSchema.index({ status: 1 })

export default mongoose.model("Payout", payoutSchema)
