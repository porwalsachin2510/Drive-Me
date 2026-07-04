import mongoose from "mongoose";

/**
 * Identity-anchored cancellation ledger.
 *
 * WHY THIS EXISTS (the core anti-abuse mechanism):
 * A commuter can book with CASH and cancel before the trip without ever paying
 * anything into the platform. If we only tracked the resulting cancellation
 * "due" on the User document, the commuter could simply delete their account and
 * re-register to escape the charge.
 *
 * Collecting a government ID (Emirates ID / Civil ID) to anchor the due is NOT
 * allowed in the UAE / Kuwait, so instead we build a stable IDENTITY KEY from the
 * details the user already provides at registration — primarily their
 * OTP-verified phone number, with their email kept as a secondary matcher. The
 * outstanding due, strike count and block flag are anchored to that identity in
 * this standalone collection. It deliberately lives OUTSIDE the User collection
 * so it survives account deletion: when a person tries to register a new account
 * with the same phone (or email), registration looks them up here and refuses
 * until the old due is cleared, asking them to log into the existing account and
 * pay.
 */

const ledgerEntrySchema = new mongoose.Schema(
    {
        bookingId: { type: mongoose.Schema.Types.ObjectId, default: null },
        bookingNumber: { type: String, default: null },
        amount: { type: Number, required: true },
        currency: { type: String, default: "KWD" },
        reason: { type: String, default: "CASH_CANCELLATION_FEE" },
        // SETTLED once the commuter pays it or admin waives it.
        status: {
            type: String,
            enum: ["OUTSTANDING", "SETTLED", "WAIVED"],
            default: "OUTSTANDING",
        },
        settledAt: { type: Date, default: null },
        settledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        note: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

const cancellationLedgerSchema = new mongoose.Schema(
    {
        // Unique, stable identity key derived from the registration combo
        // (phone-anchored): `PHONE:<normalizedPhone>`. This is what makes a
        // re-registration with the same phone collide.
        identityKey: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        // Human-readable fingerprint of the registration combo, for admin display.
        identityFingerprint: { type: String, default: null },

        // Normalized identifiers used for matching at re-registration. We match on
        // phone OR email so changing just one of them does not dodge the due.
        normalizedPhone: { type: String, default: null, index: true },
        normalizedEmail: { type: String, default: null, index: true },
        normalizedName: { type: String, default: null },

        // Running totals (denormalized for fast guard checks).
        totalOutstanding: { type: Number, default: 0 },
        // Informational count of penalized cancellations (no longer caps anything).
        strikeCount: { type: Number, default: 0 },

        // When true, NO new account can be created with this identity and any
        // currently-linked account is blocked from booking until cleared.
        isBlocked: { type: Boolean, default: false },
        blockedReason: { type: String, default: null },

        // Last known identity for admin reference / follow-up.
        lastKnownUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        lastKnownName: { type: String, default: null },
        lastKnownEmail: { type: String, default: null },
        lastKnownPhone: { type: String, default: null },

        entries: { type: [ledgerEntrySchema], default: [] },
    },
    { timestamps: true }
);

/**
 * Normalize a free-form string into a stable matching token:
 * uppercase, strip everything that is not a letter or digit.
 */
cancellationLedgerSchema.statics.normalize = function (value = "") {
    return String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
};

/**
 * Build the normalized phone token from a country code + number, e.g.
 * ("+971", "50-123 4567") -> "971501234567".
 */
cancellationLedgerSchema.statics.normalizePhone = function (countryCode = "", phone = "") {
    const cc = String(countryCode || "").replace(/[^0-9]/g, "");
    const num = String(phone || "").replace(/[^0-9]/g, "");
    if (!num) return "";
    // Avoid double-prefixing if the number already includes the country code.
    if (cc && num.startsWith(cc)) return num;
    return `${cc}${num}`;
};

cancellationLedgerSchema.statics.normalizeEmail = function (email = "") {
    return String(email || "").trim().toLowerCase();
};

/**
 * The primary, unique identity key. Anchored to the phone number because it is
 * the OTP-verified identifier and the hardest for a user to cheaply regenerate.
 */
cancellationLedgerSchema.statics.buildIdentityKey = function (countryCode, phone) {
    const normalizedPhone = this.normalizePhone(countryCode, phone);
    return `PHONE:${normalizedPhone}`;
};

/**
 * A readable fingerprint of the full registration combo for admin reference.
 */
cancellationLedgerSchema.statics.buildFingerprint = function ({ countryCode, phone, email, fullName }) {
    const np = this.normalizePhone(countryCode, phone);
    const ne = this.normalizeEmail(email);
    const nn = this.normalize(fullName);
    return [np, ne, nn].filter(Boolean).join("|");
};

/**
 * Look up a ledger by ANY strong identifier (phone OR email) so a re-registration
 * cannot dodge the due by changing just one field. Returns null if nothing
 * matches.
 */
cancellationLedgerSchema.statics.findByIdentity = function ({ countryCode, phone, email }) {
    const np = this.normalizePhone(countryCode, phone);
    const ne = this.normalizeEmail(email);
    const or = [];
    if (np) or.push({ normalizedPhone: np });
    if (ne) or.push({ normalizedEmail: ne });
    if (!or.length) return Promise.resolve(null);
    return this.findOne({ $or: or });
};

/**
 * Recompute denormalized totals from the entries array.
 */
cancellationLedgerSchema.methods.recompute = function () {
    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    this.totalOutstanding = round2(
        (this.entries || [])
            .filter((e) => e.status === "OUTSTANDING")
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    );
    return this.totalOutstanding;
};

const CancellationLedger = mongoose.model("CancellationLedger", cancellationLedgerSchema);

export default CancellationLedger;
