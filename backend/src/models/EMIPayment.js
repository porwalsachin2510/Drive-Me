import mongoose from "mongoose"

const emiPaymentSchema = new mongoose.Schema(
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
        // EMI Plan Details
        emiPlan: {
            contractAmount: {
                type: Number,
                required: true,
            },
            negotiationCommission: {
                type: Number,
                default: 0,
            },
            securityDeposit: {
                type: Number,
                default: 0, // Security deposit is NOT included in EMI, handled separately or waived
            },
            totalAmount: {
                type: Number,
                required: true, // contractAmount + negotiationCommission (EMI base)
            },
            tenure: {
                type: Number,
                required: true,
                enum: [3, 6, 9, 12, 18, 24], // Allowed tenures in months
            },
            monthlyEMI: {
                type: Number,
                required: true,
            },
            startDate: {
                type: Date,
                required: true,
            },
            endDate: {
                type: Date,
                required: true,
            },
            currency: {
                type: String,
                default: "AED",
                enum: ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"],
            },
            status: {
                type: String,
                enum: ["ACTIVE", "COMPLETED", "DEFAULTED", "SUSPENDED", "CANCELLED"],
                default: "ACTIVE",
            },
        },
        // Individual EMI installments
        installments: [
            {
                installmentNumber: {
                    type: Number,
                    required: true,
                },
                amount: {
                    type: Number,
                    required: true,
                },
                dueDate: {
                    type: Date,
                    required: true,
                },
                paidAt: Date,
                status: {
                    type: String,
                    enum: ["PENDING", "PAID", "OVERDUE", "WAIVED"],
                    default: "PENDING",
                },
                // Late payment penalty
                lateFee: {
                    type: Number,
                    default: 0,
                },
                lateFeePercentage: {
                    type: Number,
                    default: 2, // 2% late fee
                },
                totalAmountDue: {
                    type: Number, // amount + lateFee
                },
                // Payment details
                paymentMethod: {
                    type: String,
                    enum: ["CARD", "BANK_TRANSFER", "WALLET", "CASH", "KNET", "APPLE_PAY", "GOOGLE_PAY"],
                },
                paymentProvider: {
                    type: String,
                    enum: ["STRIPE", "TAP", "MANUAL"],
                },
                transactionId: String,
                gatewaySessionId: String,
                // Commission tracking per installment
                adminCommission: {
                    rate: {
                        type: Number,
                        default: 20, // 20% default
                    },
                    amount: {
                        type: Number,
                        default: 0,
                    },
                    status: {
                        type: String,
                        enum: ["PENDING", "CREDITED", "WAIVED"],
                        default: "PENDING",
                    },
                    creditedAt: Date,
                },
                // Negotiation commission portion in this EMI (distributed per installment)
                negotiationCommissionPortion: {
                    type: Number,
                    default: 0,
                },
                negotiationCommissionCredited: {
                    type: Boolean,
                    default: false,
                },
                negotiationCommissionCreditedAt: Date,
                // Contract amount portion (what goes to B2B partner after commission)
                contractAmountPortion: {
                    type: Number,
                    default: 0,
                },
                fleetOwnerAmount: {
                    type: Number,
                    default: 0,
                },
                fleetOwnerCredited: {
                    type: Boolean,
                    default: false,
                },
                fleetOwnerCreditedAt: Date,
                // Invoice tracking
                invoiceSent: {
                    type: Boolean,
                    default: false,
                },
                invoiceSentAt: Date,
                invoiceUrl: String,
                // Reminders tracking
                remindersSent: [
                    {
                        type: {
                            type: String,
                            enum: ["7_DAYS", "3_DAYS", "1_DAY", "DUE_DATE", "OVERDUE"],
                        },
                        sentAt: Date,
                        channel: {
                            type: String,
                            enum: ["EMAIL", "NOTIFICATION", "BOTH"],
                        },
                    },
                ],
                // Verification for manual payments
                verificationStatus: {
                    type: String,
                    enum: ["PENDING", "VERIFIED", "REJECTED"],
                    default: "PENDING",
                },
                verifiedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                verifiedAt: Date,
                notes: String,
            },
        ],
        // Payment Summary
        summary: {
            totalPaid: {
                type: Number,
                default: 0,
            },
            totalRemaining: {
                type: Number,
                default: 0,
            },
            totalLateFees: {
                type: Number,
                default: 0,
            },
            installmentsPaid: {
                type: Number,
                default: 0,
            },
            installmentsRemaining: {
                type: Number,
                default: 0,
            },
            installmentsOverdue: {
                type: Number,
                default: 0,
            },
            lastPaymentDate: Date,
            nextDueDate: Date,
        },
        // Admin Commission for EMI (set by admin in Commission Settings)
        commissionSettings: {
            emiCommissionRate: {
                type: Number,
                default: 20, // Default 20%
            },
            lateFeeCommissionRate: {
                type: Number,
                default: 0, // Commission on late fees
            },
            totalAdminCommission: {
                type: Number,
                default: 0,
            },
            totalNegotiationCommission: {
                type: Number,
                default: 0, // Total negotiation commission included in EMI
            },
            totalNegotiationCommissionPaid: {
                type: Number,
                default: 0, // Negotiation commission paid so far
            },
            totalFleetOwnerAmount: {
                type: Number,
                default: 0,
            },
        },
        // Service suspension tracking
        serviceSuspension: {
            isSuspended: {
                type: Boolean,
                default: false,
            },
            suspendedAt: Date,
            suspendedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            suspensionReason: String,
            suspensionRequestedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User", // B2B Partner who requested
            },
            suspensionRequestedAt: Date,
            reactivatedAt: Date,
            reactivatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        },
        // Warning tracking
        warnings: [
            {
                type: {
                    type: String,
                    enum: ["PAYMENT_OVERDUE", "MULTIPLE_OVERDUE", "SERVICE_SUSPENSION_WARNING", "FINAL_WARNING"],
                },
                sentAt: Date,
                sentBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                message: String,
                overdueAmount: Number,
                overdueInstallments: Number,
            },
        ],
        // History
        statusHistory: [
            {
                status: String,
                changedAt: {
                    type: Date,
                    default: Date.now,
                },
                changedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                reason: String,
            },
        ],
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
)

