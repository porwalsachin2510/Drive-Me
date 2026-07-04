import CancellationLedger from "../models/CancellationLedger.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import { getOrCreateWallet } from "./walletService.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";

/**
 * Central service for the cash-cancellation accountability system.
 *
 * Keeps the durable identity-anchored ledger (CancellationLedger) and the
 * fast-access mirror on the User document (user.cashCancellation) in sync.
 *
 * The identity anchor is built from the user's registration details (primarily
 * the OTP-verified phone number, with email as a secondary matcher) — we do NOT
 * collect any government ID.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Single source of truth for "is this commuter allowed to make a new booking?".
 *
 * A commuter is BLOCKED from creating any new booking while they have an unpaid
 * cash-cancellation due. The due is represented in two synced places, and we
 * check BOTH so a block can never slip through:
 *   1) the identity ledger / user.cashCancellation mirror (isBlocked / outstandingDue), and
 *   2) a NEGATIVE wallet balance (the fee is debited from the wallet, pushing it
 *      negative — that negative balance IS the unpaid due).
 *
 * Call this at the top of every booking-creation controller.
 *
 * @returns {Promise<{ allowed:boolean, code?:string, outstandingDue:number, currency:string, message?:string }>}
 */
export async function checkBookingEligibility(userId) {
    if (!userId) return { allowed: true, outstandingDue: 0, currency: "KWD" };

    const user = await User.findById(userId);
    if (!user) return { allowed: true, outstandingDue: 0, currency: "KWD" };

    const cc = user.cashCancellation || {};
    // A commuter can hold one wallet per currency. An unpaid cash-cancellation
    // due shows up as a NEGATIVE balance in whichever currency it was charged,
    // so scan every wallet and treat the most-negative one as the active due.
    const wallets = await Wallet.find({ userId });
    const wallet = wallets.reduce(
        (worst, w) => (!worst || (w.balance || 0) < (worst.balance || 0) ? w : worst),
        null
    );
    const currency = (wallet && wallet.currency) || cc.currency || "AED";

    // ===== THE WALLET IS THE SOURCE OF TRUTH FOR MONEY ACTUALLY OWED =====
    // When a cash booking is cancelled, the fee is DEBITED from the commuter's
    // wallet (pushing the balance negative). That negative balance IS the unpaid
    // due. So the real, current "do they still owe money?" question is answered by
    // the wallet balance — NOT by a flag that can drift out of sync.

    // 1) Negative wallet balance => genuinely unpaid due. BLOCK until topped up.
    if (wallet && wallet.balance < 0) {
        const owed = round2(Math.abs(wallet.balance));
        return {
            allowed: false,
            code: "OUTSTANDING_CANCELLATION_DUE",
            outstandingDue: owed,
            currency: wallet.currency || currency,
            message: `Your wallet balance is negative (${wallet.currency || currency} ${owed.toFixed(2)} due from a cancellation fee). Please add money to bring your balance back to zero before making a new booking.`,
        };
    }

    // 2) Wallet is healthy (>= 0) but a STALE ledger / mirror block still exists.
    //    This is exactly the bug we are fixing: the wallet was restored through a
    //    path that did not run settlement (e.g. an admin balance adjustment, a
    //    refund, a manual top-up that bypassed the gateway handler, etc.), so the
    //    negative balance — the actual due — was already covered, yet the block
    //    flag never lifted. The commuter has effectively paid, so we SELF-HEAL:
    //    settle the dues now (credit the admin the fee, mark the ledger/mirror/
    //    bookings settled, lift the block) and then allow the booking, instead of
    //    blocking forever on a stale flag.
    if (cc.isBlocked || (cc.outstandingDue || 0) > 0) {
        try {
            await settleCashDuesOnTopUp(userId);
        } catch (err) {
            console.error("[checkBookingEligibility] auto-settle failed:", err.message);
        }

        // Re-read the mirror to confirm the self-heal actually cleared the block.
        const refreshed = await User.findById(userId);
        const rcc = (refreshed && refreshed.cashCancellation) || {};
        if (rcc.isBlocked || (rcc.outstandingDue || 0) > 0) {
            // Could not clear (unexpected) — fail safe by still blocking so we
            // never silently drop a genuine, still-owed due.
            const due = round2(rcc.outstandingDue || 0);
            return {
                allowed: false,
                code: "OUTSTANDING_CANCELLATION_DUE",
                outstandingDue: due,
                currency,
                message:
                    rcc.blockedReason ||
                    `You have an unpaid cancellation fee of ${currency} ${due.toFixed(2)}. Please clear it before making a new booking.`,
            };
        }
    }

    return { allowed: true, outstandingDue: 0, currency };
}

