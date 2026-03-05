import mongoose from "mongoose";

const stopPointSchema = new mongoose.Schema({
    location: {
        type: String,
        required: true,
    },
    time: {
        type: String,
        required: true,
    },
    order: {
        type: Number,
        required: true,
    },
});

const b2cPartnerRouteSchema = new mongoose.Schema(
    {
        b2cPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        fromLocation: {
            type: String,
            required: true,
        },
        toLocation: {
            type: String,
            required: true,
        },
        routeStartDate: {
            type: Date,
            required: true,
        },
        totalSeats: {
            type: Number,
            required: true,
            min: 1,
            max: 50,
        },
        availableSeats: {
            type: Number,
            required: true,
            min: 0,
        },
        pricing: {
            oneWayPrice: {
                type: Number,
                required: true,
                min: 0,
            },
            roundTripPrice: {
                type: Number,
                min: 0,
            },
            monthlyOneWayPrice: {
                type: Number,
                min: 0,
            },
            monthlyRoundTripPrice: {
                type: Number,
                min: 0,
                default: 0,
            },
        },
        stopPoints: [stopPointSchema],
        tripType: {
            type: String,
            enum: ["One Way", "Round Trip"],
            default: "One Way",
        },
        availableDays: [{
            type: String,
            enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
        }],
        startTime: {
            type: String,
            default: "",
        },
        description: {
            type: String,
        },
        assignedVehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerVehicle",
        },
        assignedDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerDriver",
        },
        status: {
            type: String,
            enum: ["Active", "Inactive", "Scheduled"],
            default: "Active",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // Driver assignment for route
        assignedDriverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        images: [{
            url: String,
            publicId: String,
        }],
        // Trip management
        trips: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerTrip",
        }],
        // Route members (commuters who joined)
        members: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            joinedAt: {
                type: Date,
                default: Date.now,
            },
            status: {
                type: String,
                enum: ["ACTIVE", "LEFT", "REMOVED"],
                default: "ACTIVE",
            },
        }],
        // Booking statistics
        bookingStats: {
            totalBookings: {
                type: Number,
                default: 0,
            },
            activeSubscriptions: {
                type: Number,
                default: 0,
            },
            revenueGenerated: {
                type: Number,
                default: 0,
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
        // Pricing metadata for complex monthly calculations
        pricingMetadata: {
            pricingType: {
                type: String,
                enum: ["perDay", "weekly", "monthly", "custom"],
                default: "perDay"
            },
            customPricing: {
                monday: { type: Number, default: 0, min: 0 },
                tuesday: { type: Number, default: 0, min: 0 },
                wednesday: { type: Number, default: 0, min: 0 },
                thursday: { type: Number, default: 0, min: 0 },
                friday: { type: Number, default: 0, min: 0 },
                saturday: { type: Number, default: 0, min: 0 },
                sunday: { type: Number, default: 0, min: 0 }
            },
            calculatedMonthlyPrice: {
                type: Number,
                default: 0,
                min: 0
            }
        }
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index for search optimization
b2cPartnerRouteSchema.index({ b2cPartnerId: 1, status: 1 });
b2cPartnerRouteSchema.index({ fromLocation: 1, toLocation: 1 });
b2cPartnerRouteSchema.index({ assignedVehicle: 1 });
b2cPartnerRouteSchema.index({ assignedDriver: 1 });

// Virtual for route description
b2cPartnerRouteSchema.virtual('routeDescription').get(function() {
    return `${this.fromLocation} to ${this.toLocation} (${this.tripType})`;
});

// Virtual for seat utilization
b2cPartnerRouteSchema.virtual('seatUtilization').get(function() {
    if (this.totalSeats === 0) return 0;
    return ((this.totalSeats - this.availableSeats) / this.totalSeats) * 100;
});

// Pre-save middleware to ensure availableSeats doesn't exceed totalSeats
b2cPartnerRouteSchema.pre('save', function(next) {
    if (this.availableSeats > this.totalSeats) {
        this.availableSeats = this.totalSeats;
    }
    next();
});

// Index for pricing metadata queries
b2cPartnerRouteSchema.index({ 'pricingMetadata.pricingType': 1 });
b2cPartnerRouteSchema.index({ 'pricingMetadata.customPricing.monday': 1 });
b2cPartnerRouteSchema.index({ 'pricingMetadata.customPricing.tuesday': 1 });
b2cPartnerRouteSchema.index({ 'pricingMetadata.customPricing.wednesday': 1 });
b2cPartnerRouteSchema.index({ 'pricingMetadata.customPricing.thursday': 1 });
b2cPartnerRouteSchema.index({ 'pricingMetadata.customPricing.friday': 1 });
b2cPartnerRouteSchema.index({ 'pricingMetadata.customPricing.saturday': 1 });
b2cPartnerRouteSchema.index({ 'pricingMetadata.customPricing.sunday': 1 });

const B2CPartnerRoute = mongoose.model("B2CPartnerRoute", b2cPartnerRouteSchema);

export default B2CPartnerRoute;
