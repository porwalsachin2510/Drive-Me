import mongoose from "mongoose"

const adminNegotiationSchema = new mongoose.Schema(
    {
        negotiationNumber: {
            type: String,
            unique: true,
        },
        quotationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quotation",
            required: true,
        },
        corporateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        b2bPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // Price tracking
        originalPrice: {
            type: Number,
            required: true,
        },
        negotiatedPrice: {
            type: Number,
            default: null,
        },
        priceSaved: {
            type: Number,
            default: 0,
        },
        currency: {
            type: String,
            enum: ["KWD", "AED", "SAR", "QAR", "BHD", "OMR", "USD", "EUR"],
            default: "AED",
        },
        // Admin commission from Corporate for negotiation service
        adminCommissionFromCorporate: {
            rate: {
                type: Number,
                min: 0,
                max: 35,
                default: 25, // Default 25% of savings
            },
            amount: {
                type: Number,
                default: 0,
            },
            status: {
                type: String,
                enum: ["PENDING", "PAID", "WAIVED"],
                default: "PENDING",
            },
            paidAt: Date,
            transactionId: String,
        },
        // Negotiation status
        status: {
            type: String,
            enum: ["REQUESTED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"],
            default: "REQUESTED",
        },
        // Corporate's initial request
        corporateRequest: {
            requestedAt: {
                type: Date,
                default: Date.now,
            },
            message: String,
            expectedPrice: Number, // What Corporate hopes to pay
        },
        // Admin's actions during negotiation
        adminActions: [
            {
                action: {
                    type: String,
                    enum: ["STARTED", "SENT_OFFER", "SENT_MESSAGE", "COMPLETED", "CANCELLED"],
                },
                message: String,
                proposedPrice: Number,
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                adminId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
            },
        ],
        // B2B Partner's responses
        b2bPartnerResponses: [
            {
                response: {
                    type: String,
                    enum: ["ACCEPTED", "REJECTED", "COUNTER_OFFERED"],
                },
                counterPrice: Number,
                message: String,
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        // Final outcome
        completedAt: Date,
        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        failureReason: String,
        cancelledAt: Date,
        cancelledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        cancellationReason: String,
        // Notes and communication
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
                isInternal: {
                    type: Boolean,
                    default: false,
                }, // Internal admin notes
            },
        ],
    },
    {
        timestamps: true,
    }
)

// Auto-generate negotiation number
adminNegotiationSchema.pre("save", async function (next) {
    if (!this.negotiationNumber) {
        const count = await mongoose.model("AdminNegotiation").countDocuments()
        this.negotiationNumber = `NEG${Date.now()}${String(count + 1).padStart(4, "0")}`
    }
    next()
})

// Calculate commission when price is saved
adminNegotiationSchema.methods.calculateSavingsCommission = function () {
    if (this.originalPrice && this.negotiatedPrice && this.negotiatedPrice < this.originalPrice) {
        this.priceSaved = this.originalPrice - this.negotiatedPrice
        this.adminCommissionFromCorporate.amount =
            (this.priceSaved * this.adminCommissionFromCorporate.rate) / 100
    }
    return this
}

const AdminNegotiation = mongoose.model("AdminNegotiation", adminNegotiationSchema)

export default AdminNegotiation