/**
 * Push the ledger's current state down onto a user document's mirror fields.
 */
function applyLedgerToUserDoc(user, ledger) {
    if (!user) return;
    user.cashCancellation = user.cashCancellation || {};
    user.cashCancellation.outstandingDue = round2(ledger.totalOutstanding);
    user.cashCancellation.strikeCount = ledger.strikeCount;
    user.cashCancellation.isBlocked = ledger.isBlocked;
    user.cashCancellation.blockedReason = ledger.blockedReason || null;
    user.cashCancellation.identityKey = ledger.identityKey || null;
    user.cashCancellation.lastUpdatedAt = new Date();
}

/**
 * Find (or create) the ledger record for a user's identity. Matches an existing
 * ledger by phone OR email first (so a renamed/re-emailed account still attaches
 * to the same due), otherwise creates one keyed by the phone identity.
 */
export async function getLedgerForUser(user, { create = false } = {}) {
    if (!user) return null;
    const countryCode = user.countryCode || "";
    const phone = user.whatsappNumber || "";
    const email = user.email || "";
    if (!phone && !email) return null;

    let ledger = await CancellationLedger.findByIdentity({ countryCode, phone, email });
    if (!ledger && create) {
        ledger = await CancellationLedger.create({
            identityKey: CancellationLedger.buildIdentityKey(countryCode, phone),
            identityFingerprint: CancellationLedger.buildFingerprint({ countryCode, phone, email, fullName: user.fullName }),
            normalizedPhone: CancellationLedger.normalizePhone(countryCode, phone),
            normalizedEmail: CancellationLedger.normalizeEmail(email),
            normalizedName: CancellationLedger.normalize(user.fullName),
            lastKnownUserId: user._id,
            lastKnownName: user.fullName,
            lastKnownEmail: user.email,
            lastKnownPhone: phone,
        });
    }
    return ledger;
}

/**
 * Look up any blocking state for an identity BEFORE an account exists
 * (used at registration to stop re-registration to dodge a due).
 *
 * @returns {{ blocked:boolean, outstanding:number, reason:string|null, ledger:Object|null, existingEmail:string|null }}
 */
export async function checkIdentityRegistrationEligibility({ countryCode, phone, email }) {
    // The stable, unique identity key for this registration combo. Computed
    // up-front so the caller can stamp it on the User document even when no
    // ledger exists yet (a brand-new, clean identity).
    const identityKey = CancellationLedger.buildIdentityKey(countryCode, phone);

    const ledger = await CancellationLedger.findByIdentity({ countryCode, phone, email });
    if (!ledger) {
        return { blocked: false, outstanding: 0, reason: null, ledger: null, existingEmail: null, identityKey };
    }

    const outstanding = round2(ledger.totalOutstanding);
    const blocked = ledger.isBlocked || outstanding > 0;
    const existingEmail = ledger.lastKnownEmail || null;
    const currency = ledger.entries?.find((e) => e.status === "OUTSTANDING")?.currency || "KWD";
    let reason = null;
    if (outstanding > 0) {
        const acct = existingEmail
            ? ` Your account is already registered with us (${existingEmail}). Please log in to that account and pay the pending amount before registering again.`
            : " This identity is already registered with us. Please log in to your existing account and pay the pending amount before registering again.";
        reason = `You have an unpaid cancellation due of ${currency} ${outstanding} from a previous booking.${acct}`;
    } else if (ledger.isBlocked) {
        reason = ledger.blockedReason || "Your details are already registered and currently blocked due to unpaid cancellations.";
    }
    // Return the EXISTING ledger's identity key so the new account links to it.
    return { blocked, outstanding, reason, ledger, existingEmail, identityKey: ledger.identityKey || identityKey };
}

/**
 * Persist a durable identity record at REGISTRATION time (not just when a due is
 * incurred). This makes the identity trackable from day one and ensures that if
 * the user later deletes their account and re-registers with the same phone or
 * email, the existing ledger (with any outstanding due) is found and the
 * re-registration is blocked.
 *
 * - If a ledger for this identity already exists (matched by phone OR email),
 *   we re-link it to the new account.
 * - Otherwise we create a fresh, zero-due ledger.
 * In both cases we sync the User's `cashCancellation` mirror (incl. identityKey).
 *
 * @returns {Promise<Object|null>} the ledger document
 */