// Index for efficient queries
emiPaymentSchema.index({ contractId: 1 })
emiPaymentSchema.index({ corporateOwnerId: 1 })
emiPaymentSchema.index({ fleetOwnerId: 1 })
emiPaymentSchema.index({ "emiPlan.status": 1 })
emiPaymentSchema.index({ "installments.status": 1 })
emiPaymentSchema.index({ "installments.dueDate": 1 })

// Calculate and update summary
emiPaymentSchema.methods.updateSummary = function () {
    const paid = this.installments.filter((i) => i.status === "PAID")
    const pending = this.installments.filter((i) => i.status === "PENDING")
    const overdue = this.installments.filter((i) => i.status === "OVERDUE")

    this.summary.totalPaid = paid.reduce((sum, i) => sum + (i.totalAmountDue || i.amount), 0)
    this.summary.totalRemaining = [...pending, ...overdue].reduce((sum, i) => sum + (i.totalAmountDue || i.amount), 0)
    this.summary.totalLateFees = this.installments.reduce((sum, i) => sum + (i.lateFee || 0), 0)
    this.summary.installmentsPaid = paid.length
    this.summary.installmentsRemaining = pending.length + overdue.length
    this.summary.installmentsOverdue = overdue.length

    if (paid.length > 0) {
        const sortedPaid = paid.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
        this.summary.lastPaymentDate = sortedPaid[0].paidAt
    }

    const nextPending = pending.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]
    if (nextPending) {
        this.summary.nextDueDate = nextPending.dueDate
    }

    // Update plan status
    if (this.summary.installmentsRemaining === 0 && this.summary.installmentsPaid === this.installments.length) {
        this.emiPlan.status = "COMPLETED"
    } else if (this.summary.installmentsOverdue >= 3) {
        this.emiPlan.status = "DEFAULTED"
    }

    return this
}

// Static method to get overdue installments for cron job
emiPaymentSchema.statics.getOverdueInstallments = async function () {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return this.find({
        "emiPlan.status": "ACTIVE",
        "installments": {
            $elemMatch: {
                status: "PENDING",
                dueDate: { $lt: today },
            },
        },
    }).populate([
        { path: "corporateOwnerId", select: "fullName email companyName" },
        { path: "fleetOwnerId", select: "fullName email companyName" },
        { path: "contractId", select: "contractNumber" },
    ])
}

// Static method to get upcoming due installments for reminders
emiPaymentSchema.statics.getUpcomingDueInstallments = async function (daysAhead) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + daysAhead)

    return this.find({
        "emiPlan.status": "ACTIVE",
        "installments": {
            $elemMatch: {
                status: "PENDING",
                dueDate: {
                    $gte: today,
                    $lte: targetDate,
                },
            },
        },
    }).populate([
        { path: "corporateOwnerId", select: "fullName email companyName" },
        { path: "fleetOwnerId", select: "fullName email companyName" },
        { path: "contractId", select: "contractNumber" },
    ])
}

const EMIPayment = mongoose.model("EMIPayment", emiPaymentSchema)

export default EMIPayment
