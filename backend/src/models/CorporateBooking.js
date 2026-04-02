import mongoose from "mongoose"

const corporateBookingSchema = new mongoose.Schema(
    {
        passengerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true, // Corporate employee
        },
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true, // Company owner
        },
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route",
            required: true,
        },
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
        },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        // Booking Details
        pickupLocation: {
            type: String,
            required: true,
        },
        dropoffLocation: {
            type: String,
            required: true,
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
        bookingDate: {
            type: Date,
            required: true,
        },
        travelDate: {
            type: Date,
            required: true,
        },
        numberOfSeats: {
            type: Number,
            default: 1,
            min: 1,
        },
        // Monthly Pass fields (similar to B2CPassengerBooking)
        bookingType: {
            type: String,
            enum: ["ONE_WAY", "ROUND_TRIP"],
            default: "ONE_WAY",
        },
        isMonthlyPass: {
            type: Boolean,
            default: false,
        },
        monthlyPassId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MonthlyPass",
        },
        passDuration: {
            type: Number,
            default: 1,
        },
        passStartDate: Date,
        passEndDate: Date,
        // Array of all trip IDs for this monthly pass
        monthlyTrips: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
        }],
        // Return trip info
        returnPickupLocation: String,
        returnDropoffLocation: String,
        returnTravelPath: [
            {
                location: String,
                time: String,
                isFromLocation: Boolean,
                isToLocation: Boolean,
                isStop: Boolean,
            },
        ],
        linkedSchedule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CorporateRouteSchedule",
        },
        linkedTrip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
        },
        linkedReturnTrip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
        },
        createdTripsCount: {
            type: Number,
            default: 0,
        },
        totalTripsCount: {
            type: Number,
            default: 0,
        },
        // Status
        bookingStatus: {
            type: String,
            enum: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
            default: "CONFIRMED",
        },
        // Driver/Vehicle Info
        vehicleModel: String,
        vehiclePlate: String,
        driverName: String,
        driverImage: String,
        driverPhoneNumber: String,
        driverRating: Number,
        // Additional Info
        passengerNotes: String,
        cancelledAt: Date,
        startedAt: Date,
        completedAt: Date,
        rating: Number,
        review: String,
        feedback: {
            rating: { type: Number, min: 1, max: 5 },
            comment: String,
            complaints: [String],
            ratedAt: Date,
        },
        cancellationReason: String,
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

corporateBookingSchema.index({ passengerId: 1, travelDate: 1 })
corporateBookingSchema.index({ corporateOwnerId: 1, bookingStatus: 1 })
corporateBookingSchema.index({ travelDate: 1 })

export default mongoose.model("CorporateBooking", corporateBookingSchema)
