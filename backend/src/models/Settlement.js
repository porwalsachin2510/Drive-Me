import mongoose from "mongoose"

/**
 * Settlement
 * -----------
 * A monthly reconciliation statement for a partner (B2C_PARTNER / B2B_PARTNER).
 *
 * IMPORTANT: Commission is already deducted in real-time when a booking is
 * accepted (see bookingController). This model does NOT re-charge commission.
 * It is a *statement / reconciliation* record that summarises, per partner per
 * month:
 *   - grossEarnings:       money credited to the partner wallet from bookings
 *   - commissionCollected: admin commission that was already collected from
 *                          that partner during the period (informational)
 *   - netPayable:          amount still sitting in the wallet that the partner
 *                          can be paid out (snapshot of available balance)
 *   - commissionDebt:      negative wallet balance => the partner owes the
 *                          platform (e.g. cash bookings where commission could
 *                          not be fully covered)
 *
 * One document per (partnerId, month, year). Recalculating overwrites the
 * existing document instead of creating duplicates.
 */
const settlementSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        walletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
        },
        // Denormalised partner info for fast listing
        partnerName: { type: String },
        partnerEmail: { type: String },
        role: {
            type: String,
            enum: ["B2C_PARTNER", "B2B_PARTNER"],
            required: true,
        },
        // Settlement period
        month: { type: Number, required: true, min: 1, max: 12 },
        year: { type: Number, required: true },
        periodStart: { type: Date, required: true },
        periodEnd: { type: Date, required: true },
        currency: { type: String, default: "AED" },

        // Financial summary (all in `currency`)
        grossEarnings: { type: Number, default: 0 }, // booking earnings credited this period
        commissionCollected: { type: Number, default: 0 }, // admin commission already taken this period
        bookingCount: { type: Number, default: 0 }, // number of earning transactions
        netPayable: { type: Number, default: 0 }, // wallet balance snapshot available for payout
        commissionDebt: { type: Number, default: 0 }, // amount partner owes (negative balance)
        walletBalanceSnapshot: { type: Number, default: 0 }, // raw wallet balance at calc time

        // Lifecycle
        status: {
            type: String,
            enum: ["CALCULATED", "PENDING_PAYOUT", "SETTLED", "DEBT_OUTSTANDING"],
            default: "CALCULATED",
        },
        calculatedAt: { type: Date, default: Date.now },
        calculatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

        // Payout linkage (reuses the existing WithdrawalRequest / payout flow)
        payoutAmount: { type: Number, default: 0 },
        payoutRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "WithdrawalRequest" },
        settledAt: { type: Date },
        settledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

        notes: { type: String },
    },
    { timestamps: true }
)

// One settlement per partner per period
settlementSchema.index({ partnerId: 1, month: 1, year: 1 }, { unique: true })
settlementSchema.index({ status: 1, year: -1, month: -1 })

export default mongoose.model("Settlement", settlementSchema)
