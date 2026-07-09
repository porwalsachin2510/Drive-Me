import mongoose from "mongoose";

const routeRequestSchema = new mongoose.Schema({
    // Passenger Information
    passengerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Service country this demand belongs to. Stamped at creation from the
    // requesting commuter's effective country (dialing-code / stored selection),
    // NOT guessed from free-text location names. This is what keeps a UAE
    // partner's demand board from ever showing Kuwait commuter requests and
    // vice-versa. Kept in sync with the same canonical codes as User.country.
    country: {
        type: String,
        enum: ["UAE", "KW", "SA", "BH", "OM", "QA"],
        default: null,
        index: true
    },

    // Route Details
    pickupLocation: {
        type: String,
        required: true,
        trim: true
    },
    dropoffLocation: {
        type: String,
        required: true,
        trim: true
    },

    // Travel Preferences
    preferredTime: {
        type: String,
        required: true,
        enum: ["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "5:00 PM", "6:00 PM", "7:00 PM"]
    },
    requestType: {
        type: String,
        required: true,
        enum: ["MONTHLY", "WEEKLY", "ONE_TIME"]
    },

    // Additional Details
    travelDays: {
        type: [String],
        enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
        default: ["MON", "TUE", "WED", "THU", "FRI"]
    },
    expectedStartDate: {
        type: Date,
        required: true
    },

    // Status & Tracking
    status: {
        type: String,
        enum: ["PENDING", "UNDER_REVIEW", "OPEN", "APPROVED", "FULFILLED", "REJECTED", "COMPLETED"],
        default: "PENDING"
    },

    // Provider Response
    assignedProviderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    providerResponse: {
        type: String,
        default: null
    },
    estimatedPrice: {
        type: Number,
        default: null
    },

    // Open Marketplace: every B2C partner who expressed interest in serving this corridor.
    // Instead of assigning the route to a single partner, Admin "opens" the demand and any
    // interested partner can publish their own competing route listing.
    interestedPartners: [{
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        message: {
            type: String,
            default: null
        },
        estimatedPrice: {
            type: Number,
            default: null
        },
        // INTERESTED = partner raised hand; ROUTE_PUBLISHED = partner created a live listing
        status: {
            type: String,
            enum: ["INTERESTED", "ROUTE_PUBLISHED", "WITHDRAWN"],
            default: "INTERESTED"
        },
        publishedRouteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerRoute",
            default: null
        },
        respondedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // True once Admin opens this demand to the marketplace so partners can publish routes.
    marketplaceOpenedAt: {
        type: Date,
        default: null
    },

    // Published partner routes that satisfy this corridor's demand.
    fulfilledByRoutes: [{
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerRoute",
            required: true
        },
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        publishedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Demand Analytics
    demandCount: {
        type: Number,
        default: 1
    },
    similarRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "RouteRequest"
    }],

    // Communication
    notificationSent: {
        type: Boolean,
        default: false
    },

    // Admin review tracking (Ride Pooling Management)
    adminReviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    adminReviewedAt: {
        type: Date,
        default: null
    },
    adminNotes: {
        type: String,
        default: null
    },
    // The actual B2C route created from this demand once Admin approves it
    convertedRouteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerRoute",
        default: null
    },

    // Metadata
    coordinates: {
        pickup: {
            lat: Number,
            lng: Number
        },
        dropoff: {
            lat: Number,
            lng: Number
        }
    }
}, {
    timestamps: true
});

// Index for efficient queries
routeRequestSchema.index({ pickupLocation: 1, dropoffLocation: 1, status: 1 });
routeRequestSchema.index({ passengerId: 1, status: 1 });
routeRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("RouteRequest", routeRequestSchema);
