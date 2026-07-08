import mongoose from "mongoose";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import Settlement from "../models/Settlement.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import Payment from "../models/Payment.js";
import EMIPayment from "../models/EMIPayment.js";
import AdminNegotiation from "../models/AdminNegotiation.js";
import { createNotification } from "../Services/notificationService.js";
import { sendEmail } from "../Services/emailService.js";
import { resolveDisplayCurrency, convertForDisplay } from "../Services/displayCurrency.js";
import { getCountryCurrency, getEffectiveCountry } from "../Config/localizationConfig.js";
import { getOrCreateWallet } from "../Services/walletService.js";

/**
 * SETTLEMENT = MONTHLY RECONCILIATION STATEMENT (NOT A PAYOUT TOOL)
 * ----------------------------------------------------------------
 * This covers BOTH partner types, each read from its OWN real revenue source:
 *
 *   B2C_PARTNER (ride business):
 *     - Revenue source = B2CPassengerBooking (keyed by b2cPartnerId/partnerId).
 *     - Commission is taken in REAL TIME when a booking is accepted:
 *         * Online/prepaid (STRIPE/TAP/WALLET): platform keeps the commission
 *           out of the passenger payment and credits the partner wallet with the
 *           net earning (driverEarnings); admin wallet gets the commission.
 *         * Cash: the partner collected the full fare offline, so the admin
 *           commission is DEBITED from the partner wallet. If the wallet can't
 *           cover it the balance goes negative = COMMISSION DEBT.
 *
 *   B2B_PARTNER (fleet/contract business):
 *     - Revenue source = Payment (advance/final) + EMIPayment installments,
 *       keyed by fleetOwnerId. Each carries: amount (gross contract value),
 *       adminCommission (platform revenue) and fleetOwnerAmount (partner net).
 *     - Commission is collected in REAL TIME when the corporate/EMI payment is
 *       verified: the fleet-owner wallet gets fleetOwnerAmount and the admin
 *       wallet gets adminCommission.
 *
 * Both partner types are PAID OUT from their wallet via the Finance tab
 * (WithdrawalRequest flow). Payouts do NOT belong here.
 *
 *   CORPORATE (negotiation-commission receivable):
 *     - The platform ALSO earns from Corporate clients. When Admin negotiates a
 *       better contract price with a B2B partner on a Corporate's behalf, the
 *       platform charges the Corporate a negotiation commission = a % of the
 *       savings delivered (AdminNegotiation.adminCommissionFromCorporate).
 *     - Unlike partners, a Corporate does NOT earn from us and has no payout —
 *       they OWE us. So a Corporate statement is a RECEIVABLE (statementType
 *       = CORPORATE_RECEIVABLE):
 *         * commissionCollected = negotiation commission actually PAID in the
 *           period (collected in real time when the Corporate pays the contract
 *           advance — see paymentController / adminController).
 *         * commissionDebt      = live negotiation commission still PENDING
 *           across all of the Corporate's completed negotiations (money owed to
 *           the platform but not yet collected).
 *         * netPayable          = 0 (a Corporate never receives a payout).
 *
 * Therefore this module produces a per-account, per-month statement:
 *   - grossEarnings       = gross business value in the period (for a Corporate,
 *                           this is the total savings the platform negotiated)
 *   - commissionCollected = platform commission taken/collected in the period
 *   - netPayable          = partner net take-home (always 0 for a Corporate)
 *   - commissionDebt      = live amount still owed to the platform
 *                           (partner: negative wallet balance; corporate:
 *                            pending negotiation commission)
 *
 * The only mutating action is "Collect Commission Debt", which recovers owed
 * partner commission where the wallet has funds, reconciles the rest, and
 * refreshes/notifies Corporate receivables that are still outstanding.
 */

const REVENUE_STATUSES = ["ACCEPTED", "IN_PROGRESS", "COMPLETED"];

// Amount stored on a Payment/EMI commission field can be either a raw number
// or an object like { amount, rate }. Normalise defensively.
const readCommission = (val) => {
    if (val == null) return 0;
    if (typeof val === "number") return val;
    if (typeof val === "object") return Number(val.amount) || 0;
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
};

const round6 = (n) => Math.round((Number(n) || 0) * 1e6) / 1e6;

/**
 * Aggregate a partner's booking revenue for a period, normalised into a single
 * target currency. A partner should only ever transact in their own country's
 * currency, but we group by the booking currency and convert defensively so a
 * stray foreign-currency booking can never mislabel the totals.
 */
