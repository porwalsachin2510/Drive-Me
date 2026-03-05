import mongoose from "mongoose"

const quotationSchema = new mongoose.Schema(
    {
        quotationNumber: {
            type: String,
            unique: true,
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
        // Optional: Link to Requirement if quotation was submitted against one
        requirementId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Requirement",
            default: null,
        },
        vehicles: [
            {
                vehicleId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Vehicle",
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
            },
        ],
        
        rentalPeriod: {
            startDate: {
                type: Date,
                required: true,
            },
            endDate: {
                type: Date,
                required: true,
            },
            durationType: {
                type: String,
                enum: ["DAILY", "WEEKLY", "MONTHLY", "LONG_TERM"],
                required: true,
            },
            duration: Number, // in days/weeks/months
        },
        requirements: {
            withDriver: Boolean,
            fuelIncluded: Boolean,
        },
        
        // Fleet Owner Response
        quotedPrice: {
            currency: {
                type: String,
                enum: ["KWD", "AED", "SAR", "QAR", "BHD", "OMR", "USD", "EUR"],
                required: false, 
            },
            totalAmount: Number,
            breakdown: {
                vehicleRental: Number,
                driverCharges: Number,
                fuelCharges: Number,
            },
            perVehicleBreakdown: [
                {
                    vehicleId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Vehicle",
                    },
                    vehicleName: String,
                    quantity: Number,
                    baseRental: Number,
                    driverCharges: Number,
                    fuelCharges: Number,
                    totalAmount: Number,
                },
            ],
        },

        responseMessage: String, // Fleet owner's response message
        terms: String, // Terms and conditions from fleet owner

        corporateResponseMessage: String, // Corporate owner's response to the quote

        validUntil: Date,

        status: {
            type: String,
            enum: ["REQUESTED", "QUOTED", "NEGOTIATING", "ACCEPTED", "REJECTED", "EXPIRED"],
            default: "REQUESTED",
        },

        requestedAt: {
            type: Date,
            default: Date.now,
        },
        respondedAt: Date, // When fleet owner responded
        acceptedAt: Date, // When corporate owner accepted
        rejectedAt: Date, // When rejected (by either party)
    },
        
    {
        timestamps: true,
    },
)

// Auto-generate quotation number
quotationSchema.pre("save", async function (next) {
    if (!this.quotationNumber) {
        const count = await mongoose.model("Quotation").countDocuments()
        this.quotationNumber = `QT${Date.now()}${String(count + 1).padStart(4, "0")}`
    }
    next()
})

const Quotation = mongoose.model("Quotation", quotationSchema)

export default Quotation
