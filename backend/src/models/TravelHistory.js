import mongoose from "mongoose";

const travelHistorySchema = new mongoose.Schema({
    // User Information
    passengerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
    // Trip Information
    tripId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerTrip",
        required: true
    },
    monthlyPassId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CMonthlyPass",
        required: true
    },
    routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerRoute",
        required: true
    },
    
    // Travel Details
    travelDate: {
        type: Date,
        required: true
    },
    scheduledTime: {
        type: String,
        required: true
    },
    actualBoardingTime: {
        type: Date,
        default: null
    },
    actualDropoffTime: {
        type: Date,
        default: null
    },
    
    // Route Information
    pickupLocation: {
        type: String,
        required: true
    },
    dropoffLocation: {
        type: String,
        required: true
    },
    actualPickupPoint: {
        type: String,
        default: null
    },
    actualDropoffPoint: {
        type: String,
        default: null
    },
    
    // Status & Tracking
    status: {
        type: String,
        enum: ["SCHEDULED", "BOARDED", "IN_TRANSIT", "COMPLETED", "MISSED", "CANCELLED"],
        default: "SCHEDULED"
    },
    
    // Driver & Vehicle Information
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerDriver",
        default: null
    },
    driverName: {
        type: String,
        default: null
    },
    driverContact: {
        type: String,
        default: null
    },
    vehicleNumber: {
        type: String,
        default: null
    },
    vehicleType: {
        type: String,
        default: null
    },
    
    // GPS Tracking
    boardingCoordinates: {
        lat: Number,
        lng: Number
    },
    dropoffCoordinates: {
        lat: Number,
        lng: Number
    },
    
    // Experience & Feedback
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    feedback: {
        type: String,
        default: null
    },
    complaints: [{
        type: {
            type: String,
            enum: ["LATE_ARRIVAL", "DRIVER_BEHAVIOR", "VEHICLE_CONDITION", "ROUTE_DEVIATION", "OTHER"]
        },
        description: String,
        resolved: {
            type: Boolean,
            default: false
        },
        resolvedAt: {
            type: Date,
            default: null
        }
    }],
    
    // Attendance & Analytics
    wasOnTime: {
        type: Boolean,
        default: null
    },
    delayMinutes: {
        type: Number,
        default: 0
    },
    
    // Cost Information
    fare: {
        type: Number,
        default: 0
    },
    isPaid: {
        type: Boolean,
        default: true
    },
    
    // Notifications
    reminderSent: {
        type: Boolean,
        default: false
    },
    completionNotificationSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
travelHistorySchema.index({ passengerId: 1, travelDate: -1 });
travelHistorySchema.index({ tripId: 1 });
travelHistorySchema.index({ monthlyPassId: 1, travelDate: -1 });
travelHistorySchema.index({ status: 1, travelDate: -1 });
travelHistorySchema.index({ travelDate: -1 });

export default mongoose.model("TravelHistory", travelHistorySchema);
