import mongoose from "mongoose";

const b2cPartnerDriverSchema = new mongoose.Schema(
    {
        b2cPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            lowercase: true,
        },
        phoneNumber: {
            type: String,
            required: true,
        },
        licenseNumber: {
            type: String,
            required: true,
        },
        licenseExpiry: {
            type: Date,
            required: true,
        },
        nationality: {
            type: String,
            required: true,
        },
        experience: {
            type: Number,
            required: true,
            min: 0,
        },
        address: {
            type: String,
        },
        emergencyContact: {
            name: String,
            phone: String,
        },
        driverImage: {
            url: String,
            publicId: String,
        },
        assignedVehicles: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerVehicle",
        }],
        assignedRoutes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "B2CPartnerRoute",
        }],
        status: {
            type: String,
            enum: ["Active", "On Leave", "Inactive"],
            default: "Active",
        },
        // Driver availability for schedule assignment
        availabilityStatus: {
            type: String,
            enum: ["available", "busy", "offline"],
            default: "available",
        },
        // Track which schedules this driver is currently assigned to
        assignedSchedules: [{
            scheduleId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "B2CPartnerSchedule",
            },
            tripTimeIndex: Number, // Which trip time within the schedule
            assignedAt: {
                type: Date,
                default: Date.now,
            }
        }],
        // Driver can set their available time slots
        availableTimeSlots: [{
            day: {
                type: String,
                enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            },
            startTime: String, // "09:00 AM"
            endTime: String,   // "06:00 PM"
        }],
        // Last time driver updated their availability
        lastAvailabilityUpdate: {
            type: Date,
            default: Date.now,
        },
        // Availability window - when driver is available until (for between-trips availability)
        availableUntil: {
            type: Date,
            default: null,
        },
        nextScheduledTripTime: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
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
            history: [{
                rating: Number,
                date: Date,
                tripId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "B2CPartnerTrip"
                },
                feedback: String
            }]
        },
        documents: {
            license: String,
            passport: String,
            visa: String,
            medicalCertificate: String,
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
b2cPartnerDriverSchema.index({ b2cPartnerId: 1, status: 1 });
b2cPartnerDriverSchema.index({ licenseNumber: 1 });

// Virtual for full driver info
b2cPartnerDriverSchema.virtual('fullInfo').get(function() {
    const name = this.name || 'Unknown';
    const phoneNumber = this.phoneNumber || 'N/A';
    return `${name} (${phoneNumber})`;
});

const B2CPartnerDriver = mongoose.model("B2CPartnerDriver", b2cPartnerDriverSchema);

export default B2CPartnerDriver;
