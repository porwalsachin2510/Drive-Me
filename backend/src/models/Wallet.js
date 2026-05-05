import mongoose from "mongoose"

const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        role: {
            type: String,
            enum: ["COMMUTER", "CORPORATE", "CORPORATE_EMPLOYEE", "B2C_PARTNER", "B2C_PARTNER_DRIVER", "B2B_PARTNER", "B2B_PARTNER_DRIVER", "CORPORATE_DRIVER", "ADMIN"],
            required: true,
        },

        balance: {
            type: Number,
            default: 0,
            min: 0, // Allow minimum 0 balance
        },

        minimumRequiredBalance: {
            type: Number,
            default: 0,
            min: 0,
        },

        commissionDebt: {
            type: Number,
            default: 0,
            min: 0,
        },

        securityDepositHeld: {
            type: Number,
            default: 0,
            min: 0,
        },
        
        currency: {
            type: String,
            default: "AED",
            enum: ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"],
        },
        totalEarnings: {
            type: Number,
            default: 0,
        },
        totalWithdrawals: {
            type: Number,
            default: 0,
        },
        pendingAmount: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        transactions: [{
            type: {
                type: String,
                enum: ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "PAYOUT", "COMMISSION_DEDUCTION", "BOOKING_EARNING", "NEGOTIATION_COMMISSION", "EMI_PAYMENT", "SECURITY_DEPOSIT", "SECURITY_DEPOSIT_REFUND"],
                required: true,
            },
            amount: {
                type: Number,
                required: true,
            },
            description: {
                type: String,
                required: true,
            },
            paymentMethod: {
                type: String,
            },
            bankAccount: {
                type: String,
            },
            payoutMethod: {
                type: String,
            },
            status: {
                type: String,
                enum: ["PENDING", "COMPLETED", "FAILED"],
                default: "COMPLETED",
            },
            recipientId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            recipientName: {
                type: String,
            },
            senderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            senderName: {
                type: String,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        }],
    },
    { timestamps: true },
)

walletSchema.index({ userId: 1 })

export default mongoose.model("Wallet", walletSchema)
