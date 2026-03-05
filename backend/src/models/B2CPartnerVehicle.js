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