const getPeriodBookingStats = async (partnerId, periodStart, periodEnd, targetCurrency) => {
    const rows = await B2CPassengerBooking.aggregate([
        {
            $match: {
                b2cPartnerId: new mongoose.Types.ObjectId(partnerId),
                bookingStatus: { $in: REVENUE_STATUSES },
                $or: [
                    { acceptedAt: { $gte: periodStart, $lte: periodEnd } },
                    {
                        acceptedAt: { $in: [null, undefined] },
                        createdAt: { $gte: periodStart, $lte: periodEnd },
                    },
                ],
            },
        },
        {
            $group: {
                _id: { $ifNull: ["$currency", "AED"] },
                grossEarnings: { $sum: { $ifNull: ["$paymentAmount", 0] } },
                commission: { $sum: { $ifNull: ["$adminCommissionAmount", 0] } },
                netEarnings: { $sum: { $ifNull: ["$driverEarnings", 0] } },
                cashCommission: {
                    $sum: {
                        $cond: [
                            { $eq: ["$paymentMethod", "CASH"] },
                            { $ifNull: ["$adminCommissionAmount", 0] },
                            0,
                        ],
                    },
                },
                count: { $sum: 1 },
            },
        },
    ]);

    let grossEarnings = 0;
    let commission = 0;
    let netEarnings = 0;
    let cashCommission = 0;
    let bookingCount = 0;

    for (const r of rows) {
        const from = r._id || "AED";
        grossEarnings += convertForDisplay(r.grossEarnings, from, targetCurrency);
        commission += convertForDisplay(r.commission, from, targetCurrency);
        netEarnings += convertForDisplay(r.netEarnings, from, targetCurrency);
        cashCommission += convertForDisplay(r.cashCommission, from, targetCurrency);
        bookingCount += r.count;
    }

    return {
        grossEarnings: round6(grossEarnings),
        commission: round6(commission),
        netEarnings: round6(netEarnings),
        cashCommission: round6(cashCommission),
        bookingCount,
    };
};

/**
 * Aggregate a B2B partner's (fleet owner's) contract revenue for a period,
 * normalised into the target currency. B2B partners do not run passenger
 * rides; they earn from contract payments:
 *   - Standard payments (Payment model): advance/final instalments. Security
 *     deposits are excluded (they are held, not earned).
 *   - EMI payments (EMIPayment model): each PAID installment.
 * For every source: gross = amount, commission = adminCommission,
 * net = fleetOwnerAmount.
 */
const getPeriodContractStats = async (partnerId, periodStart, periodEnd, targetCurrency) => {
    const pid = new mongoose.Types.ObjectId(partnerId);
    const inPeriod = { $gte: periodStart, $lte: periodEnd };

    let grossEarnings = 0;
    let commission = 0;
    let netEarnings = 0;
    let bookingCount = 0;

    // (1) Standard contract payments actually credited in the period.
    const payments = await Payment.find({
        fleetOwnerId: pid,
        status: "COMPLETED",
        paymentType: { $in: ["advance", "final"] },
        $or: [
            { walletCreditedAt: inPeriod },
            { walletCreditedAt: { $in: [null, undefined] }, updatedAt: inPeriod },
        ],
    }).select("amount adminCommission fleetOwnerAmount currency");

    for (const p of payments) {
        const cur = p.currency || "AED";
        grossEarnings += convertForDisplay(Number(p.amount) || 0, cur, targetCurrency);
        commission += convertForDisplay(readCommission(p.adminCommission), cur, targetCurrency);
        netEarnings += convertForDisplay(Number(p.fleetOwnerAmount) || 0, cur, targetCurrency);
        bookingCount += 1;
    }

    // (2) EMI installments paid within the period.
    const emiPlans = await EMIPayment.find({ fleetOwnerId: pid }).select(
        "installments emiPlan"
    );

    for (const plan of emiPlans) {
        const cur = plan.emiPlan?.currency || "AED";
        for (const inst of plan.installments || []) {
            if (inst.status !== "PAID" || !inst.paidAt) continue;
            const paidAt = new Date(inst.paidAt);
            if (paidAt < periodStart || paidAt > periodEnd) continue;

            const gross = Number(inst.amount) || 0;
            const comm = readCommission(inst.adminCommission);
            const net =
                inst.fleetOwnerAmount != null
                    ? Number(inst.fleetOwnerAmount) || 0
                    : Math.max(0, gross - comm);

            grossEarnings += convertForDisplay(gross, cur, targetCurrency);
            commission += convertForDisplay(comm, cur, targetCurrency);
            netEarnings += convertForDisplay(net, cur, targetCurrency);
            bookingCount += 1;
        }
    }

    return {
        grossEarnings: round6(grossEarnings),
        commission: round6(commission),
        netEarnings: round6(netEarnings),
        cashCommission: 0, // B2B commission is never cash-collected by the partner
        bookingCount,
    };
};

