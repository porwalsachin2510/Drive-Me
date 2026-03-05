import mongoose from "mongoose";

const monthlyPassSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        corporateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
        },
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route",
            required: true,
        },
        
        // Pass details
        passType: {
            type: String,
            enum: ["MONTHLY", "QUARTERLY", "YEARLY"],
            default: "MONTHLY",
        },
        validFrom: {
            type: Date,
            required: true,
        },
        validTo: {
            type: Date,
            required: true,
        },
        
        // Route preferences
        preferredPickupPoint: {
            type: String,
            required: true,
        },
        preferredPickupTime: {
            type: String,
            required: true,
        },
        preferredDropPoint: {
            type: String,
            required: true,
        },
        
        // Pricing
        totalAmount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: "KWD",
        },
        paymentStatus: {
            type: String,
            enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
            default: "PENDING",
        },
        paidAt: Date,
        paymentMethod: {
            type: String,
            enum: ["CORPORATE_BILLED", "SELF_PAID"],
            default: "CORPORATE_BILLED",
        },
        
        // Usage tracking
        totalTrips: {
            type: Number,
            default: 0,
        },
        usedTrips: {
            type: Number,
            default: 0,
        },
        remainingTrips: {
            type: Number,
            default: 0,
        },
        
        // Pass status
        status: {
            type: String,
            enum: ["ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"],
            default: "ACTIVE",
        },
        
        // Auto-renewal
        autoRenewal: {
            type: Boolean,
            default: false,
        },
        
        // Notifications
        notifications: {
            renewalReminder: {
                type: Boolean,
                default: true,
            },
            expiryAlert: {
                type: Boolean,
                default: true,
            },
            tripReminders: {
                type: Boolean,
                default: true,
            },
        },
        
        // Pass history
        renewalHistory: [{
            renewedFrom: Date,
            renewedTo: Date,
            amount: Number,
            renewedAt: Date,
        }],
        
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for better performance
monthlyPassSchema.index({ employeeId: 1, status: 1 });
monthlyPassSchema.index({ corporateId: 1, validFrom: 1, validTo: 1 });
monthlyPassSchema.index({ contractId: 1, status: 1 });
monthlyPassSchema.index({ validTo: 1 });

const MonthlyPass = mongoose.model("MonthlyPass", monthlyPassSchema);

export default MonthlyPass;
