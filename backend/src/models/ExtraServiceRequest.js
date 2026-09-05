import mongoose from "mongoose"

/**
 * ExtraServiceRequest
 * -------------------
 * A School Customer (SCHOOL_CUSTOMER) holds a MANAGED contract with a School
 * Partner (SCHOOL_PARTNER) that typically runs on regular school days
 * (Mon–Fri / Mon–Sat). When the school needs the partner's vehicle(s) on an
 * EXTRA day outside the normal contract schedule (e.g. a Sunday picnic or a
 * special event), the customer raises an ExtraServiceRequest against the
 * contract.
 *
 * Flow:
 *   1. Customer creates a PENDING request (dates, vehicles, purpose).
 *   2. Partner reviews and either APPROVES (with a charge + billing mode) or
 *      REJECTS it.
 *   3. On approval the charge is billed either as a SEPARATE one-off invoice or
 *      ADDED_TO_CONTRACT (folded into the contract's financials). The resulting
 *      invoice id is stored on the request for auditing.
 *
 * This mirrors real-world ad-hoc trip requests layered on top of a running
 * managed transportation contract.
 */
const extraServiceRequestSchema = new mongoose.Schema(
    {
        // The managed contract this extra service is layered on top of.
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
            index: true,
        },
        contractNumber: String,

        // The school customer who owns the contract and is requesting the extra day.
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        customerName: String,

        // The school partner (fleet owner) who fulfils and prices the request.
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        partnerName: String,

        // Human readable purpose e.g. "Grade 5 picnic to Al Ain Zoo".
        purpose: {
            type: String,
            required: true,
            trim: true,
        },

        // One or more extra service dates being requested.
        serviceDates: {
            type: [Date],
            required: true,
            validate: {
                validator: (v) => Array.isArray(v) && v.length > 0,
                message: "At least one service date is required.",
            },
        },

        // How many of the contract's vehicles are needed for the extra day(s).
        vehiclesRequired: {
            type: Number,
            default: 1,
            min: 1,
        },

        // Optional trip details supplied by the school.
        pickupLocation: String,
        dropoffLocation: String,
        departureTime: String,
        expectedReturnTime: String,
        passengerCount: Number,
        notes: String,

        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
            default: "PENDING",
            index: true,
        },

        // ---- Partner decision / pricing (set on approval) ----
        // Total charge (contract currency) the partner is billing for the extra service.
        charge: {
            type: Number,
            default: 0,
            min: 0,
        },
        currency: {
            type: String,
            enum: ["KWD", "AED", "SAR", "QAR", "BHD", "OMR", "USD", "EUR"],
            default: "AED",
        },
        // How the approved charge is collected:
        //  - SEPARATE:          standalone one-off invoice paid on its own.
        //  - ADD_TO_CONTRACT:   folded into the contract's financials (added to
        //                       total + remaining) and billed with the contract.
        billingMode: {
            type: String,
            enum: ["SEPARATE", "ADD_TO_CONTRACT", null],
            default: null,
        },
        partnerResponseNote: String,
        respondedAt: Date,

        // ---- Operational fulfilment (set after approval) ----
        // Once approved, the partner assigns one of the contract's vehicles +
        // a driver for each requested date. Each assignment spawns a real Trip
        // the driver sees on the service date, so the fleet actually shows up
        // for the picnic/event.
        fulfillmentStatus: {
            type: String,
            enum: ["NOT_REQUIRED", "UNASSIGNED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"],
            default: "NOT_REQUIRED",
            index: true,
        },
        assignments: [
            {
                serviceDate: { type: Date, required: true },
                vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
                vehicleLabel: String,
                driverId: { type: mongoose.Schema.Types.ObjectId },
                driverModel: { type: String, enum: ["Driver", "CorporateDriver"] },
                driverName: String,
                driverPhone: String,
                tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
                status: {
                    type: String,
                    enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
                    default: "SCHEDULED",
                },
                assignedAt: { type: Date, default: Date.now },
            },
        ],

        // The invoice generated for an approved request (SEPARATE mode) or the
        // contract-linked operational invoice (ADD_TO_CONTRACT mode).
        invoiceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Invoice",
            default: null,
        },

        // Payment tracking for the extra-day charge.
        //  - NOT_APPLICABLE: nothing to collect here (ADD_TO_CONTRACT, or unpriced).
        //  - PENDING:        approved SEPARATE charge awaiting the customer to pay.
        //  - PROCESSING:     the customer started a payment. For CARD/WALLET this
        //                    means a gateway checkout is in flight; for CASH/BANK
        //                    it means the customer submitted and the partner still
        //                    has to confirm they received the money.
        //  - PAID:           settled — partner credited + invoice marked PAID.
        paymentStatus: {
            type: String,
            enum: ["NOT_APPLICABLE", "PENDING", "PROCESSING", "PAID"],
            default: "NOT_APPLICABLE",
            index: true,
        },
        paidAt: Date,
        transactionId: String,

        // ---- Payment method + gateway tracking (set when a payment starts) ----
        // How the customer chose to pay: CARD | WALLET | BANK_TRANSFER | CASH.
        paymentMethod: {
            type: String,
            enum: ["CARD", "WALLET", "BANK_TRANSFER", "CASH", null],
            default: null,
        },
        // STRIPE | TAP for online payments, MANUAL for cash/bank transfer.
        paymentProvider: {
            type: String,
            enum: ["STRIPE", "TAP", "MANUAL", null],
            default: null,
        },
        // The in-flight gateway checkout session/charge id, so the callback +
        // webhook can resolve this request back from the gateway event.
        gatewaySessionId: {
            type: String,
            default: null,
            index: true,
        },
        // Human-readable reference for cash/bank submissions and receipts.
        paymentReference: {
            type: String,
            default: null,
        },
        // When the customer initiated the (still unsettled) payment.
        paymentSubmittedAt: Date,

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
)

extraServiceRequestSchema.index({ contractId: 1, status: 1 })

const ExtraServiceRequest = mongoose.model("ExtraServiceRequest", extraServiceRequestSchema)

export default ExtraServiceRequest
