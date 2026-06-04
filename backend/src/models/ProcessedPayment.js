import mongoose from "mongoose"

/**
 * ProcessedPayment Model
 * 
 * This collection is used to prevent duplicate payment processing due to race conditions.
 * When a payment is being processed (by webhook or callback), we first try to insert
 * a record here. If the insert succeeds, we proceed with adding funds. If it fails
 * due to duplicate key error, we know the payment was already processed.
 * 
 * This provides atomic duplicate detection that works even when two requests
 * hit the server at exactly the same time.
 */
const processedPaymentSchema = new mongoose.Schema(
    {
        // Payment session ID from payment gateway (Stripe checkout session ID, Tap charge ID)
        paymentSessionId: {
            type: String,
            required: true,
            unique: true, // CRITICAL: Unique index prevents duplicates
        },
        // Gateway transaction ID for additional tracking
        gatewayTransactionId: {
            type: String,
            sparse: true,
        },
        // User who received the funds
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // Amount that was added
        amount: {
            type: Number,
            required: true,
        },
        // Currency
        currency: {
            type: String,
            default: "AED",
        },
        // Payment gateway used
        gateway: {
            type: String,
            enum: ["STRIPE", "TAP"],
        },
        // Source of the processing (webhook or callback)
        processedBy: {
            type: String,
            enum: ["WEBHOOK", "CALLBACK", "UNKNOWN"],
            default: "UNKNOWN",
        },
        // When the payment was processed
        processedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
)

// Ensure unique payment session ID - this is the critical index
processedPaymentSchema.index({ paymentSessionId: 1 }, { unique: true })
// Index for user lookups
processedPaymentSchema.index({ userId: 1 })
// TTL index to auto-delete old records after 90 days (optional cleanup)
processedPaymentSchema.index({ processedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export default mongoose.model("ProcessedPayment", processedPaymentSchema)
