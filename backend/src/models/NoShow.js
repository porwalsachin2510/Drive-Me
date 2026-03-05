import mongoose from "mongoose";

const noShowSchema = new mongoose.Schema({
    // Trip Information
    tripId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerTrip",
        required: true
    },
    monthlyPassId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CMonthlyPass",
        default: null
    },
    
    // Passenger Information
    passengerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
    // No Show Details
    date: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        enum: ["SICK_LEAVE", "PERSONAL_WORK", "EMERGENCY", "VACATION", "OTHER"],
        required: true
    },
    customReason: {
        type: String,
        default: null
    },
    
    // Status & Impact
    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: "PENDING"
    },
    
    // Seat Management
    seatReleased: {
        type: Boolean,
        default: false
    },
    releasedAt: {
        type: Date,
        default: null
    },
    
    // Provider Actions
    providerNotified: {
        type: Boolean,
        default: false
    },
    providerResponse: {
        type: String,
        default: null
    },
    
    // Refund Information
    refundProcessed: {
        type: Boolean,
        default: false
    },
    refundAmount: {
        type: Number,
        default: 0
    },
    refundDate: {
        type: Date,
        default: null
    },
    
    // Analytics
    isRecurring: {
        type: Boolean,
        default: false
    },
    previousNoShows: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
noShowSchema.index({ passengerId: 1, date: -1 });
noShowSchema.index({ tripId: 1, date: -1 });
noShowSchema.index({ monthlyPassId: 1, date: -1 });
noShowSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("NoShow", noShowSchema);
