import mongoose from "mongoose"

const routeSchema = new mongoose.Schema(
    {
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
        },
        assignedVehicleId: {
            type: String,
            required: true,
        },
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null,
        },
        fromLocation: {
            type: String,
            required: true,
        },
        toLocation: {
            type: String,
            required: true,
        },
        routeStartDate: {
            type: Date,
            required: true,
        },
        stopPoints: [
            {
                location: String,
                time: String,
                _id: {
                    type: mongoose.Schema.Types.ObjectId,
                    auto: true,
                },
            },
        ],
        totalDistance: {
            type: Number,
            default: null,
        },
        estimatedDuration: {
            type: String,
            default: null,
        },
        availableDays: {
            type: [String],
            enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            required: true,
        },
        routeNotes: {
            type: String,
            default: null,
        },
        totalSeats: {
            type: Number,
            required: true,
            default: 0,
        },
        availableSeats: {
            type: Number,
            required: true,
            default: 0,
        },
        pricePerSeat: {
            type: Number,
            default: 0,
        },
        currency: {
            type: String,
            enum: ["KWD", "AED", "SAR", "QAR", "BHD", "OMR", "USD", "EUR"],
            default: "AED",
        },
        routeType: {
            type: String,
            enum: ["CORPORATE", "B2C"],
            default: "CORPORATE",
        },
        corporateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        b2cPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "COMPLETED"],
            default: "ACTIVE",
        },
        assignedDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
        // Tags for route categorization and search filtering
        tags: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tag"
        }],
    },
    {
        timestamps: true,
    },
)

const Route = mongoose.model("Route", routeSchema)

export default Route
