import mongoose from "mongoose";

const b2cPartnerVehicleSchema = new mongoose.Schema(
    {
        b2cPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        vehicleType: {
            type: String,
            enum: [
                "Sedan",
                "SUV", 
                "Van",
                "Minibus",
                "Bus",
                "Pickup Truck",
                "Other"
            ],
            required: true,
        },
        model: {
            type: String,
            required: true,
        },
        year: {
            type: Number,
            required: true,
        },
        seatingCapacity: {
            type: Number,
            required: true,
            min: 1,
            max: 50,
        },
        licensePlate: {
            type: String,
            required: true,
            unique: true,
        },
        vehicleColor: {
            type: String,
            default: "",
        },
        insuranceExpiry: {
            type: Date,
        },
        registrationExpiry: {
            type: Date,
        },
        features: [{
            type: String,
        }],
        images: [{
            url: String,
            publicId: String,
        }],
        status: {
            type: String,
            enum: ["Active", "Maintenance", "Inactive"],
            default: "Active",
        },
        // Availability status for scheduling (available/busy)
        availabilityStatus: {
            type: String,
            enum: ["available", "busy"],
            default: "available",
        },
        // Track which schedules/trip times this vehicle is assigned to
        assignedSchedules: [{
            scheduleId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "B2CPartnerSchedule"
            },
            tripTimeIndex: Number,
            assignedAt: {
                type: Date,
                default: Date.now
            }
        }],
        lastAvailabilityUpdate: {
            type: Date,
            default: Date.now
        },
        // Availability window - when vehicle is available until (for between-trips availability)
        availableUntil: {
            type: Date,
            default: null
        },
        nextScheduledTripTime: {
            type: String,
            default: null
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        assignedDrivers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerDriver",
        }],
        assignedRoutes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerRoute",
        }],
        // Tags for vehicle categorization (vehicle, general category tags)
        tags: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tag"
        }],
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
b2cPartnerVehicleSchema.index({ b2cPartnerId: 1, status: 1 });
b2cPartnerVehicleSchema.index({ licensePlate: 1 });

// Virtual for full vehicle description
b2cPartnerVehicleSchema.virtual('fullDescription').get(function() {
    const year = this.year || 'Unknown';
    const model = this.model || 'Unknown';
    const licensePlate = this.licensePlate || 'N/A';
    return `${year} ${model} (${licensePlate})`;
});

const B2CPartnerVehicle = mongoose.model("B2CPartnerVehicle", b2cPartnerVehicleSchema);

export default B2CPartnerVehicle;
