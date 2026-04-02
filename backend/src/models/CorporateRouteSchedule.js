import mongoose from "mongoose";

const corporateRouteScheduleSchema = new mongoose.Schema({
    corporateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Route",
        required: true,
    },
    contractId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contract",
        required: true,
    },
    scheduleName: {
        type: String,
        required: true,
        default: "Corporate Route Schedule",
    },
    // Multiple trip times for the same route (morning, evening, etc.)
    tripTimes: [{
        tripNumber: {
            type: Number,
            required: true,
            default: 1,
        },
        departureTime: {
            type: String,
            required: true,
        },
        arrivalTime: {
            type: String,
        },
        returnDepartureTime: {
            type: String,
        },
        returnArrivalTime: {
            type: String,
        },
        tripType: {
            type: String,
            enum: ["One Way", "Round Trip"],
            default: "One Way"
        },
        // Morning trip: Home -> Office (outbound stops)
        outboundStopPoints: [{
            location: {
                type: String,
                required: true
            },
            time: {
                type: String,
                required: true
            },
            coordinates: {
                lat: Number,
                lng: Number
            }
        }],
        // Evening trip: Office -> Home (return stops)
        returnStopPoints: [{
            location: {
                type: String,
                required: true
            },
            time: {
                type: String,
                required: true
            },
            coordinates: {
                lat: Number,
                lng: Number
            }
        }]
    }],
    availableDays: [{
        type: String,
        enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    }],
    assignedVehicleId: {
        type: String,
        required: true,
    },
    assignedVehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
    },
    assignedDriver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    startDate: {
        type: Date,
        required: true,
        default: Date.now,
    },
    endDate: {
        type: Date,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: ["Active", "Inactive", "Suspended"],
        default: "Active",
    },
    // Auto-generated trips tracking
    lastTripGenerated: {
        type: Date,
    },
    nextTripGeneration: {
        type: Date,
    },
    // Schedule metadata
    notes: {
        type: String,
    },
    totalSeats: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for optimization
corporateRouteScheduleSchema.index({ corporateId: 1, routeId: 1 });
corporateRouteScheduleSchema.index({ contractId: 1 });
corporateRouteScheduleSchema.index({ isActive: 1, status: 1 });

// Pre-save middleware to set default available days if empty
corporateRouteScheduleSchema.pre('save', function (next) {
    if (this.isModified('availableDays') && this.availableDays.length === 0) {
        this.availableDays = ["MON", "TUE", "WED", "THU", "FRI"];
    }
    next();
});

const CorporateRouteSchedule = mongoose.model("CorporateRouteSchedule", corporateRouteScheduleSchema);
export default CorporateRouteSchedule;
