import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import Settlement from "../models/Settlement.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import { createNotification } from "../Services/notificationService.js";
import { sendEmail } from "../Services/emailService.js";

/**
 * Transaction "types" (wallet sub-document `type`) that represent money the
 * partner EARNED from the platform during a period. Booking earnings are
 * recorded as DEPOSIT transactions with a description containing "Earnings" /
 * "booking" (see bookingController acceptB2CBooking). We also include
 * BOOKING_EARNING for forward compatibility.
 */
const EARNING_TYPES = ["DEPOSIT", "BOOKING_EARNING"];
// Commission already collected from the partner is stored as WITHDRAWAL with a
// description starting with "Admin commission".
const COMMISSION_TYPES = ["WITHDRAWAL", "COMMISSION", "COMMISSION_DEDUCTION"];

const isEarningTxn = (t) =>
    EARNING_TYPES.includes(t.type) &&
    /earning|booking/i.test(t.description || "");

const isCommissionTxn = (t) =>
    COMMISSION_TYPES.includes(t.type) &&
    /commission/i.test(t.description || "");

/**
 * Core calculation logic shared by the HTTP handler and the monthly cron job.
 * Calculates & persists settlement statements for all active partners for the
 * given month/year. Returns the array of settlement documents.
 */
export const calculateSettlementsForPeriod = async (
    targetMonth,
    targetYear,
    calculatedBy = null
) => {
    const periodStart = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0);
    const periodEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    console.log(`[v0] Calculating settlement for ${targetMonth}/${targetYear}`);

    const partners = await User.find({
        role: { $in: ["B2C_PARTNER", "B2B_PARTNER"] },
    }).select("_id fullName companyName email role status");

    const results = [];

    for (const partner of partners) {
        const wallet = await Wallet.findOne({ userId: partner._id });
        if (!wallet) continue;

        const periodTxns = (wallet.transactions || []).filter((t) => {
            const created = t.createdAt ? new Date(t.createdAt) : null;
            return (
                created &&
                created >= periodStart &&
                created <= periodEnd &&
                t.status === "COMPLETED"
            );
        });

        const earningTxns = periodTxns.filter(isEarningTxn);
        const commissionTxns = periodTxns.filter(isCommissionTxn);

        const grossEarnings = earningTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
        const commissionCollected = commissionTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
        const bookingCount = earningTxns.length;

        // Skip partners with no activity AND no debt to keep the list meaningful
        const hasDebt = wallet.balance < 0;
        if (grossEarnings === 0 && commissionCollected === 0 && !hasDebt) {
            continue;
        }

        const commissionDebt = hasDebt ? Math.abs(wallet.balance) : 0;
        const netPayable = wallet.balance > 0 ? wallet.balance : 0;

        let status = "CALCULATED";
        if (commissionDebt > 0) status = "DEBT_OUTSTANDING";
        else if (netPayable > 0) status = "PENDING_PAYOUT";

        const payload = {
            partnerId: partner._id,
            walletId: wallet._id,
            partnerName: partner.companyName || partner.fullName,
            partnerEmail: partner.email,
            role: partner.role,
            month: targetMonth,
            year: targetYear,
            periodStart,
            periodEnd,
            currency: wallet.currency || "AED",
            grossEarnings,
            commissionCollected,
            bookingCount,
            netPayable,
            commissionDebt,
            walletBalanceSnapshot: wallet.balance,
            status,
            calculatedAt: new Date(),
            calculatedBy,
        };

        // Upsert: recalculating overwrites the previous statement.
        // Don't clobber an already-SETTLED statement's payout fields.
        const existing = await Settlement.findOne({
            partnerId: partner._id,
            month: targetMonth,
            year: targetYear,
        });

        if (existing && existing.status === "SETTLED") {
            // keep settled record, just refresh the financial snapshot
            existing.grossEarnings = grossEarnings;
            existing.commissionCollected = commissionCollected;
            existing.bookingCount = bookingCount;
            existing.walletBalanceSnapshot = wallet.balance;
            existing.commissionDebt = commissionDebt;
            await existing.save();
            results.push(existing);
        } else {
            const settlement = await Settlement.findOneAndUpdate(
                { partnerId: partner._id, month: targetMonth, year: targetYear },
                { $set: payload },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            results.push(settlement);
        }
    }

    return results;
};

/**
 * Calculate & persist monthly settlement statements for all active partners.
 * This does NOT charge any commission (commission is taken in real-time at
 * booking acceptance). It produces a reconciliation record per partner.
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
            message: `Settlement calculated for ${results.length} partner(s)`,
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
 * Collect outstanding commission debt from partners whose wallet balance is
 * negative. If the partner has topped up (balance still negative but they owe
 * money), this recovers what it can and notifies them to top up the rest.
 * Replaces the old broken "auto-debit monthly pass" logic.
 */
