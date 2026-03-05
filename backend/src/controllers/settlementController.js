import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import PaymentSchedule from "../models/PaymentSchedule.js";
import { sendEmail } from "../Services/emailService.js";

// Calculate and process monthly settlement for B2C/B2B partners
export const processMonthlySettlement = async (req, res) => {
    try {
        const { month, year } = req.query;
        const currentDate = new Date();

        const targetMonth = month ? Number(month) : currentDate.getMonth() + 1;
        const targetYear = year ? Number(year) : currentDate.getFullYear();

        console.log(`[v0] Processing settlement for ${targetMonth}/${targetYear}`);

        // Get all active partners (B2C_PARTNER, B2B_PARTNER)
        const partners = await User.find({
            role: { $in: ["B2C_PARTNER", "B2B_PARTNER"] },
            status: "ACTIVE"
        });

        const settlementResults = [];

        for (const partner of partners) {
            // Get transactions for this month
            const startDate = new Date(targetYear, targetMonth - 1, 1);
            const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

            const wallet = await Wallet.findOne({ userId: partner._id });
            if (!wallet) continue;

            // Calculate earnings from completed trips/bookings
            const monthlyEarnings = wallet.transactions
                .filter(t =>
                    t.type === "BOOKING_EARNING" &&
                    t.status === "COMPLETED" &&
                    t.createdAt >= startDate &&
                    t.createdAt <= endDate
                )
                .reduce((sum, t) => sum + t.amount, 0);

            // Calculate commissions owed
            const commissionRate = 0.15; // 15% platform commission
            const commissionAmount = monthlyEarnings * commissionRate;
            const netAmount = monthlyEarnings - commissionAmount;

            // Create settlement record
            const settlement = {
                partnerId: partner._id,
                month: targetMonth,
                year: targetYear,
                grossEarnings: monthlyEarnings,
                commissionRate,
                commissionAmount,
                netAmount,
                status: "CALCULATED",
                calculatedAt: new Date(),
                paidAt: null
            };

            settlementResults.push(settlement);

            // Update wallet with pending amount
            wallet.pendingAmount = (wallet.pendingAmount || 0) + netAmount;
            wallet.commissionDebt = (wallet.commissionDebt || 0) + commissionAmount;
            await wallet.save();
        }

        res.status(200).json({
            success: true,
            message: `Settlement calculated for ${settlementResults.length} partners`,
            month: targetMonth,
            year: targetYear,
            settlements: settlementResults
        });

    } catch (error) {
        console.error("[v0] Error processing settlement:", error);
        res.status(500).json({
            success: false,
            message: "Error processing settlement",
            error: error.message
        });
    }
};

// Auto-debit monthly pass fees from corporate wallets
export const autoDebitMonthlyPass = async (req, res) => {
    try {
        console.log("[v0] Starting auto-debit for monthly passes");

        // Get all active payment schedules for monthly passes
        const schedules = await PaymentSchedule.find({
            status: "ACTIVE",
            frequency: "MONTHLY",
            nextPaymentDate: { $lte: new Date() }
        }).populate("userId");

        const results = [];

        for (const schedule of schedules) {
            const user = schedule.userId;
            const wallet = await Wallet.findOne({ userId: user._id });

            if (!wallet || wallet.balance < schedule.amount) {
                // Insufficient balance - mark as failed
                results.push({
                    scheduleId: schedule._id,
                    userId: user._id,
                    status: "FAILED",
                    reason: "Insufficient balance"
                });

                // Send notification
                await sendEmail({
                    to: user.email,
                    subject: "Monthly Pass Payment Failed",
                    html: `
                        <h2>Payment Failed</h2>
                        <p>Your monthly pass auto-debit of ${schedule.amount} AED failed due to insufficient balance.</p>
                        <p>Please add funds to your wallet to continue the service.</p>
                    `
                });

                continue;
            }

            // Debit from wallet
            wallet.balance -= schedule.amount;
            wallet.totalWithdrawals = (wallet.totalWithdrawals || 0) + schedule.amount;

            // Add transaction record
            wallet.transactions.push({
                type: "BOOKING_EARNING",
                amount: schedule.amount,
                description: `Monthly pass auto-debit for ${schedule.passType}`,
                status: "COMPLETED",
                paymentMethod: "WALLET_DEBIT"
            });

            await wallet.save();

            // Update schedule next payment date
            const nextDate = new Date(schedule.nextPaymentDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            schedule.nextPaymentDate = nextDate;
            schedule.lastPaymentDate = new Date();
            await schedule.save();

            results.push({
                scheduleId: schedule._id,
                userId: user._id,
                status: "SUCCESS",
                amount: schedule.amount
            });

            // Send confirmation email
            await sendEmail({
                to: user.email,
                subject: "Monthly Pass Payment Confirmed",
                html: `
                    <h2>Payment Successful</h2>
                    <p>Your monthly pass of ${schedule.amount} AED has been charged successfully.</p>
                    <p>Your pass is valid until: ${nextDate.toLocaleDateString()}</p>
                `
            });
        }

        const successCount = results.filter(r => r.status === "SUCCESS").length;
        const failureCount = results.filter(r => r.status === "FAILED").length;

        res.status(200).json({
            success: true,
            message: `Auto-debit completed: ${successCount} successful, ${failureCount} failed`,
            results
        });

    } catch (error) {
        console.error("[v0] Error in auto-debit:", error);
        res.status(500).json({
            success: false,
            message: "Error processing auto-debit",
            error: error.message
        });
    }
};

// Get settlement details for a partner
export const getPartnerSettlement = async (req, res) => {
    try {
        const partnerId = req.userId;
        const { month, year } = req.query;

        const currentDate = new Date();
        const targetMonth = month ? Number(month) : currentDate.getMonth() + 1;
        const targetYear = year ? Number(year) : currentDate.getFullYear();

        const wallet = await Wallet.findOne({ userId: partnerId }).populate("userId", "fullName companyName email");

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            });
        }

        // Calculate earnings for the period
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

        const monthlyTransactions = wallet.transactions.filter(t =>
            t.createdAt >= startDate &&
            t.createdAt <= endDate
        );

        const earnings = monthlyTransactions
            .filter(t => t.type === "BOOKING_EARNING")
            .reduce((sum, t) => sum + t.amount, 0);

        const commissions = monthlyTransactions
            .filter(t => t.type === "COMMISSION_DEDUCTION")
            .reduce((sum, t) => sum + t.amount, 0);

        res.status(200).json({
            success: true,
            settlement: {
                partnerId,
                month: targetMonth,
                year: targetYear,
                earnings,
                commissions,
                netAmount: earnings - commissions,
                balance: wallet.balance,
                pendingAmount: wallet.pendingAmount,
                transactions: monthlyTransactions
            }
        });

    } catch (error) {
        console.error("[v0] Error fetching settlement:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching settlement details",
            error: error.message
        });
    }
};

