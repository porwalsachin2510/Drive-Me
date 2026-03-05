import mongoose from "mongoose";

const vehicleAssignmentSchema = new mongoose.Schema(
    {
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
        },
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
        },
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        fleetOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        assignmentDetails: {
            withDriver: {
                type: Boolean,
                default: false,
            },
            withFuel: {
                type: Boolean,
                default: false,
            },
            fuelType: {
                type: String,
                enum: ["PETROL", "DIESEL", "ELECTRIC", "HYBRID"],
                default: null,
            },
            fuelLevel: {
                type: String,
                enum: ["FULL", "HALF", "QUARTER"],
                default: "FULL",
            },
            withInsurance: {
                type: Boolean,
                default: false,
            },
            insuranceDetails: {
                provider: String,
                policyNumber: String,
                expiryDate: Date,
                coverage: String,
            },
            withMaintenance: {
                type: Boolean,
                default: false,
            },
            maintenancePackage: String,
        },
        assignmentDate: {
            type: Date,
            default: Date.now,
        },
        returnDate: Date,
        status: {
            type: String,
            enum: ["ASSIGNED", "IN_USE", "RETURNED", "DAMAGED", "UNDER_MAINTENANCE"],
            default: "ASSIGNED",
        },
        odometer: {
            startReading: {
                type: Number,
                default: 0,
            },
            endReading: Number,
            totalDistance: Number,
        },
        fuelConsumption: {
            startLevel: Number,
            endLevel: Number,
            totalConsumed: Number,
            refuelRecords: [
                {
                    date: Date,
                    amount: Number,
                    cost: Number,
                    station: String,
                    receiptUrl: String,
                },
            ],
        },
        damageReport: [
            {
                reportedAt: Date,
                reportedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                description: String,
                severity: {
                    type: String,
                    enum: ["MINOR", "MODERATE", "MAJOR"],
                },
                photos: [String],
                repairCost: Number,
                repairStatus: {
                    type: String,
                    enum: ["PENDING", "IN_PROGRESS", "COMPLETED"],
                },
            },
        ],
        notes: [
            {
                message: String,
                createdBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    {
        timestamps: true,
    },
)

const VehicleAssignment = mongoose.model("VehicleAssignment", vehicleAssignmentSchema)

export default VehicleAssignment
