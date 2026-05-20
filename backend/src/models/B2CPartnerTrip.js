import mongoose from "mongoose";

const b2cPartnerTripSchema = new mongoose.Schema(
    {
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerRoute",
            required: true,
        },
        b2cPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerVehicle",
            default: null,
        },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerDriver",
            default: null,
        },
        tripDate: {
            type: Date,
            required: true,
        },
        startTime: {
            type: String,
            required: true,
        },
        actualStartTime: {
            type: Date,
        },
        actualEndTime: {
            type: Date,
        },
        tripType: {
            type: String,
            enum: ["One Way", "Round Trip"],
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
        stopPoints: [{
            location: String,
            scheduledTime: String,
            actualTime: String,
        }],
        // Seat management
        totalSeats: {
            type: Number,
            required: true,
        },
        bookedSeats: {
            type: Number,
            default: 0,
        },
        availableSeats: {
            type: Number,
            required: true,
        },
        // Passenger management
        passengers: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            bookingId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "B2CPassengerBooking",
            },
            seatNumber: Number,
            pickupPoint: String,
            dropOffPoint: String,
            status: {
                type: String,
                enum: ["Confirmed", "Boarded", "Completed", "No Show", "Cancelled"],
                default: "Confirmed",
            },
            boardedAt: Date,
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            feedback: String,
            ratedAt: Date
        }],
        // Trip status
        status: {
            type: String,
            enum: ["Scheduled", "In Progress", "Completed", "Cancelled", "Delayed"],
            default: "Scheduled",
        },
        // Location tracking
        currentLocation: {
            latitude: Number,
            longitude: Number,
            address: String,
            lastUpdated: Date,
        },
        locationHistory: [{
            latitude: Number,
            longitude: Number,
            timestamp: Date,
        }],
        // Notifications
        notificationsSent: {
            reminder30Min: {
                type: Boolean,
                default: false,
            },
            reminder5Min: {
                type: Boolean,
                default: false,
            },
            tripStarted: {
                type: Boolean,
                default: false,
            },
            tripCompleted: {
                type: Boolean,
                default: false,
            },
        },
        // Financial tracking
        revenue: {
            type: Number,
            default: 0,
        },
        // Driver information snapshot
        driverInfo: {
            name: String,
            phoneNumber: String,
            licenseNumber: String,
        },
        // Vehicle information snapshot
        vehicleInfo: {
            model: String,
            licensePlate: String,
            seatingCapacity: Number,
        },
        // Trip notes
        notes: {
            type: String,
        },
        delayReason: {
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
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index for search optimization
b2cPartnerTripSchema.index({ routeId: 1, tripDate: 1 });
b2cPartnerTripSchema.index({ b2cPartnerId: 1, status: 1 });
b2cPartnerTripSchema.index({ vehicleId: 1, tripDate: 1 });
b2cPartnerTripSchema.index({ driverId: 1, tripDate: 1 });
b2cPartnerTripSchema.index({ tripDate: 1, status: 1 });

// Virtual for trip completion percentage
b2cPartnerTripSchema.virtual('completionPercentage').get(function() {
    if (this.passengers.length === 0) return 100;
    const completedPassengers = this.passengers.filter(p => p.status === 'Completed').length;
    return (completedPassengers / this.passengers.length) * 100;
});

// Virtual for seat utilization
b2cPartnerTripSchema.virtual('seatUtilization').get(function() {
    if (this.totalSeats === 0) return 0;
    return (this.bookedSeats / this.totalSeats) * 100;
});

// Pre-save middleware to ensure data consistency
b2cPartnerTripSchema.pre('save', function(next) {
    // Calculate available seats
    this.availableSeats = this.totalSeats - this.bookedSeats;
    
    // Ensure available seats is not negative
    if (this.availableSeats < 0) {
        this.availableSeats = 0;
    }
    
    next();
});

const B2CPartnerTrip = mongoose.model("B2CPartnerTrip", b2cPartnerTripSchema);

export default B2CPartnerTrip;