// Get all settlements (admin only)
export const getAllSettlements = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        // Get all wallets with pending amounts
        const wallets = await Wallet.find({ pendingAmount: { $gt: 0 } })
            .populate("userId", "fullName companyName email role")
            .skip(skip)
            .limit(Number(limit))
            .sort({ updatedAt: -1 });

        const total = await Wallet.countDocuments({ pendingAmount: { $gt: 0 } });

        const settlements = wallets.map(wallet => ({
            partnerId: wallet.userId._id,
            partnerName: wallet.userId.companyName || wallet.userId.fullName,
            email: wallet.userId.email,
            role: wallet.userId.role,
            balance: wallet.balance,
            pendingAmount: wallet.pendingAmount,
            commissionDebt: wallet.commissionDebt,
            totalEarnings: wallet.totalEarnings,
            totalWithdrawals: wallet.totalWithdrawals,
            lastUpdated: wallet.updatedAt
        }));

        res.status(200).json({
            success: true,
            settlements,
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / Number(limit))
            }
        });

    } catch (error) {
        console.error("[v0] Error fetching settlements:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching settlements",
            error: error.message
        });
    }
};

// Process manual payout to partner
export const processPayout = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const { amount, bankAccount, paymentMethod } = req.body;

        const wallet = await Wallet.findOne({ userId: partnerId });
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            });
        }

        if (wallet.pendingAmount < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient pending amount for payout"
            });
        }

        // Deduct from pending and add to withdrawals
        wallet.pendingAmount -= amount;
        wallet.totalWithdrawals = (wallet.totalWithdrawals || 0) + amount;

        // Add transaction
        wallet.transactions.push({
            type: "PAYOUT",
            amount,
            description: `Manual payout via ${paymentMethod}`,
            bankAccount,
            payoutMethod: paymentMethod,
            status: "COMPLETED",
            paymentMethod
        });

        await wallet.save();

        // Send confirmation
        const user = await User.findById(partnerId);
        if (user && user.email) {
            await sendEmail({
                to: user.email,
                subject: "Payout Processed",
                html: `
                    <h2>Payout Completed</h2>
                    <p>Your payout of ${amount} AED has been processed successfully.</p>
                    <p>Payment method: ${paymentMethod}</p>
                    <p>Expected delivery: 2-3 business days</p>
                `
            });
        }

        res.status(200).json({
            success: true,
            message: "Payout processed successfully",
            payout: {
                partnerId,
                amount,
                paymentMethod,
                status: "COMPLETED",
                processedAt: new Date()
            }
        });

    } catch (error) {
        console.error("[v0] Error processing payout:", error);
        res.status(500).json({
            success: false,
            message: "Error processing payout",
            error: error.message
        });
    }
};
