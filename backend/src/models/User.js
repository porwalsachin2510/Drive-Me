import mongoose from "mongoose"
import bcrypt from "bcrypt"

const userSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ["COMMUTER", "CORPORATE", "B2C_PARTNER", "B2B_PARTNER", "B2B_PARTNER_DRIVER", "CORPORATE_DRIVER", "CORPORATE_EMPLOYEE", "B2C_PARTNER_DRIVER", "ADMIN"],
            required: true,
        },
        fullName: {
            type: String,
            required: true,
        },
        companyName: {
            type: String,
            default: null,
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: {
            type: String,
            default: null,
        },
        passwordSetupToken: {
            type: String,
            default: null,
        },
        passwordSetupTokenExpiry: {
            type: Date,
            default: null,
        },
        isPasswordSet: {
            type: Boolean,
            default: false,
        },
        country: {
            type: String,
            enum: ["UAE", "KW", "SA", "BH", "OM", "QA"],
            default: "UAE",
        },
        level: {
            type: String,
            enum: ["STANDARD", "PREMIUM", "VIP"],
            default: "STANDARD",
        },
        whatsappNumber: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["ACTIVE", "SUSPENDED", "PENDING"],
            default: "PENDING",
        },
        activatedAt: {
            type: Date,
            default: null,
        },
        suspendedAt: {
            type: Date,
            default: null,
        },
        activatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        suspendedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },

        nationality: {
            type: String,
            default: null,
        },
        // Corporate specific
        tradeLicense: {
            type: String,
            default: null,
        },
        companyAddress: {
            type: String,
            default: null,
        },
        website: {
            type: String,
            default: null,
        },

        companyLogo: String,
        contactPerson: {
            type: String,
            default: null,
        },
        contactEmail: {
            type: String,
            default: null,
        },
        contactPhone: {
            type: String,
            default: null,
        },
        // B2C Partner specific
        serviceType: {
            type: String,
            enum: ["individual", "smallfleet", null],
            default: null,
        },
        yearsOfExperience: {
            type: Number,
            default: null,
        },
        serviceDescription: {
            type: String,
            default: null,
        },
        // Legacy routeListings - kept for backward compatibility
        routeListings: [
            {
                fromLocation: String,
                toLocation: String,
                stops: [{ location: String, time: String }],
                inboundStart: String,
                routeStartDate: Date,
                oneWayPrice: Number,
                roundTripPrice: Number,
                monthlyPrice: Number,
                totalSeats: { type: Number, get: (v) => Number(v) },
                availableSeats: { type: Number, get: (v) => Number(v) },
                availableDays: [String],
                driverName: String,
                nationality: String,
                licenseNumber: String,
                experience: Number,
                vehicleModel: String,
                vehiclePlate: String,
                driverImage: String,
                images: [String],
            },
        ],
        // B2B Partner specific
        fleetManagement: [
            {
                vehicleType: String,
                model: String,
                year: Number,
                seatingCapacity: Number,
                quantityAvailable: Number,
                images: [String],
            },
        ],

        // Driver specific fields for B2B_PARTNER_DRIVER and CORPORATE_DRIVER
        driverInfo: {
            licenseNumber: String,
            licenseExpiry: Date,
            licenseType: {
                type: String,
                enum: ["Light", "Medium", "Heavy", "Commercial"],
            },
            dateOfBirth: Date,
            nationality: String,
            address: {
                street: String,
                city: String,
                country: String,
            },
            experience: {
                years: Number,
                description: String,
            },
            documents: {
                license: String,
                passport: String,
                visa: String,
                medicalCertificate: String,
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
            status: {
                type: String,
                enum: ["AVAILABLE", "ASSIGNED", "INACTIVE"],
                default: "AVAILABLE",
            },
        },
        // Reference to fleet owner or corporate owner
        employedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        // B2C Partner reference for B2C_PARTNER_DRIVER
        b2cPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: "driverModel",
            default: null,
        },
        // Specify which driver model to reference
        driverModel: {
            type: String,
            enum: ["Driver", "CorporateDriver", "B2CPartnerDriver"],
            required: function () {
                return [
                    "B2B_PARTNER_DRIVER",
                    "CORPORATE_DRIVER",
                    "B2C_PARTNER_DRIVER"
                ].includes(this.role);
            },
        },
        acceptedPaymentMethods: {
            type: [String],
            default: [],
        },
        notifications: {
            emailNotifications: {
                type: Boolean,
                default: true,
            },
            smsNotifications: {
                type: Boolean,
                default: true,
            },
            bookingAlerts: {
                type: Boolean,
                default: true,
            },
            paymentAlerts: {
                type: Boolean,
                default: true,
            }
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

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next()

    try {
        const salt = await bcrypt.genSalt(10)
        this.password = await bcrypt.hash(this.password, salt)
        next()
    } catch (error) {
        next(error)
    }
})

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password)
}

// Remove password from response
userSchema.methods.toJSON = function () {
    const obj = this.toObject()
    delete obj.password
    return obj
}

const User = mongoose.model("User", userSchema)
export default User