export const collectCommissionDebt = async (req, res) => {
    try {
        console.log("[v0] Starting commission-debt collection");

        // Partners who owe money have a negative wallet balance
        const wallets = await Wallet.find({ balance: { $lt: 0 } }).populate(
            "userId",
            "fullName companyName email role"
        );

        const results = [];

        for (const wallet of wallets) {
            const user = wallet.userId;
            if (!user || !["B2C_PARTNER", "B2B_PARTNER"].includes(user.role)) continue;

            const owed = Math.abs(wallet.balance);

            // We cannot force-debit beyond what is in the wallet. Negative balance
            // means the partner must top up. We (re)record the debt on the current
            // month's settlement and notify the partner to settle it.
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();

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
                        periodStart: new Date(year, month - 1, 1),
                        periodEnd: new Date(year, month, 0, 23, 59, 59, 999),
                        currency: wallet.currency || "AED",
                        commissionDebt: owed,
                        walletBalanceSnapshot: wallet.balance,
                        netPayable: 0,
                        status: "DEBT_OUTSTANDING",
                        calculatedAt: now,
                        calculatedBy: req.userId,
                    },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // Notify the partner to top up
            await createNotification({
                userId: user._id,
                type: "WALLET_FUND_REQUIRED",
                title: "Commission Settlement Required",
                message: `You have an outstanding commission balance of ${owed.toFixed(
                    2
                )} ${wallet.currency || "AED"}. Please add funds to your wallet to settle it.`,
                data: { owed, currency: wallet.currency || "AED" },
            });

            if (user.email) {
                await sendEmail(
                    user.email,
                    "Action Required: Outstanding Commission Balance",
                    `
                        <h2>Outstanding Commission Balance</h2>
                        <p>Dear ${user.companyName || user.fullName},</p>
                        <p>Our records show an outstanding commission balance of
                        <strong>${owed.toFixed(2)} ${wallet.currency || "AED"}</strong> on your account.</p>
                        <p>Please add funds to your wallet to settle this amount and continue accepting cash bookings.</p>
                    `
                ).catch((e) => console.error("[v0] debt email failed:", e.message));
            }

            results.push({
                partnerId: user._id,
                partnerName: user.companyName || user.fullName,
                owed,
                currency: wallet.currency || "AED",
                status: "NOTIFIED",
            });
        }

        return res.status(200).json({
            success: true,
            message: `Commission-debt check complete: ${results.length} partner(s) owe money`,
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
        const { status, month, year, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const query = {};
        if (status && status !== "all") query.status = status;
        if (month) query.month = Number(month);
        if (year) query.year = Number(year);

        const [settlements, total] = await Promise.all([
            Settlement.find(query)
                .sort({ year: -1, month: -1, updatedAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Settlement.countDocuments(query),
        ]);

        // Global summary across the SAME filter (not just current page)
        const summaryAgg = await Settlement.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalNetPayable: { $sum: "$netPayable" },
                    totalCommissionCollected: { $sum: "$commissionCollected" },
                    totalCommissionDebt: { $sum: "$commissionDebt" },
                    totalGrossEarnings: { $sum: "$grossEarnings" },
                    partners: { $addToSet: "$partnerId" },
                },
            },
        ]);

        const summary = summaryAgg[0] || {
            totalNetPayable: 0,
            totalCommissionCollected: 0,
            totalCommissionDebt: 0,
            totalGrossEarnings: 0,
            partners: [],
        };

        return res.status(200).json({
            success: true,
            settlements,
            summary: {
                totalNetPayable: summary.totalNetPayable,
                totalCommissionCollected: summary.totalCommissionCollected,
                totalCommissionDebt: summary.totalCommissionDebt,
                totalGrossEarnings: summary.totalGrossEarnings,
                activePartners: summary.partners.length,
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
 * Partner: view own settlement statement for a period (computed live + stored).
 */
export const getPartnerSettlement = async (req, res) => {
    try {
        const partnerId = req.userId;
        const { month, year } = req.query;
        const now = new Date();
        const targetMonth = month ? Number(month) : now.getMonth() + 1;
        const targetYear = year ? Number(year) : now.getFullYear();

        const wallet = await Wallet.findOne({ userId: partnerId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        const periodStart = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0);
        const periodEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        const periodTxns = (wallet.transactions || []).filter((t) => {
            const created = t.createdAt ? new Date(t.createdAt) : null;
            return created && created >= periodStart && created <= periodEnd;
        });

        const grossEarnings = periodTxns
            .filter(isEarningTxn)
            .reduce((s, t) => s + Math.abs(t.amount), 0);
        const commissionCollected = periodTxns
            .filter(isCommissionTxn)
            .reduce((s, t) => s + Math.abs(t.amount), 0);

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
                currency: wallet.currency || "AED",
                grossEarnings,
                commissionCollected,
                netPayable: wallet.balance > 0 ? wallet.balance : 0,
                commissionDebt: wallet.balance < 0 ? Math.abs(wallet.balance) : 0,
                balance: wallet.balance,
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

/**
 * Admin: process a payout against a settlement statement.
 * Reuses the existing WithdrawalRequest flow so AdminFinance and Settlement
 * share a single source of truth for payouts.
 */
export const processSettlementPayout = async (req, res) => {
    try {
        const { settlementId } = req.params;
        const { amount, bankName, iban, accountHolderName, notes } = req.body;

        const settlement = await Settlement.findById(settlementId);
        if (!settlement) {
            return res.status(404).json({ success: false, message: "Settlement not found" });
        }

        if (settlement.status === "SETTLED") {
            return res.status(400).json({ success: false, message: "Settlement already paid out" });
        }

        const wallet = await Wallet.findOne({ userId: settlement.partnerId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: "Partner wallet not found" });
        }

        const payoutAmount = Number(amount);
        if (!payoutAmount || payoutAmount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid payout amount" });
        }

        if (payoutAmount > wallet.balance) {
            return res.status(400).json({
                success: false,
                message: `Payout exceeds available wallet balance (${wallet.balance.toFixed(2)} ${wallet.currency})`,
            });
        }

        const currency = wallet.currency || "AED";
        const country = WithdrawalRequest.getCountryFromCurrency(currency);

        // Record a PENDING payout wallet transaction and hold the funds
        const walletTxn = {
            type: "PAYOUT",
            amount: payoutAmount,
            description: `Settlement payout for ${settlement.month}/${settlement.year}`,
            payoutMethod: "BANK_TRANSFER",
            status: "PENDING",
            createdAt: new Date(),
        };
        wallet.transactions.push(walletTxn);
        wallet.balance -= payoutAmount;
        wallet.totalWithdrawals = (wallet.totalWithdrawals || 0) + payoutAmount;
        await wallet.save();
        const savedTxn = wallet.transactions[wallet.transactions.length - 1];

        // Create the canonical WithdrawalRequest (admin-initiated => APPROVED)
        const partner = await User.findById(settlement.partnerId).select(
            "fullName companyName email phone role"
        );

        const withdrawal = await WithdrawalRequest.create({
            userId: settlement.partnerId,
            walletId: wallet._id,
            requestId: WithdrawalRequest.generateRequestId(),
            amount: payoutAmount,
            currency,
            bankName: bankName || "Bank Transfer",
            iban: iban || "N/A",
            accountHolderName: accountHolderName || settlement.partnerName || "N/A",
            country,
            status: "APPROVED",
            paymentMethod: "MANUAL",
            approvedAt: new Date(),
            processedBy: req.userId,
            adminNotes: notes || `Created from settlement ${settlement._id}`,
            walletTransactionId: savedTxn._id,
            userInfo: {
                fullName: partner?.companyName || partner?.fullName,
                email: partner?.email,
                phone: partner?.phone,
                role: partner?.role,
            },
            metadata: { source: "SETTLEMENT", settlementId: settlement._id },
        });

        // Transaction ledger entry
        await Transaction.create({
            userId: settlement.partnerId,
            walletId: wallet._id,
            type: "DEBIT",
            category: "PAYOUT_REQUESTED",
            amount: payoutAmount,
            currency,
            description: `Settlement payout ${settlement.month}/${settlement.year}`,
            referenceId: withdrawal._id,
            referenceModel: "WithdrawalRequest",
            balanceBefore: wallet.balance + payoutAmount,
            balanceAfter: wallet.balance,
        }).catch((e) => console.error("[v0] settlement txn ledger failed:", e.message));

        // Update settlement statement
        settlement.payoutAmount = payoutAmount;
        settlement.payoutRequestId = withdrawal._id;
        settlement.netPayable = wallet.balance > 0 ? wallet.balance : 0;
        settlement.status = "SETTLED";
        settlement.settledAt = new Date();
        settlement.settledBy = req.userId;
        if (notes) settlement.notes = notes;
        await settlement.save();

        // Notify partner
        await createNotification({
            userId: settlement.partnerId,
            type: "WALLET_WITHDRAWAL",
            title: "Settlement Payout Initiated",
            message: `A payout of ${payoutAmount.toFixed(2)} ${currency} for ${settlement.month}/${settlement.year} has been initiated to your bank account.`,
            data: { amount: payoutAmount, currency, requestId: withdrawal.requestId },
        });

        if (partner?.email) {
            await sendEmail(
                partner.email,
                "Settlement Payout Initiated",
                `
                    <h2>Payout Initiated</h2>
                    <p>A settlement payout of <strong>${payoutAmount.toFixed(2)} ${currency}</strong>
                    for ${settlement.month}/${settlement.year} has been initiated.</p>
                    <p>Reference: ${withdrawal.requestId}</p>
                    <p>Expected delivery: 2-3 business days.</p>
                `
            ).catch((e) => console.error("[v0] payout email failed:", e.message));
        }

        return res.status(200).json({
            success: true,
            message: "Settlement payout processed successfully",
            settlement,
            withdrawalRequestId: withdrawal._id,
        });
    } catch (error) {
        console.error("[v0] Error processing settlement payout:", error);
        return res.status(500).json({
            success: false,
            message: "Error processing payout",
            error: error.message,
        });
    }
};
