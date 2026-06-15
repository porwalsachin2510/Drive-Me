import mongoose from "mongoose";

const b2CMonthlyPassSchema = new mongoose.Schema({
    // Passenger Information
    passengerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    // Route Information
    routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerRoute",
        required: true,
    },

    // Schedule Information
    scheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerSchedule",
        required: true,
    },

    // Partner Information
    partnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    // Pass Type and Duration
    passType: {
        type: String,
        enum: ["ONE_WAY", "ROUND_TRIP"],
        required: true,
    },

    // Trip Times (for daily travel)
    outboundTripTime: {
        type: String,
        required: true,
    },

    returnTripTime: {
        type: String,
        default: null,
    },

    // Locations
    pickupLocation: {
        type: String,
        required: true,
    },

    dropoffLocation: {
        type: String,
        required: true,
    },

    returnPickupLocation: {
        type: String,
        default: null,
    },

    returnDropoffLocation: {
        type: String,
        default: null,
    },

    // Outbound Trip Driver/Vehicle Assignment (at booking time)
    outboundDriverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    outboundVehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerVehicle",
        default: null,
    },
    outboundIsSelfDriver: {
        type: Boolean,
        default: false,
    },

    // Return Trip Driver/Vehicle Assignment (at booking time)
    returnDriverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    returnVehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerVehicle",
        default: null,
    },
    returnIsSelfDriver: {
        type: Boolean,
        default: false,
    },

    // Duration and Validity
    startDate: {
        type: Date,
        required: true,
    },

    endDate: {
        type: Date,
        required: true,
    },

    durationMonths: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
    },

    // Selected travel days (e.g., ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    selectedDays: {
        type: [String],
        default: [],
    },

    // Number of operating days billed within the pass period (route's full week)
    travelDaysCount: {
        type: Number,
        default: 0,
    },

    // Pricing
    totalAmount: {
        type: Number,
        required: true,
    },

    currency: {
        type: String,
        default: "KWD",
        enum: ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"],
    },

    paymentMethod: {
        type: String,
        enum: ["STRIPE", "TAP", "CARD", "CASH", "WALLET"],
        required: true,
    },

    paymentStatus: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
        default: "PENDING",
    },

    gatewaySessionId: {
        type: String,
        default: null,
    },

    paymentGateway: {
        type: String,
        default: null,
    },

    paymentId: {
        type: String,
        default: null,
    },

    // Status
    status: {
        type: String,
        enum: ["ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED"],
        default: "ACTIVE",
    },

    // Auto-renewal
    autoRenewal: {
        type: Boolean,
        default: false,
    },

    renewalReminderSent: {
        type: Boolean,
        default: false,
    },

    // Usage Tracking
    totalTrips: {
        type: Number,
        default: 0,
    },

    usedTrips: {
        type: Number,
        default: 0,
    },

    // Daily Usage Tracking
    dailyUsage: [{
        date: {
            type: Date,
            required: true,
        },
        outboundTripUsed: {
            type: Boolean,
            default: false,
        },
        returnTripUsed: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        }
    }],

    // Notifications
    notificationsSent: {
        activationEmail: { type: Boolean, default: false },
        renewalReminder: { type: Boolean, default: false },
        expiryNotice: { type: Boolean, default: false },
        passCertificate: { type: Boolean, default: false },
    },

    // Commission Tracking
    adminCommission: {
        type: Number,
        required: true,
    },

    partnerEarnings: {
        type: Number,
        required: true,
    },

    // Metadata
    notes: {
        type: String,
        default: "",
    },

    // Number of times this pass has been renewed (extended in place)
    renewalCount: {
        type: Number,
        default: 0,
    },

    // Date of the most recent successful renewal/extension
    lastRenewedAt: {
        type: Date,
        default: null,
    },

    // Number of months the commuter chose for an IN-FLIGHT card renewal. Stored
    // when the payment session is created so the same duration is applied once
    // the gateway confirms payment (the commuter may renew for a different number
    // of months than the original pass duration). Cleared after activation.
    pendingRenewalMonths: {
        type: Number,
        default: null,
    },

    // Gateway session ids that have already been applied as renewals to this
    // pass. Used to guarantee a card renewal is never double-applied even if
    // the payment-verify endpoint is hit more than once.
    appliedRenewalSessions: {
        type: [String],
        default: [],
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },

    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Virtuals
b2CMonthlyPassSchema.virtual('daysRemaining').get(function () {
    const now = new Date();
    const endDate = new Date(this.endDate);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
});

b2CMonthlyPassSchema.virtual('isActive').get(function () {
    const now = new Date();
    return this.status === 'ACTIVE' && new Date(this.endDate) > now;
});

b2CMonthlyPassSchema.virtual('usagePercentage').get(function () {
    if (this.totalTrips === 0) return 0;
    return Math.round((this.usedTrips / this.totalTrips) * 100);
});

// Indexes
b2CMonthlyPassSchema.index({ passengerId: 1, status: 1 });
b2CMonthlyPassSchema.index({ routeId: 1, status: 1 });
b2CMonthlyPassSchema.index({ endDate: 1 });
b2CMonthlyPassSchema.index({ paymentStatus: 1 });

// Pre-save middleware
b2CMonthlyPassSchema.pre('save', function (next) {
    this.updatedAt = new Date();

    // Calculate total trips based on pass type and duration
    if (this.isNew) {
        const daysInMonth = 30; // Approximate
        this.totalTrips = this.passType === 'ROUND_TRIP' ? daysInMonth * 2 : daysInMonth;
    }

    next();
});

const B2CMonthlyPass = mongoose.model("B2CMonthlyPass", b2CMonthlyPassSchema);

export default B2CMonthlyPass;
