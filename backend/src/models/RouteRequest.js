import mongoose from "mongoose";

const routeRequestSchema = new mongoose.Schema({
    // Passenger Information
    passengerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
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
        enum: ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "COMPLETED"],
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