/**
 * Aggregate a Corporate client's negotiation-commission position, normalised
 * into the target currency. A Corporate does not earn; the platform earns a
 * negotiation commission from them (AdminNegotiation.adminCommissionFromCorporate).
 *
 *   - commissionCollected : commission that was actually PAID in the period
 *                           (dated by paidAt, falling back to completedAt).
 *   - grossEarnings       : total savings the platform negotiated for this
 *                           Corporate on deals COMPLETED in the period
 *                           (informational context for the receivable).
 *   - bookingCount        : number of negotiations completed in the period.
 *   - commissionDebt      : LIVE outstanding receivable = every completed
 *                           negotiation whose commission is still PENDING,
 *                           regardless of period (mirrors how partner debt is a
 *                           live figure, not a period figure).
 *
 * WAIVED commission is excluded from both collected and outstanding — it is a
 * deliberate write-off, not revenue and not a debt.
 */
const getCorporateNegotiationStats = async (
    corporateId,
    periodStart,
    periodEnd,
    targetCurrency
) => {
    const cid = new mongoose.Types.ObjectId(corporateId);

    // Every finalised negotiation for this Corporate that produced a commission.
    const negotiations = await AdminNegotiation.find({
        corporateId: cid,
        status: "COMPLETED",
    }).select("currency priceSaved completedAt adminCommissionFromCorporate");

    let grossEarnings = 0; // savings negotiated in-period
    let commissionCollected = 0; // commission PAID in-period
    let commissionDebt = 0; // live PENDING commission (all-time)
    let bookingCount = 0; // negotiations completed in-period

    const inPeriod = (d) => {
        if (!d) return false;
        const t = new Date(d);
        return t >= periodStart && t <= periodEnd;
    };

    for (const n of negotiations) {
        const cur = n.currency || "AED";
        const commission = n.adminCommissionFromCorporate || {};
        const amount = Number(commission.amount) || 0;
        const status = commission.status || "PENDING";

        // In-period context: savings + activity count are dated by completion.
        if (inPeriod(n.completedAt)) {
            grossEarnings += convertForDisplay(Number(n.priceSaved) || 0, cur, targetCurrency);
            bookingCount += 1;
        }

        if (status === "PAID") {
            // Collected commission is dated by paidAt (fallback completedAt).
            const paidWhen = commission.paidAt || n.completedAt;
            if (inPeriod(paidWhen)) {
                commissionCollected += convertForDisplay(amount, cur, targetCurrency);
            }
        } else if (status === "PENDING") {
            // Live outstanding receivable — owed to the platform until collected.
            commissionDebt += convertForDisplay(amount, cur, targetCurrency);
        }
        // WAIVED -> intentionally ignored.
    }

    return {
        grossEarnings: round6(grossEarnings),
        commission: round6(commissionCollected),
        netEarnings: 0, // a Corporate never earns a payout
        cashCommission: 0,
        commissionDebt: round6(commissionDebt),
        bookingCount,
    };
};

/**
 * Live wallet position for a partner across ALL their per-currency wallets,
 * normalised into the target currency. Negative balances are the real
 * outstanding commission debt.
 */
const getWalletPosition = async (partnerId, targetCurrency) => {
    const wallets = await Wallet.find({ userId: partnerId });
    let balance = 0;
    let debt = 0;
    let primaryWalletId = null;

    for (const w of wallets) {
        const cur = w.currency || "AED";
        balance += convertForDisplay(w.balance || 0, cur, targetCurrency);
        if ((w.balance || 0) < 0) {
            debt += convertForDisplay(Math.abs(w.balance), cur, targetCurrency);
        }
        if (cur === targetCurrency) primaryWalletId = w._id;
    }
    if (!primaryWalletId && wallets.length) primaryWalletId = wallets[0]._id;

    return { balance: round6(balance), debt: round6(debt), primaryWalletId };
};

/**
 * Core calculation shared by the HTTP handler and the monthly cron job.
 * Builds & persists one reconciliation statement per active partner for the
 * given month/year. Recalculating overwrites the previous statement.
 */
