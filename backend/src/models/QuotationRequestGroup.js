import mongoose from "mongoose"

/**
 * QuotationRequestGroup
 *
 * A lightweight parent that ties together several per-partner quotations that
 * a corporate submitted as ONE request. When a corporate builds a cart that
 * spans multiple B2B partners (and multiple vehicle types), we still create one
 * Quotation per partner (so each partner quotes, negotiates and contracts
 * independently) but stamp them all with the same requestGroupId. This lets the
 * corporate view and track the whole request as a single unit while keeping the
 * existing per-partner quotation/contract machinery unchanged.
 */
const quotationRequestGroupSchema = new mongoose.Schema(
    {
        requestGroupNumber: {
            type: String,
            unique: true,
        },
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // passenger | goods | managed (the service category chosen up front)
        serviceType: {
            type: String,
            default: "passenger",
        },
        // STANDARD = corporate runs ops, MANAGED = partner runs ops
        serviceMode: {
            type: String,
            enum: ["STANDARD", "MANAGED"],
            default: "STANDARD",
        },
        // Snapshot of the shared requirements the corporate searched with, so
        // the request can be shown/reproduced without re-deriving from children.
        requirementSnapshot: {
            rentalDurationType: { type: String, default: null },
            durationValue: { type: Number, default: null },
            startDate: { type: Date, default: null },
            endDate: { type: Date, default: null },
            location: { type: String, default: null },
            budgetRange: { type: String, default: null },
            driverRequired: { type: Boolean, default: false },
            fuelIncluded: { type: Boolean, default: false },
            vehicleTypes: [{ type: String }],
            features: [{ type: String }],
        },
        quotationIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Quotation",
            },
        ],
        partnerCount: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["OPEN", "PARTIALLY_ACCEPTED", "COMPLETED", "CANCELLED"],
            default: "OPEN",
        },
    },
    {
        timestamps: true,
    },
)

// Auto-generate a human-friendly request group number (mirrors Quotation).
quotationRequestGroupSchema.pre("save", async function (next) {
    if (!this.requestGroupNumber) {
        const count = await mongoose.model("QuotationRequestGroup").countDocuments()
        this.requestGroupNumber = `RQ${Date.now()}${String(count + 1).padStart(4, "0")}`
    }
    next()
})

const QuotationRequestGroup = mongoose.model(
    "QuotationRequestGroup",
    quotationRequestGroupSchema,
)

export default QuotationRequestGroup
