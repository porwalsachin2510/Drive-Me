import mongoose from "mongoose"

const b2cPassengerBookingSchema = new mongoose.Schema(
    {
        passengerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        b2cPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerRoute",
            required: false, // For B2C partner routes
        },
        routeListingId: {
            type: String,
            required: false, // For embedded route listings
        },
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true, // The B2C partner who owns the route
        },
        // Booking Details
        bookingType: {
            type: String,
            enum: ["ONE_WAY", "ROUND_TRIP"],
            required: true,
            default: "ONE_WAY"
        },
        linkedSchedule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerSchedule",
            required: false
        },
        linkedTrip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerTrip",
            required: false
        },
        linkedReturnTrip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerTrip",
            required: false
        },
        pickupLocation: {
            type: String,
            required: true,
        },
        dropoffLocation: {
            type: String,
            required: true,
        },
        returnPickupLocation: {
            type: String,
            required: false,
        },
        returnDropoffLocation: {
            type: String,
            required: false,
        },


        // Outbound Trip Driver/Vehicle Assignment (captured at booking time)
        outboundDriverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        outboundVehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerVehicle",
            default: null,
        },
        outboundIsSelfDriver: {
            type: Boolean,
            default: false,
        },
        outboundTripTime: {
            type: String,
            default: null,
        },
        // Outbound Trip Status (separate from bookingStatus for ROUND_TRIP tracking)
        outboundTripStatus: {
            type: String,
            enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
            default: "SCHEDULED",
        },

        // Return Trip Driver/Vehicle Assignment (captured at booking time)
        returnDriverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        returnVehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerVehicle",
            default: null,
        },
        returnIsSelfDriver: {
            type: Boolean,
            default: false,
        },
        returnTripTime: {
            type: String,
            default: null,
        },

        // Denormalized return-leg driver display info (captured at booking time so the
        // commuter "Track Driver" / My Rides views can show the aane-leg driver directly).
        returnDriverName: {
            type: String,
            default: null,
        },
        returnDriverImage: {
            type: String,
            default: null,
        },
        returnDriverPhoneNumber: {
            type: String,
            default: null,
        },
        
        // Return Trip Status (separate from bookingStatus for ROUND_TRIP tracking)
        returnTripStatus: {
            type: String,
            enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
            default: "SCHEDULED",
        },

        travelPath: [
            {
                location: String,
                time: String,
                isFromLocation: Boolean,
                isToLocation: Boolean,
                isStop: Boolean,
            },
        ],
        returnTravelPath: [
            {
                location: String,
                time: String,
                isFromLocation: Boolean,
                isToLocation: Boolean,
                isStop: Boolean,
            },
        ],
        bookingDate: {
            type: Date,
            required: true, // Date when booking was made
        },
        travelDate: {
            type: Date,
            required: true, // Date of actual travel
        },
        numberOfSeats: {
            type: Number,
            default: 1,
            min: 1,
        },
        // Monthly Pass Specific Fields
        isMonthlyPass: {
            type: Boolean,
            default: false,
        },
        monthlyPassId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CMonthlyPass",
            required: false,
        },
        passDuration: {
            type: Number, // Duration in months
            required: false,
        },
        passStartDate: {
            type: Date,
            required: false,
        },
        passEndDate: {
            type: Date,
            required: false,
        },
        // Payment Details
        paymentAmount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: "KWD",
            enum: ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"],
        },
        paymentMethod: {
            type: String,
            enum: ["STRIPE", "TAP", "CARD", "CASH", "WALLET"],
            required: true,
        },
        paymentStatus: {
            type: String,
            enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
            default: "PENDING",
        },
        transactionId: {
            type: String,
            sparse: true,
        },
        // Status
        bookingStatus: {
            type: String,
            enum: ["PENDING", "CONFIRMED", "ACCEPTED", "IN_PROGRESS", "REJECTED", "CANCELLED", "COMPLETED"],
            default: "PENDING",
        },
        assignedDriverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        isSelfDriver: {
            type: Boolean,
            default: false,
        },
        driverPhoneNumber: {
            type: String,
            required: false,
        },
        // Driver/Vehicle Info
        vehicleModel: String,
        vehiclePlate: String,
        driverName: String,
        driverImage: String,
        driverPhoneNumber: String,
        driverRating: Number,
        // Admin Commission (dynamic rate from CommissionSettings)
        adminCommissionAmount: {
            type: Number,
            default: 0,
        },
        // Applied commission rate (percentage)
        appliedCommissionRate: {
            type: Number,
            default: 20,
            min: 0,
            max: 100,
        },
        driverEarnings: {
            type: Number,
            default: 0,
        },
        // Additional Info
        passengerNotes: String,
        rejectionReason: String,
        cancelledAt: Date,
        cancelledBy: String, // "PASSENGER", "DRIVER", "ADMIN", "SYSTEM"
        completedAt: Date,
        startedAt: Date, // When the trip actually started
        acceptedAt: Date, // When admin/partner accepted the booking
        acceptedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        rejectedAt: Date, // When booking was rejected
        refundStatus: {
            type: String,
            enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", null],
            default: null
        },
        refundReason: String,
        refundAmount: {
            type: Number,
            default: 0
        },
        cancellationFee: {
            type: Number,
            default: 0
        },
        cancellationTierLabel: {
            type: String,
            default: null
        },
        // ===== CASH cancellation due (commuter paid nothing, now OWES a fee) =====
        // Recorded when a CASH booking is cancelled past the free window. The
        // durable record lives in CancellationLedger; these mirror it on the booking.
        cashCancellationDueAmount: {
            type: Number,
            default: 0
        },
        cashCancellationDueStatus: {
            type: String,
            enum: ["NONE", "OUTSTANDING", "SETTLED", "WAIVED", null],
            default: "NONE"
        },
        // The cash cancellation fee is deducted from the commuter's wallet immediately
        // (their balance may go negative). The admin is only paid this fee once the
        // commuter tops up and their wallet returns to >= 0. This flag tracks whether
        // the admin has already been credited for THIS booking's due, so a later
        // top-up never double-pays the admin.
        cashCancellationAdminSettled: {
            type: Boolean,
            default: false
        },
        // Commission Refund Fields (for CASH bookings cancelled by commuter)
        commissionRefunded: {
            type: Boolean,
            default: false
        },
        commissionRefundAmount: {
            type: Number,
            default: 0
        },
        commissionRefundedAt: {
            type: Date,
            default: null
        },
        // ===== Pro-rata cancellation tracking (monthly passes / multi-trip bookings) =====
        refundMethod: {
            type: String,
            enum: ["WALLET", "CASH_FROM_PARTNER", "NONE", null],
            default: null
        },
        // For CASH bookings: amount the partner owes back to the commuter for unused trips
        cashRefundDueFromPartner: {
            type: Number,
            default: 0
        },
        cashRefundSettled: {
            type: Boolean,
            default: false
        },
        // For CASH bookings: partner collected the cancellation fee in cash and settled it to admin via wallet
        cashCancellationFeePaidByPartner: {
            type: Boolean,
            default: false
        },
        cashCancellationFeeAmount: {
            type: Number,
            default: 0
        },
        usedTripsCount: {
            type: Number,
            default: 0
        },
        remainingTripsCount: {
            type: Number,
            default: 0
        },
        // Admin action log
        adminActions: [{
            action: String,
            reason: String,
            processedAt: Date,
            processedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        }],

        // Late Trip Tracking
        isLateStart: {
            type: Boolean,
            default: false,
        },
        lateByMinutes: {
            type: Number,
            default: 0,
        },
        tripStartedBy: {
            type: String, // B2C_PARTNER, B2C_PARTNER_DRIVER
            default: null,
        },

        // Booking Timeout Fields - for auto-cancellation feature
        acceptanceDeadline: {
            type: Date, // 24 hours after booking creation
            default: null,
        },
        warningDeadline: {
            type: Date, // 20 hours after booking creation (4 hours before cancellation)
            default: null,
        },
        warningSentAt: {
            type: Date, // When warning was sent to B2C_PARTNER
            default: null,
        },
        warningEmailSent: {
            type: Boolean,
            default: false,
        },
        warningNotificationSent: {
            type: Boolean,
            default: false,
        },
        autoCancelledAt: {
            type: Date, // When booking was auto-cancelled
            default: null,
        },
        autoCancelReason: {
            type: String,
            default: null,
        },

        rating: Number, // Passenger rating for this ride
        review: String,
        // Monthly Pass Specific Fields
        isMonthlyPass: {
            type: Boolean,
            default: false,
        },
        monthlyPassId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CMonthlyPass",
            required: false,
        },
        passDuration: {
            type: Number,
            required: false, // Duration in months
        },
        passStartDate: {
            type: Date,
            required: false,
        },
        passEndDate: {
            type: Date,
            required: false,
        },
        parentMonthlyPassBooking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPassengerBooking",
            required: false, // Reference to main monthly pass booking
        },
        monthlyTrips: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerTrip",
        }], // Array of all monthly trip IDs (B2CPartnerTrip references)
        tripRatings: [{
            tripId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "B2CPartnerTrip"
            },
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            feedback: String,
            ratedAt: Date
        }], // Ratings given by passenger for trips in this booking
        isReturnTrip: {
            type: Boolean,
            default: false,
        },
        travelTime: {
            type: String,
            required: false, // Time of travel for monthly trips
        },
        // Monthly Pass Management Fields
        totalTripsCount: {
            type: Number,
            required: false, // Total number of trips in this monthly pass
        },
        createdTripsCount: {
            type: Number,
            required: false, // Number of new trips created during this booking
        },
        existingTripsCount: {
            type: Number,
            required: false, // Number of existing trips found during this booking
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
    { timestamps: true },
)

b2cPassengerBookingSchema.index({ passengerId: 1, travelDate: 1 })
b2cPassengerBookingSchema.index({ b2cPartnerId: 1, bookingStatus: 1 })
b2cPassengerBookingSchema.index({ partnerId: 1, bookingStatus: 1 })
b2cPassengerBookingSchema.index({ travelDate: 1 })

export default mongoose.model("B2CPassengerBooking", b2cPassengerBookingSchema)
