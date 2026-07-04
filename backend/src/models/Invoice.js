import mongoose from "mongoose"

const lineItemSchema = new mongoose.Schema(
    {
        description: { type: String, required: true },
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
    },
    { _id: false }
)

const invoiceSchema = new mongoose.Schema(
    {
        // Human readable, unique invoice number e.g. B2B-INV-CNT123-ADV
        invoiceNumber: {
            type: String,
            unique: true,
            index: true,
        },
        // Idempotency key so we never create duplicate invoices for the same
        // contract + payment milestone. Format: `${contractId}:${type}:${installmentNumber}`
        sourceKey: {
            type: String,
            unique: true,
            index: true,
        },
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
            index: true,
        },
        contractNumber: String,

        // The B2B partner (fleet owner) who issues the invoice
        fleetOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        fleetOwnerName: String,

        // The corporate client who must pay the invoice
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        corporateName: String,

        // What this invoice is billing for
        type: {
            type: String,
            enum: ["ADVANCE", "FINAL", "INSTALLMENT", "SECURITY_DEPOSIT", "MONTHLY"],
            required: true,
        },
        installmentNumber: Number,

        billingPeriod: {
            start: Date,
            end: Date,
            label: String,
        },

        issueDate: {
            type: Date,
            default: Date.now,
        },
        dueDate: Date,

        lineItems: [lineItemSchema],
        subtotal: { type: Number, default: 0 },
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        currency: {
            type: String,
            enum: ["KWD", "AED", "SAR", "QAR", "BHD", "OMR", "USD", "EUR"],
            default: "AED",
        },

        status: {
            type: String,
            enum: ["DRAFT", "SENT", "PENDING", "PAID", "OVERDUE", "CANCELLED"],
            default: "DRAFT",
            index: true,
        },

        sentAt: Date,
        paidAt: Date,
        paymentMethod: String,
        transactionId: String,

        notes: String,

        // History of reminders sent to the corporate client
        reminders: [
            {
                sentAt: { type: Date, default: Date.now },
                channel: { type: String, enum: ["IN_APP", "EMAIL", "BOTH"], default: "IN_APP" },
            },
        ],
    },
    {
        timestamps: true,
    }
)

// Recompute totals before saving
invoiceSchema.pre("save", function (next) {
    if (this.lineItems && this.lineItems.length > 0) {
        this.subtotal = this.lineItems.reduce((sum, li) => sum + (li.amount || 0), 0)
    }
    this.taxAmount = Math.round(((this.subtotal || 0) * (this.taxRate || 0)) / 100 * 100) / 100
    this.total = Math.round(((this.subtotal || 0) + (this.taxAmount || 0)) * 100) / 100
    next()
})

const Invoice = mongoose.model("Invoice", invoiceSchema)

export default Invoice
