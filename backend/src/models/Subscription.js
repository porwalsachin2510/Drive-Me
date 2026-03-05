import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerRoute",
            required: true,
        },
        b2cPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        subscriptionType: {
            type: String,
            enum: ["MONTHLY", "WEEKLY", "CUSTOM"],
            required: true,
        },
        planType: {
            type: String,
            enum: ["FULL_MONTH", "WEEKDAYS_ONLY", "CUSTOM_DAYS"],
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
        autoRenewal: {
            type: Boolean,
            default: true,
        },
        status: {
            type: String,
            enum: ["ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED"],
            default: "ACTIVE",
        },
        pricing: {
            monthlyPrice: {
                type: Number,
                required: true,
            },
            paidAmount: {
                type: Number,
                required: true,
            },
            currency: {
                type: String,
                default: "AED",
            },
        },
        paymentDetails: {
            paymentMethod: {
                type: String,
                enum: ["WALLET", "CREDIT_CARD", "BANK_TRANSFER", "COMPANY_PAID"],
                required: true,
            },
            transactionId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Transaction",
            },
            paymentStatus: {
                type: String,
                enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
                default: "COMPLETED",
            },
            paidAt: {
                type: Date,
                default: Date.now,
            },
        },
        // For corporate employees
        corporateDetails: {
            companyId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            employeeId: String,
            department: String,
        },
        // Seat allocation
        seatAllocation: {
            seatNumber: Number,
            pickupPoint: String,
            dropOffPoint: String,
        },
        // Usage tracking
        usageStats: {
            totalDaysInPeriod: {
                type: Number,
                required: true,
            },
            daysUsed: {
                type: Number,
                default: 0,
            },
            daysAbsent: {
                type: Number,
                default: 0,
            },
            noShowDays: [{
                date: Date,
                reason: String,
                notifiedAt: Date,
            }],
        },
        // Notifications preferences
        notificationSettings: {
            dailyReminder: {
                type: Boolean,
                default: true,
            },
            reminderTime: {
                type: String,
                default: "30", // minutes before pickup
            },
            tripUpdates: {
                type: Boolean,
                default: true,
            },
            paymentReminders: {
                type: Boolean,
                default: true,
            },
        },
        // Renewal tracking
        renewalTracking: {
            lastRenewalDate: Date,
            nextRenewalDate: Date,
            renewalAttempts: {
                type: Number,
                default: 0,
            },
            lastRenewalReminder: Date,
        },
        // Cancellation details
        cancellationDetails: {
            cancelledAt: Date,
            cancelledBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            reason: String,
            refundAmount: Number,
            refundStatus: {
                type: String,
                enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
            },
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
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Indexes for search optimization
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ routeId: 1, status: 1 });
subscriptionSchema.index({ b2cPartnerId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });
subscriptionSchema.index({ "corporateDetails.companyId": 1 });

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function() {
    const now = new Date();
    const endDate = new Date(this.endDate);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
});

// Virtual for usage percentage
subscriptionSchema.virtual('usagePercentage').get(function() {
    if (this.totalDaysInPeriod === 0) return 0;
    return (this.daysUsed / this.totalDaysInPeriod) * 100;
});

// Pre-save middleware
subscriptionSchema.pre('save', function(next) {
    // Auto-calculate next renewal date if auto-renewal is enabled
    if (this.autoRenewal && this.status === 'ACTIVE') {
        const currentEndDate = new Date(this.endDate);
        const nextRenewalDate = new Date(currentEndDate);
        nextRenewalDate.setDate(nextRenewalDate.getDate() - 7); // 7 days before expiry
        this.renewalTracking.nextRenewalDate = nextRenewalDate;
    }
    next();
});

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
