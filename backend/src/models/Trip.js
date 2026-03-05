import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
    {
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
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
        },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        corporateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        b2bPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        
        // Trip details
        tripDate: {
            type: Date,
            required: true,
        },
        startTime: {
            type: String,
            required: true,
        },
        endTime: {
            type: String,
            required: true,
        },
        
        // Trip type and direction
        tripType: {
            type: String,
            enum: ["ONE_WAY", "ROUND_TRIP"],
            default: "ONE_WAY"
        },
        direction: {
            type: String,
            enum: ["FORWARD", "RETURN"],
            default: "FORWARD"
        },
        scheduleIndex: {
            type: Number,
            default: 0
        },
        fromLocation: {
            type: String,
            required: true,
        },
        toLocation: {
            type: String,
            required: true,
        },
        totalDistance: {
            type: Number,
            required: true,
        },
        estimatedDuration: {
            type: String,
            required: true,
        },
        
        // Booking management
        totalSeats: {
            type: Number,
            required: true,
        },
        availableSeats: {
            type: Number,
            required: true,
        },
        bookedSeats: {
            type: Number,
            default: 0,
        },
        pricePerSeat: {
            type: Number,
            default: 0,
        },
        currency: {
            type: String,
            default: "KWD",
        },
        
        // Passengers
        passengers: [{
            employeeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            seatNumber: {
                type: Number,
                required: true,
            },
            pickupPoint: {
                type: String,
                required: true,
            },
            pickupTime: {
                type: String,
                required: true,
            },
            bookingStatus: {
                type: String,
                enum: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
                default: "CONFIRMED",
            },
            bookedAt: {
                type: Date,
                default: Date.now,
            },
            monthlyPass: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "MonthlyPass",
            },
        }],
        
        // Trip status
        status: {
            type: String,
            enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
            default: "SCHEDULED",
        },
        
        // Real-time tracking
        currentLocation: {
            lat: Number,
            lng: Number,
            lastUpdated: Date,
        },
        driverLocation: {
            lat: Number,
            lng: Number,
            lastUpdated: Date,
        },
        
        // Trip events
        events: [{
            eventType: {
                type: String,
                enum: ["TRIP_STARTED", "TRIP_COMPLETED", "DRIVER_ASSIGNED", "VEHICLE_ASSIGNED", "PASSENGER_BOARDED", "PASSENGER_DROPPED"],
                required: true,
            },
            timestamp: {
                type: Date,
                default: Date.now,
            },
            description: String,
            location: String,
            employeeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        }],
        
        // Monthly pass integration
        monthlyPassEligible: {
            type: Boolean,
            default: true,
        },
        
        // Notifications
        notifications: {
            tripReminder: {
                type: Boolean,
                default: true,
            },
            delayAlerts: {
                type: Boolean,
                default: true,
            },
            cancellationAlerts: {
                type: Boolean,
                default: true,
            },
        },
        
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
tripSchema.index({ contractId: 1, tripDate: 1 });
tripSchema.index({ corporateId: 1, tripDate: 1 });
tripSchema.index({ routeId: 1, tripDate: 1 });
tripSchema.index({ status: 1 });
tripSchema.index({ "passengers.employeeId": 1 });

const Trip = mongoose.model("Trip", tripSchema);

export default Trip;
