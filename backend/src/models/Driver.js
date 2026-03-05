import mongoose from "mongoose"

const driverSchema = new mongoose.Schema(
    {
        fleetOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
        },
        phone: {
            type: String,
            required: true,
        },
        licenseNumber: {
            type: String,
            required: true,
            unique: true,
        },
        licenseExpiry: {
            type: Date,
            required: true,
        },
        licenseType: {
            type: String,
            enum: ["Light", "Medium", "Heavy", "Commercial"],
            required: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
        },
        nationality: {
            type: String,
            required: true,
        },
        address: {
            street: String,
            city: String,
            country: String,
        },
        status: {
            type: String,
            enum: ["AVAILABLE", "ASSIGNED", "INACTIVE"],
            default: "AVAILABLE",
        },
        experience: {
            years: {
                type: Number,
                required: true,
            },
            description: String,
        },
        documents: {
            license: {
                type: String,
                default: null,
            },
            passport: {
                type: String,
                default: null,
            },
            visa: {
                type: String,
                default: null,
            },
            medicalCertificate: {
                type: String,
                default: null,
            },
        },
        ratings: {
            average: {
                type: Number,
                default: 0,
                min: 0,
                max: 5,
            },
            count: {
                type: Number,
                default: 0,
            },
        },
    },
    { timestamps: true },
)

export default mongoose.model("Driver", driverSchema)
