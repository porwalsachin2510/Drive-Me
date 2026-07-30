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
        // Optional: when a corporate submits ONE multi-partner request (a cart
        // that spans several fleet owners), each partner gets its own quotation
        // but they are all linked back to a single QuotationRequestGroup so the
        // corporate can see and manage them together. Null for legacy single-
        // partner requests.
        requestGroupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "QuotationRequestGroup",
            default: null,
        },
        requestGroupNumber: {
            type: String,
            default: null,
        },
        // Service mode: STANDARD = corporate runs operations itself (passenger/goods),
        // MANAGED = corporate selected "Managed Services" and the B2B partner runs
        // all operations (routes, schedules, employees, trips, invitations) on their behalf.
        serviceMode: {
            type: String,
            enum: ["STANDARD", "MANAGED"],
            default: "STANDARD",
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
            // B2B partner's management/service charge for MANAGED quotations.
            // Lump-sum fee (can be 0 or any amount) added on top of the vehicle totals.
            serviceCharge: {
                type: Number,
                default: 0,
            },
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
                    // `quantity` = the number the partner is actually OFFERING to
                    // supply now (may be less than what the corporate requested).
                    quantity: Number,
                    // What the corporate originally asked for, kept for reference so
                    // the corporate can clearly see "offered X of requested Y".
                    requestedQuantity: Number,
                    baseRental: Number,
                    driverCharges: Number,
                    fuelCharges: Number,
                    totalAmount: Number,
                },
            ],
        },

        // Availability-aware fulfilment. A B2B partner may not have enough
        // vehicles to cover the whole request, so they can quote a PARTIAL
        // offer (fewer vehicles now) and optionally promise more later. The
        // corporate then decides whether to accept the partial offer or reject.
        fulfillment: {
            type: {
                type: String,
                enum: ["FULL", "PARTIAL"],
                default: "FULL",
            },
            totalRequestedVehicles: {
                type: Number,
                default: 0,
            },
            totalOfferedVehicles: {
                type: Number,
                default: 0,
            },
            // Partner indicates more vehicles are expected in the future.
            hasFutureAvailability: {
                type: Boolean,
                default: false,
            },
            futureAvailabilityNote: {
                type: String,
                default: "",
            },
            futureAvailabilityDate: {
                type: Date,
                default: null,
            },
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

        // Admin Negotiation fields
        adminNegotiation: {
            requested: {
                type: Boolean,
                default: false,
            },
            negotiationId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "AdminNegotiation",
                default: null,
            },
            status: {
                type: String,
                enum: ["NONE", "REQUESTED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"],
                default: "NONE",
            },
            // Store original price before negotiation
            originalPrice: {
                type: Number,
                default: null,
            },
            // Flag indicating price was reduced via negotiation
            priceReduced: {
                type: Boolean,
                default: false,
            },
            // Amount saved via negotiation
            savingsAmount: {
                type: Number,
                default: 0,
            },
            // Admin commission from corporate for negotiation service
            adminCommission: {
                type: Number,
                default: 0,
            },
            // Admin commission rate (percentage of savings)
            adminCommissionRate: {
                type: Number,
                default: 25,
            },
        },
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