export async function registerIdentityLedger(user) {
    if (!user) return null;
    const countryCode = user.countryCode || "";
    const phone = user.whatsappNumber || "";
    const email = user.email || "";
    if (!phone && !email) return null;

    let ledger = await CancellationLedger.findByIdentity({ countryCode, phone, email });

    if (ledger) {
        // Re-link the durable identity to the newest account using it.
        ledger.lastKnownUserId = user._id;
        ledger.lastKnownName = user.fullName;
        ledger.lastKnownEmail = user.email;
        ledger.lastKnownPhone = phone;
        // Keep the matching tokens fresh (e.g. user kept phone but changed email).
        ledger.normalizedPhone = ledger.normalizedPhone || CancellationLedger.normalizePhone(countryCode, phone);
        ledger.normalizedEmail = ledger.normalizedEmail || CancellationLedger.normalizeEmail(email);
        await ledger.save();
    } else {
        try {
            ledger = await CancellationLedger.create({
                identityKey: CancellationLedger.buildIdentityKey(countryCode, phone),
                identityFingerprint: CancellationLedger.buildFingerprint({ countryCode, phone, email, fullName: user.fullName }),
                normalizedPhone: CancellationLedger.normalizePhone(countryCode, phone),
                normalizedEmail: CancellationLedger.normalizeEmail(email),
                normalizedName: CancellationLedger.normalize(user.fullName),
                lastKnownUserId: user._id,
                lastKnownName: user.fullName,
                lastKnownEmail: user.email,
                lastKnownPhone: phone,
            });
        } catch (err) {
            // Unique-key race: another concurrent create won — fetch and reuse it.
            if (err && err.code === 11000) {
                ledger = await CancellationLedger.findOne({ identityKey: CancellationLedger.buildIdentityKey(countryCode, phone) });
            } else {
                throw err;
            }
        }
    }

    if (ledger) {
        applyLedgerToUserDoc(user, ledger);
        await user.save();
    }
    return ledger;
}

/**
 * Record a new cash-cancellation due against a commuter's identity and update
 * both the ledger and the user mirror. There is NO strike limit — a commuter can
 * cancel any number of times; every penalized cancellation simply adds to the
 * outstanding due, which blocks new bookings until cleared.
 *
 * @returns {{ recorded:boolean, dueAmount:number, totalOutstanding:number, strikeCount:number, isBlocked:boolean, reason:string }}
 */
export async function recordCashCancellationDue({
    user,
    dueAmount,
    currency = "KWD",
    bookingId = null,
    bookingNumber = null,
    settings = {},
}) {
    const amount = round2(dueAmount);
    if (!user || amount <= 0) {
        return { recorded: false, dueAmount: 0, totalOutstanding: 0, strikeCount: 0, isBlocked: false, reason: "no_due" };
    }

    const shouldBlock = settings.blockBookingUntilDueCleared !== false;

    let ledger = await getLedgerForUser(user, { create: true });

    if (ledger) {
        ledger.entries.push({
            bookingId,
            bookingNumber,
            amount,
            currency,
            reason: "CASH_CANCELLATION_FEE",
            status: "OUTSTANDING",
            createdAt: new Date(),
        });
        ledger.strikeCount = (ledger.strikeCount || 0) + 1;
        ledger.recompute();
        ledger.lastKnownUserId = user._id;
        ledger.lastKnownName = user.fullName;
        ledger.lastKnownEmail = user.email;
        ledger.lastKnownPhone = user.whatsappNumber;
        if (shouldBlock && ledger.totalOutstanding > 0) {
            ledger.isBlocked = true;
            ledger.blockedReason = `Unpaid cash cancellation due of ${currency} ${ledger.totalOutstanding}.`;
        }
        await ledger.save();
        applyLedgerToUserDoc(user, ledger);
        await user.save();
        return {
            recorded: true,
            dueAmount: amount,
            totalOutstanding: round2(ledger.totalOutstanding),
            strikeCount: ledger.strikeCount,
            isBlocked: ledger.isBlocked,
            reason: ledger.blockedReason || "",
        };
    }

    // No identity ledger possible — fall back to user mirror only.
    user.cashCancellation = user.cashCancellation || {};
    user.cashCancellation.outstandingDue = round2((user.cashCancellation.outstandingDue || 0) + amount);
    user.cashCancellation.strikeCount = (user.cashCancellation.strikeCount || 0) + 1;
    user.cashCancellation.currency = currency;
    if (shouldBlock && user.cashCancellation.outstandingDue > 0) {
        user.cashCancellation.isBlocked = true;
        user.cashCancellation.blockedReason = `Unpaid cash cancellation due of ${currency} ${user.cashCancellation.outstandingDue}.`;
    }
    user.cashCancellation.lastUpdatedAt = new Date();
    await user.save();
    return {
        recorded: true,
        dueAmount: amount,
        totalOutstanding: user.cashCancellation.outstandingDue,
        strikeCount: user.cashCancellation.strikeCount,
        isBlocked: user.cashCancellation.isBlocked,
        reason: user.cashCancellation.blockedReason || "",
    };
}

