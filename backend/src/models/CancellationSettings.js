import mongoose from "mongoose";

/**
 * Platform-wide cancellation policy (singleton document).
 *
 * The admin configures time-based tiers that determine what percentage of the
 * refundable amount is charged as a cancellation fee when a commuter cancels a
 * booking. Tiers are evaluated against how many hours remain until the travel
 * date — the closer to travel, the higher the fee typically is.
 *
 * A separate "free window" lets the admin guarantee a no-fee cancellation if the
 * commuter cancels within X hours of creating the booking (buyer's remorse window).
 */
const cancellationTierSchema = new mongoose.Schema(
    {
        // Human-readable label shown in the admin UI and to the commuter
        label: {
            type: String,
            required: true,
            trim: true,
        },
        // Lower bound (inclusive) of hours-before-travel for this tier.
        // The tier applies when hoursUntilTravel >= minHoursBeforeTravel.
        // Tiers are evaluated from highest minHoursBeforeTravel to lowest, so the
        // first matching tier wins.
        minHoursBeforeTravel: {
            type: Number,
            required: true,
            min: 0,
        },
        // Percentage (0-100) of the refundable amount charged as a fee.
        chargePercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
    },
    { _id: false }
);

const cancellationSettingsSchema = new mongoose.Schema(
    {
        // Free cancellation window after booking is created (hours).
        // If the commuter cancels within this many hours of booking, no fee applies.
        freeWindowHoursAfterBooking: {
            type: Number,
            default: 12,
            min: 0,
        },
        // Ordered list of time-based fee tiers.
        tiers: {
            type: [cancellationTierSchema],
            default: [
                { label: "More than 48 hours before travel", minHoursBeforeTravel: 48, chargePercentage: 10 },
                { label: "Between 24 and 48 hours before travel", minHoursBeforeTravel: 24, chargePercentage: 20 },
                { label: "Less than 24 hours before travel", minHoursBeforeTravel: 0, chargePercentage: 30 },
            ],
        },
        // Master switch. When disabled, no cancellation fee is ever charged.
        isActive: {
            type: Boolean,
            default: true,
        },

        // ===== CASH cancellation policy =====
        // For CASH bookings cancelled BEFORE the trip the commuter has paid
        // nothing, so we cannot debit a fee. Instead we record an "outstanding
        // due" against their registration identity and enforce it as below.
        // Master switch for penalizing cash cancellations.
        cashPenaltyActive: {
            type: Boolean,
            default: true,
        },
        // The fee for a cash cancellation is computed as a % of the FULL fare
        // (there is no "refundable" amount), using the same free window + tiers.
        // NOTE: there is intentionally NO strike limit — a commuter may cancel any
        // number of times; each penalized cancellation simply adds to their due.
        // When true, any unpaid cash-cancellation due blocks ALL new bookings
        // (across any account sharing the same identity) until it is cleared.
        blockBookingUntilDueCleared: {
            type: Boolean,
            default: true,
        },
        // Audit trail
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        notes: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

/**
 * Fetch the singleton settings document, creating a default one if none exists.
 */
cancellationSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
        return settings;
    }

    // Self-heal legacy documents created before the cash-cancellation fields
    // existed: persist the defaults so the stored document always contains them
    // (otherwise the admin panel toggles appear to "not save").
    //
    // NOTE: Mongoose hydrates missing fields to their schema default (true), so
    // `settings.cashPenaltyActive` is never `undefined` on the loaded doc. We must
    // inspect the RAW stored document to know whether the keys are actually
    // persisted on disk, then $set the defaults only when they are missing.
    try {
        const raw = await this.collection.findOne({ _id: settings._id });
        const missing = {};
        if (raw && raw.cashPenaltyActive === undefined) {
            missing.cashPenaltyActive = settings.cashPenaltyActive !== false;
        }
        if (raw && raw.blockBookingUntilDueCleared === undefined) {
            missing.blockBookingUntilDueCleared = settings.blockBookingUntilDueCleared !== false;
        }
        if (Object.keys(missing).length > 0) {
            await this.collection.updateOne({ _id: settings._id }, { $set: missing });
            // Re-read so the returned doc reflects the now-persisted values.
            settings = await this.findById(settings._id);
        }
    } catch (healErr) {
        console.error("[CancellationSettings.getSettings] self-heal failed:", healErr.message);
    }

    return settings;
};

