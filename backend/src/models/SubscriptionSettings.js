import mongoose from "mongoose";

const subscriptionSettingsSchema = new mongoose.Schema({
    // User Information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Auto-Renewal Settings
    autoRenewal: {
        type: Boolean,
        default: false
    },

    renewalReminderDays: {
        type: Number,
        default: 7,
        min: 1,
        max: 30
    },

    // SAME_CARD  -> auto-charge a fresh card payment session each cycle
    // WALLET     -> auto-debit the commuter wallet each cycle
    // CASH       -> commuter requests, admin confirms cash collection
    // MANUAL     -> no auto-renewal, commuter renews manually
    renewalPaymentMethod: {
        type: String,
        enum: ["SAME_CARD", "WALLET", "CASH", "MANUAL"],
        default: "SAME_CARD"
    },

    // The active monthly pass this subscription is tracking / will renew
    linkedPassId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CMonthlyPass",
        default: null
    },

    // Notification Preferences
    emailNotifications: {
        renewalReminder: {
            type: Boolean,
            default: true
        },
        renewalSuccess: {
            type: Boolean,
            default: true
        },
        renewalFailed: {
            type: Boolean,
            default: true
        },
        paymentFailed: {
            type: Boolean,
            default: true
        }
    },

    // SMS Notifications
    smsNotifications: {
        renewalReminder: {
            type: Boolean,
            default: true
        },
        renewalSuccess: {
            type: Boolean,
            default: false
        },
        renewalFailed: {
            type: Boolean,
            default: true
        }
    },

    // Push Notifications
    pushNotifications: {
        renewalReminder: {
            type: Boolean,
            default: true
        },
        renewalSuccess: {
            type: Boolean,
            default: true
        },
        renewalFailed: {
            type: Boolean,
            default: true
        }
    },

    // Renewal History
    lastRenewalDate: {
        type: Date,
        default: null
    },

    nextRenewalDate: {
        type: Date,
        default: null
    },

    renewalHistory: [{
        date: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ["SUCCESS", "FAILED", "CANCELLED", "PENDING", "PENDING_PAYMENT"],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        paymentMethod: {
            type: String,
            required: true
        },
        failureReason: {
            type: String,
            default: null
        }
    }],

    // Cancellation Settings
    cancellationReason: {
        type: String,
        default: null
    },

    cancellationDate: {
        type: Date,
        default: null
    },

    // Subscription Limits
    maxRenewalAttempts: {
        type: Number,
        default: 3
    },

    currentRenewalAttempts: {
        type: Number,
        default: 0
    },

    // Pending Cash Renewal (commuter requests -> admin confirms)
    pendingCashRenewal: {
        requested: {
            type: Boolean,
            default: false
        },
        passId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CMonthlyPass",
            default: null
        },
        amount: {
            type: Number,
            default: 0
        },
        // Native currency of the pass being renewed (e.g. AED for a UAE
        // commuter, KWD for a Kuwait commuter). Stored so the admin dashboard
        // can convert the cash-to-collect into the admin's chosen currency.
        currency: {
            type: String,
            default: "AED"
        },
        // Number of months the commuter chose to renew for. The admin's
        // confirmation extends the pass by exactly this many months.
        renewalMonths: {
            type: Number,
            default: 1
        },
        requestedAt: {
            type: Date,
            default: null
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
subscriptionSettingsSchema.index({ userId: 1 });
subscriptionSettingsSchema.index({ nextRenewalDate: 1 });
subscriptionSettingsSchema.index({ autoRenewal: 1, nextRenewalDate: 1 });

export default mongoose.model("SubscriptionSettings", subscriptionSettingsSchema);
