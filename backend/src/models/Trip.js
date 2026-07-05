import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
    {
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
        },
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route",
            required: true,
        },
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
        },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        corporateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        b2bPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        // Monthly pass reference
        monthlyPassId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MonthlyPass",
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
            default: 0,
        },
        estimatedDuration: {
            type: String,
            default: "",
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
            passengerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            employeeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "CorporateEmployee",
            },
            name: String,
            seatNumber: {
                type: Number,
            },
            pickupStop: String,
            dropoffStop: String,
            pickupPoint: {
                type: String,
            },
            pickupTime: {
                type: String,
            },
            status: {
                type: String,
                enum: ["Confirmed", "Cancelled", "NoShow", "CONFIRMED", "CANCELLED", "NO_SHOW"],
                default: "Confirmed",
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
            enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "Scheduled", "Confirmed", "InProgress", "Completed", "Cancelled"],
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
        // Rolling history of driver GPS pings for the current trip (managed live
        // tracking). Capped in the controller to the most recent points so the
        // document never grows unbounded.
        locationHistory: [{
            lat: Number,
            lng: Number,
            speed: Number,
            timestamp: {
                type: Date,
                default: Date.now,
            },
        }],
        // Live tracking meta used by the employee "Track my ride" screen.
        tracking: {
            isSharingLocation: {
                type: Boolean,
                default: false,
            },
            startedAt: Date,
            lastPingAt: Date,
            // Server-estimated minutes until the bus reaches the tracking
            // employee's pickup point (best-effort, Haversine based).
            etaMinutes: Number,
            distanceMeters: Number,
        },

        // Trip events
        events: [{
            eventType: {
                type: String,
                enum: ["TRIP_STARTED", "TRIP_COMPLETED", "DRIVER_ASSIGNED", "VEHICLE_ASSIGNED", "PASSENGER_BOARDED", "PASSENGER_DROPPED", "LATE_START"],
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
            isLate: {
                type: Boolean,
                default: false,
            },
            lateByMinutes: {
                type: Number,
                default: 0,
            },
        }],

        // Monthly pass integration
        monthlyPassEligible: {
            type: Boolean,
            default: true,
        },

        // Late start tracking
        isLateStart: {
            type: Boolean,
            default: false,
        },
        lateStartMinutes: {
            type: Number,
            default: 0,
        },
        actualStartTime: {
            type: Date,
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
        },

        // Stop points for the trip
        stopPoints: [{
            location: String,
            sequence: Number,
            scheduledTime: String,
            actualTime: String,
        }],

        // Notification tracking
        notificationsSent: {
            reminder30Min: { type: Boolean, default: false },
            reminder5Min: { type: Boolean, default: false },
            tripStarted: { type: Boolean, default: false },
            tripCompleted: { type: Boolean, default: false },
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
