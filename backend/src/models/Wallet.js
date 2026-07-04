import mongoose from "mongoose"

const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            // NOTE: intentionally NOT unique. A user holds ONE wallet PER currency
            // (see the compound { userId, currency } unique index below). This is
            // what lets an admin accumulate an AED wallet for UAE commission and a
            // separate KWD wallet for Kuwait commission, instead of dumping mixed
            // currencies into a single mislabeled balance.
        },

        role: {
            type: String,
            enum: ["COMMUTER", "CORPORATE", "CORPORATE_EMPLOYEE", "B2C_PARTNER", "B2C_PARTNER_DRIVER", "B2B_PARTNER", "B2B_PARTNER_DRIVER", "CORPORATE_DRIVER", "ADMIN"],
            required: true,
        },

        balance: {
            type: Number,
            default: 0,
            // No min constraint: a partner who collects a cash cancellation fee from a
            // passenger owes that amount to the admin. If their available balance is less
            // than the fee, the balance goes negative so they must top up (add money) to
            // recover the wallet before they can withdraw again.
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
                enum: ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "PAYOUT", "COMMISSION", "COMMISSION_DEDUCTION", "BOOKING_EARNING", "NEGOTIATION_COMMISSION", "EMI_PAYMENT", "SECURITY_DEPOSIT", "SECURITY_DEPOSIT_REFUND", "REFUND", "COMMISSION_REFUND", "COMMISSION_REVERSAL", "EARNINGS_REVERSAL", "CANCELLATION_FEE"],
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
            // Payment session ID from payment gateway (Stripe checkout session ID, Tap charge ID, etc.)
            paymentSessionId: {
                type: String,
                sparse: true, // Allow null/undefined values
            },
            // Gateway transaction ID (Stripe payment intent ID, Tap transaction ID, etc.)
            gatewayTransactionId: {
                type: String,
                sparse: true,
            },
            // Reference for tracking
            reference: {
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

// One wallet per user per currency. This is the core guarantee that keeps
// money from different countries from ever mixing inside a single balance.
walletSchema.index({ userId: 1, currency: 1 }, { unique: true })
walletSchema.index({ userId: 1 })
// Sparse index for payment session IDs to prevent duplicate transactions
// This allows quick lookup and prevents double-charging race conditions
walletSchema.index({ "transactions.paymentSessionId": 1 }, { sparse: true })
walletSchema.index({ "transactions.gatewayTransactionId": 1 }, { sparse: true })

export default mongoose.model("Wallet", walletSchema)
