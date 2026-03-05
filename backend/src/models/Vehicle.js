import mongoose from "mongoose"

const vehicleSchema = new mongoose.Schema(
    {
        fleetOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        vehicleName: {
            type: String,
            required: true,
        },
        registrationNumber: {
            type: String,
            required: true,
            unique: true,
        },
        manufacturingYear: {
            type: Number,
            required: true,
        },
        vehicleCategory: {
            type: String,
            enum: [
                "SEDAN",
                "SUV",
                "MINIVAN",
                "COASTER_BUS",
                "LUXURY_COACH",
                "SHUTTLE_BUS",
                "PICKUP_1TON",
                "PICKUP_3TON",
                "TRUCK_7TON",
                "REEFER_TRUCK",
                "FLATBED_TRAILER",
                "EXECUTIVE_VAN",
                "ANY_TYPE",
            ],
            required: true,
        },
        serviceType: {
            type: String,
            enum: ["PASSENGER", "GOODS_CARRIER", "MANAGED_SERVICES"],
            required: true,
        },
        capacity: {
            seatingCapacity: Number,
            cargoCapacity: Number, // in tons
        },

        location: {
            type: String,
            required: true,
        },
        driverAvailability: {
            withDriver: {
                type: Boolean,
                default: false,
            },
            withoutDriver: {
                type: Boolean,
                default: false,
            },
        },
        fuelOptions: {
            fuelIncluded: {
                type: Boolean,
                default: false,
            },
            withoutFuel: {
                type: Boolean,
                default: false,
            },
        },
        facilities: {
            airConditioning: {
                type: Boolean,
                default: false,
            },
            wifiOnboard: {
                type: Boolean,
                default: false,
            },
            wheelchairAccess: {
                type: Boolean,
                default: false,
            },
            gpsTracking: {
                type: Boolean,
                default: false,
            },
            musicSystem: {
                type: Boolean,
                default: false,
            },
            entertainmentScreen: {
                type: Boolean,
                default: false,
            },
            refrigeration: {
                type: Boolean,
                default: false,
            },
        },
        pricing: {

            currency: {
                type: String,
                enum: ["KWD", "AED", "SAR", "QAR", "BHD", "OMR", "USD", "EUR"],
                required: true,
                default: "AED",
            },
            
            dailyRate: {
                type: Number,
                required: true,
            },
            weeklyRate: {
                type: Number,
                required: true,
            },
            monthlyRate: {
                type: Number,
                required: true,
            },
            perKmCharge: {
                type: Number,
                required: true,
            },
            driverCharges: {
                type: Number,
                default: 0,
            },
            fuelCharges: {
                type: Number,
                default: 0,
            },
            additionalCharges: {
                overtime: Number,
                waitingTime: Number,
            },
        },
        // NEW: Per KM Usage Settings
        kmLimits: {
            dailyLimit: {
                type: Number,
                default: 0, // KM per day
            },
            weeklyLimit: {
                type: Number,
                default: 0, // KM per week
            },
            monthlyLimit: {
                type: Number,
                default: 2000, // KM per month (default)
            },
        },
        availability: {
            availableDays: [
                {
                    type: String,
                    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                },
            ],
            availableTimeSlots: [
                {
                    startTime: String,
                    endTime: String,
                },
            ],
            blackoutDates: [Date],
            minimumBookingDuration: {
                type: Number,
                default: 1, // days
            },
        },
        photos: [
            {
                url: String,
                publicId: String,
            },
        ],
        documents: [
            {
                documentType: {
                    type: String,
                    enum: ["RC_COPY", "INSURANCE", "FITNESS_CERTIFICATE", "POLLUTION_CERTIFICATE", "DRIVER_LICENSE"],
                },
                documentUrl: String,
                publicId: String,
            },
        ],
        status: {
            type: String,
            enum: ["AVAILABLE", "BOOKED", "MAINTENANCE", "INACTIVE"],
            default: "AVAILABLE",
        },
        approvalStatus: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING",
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        rejectionReason: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        rating: {
            type: Number,
            default: 0,
        },
        totalReviews: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    },
)

// Index for search optimization
vehicleSchema.index({ fleetOwnerId: 1, serviceType: 1, vehicleCategory: 1, status: 1 })

const Vehicle = mongoose.model("Vehicle", vehicleSchema)

export default Vehicle