/**
 * Deduct a cash-cancellation fee directly from the COMMUTER's wallet.
 *
 * The commuter paid nothing into the platform for a CASH booking, so to actually
 * charge the policy fee we debit it from their wallet. The wallet is allowed to
 * go NEGATIVE on purpose — the negative balance IS the unpaid due, and it blocks
 * new bookings (see the booking-creation guard) until the commuter tops up. The
 * admin is NOT credited here; the admin is paid later, in `settleCashDuesOnTopUp`,
 * once the commuter adds money and their balance returns to >= 0.
 *
 * @returns {Promise<{ deducted:boolean, amount:number, balanceBefore:number, balanceAfter:number }>}
 */
export async function deductCashCancellationFromWallet({ user, amount, currency = "KWD", booking }) {
    const fee = round2(amount);
    if (!user || fee <= 0) {
        return { deducted: false, amount: 0, balanceBefore: 0, balanceAfter: 0 };
    }

    // Debit the fee from the wallet in the FEE'S currency. A cash cancellation
    // fee incurred on a KWD booking must hit the commuter's KWD wallet.
    const wallet = await getOrCreateWallet(user._id, {
        currency,
        role: user.role || "COMMUTER",
    });

    const balanceBefore = wallet.balance;
    wallet.balance = round2(wallet.balance - fee);

    const bookingRef = booking?.bookingNumber || String(booking?._id || "");
    const description = `Cancellation fee for cash booking #${bookingRef}`;
    wallet.transactions.push({
        type: "CANCELLATION_FEE",
        amount: fee,
        description,
        reference: booking?._id ? String(booking._id) : undefined,
        status: "COMPLETED",
        createdAt: new Date(),
    });
    await wallet.save();

    try {
        await Transaction.create({
            walletId: wallet._id,
            userId: user._id,
            type: "DEBIT",
            amount: fee,
            currency: wallet.currency || currency,
            category: "CANCELLATION_FEE",
            description,
            referenceId: booking?._id,
            referenceModel: "B2CPassengerBooking",
            balanceBefore,
            balanceAfter: wallet.balance,
            metadata: {
                bookingId: booking?._id,
                reason: "cash_cancellation_fee_deducted_from_commuter_wallet",
            },
        });
    } catch (txErr) {
        // Don't fail the cancellation if the audit-trail Transaction can't be written.
        console.error("[deductCashCancellationFromWallet] Transaction record failed:", txErr.message);
    }

    return { deducted: true, amount: fee, balanceBefore, balanceAfter: wallet.balance };
}

/**
 * Called after a commuter adds funds to their wallet. If their wallet balance is
 * now back to >= 0, the outstanding cash-cancellation fee has effectively been
 * paid (the earlier deduction made the wallet negative; the top-up covered it).
 * At that point we:
 *   1) credit the ADMIN wallet the outstanding fee amount,
 *   2) mark the identity ledger dues SETTLED and lift the booking block,
 *   3) flip the related bookings to cashCancellationDueStatus = "SETTLED".
 *
 * Idempotent: once the ledger is cleared and bookings are flagged, a subsequent
 * top-up finds nothing outstanding and never double-pays the admin.
 *
 * @returns {Promise<{ settled:boolean, amountPaidToAdmin:number }>}
 */
