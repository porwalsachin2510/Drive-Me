import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema({
    b2cPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerRoute",
        required: true,
    },
    scheduleName: {
        type: String,
        required: true,
        default: "Route Schedule",
    },
    // Multiple trip times for the same route - each trip can have its own driver/vehicle
    tripTimes: [{
        departureTime: {
            type: String,
            required: true,
            validate: {
                validator: function(v) {
                    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s?(AM|PM)$/i.test(v);
                },
                message: 'Time must be in HH:MM AM/PM format'
            }
        },
        arrivalTime: {
            type: String,
            validate: {
                validator: function(v) {
                    return !v || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s?(AM|PM)$/i.test(v);
                },
                message: 'Time must be in HH:MM AM/PM format'
            }
        },
        tripType: {
            type: String,
            enum: ["One Way", "Round Trip"],
            default: "One Way"
        },
        // Per-trip driver assignment (optional - falls back to schedule/route default)
        assignedDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerDriver",
            default: null
        },
        // Per-trip vehicle assignment (optional - falls back to schedule/route default)
        assignedVehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerVehicle",
            default: null
        },
        outboundStopPoints: [{
            location: {
                type: String,
                required: true
            },
            time: {
                type: String,
                required: true,
                validate: {
                    validator: function(v) {
                        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s?(AM|PM)$/i.test(v);
                    },
                    message: 'Time must be in HH:MM AM/PM format'
                }
            }
        }],
        returnStopPoints: [{
            location: {
                type: String,
                required: true
            },
            time: {
                type: String,
                required: true,
                validate: {
                    validator: function(v) {
                        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s?(AM|PM)$/i.test(v);
                    },
                    message: 'Time must be in HH:MM AM/PM format'
                }
            }
        }]
    }],
    availableDays: [{
        type: String,
        enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    }],
    assignedVehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerVehicle",
    },
    assignedDriver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2CPartnerDriver",
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
scheduleSchema.index({ b2cPartnerId: 1, routeId: 1 });
scheduleSchema.index({ scheduleTime: 1 });
scheduleSchema.index({ isActive: 1, status: 1 });

// Virtual for formatted time
scheduleSchema.virtual('formattedTime').get(function() {
    return this.scheduleTime;
});

// Virtual for next active trip date
scheduleSchema.virtual('nextTripDate').get(function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (this.repeatPattern === 'Daily') {
        return today;
    } else if (this.repeatPattern === 'Weekdays') {
        const day = today.getDay();
        if (day === 0 || day === 6) { // Sunday or Saturday
            today.setDate(today.getDate() + ((day === 0) ? 1 : 6)); // Next Monday
        }
        return today;
    }
    return today;
});

// Pre-save middleware
scheduleSchema.pre('save', function(next) {
    if (this.isModified('availableDays') && this.availableDays.length === 0) {
        this.availableDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    }
    next();
});

const B2CPartnerSchedule = mongoose.model("B2CPartnerSchedule", scheduleSchema);
export default B2CPartnerSchedule;