/**
 * Compute the cancellation fee for a given refundable amount and timing.
 *
 * @param {Object} params
 * @param {number} params.refundableBase  - The amount eligible for refund (fee is a % of this).
 * @param {number} params.hoursSinceBooking - Hours elapsed since the booking was created.
 * @param {number} params.hoursUntilTravel  - Hours remaining until the travel date.
 * @returns {{ chargePercentage:number, cancellationFee:number, appliedTierLabel:string, isFree:boolean }}
 */
cancellationSettingsSchema.statics.computeFee = function (settings, { refundableBase = 0, hoursSinceBooking = 0, hoursUntilTravel = 0 }) {
    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

    // Policy disabled or nothing to refund -> no fee.
    if (!settings || settings.isActive === false || refundableBase <= 0) {
        return { chargePercentage: 0, cancellationFee: 0, appliedTierLabel: "No charge", isFree: true };
    }

    // Free cancellation window after booking takes precedence over every tier.
    if (hoursSinceBooking <= (settings.freeWindowHoursAfterBooking || 0)) {
        return {
            chargePercentage: 0,
            cancellationFee: 0,
            appliedTierLabel: `Free cancellation window (within ${settings.freeWindowHoursAfterBooking}h of booking)`,
            isFree: true,
        };
    }

    // Evaluate tiers from the largest threshold downwards; first match wins.
    const sortedTiers = [...(settings.tiers || [])].sort(
        (a, b) => b.minHoursBeforeTravel - a.minHoursBeforeTravel
    );

    let matched = null;
    for (const tier of sortedTiers) {
        if (hoursUntilTravel >= tier.minHoursBeforeTravel) {
            matched = tier;
            break;
        }
    }

    // Fallback to the most aggressive (lowest threshold) tier if none matched
    // (e.g. travel date already passed -> hoursUntilTravel negative).
    if (!matched && sortedTiers.length > 0) {
        matched = sortedTiers[sortedTiers.length - 1];
    }

    if (!matched) {
        return { chargePercentage: 0, cancellationFee: 0, appliedTierLabel: "No charge", isFree: true };
    }

    const chargePercentage = matched.chargePercentage || 0;
    const cancellationFee = round2((refundableBase * chargePercentage) / 100);

    return {
        chargePercentage,
        cancellationFee,
        appliedTierLabel: matched.label,
        isFree: chargePercentage === 0,
    };
};

/**
 * Compute the cancellation DUE for a CASH booking cancelled before the trip.
 *
 * Unlike online bookings there is no refundable amount (the commuter paid
 * nothing), so the fee is a percentage of the FULL fare. The free window and the
 * time-based tiers are applied exactly the same way, so an early cancellation can
 * still be free per the admin's policy.
 *
 * @returns {{ chargePercentage:number, dueAmount:number, appliedTierLabel:string, isFree:boolean, penaltyActive:boolean }}
 */
cancellationSettingsSchema.statics.computeCashDue = function (settings, { fareBase = 0, hoursSinceBooking = 0, hoursUntilTravel = 0 }) {
    const penaltyActive = !!(settings && settings.isActive !== false && settings.cashPenaltyActive !== false);
    if (!penaltyActive || fareBase <= 0) {
        return { chargePercentage: 0, dueAmount: 0, appliedTierLabel: "No charge", isFree: true, penaltyActive };
    }

    // Reuse the exact same tier/free-window logic, treating the full fare as the base.
    const result = this.computeFee(settings, {
        refundableBase: fareBase,
        hoursSinceBooking,
        hoursUntilTravel,
    });

    return {
        chargePercentage: result.chargePercentage,
        dueAmount: result.cancellationFee,
        appliedTierLabel: result.appliedTierLabel,
        isFree: result.isFree,
        penaltyActive,
    };
};

const CancellationSettings = mongoose.model("CancellationSettings", cancellationSettingsSchema);

export default CancellationSettings;