export async function settleCashDuesOnTopUp(userId) {
    const user = await User.findById(userId);
    if (!user) return { settled: false, amountPaidToAdmin: 0 };

    // The debt lives in a specific currency, so resolve the ledger and its
    // currency FIRST, then check the balance of the wallet in THAT currency.
    const ledger = await getLedgerForUser(user, { create: false });
    const outstanding = ledger ? round2(ledger.totalOutstanding) : 0;
    const dueCurrency = ledger?.entries?.find((e) => e.status === "OUTSTANDING")?.currency
        || user.cashCancellation?.currency
        || "AED";

    const wallet = await Wallet.findOne({ userId, currency: dueCurrency });
    // Still in debt — keep the block, pay the admin nothing until fully cleared.
    if (!wallet || wallet.balance < 0) {
        return { settled: false, amountPaidToAdmin: 0 };
    }

    if (!outstanding || outstanding <= 0) {
        // Nothing owed via the ledger, but still make sure any lingering block /
        // outstanding booking flags are cleared now that the wallet is healthy.
        if (user.cashCancellation && (user.cashCancellation.isBlocked || (user.cashCancellation.outstandingDue || 0) > 0)) {
            user.cashCancellation.isBlocked = false;
            user.cashCancellation.outstandingDue = 0;
            user.cashCancellation.blockedReason = null;
            user.cashCancellation.lastUpdatedAt = new Date();
            await user.save();
        }
        return { settled: false, amountPaidToAdmin: 0 };
    }

    const currency = dueCurrency;

    // 1) Credit the admin the outstanding cancellation fee (now funded by the top-up).
    const adminUser = await User.findOne({ role: "ADMIN" });
    if (adminUser) {
        const adminWallet = await getOrCreateWallet(adminUser._id, { currency, role: "ADMIN" });
        const adminBalanceBefore = adminWallet.balance;
        adminWallet.balance = round2(adminWallet.balance + outstanding);
        adminWallet.totalEarnings = round2((adminWallet.totalEarnings || 0) + outstanding);
        adminWallet.transactions.push({
            type: "DEPOSIT",
            amount: outstanding,
            description: `Cash cancellation fee collected from ${user.fullName || user.email || "commuter"} (wallet top-up)`,
            status: "COMPLETED",
            createdAt: new Date(),
        });
        await adminWallet.save();

        try {
            await Transaction.create({
                walletId: adminWallet._id,
                userId: adminUser._id,
                type: "CREDIT",
                amount: outstanding,
                currency,
                category: "CANCELLATION_FEE",
                description: `Cash cancellation fee collected from commuter on wallet top-up`,
                balanceBefore: adminBalanceBefore,
                balanceAfter: adminWallet.balance,
                metadata: { commuterId: user._id, reason: "cash_cancellation_fee_paid_on_topup" },
            });
        } catch (txErr) {
            console.error("[settleCashDuesOnTopUp] Admin Transaction record failed:", txErr.message);
        }
    }

    // 2) Mark every OUTSTANDING ledger entry SETTLED and lift the block.
    await clearLedgerDues({ ledger, resolution: "SETTLED", note: "Paid via commuter wallet top-up" });

    // 3) Flip the related bookings so the commuter & admin screens reflect "settled".
    try {
        await B2CPassengerBooking.updateMany(
            { passengerId: userId, cashCancellationDueStatus: "OUTSTANDING" },
            { $set: { cashCancellationDueStatus: "SETTLED", cashCancellationAdminSettled: true } }
        );
    } catch (bErr) {
        console.error("[settleCashDuesOnTopUp] Booking status update failed:", bErr.message);
    }

    return { settled: true, amountPaidToAdmin: outstanding };
}

/**
 * Settle (mark paid) or waive all outstanding dues on a ledger, then clear the
 * block. Used by admin (waive) or by a payment flow (settle).
 *
 * @param {"SETTLED"|"WAIVED"} resolution
 */
export async function clearLedgerDues({ ledger, resolution = "SETTLED", adminId = null, note = "" }) {
    if (!ledger) return null;
    const now = new Date();
    for (const entry of ledger.entries) {
        if (entry.status === "OUTSTANDING") {
            entry.status = resolution;
            entry.settledAt = now;
            entry.settledBy = adminId;
            entry.note = note;
        }
    }
    ledger.recompute(); // -> 0
    ledger.isBlocked = false;
    ledger.blockedReason = null;
    await ledger.save();

    // Sync the currently-linked account, if any.
    if (ledger.lastKnownUserId) {
        const user = await User.findById(ledger.lastKnownUserId);
        if (user) {
            applyLedgerToUserDoc(user, ledger);
            await user.save();
        }
    }
    return ledger;
}
