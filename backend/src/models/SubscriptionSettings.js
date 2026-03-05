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
    
    renewalPaymentMethod: {
        type: String,
        enum: ["SAME_CARD", "WALLET", "MANUAL"],
        default: "SAME_CARD"
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
            enum: ["SUCCESS", "FAILED", "CANCELLED"],
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
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
subscriptionSettingsSchema.index({ userId: 1 });
subscriptionSettingsSchema.index({ nextRenewalDate: 1 });
subscriptionSettingsSchema.index({ autoRenewal: 1, nextRenewalDate: 1 });

export default mongoose.model("SubscriptionSettings", subscriptionSettingsSchema);