export const calculateSettlementsForPeriod = async (
    targetMonth,
    targetYear,
    calculatedBy = null
) => {
    const periodStart = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0);
    const periodEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    console.log(`[v0] Calculating settlement statements for ${targetMonth}/${targetYear}`);

    const partners = await User.find({
        role: { $in: ["B2C_PARTNER", "B2B_PARTNER"] },
    }).select("_id fullName companyName email role status country countryCode adminPermissions");

    const results = [];

    for (const partner of partners) {
        const accountCurrency = getCountryCurrency(getEffectiveCountry(partner));

        // Read each partner type from its own real revenue source.
        const stats =
            partner.role === "B2B_PARTNER"
                ? await getPeriodContractStats(
                    partner._id,
                    periodStart,
                    periodEnd,
                    accountCurrency
                )
                : await getPeriodBookingStats(
                    partner._id,
                    periodStart,
                    periodEnd,
                    accountCurrency
                );
        const { balance, debt, primaryWalletId } = await getWalletPosition(
            partner._id,
            accountCurrency
        );

        // Skip partners with no activity in the period AND no live debt so the
        // statement list stays meaningful.
        if (stats.bookingCount === 0 && stats.grossEarnings === 0 && debt === 0) {
            continue;
        }

        // Net payable = the partner's net take-home for the period
        // (gross fare - admin commission). This is a statement figure; the
        // actual withdrawable balance lives in the wallet and is paid from the
        // Finance tab.
        const netPayable = round6(stats.netEarnings);
        const status = debt > 0 ? "DEBT_OUTSTANDING" : "CALCULATED";

        const payload = {
            partnerId: partner._id,
            walletId: primaryWalletId,
            partnerName: partner.companyName || partner.fullName,
            partnerEmail: partner.email,
            role: partner.role,
            statementType: "PARTNER_PAYOUT",
            month: targetMonth,
            year: targetYear,
            periodStart,
            periodEnd,
            currency: accountCurrency,
            grossEarnings: stats.grossEarnings,
            commissionCollected: stats.commission,
            bookingCount: stats.bookingCount,
            netPayable,
            commissionDebt: debt,
            walletBalanceSnapshot: balance,
            status,
            calculatedAt: new Date(),
            calculatedBy,
        };

        const settlement = await Settlement.findOneAndUpdate(
            { partnerId: partner._id, month: targetMonth, year: targetYear },
            { $set: payload },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        results.push(settlement);
    }

    // ------------------------------------------------------------------
    // CORPORATE receivables: the platform's negotiation commission owed by
    // each Corporate client. Only Corporates that actually had a negotiation
    // (completed in the period) or still owe a pending commission produce a
    // statement, so the list stays meaningful.
    // ------------------------------------------------------------------
    const corporates = await User.find({
        role: "CORPORATE",
    }).select("_id fullName companyName email role status country countryCode adminPermissions");

    for (const corporate of corporates) {
        const accountCurrency = getCountryCurrency(getEffectiveCountry(corporate));

        const stats = await getCorporateNegotiationStats(
            corporate._id,
            periodStart,
            periodEnd,
            accountCurrency
        );

        // Skip Corporates with no in-period negotiation activity, no commission
        // collected this period, and no live outstanding receivable.
        if (
            stats.bookingCount === 0 &&
            stats.commission === 0 &&
            stats.commissionDebt === 0
        ) {
            continue;
        }

        const status = stats.commissionDebt > 0 ? "DEBT_OUTSTANDING" : "CALCULATED";

        const payload = {
            partnerId: corporate._id,
            walletId: null,
            partnerName: corporate.companyName || corporate.fullName,
            partnerEmail: corporate.email,
            role: "CORPORATE",
            statementType: "CORPORATE_RECEIVABLE",
            month: targetMonth,
            year: targetYear,
            periodStart,
            periodEnd,
            currency: accountCurrency,
            grossEarnings: stats.grossEarnings, // savings negotiated for them
            commissionCollected: stats.commission, // negotiation commission PAID this period
            bookingCount: stats.bookingCount, // negotiations completed this period
            netPayable: 0, // a Corporate never receives a payout
            commissionDebt: stats.commissionDebt, // live pending negotiation commission
            walletBalanceSnapshot: 0,
            status,
            calculatedAt: new Date(),
            calculatedBy,
        };

        const settlement = await Settlement.findOneAndUpdate(
            { partnerId: corporate._id, month: targetMonth, year: targetYear },
            { $set: payload },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        results.push(settlement);
    }

    return results;
};

/**
 * Calculate & persist monthly settlement statements for all active partners.
 * Does NOT move any money (commission is taken in real time at booking).
 */
export const processMonthlySettlement = async (req, res) => {
    try {
        const { month, year } = req.query;
        const now = new Date();
        const targetMonth = month ? Number(month) : now.getMonth() + 1;
        const targetYear = year ? Number(year) : now.getFullYear();

        if (targetMonth < 1 || targetMonth > 12) {
            return res.status(400).json({ success: false, message: "Invalid month" });
        }

        const results = await calculateSettlementsForPeriod(
            targetMonth,
            targetYear,
            req.userId
        );

        return res.status(200).json({
            success: true,
            message: `Settlement statements generated for ${results.length} partner(s)`,
            month: targetMonth,
            year: targetYear,
            settlements: results,
        });
    } catch (error) {
        console.error("[v0] Error processing settlement:", error);
        return res.status(500).json({
            success: false,
            message: "Error processing settlement",
            error: error.message,
        });
    }
};

/**
 * Credit the admin wallet (in a specific currency) with recovered commission
 * and write the canonical ledger entry.
 */
const creditAdminCommission = async (amount, currency, note, partnerId) => {
    const adminUserId = process.env.ADMIN_USER_ID;
    if (!adminUserId || !amount || amount <= 0) return;

    const adminWallet = await getOrCreateWallet(adminUserId, {
        currency,
        role: "ADMIN",
    });
    const before = adminWallet.balance || 0;
    adminWallet.balance = before + amount;
    adminWallet.totalEarnings = (adminWallet.totalEarnings || 0) + amount;
    adminWallet.transactions.push({
        type: "COMMISSION",
        amount,
        description: note,
        status: "COMPLETED",
        createdAt: new Date(),
    });
    await adminWallet.save();

    await Transaction.create({
        walletId: adminWallet._id,
        userId: adminUserId,
        type: "CREDIT",
        amount,
        currency,
        category: "COMMISSION_EARNED",
        description: note,
        fromUserId: partnerId,
        balanceBefore: before,
        balanceAfter: adminWallet.balance,
    }).catch((e) => console.error("[v0] admin commission ledger failed:", e.message));
};

/**
 * Collect outstanding commission debt.
 *
 * Real DB behaviour:
 *   1. Where a wallet carries a deferred commissionDebt AND has available funds,
 *      we DEBIT the wallet, reduce the debt, and CREDIT the admin wallet
 *      (a genuine recovery, currency-safe, double-entry logged).
 *   2. Where the debt is a negative wallet balance (cash commission the wallet
 *      could not cover), the funds are not present to sweep, so we refresh the
 *      current statement, keep it DEBT_OUTSTANDING, and notify the partner to
 *      top up.
 *   3. Where a previously-recorded debt has since been cleared (top-up), we
 *      reconcile any lingering DEBT_OUTSTANDING statements to CALCULATED.
 */
export const collectCommissionDebt = async (req, res) => {
    try {
        console.log("[v0] Starting commission-debt collection");

        const wallets = await Wallet.find({
            $or: [{ balance: { $lt: 0 } }, { commissionDebt: { $gt: 0 } }],
        }).populate("userId", "fullName companyName email role country countryCode adminPermissions");

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const periodStart = new Date(year, month - 1, 1, 0, 0, 0);
        const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

        const results = [];

        for (const wallet of wallets) {
            const user = wallet.userId;
            if (!user || !["B2C_PARTNER", "B2B_PARTNER"].includes(user.role)) continue;

            const currency = wallet.currency || "AED";
            let recovered = 0;

            // (1) Genuine recovery: sweep deferred debt from available balance.
            if ((wallet.commissionDebt || 0) > 0 && (wallet.balance || 0) > 0) {
                recovered = Math.min(wallet.balance, wallet.commissionDebt);
                const before = wallet.balance;
                wallet.balance = round6(before - recovered);
                wallet.commissionDebt = round6(wallet.commissionDebt - recovered);
                wallet.transactions.push({
                    type: "COMMISSION_DEDUCTION",
                    amount: recovered,
                    description: `Commission debt recovered by admin`,
                    status: "COMPLETED",
                    createdAt: new Date(),
                });
                await wallet.save();

                await Transaction.create({
                    walletId: wallet._id,
                    userId: user._id,
                    type: "DEBIT",
                    amount: recovered,
                    currency,
                    category: "ADJUSTMENT",
                    description: `Commission debt recovered by admin`,
                    balanceBefore: before,
                    balanceAfter: wallet.balance,
                }).catch((e) => console.error("[v0] debt recovery ledger failed:", e.message));

                await creditAdminCommission(
                    recovered,
                    currency,
                    `Commission debt recovered from ${user.companyName || user.fullName}`,
                    user._id
                );
            }

            // Live outstanding after any recovery.
            const owed = round6(
                (wallet.balance || 0) < 0
                    ? Math.abs(wallet.balance)
                    : wallet.commissionDebt || 0
            );

            if (owed > 0) {
                await Settlement.findOneAndUpdate(
                    { partnerId: user._id, month, year },
                    {
                        $set: {
                            partnerId: user._id,
                            walletId: wallet._id,
                            partnerName: user.companyName || user.fullName,
                            partnerEmail: user.email,
                            role: user.role,
                            month,
                            year,
                            periodStart,
                            periodEnd,
                            currency,
                            commissionDebt: owed,
                            walletBalanceSnapshot: wallet.balance || 0,
                            status: "DEBT_OUTSTANDING",
                            calculatedAt: now,
                            calculatedBy: req.userId,
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                await createNotification({
                    userId: user._id,
                    type: "WALLET_FUND_REQUIRED",
                    title: "Commission Settlement Required",
                    message: `You have an outstanding commission balance of ${owed.toFixed(
                        3
                    )} ${currency}. Please add funds to your wallet to settle it.`,
                    data: { owed, currency },
                });

                if (user.email) {
                    await sendEmail(
                        user.email,
                        "Action Required: Outstanding Commission Balance",
                        `
                            <h2>Outstanding Commission Balance</h2>
                            <p>Dear ${user.companyName || user.fullName},</p>
                            <p>Our records show an outstanding commission balance of
                            <strong>${owed.toFixed(3)} ${currency}</strong> on your account.</p>
                            <p>Please add funds to your wallet to settle this amount and continue accepting cash bookings.</p>
                        `
                    ).catch((e) => console.error("[v0] debt email failed:", e.message));
                }
            } else {
                // Debt cleared — reconcile any lingering statements.
                await Settlement.updateMany(
                    { partnerId: user._id, status: "DEBT_OUTSTANDING" },
                    { $set: { commissionDebt: 0, status: "CALCULATED" } }
                );
            }

            results.push({
                partnerId: user._id,
                partnerName: user.companyName || user.fullName,
                recovered,
                owed,
                currency,
                statementType: "PARTNER_PAYOUT",
                status: recovered > 0 ? "RECOVERED" : owed > 0 ? "NOTIFIED" : "CLEARED",
            });
        }

        // ------------------------------------------------------------------
        // CORPORATE receivables: negotiation commission the platform is owed by
        // Corporate clients. A Corporate has no earnings wallet to sweep — the
        // commission is collected in real time when they pay the contract
        // advance. So here we cannot "recover" funds; instead we refresh the
        // outstanding receivable statement + notify, or reconcile it to
        // CALCULATED once the underlying negotiations have all been paid.
        // ------------------------------------------------------------------
        const corporateIds = await AdminNegotiation.distinct("corporateId", {
            status: "COMPLETED",
        });

        for (const corporateId of corporateIds) {
            const corporate = await User.findById(corporateId).select(
                "fullName companyName email role country countryCode adminPermissions"
            );
            if (!corporate || corporate.role !== "CORPORATE") continue;

            const currency = getCountryCurrency(getEffectiveCountry(corporate));
            const stats = await getCorporateNegotiationStats(
                corporateId,
                periodStart,
                periodEnd,
                currency
            );
            const owed = round6(stats.commissionDebt);
            const corporateName = corporate.companyName || corporate.fullName;

            if (owed > 0) {
                await Settlement.findOneAndUpdate(
                    { partnerId: corporate._id, month, year },
                    {
                        $set: {
                            partnerId: corporate._id,
                            walletId: null,
                            partnerName: corporateName,
                            partnerEmail: corporate.email,
                            role: "CORPORATE",
                            statementType: "CORPORATE_RECEIVABLE",
                            month,
                            year,
                            periodStart,
                            periodEnd,
                            currency,
                            grossEarnings: stats.grossEarnings,
                            commissionCollected: stats.commission,
                            bookingCount: stats.bookingCount,
                            netPayable: 0,
                            commissionDebt: owed,
                            walletBalanceSnapshot: 0,
                            status: "DEBT_OUTSTANDING",
                            calculatedAt: now,
                            calculatedBy: req.userId,
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                await createNotification({
                    userId: corporate._id,
                    type: "NEGOTIATION_COMMISSION_DUE",
                    title: "Negotiation Commission Outstanding",
                    message: `You have an outstanding negotiation commission of ${owed.toFixed(
                        3
                    )} ${currency}. It is collected automatically when you pay the negotiated contract's advance.`,
                    data: { owed, currency },
                });

                if (corporate.email) {
                    await sendEmail(
                        corporate.email,
                        "Outstanding Negotiation Commission",
                        `
                            <h2>Outstanding Negotiation Commission</h2>
                            <p>Dear ${corporateName},</p>
                            <p>Our records show an outstanding negotiation commission of
                            <strong>${owed.toFixed(3)} ${currency}</strong> for the price
                            savings we negotiated on your behalf.</p>
                            <p>This amount is collected automatically when you pay the advance
                            on the corresponding negotiated contract.</p>
                        `
                    ).catch((e) => console.error("[v0] corporate receivable email failed:", e.message));
                }
            } else {
                // All negotiation commissions paid — reconcile lingering statements.
                await Settlement.updateMany(
                    {
                        partnerId: corporate._id,
                        statementType: "CORPORATE_RECEIVABLE",
                        status: "DEBT_OUTSTANDING",
                    },
                    { $set: { commissionDebt: 0, status: "CALCULATED" } }
                );
            }

            results.push({
                partnerId: corporate._id,
                partnerName: corporateName,
                recovered: 0,
                owed,
                currency,
                statementType: "CORPORATE_RECEIVABLE",
                status: owed > 0 ? "NOTIFIED" : "CLEARED",
            });
        }

        const totalRecovered = results.reduce((s, r) => s + (r.recovered || 0), 0);
        const stillOwing = results.filter((r) => r.owed > 0).length;

        return res.status(200).json({
            success: true,
            message: `Debt collection complete: recovered from ${results.filter(
                (r) => r.recovered > 0
            ).length} partner(s); ${stillOwing} still owe money`,
            totalRecovered: round6(totalRecovered),
            results,
        });
    } catch (error) {
        console.error("[v0] Error collecting commission debt:", error);
        return res.status(500).json({
            success: false,
            message: "Error collecting commission debt",
            error: error.message,
        });
    }
};

/**
 * Admin: list persisted settlement statements with summary stats and filters.
 */
export const getAllSettlements = async (req, res) => {
    try {
        const { status, month, year, statementType, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const displayCurrency = resolveDisplayCurrency(req);

        const query = {};
        if (status && status !== "all") query.status = status;
        if (month) query.month = Number(month);
        if (year) query.year = Number(year);
        // Filter by statement kind: partner payouts vs corporate receivables.
        if (statementType && statementType !== "all") {
            query.statementType = statementType;
        }

        const [settlements, total] = await Promise.all([
            Settlement.find(query)
                .sort({ year: -1, month: -1, updatedAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Settlement.countDocuments(query),
        ]);

        // Global summary across the SAME filter, grouped by native currency AND
        // statement kind, then converted into the admin's selected display
        // currency before summing. Grouping by statementType lets us split
        // partner-payout revenue from corporate negotiation-commission revenue.
        const summaryAgg = await Settlement.aggregate([
            { $match: query },
            {
                $group: {
                    _id: {
                        currency: { $ifNull: ["$currency", "AED"] },
                        statementType: { $ifNull: ["$statementType", "PARTNER_PAYOUT"] },
                    },
                    totalNetPayable: { $sum: "$netPayable" },
                    totalCommissionCollected: { $sum: "$commissionCollected" },
                    totalCommissionDebt: { $sum: "$commissionDebt" },
                    totalGrossEarnings: { $sum: "$grossEarnings" },
                    partners: { $addToSet: "$partnerId" },
                },
            },
        ]);

        const partnerSet = new Set();
        const corporateSet = new Set();
        let totalNetPayable = 0;
        let totalCommissionCollected = 0;
        let totalCommissionDebt = 0;
        let totalGrossEarnings = 0;
        // Corporate-only (CORPORATE_RECEIVABLE) breakdown.
        let corporateCommissionCollected = 0;
        let corporateReceivableOutstanding = 0;
        // Partner-only (PARTNER_PAYOUT) breakdown.
        let partnerCommissionCollected = 0;
        let partnerCommissionDebt = 0;
        for (const bucket of summaryAgg) {
            const native = bucket._id?.currency || "AED";
            const type = bucket._id?.statementType || "PARTNER_PAYOUT";
            const netPayable = convertForDisplay(bucket.totalNetPayable, native, displayCurrency);
            const commissionCollected = convertForDisplay(bucket.totalCommissionCollected, native, displayCurrency);
            const commissionDebt = convertForDisplay(bucket.totalCommissionDebt, native, displayCurrency);
            const grossEarnings = convertForDisplay(bucket.totalGrossEarnings, native, displayCurrency);

            totalNetPayable += netPayable;
            totalCommissionCollected += commissionCollected;
            totalCommissionDebt += commissionDebt;
            totalGrossEarnings += grossEarnings;

            if (type === "CORPORATE_RECEIVABLE") {
                corporateCommissionCollected += commissionCollected;
                corporateReceivableOutstanding += commissionDebt;
                (bucket.partners || []).forEach((p) => corporateSet.add(String(p)));
            } else {
                partnerCommissionCollected += commissionCollected;
                partnerCommissionDebt += commissionDebt;
                (bucket.partners || []).forEach((p) => partnerSet.add(String(p)));
            }
        }

        const settlementsWithDisplay = settlements.map((s) => {
            const obj = s.toObject ? s.toObject() : s;
            const native = obj.currency || "AED";
            return {
                ...obj,
                displayCurrency,
                displayGrossEarnings: convertForDisplay(obj.grossEarnings, native, displayCurrency),
                displayNetPayable: convertForDisplay(obj.netPayable, native, displayCurrency),
                displayCommissionCollected: convertForDisplay(obj.commissionCollected, native, displayCurrency),
                displayCommissionDebt: convertForDisplay(obj.commissionDebt, native, displayCurrency),
            };
        });

        return res.status(200).json({
            success: true,
            settlements: settlementsWithDisplay,
            displayCurrency,
            summary: {
                totalNetPayable: round6(totalNetPayable),
                totalCommissionCollected: round6(totalCommissionCollected),
                totalCommissionDebt: round6(totalCommissionDebt),
                totalGrossEarnings: round6(totalGrossEarnings),
                activePartners: partnerSet.size,
                activeCorporates: corporateSet.size,
                // Partner-payout (B2C/B2B) breakdown.
                partnerCommissionCollected: round6(partnerCommissionCollected),
                partnerCommissionDebt: round6(partnerCommissionDebt),
                // Corporate negotiation-commission breakdown.
                corporateCommissionCollected: round6(corporateCommissionCollected),
                corporateReceivableOutstanding: round6(corporateReceivableOutstanding),
                currency: displayCurrency,
            },
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching settlements:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching settlements",
            error: error.message,
        });
    }
};

/**
 * Partner: view own settlement statement for a period (computed live from
 * booking data + the persisted statement).
 */
export const getPartnerSettlement = async (req, res) => {
    try {
        const partnerId = req.userId;
        const { month, year } = req.query;
        const now = new Date();
        const targetMonth = month ? Number(month) : now.getMonth() + 1;
        const targetYear = year ? Number(year) : now.getFullYear();

        const partner = await User.findById(partnerId).select(
            "country countryCode role adminPermissions"
        );
        const accountCurrency = getCountryCurrency(getEffectiveCountry(partner));

        const periodStart = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0);
        const periodEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        // Read from the correct revenue source for the account's role:
        //   B2B_PARTNER -> contract & EMI payments
        //   CORPORATE   -> negotiation-commission receivable
        //   B2C_PARTNER -> passenger bookings (default)
        let stats;
        if (partner?.role === "B2B_PARTNER") {
            stats = await getPeriodContractStats(
                partnerId,
                periodStart,
                periodEnd,
                accountCurrency
            );
        } else if (partner?.role === "CORPORATE") {
            stats = await getCorporateNegotiationStats(
                partnerId,
                periodStart,
                periodEnd,
                accountCurrency
            );
        } else {
            stats = await getPeriodBookingStats(
                partnerId,
                periodStart,
                periodEnd,
                accountCurrency
            );
        }
        const { balance, debt } = await getWalletPosition(partnerId, accountCurrency);

        // A Corporate owes commission (no wallet debt); everyone else's debt is
        // their live negative wallet balance.
        const outstandingDebt =
            partner?.role === "CORPORATE" ? stats.commissionDebt || 0 : debt;

        // Wallet transactions (account currency) within the period, for the
        // statement detail list.
        const wallet =
            (await Wallet.findOne({ userId: partnerId, currency: accountCurrency })) ||
            (await Wallet.findOne({ userId: partnerId }));
        const periodTxns = ((wallet && wallet.transactions) || []).filter((t) => {
            const created = t.createdAt ? new Date(t.createdAt) : null;
            return created && created >= periodStart && created <= periodEnd;
        });

        const stored = await Settlement.findOne({
            partnerId,
            month: targetMonth,
            year: targetYear,
        });

        return res.status(200).json({
            success: true,
            settlement: {
                partnerId,
                month: targetMonth,
                year: targetYear,
                currency: accountCurrency,
                role: partner?.role,
                statementType:
                    partner?.role === "CORPORATE"
                        ? "CORPORATE_RECEIVABLE"
                        : "PARTNER_PAYOUT",
                grossEarnings: stats.grossEarnings,
                commissionCollected: stats.commission,
                netPayable: stats.netEarnings,
                commissionDebt: outstandingDebt,
                balance,
                bookingCount: stats.bookingCount,
                status: stored?.status || "NOT_CALCULATED",
                settledAt: stored?.settledAt || null,
                transactions: periodTxns,
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching partner settlement:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching settlement details",
            error: error.message,
        });
    }
};
