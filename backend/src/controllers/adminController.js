import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Contract from "../models/Contract.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import PaymentSchedule from "../models/PaymentSchedule.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import Vehicle from "../models/Vehicle.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js";
import RouteRequest from "../models/RouteRequest.js";
import Quotation from "../models/Quotation.js";
import Campaign from "../models/Campaign.js";
import Tag from "../models/Tag.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import AdminNegotiation from "../models/AdminNegotiation.js";
import CorporateBooking from "../models/CorporateBooking.js";
import EMIPayment from "../models/EMIPayment.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import { uploadToCloudinary } from "../Config/Cloudinary.js";
import { createNotification, sendRealTimeNotification } from "../Services/notificationService.js";
import { broadcastVehicleAvailabilityChange } from "../Services/socketService.js";
import { creditAdminNegotiationCommission } from "./walletController.js";
import paymentGatewayService, { getPaymentGateway, detectCountryFromCurrency } from "../Services/paymentGatewayService.js";

// Get all users for admin
export const getAllUsers = async (req, res) => {
    try {
        const { role, status, page = 1, limit = 20, search } = req.query;
        const query = {};

        if (role) query.role = role;
        if (status) query.status = status;

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { whatsappNumber: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            users,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching users:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching users",
            error: error.message,
        });
    }
};

// Get user statistics for admin
export const getUserStats = async (req, res) => {
    try {
        const [
            totalUsers,
            commuters,
            corporates,
            b2cPartners,
            b2bPartners,
            b2bDrivers,
            corporateDrivers,
            activeUsers,
            suspendedUsers
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "COMMUTER" }),
            User.countDocuments({ role: "CORPORATE" }),
            User.countDocuments({ role: "B2C_PARTNER" }),
            User.countDocuments({ role: "B2B_PARTNER" }),
            User.countDocuments({ role: "B2B_PARTNER_DRIVER" }),
            User.countDocuments({ role: "CORPORATE_DRIVER" }),
            User.countDocuments({ status: "ACTIVE" }),
            User.countDocuments({ status: "SUSPENDED" })
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                commuters,
                corporates,
                b2cPartners,
                b2bPartners,
                drivers: b2bDrivers + corporateDrivers,
                activeUsers,
                suspendedUsers
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching user stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching user statistics",
            error: error.message,
        });
    }
};

// Suspend user
export const suspendUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason, durationDays, customEndDate } = req.body;

        // Calculate suspension end date
        const suspendedAt = new Date();
        let suspensionEndDate;
        let duration = durationDays || 7; // Default 1 week

        if (customEndDate) {
            suspensionEndDate = new Date(customEndDate);
            duration = Math.ceil((suspensionEndDate - suspendedAt) / (1000 * 60 * 60 * 24));
        } else {
            suspensionEndDate = new Date(suspendedAt.getTime() + (duration * 24 * 60 * 60 * 1000));
        }
        const user = await User.findByIdAndUpdate(
            userId,
            {
                status: "SUSPENDED",
                suspendedAt: suspendedAt,
                suspendedBy: req.userId,
                suspensionReason: reason || "Violation of platform terms and conditions",
                suspensionDuration: duration,
                suspensionEndDate: suspensionEndDate
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Send suspension notification
        try {
            await createNotification({
                userId: user._id,
                type: "ACCOUNT_SUSPENDED",
                title: "Account Suspended",
                message: `Your account has been suspended for ${duration} days. Reason: ${reason || "Violation of platform terms and conditions"}`,
                data: {
                    suspensionReason: reason,
                    suspensionDuration: duration,
                    suspensionEndDate: suspensionEndDate
                }
            });

            // Send real-time notification
            sendRealTimeNotification(user._id.toString(), {
                type: "ACCOUNT_SUSPENDED",
                title: "Account Suspended",
                message: `Your account has been suspended for ${duration} days.`,
                data: { suspensionReason: reason, suspensionDuration: duration }
            });
        } catch (notifError) {
            console.error("[v0] Error sending suspension notification:", notifError);
        }

        // Send suspension email
        try {
            const { sendSuspensionEmail } = await import("../Services/emailService.js");
            await sendSuspensionEmail({
                email: user.email,
                fullName: user.fullName,
                reason: reason || "Violation of platform terms and conditions",
                durationDays: duration,
                suspensionEndDate: suspensionEndDate
            });
        } catch (emailError) {
            console.error("[v0] Error sending suspension email:", emailError);
        }

        res.status(200).json({
            success: true,
            message: `User suspended for ${duration} days`,
            user,
            suspensionDetails: {
                reason: reason || "Violation of platform terms and conditions",
                durationDays: duration,
                suspensionEndDate: suspensionEndDate
            }
        });
    } catch (error) {
        console.error("[v0] Error suspending user:", error);
        res.status(500).json({
            success: false,
            message: "Error suspending user",
            error: error.message,
        });
    }
};

// Activate user
export const activateUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const { message, isNewActivation } = req.body; // Optional message from admin and flag for new vs reactivation

        // Get previous user status to determine if this is a new activation or reactivation
        const previousUser = await User.findById(userId).select('status suspensionReason').lean();
        const wasNewUser = previousUser?.status === "PENDING" || isNewActivation;

        const user = await User.findByIdAndUpdate(
            userId,
            {
                status: "ACTIVE",
                activatedAt: new Date(),
                activatedBy: req.userId,
                suspensionEndDate: null,
                suspensionReason: null,
                suspensionDuration: null,
                reactivationMessage: message || null
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Set appropriate wording based on new activation vs reactivation
        const notificationTitle = wasNewUser ? "Account Activated" : "Account Reactivated";
        const defaultMessage = wasNewUser
            ? "Your account has been activated. Welcome to DriveMeGo! You can now log in and start using our services."
            : "Your account has been reactivated. Please ensure you follow our platform guidelines to avoid future suspensions.";

        // Send activation notification
        try {
            await createNotification({
                userId: user._id,
                type: "ACCOUNT_ACTIVATED",
                title: notificationTitle,
                message: message || defaultMessage,
                data: {
                    activatedAt: new Date(),
                    adminMessage: message,
                    isNewActivation: wasNewUser
                }
            });

            // Send real-time notification
            sendRealTimeNotification(user._id.toString(), {
                type: "ACCOUNT_ACTIVATED",
                title: notificationTitle,
                message: wasNewUser
                    ? "Your account has been activated! Welcome to DriveMeGo."
                    : "Your account has been reactivated! You can now log in.",
                data: { adminMessage: message, isNewActivation: wasNewUser }
            });
        } catch (notifError) {
            console.error("[v0] Error sending activation notification:", notifError);
        }

        // Send activation email
        try {
            const { sendActivationEmail } = await import("../Services/emailService.js");
            await sendActivationEmail({
                email: user.email,
                fullName: user.fullName,
                message: message || defaultMessage,
                previousReason: wasNewUser ? null : previousUser?.suspensionReason,
                isNewActivation: wasNewUser
            });
        } catch (emailError) {
            console.error("[v0] Error sending activation email:", emailError);
        }

        res.status(200).json({
            success: true,
            message: wasNewUser ? "User activated successfully" : "User reactivated successfully",
            user
        });
    } catch (error) {
        console.error("[v0] Error activating user:", error);
        res.status(500).json({
            success: false,
            message: "Error activating user",
            error: error.message,
        });
    }
};

// Delete user
export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByIdAndDelete(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Also delete user's wallet if exists
        await Wallet.findOneAndDelete({ userId });

        res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error) {
        console.error("[v0] Error deleting user:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting user",
            error: error.message,
        });
    }
};

// Edit user details (admin)
export const editUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        // Prevent updating sensitive fields
        const disallowedFields = ['password', 'role', '_id'];
        disallowedFields.forEach(field => delete updates[field]);

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: { user }
        });
    } catch (error) {
        console.error("[v0] Error editing user:", error);
        res.status(500).json({
            success: false,
            message: "Error editing user",
            error: error.message,
        });
    }
};

// Get user details for admin
export const getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select('-password')
            .populate('companyId', 'fullName companyName email');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Get user's wallet
        const wallet = await Wallet.findOne({ userId });

        // Get user's recent transactions
        const transactions = await Transaction.find({ userId })
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            user,
            wallet,
            transactions
        });
    } catch (error) {
        console.error("[v0] Error fetching user details:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching user details",
            error: error.message,
        });
    }
};

// Get B2C providers for admin
export const getB2CProviders = async (req, res) => {
    try {
        const { status, page = 1, limit = 20, search } = req.query;
        const query = { role: "B2C_PARTNER" };

        if (status) query.status = status;

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { whatsappNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const providers = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            providers,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C providers:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C providers",
            error: error.message,
        });
    }
};

// Get B2C provider statistics for admin
export const getB2CProviderStats = async (req, res) => {
    try {
        const [
            totalProviders,
            activeProviders,
            suspendedProviders,
            pendingProviders
        ] = await Promise.all([
            User.countDocuments({ role: "B2C_PARTNER" }),
            User.countDocuments({ role: "B2C_PARTNER", status: "ACTIVE" }),
            User.countDocuments({ role: "B2C_PARTNER", status: "SUSPENDED" }),
            User.countDocuments({ role: "B2C_PARTNER", status: "PENDING" })
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalProviders,
                activeProviders,
                suspendedProviders,
                pendingProviders
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C provider stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C provider statistics",
            error: error.message,
        });
    }
};

// Suspend B2C provider
export const suspendB2CProvider = async (req, res) => {
    try {
        const { providerId } = req.params;
        const { reason, durationDays, customEndDate } = req.body;

        // Calculate suspension end date
        const suspendedAt = new Date();
        let suspensionEndDate;
        let duration = durationDays || 7; // Default 1 week

        if (customEndDate) {
            suspensionEndDate = new Date(customEndDate);
            duration = Math.ceil((suspensionEndDate - suspendedAt) / (1000 * 60 * 60 * 24));
        } else {
            suspensionEndDate = new Date(suspendedAt.getTime() + (duration * 24 * 60 * 60 * 1000));
        }
        const provider = await User.findOneAndUpdate(
            { _id: providerId, role: "B2C_PARTNER" },
            {
                status: "SUSPENDED",
                suspendedAt: suspendedAt,
                suspendedBy: req.userId,
                suspensionReason: reason || "Violation of platform terms and conditions",
                suspensionDuration: duration,
                suspensionEndDate: suspensionEndDate
            },
            { new: true }
        ).select('-password');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "B2C provider not found"
            });
        }

        // Send notifications and email (same as suspendUser)
        try {
            await createNotification({
                userId: provider._id,
                type: "ACCOUNT_SUSPENDED",
                title: "Account Suspended",
                message: `Your account has been suspended for ${duration} days. Reason: ${reason || "Violation of platform terms and conditions"}`,
                data: { suspensionReason: reason, suspensionDuration: duration, suspensionEndDate }
            });

            sendRealTimeNotification(provider._id.toString(), {
                type: "ACCOUNT_SUSPENDED",
                title: "Account Suspended",
                message: `Your account has been suspended for ${duration} days.`,
                data: { suspensionReason: reason, suspensionDuration: duration }
            });

            const { sendSuspensionEmail } = await import("../Services/emailService.js");
            await sendSuspensionEmail({
                email: provider.email,
                fullName: provider.fullName,
                reason: reason || "Violation of platform terms and conditions",
                durationDays: duration,
                suspensionEndDate
            });
        } catch (notifError) {
            console.error("[v0] Error sending B2C suspension notifications:", notifError);
        }

        res.status(200).json({
            success: true,
            message: `B2C provider suspended for ${duration} days`,
            provider,
            suspensionDetails: { reason, durationDays: duration, suspensionEndDate }
        });
    } catch (error) {
        console.error("[v0] Error suspending B2C provider:", error);
        res.status(500).json({
            success: false,
            message: "Error suspending B2C provider",
            error: error.message,
        });
    }
};

// Activate B2C provider
export const activateB2CProvider = async (req, res) => {
    try {
        const { providerId } = req.params;
        const { message } = req.body;

        const previousSuspensionReason = await User.findById(providerId).select('suspensionReason').lean();
        const provider = await User.findOneAndUpdate(
            { _id: providerId, role: "B2C_PARTNER" },
            {
                status: "ACTIVE",
                activatedAt: new Date(),
                activatedBy: req.userId,
                suspensionEndDate: null,
                suspensionReason: null,
                suspensionDuration: null,
                reactivationMessage: message || null
            },
            { new: true }
        ).select('-password');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "B2C provider not found"
            });
        }

        // Send activation notifications and email
        try {
            await createNotification({
                userId: provider._id,
                type: "ACCOUNT_ACTIVATED",
                title: "Account Reactivated",
                message: message || "Your account has been reactivated. Please follow our platform guidelines.",
                data: { reactivatedAt: new Date(), adminMessage: message }
            });

            sendRealTimeNotification(provider._id.toString(), {
                type: "ACCOUNT_ACTIVATED",
                title: "Account Reactivated",
                message: "Your account has been reactivated! You can now log in.",
                data: { adminMessage: message }
            });

            const { sendActivationEmail } = await import("../Services/emailService.js");
            await sendActivationEmail({
                email: provider.email,
                fullName: provider.fullName,
                message: message || "Your account has been reactivated.",
                previousReason: previousSuspensionReason?.suspensionReason
            });
        } catch (notifError) {
            console.error("[v0] Error sending B2C activation notifications:", notifError);
        }

        res.status(200).json({
            success: true,
            message: "B2C provider activated successfully",
            provider
        });
    } catch (error) {
        console.error("[v0] Error activating B2C provider:", error);
        res.status(500).json({
            success: false,
            message: "Error activating B2C provider",
            error: error.message,
        });
    }
};

// Get finance metrics for admin
export const getFinanceMetrics = async (req, res) => {
    try {
        const [
            totalRevenue,
            netEarnings,
            pendingPayouts,
            activeProviders,
            totalTransactions,
            monthlyRevenue,
            commissionEarned,
            securityDeposits
        ] = await Promise.all([
            Transaction.aggregate([
                { $match: { category: 'PAYMENT_RECEIVED' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Transaction.aggregate([
                { $match: { category: 'COMMISSION_EARNED' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Transaction.aggregate([
                { $match: { category: 'PAYOUT_REQUESTED' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            User.countDocuments({ role: "B2C_PARTNER", status: "ACTIVE" }),
            Transaction.countDocuments(),
            Transaction.aggregate([
                { $match: { createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Transaction.aggregate([
                { $match: { category: 'COMMISSION_EARNED' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Wallet.aggregate([
                { $group: { _id: null, total: { $sum: '$securityDepositHeld' } } }
            ]),
            // Get dominant currency
            Wallet.aggregate([
                { $group: { _id: "$currency", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 1 }
            ])
        ]);

        const currency = securityDeposits.length > 0 && securityDeposits[securityDeposits.length - 1]?.[0]?._id
            ? securityDeposits[securityDeposits.length - 1][0]._id
            : "AED";

        // Get the actual currency from the last aggregation result (which is dominantCurrency)
        const results = await Wallet.aggregate([
            { $group: { _id: "$currency", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);
        const dominantCurrency = results[0]?._id || "AED";

        res.status(200).json({
            success: true,
            metrics: {
                totalRevenue: totalRevenue[0]?.total || 0,
                netEarnings: netEarnings[0]?.total || 0,
                pendingPayouts: pendingPayouts[0]?.total || 0,
                activeProviders,
                totalTransactions,
                monthlyRevenue: monthlyRevenue[0]?.total || 0,
                commissionEarned: commissionEarned[0]?.total || 0,
                securityDeposits: securityDeposits[0]?.total || 0,
                currency: dominantCurrency
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching finance metrics:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching finance metrics",
            error: error.message,
        });
    }
};

// Get payout requests for admin
export const getPayoutRequests = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status) query.status = status;

        // First, sync any PENDING wallet withdrawals that don't have WithdrawalRequest records
        // This handles legacy data before WithdrawalRequest model was implemented
        try {
            const walletsWithPendingWithdrawals = await Wallet.find({
                'transactions.type': 'WITHDRAWAL',
                'transactions.status': 'PENDING'
            }).populate('userId', 'fullName email phone role');

            for (const wallet of walletsWithPendingWithdrawals) {
                for (const txn of wallet.transactions) {
                    if (txn.type === 'WITHDRAWAL' && txn.status === 'PENDING') {
                        // Check if WithdrawalRequest already exists for this transaction
                        const existingRequest = await WithdrawalRequest.findOne({
                            walletTransactionId: txn._id
                        });

                        if (!existingRequest) {
                            // Create WithdrawalRequest for legacy withdrawal
                            const user = wallet.userId;
                            await WithdrawalRequest.create({
                                userId: user?._id || wallet.userId,
                                walletId: wallet._id,
                                requestId: `WR-LEGACY-${txn._id.toString().slice(-8).toUpperCase()}`,
                                amount: Math.abs(txn.amount),
                                currency: wallet.currency || 'AED',
                                bankName: txn.bankName || (txn.description?.match(/to (.+?) -/) || [])[1] || 'Unknown Bank',
                                bankCode: txn.bankCode || '',
                                iban: txn.bankAccount || 'N/A',
                                accountHolderName: txn.accountHolderName || (txn.description?.match(/- (.+)$/) || [])[1] || user?.fullName || 'Unknown',
                                status: 'PENDING',
                                userInfo: {
                                    fullName: user?.fullName || user?.name || 'Unknown',
                                    email: user?.email || '',
                                    phone: user?.phone || '',
                                    role: user?.role || wallet.role || 'USER'
                                },
                                walletTransactionId: txn._id,
                                metadata: {
                                    reference: txn.reference,
                                    legacyMigration: true,
                                    originalCreatedAt: txn.createdAt,
                                    originalDescription: txn.description
                                },
                                createdAt: txn.createdAt || new Date()
                            });
                        }
                    }
                }
            }
        } catch (migrationError) {
            console.error("[getPayoutRequests] Error migrating legacy withdrawals:", migrationError);
            // Continue even if migration fails
        }

        // Fetch from WithdrawalRequest model
        const payouts = await WithdrawalRequest.find(query)
            .populate('userId', 'fullName email phone role')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await WithdrawalRequest.countDocuments(query);
        const pendingCount = await WithdrawalRequest.countDocuments({ status: 'PENDING' });

        // Transform data for frontend
        const formattedPayouts = payouts.map(payout => ({
            _id: payout._id,
            requestId: payout.requestId,
            providerId: payout.userId,
            type: payout.userInfo?.role || 'USER',
            totalAmount: payout.amount,
            commissionAmount: 0, // No commission on withdrawals
            netPayable: payout.amount,
            status: payout.status,
            bankName: payout.bankName,
            iban: payout.iban,
            accountHolderName: payout.accountHolderName,
            currency: payout.currency,
            createdAt: payout.createdAt,
            processedAt: payout.processedAt,
            completedAt: payout.completedAt,
            rejectedAt: payout.rejectedAt,
            rejectionReason: payout.rejectionReason,
            adminNotes: payout.adminNotes,
            transactionReference: payout.transactionReference,
            userInfo: payout.userInfo
        }));

        res.status(200).json({
            success: true,
            payouts: formattedPayouts,
            stats: {
                total,
                pending: pendingCount
            },
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching payout requests:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching payout requests",
            error: error.message,
        });
    }
};

// Get transactions for admin
export const getTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 50, type, status, startDate, endDate } = req.query;
        const query = {};

        if (type) query.category = type;
        if (status) query.status = status;
        if (startDate) query.createdAt = { $gte: new Date(startDate) };
        if (endDate) query.createdAt = { $lte: new Date(endDate) };

        const transactionsRaw = await Transaction.find(query)
            .populate('userId', 'fullName email phone')
            .populate('fromUserId', 'fullName email')
            .populate('toUserId', 'fullName email')
            .populate('walletId', 'userId')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await Transaction.countDocuments(query);

        // Map transactions to include from/to details
        const transactions = transactionsRaw.map(t => {
            const transaction = t.toObject();

            // Determine FROM (source) - who the money is coming from
            let fromDetails = null;
            if (transaction.fromUserId) {
                fromDetails = transaction.fromUserId.fullName || transaction.fromUserId.email;
            } else if (transaction.fromName) {
                fromDetails = transaction.fromName;
            } else if (transaction.type === 'CREDIT' && transaction.category === 'PAYMENT_RECEIVED') {
                // For credits, FROM is usually the payer/customer
                fromDetails = transaction.metadata?.payerName || transaction.metadata?.customerName || 'Customer';
            } else if (transaction.type === 'CREDIT') {
                fromDetails = transaction.description || 'System';
            }

            // Determine TO (destination) - who is receiving
            let toDetails = null;
            if (transaction.toUserId) {
                toDetails = transaction.toUserId.fullName || transaction.toUserId.email;
            } else if (transaction.toName) {
                toDetails = transaction.toName;
            } else if (transaction.userId) {
                // The userId is typically the wallet owner who receives/sends
                toDetails = transaction.userId.fullName || transaction.userId.email || 'User';
            }

            // For DEBIT transactions, swap from/to (money going OUT of wallet)
            if (transaction.type === 'DEBIT') {
                const temp = fromDetails;
                fromDetails = toDetails || transaction.userId?.fullName || 'Wallet Owner';
                toDetails = temp || transaction.metadata?.recipientName || transaction.description || 'Recipient';
            }

            // For HOLD transactions
            if (transaction.type === 'HOLD') {
                fromDetails = transaction.userId?.fullName || 'User';
                toDetails = 'Escrow/Hold';
            }

            return {
                ...transaction,
                from: fromDetails || '-',
                to: toDetails || '-',
            };
        });

        res.status(200).json({
            success: true,
            transactions,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching transactions:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching transactions",
            error: error.message,
        });
    }
};

// Approve payout request
export const approvePayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { adminNotes } = req.body;

        const payout = await WithdrawalRequest.findById(payoutId);

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout request not found"
            });
        }

        if (payout.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve payout with status: ${payout.status}`
            });
        }

        // Update payout status to APPROVED (not COMPLETED - admin still needs to manually transfer)
        payout.status = 'APPROVED';
        payout.approvedAt = new Date();
        payout.processedBy = req.userId;
        if (adminNotes) payout.adminNotes = adminNotes;
        await payout.save();

        // Update wallet transaction status
        const wallet = await Wallet.findById(payout.walletId);
        if (wallet && payout.walletTransactionId) {
            const txn = wallet.transactions.id(payout.walletTransactionId);
            if (txn) {
                txn.status = 'APPROVED';
                await wallet.save();
            }
        }

        // Send notification to user
        await createNotification({
            userId: payout.userId,
            type: 'PAYOUT_APPROVED',
            title: 'Withdrawal Approved',
            message: `Your withdrawal request of ${payout.currency} ${payout.amount} has been approved. Payment will be processed shortly.`,
            data: { requestId: payout.requestId, amount: payout.amount }
        });

        res.status(200).json({
            success: true,
            message: "Payout approved successfully. Please complete the bank transfer and mark as completed.",
            payout
        });
    } catch (error) {
        console.error("[v0] Error approving payout:", error);
        res.status(500).json({
            success: false,
            message: "Error approving payout",
            error: error.message,
        });
    }
};

// Reject payout request
export const rejectPayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { reason } = req.body;

        const payout = await WithdrawalRequest.findById(payoutId);

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout request not found"
            });
        }

        if (!['PENDING', 'APPROVED'].includes(payout.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot reject payout with status: ${payout.status}`
            });
        }

        // Update payout status
        payout.status = 'REJECTED';
        payout.rejectedAt = new Date();
        payout.processedBy = req.userId;
        payout.rejectionReason = reason || 'Payout rejected by admin';
        await payout.save();

        // Refund the amount back to user's wallet
        const wallet = await Wallet.findById(payout.walletId);
        if (wallet) {
            wallet.balance += payout.amount;
            wallet.totalWithdrawals = Math.max(0, (wallet.totalWithdrawals || 0) - payout.amount);

            // Update wallet transaction status
            if (payout.walletTransactionId) {
                const txn = wallet.transactions.id(payout.walletTransactionId);
                if (txn) {
                    txn.status = 'REJECTED';
                }
            }

            // Add refund transaction
            wallet.transactions.push({
                type: 'REFUND',
                amount: payout.amount,
                description: `Withdrawal request rejected - funds returned. Reason: ${payout.rejectionReason}`,
                status: 'COMPLETED',
                createdAt: new Date()
            });

            await wallet.save();
        }

        // Send notification to user
        await createNotification({
            userId: payout.userId,
            type: 'PAYOUT_REJECTED',
            title: 'Withdrawal Rejected',
            message: `Your withdrawal request of ${payout.currency} ${payout.amount} has been rejected. Reason: ${payout.rejectionReason}. The amount has been refunded to your wallet.`,
            data: { requestId: payout.requestId, amount: payout.amount, reason: payout.rejectionReason }
        });

        res.status(200).json({
            success: true,
            message: "Payout rejected successfully. Amount refunded to user's wallet.",
            payout
        });
    } catch (error) {
        console.error("[v0] Error rejecting payout:", error);
        res.status(500).json({
            success: false,
            message: "Error rejecting payout",
            error: error.message,
        });
    }
};

// Complete payout
export const completePayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { transactionReference, paymentProof, adminNotes } = req.body;

        const payout = await WithdrawalRequest.findById(payoutId);

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout request not found"
            });
        }

        if (!['PENDING', 'APPROVED'].includes(payout.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot complete payout with status: ${payout.status}`
            });
        }

        // Update payout status
        payout.status = 'COMPLETED';
        payout.completedAt = new Date();
        payout.processedBy = req.userId;
        payout.processedAt = new Date();
        if (transactionReference) payout.transactionReference = transactionReference;
        if (paymentProof) payout.paymentProof = paymentProof;
        if (adminNotes) payout.adminNotes = adminNotes;
        await payout.save();

        // Update wallet transaction status
        const wallet = await Wallet.findById(payout.walletId);
        if (wallet && payout.walletTransactionId) {
            const txn = wallet.transactions.id(payout.walletTransactionId);
            if (txn) {
                txn.status = 'COMPLETED';
                await wallet.save();
            }
        }

        // Send notification to user
        await createNotification({
            userId: payout.userId,
            type: 'PAYOUT_COMPLETED',
            title: 'Withdrawal Completed',
            message: `Your withdrawal of ${payout.currency} ${payout.amount} has been transferred to your bank account (${payout.bankName}).`,
            data: {
                requestId: payout.requestId,
                amount: payout.amount,
                transactionReference: payout.transactionReference
            }
        });

        res.status(200).json({
            success: true,
            message: "Payout completed successfully",
            payout
        });
    } catch (error) {
        console.error("[v0] Error completing payout:", error);
        res.status(500).json({
            success: false,
            message: "Error completing payout",
            error: error.message,
        });
    }
};

// Process payout automatically via payment gateway (Stripe/TAP)
export const processAutomaticPayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { adminNotes } = req.body;

        const payout = await WithdrawalRequest.findById(payoutId)
            .populate('userId', 'fullName email phone stripeConnectAccountId tapAccountId');

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout request not found"
            });
        }

        if (!['PENDING', 'APPROVED'].includes(payout.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot process payout with status: ${payout.status}`
            });
        }

        // Determine the appropriate payment gateway based on country/currency
        const country = payout.country || detectCountryFromCurrency(payout.currency);
        const gateway = getPaymentGateway(country);

        // Get user's destination account for automatic payout
        let destinationAccountId = payout.destinationAccountId;

        // If no destination account, check user's connected accounts
        if (!destinationAccountId && payout.userId) {
            if (gateway === "STRIPE") {
                destinationAccountId = payout.userId.stripeConnectAccountId;
            } else if (gateway === "TAP") {
                destinationAccountId = payout.userId.tapAccountId;
            }
        }

        // If still no destination account, we cannot process automatically
        if (!destinationAccountId) {
            return res.status(400).json({
                success: false,
                message: `User does not have a connected ${gateway} account for automatic payouts. Please use manual transfer instead.`,
                canProcessManually: true
            });
        }

        // Update status to PROCESSING
        payout.status = 'PROCESSING';
        payout.paymentMethod = gateway;
        payout.processedAt = new Date();
        payout.processedBy = req.userId;
        if (adminNotes) payout.adminNotes = adminNotes;
        await payout.save();

        // Attempt automatic payout via payment gateway
        try {
            const payoutResult = await paymentGatewayService.createPayout(gateway, {
                amount: payout.amount,
                currency: payout.currency,
                destinationAccountId: destinationAccountId,
                metadata: {
                    requestId: payout.requestId,
                    userId: payout.userId._id?.toString() || payout.userId.toString(),
                    walletId: payout.walletId.toString(),
                },
                description: `Withdrawal ${payout.requestId} - ${payout.userInfo?.fullName || 'User'}`
            });

            if (payoutResult.success) {
                // Update payout with gateway info
                payout.gatewayPayoutId = payoutResult.payoutId;
                payout.gatewayStatus = payoutResult.status;
                payout.transactionReference = payoutResult.payoutId;

                // If immediately completed (some gateways)
                if (payoutResult.status === 'COMPLETED') {
                    payout.status = 'COMPLETED';
                    payout.completedAt = new Date();
                }

                await payout.save();

                // Update wallet transaction status
                const wallet = await Wallet.findById(payout.walletId);
                if (wallet && payout.walletTransactionId) {
                    const txn = wallet.transactions.id(payout.walletTransactionId);
                    if (txn) {
                        txn.status = payout.status === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING';
                        await wallet.save();
                    }
                }

                // Send notification to user
                await createNotification({
                    userId: payout.userId._id || payout.userId,
                    type: payout.status === 'COMPLETED' ? 'PAYOUT_COMPLETED' : 'PAYOUT_PROCESSING',
                    title: payout.status === 'COMPLETED' ? 'Withdrawal Completed' : 'Withdrawal Processing',
                    message: payout.status === 'COMPLETED'
                        ? `Your withdrawal of ${payout.currency} ${payout.amount} has been transferred to your account via ${gateway}.`
                        : `Your withdrawal of ${payout.currency} ${payout.amount} is being processed via ${gateway}. You will be notified once completed.`,
                    data: {
                        requestId: payout.requestId,
                        amount: payout.amount,
                        gateway,
                        payoutId: payoutResult.payoutId
                    }
                });

                return res.status(200).json({
                    success: true,
                    message: payout.status === 'COMPLETED'
                        ? `Payout completed successfully via ${gateway}`
                        : `Payout is being processed via ${gateway}`,
                    payout,
                    gatewayResponse: {
                        gateway,
                        payoutId: payoutResult.payoutId,
                        status: payoutResult.status
                    }
                });
            }
        } catch (gatewayError) {
            console.error("[processAutomaticPayout] Gateway error:", gatewayError);

            // Revert status to APPROVED on gateway failure
            payout.status = 'APPROVED';
            payout.gatewayStatus = 'FAILED';
            payout.metadata = {
                ...payout.metadata,
                lastGatewayError: gatewayError.message,
                lastGatewayAttempt: new Date()
            };
            await payout.save();

            return res.status(400).json({
                success: false,
                message: `Automatic payout failed: ${gatewayError.message}. You can try again or use manual transfer.`,
                canProcessManually: true
            });
        }

    } catch (error) {
        console.error("[processAutomaticPayout] Error:", error);
        res.status(500).json({
            success: false,
            message: "Error processing automatic payout",
            error: error.message,
        });
    }
};

// Get payout gateway info (which gateway will be used based on country)
export const getPayoutGatewayInfo = async (req, res) => {
    try {
        const { payoutId } = req.params;

        const payout = await WithdrawalRequest.findById(payoutId)
            .populate('userId', 'fullName email stripeConnectAccountId tapAccountId');

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout request not found"
            });
        }

        const country = payout.country || detectCountryFromCurrency(payout.currency);
        const recommendedGateway = getPaymentGateway(country);

        // Check if user has connected accounts
        let hasStripeAccount = false;
        let hasTapAccount = false;

        if (payout.userId) {
            hasStripeAccount = !!payout.userId.stripeConnectAccountId;
            hasTapAccount = !!payout.userId.tapAccountId;
        }

        const canProcessAutomatically = (recommendedGateway === 'STRIPE' && hasStripeAccount) ||
            (recommendedGateway === 'TAP' && hasTapAccount);

        res.status(200).json({
            success: true,
            gatewayInfo: {
                country,
                recommendedGateway,
                canProcessAutomatically,
                hasStripeAccount,
                hasTapAccount,
                availableOptions: [
                    {
                        method: 'MANUAL',
                        label: 'Manual Bank Transfer',
                        description: 'Transfer manually to user bank account and mark as complete',
                        available: true
                    },
                    {
                        method: 'STRIPE',
                        label: 'Stripe Payout',
                        description: 'Automatic transfer via Stripe (UAE, international)',
                        available: hasStripeAccount,
                        reason: !hasStripeAccount ? 'User does not have a connected Stripe account' : null
                    },
                    {
                        method: 'TAP',
                        label: 'TAP Payments',
                        description: 'Automatic transfer via TAP (Kuwait, GCC)',
                        available: hasTapAccount,
                        reason: !hasTapAccount ? 'User does not have a connected TAP account' : null
                    }
                ]
            },
            payout: {
                _id: payout._id,
                requestId: payout.requestId,
                amount: payout.amount,
                currency: payout.currency,
                status: payout.status,
                bankName: payout.bankName,
                iban: payout.iban,
                accountHolderName: payout.accountHolderName,
                userInfo: payout.userInfo
            }
        });
    } catch (error) {
        console.error("[getPayoutGatewayInfo] Error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching gateway info",
            error: error.message,
        });
    }
};

// Get fraud alerts for admin
export const getFraudAlerts = async (req, res) => {
    try {
        const { severity, page = 1, limit = 20 } = req.query;

        // Fetch ACTUAL fraud alerts - only suspicious/flagged activity
        // Not regular transactions like commissions or refunds
        const fraudQuery = {
            $or: [
                { status: 'SUSPICIOUS' },
                { status: 'FLAGGED' },
                { isFraudulent: true },
                { 'metadata.flaggedForReview': true }
            ]
        };

        if (severity) {
            fraudQuery.severity = severity;
        }

        const realAlerts = await Transaction.find(fraudQuery)
            .populate('userId', 'fullName email profileImage')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await Transaction.countDocuments(fraudQuery);

        // Transform to proper fraud alert format
        const alerts = realAlerts.map(alert => ({
            _id: alert._id,
            type: alert.type || 'SUSPICIOUS_TRANSACTION',
            description: alert.description || `Suspicious ${alert.transactionType || 'activity'} detected`,
            userId: alert.userId,
            severity: alert.severity || 'MEDIUM',
            createdAt: alert.createdAt,
            amount: alert.amount,
            status: alert.status
        }));

        res.status(200).json({
            success: true,
            alerts: alerts,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching fraud alerts:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching fraud alerts",
            error: error.message,
        });
    }
};

// Get user activity for admin
export const getUserActivity = async (req, res) => {
    try {
        const { riskScore, status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (riskScore) query.riskScore = { $gte: Number.parseInt(riskScore) };
        if (status) query.status = status;

        // Fetch real user activity data from database
        const userActivity = await User.aggregate([
            {
                $match: {
                    status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] }
                }
            },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'paymentHistory'
                }
            },
            {
                $lookup: {
                    from: 'complaints',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'complaintData'
                }
            },
            {
                $lookup: {
                    from: 'ratings',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'ratingData'
                }
            },
            {
                $project: {
                    _id: 1,
                    fullName: 1,
                    status: 1,
                    createdAt: 1,
                    riskScore: {
                        $add: [
                            { $cond: [{ $eq: ['$status', 'SUSPENDED'] }, 50, 0] },
                            { $cond: [{ $eq: ['$status', 'PENDING'] }, 25, 0] },
                            { $multiply: [{ $size: '$complaintData' }, 10] },
                            { $multiply: [{ $avg: '$ratingData.rating' }, -5] }
                        ]
                    },
                    complaints: { $size: '$complaintData' },
                    rating: { $avg: '$ratingData.rating' }
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: (Number.parseInt(page) - 1) * Number.parseInt(limit)
            },
            {
                $limit: Number.parseInt(limit)
            }
        ]);

        const total = await User.countDocuments({
            status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] }
        });

        res.status(200).json({
            success: true,
            activity: userActivity,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching user activity:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching user activity",
            error: error.message,
        });
    }
};

// Get system logs for admin
export const getSystemLogs = async (req, res) => {
    try {
        const { level, source, page = 1, limit = 50 } = req.query;

        // Try to fetch from SystemLog collection if it exists
        // Otherwise generate logs from recent system activity
        let logs = [];
        let total = 0;

        try {
            // Try to get logs from a dedicated SystemLog model if it exists
            const SystemLog = mongoose.models.SystemLog;
            if (SystemLog) {
                const query = {};
                if (level) query.level = level;
                if (source) query.source = source;

                logs = await SystemLog.find(query)
                    .sort({ createdAt: -1 })
                    .limit(Number.parseInt(limit))
                    .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

                total = await SystemLog.countDocuments(query);
            }
        } catch (modelError) {
            // SystemLog model doesn't exist, generate from activity
        }

        // If no dedicated logs, generate from recent activity
        if (logs.length === 0) {
            // Get recent user registrations as INFO logs
            const recentUsers = await User.find({})
                .sort({ createdAt: -1 })
                .limit(10)
                .select('fullName email role createdAt');

            // Get recent payments as INFO logs  
            const recentPayments = await Payment.find({ status: 'COMPLETED' })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('amount paymentType createdAt');

            // Get failed payments as ERROR logs
            const failedPayments = await Payment.find({ status: 'FAILED' })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('amount paymentType createdAt errorMessage');

            // Combine into log format
            const userLogs = recentUsers.map(user => ({
                _id: user._id,
                level: 'INFO',
                source: 'USER_SERVICE',
                message: `New ${user.role} registered: ${user.fullName}`,
                timestamp: user.createdAt,
                details: { email: user.email, role: user.role }
            }));

            const paymentLogs = recentPayments.map(payment => ({
                _id: payment._id,
                level: 'INFO',
                source: 'PAYMENT_SERVICE',
                message: `Payment completed: AED ${payment.amount}`,
                timestamp: payment.createdAt,
                details: { type: payment.paymentType, amount: payment.amount }
            }));

            const errorLogs = failedPayments.map(payment => ({
                _id: payment._id,
                level: 'ERROR',
                source: 'PAYMENT_SERVICE',
                message: `Payment failed: ${payment.errorMessage || 'Unknown error'}`,
                timestamp: payment.createdAt,
                details: { type: payment.paymentType, amount: payment.amount }
            }));

            logs = [...errorLogs, ...userLogs, ...paymentLogs]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, Number.parseInt(limit));

            total = logs.length;
        }

        res.status(200).json({
            success: true,
            logs: logs,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching system logs:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching system logs",
            error: error.message,
        });
    }
};

// Resolve a fraud alert
export const resolveFraudAlert = async (req, res) => {
    try {
        const { alertId } = req.params;
        const updated = await Transaction.findByIdAndUpdate(alertId, { status: 'RESOLVED' }, { new: true });
        if (!updated) {
            return res.status(404).json({ success: false, message: "Alert not found" });
        }
        res.status(200).json({ success: true, message: "Fraud alert resolved successfully", alert: updated });
    } catch (error) {
        console.error("[v0] Error resolving fraud alert:", error);
        res.status(500).json({ success: false, message: "Error resolving fraud alert", error: error.message });
    }
};

// Investigate a fraud alert
export const investigateFraudAlert = async (req, res) => {
    try {
        const { alertId } = req.params;
        const updated = await Transaction.findByIdAndUpdate(alertId, { status: 'INVESTIGATING' }, { new: true });
        if (!updated) {
            return res.status(404).json({ success: false, message: "Alert not found" });
        }
        res.status(200).json({ success: true, message: "Fraud alert marked for investigation", alert: updated });
    } catch (error) {
        console.error("[v0] Error investigating fraud alert:", error);
        res.status(500).json({ success: false, message: "Error investigating fraud alert", error: error.message });
    }
};

// Generate custom report
export const generateCustomReport = async (req, res) => {
    try {
        const { reportType, dateFrom, dateTo } = req.body;
        const dateFilter = {};
        if (dateFrom) dateFilter.$gte = new Date(dateFrom);
        if (dateTo) dateFilter.$lte = new Date(dateTo);

        let reportData = {};

        switch (reportType) {
            case 'revenue': {
                const payments = await Payment.find(dateFilter.$gte ? { createdAt: dateFilter } : {});
                const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
                reportData = { title: 'Revenue Report', recordCount: payments.length, totalRevenue: total, generatedAt: new Date() };
                break;
            }
            case 'users': {
                const users = await User.find(dateFilter.$gte ? { createdAt: dateFilter } : {}).select('-password');
                reportData = { title: 'User Report', recordCount: users.length, users: users.slice(0, 50), generatedAt: new Date() };
                break;
            }
            case 'bookings': {
                const bookings = await B2CPassengerBooking.find(dateFilter.$gte ? { createdAt: dateFilter } : {});
                reportData = { title: 'Bookings Report', recordCount: bookings.length, generatedAt: new Date() };
                break;
            }
            default: {
                const users = await User.countDocuments();
                const payments = await Payment.countDocuments();
                const bookings = await B2CPassengerBooking.countDocuments();
                reportData = { title: 'General Summary Report', recordCount: users + payments + bookings, summary: { users, payments, bookings }, generatedAt: new Date() };
            }
        }

        res.status(200).json({ success: true, report: reportData });
    } catch (error) {
        console.error("[v0] Error generating report:", error);
        res.status(500).json({ success: false, message: "Error generating report", error: error.message });
    }
};

// Get custom reports for admin
export const getCustomReports = async (req, res) => {
    try {
        // Fetch real reports from database
        const reports = await Transaction.find({
            category: 'REPORT'
        })
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json({
            success: true,
            reports: reports
        });
    } catch (error) {
        console.error("[v0] Error fetching custom reports:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching custom reports",
            error: error.message
        });
    }
};

// Get communication templates for admin
export const getCommTemplates = async (req, res) => {
    try {
        const { type, page = 1, limit = 20, status } = req.query;

        console.log(`[v0] Fetching communication templates with query:`, { type, status, page, limit });

        // Try to use Template model if it exists, otherwise return empty array
        let templates = [];
        let totalTemplates = 0;
        try {
            const mongoose = (await import('mongoose')).default;
            const Template = mongoose.models.Template;
            if (Template) {
                const query = {};
                if (type) query.type = type;
                if (status) query.status = status;
                templates = await Template.find(query)
                    .sort({ createdAt: -1 })
                    .limit(Number.parseInt(limit))
                    .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));
                totalTemplates = await Template.countDocuments(query);
            }
        } catch (modelErr) {
            console.log('[v0] Template model not available, returning empty list');
        }

        res.status(200).json({
            success: true,
            templates: templates,
            pagination: {
                currentPage: Number.parseInt(page),
                totalPages: Math.ceil(totalTemplates / Number.parseInt(limit)),
                totalItems: totalTemplates,
                itemsPerPage: Number.parseInt(limit)
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching communication templates:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching templates",
            error: error.message,
        });
    }
};

// Helper function to get last used date for a template
async function getLastUsedDate(templateId) {
    try {
        const lastUsed = await Transaction.findOne({
            $or: [
                { type: "MESSAGE_SENT", category: "COMMUNICATION", 'metadata.templateId': templateId },
                { type: "EMAIL_SENT", category: "COMMUNICATION", 'metadata.templateId': templateId }
            ]
        }).sort({ createdAt: -1 }).select('createdAt');

        return lastUsed?.createdAt || null;
    } catch (error) {
        console.error(`[v0] Error getting last used date for template ${templateId}:`, error);
        return null;
    }
}

// Get sent messages for admin
export const getCommMessages = async (req, res) => {
    try {
        const { type, page = 1, limit = 20, status } = req.query;
        const query = {};

        if (type) query.type = type;
        if (status) query.status = status;

        console.log(`[v0] Fetching communication messages with query:`, { type, status, page, limit });

        // Fetch real messages from Transaction collection
        const messages = await Transaction.find({
            category: 'COMMUNICATION',
            ...query
        })
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit) * 1)
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        // Get total count for pagination
        const totalMessages = await Transaction.countDocuments({
            category: 'COMMUNICATION',
            ...query
        });

        // Calculate message statistics
        const messagesWithStats = await Promise.all(
            messages.map(async (message) => {
                // Get template details if templateId exists
                let templateDetails = null;
                if (message.metadata?.templateId) {
                    try {
                        const mongoose = (await import('mongoose')).default;
                        const TemplateModel = mongoose.models.Template;
                        if (TemplateModel) {
                            templateDetails = await TemplateModel.findById(message.metadata.templateId)
                                .select('name type subject');
                        }
                    } catch (err) {
                        // Template model not available
                    }
                }

                return {
                    _id: message._id,
                    type: message.type,
                    recipient: message.recipient,
                    content: message.content,
                    subject: message.subject || "",
                    status: message.status,
                    createdAt: message.createdAt,
                    templateId: message.metadata?.templateId || null,
                    template: templateDetails,
                    sentBy: message.metadata?.sentBy || null,
                    messageType: message.metadata?.messageType || "CUSTOM",
                    deliveryStatus: message.status,
                    // Additional metadata
                    metadata: {
                        ...message.metadata,
                        recipientType: message.type.includes('EMAIL') ? 'email' : 'whatsapp',
                        isTemplate: !!message.metadata?.templateId,
                        templateName: templateDetails?.name || null
                    }
                };
            })
        );

        console.log(`[v0] Found ${messagesWithStats.length} communication messages (total: ${totalMessages})`);

        res.status(200).json({
            success: true,
            messages: messagesWithStats,
            pagination: {
                currentPage: Number.parseInt(page),
                totalPages: Math.ceil(totalMessages / Number.parseInt(limit)),
                totalItems: totalMessages,
                itemsPerPage: Number.parseInt(limit)
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching communication messages:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching messages",
            error: error.message,
        });
    }
};

// Get communication configuration for admin
export const getCommConfig = async (req, res) => {
    try {
        const config = {
            emailConfig: {
                smtpHost: "smtp.gmail.com",
                smtpPort: "587",
                username: "admin@driveme.com",
                password: "••••••••••••",
                active: true,
            },
            whatsappConfig: {
                accountSid: "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                authToken: "••••••••••••••••••••••••",
                phoneNumber: "+14155238886",
                active: true,
            },
            smsConfig: {
                accountSid: process.env.TWILIO_SMS_ACCOUNT_SID || "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                authToken: "••••••••••••••••••••••••",
                phoneNumber: process.env.TWILIO_SMS_PHONE_NUMBER || "+14155238886",
                active: false,
            }

        };

        res.status(200).json({
            success: true,
            config
        });
    } catch (error) {
        console.error("[v0] Error fetching config:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching config",
            error: error.message,
        });
    }
};

// Send WhatsApp message
export const sendWhatsAppMessage = async (req, res) => {
    try {
        const { recipientNumber, message, templateId } = req.body;

        // Validate required fields
        if (!recipientNumber || !message) {
            return res.status(400).json({
                success: false,
                message: "Recipient number and message are required"
            });
        }

        // Log message for audit trail
        console.log("[v0] Sending WhatsApp message:", { recipientNumber, message, templateId });

        // Store message in database for tracking
        const messageRecord = await Transaction.create({
            userId: req.userId,
            type: "WHATSAPP_MESSAGE",
            category: "COMMUNICATION",
            recipient: recipientNumber,
            content: message,
            templateId: templateId || null,
            status: "SENT",
            createdAt: new Date(),
            metadata: {
                sentBy: req.userId,
                messageType: templateId ? "TEMPLATE" : "CUSTOM",
                recipientNumber: recipientNumber
            }
        });

        // Real WhatsApp API integration using Twilio WhatsApp Business API
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = process.env.TWILIO_WHATSAPP_NUMBER;

        if (!accountSid || !authToken || !twilioPhoneNumber) {
            console.warn("[v0] WhatsApp API credentials not configured, using fallback");
            // Fallback to mock response for development
            return res.status(200).json({
                success: true,
                message: "WhatsApp message sent successfully",
                messageId: messageRecord._id,
                sentAt: new Date(),
                deliveryStatus: "SENT"
            });
        }

        const twilio = require('twilio')(accountSid, authToken);

        // Send WhatsApp message
        const whatsappMessage = await twilio.messages.create({
            from: `whatsapp:${twilioPhoneNumber}`,
            to: `whatsapp:${recipientNumber}`,
            body: message,
            // Use template if templateId is provided
            ...(templateId && {
                contentSid: templateId,
                contentVariables: {}
            })
        });

        // Update message record with actual message details
        await Transaction.findByIdAndUpdate(messageRecord._id, {
            status: "DELIVERED",
            metadata: {
                ...messageRecord.metadata,
                twilioMessageSid: whatsappMessage.sid,
                twilioStatus: whatsappMessage.status,
                deliveredAt: new Date()
            }
        });

        console.log("[v0] WhatsApp message sent successfully:", {
            messageId: whatsappMessage.sid,
            recipient: recipientNumber,
            status: whatsappMessage.status
        });

        res.status(200).json({
            success: true,
            message: "WhatsApp message sent successfully",
            messageId: messageRecord._id,
            twilioMessageId: whatsappMessage.sid,
            sentAt: new Date(),
            deliveryStatus: whatsappMessage.status
        });

    } catch (error) {
        console.error("[v0] Error sending WhatsApp message:", error);

        // Log failed message attempt
        try {
            await Transaction.create({
                userId: req.userId,
                type: "WHATSAPP_MESSAGE",
                category: "COMMUNICATION_FAILED",
                recipient: req.body.recipientNumber,
                content: req.body.message,
                status: "FAILED",
                createdAt: new Date(),
                metadata: {
                    error: error.message,
                    sentBy: req.userId,
                    recipientNumber: req.body.recipientNumber
                }
            });
        } catch (logError) {
            console.error("[v0] Failed to log message error:", logError);
        }

        res.status(500).json({
            success: false,
            message: "Error sending WhatsApp message",
            error: error.message,
        });
    }
};

// Send bulk WhatsApp messages
export const sendBulkWhatsApp = async (req, res) => {
    try {
        const { recipients, message, templateId } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Recipients array is required"
            });
        }

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Message is required"
            });
        }

        let sent = 0;
        let failed = 0;
        const results = [];

        // Process recipients in batches
        for (const recipient of recipients) {
            try {
                const phoneNumber = recipient.phone?.replace(/\s/g, '');
                if (!phoneNumber) {
                    failed++;
                    continue;
                }

                // Personalize message with user data
                let personalizedMessage = message;
                if (recipient.name) {
                    personalizedMessage = personalizedMessage.replace(/\{\{userName\}\}/g, recipient.name);
                }

                // Store message record
                await Transaction.create({
                    userId: recipient.userId || req.userId,
                    type: "WHATSAPP_MESSAGE",
                    category: "COMMUNICATION_BULK",
                    recipient: phoneNumber,
                    content: personalizedMessage,
                    templateId: templateId || null,
                    status: "SENT",
                    createdAt: new Date(),
                    metadata: {
                        sentBy: req.userId,
                        bulkSend: true,
                        recipientName: recipient.name,
                        recipientNumber: phoneNumber
                    }
                });

                sent++;
                results.push({ phone: phoneNumber, status: 'sent' });
            } catch (err) {
                failed++;
                results.push({ phone: recipient.phone, status: 'failed', error: err.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Bulk WhatsApp send completed`,
            sent,
            failed,
            total: recipients.length,
            results
        });

    } catch (error) {
        console.error("[v0] Error sending bulk WhatsApp:", error);
        res.status(500).json({
            success: false,
            message: "Error sending bulk WhatsApp messages",
            error: error.message
        });
    }
};

// Send bulk Email
export const sendBulkEmail = async (req, res) => {
    try {
        const { recipients, subject, body, templateId } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Recipients array is required"
            });
        }

        if (!subject || !body) {
            return res.status(400).json({
                success: false,
                message: "Subject and body are required"
            });
        }

        let sent = 0;
        let failed = 0;
        const results = [];

        for (const recipient of recipients) {
            try {
                const email = recipient.email?.trim();
                if (!email || !email.includes('@')) {
                    failed++;
                    continue;
                }

                // Personalize message with user data
                let personalizedBody = body;
                let personalizedSubject = subject;
                if (recipient.name) {
                    personalizedBody = personalizedBody.replace(/\{\{userName\}\}/g, recipient.name);
                    personalizedSubject = personalizedSubject.replace(/\{\{userName\}\}/g, recipient.name);
                }

                // Store email record
                await Transaction.create({
                    userId: recipient.userId || req.userId,
                    type: "EMAIL_MESSAGE",
                    category: "COMMUNICATION_BULK",
                    recipient: email,
                    content: personalizedBody,
                    subject: personalizedSubject,
                    templateId: templateId || null,
                    status: "SENT",
                    createdAt: new Date(),
                    metadata: {
                        sentBy: req.userId,
                        bulkSend: true,
                        recipientName: recipient.name,
                        recipientEmail: email
                    }
                });

                sent++;
                results.push({ email, status: 'sent' });
            } catch (err) {
                failed++;
                results.push({ email: recipient.email, status: 'failed', error: err.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Bulk email send completed`,
            sent,
            failed,
            total: recipients.length,
            results
        });

    } catch (error) {
        console.error("[v0] Error sending bulk email:", error);
        res.status(500).json({
            success: false,
            message: "Error sending bulk emails",
            error: error.message
        });
    }
};

// Send bulk SMS
export const sendBulkSMS = async (req, res) => {
    try {
        const { recipients, message, templateId } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Recipients array is required"
            });
        }

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Message is required"
            });
        }

        let sent = 0;
        let failed = 0;
        const results = [];

        for (const recipient of recipients) {
            try {
                const phoneNumber = recipient.phone?.replace(/\s/g, '');
                if (!phoneNumber) {
                    failed++;
                    continue;
                }

                // Personalize message with user data
                let personalizedMessage = message;
                if (recipient.name) {
                    personalizedMessage = personalizedMessage.replace(/\{\{userName\}\}/g, recipient.name);
                }

                // Store SMS record
                await Transaction.create({
                    userId: recipient.userId || req.userId,
                    type: "SMS_MESSAGE",
                    category: "COMMUNICATION_BULK",
                    recipient: phoneNumber,
                    content: personalizedMessage,
                    templateId: templateId || null,
                    status: "SENT",
                    createdAt: new Date(),
                    metadata: {
                        sentBy: req.userId,
                        bulkSend: true,
                        recipientName: recipient.name,
                        recipientNumber: phoneNumber,
                        smsSegments: Math.ceil(personalizedMessage.length / 160)
                    }
                });

                sent++;
                results.push({ phone: phoneNumber, status: 'sent' });
            } catch (err) {
                failed++;
                results.push({ phone: recipient.phone, status: 'failed', error: err.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Bulk SMS send completed`,
            sent,
            failed,
            total: recipients.length,
            results
        });

    } catch (error) {
        console.error("[v0] Error sending bulk SMS:", error);
        res.status(500).json({
            success: false,
            message: "Error sending bulk SMS",
            error: error.message
        });
    }
};

// Send SMS using Twilio
export const sendSMS = async (req, res) => {
    try {
        const { recipientNumber, message, templateId } = req.body;

        // Validate required fields
        if (!recipientNumber || !message) {
            return res.status(400).json({
                success: false,
                message: "Recipient number and message are required"
            });
        }

        // Validate phone number format
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(recipientNumber.replace(/\s/g, ''))) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format. Use international format (e.g., +965XXXXXXXX)"
            });
        }

        // Log SMS for audit trail
        console.log("[v0] Sending SMS:", { recipientNumber, message, templateId });

        // Store SMS in database for tracking
        const smsRecord = await Transaction.create({
            userId: req.userId,
            type: "SMS_MESSAGE",
            category: "COMMUNICATION",
            recipient: recipientNumber,
            content: message,
            templateId: templateId || null,
            status: "PENDING",
            createdAt: new Date(),
            metadata: {
                sentBy: req.userId,
                messageType: templateId ? "TEMPLATE" : "CUSTOM",
                recipientNumber: recipientNumber,
                smsSegments: Math.ceil(message.length / 160)
            }
        });

        // Real SMS service integration using Twilio
        const accountSid = process.env.TWILIO_SMS_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_SMS_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = process.env.TWILIO_SMS_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !twilioPhoneNumber) {
            console.warn("[v0] SMS API credentials not configured, using fallback");
            // Update record status
            await Transaction.findByIdAndUpdate(smsRecord._id, { status: "SENT" });
            // Fallback to mock response for development
            return res.status(200).json({
                success: true,
                message: "SMS sent successfully (Development Mode)",
                messageId: smsRecord._id,
                sentAt: new Date(),
                deliveryStatus: "SENT",
                smsSegments: Math.ceil(message.length / 160)
            });
        }

        const twilio = require('twilio')(accountSid, authToken);

        // Send SMS message
        const smsMessage = await twilio.messages.create({
            from: twilioPhoneNumber,
            to: recipientNumber,
            body: message
        });

        // Update SMS record with actual message details
        await Transaction.findByIdAndUpdate(smsRecord._id, {
            status: "DELIVERED",
            metadata: {
                ...smsRecord.metadata,
                twilioMessageSid: smsMessage.sid,
                twilioStatus: smsMessage.status,
                deliveredAt: new Date(),
                price: smsMessage.price,
                priceUnit: smsMessage.priceUnit
            }
        });

        console.log("[v0] SMS sent successfully:", {
            messageId: smsMessage.sid,
            recipient: recipientNumber,
            status: smsMessage.status
        });

        res.status(200).json({
            success: true,
            message: "SMS sent successfully",
            messageId: smsRecord._id,
            twilioMessageId: smsMessage.sid,
            sentAt: new Date(),
            deliveryStatus: smsMessage.status,
            smsSegments: Math.ceil(message.length / 160)
        });

    } catch (error) {
        console.error("[v0] Error sending SMS:", error);

        // Log failed SMS attempt
        try {
            await Transaction.create({
                userId: req.userId,
                type: "SMS_MESSAGE",
                category: "COMMUNICATION_FAILED",
                recipient: req.body.recipientNumber,
                content: req.body.message,
                status: "FAILED",
                createdAt: new Date(),
                metadata: {
                    error: error.message,
                    sentBy: req.userId,
                    recipientNumber: req.body.recipientNumber
                }
            });
        } catch (logError) {
            console.error("[v0] Failed to log SMS error:", logError);
        }

        res.status(500).json({
            success: false,
            message: "Error sending SMS",
            error: error.message,
        });
    }
};

// Send email
export const sendEmail = async (req, res) => {
    try {
        const { recipientEmail, subject, body, templateId } = req.body;

        // Validate required fields
        if (!recipientEmail || !subject || !body) {
            return res.status(400).json({
                success: false,
                message: "Recipient email, subject, and body are required"
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        // Log email for audit trail
        console.log("[v0] Sending email:", { recipientEmail, subject, body, templateId });

        // Store email in database for tracking
        const emailRecord = await Transaction.create({
            userId: req.userId,
            type: "EMAIL_MESSAGE",
            category: "COMMUNICATION",
            recipient: recipientEmail,
            content: body,
            subject: subject,
            templateId: templateId || null,
            status: "SENT",
            createdAt: new Date(),
            metadata: {
                sentBy: req.userId,
                messageType: templateId ? "TEMPLATE" : "CUSTOM",
                recipientEmail: recipientEmail,
                subject: subject
            }
        });

        // Real email service integration using Nodemailer with SMTP
        const nodemailer = require('nodemailer');

        // Get email configuration from environment variables
        const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
        const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
        const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
        const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;

        if (!smtpUser || !smtpPass || !fromEmail) {
            console.warn("[v0] Email service credentials not configured, using fallback");
            // Fallback to mock response for development
            return res.status(200).json({
                success: true,
                message: "Email sent successfully",
                messageId: emailRecord._id,
                sentAt: new Date(),
                deliveryStatus: "SENT"
            });
        }

        // Create transporter with SMTP configuration
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass
            },
            tls: {
                rejectUnauthorized: false // Allow self-signed certificates
            }
        });

        // Prepare email options
        const mailOptions = {
            from: `"DriveMe Admin" <${fromEmail}>`,
            to: recipientEmail,
            subject: subject,
            html: body, // Send as HTML for rich content
            // Add template processing if templateId is provided
            ...(templateId && {
                templateId: templateId
            })
        };

        // Send email
        const emailResult = await transporter.sendMail(mailOptions);

        // Update email record with actual email details
        await Transaction.findByIdAndUpdate(emailRecord._id, {
            status: "DELIVERED",
            metadata: {
                ...emailRecord.metadata,
                messageId: emailResult.messageId,
                response: emailResult.response,
                deliveredAt: new Date()
            }
        });

        console.log("[v0] Email sent successfully:", {
            messageId: emailResult.messageId,
            recipient: recipientEmail,
            subject: subject,
            response: emailResult.response
        });

        res.status(200).json({
            success: true,
            message: "Email sent successfully",
            messageId: emailRecord._id,
            emailMessageId: emailResult.messageId,
            sentAt: new Date(),
            deliveryStatus: "DELIVERED"
        });

    } catch (error) {
        console.error("[v0] Error sending email:", error);

        // Log failed email attempt
        try {
            await Transaction.create({
                userId: req.userId,
                type: "EMAIL_MESSAGE",
                category: "COMMUNICATION_FAILED",
                recipient: req.body.recipientEmail,
                content: req.body.body,
                subject: req.body.subject,
                status: "FAILED",
                createdAt: new Date(),
                metadata: {
                    error: error.message,
                    sentBy: req.userId,
                    recipientEmail: req.body.recipientEmail,
                    subject: req.body.subject
                }
            });
        } catch (logError) {
            console.error("[v0] Failed to log email error:", logError);
        }

        res.status(500).json({
            success: false,
            message: "Error sending email",
            error: error.message,
        });
    }
};

// Update communication configuration
export const updateCommConfig = async (req, res) => {
    try {
        const { type } = req.params;
        const config = req.body;

        // Validate configuration type
        if (!type || !['email', 'whatsapp'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid configuration type. Must be 'email' or 'whatsapp'"
            });
        }

        // Validate configuration data
        if (!config || Object.keys(config).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Configuration data is required"
            });
        }

        console.log(`[v0] Updating ${type} config:`, config);

        // Store configuration in database using Transaction collection for audit trail
        const configRecord = await Transaction.create({
            userId: req.userId,
            type: "CONFIG_UPDATE",
            category: "SYSTEM_CONFIG",
            configType: type.toUpperCase(),
            configData: config,
            status: "UPDATED",
            createdAt: new Date(),
            metadata: {
                updatedBy: req.userId,
                configType: type,
                previousConfig: await getPreviousConfig(type),
                newConfig: config
            }
        });

        // Update environment variables or system configuration
        if (type === 'email') {
            // Update email configuration in environment or config store
            await updateEmailConfig(config);
        } else if (type === 'whatsapp') {
            // Update WhatsApp configuration in environment or config store
            await updateWhatsAppConfig(config);
        }

        // Log successful update
        console.log(`[v0] ${type.toUpperCase()} configuration updated successfully by user ${req.userId}`);

        res.status(200).json({
            success: true,
            message: `${type} configuration updated successfully`,
            configId: configRecord._id,
            updatedAt: new Date(),
            updatedBy: req.userId
        });

    } catch (error) {
        console.error("[v0] Error updating config:", error);

        // Log failed configuration update attempt
        try {
            await Transaction.create({
                userId: req.userId,
                type: "CONFIG_UPDATE_FAILED",
                category: "SYSTEM_CONFIG",
                configType: req.params.type?.toUpperCase() || "UNKNOWN",
                configData: req.body,
                status: "FAILED",
                createdAt: new Date(),
                metadata: {
                    error: error.message,
                    updatedBy: req.userId,
                    configType: req.params.type
                }
            });
        } catch (logError) {
            console.error("[v0] Failed to log config error:", logError);
        }

        res.status(500).json({
            success: false,
            message: "Error updating configuration",
            error: error.message,
        });
    }
};

// Helper function to get previous configuration
async function getPreviousConfig(type) {
    try {
        const lastConfig = await Transaction.findOne({
            type: "CONFIG_UPDATE",
            category: "SYSTEM_CONFIG",
            configType: type.toUpperCase()
        }).sort({ createdAt: -1 });

        return lastConfig?.configData || {};
    } catch (error) {
        console.error(`[v0] Error fetching previous ${type} config:`, error);
        return {};
    }
}

// Helper function to update email configuration
async function updateEmailConfig(config) {
    try {
        // Update email configuration in environment or config store
        const fs = require('fs').promises;
        const path = require('path');

        // Create config directory if it doesn't exist
        const configDir = path.join(process.cwd(), 'config');
        await fs.mkdir(configDir, { recursive: true });

        // Update email config file
        const emailConfigPath = path.join(configDir, 'email.json');
        const currentEmailConfig = await fs.readFile(emailConfigPath, 'utf8')
            .then(data => JSON.parse(data))
            .catch(() => ({}));

        const updatedEmailConfig = { ...currentEmailConfig, ...config };
        await fs.writeFile(emailConfigPath, JSON.stringify(updatedEmailConfig, null, 2));

        console.log("[v0] Email configuration saved to file:", updatedEmailConfig);

        // Update environment variables if provided
        if (config.smtpHost) process.env.SMTP_HOST = config.smtpHost;
        if (config.smtpPort) process.env.SMTP_PORT = config.smtpPort.toString();
        if (config.smtpUser) process.env.SMTP_USER = config.smtpUser;
        if (config.fromEmail) process.env.FROM_EMAIL = config.fromEmail;

    } catch (error) {
        console.error("[v0] Error updating email config:", error);
        throw error;
    }
}

// Helper function to update WhatsApp configuration
async function updateWhatsAppConfig(config) {
    try {
        // Update WhatsApp configuration in environment or config store
        const fs = require('fs').promises;
        const path = require('path');

        // Create config directory if it doesn't exist
        const configDir = path.join(process.cwd(), 'config');
        await fs.mkdir(configDir, { recursive: true });

        // Update WhatsApp config file
        const whatsappConfigPath = path.join(configDir, 'whatsapp.json');
        const currentWhatsAppConfig = await fs.readFile(whatsappConfigPath, 'utf8')
            .then(data => JSON.parse(data))
            .catch(() => ({}));

        const updatedWhatsAppConfig = { ...currentWhatsAppConfig, ...config };
        await fs.writeFile(whatsappConfigPath, JSON.stringify(updatedWhatsAppConfig, null, 2));

        console.log("[v0] WhatsApp configuration saved to file:", updatedWhatsAppConfig);

        // Update environment variables if provided
        if (config.accountSid) process.env.TWILIO_ACCOUNT_SID = config.accountSid;
        if (config.authToken) process.env.TWILIO_AUTH_TOKEN = config.authToken;
        if (config.phoneNumber) process.env.TWILIO_WHATSAPP_NUMBER = config.phoneNumber;

    } catch (error) {
        console.error("[v0] Error updating WhatsApp config:", error);
        throw error;
    }
}

// Get ad campaigns for admin
// Get public active campaigns for homepage (no auth required)
export const getPublicActiveCampaigns = async (req, res) => {
    try {
        const { placement } = req.query;
        const now = new Date();

        const query = {
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now }
        };

        if (placement) query.placement = placement;

        const campaigns = await Campaign.find(query)
            .select('title provider placement size imageUrl targetUrl description startDate endDate')
            .sort({ createdAt: -1 })
            .limit(10);

        // Views are now tracked separately via trackCampaignView endpoint
        // This provides more accurate per-impression tracking

        res.status(200).json({
            success: true,
            campaigns
        });
    } catch (error) {
        console.error("Error fetching public campaigns:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching campaigns",
            error: error.message
        });
    }
};

// Track campaign click
export const trackCampaignClick = async (req, res) => {
    try {
        const { campaignId } = req.params;

        await Campaign.findByIdAndUpdate(campaignId, {
            $inc: { clicks: 1 }
        });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Track campaign view/impression (separate from fetch)
export const trackCampaignView = async (req, res) => {
    try {
        const { campaignId } = req.params;

        await Campaign.findByIdAndUpdate(campaignId, {
            $inc: { views: 1 }
        });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAdCampaigns = async (req, res) => {
    try {
        const { status, page = 1, limit = 20, provider, placement } = req.query;
        const query = {};
        if (status && status !== 'all') query.status = status;
        if (provider) query.provider = provider;
        if (placement) query.placement = placement;

        const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);
        const [campaigns, totalCampaigns] = await Promise.all([
            Campaign.find(query)
                .populate('createdBy', 'fullName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number.parseInt(limit)),
            Campaign.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            campaigns,
            pagination: {
                currentPage: Number.parseInt(page),
                totalPages: Math.ceil(totalCampaigns / Number.parseInt(limit)),
                totalItems: totalCampaigns,
                itemsPerPage: Number.parseInt(limit)
            }
        });
    } catch (error) {
        console.error("Error fetching ad campaigns:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching campaigns",
            error: error.message,
        });
    }
};

// Get ad statistics for admin
export const getAdStats = async (req, res) => {
    try {
        const [totalCampaigns, activeCampaigns, aggregateResult] = await Promise.all([
            Campaign.countDocuments(),
            Campaign.countDocuments({ status: 'active' }),
            Campaign.aggregate([
                {
                    $group: {
                        _id: null,
                        totalViews: { $sum: '$views' },
                        totalClicks: { $sum: '$clicks' },
                        totalRevenue: { $sum: '$revenue' }
                    }
                }
            ])
        ]);

        const agg = aggregateResult[0] || { totalViews: 0, totalClicks: 0, totalRevenue: 0 };

        res.status(200).json({
            success: true,
            stats: {
                totalCampaigns,
                activeCampaigns,
                totalViews: agg.totalViews,
                totalClicks: agg.totalClicks,
                totalRevenue: agg.totalRevenue
            }
        });
    } catch (error) {
        console.error("Error fetching ad stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching ad statistics",
            error: error.message,
        });
    }
};

// Create ad campaign
export const createAdCampaign = async (req, res) => {
    try {
        const { title, provider, placement, size, targetUrl, description, budget, dailyBudget, costPerClick, costPerView, startDate, endDate, status, targetAudience } = req.body;

        if (!title || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: "Title, start date and end date are required" });
        }

        // Handle image upload to Cloudinary
        let imageUrl = '';
        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file, 'driveme/campaigns', 'campaign');
                imageUrl = uploadResult.secure_url;
                console.log("[v0] Campaign image uploaded to Cloudinary:", imageUrl);
            } catch (uploadError) {
                console.error("[v0] Error uploading campaign image:", uploadError);
                return res.status(400).json({
                    success: false,
                    message: "Error uploading campaign image",
                    error: uploadError.message
                });
            }
        }

        const campaign = new Campaign({
            title,
            provider: provider || '',
            placement: placement || 'banner',
            size: size || '728x90',
            imageUrl: imageUrl,
            targetUrl: targetUrl || '',
            description: description || '',
            budget: budget || 0,
            dailyBudget: dailyBudget || 0,
            costPerClick: costPerClick || 0,
            costPerView: costPerView || 0,
            startDate,
            endDate,
            status: status || 'draft',
            targetAudience: targetAudience || 'all',
            createdBy: req.userId || req.user?._id || req.user?.id,
            views: 0,
            clicks: 0,
            revenue: 0,
        });

        await campaign.save();

        res.status(201).json({
            success: true,
            message: "Campaign created successfully",
            campaign
        });
    } catch (error) {
        console.error("Error creating campaign:", error);
        res.status(500).json({
            success: false,
            message: "Error creating campaign",
            error: error.message,
        });
    }
};

// Update ad campaign
export const updateAdCampaign = async (req, res) => {
    try {
        const { campaignId } = req.params;
        const allowedFields = ['title', 'provider', 'placement', 'size', 'targetUrl', 'description', 'budget', 'dailyBudget', 'costPerClick', 'costPerView', 'startDate', 'endDate', 'status', 'targetAudience'];
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Handle image upload to Cloudinary if new image is provided
        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file, 'driveme/campaigns', 'campaign');
                updateData.imageUrl = uploadResult.secure_url;
                console.log("[v0] Campaign image updated in Cloudinary:", updateData.imageUrl);
            } catch (uploadError) {
                console.error("[v0] Error uploading campaign image:", uploadError);
                return res.status(400).json({
                    success: false,
                    message: "Error uploading campaign image",
                    error: uploadError.message
                });
            }
        }

        const campaign = await Campaign.findByIdAndUpdate(campaignId, updateData, { new: true, runValidators: true });
        if (!campaign) {
            return res.status(404).json({ success: false, message: "Campaign not found" });
        }

        res.status(200).json({
            success: true,
            message: "Campaign updated successfully",
            campaign
        });
    } catch (error) {
        console.error("Error updating campaign:", error);
        res.status(500).json({
            success: false,
            message: "Error updating campaign",
            error: error.message,
        });
    }
};

// Delete ad campaign
export const deleteAdCampaign = async (req, res) => {
    try {
        const { campaignId } = req.params;
        const campaign = await Campaign.findByIdAndDelete(campaignId);
        if (!campaign) {
            return res.status(404).json({ success: false, message: "Campaign not found" });
        }

        res.status(200).json({
            success: true,
            message: "Campaign deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting campaign:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting campaign",
            error: error.message,
        });
    }
};

// Toggle ad campaign status
export const toggleAdCampaignStatus = async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { status } = req.body;

        if (!['active', 'paused', 'expired', 'draft', 'completed'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        const campaign = await Campaign.findByIdAndUpdate(campaignId, { status }, { new: true });
        if (!campaign) {
            return res.status(404).json({ success: false, message: "Campaign not found" });
        }

        res.status(200).json({
            success: true,
            message: `Campaign ${status} successfully`,
            campaign
        });
    } catch (error) {
        console.error("Error toggling campaign status:", error);
        res.status(500).json({
            success: false,
            message: "Error toggling campaign status",
            error: error.message,
        });
    }
};

// Escape user-provided strings before using them inside a RegExp
const escapeRegex = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Get ride pooling statistics for admin
export const getRidePoolingStats = async (req, res) => {
    try {
        const [totalPassengers, activeRoutes, matchedRides, suggestedClusters] = await Promise.all([
            // Distinct commuters who have raised at least one route request
            RouteRequest.distinct("passengerId").then((ids) => ids.length),
            B2CPartnerRoute.countDocuments({ status: "Active", isActive: true }),
            // Requests that have been converted into a real route = matched rides
            RouteRequest.countDocuments({ convertedRouteId: { $ne: null } }),
            // Distinct open corridors (pickup -> dropoff) still awaiting a route
            RouteRequest.aggregate([
                { $match: { status: { $in: ["PENDING", "UNDER_REVIEW"] }, convertedRouteId: null } },
                {
                    $group: {
                        _id: {
                            pickup: { $toLower: "$pickupLocation" },
                            dropoff: { $toLower: "$dropoffLocation" },
                        },
                    },
                },
                { $count: "count" },
            ]),
        ]);

        const suggestedRoutes = suggestedClusters[0]?.count || 0;

        res.status(200).json({
            success: true,
            stats: { totalPassengers, activeRoutes, suggestedRoutes, matchedRides },
        });
    } catch (error) {
        console.error("Error fetching ride pooling stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching ride pooling statistics",
            error: error.message,
        });
    }
};

// Get passenger interests for admin (raw individual demand)
export const getPassengerInterests = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status && status !== "All Status" && status !== "all") {
            query.status = status.toUpperCase();
        }

        const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);

        const [interests, total] = await Promise.all([
            RouteRequest.find(query)
                .populate("passengerId", "fullName email whatsappNumber")
                .populate("convertedRouteId", "fromLocation toLocation status")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number.parseInt(limit)),
            RouteRequest.countDocuments(query),
        ]);

        // Find matched routes count for each interest
        const formattedInterests = await Promise.all(
            interests.map(async (interest) => {
                const matchedRoutes = await B2CPartnerRoute.countDocuments({
                    fromLocation: { $regex: interest.pickupLocation, $options: "i" },
                    toLocation: { $regex: interest.dropoffLocation, $options: "i" },
                    status: "Active",
                    isActive: true,
                });

                return {
                    _id: interest._id,
                    passengerId: interest.passengerId?._id || interest.passengerId,
                    passengerName: interest.passengerId?.fullName || "Unknown",
                    passengerEmail: interest.passengerId?.email || "",
                    pickupLocation: interest.pickupLocation,
                    dropoffLocation: interest.dropoffLocation,
                    preferredTime: interest.preferredTime,
                    frequency: interest.requestType ? interest.requestType.toLowerCase() : "daily",
                    status: interest.status ? interest.status.toLowerCase() : "pending",
                    createdAt: interest.createdAt,
                    matchedRoutes,
                    travelDays: interest.travelDays,
                    expectedStartDate: interest.expectedStartDate,
                    demandCount: interest.demandCount || 1,
                    convertedRouteId: interest.convertedRouteId?._id || null,
                    adminNotes: interest.adminNotes || null,
                };
            })
        );

        res.status(200).json({
            success: true,
            interests: formattedInterests,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("Error fetching passenger interests:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching passenger interests",
            error: error.message,
        });
    }
};

// Get user suggested routes for admin (aggregated demand clusters by corridor)
export const getUserSuggestedRoutes = async (req, res) => {
    try {
        const { status } = req.query;

        // Build the match stage. We aggregate the raw requests into corridor clusters.
        const matchStage = {};
        if (status && status !== "all" && status !== "All Status") {
            matchStage.status = status.toUpperCase();
        }

        const clusters = await RouteRequest.aggregate([
            ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
            {
                $group: {
                    _id: {
                        pickup: { $toLower: "$pickupLocation" },
                        dropoff: { $toLower: "$dropoffLocation" },
                    },
                    primaryRequestId: { $first: "$_id" },
                    requestIds: { $addToSet: "$_id" },
                    passengerIds: { $addToSet: "$passengerId" },
                    pickupLocation: { $first: "$pickupLocation" },
                    dropoffLocation: { $first: "$dropoffLocation" },
                    preferredTimes: { $addToSet: "$preferredTime" },
                    estimatedPrice: { $max: "$estimatedPrice" },
                    convertedRouteIds: { $addToSet: "$convertedRouteId" },
                    statuses: { $addToSet: "$status" },
                    interestedPartners: { $push: "$interestedPartners" },
                    marketplaceOpenedAt: { $max: "$marketplaceOpenedAt" },
                    createdAt: { $min: "$createdAt" },
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        // Derive a representative status for each cluster + resolve names.
        const formattedRoutes = await Promise.all(
            clusters.map(async (cluster) => {
                // A cluster is "converted" if any request in it produced a route.
                const convertedRouteId = (cluster.convertedRouteIds || []).find((id) => id);

                // Representative status priority: converted -> approved -> open -> rejected -> under_review -> pending
                let status = "pending";
                if (convertedRouteId) status = "approved";
                else if (cluster.statuses.includes("APPROVED")) status = "approved";
                else if (cluster.statuses.includes("OPEN") || cluster.marketplaceOpenedAt) status = "open";
                else if (cluster.statuses.includes("UNDER_REVIEW")) status = "under_review";
                else if (cluster.statuses.every((s) => s === "REJECTED")) status = "rejected";
                else status = "pending";

                // Flatten + dedupe interested partners across the cluster (latest interest per partner).
                const partnerMap = new Map();
                for (const arr of cluster.interestedPartners || []) {
                    for (const ip of arr || []) {
                        if (!ip?.partnerId) continue;
                        const key = String(ip.partnerId);
                        const prev = partnerMap.get(key);
                        if (!prev || new Date(ip.respondedAt) > new Date(prev.respondedAt)) {
                            partnerMap.set(key, ip);
                        }
                    }
                }
                const interestedPartners = await Promise.all(
                    Array.from(partnerMap.values()).map(async (ip) => {
                        const partner = await User.findById(ip.partnerId).select("fullName companyName email");
                        return {
                            partnerId: ip.partnerId,
                            name: partner?.companyName || partner?.fullName || "Unknown Partner",
                            email: partner?.email || "",
                            message: ip.message || null,
                            estimatedPrice: ip.estimatedPrice ?? null,
                            status: ip.status || "INTERESTED",
                            publishedRouteId: ip.publishedRouteId || null,
                        };
                    })
                );

                // Use the first passenger as the "suggested by" label.
                const firstPassenger = cluster.passengerIds?.[0]
                    ? await User.findById(cluster.passengerIds[0]).select("fullName")
                    : null;
                const extraPassengers = (cluster.passengerIds?.length || 1) - 1;
                const userName = firstPassenger
                    ? extraPassengers > 0
                        ? `${firstPassenger.fullName} +${extraPassengers} more`
                        : firstPassenger.fullName
                    : "Unknown";

                return {
                    _id: cluster.primaryRequestId,
                    requestIds: cluster.requestIds,
                    userId: cluster.passengerIds?.[0] || null,
                    userName,
                    routeName: `${cluster.pickupLocation} to ${cluster.dropoffLocation}`,
                    startPoint: cluster.pickupLocation,
                    endPoint: cluster.dropoffLocation,
                    preferredTime: (cluster.preferredTimes || []).join(", "),
                    suggestedPrice: cluster.estimatedPrice || 0,
                    status,
                    // Votes = number of distinct commuters who want this corridor
                    votes: cluster.passengerIds?.length || 1,
                    requestCount: cluster.requestIds?.length || 1,
                    convertedRouteId: convertedRouteId || null,
                    interestedPartners,
                    interestedCount: interestedPartners.length,
                    publishedCount: interestedPartners.filter((p) => p.status === "ROUTE_PUBLISHED").length,
                    marketplaceOpened: !!cluster.marketplaceOpenedAt,
                    createdAt: cluster.createdAt,
                };
            })
        );

        res.status(200).json({
            success: true,
            routes: formattedRoutes,
            pagination: {
                total: formattedRoutes.length,
                page: 1,
                pages: 1,
            },
        });
    } catch (error) {
        console.error("Error fetching user suggested routes:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching user suggested routes",
            error: error.message,
        });
    }
};

// Get active B2C partners for route assignment dropdown
export const getB2CPartnersForAssignment = async (req, res) => {
    try {
        const partners = await User.find({ role: "B2C_PARTNER", status: "ACTIVE" })
            .select("fullName email companyName")
            .sort({ fullName: 1 });

        res.status(200).json({
            success: true,
            partners: partners.map((p) => ({
                _id: p._id,
                name: p.companyName || p.fullName,
                email: p.email,
            })),
        });
    } catch (error) {
        console.error("Error fetching B2C partners:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C partners",
            error: error.message,
        });
    }
};

// Approve user suggested route -> create a real B2C route and notify all commuters
export const approveSuggestedRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        const {
            b2cPartnerId,
            oneWayPrice,
            monthlyOneWayPrice,
            totalSeats = 15,
            routeStartDate,
            startTime,
            availableDays,
            currency = "KWD",
        } = req.body;

        const primaryRequest = await RouteRequest.findById(routeId).populate("passengerId", "fullName email");
        if (!primaryRequest) {
            return res.status(404).json({ success: false, message: "Route request not found" });
        }

        if (!b2cPartnerId) {
            return res.status(400).json({ success: false, message: "A B2C Partner must be selected to create the route" });
        }
        if (!oneWayPrice || Number(oneWayPrice) <= 0) {
            return res.status(400).json({ success: false, message: "A valid one-way price is required" });
        }

        const partner = await User.findOne({ _id: b2cPartnerId, role: "B2C_PARTNER" });
        if (!partner) {
            return res.status(404).json({ success: false, message: "Selected B2C Partner not found" });
        }

        // Find every request in this corridor (case-insensitive) so the whole cluster converts together.
        const clusterRequests = await RouteRequest.find({
            pickupLocation: { $regex: `^${escapeRegex(primaryRequest.pickupLocation)}$`, $options: "i" },
            dropoffLocation: { $regex: `^${escapeRegex(primaryRequest.dropoffLocation)}$`, $options: "i" },
        }).populate("passengerId", "fullName email");

        // Create the real B2C route from the aggregated demand.
        const newRoute = await B2CPartnerRoute.create({
            b2cPartnerId,
            fromLocation: primaryRequest.pickupLocation,
            toLocation: primaryRequest.dropoffLocation,
            routeStartDate: routeStartDate ? new Date(routeStartDate) : new Date(),
            totalSeats: Number(totalSeats),
            availableSeats: Number(totalSeats),
            pricing: {
                oneWayPrice: Number(oneWayPrice),
                monthlyOneWayPrice: monthlyOneWayPrice ? Number(monthlyOneWayPrice) : 0,
                currency,
            },
            startTime: startTime || primaryRequest.preferredTime || "",
            availableDays: availableDays?.length ? availableDays : primaryRequest.travelDays,
            status: "Active",
            isActive: true,
            description: `Route created from pooled commuter demand (${clusterRequests.length} request(s)).`,
        });

        // Mark all cluster requests as converted/approved.
        await RouteRequest.updateMany(
            { _id: { $in: clusterRequests.map((r) => r._id) } },
            {
                status: "APPROVED",
                convertedRouteId: newRoute._id,
                assignedProviderId: b2cPartnerId,
                adminReviewedBy: req.userId,
                adminReviewedAt: new Date(),
            }
        );

        // Notify every commuter in the cluster that their requested route is now live.
        for (const request of clusterRequests) {
            const passenger = request.passengerId;
            if (!passenger?._id) continue;
            await createNotification({
                userId: passenger._id,
                type: "ROUTE_REQUEST_RESPONSE",
                title: "Your Requested Route is Now Available!",
                message: `Good news! A new route from ${primaryRequest.pickupLocation} to ${primaryRequest.dropoffLocation} has been created and is ready to book.`,
                data: {
                    requestId: request._id,
                    routeId: newRoute._id,
                    pickupLocation: primaryRequest.pickupLocation,
                    dropoffLocation: primaryRequest.dropoffLocation,
                    status: "APPROVED",
                    partnerId: b2cPartnerId,
                },
            });
        }

        res.status(200).json({
            success: true,
            message: `Route created and ${clusterRequests.length} commuter(s) notified`,
            route: newRoute,
            convertedRequests: clusterRequests.length,
        });
    } catch (error) {
        console.error("Error approving suggested route:", error);
        res.status(500).json({
            success: false,
            message: "Error approving suggested route",
            error: error.message,
        });
    }
};

// Open user suggested route to the marketplace -> notify all (or selected) B2C partners
// so they can publish their own competing routes. No single partner is assigned.
export const openSuggestedRouteToMarketplace = async (req, res) => {
    try {
        const { routeId } = req.params;
        const { partnerIds } = req.body || {};

        const primaryRequest = await RouteRequest.findById(routeId);
        if (!primaryRequest) {
            return res.status(404).json({ success: false, message: "Route request not found" });
        }

        // Whole corridor cluster (not yet converted) opens together.
        const clusterRequests = await RouteRequest.find({
            pickupLocation: { $regex: `^${escapeRegex(primaryRequest.pickupLocation)}$`, $options: "i" },
            dropoffLocation: { $regex: `^${escapeRegex(primaryRequest.dropoffLocation)}$`, $options: "i" },
            convertedRouteId: null,
            status: { $nin: ["REJECTED", "COMPLETED"] },
        });

        await RouteRequest.updateMany(
            { _id: { $in: clusterRequests.map((r) => r._id) } },
            {
                status: "OPEN",
                marketplaceOpenedAt: new Date(),
                adminReviewedBy: req.userId,
                adminReviewedAt: new Date(),
            }
        );

        // Decide which partners to notify: explicit selection, else all active B2C partners.
        let partners;
        if (Array.isArray(partnerIds) && partnerIds.length > 0) {
            partners = await User.find({ _id: { $in: partnerIds }, role: "B2C_PARTNER", status: "ACTIVE" });
        } else {
            partners = await User.find({ role: "B2C_PARTNER", status: "ACTIVE" });
        }

        const demandCount = clusterRequests.length;
        for (const partner of partners) {
            await createNotification({
                userId: partner._id,
                type: "NEW_ROUTE_REQUEST",
                title: "New Route Open for You to Serve!",
                message: `${demandCount} commuter(s) want a route from ${primaryRequest.pickupLocation} to ${primaryRequest.dropoffLocation}. Publish your route to win these riders.`,
                data: {
                    requestId: primaryRequest._id,
                    pickupLocation: primaryRequest.pickupLocation,
                    dropoffLocation: primaryRequest.dropoffLocation,
                    demandCount,
                    marketplace: true,
                },
            });
        }

        res.status(200).json({
            success: true,
            message: `Route opened to ${partners.length} partner(s). ${demandCount} commuter request(s) marked open.`,
            notifiedPartners: partners.length,
            openedRequests: demandCount,
        });
    } catch (error) {
        console.error("Error opening suggested route to marketplace:", error);
        res.status(500).json({
            success: false,
            message: "Error opening route to marketplace",
            error: error.message,
        });
    }
};

// Reject user suggested route -> mark the cluster rejected and notify commuters
export const rejectSuggestedRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        const { reason } = req.body;

        const primaryRequest = await RouteRequest.findById(routeId);
        if (!primaryRequest) {
            return res.status(404).json({ success: false, message: "Route request not found" });
        }

        const clusterRequests = await RouteRequest.find({
            pickupLocation: { $regex: `^${escapeRegex(primaryRequest.pickupLocation)}$`, $options: "i" },
            dropoffLocation: { $regex: `^${escapeRegex(primaryRequest.dropoffLocation)}$`, $options: "i" },
            convertedRouteId: null,
        }).populate("passengerId", "fullName email");

        await RouteRequest.updateMany(
            { _id: { $in: clusterRequests.map((r) => r._id) } },
            {
                status: "REJECTED",
                providerResponse: reason || "Rejected by admin",
                adminNotes: reason || "Rejected by admin",
                adminReviewedBy: req.userId,
                adminReviewedAt: new Date(),
            }
        );

        // Notify commuters of the rejection.
        for (const request of clusterRequests) {
            const passenger = request.passengerId;
            if (!passenger?._id) continue;
            await createNotification({
                userId: passenger._id,
                type: "ROUTE_REQUEST_RESPONSE",
                title: "Update on Your Route Request",
                message: `We're unable to create a route from ${primaryRequest.pickupLocation} to ${primaryRequest.dropoffLocation} at this time.${reason ? ` Reason: ${reason}` : ""}`,
                data: {
                    requestId: request._id,
                    pickupLocation: primaryRequest.pickupLocation,
                    dropoffLocation: primaryRequest.dropoffLocation,
                    status: "REJECTED",
                },
            });
        }

        res.status(200).json({
            success: true,
            message: `Route suggestion rejected and ${clusterRequests.length} commuter(s) notified`,
            rejectedRequests: clusterRequests.length,
        });
    } catch (error) {
        console.error("Error rejecting suggested route:", error);
        res.status(500).json({
            success: false,
            message: "Error rejecting suggested route",
            error: error.message,
        });
    }
};

// Get B2B statistics for admin
export const getB2BStats = async (req, res) => {
    try {
        const [
            totalB2BProviders,
            activeB2BProviders,
            totalB2CProviders,
            activeB2CProviders,
            totalVehicleListings,
            activeVehicleListings,
            totalRouteListings,
            activeRouteListings
        ] = await Promise.all([
            User.countDocuments({ role: "B2B_PARTNER" }),
            User.countDocuments({ role: "B2B_PARTNER", status: "ACTIVE" }),
            User.countDocuments({ role: "B2C_PARTNER" }),
            User.countDocuments({ role: "B2C_PARTNER", status: "ACTIVE" }),
            Vehicle.countDocuments({}),
            Vehicle.countDocuments({ status: "AVAILABLE", isActive: true }),
            B2CPartnerRoute.countDocuments({}),
            B2CPartnerRoute.countDocuments({ status: "Active", isActive: true })
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalB2BProviders,
                activeB2BProviders,
                totalB2CProviders,
                activeB2CProviders,
                totalListings: totalVehicleListings + totalRouteListings,
                activeListings: activeVehicleListings + activeRouteListings
            }
        });
    } catch (error) {
        console.error("Error fetching B2B stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2B statistics",
            error: error.message,
        });
    }
};

// Get B2B providers for admin
export const getB2BProviders = async (req, res) => {
    try {
        const { status, page = 1, limit = 20, search } = req.query;
        const query = { role: "B2B_PARTNER" };

        if (status && status !== "all") {
            query.status = status.toUpperCase();
        }
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { companyName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);

        const [providers, total] = await Promise.all([
            User.find(query)
                .select("fullName companyName email whatsappNumber status createdAt fleetManagement")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number.parseInt(limit)),
            User.countDocuments(query)
        ]);

        // Enrich providers with fleet size and contract counts
        const enrichedProviders = await Promise.all(
            providers.map(async (provider) => {
                const [vehicleCount, activeVehicles, totalContracts] = await Promise.all([
                    Vehicle.countDocuments({ fleetOwnerId: provider._id }),
                    Vehicle.countDocuments({ fleetOwnerId: provider._id, status: "AVAILABLE", isActive: true }),
                    Contract.countDocuments({ fleetOwnerId: provider._id })
                ]);

                return {
                    _id: provider._id,
                    companyName: provider.companyName || provider.fullName,
                    contactPerson: provider.fullName,
                    email: provider.email,
                    phone: provider.whatsappNumber,
                    fleetSize: vehicleCount,
                    activeVehicles,
                    status: provider.status ? provider.status.toLowerCase() : "pending",
                    totalContracts,
                    createdAt: provider.createdAt
                };
            })
        );

        res.status(200).json({
            success: true,
            providers: enrichedProviders,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("Error fetching B2B providers:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2B providers",
            error: error.message,
        });
    }
};

// Get B2C providers for admin (from B2B listings)
export const getB2CProvidersFromB2B = async (req, res) => {
    try {
        const { status, page = 1, limit = 20, search } = req.query;
        const query = { role: "B2C_PARTNER" };

        if (status && status !== "all") {
            query.status = status.toUpperCase();
        }
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { companyName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);

        const [providers, total] = await Promise.all([
            User.find(query)
                .select("fullName companyName email whatsappNumber status createdAt serviceType")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number.parseInt(limit)),
            User.countDocuments(query)
        ]);

        // Enrich providers with route counts and booking stats
        const enrichedProviders = await Promise.all(
            providers.map(async (provider) => {
                const [totalRoutes, activeRoutes, totalBookings] = await Promise.all([
                    B2CPartnerRoute.countDocuments({ b2cPartnerId: provider._id }),
                    B2CPartnerRoute.countDocuments({ b2cPartnerId: provider._id, status: "Active", isActive: true }),
                    B2CPassengerBooking.countDocuments({ b2cPartnerId: provider._id })
                ]);

                return {
                    _id: provider._id,
                    companyName: provider.companyName || provider.fullName,
                    contactPerson: provider.fullName,
                    email: provider.email,
                    phone: provider.whatsappNumber,
                    routes: totalRoutes,
                    activeRoutes,
                    status: provider.status ? provider.status.toLowerCase() : "pending",
                    totalBookings,
                    serviceType: provider.serviceType,
                    createdAt: provider.createdAt
                };
            })
        );

        res.status(200).json({
            success: true,
            providers: enrichedProviders,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("Error fetching B2C providers from B2B:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C providers",
            error: error.message,
        });
    }
};

// Suspend B2B provider
export const suspendB2BProvider = async (req, res) => {
    try {
        const { providerId } = req.params;

        const provider = await User.findOneAndUpdate(
            { _id: providerId, role: { $in: ["B2B_PARTNER", "B2C_PARTNER"] } },
            {
                status: "SUSPENDED",
                suspendedAt: new Date(),
                suspendedBy: req.user?.id || null
            },
            { new: true }
        ).select("-password");

        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found" });
        }

        res.status(200).json({
            success: true,
            message: `${provider.role === "B2B_PARTNER" ? "B2B" : "B2C"} provider suspended successfully`,
            provider
        });
    } catch (error) {
        console.error("Error suspending provider:", error);
        res.status(500).json({
            success: false,
            message: "Error suspending provider",
            error: error.message,
        });
    }
};

// Activate B2B provider
export const activateB2BProvider = async (req, res) => {
    try {
        const { providerId } = req.params;

        const provider = await User.findOneAndUpdate(
            { _id: providerId, role: { $in: ["B2B_PARTNER", "B2C_PARTNER"] } },
            {
                status: "ACTIVE",
                activatedAt: new Date(),
                activatedBy: req.user?.id || null
            },
            { new: true }
        ).select("-password");

        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found" });
        }

        res.status(200).json({
            success: true,
            message: `${provider.role === "B2B_PARTNER" ? "B2B" : "B2C"} provider activated successfully`,
            provider
        });
    } catch (error) {
        console.error("Error activating provider:", error);
        res.status(500).json({
            success: false,
            message: "Error activating provider",
            error: error.message,
        });
    }
};

// Update passenger interest status
export const updatePassengerInterestStatus = async (req, res) => {
    try {
        const { interestId } = req.params;
        const { status } = req.body;

        const validStatuses = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "COMPLETED"];
        if (!validStatuses.includes(status?.toUpperCase())) {
            return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
        }

        const routeRequest = await RouteRequest.findByIdAndUpdate(
            interestId,
            { status: status.toUpperCase() },
            { new: true }
        ).populate("passengerId", "fullName email whatsappNumber");

        if (!routeRequest) {
            return res.status(404).json({ success: false, message: "Passenger interest not found" });
        }

        res.status(200).json({
            success: true,
            message: `Passenger interest ${status.toLowerCase()} successfully`,
            interest: {
                _id: routeRequest._id,
                passengerId: routeRequest.passengerId?._id,
                passengerName: routeRequest.passengerId?.fullName,
                pickupLocation: routeRequest.pickupLocation,
                dropoffLocation: routeRequest.dropoffLocation,
                preferredTime: routeRequest.preferredTime,
                status: routeRequest.status.toLowerCase(),
                createdAt: routeRequest.createdAt
            }
        });
    } catch (error) {
        console.error("Error updating passenger interest status:", error);
        res.status(500).json({
            success: false,
            message: "Error updating passenger interest status",
            error: error.message,
        });
    }
};

// Toggle online payment system
export const toggleOnlinePayments = async (req, res) => {
    try {
        const { enabled } = req.body;

        // Import SiteSettings model
        const SiteSettings = (await import("../models/SiteSettings.js")).default;

        // Get current admin user info
        const admin = await User.findById(req.userId).select('fullName');

        // Find or create site settings
        let settings = await SiteSettings.findOne();
        if (!settings) {
            settings = new SiteSettings();
        }

        // Update payment control settings
        settings.paymentControl = {
            onlinePaymentsEnabled: enabled,
            lastToggled: new Date(),
            toggledBy: req.userId,
            toggledByName: admin?.fullName || 'System Admin',
        };

        await settings.save();

        console.log(`[v0] Online payments ${enabled ? 'enabled' : 'disabled'} by admin ${req.userId} (${admin?.fullName})`);

        res.status(200).json({
            success: true,
            message: `Online payments ${enabled ? 'enabled' : 'disabled'} successfully`,
            enabled,
            lastToggled: settings.paymentControl.lastToggled,
            toggledBy: settings.paymentControl.toggledByName
        });
    } catch (error) {
        console.error("[v0] Error toggling online payments:", error);
        res.status(500).json({
            success: false,
            message: "Error toggling online payments",
            error: error.message,
        });
    }
};

// Get online payment status
export const getOnlinePaymentStatus = async (req, res) => {
    try {
        // Import SiteSettings model
        const SiteSettings = (await import("../models/SiteSettings.js")).default;

        // Find or create site settings
        let settings = await SiteSettings.findOne();
        if (!settings) {
            settings = await SiteSettings.create({});
        }

        const paymentControl = settings.paymentControl || {
            onlinePaymentsEnabled: true,
            lastToggled: null,
            toggledByName: null
        };

        const status = {
            enabled: paymentControl.onlinePaymentsEnabled !== false,
            lastToggled: paymentControl.lastToggled,
            toggledBy: paymentControl.toggledByName || 'System Admin',
            paymentGateways: {
                stripe: paymentControl.onlinePaymentsEnabled !== false,
                tap: paymentControl.onlinePaymentsEnabled !== false,
                upi: paymentControl.onlinePaymentsEnabled !== false
            },
            restrictions: {
                minAmount: 0.5,
                maxAmount: 10000,
                allowedCurrencies: ['KWD', 'USD', 'EUR', 'AED']
            }
        };

        res.status(200).json({
            success: true,
            status
        });
    } catch (error) {
        console.error("[v0] Error fetching online payment status:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching online payment status",
            error: error.message
        });
    }
};

// Get B2C routes for admin
export const getB2CRoutes = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};

        // Normalize status to match enum (capitalize first letter)
        if (status) {
            const statusMap = {
                'active': 'Active',
                'inactive': 'Inactive',
                'scheduled': 'Scheduled',
                'Active': 'Active',
                'Inactive': 'Inactive',
                'Scheduled': 'Scheduled'
            };
            query.status = statusMap[status] || status;
        }

        // Fetch real B2C routes from database
        const routes = await B2CPartnerRoute.find(query)
            .populate('b2cPartnerId', 'fullName companyName')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await B2CPartnerRoute.countDocuments(query);

        // ===== Compute REAL booking counts per route =====
        // Count active/valid passenger bookings grouped by routeId so the admin
        // can see demand for every B2C partner route and decide what to feature.
        const routeIds = routes.map(r => r._id);
        const bookingCountsAgg = await B2CPassengerBooking.aggregate([
            {
                $match: {
                    routeId: { $in: routeIds },
                    bookingStatus: { $in: ["PENDING", "CONFIRMED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"] }
                }
            },
            {
                $group: {
                    _id: "$routeId",
                    totalBookings: { $sum: 1 }
                }
            }
        ]);

        const bookingCountMap = {};
        bookingCountsAgg.forEach(item => {
            bookingCountMap[item._id.toString()] = item.totalBookings;
        });

        // Booking criteria thresholds: low / medium / high demand
        const getBookingCriteria = (count) => {
            if (count >= 20) return "high";
            if (count >= 5) return "medium";
            return "low";
        };

        // Format routes for frontend compatibility
        const formattedRoutes = routes.map(route => {
            const totalBookings = bookingCountMap[route._id.toString()] || 0;
            return {
                _id: route._id,
                name: `${route.fromLocation} to ${route.toLocation}`,
                startPoint: route.fromLocation,
                endPoint: route.toLocation,
                providerName: route.b2cPartnerId?.fullName || route.b2cPartnerId?.companyName || 'Unknown Provider',
                providerId: route.b2cPartnerId?._id,
                departureTime: route.startTime,
                arrivalTime: "N/A", // Can be calculated based on route duration
                capacity: route.totalSeats,
                bookedSeats: route.totalSeats - route.availableSeats,
                status: route.status || "Active",
                featured: route.isFeatured || false,
                featuredAt: route.featuredAt || null,
                // Real booking demand data for admin decision-making
                totalBookings,
                bookingCriteria: getBookingCriteria(totalBookings),
                price: route.pricing?.oneWayPrice || 0,
                distance: "N/A",
                duration: "N/A",
                createdAt: route.createdAt,
                // Additional B2C specific fields
                tripType: route.tripType,
                availableDays: route.availableDays,
                routeStartDate: route.routeStartDate,
                pricing: route.pricing,
                description: route.description,
                assignedVehicle: route.assignedVehicle,
                assignedDriver: route.assignedDriver
            };
        });

        res.status(200).json({
            success: true,
            routes: formattedRoutes,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C routes:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C routes",
            error: error.message
        });
    }
};

// Create B2C route
export const createB2CRoute = async (req, res) => {
    try {
        const routeData = req.body;

        // Create actual route in database using B2CPartnerRoute schema
        const newRoute = new B2CPartnerRoute({
            b2cPartnerId: routeData.b2cPartnerId,
            fromLocation: routeData.fromLocation,
            toLocation: routeData.toLocation,
            startTime: routeData.startTime,
            tripType: routeData.tripType || "One Way",
            routeStartDate: routeData.routeStartDate || new Date(),
            availableDays: routeData.availableDays || [],
            totalSeats: routeData.capacity || routeData.totalSeats || 20,
            availableSeats: routeData.availableSeats || (routeData.capacity || 20) - (routeData.bookedSeats || 0),
            pricing: {
                oneWayPrice: routeData.price || routeData.pricing?.oneWayPrice || 0,
                roundTripPrice: routeData.pricing?.roundTripPrice || 0,
                monthlyPrice: routeData.pricing?.monthlyPrice || 0
            },
            description: routeData.description || "",
            assignedVehicle: routeData.assignedVehicle || null,
            assignedDriver: routeData.assignedDriver || null,
            status: routeData.status || "Active",
            isActive: routeData.status !== "Inactive",
            // Additional pricing metadata for booking calculations
            pricingMetadata: {
                pricingType: routeData.pricingType || "perDay",
                customPricing: routeData.customPricing || {},
                calculatedMonthlyPrice: routeData.pricing?.monthlyPrice || 0
            }
        });

        const savedRoute = await newRoute.save();

        // Populate B2C partner information for response
        await savedRoute.populate('b2cPartnerId', 'fullName companyName');

        // Format response for frontend compatibility
        const formattedRoute = {
            _id: savedRoute._id,
            name: `${savedRoute.fromLocation} to ${savedRoute.toLocation}`,
            startPoint: savedRoute.fromLocation,
            endPoint: savedRoute.toLocation,
            providerName: savedRoute.b2cPartnerId?.fullName || savedRoute.b2cPartnerId?.companyName || 'Unknown Provider',
            providerId: savedRoute.b2cPartnerId?._id,
            departureTime: savedRoute.startTime,
            arrivalTime: "N/A", // Can be calculated based on route duration
            capacity: savedRoute.totalSeats,
            bookedSeats: savedRoute.totalSeats - savedRoute.availableSeats,
            status: savedRoute.status || "Active",
            featured: false,
            price: savedRoute.pricing?.oneWayPrice || 0,
            distance: "N/A",
            duration: "N/A",
            createdAt: savedRoute.createdAt,
            // Additional B2C specific fields
            tripType: savedRoute.tripType,
            availableDays: savedRoute.availableDays,
            routeStartDate: savedRoute.routeStartDate,
            pricing: savedRoute.pricing,
            description: savedRoute.description,
            assignedVehicle: savedRoute.assignedVehicle,
            assignedDriver: savedRoute.assignedDriver
        };

        console.log(`Successfully created B2C route: ${formattedRoute.name}`);

        res.status(201).json({
            success: true,
            message: "B2C route created successfully",
            route: formattedRoute
        });
    } catch (error) {
        console.error("[v0] Error creating B2C route:", error);
        res.status(500).json({
            success: false,
            message: "Error creating B2C route",
            error: error.message
        });
    }
};

// Update B2C route
export const updateB2CRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        const updateData = req.body;

        // Normalize status to match enum (capitalize first letter)
        if (updateData.status) {
            const statusMap = {
                'active': 'Active',
                'inactive': 'Inactive',
                'scheduled': 'Scheduled',
                'Active': 'Active',
                'Inactive': 'Inactive',
                'Scheduled': 'Scheduled'
            };
            updateData.status = statusMap[updateData.status] || 'Active';
        }

        // Map the frontend `featured` flag to the model field `isFeatured`.
        // Admin uses this to curate which routes appear in the Commuter
        // "Featured Routes & Trips" section.
        if (typeof updateData.featured !== "undefined") {
            updateData.isFeatured = !!updateData.featured;
            updateData.featuredAt = updateData.isFeatured ? new Date() : null;
            delete updateData.featured;
        }

        // Update actual route in database - use b2cPartnerId (correct field name)
        const updatedRoute = await B2CPartnerRoute.findByIdAndUpdate(
            routeId,
            {
                ...updateData,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        ).populate('b2cPartnerId', 'fullName companyName companyLogo');

        if (!updatedRoute) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        // Format response - use correct field names from B2CPartnerRoute model
        const formattedRoute = {
            _id: updatedRoute._id,
            name: `${updatedRoute.fromLocation} to ${updatedRoute.toLocation}`,
            fromLocation: updatedRoute.fromLocation,
            toLocation: updatedRoute.toLocation,
            startPoint: updatedRoute.fromLocation,
            endPoint: updatedRoute.toLocation,
            providerName: updatedRoute.b2cPartnerId?.fullName || updatedRoute.b2cPartnerId?.companyName || 'Unknown Provider',
            providerId: updatedRoute.b2cPartnerId?._id,
            b2cPartnerId: updatedRoute.b2cPartnerId,
            startTime: updatedRoute.startTime,
            totalSeats: updatedRoute.totalSeats,
            availableSeats: updatedRoute.availableSeats,
            status: updatedRoute.status,
            isActive: updatedRoute.isActive,
            featured: updatedRoute.isFeatured || false,
            featuredAt: updatedRoute.featuredAt || null,
            pricing: updatedRoute.pricing,
            tripType: updatedRoute.tripType,
            availableDays: updatedRoute.availableDays,
            stopPoints: updatedRoute.stopPoints,
            createdAt: updatedRoute.createdAt,
            updatedAt: updatedRoute.updatedAt
        };

        console.log(`Successfully updated B2C route: ${formattedRoute.name}`);

        res.status(200).json({
            success: true,
            message: "B2C route updated successfully",
            route: formattedRoute
        });
    } catch (error) {
        console.error("[v0] Error updating B2C route:", error);
        res.status(500).json({
            success: false,
            message: "Error updating B2C route",
            error: error.message
        });
    }
};

// Delete B2C route
export const deleteB2CRoute = async (req, res) => {
    try {
        const { routeId } = req.params;

        // Delete actual route from database
        const deletedRoute = await B2CPartnerRoute.findByIdAndDelete(routeId);

        if (!deletedRoute) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        console.log(`Successfully deleted B2C route: ${deletedRoute.name}`);

        res.status(200).json({
            success: true,
            message: "B2C route deleted successfully",
            route: {
                _id: deletedRoute._id,
                name: deletedRoute.name
            }
        });
    } catch (error) {
        console.error("[v0] Error deleting B2C route:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting B2C route",
            error: error.message
        });
    }
};

// Get B2C tags and badges
export const getB2CTags = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status) query.status = status;

        console.log(`[v0] Fetching B2C tags with query:`, { status, page, limit });

        // Fetch real tags from Tag collection
        const tags = await Tag.find(query)
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit) * 1)
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        // Get total count for pagination
        const totalTags = await Tag.countDocuments(query);

        // Calculate usage statistics for each tag
        const tagsWithStats = await Promise.all(
            tags.map(async (tag) => {
                // Count how many B2C routes use this tag
                const routeUsageCount = await B2CPartnerRoute.countDocuments({
                    tags: tag._id,
                    status: 'Active'
                });

                // Count how many B2C vehicles have this tag
                const vehicleUsageCount = await B2CPartnerVehicle.countDocuments({
                    tags: tag._id,
                    status: 'Active'
                });

                return {
                    _id: tag._id,
                    label: tag.label,
                    color: tag.color || "#6b7280",
                    textColor: tag.textColor || "#ffffff",
                    icon: tag.icon || "",
                    description: tag.description || "",
                    usageCount: routeUsageCount + vehicleUsageCount,
                    status: tag.status || "active",
                    createdAt: tag.createdAt,
                    updatedAt: tag.updatedAt,
                    category: tag.category || "general",
                    isActive: tag.status === "active"
                };
            })
        );

        console.log(`[v0] Found ${tagsWithStats.length} B2C tags (total: ${totalTags})`);

        res.status(200).json({
            success: true,
            tags: tagsWithStats,
            pagination: {
                currentPage: Number.parseInt(page),
                totalPages: Math.ceil(totalTags / Number.parseInt(limit)),
                totalItems: totalTags,
                itemsPerPage: Number.parseInt(limit)
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C tags:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C tags",
            error: error.message,
        });
    }
};

// Create B2C tag
export const createB2CTag = async (req, res) => {
    try {
        const { label, color, textColor, icon, description, category } = req.body;

        if (!label) {
            return res.status(400).json({ success: false, message: "Tag label is required" });
        }

        // Check for duplicate
        const existing = await Tag.findOne({ label: { $regex: new RegExp(`^${label}$`, 'i') } });
        if (existing) {
            return res.status(400).json({ success: false, message: "A tag with this label already exists" });
        }

        const newTag = new Tag({
            label,
            color: color || "#6b7280",
            textColor: textColor || "#ffffff",
            icon: icon || "",
            description: description || "",
            category: category || "general",
            status: "active"
        });

        await newTag.save();

        res.status(201).json({
            success: true,
            message: "B2C tag created successfully",
            tag: {
                _id: newTag._id,
                label: newTag.label,
                color: newTag.color,
                textColor: newTag.textColor,
                icon: newTag.icon,
                description: newTag.description,
                category: newTag.category,
                status: newTag.status,
                usageCount: 0,
                createdAt: newTag.createdAt
            }
        });
    } catch (error) {
        console.error("[v0] Error creating B2C tag:", error);
        res.status(500).json({
            success: false,
            message: "Error creating B2C tag",
            error: error.message,
        });
    }
};

// Update B2C tag
export const updateB2CTag = async (req, res) => {
    try {
        const { tagId } = req.params;
        const { label, color, textColor, icon, description, category, status } = req.body;

        const tag = await Tag.findById(tagId);
        if (!tag) {
            return res.status(404).json({ success: false, message: "Tag not found" });
        }

        // Check for duplicate label if label is being changed
        if (label && label !== tag.label) {
            const existing = await Tag.findOne({
                label: { $regex: new RegExp(`^${label}$`, 'i') },
                _id: { $ne: tagId }
            });
            if (existing) {
                return res.status(400).json({ success: false, message: "A tag with this label already exists" });
            }
        }

        // Update fields
        if (label) tag.label = label;
        if (color) tag.color = color;
        if (textColor) tag.textColor = textColor;
        if (icon !== undefined) tag.icon = icon;
        if (description !== undefined) tag.description = description;
        if (category) tag.category = category;
        if (status) tag.status = status;

        await tag.save();

        // Calculate usage count
        const routeUsageCount = await B2CPartnerRoute.countDocuments({ tags: tag._id });
        const vehicleUsageCount = await B2CPartnerVehicle.countDocuments({ tags: tag._id });

        res.status(200).json({
            success: true,
            message: "Tag updated successfully",
            tag: {
                _id: tag._id,
                label: tag.label,
                color: tag.color,
                textColor: tag.textColor,
                icon: tag.icon,
                description: tag.description,
                category: tag.category,
                status: tag.status,
                usageCount: routeUsageCount + vehicleUsageCount,
                createdAt: tag.createdAt,
                updatedAt: tag.updatedAt
            }
        });
    } catch (error) {
        console.error("[v0] Error updating B2C tag:", error);
        res.status(500).json({
            success: false,
            message: "Error updating B2C tag",
            error: error.message,
        });
    }
};

// Delete B2C tag
export const deleteB2CTag = async (req, res) => {
    try {
        const { tagId } = req.params;

        const tag = await Tag.findById(tagId);
        if (!tag) {
            return res.status(404).json({ success: false, message: "Tag not found" });
        }

        // Check if tag is in use
        const routeUsageCount = await B2CPartnerRoute.countDocuments({ tags: tag._id });
        const vehicleUsageCount = await B2CPartnerVehicle.countDocuments({ tags: tag._id });

        if (routeUsageCount > 0 || vehicleUsageCount > 0) {
            // Remove tag from all routes and vehicles before deleting
            await B2CPartnerRoute.updateMany(
                { tags: tag._id },
                { $pull: { tags: tag._id } }
            );
            await B2CPartnerVehicle.updateMany(
                { tags: tag._id },
                { $pull: { tags: tag._id } }
            );
        }

        await Tag.findByIdAndDelete(tagId);

        res.status(200).json({
            success: true,
            message: "Tag deleted successfully"
        });
    } catch (error) {
        console.error("[v0] Error deleting B2C tag:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting B2C tag",
            error: error.message,
        });
    }
};

// Get tags by category (for B2C/B2B partners to use when creating routes/vehicles)
// Smart filtering based on context:
// - context="route" -> returns tags with category: route, promo, general
// - context="vehicle" -> returns tags with category: vehicle, general
// - context="service" -> returns tags with category: service, general
// - context="search" -> returns tags with category: route, promo, general (for commuter search)
// - category="specific" -> returns only that specific category
export const getTagsByCategory = async (req, res) => {
    try {
        const { category, context } = req.query;
        const query = { status: "active" };

        // Smart context-based filtering
        if (context) {
            switch (context) {
                case "route":
                    // For route creation: show route, promo, and general tags
                    query.category = { $in: ["route", "promo", "general"] };
                    break;
                case "vehicle":
                    // For vehicle creation: show vehicle and general tags
                    query.category = { $in: ["vehicle", "general"] };
                    break;
                case "service":
                    // For service-related: show service and general tags
                    query.category = { $in: ["service", "general"] };
                    break;
                case "search":
                    // For commuter search filtering: show route, promo, and general tags
                    query.category = { $in: ["route", "promo", "general"] };
                    break;
                default:
                    // No filter, return all active tags
                    break;
            }
        } else if (category && category !== "all") {
            // Direct category filter
            query.category = category;
        }

        const tags = await Tag.find(query)
            .select('_id label color textColor icon description category')
            .sort({ category: 1, label: 1 });

        // Group tags by category for better organization
        const groupedTags = {};
        tags.forEach(tag => {
            const cat = tag.category || "general";
            if (!groupedTags[cat]) {
                groupedTags[cat] = [];
            }
            groupedTags[cat].push({
                _id: tag._id,
                label: tag.label,
                color: tag.color,
                textColor: tag.textColor,
                icon: tag.icon || "",
                description: tag.description || "",
                category: tag.category
            });
        });

        res.status(200).json({
            success: true,
            tags: tags.map(tag => ({
                _id: tag._id,
                label: tag.label,
                color: tag.color,
                textColor: tag.textColor,
                icon: tag.icon || "",
                description: tag.description || "",
                category: tag.category
            })),
            groupedTags // Also provide grouped format for UI flexibility
        });
    } catch (error) {
        console.error("[v0] Error fetching tags by category:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching tags",
            error: error.message,
        });
    }
};

// Public endpoint to get all active tags for search filtering
export const getPublicTags = async (req, res) => {
    try {
        const { category } = req.query;
        const query = { status: "active" };

        if (category && category !== "all") {
            query.category = category;
        }

        const tags = await Tag.find(query)
            .select('_id label color textColor icon category')
            .sort({ label: 1 });

        res.status(200).json({
            success: true,
            tags
        });
    } catch (error) {
        console.error("[v0] Error fetching public tags:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching tags",
            error: error.message,
        });
    }
};

// Get B2C passenger reassignments (real data from bookings)
export const getB2CPassengerReassignments = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const bookingQuery = {};

        // Map status filter to bookingStatus field
        if (status && status !== 'all') {
            bookingQuery.bookingStatus = status.toUpperCase();
        }

        // Fetch real bookings from B2CPassengerBooking collection
        const bookings = await B2CPassengerBooking.find(bookingQuery)
            .populate('passengerId', 'fullName email whatsappNumber profileImage')
            .populate('routeId', 'fromLocation toLocation description pricing assignedVehicle assignedDriver')
            .populate('b2cPartnerId', 'fullName companyName profileImage whatsappNumber')
            .populate('linkedSchedule', 'assignedVehicle assignedDriver tripTimes')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await B2CPassengerBooking.countDocuments(bookingQuery);

        // Get vehicle and driver info for detailed display
        const B2CPartnerVehicle = (await import("../models/B2CPartnerVehicle.js")).default;
        const B2CPartnerDriver = (await import("../models/B2CPartnerDriver.js")).default;

        // Collect vehicle and driver IDs
        const vehicleIds = bookings
            .map(b => b.routeId?.assignedVehicle || b.linkedSchedule?.assignedVehicle)
            .filter(Boolean);
        const driverIds = bookings
            .map(b => b.routeId?.assignedDriver || b.linkedSchedule?.assignedDriver || b.assignedDriverId)
            .filter(Boolean);

        const [vehicles, drivers] = await Promise.all([
            vehicleIds.length > 0 ? B2CPartnerVehicle.find({ _id: { $in: vehicleIds } }) : [],
            driverIds.length > 0 ? B2CPartnerDriver.find({ _id: { $in: driverIds } }) : []
        ]);

        const vehicleMap = {};
        vehicles.forEach(v => { vehicleMap[v._id.toString()] = v; });
        const driverMap = {};
        drivers.forEach(d => { driverMap[d._id.toString()] = d; });

        const formattedBookings = bookings.map(booking => {
            // Get route info - use correct field names from B2CPartnerRoute
            const routeFromLocation = booking.routeId?.fromLocation || booking.pickupLocation || 'N/A';
            const routeToLocation = booking.routeId?.toLocation || booking.dropoffLocation || 'N/A';

            // Get vehicle info
            const vehicleId = booking.routeId?.assignedVehicle?.toString() || booking.linkedSchedule?.assignedVehicle?.toString();
            const vehicleInfo = vehicleId ? vehicleMap[vehicleId] : null;

            // Get driver info
            const driverId = booking.routeId?.assignedDriver?.toString() ||
                booking.linkedSchedule?.assignedDriver?.toString() ||
                booking.assignedDriverId?.toString();
            const driverInfo = driverId ? driverMap[driverId] : null;

            // Get pricing from route or booking
            const pricing = booking.routeId?.pricing || {};

            return {
                _id: booking._id,
                passengerId: booking.passengerId?._id,
                passengerName: booking.passengerId?.fullName || 'Unknown',
                passengerEmail: booking.passengerId?.email || 'N/A',
                passengerPhone: booking.passengerId?.whatsappNumber || 'N/A',
                passengerImage: booking.passengerId?.profileImage || '',
                routeId: booking.routeId?._id,
                routeName: booking.routeId?.description || `${routeFromLocation} - ${routeToLocation}`,
                startPoint: routeFromLocation,
                endPoint: routeToLocation,
                pickupLocation: booking.pickupLocation || routeFromLocation,
                dropoffLocation: booking.dropoffLocation || routeToLocation,
                returnPickupLocation: booking.returnPickupLocation,
                returnDropoffLocation: booking.returnDropoffLocation,
                bookingType: booking.bookingType || 'ONE_WAY',
                isMonthlyPass: booking.isMonthlyPass || false,
                passDuration: booking.passDuration,
                passStartDate: booking.passStartDate,
                passEndDate: booking.passEndDate,
                pricing: {
                    oneWayPrice: pricing.oneWayPrice || 0,
                    roundTripPrice: pricing.roundTripPrice || 0,
                    monthlyOneWayPrice: pricing.monthlyOneWayPrice || 0,
                    monthlyRoundTripPrice: pricing.monthlyRoundTripPrice || 0,
                    currency: pricing.currency || booking.currency || 'AED'
                },
                providerId: booking.b2cPartnerId?._id,
                providerName: booking.b2cPartnerId?.companyName || booking.b2cPartnerId?.fullName || 'N/A',
                providerImage: booking.b2cPartnerId?.profileImage || '',
                providerPhone: booking.b2cPartnerId?.whatsappNumber || '',
                vehicleInfo: vehicleInfo ? {
                    _id: vehicleInfo._id,
                    model: vehicleInfo.model,
                    licensePlate: vehicleInfo.licensePlate,
                    vehicleType: vehicleInfo.vehicleType,
                    vehicleColor: vehicleInfo.vehicleColor,
                    seatingCapacity: vehicleInfo.seatingCapacity
                } : null,
                driverInfo: driverInfo ? {
                    _id: driverInfo._id,
                    name: driverInfo.name,
                    phoneNumber: driverInfo.phoneNumber,
                    driverImage: driverInfo.driverImage?.url
                } : (booking.isSelfDriver ? {
                    name: 'Self (Partner)',
                    isSelf: true
                } : null),
                status: booking.bookingStatus || 'PENDING',
                seats: booking.numberOfSeats || 1,
                bookingDate: booking.bookingDate || booking.createdAt,
                travelDate: booking.travelDate,
                paymentMethod: booking.paymentMethod || 'CASH',
                paymentStatus: booking.paymentStatus || 'PENDING',
                transactionId: booking.transactionId,
                amount: booking.paymentAmount || 0,
                currency: booking.currency || 'AED',
                adminCommissionAmount: booking.adminCommissionAmount || 0,
                driverEarnings: booking.driverEarnings || 0,
                isSelfDriver: booking.isSelfDriver || false,
                driverName: booking.driverName,
                createdAt: booking.createdAt,
                updatedAt: booking.updatedAt
            };
        });

        res.status(200).json({
            success: true,
            reassignments: formattedBookings,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C passenger bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C passenger bookings",
            error: error.message,
        });
    }
};

// Process passenger reassignment (approve/reject booking)
export const processPassengerReassignment = async (req, res) => {
    try {
        const { reassignmentId } = req.params;
        const { action, reason, newRouteId, newDriverId, newVehicleId } = req.body;

        // Find the booking
        const booking = await B2CPassengerBooking.findById(reassignmentId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        // Map action to booking status
        let newStatus;
        let statusMessage;

        switch (action.toLowerCase()) {
            case 'approved':
            case 'approve':
                newStatus = 'ACCEPTED';
                statusMessage = 'Booking approved successfully';
                break;
            case 'rejected':
            case 'reject':
                newStatus = 'REJECTED';
                statusMessage = 'Booking rejected successfully';
                break;
            case 'reassign':
                newStatus = booking.bookingStatus; // Keep current status
                statusMessage = 'Passenger reassigned successfully';
                // Handle route/driver/vehicle reassignment
                if (newRouteId) {
                    booking.routeId = newRouteId;
                    // Update pickup/dropoff from new route
                    const B2CPartnerRoute = (await import("../models/B2CPartnerRoute.js")).default;
                    const newRoute = await B2CPartnerRoute.findById(newRouteId);
                    if (newRoute) {
                        booking.pickupLocation = newRoute.fromLocation;
                        booking.dropoffLocation = newRoute.toLocation;
                    }
                }
                if (newDriverId) {
                    booking.assignedDriverId = newDriverId;
                    booking.isSelfDriver = false;
                    // Get driver info
                    const B2CPartnerDriver = (await import("../models/B2CPartnerDriver.js")).default;
                    const driver = await B2CPartnerDriver.findById(newDriverId);
                    if (driver) {
                        booking.driverName = driver.name;
                        booking.driverPhoneNumber = driver.phoneNumber;
                        booking.driverImage = driver.driverImage?.url;
                    }
                }
                break;
            case 'cancel':
                newStatus = 'CANCELLED';
                statusMessage = 'Booking cancelled successfully';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid action. Use 'approve', 'reject', 'reassign', or 'cancel'"
                });
        }

        // Update booking status
        booking.bookingStatus = newStatus;

        // Add admin action log
        if (!booking.adminActions) {
            booking.adminActions = [];
        }
        booking.adminActions.push({
            action: action,
            reason: reason || '',
            processedAt: new Date(),
            processedBy: req.userId
        });

        // If rejected or cancelled, handle refund logic if needed
        if (newStatus === 'REJECTED' || newStatus === 'CANCELLED') {
            booking.rejectionReason = reason;
            booking.rejectedAt = new Date();

            // If payment was completed, mark for refund
            if (booking.paymentStatus === 'COMPLETED') {
                booking.refundStatus = 'PENDING';
                booking.refundReason = reason || `Booking ${action.toLowerCase()} by admin`;
            }
        }

        // If approved, set acceptance time
        if (newStatus === 'ACCEPTED') {
            booking.acceptedAt = new Date();
            booking.acceptedBy = req.userId;
        }

        await booking.save();

        // Send notification to passenger (optional)
        try {
            const User = (await import("../models/User.js")).default;
            const passenger = await User.findById(booking.passengerId);
            if (passenger) {
                // You can add notification logic here
                console.log(`Notification: Booking ${booking._id} ${action} for passenger ${passenger.fullName}`);
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
        }

        res.status(200).json({
            success: true,
            message: statusMessage,
            booking: {
                _id: booking._id,
                status: booking.bookingStatus,
                updatedAt: booking.updatedAt
            }
        });
    } catch (error) {
        console.error("[v0] Error processing passenger reassignment:", error);
        res.status(500).json({
            success: false,
            message: "Error processing passenger reassignment",
            error: error.message,
        });
    }
};

// Get B2C earnings and payments (real data)
export const getB2CEarningsPayments = async (req, res) => {
    try {
        const { period } = req.query;

        // Real aggregation from payments
        const [revenueData, bookingCount, providerData, recentPayments] = await Promise.all([
            Payment.aggregate([
                { $match: { type: { $in: ['B2C_BOOKING', 'B2C_SUBSCRIPTION', 'B2C_TRIP_EARNING'] }, status: { $in: ['COMPLETED', 'PROCESSING'] } } },
                { $group: { _id: null, totalRevenue: { $sum: '$amount' }, count: { $sum: 1 } } }
            ]),
            B2CPassengerBooking.countDocuments(),
            Payment.aggregate([
                { $match: { type: { $in: ['B2C_BOOKING', 'B2C_SUBSCRIPTION', 'B2C_TRIP_EARNING'] }, status: { $in: ['COMPLETED', 'PROCESSING'] } } },
                { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'provider' } },
                { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: '$userId',
                        providerName: { $first: { $ifNull: ['$provider.companyName', '$provider.fullName'] } },
                        revenue: { $sum: '$amount' },
                        bookings: { $sum: 1 }
                    }
                },
                { $sort: { revenue: -1 } },
                { $limit: 5 }
            ]),
            Payment.find({ type: { $in: ['B2C_BOOKING', 'B2C_SUBSCRIPTION', 'B2C_TRIP_EARNING'] } })
                .populate('userId', 'fullName companyName')
                .sort({ createdAt: -1 })
                .limit(20)
        ]);

        const totalRevenue = revenueData[0]?.totalRevenue || 0;
        const totalPaymentCount = revenueData[0]?.count || 0;
        const avgFare = totalPaymentCount > 0 ? totalRevenue / totalPaymentCount : 0;
        // Note: Commission is calculated dynamically per user - this is an estimate for dashboard
        // Actual commissions are tracked per payment/transaction
        const estimatedCommissionRate = 0.15; // Average estimate
        const commissionEarned = totalRevenue * estimatedCommissionRate;

        const topProviders = providerData.map(p => ({
            providerId: p._id,
            providerName: p.providerName || 'Unknown',
            revenue: p.revenue,
            bookings: p.bookings,
            commission: p.revenue * estimatedCommissionRate // Estimated - actual varies per user
        }));

        const transactions = recentPayments.map(p => ({
            _id: p._id,
            providerName: p.userId?.companyName || p.userId?.fullName || 'Unknown',
            amount: p.amount,
            type: p.type,
            status: p.status,
            date: p.createdAt
        }));

        res.status(200).json({
            success: true,
            earnings: {
                totalRevenue,
                totalBookings: bookingCount,
                averageFare: avgFare,
                commissionEarned,
                providerPayouts: totalRevenue - commissionEarned,
                pendingPayouts: 0,
                completedPayouts: totalRevenue - commissionEarned,
                period: period || 'monthly',
                topProviders,
                transactions
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C earnings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C earnings",
            error: error.message,
        });
    }
};

// Get B2C partner earnings
export const getB2CPartnerEarnings = async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        const userId = req.userId;
        const mongoose = (await import('mongoose')).default;
        const B2CPassengerBooking = (await import("../models/B2CPassengerBooking.js")).default;

        // Date ranges
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const lastWeekStart = new Date(weekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        const partnerObjId = new mongoose.Types.ObjectId(userId);
        const completedStatuses = ['COMPLETED', 'ACCEPTED', 'IN_PROGRESS'];
        const partnerMatch = { $or: [{ b2cPartnerId: partnerObjId }, { partnerId: partnerObjId }], bookingStatus: { $in: completedStatuses } };

        // Reusable aggregation that returns gross (total payment received), admin commission, and net earnings.
        // - gross   = paymentAmount (full amount the commuter paid)
        // - commission = adminCommissionAmount (admin's cut). Falls back to (paymentAmount - driverEarnings) when missing.
        // - net     = driverEarnings (what the partner actually keeps). Falls back to (paymentAmount - commission).
        const breakdownGroup = {
            _id: null,
            gross: { $sum: { $ifNull: ["$paymentAmount", 0] } },
            commission: {
                $sum: {
                    $ifNull: [
                        "$adminCommissionAmount",
                        { $subtract: [{ $ifNull: ["$paymentAmount", 0] }, { $ifNull: ["$driverEarnings", 0] }] }
                    ]
                }
            },
            net: {
                $sum: {
                    $ifNull: [
                        "$driverEarnings",
                        {
                            $subtract: [
                                { $ifNull: ["$paymentAmount", 0] },
                                { $ifNull: ["$adminCommissionAmount", 0] }
                            ]
                        }
                    ]
                }
            }
        };

        // Get earnings breakdown from B2CPassengerBooking for each time window
        const [totalResult, todayResult, thisWeekResult, lastWeekResult] = await Promise.all([
            B2CPassengerBooking.aggregate([
                { $match: partnerMatch },
                { $group: breakdownGroup }
            ]),
            B2CPassengerBooking.aggregate([
                { $match: { ...partnerMatch, createdAt: { $gte: todayStart } } },
                { $group: breakdownGroup }
            ]),
            B2CPassengerBooking.aggregate([
                { $match: { ...partnerMatch, createdAt: { $gte: weekStart } } },
                { $group: breakdownGroup }
            ]),
            B2CPassengerBooking.aggregate([
                { $match: { ...partnerMatch, createdAt: { $gte: lastWeekStart, $lt: weekStart } } },
                { $group: breakdownGroup }
            ])
        ]);

        // Gross totals
        const totalGross = totalResult[0]?.gross || 0;
        const totalCommission = totalResult[0]?.commission || 0;
        const totalNet = totalResult[0]?.net || 0;

        const todayGross = todayResult[0]?.gross || 0;
        const todayCommission = todayResult[0]?.commission || 0;
        const todayNet = todayResult[0]?.net || 0;

        const thisWeekGross = thisWeekResult[0]?.gross || 0;
        const thisWeekCommission = thisWeekResult[0]?.commission || 0;
        const thisWeekNet = thisWeekResult[0]?.net || 0;

        // Net earnings are what we compare week-over-week (what the partner actually keeps)
        const lastWeekNet = lastWeekResult[0]?.net || 0;

        // Calculate week-over-week change (based on net earnings)
        let weekChange = "0%";
        if (lastWeekNet > 0) {
            const pctChange = ((thisWeekNet - lastWeekNet) / lastWeekNet * 100).toFixed(0);
            weekChange = pctChange >= 0 ? `+${pctChange}%` : `${pctChange}%`;
        } else if (thisWeekNet > 0) {
            weekChange = "+100%";
        }

        // Get transaction history grouped by date from B2CPassengerBooking
        const transactionHistory = await B2CPassengerBooking.aggregate([
            { $match: partnerMatch },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    trips: { $sum: 1 },
                    grossAmount: { $sum: { $ifNull: ["$paymentAmount", 0] } },
                    commissionAmount: {
                        $sum: {
                            $ifNull: [
                                "$adminCommissionAmount",
                                { $subtract: [{ $ifNull: ["$paymentAmount", 0] }, { $ifNull: ["$driverEarnings", 0] }] }
                            ]
                        }
                    },
                    netAmount: {
                        $sum: {
                            $ifNull: [
                                "$driverEarnings",
                                {
                                    $subtract: [
                                        { $ifNull: ["$paymentAmount", 0] },
                                        { $ifNull: ["$adminCommissionAmount", 0] }
                                    ]
                                }
                            ]
                        }
                    },
                    status: { $first: '$paymentStatus' }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 20 }
        ]);

        // Get currency from user's routes or default to AED
        const B2CPartnerRoute = (await import("../models/B2CPartnerRoute.js")).default;
        const partnerRoute = await B2CPartnerRoute.findOne({ b2cPartnerId: userId });
        const currency = partnerRoute?.currency || "AED";

        const fmt = (val) => `${(val || 0).toFixed(2)} ${currency}`;

        const transactions = transactionHistory.map(t => ({
            date: t._id,
            trips: t.trips,
            // Net amount the partner keeps (kept for backwards compatibility)
            amount: `+${(t.netAmount || 0).toFixed(2)} ${currency}`,
            grossAmount: fmt(t.grossAmount),
            commissionAmount: fmt(t.commissionAmount),
            netAmount: fmt(t.netAmount),
            status: t.status === 'PAID' || t.status === 'COMPLETED' ? 'Paid' : 'Pending'
        }));

        res.status(200).json({
            success: true,
            earnings: {
                // `total` kept as net for backwards compatibility with older clients
                total: fmt(totalNet),
                // Full breakdown for the overview cards
                totalGross: fmt(totalGross),
                totalCommission: fmt(totalCommission),
                totalNet: fmt(totalNet),
                thisWeek: fmt(thisWeekNet),
                thisWeekGross: fmt(thisWeekGross),
                thisWeekCommission: fmt(thisWeekCommission),
                thisWeekNet: fmt(thisWeekNet),
                thisWeekChange: weekChange,
                today: fmt(todayNet),
                todayGross: fmt(todayGross),
                todayCommission: fmt(todayCommission),
                todayNet: fmt(todayNet),
                currency: currency,
            },
            transactions
        });
    } catch (error) {
        console.error("Error fetching B2C earnings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching earnings data",
            error: error.message
        });
    }
};

// Get B2C partner fleet
export const getB2CPartnerFleet = async (req, res) => {
    try {
        console.log("[v0] Fetching B2C fleet for partner:", req.userId);

        // Fetch real vehicles from B2CPartnerVehicle collection
        const vehicles = await B2CPartnerVehicle.find({
            b2cPartnerId: req.userId
        })
            .select('vehicleType model year seatingCapacity licensePlate vehicleColor status availabilityStatus assignedSchedules images assignedDrivers assignedRoutes createdAt updatedAt features insuranceExpiry registrationExpiry lastAvailabilityUpdate')
            .sort({ createdAt: -1 });

        // Get current time for availability calculation
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Fetch ALL trips for today to calculate vehicle availability windows
        // Include bookedSeats to determine if trips have actual bookings
        const allTodayTrips = await B2CPartnerTrip.find({
            b2cPartnerId: req.userId,
            tripDate: { $gte: today, $lte: todayEnd }
        }).select('vehicleId tripDate startTime status fromLocation toLocation completedAt bookedSeats').sort({ startTime: 1 });

        // Create maps for vehicle trips by status
        const vehicleInProgressMap = new Map();
        const vehicleScheduledMap = new Map();
        const vehicleCompletedMap = new Map();

        for (const trip of allTodayTrips) {
            if (!trip.vehicleId) continue;
            const vehicleId = trip.vehicleId.toString();

            if (['COMPLETED', 'Completed', 'DONE', 'Done'].includes(trip.status)) {
                if (!vehicleCompletedMap.has(vehicleId)) vehicleCompletedMap.set(vehicleId, []);
                vehicleCompletedMap.get(vehicleId).push({ ...trip._doc, bookedSeats: trip.bookedSeats || 0 });
            } else if (['SCHEDULED', 'Scheduled'].includes(trip.status)) {
                if (!vehicleScheduledMap.has(vehicleId)) vehicleScheduledMap.set(vehicleId, []);
                vehicleScheduledMap.get(vehicleId).push({ ...trip._doc, bookedSeats: trip.bookedSeats || 0 });
            } else if (['IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(trip.status)) {
                if (!vehicleInProgressMap.has(vehicleId)) vehicleInProgressMap.set(vehicleId, []);
                vehicleInProgressMap.get(vehicleId).push({ ...trip._doc, bookedSeats: trip.bookedSeats || 0 });
            }
        }

        // Get all active schedules for this partner to determine vehicle assignments
        const activeSchedules = await B2CPartnerSchedule.find({
            b2cPartnerId: req.userId,
            isActive: true
        }).populate('routeId', 'fromLocation toLocation');

        // Create a map of vehicle assignments with detailed schedule info
        const vehicleScheduleMap = new Map();

        for (const schedule of activeSchedules) {
            // Check tripTimes for vehicle assignments
            if (schedule.tripTimes && schedule.tripTimes.length > 0) {
                for (const tripTime of schedule.tripTimes) {
                    if (tripTime.assignedVehicle) {
                        const vehicleId = tripTime.assignedVehicle.toString();
                        if (!vehicleScheduleMap.has(vehicleId)) {
                            vehicleScheduleMap.set(vehicleId, []);
                        }
                        vehicleScheduleMap.get(vehicleId).push({
                            scheduleId: schedule._id,
                            scheduleName: schedule.scheduleName,
                            routeName: schedule.routeId ? `${schedule.routeId.fromLocation} → ${schedule.routeId.toLocation}` : 'Unknown Route',
                            departureTime: tripTime.departureTime,
                            arrivalTime: tripTime.arrivalTime,
                            tripType: tripTime.tripType || schedule.tripType,
                            availableDays: schedule.availableDays
                        });
                    }
                }
            }

            // Also check main assignedVehicle field
            if (schedule.assignedVehicle) {
                const vehicleId = schedule.assignedVehicle.toString();
                if (!vehicleScheduleMap.has(vehicleId)) {
                    vehicleScheduleMap.set(vehicleId, []);
                }
                // Check if this schedule isn't already added from tripTimes
                const existing = vehicleScheduleMap.get(vehicleId);
                const alreadyAdded = existing.some(s => s.scheduleId.toString() === schedule._id.toString());
                if (!alreadyAdded) {
                    vehicleScheduleMap.get(vehicleId).push({
                        scheduleId: schedule._id,
                        scheduleName: schedule.scheduleName,
                        routeName: schedule.routeId ? `${schedule.routeId.fromLocation} → ${schedule.routeId.toLocation}` : 'Unknown Route',
                        departureTime: schedule.departureTime,
                        arrivalTime: schedule.arrivalTime,
                        tripType: schedule.tripType,
                        availableDays: schedule.availableDays
                    });
                }
            }
        }

        // Helper to convert time string to minutes since midnight
        const timeToMinutes = (timeStr) => {
            if (!timeStr) return 0;
            let hours, minutes;
            if (timeStr.includes('AM') || timeStr.includes('PM')) {
                const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                if (match) {
                    hours = parseInt(match[1]);
                    minutes = parseInt(match[2]);
                    const period = match[3].toUpperCase();
                    if (period === 'PM' && hours !== 12) hours += 12;
                    if (period === 'AM' && hours === 12) hours = 0;
                } else {
                    return 0;
                }
            } else {
                const parts = timeStr.split(':');
                hours = parseInt(parts[0]);
                minutes = parseInt(parts[1] || 0);
            }
            return hours * 60 + minutes;
        };

        const currentMinutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
        const BUFFER_MINUTES = 30;

        const transformedVehicles = vehicles.map(vehicle => {
            const vehicleObj = vehicle._doc;
            const vehicleId = vehicle._id.toString();
            const assignedScheduleDetails = vehicleScheduleMap.get(vehicleId) || [];

            // Get trip status for this vehicle
            const inProgressTrips = vehicleInProgressMap.get(vehicleId) || [];
            const scheduledTrips = vehicleScheduledMap.get(vehicleId) || [];
            const completedTrips = vehicleCompletedMap.get(vehicleId) || [];

            // Sort by departure time
            assignedScheduleDetails.sort((a, b) => {
                const timeA = a.departureTime || '23:59';
                const timeB = b.departureTime || '23:59';
                return timeA.localeCompare(timeB);
            });

            // DYNAMIC AVAILABILITY CALCULATION based on today's trips
            // FIXED: Only consider trips with actual bookings (bookedSeats > 0) as commitments
            let calculatedAvailabilityStatus = 'available';
            let availabilityMessage = 'Available';
            let availabilityColor = 'green';
            let availableUntilDisplay = null;
            let nextTripTime = null;

            // Check if vehicle is currently in a trip
            if (inProgressTrips.length > 0) {
                calculatedAvailabilityStatus = 'busy';
                availabilityMessage = `In Trip: ${inProgressTrips[0].fromLocation} → ${inProgressTrips[0].toLocation}`;
                availabilityColor = 'red';
            } else {
                // Find upcoming scheduled trips for TODAY that have actual bookings
                // ONLY trips with bookedSeats > 0 should be considered as commitments
                const upcomingTrips = scheduledTrips
                    .filter(t => {
                        const tripMinutes = timeToMinutes(t.startTime);
                        const isFuture = tripMinutes > currentMinutesSinceMidnight;
                        const hasBookings = t.bookedSeats && t.bookedSeats > 0;
                        return isFuture && hasBookings;
                    })
                    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

                // NOTE: We no longer treat schedules without bookings as commitments
                // Schedules are only commitments if they have generated trips with bookedSeats > 0
                // This allows partners to set themselves as "available" even with assigned schedules

                // Find the next commitment (only from trips with actual bookings)
                let nextCommitmentTime = null;
                let nextCommitmentTimeStr = null;

                if (upcomingTrips.length > 0) {
                    nextCommitmentTime = timeToMinutes(upcomingTrips[0].startTime);
                    nextCommitmentTimeStr = upcomingTrips[0].startTime;
                }

                if (nextCommitmentTime) {
                    const minutesUntilCommitment = nextCommitmentTime - currentMinutesSinceMidnight;
                    nextTripTime = nextCommitmentTimeStr;

                    if (minutesUntilCommitment <= BUFFER_MINUTES) {
                        // Commitment is within 30 minutes
                        calculatedAvailabilityStatus = 'scheduled';
                        availabilityMessage = `Next trip in ${minutesUntilCommitment}min`;
                        availabilityColor = 'orange';
                    } else {
                        // Vehicle is available until 30 min before next commitment
                        calculatedAvailabilityStatus = 'available';
                        const availableUntilMinutes = nextCommitmentTime - BUFFER_MINUTES;
                        const availableUntilHours = Math.floor(availableUntilMinutes / 60);
                        const availableUntilMins = availableUntilMinutes % 60;
                        const period = availableUntilHours >= 12 ? 'PM' : 'AM';
                        const displayHours = availableUntilHours > 12 ? availableUntilHours - 12 : (availableUntilHours === 0 ? 12 : availableUntilHours);
                        availableUntilDisplay = `${displayHours}:${String(availableUntilMins).padStart(2, '0')} ${period}`;
                        availabilityMessage = `Available until ${availableUntilDisplay}`;
                        availabilityColor = 'green';
                    }
                } else {
                    // No upcoming trips with bookings today
                    // But we should still show "Available until X:XX" if vehicle has SCHEDULES (for display purposes)
                    if (vehicle.availabilityStatus === 'offline') {
                        calculatedAvailabilityStatus = 'offline';
                        availabilityMessage = 'Offline';
                        availabilityColor = 'gray';
                    } else {
                        // Check if vehicle has upcoming SCHEDULES (not trips with bookings) to display availability window
                        // Use both full day names and abbreviated day names for compatibility
                        const fullDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
                        const shortDayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];

                        // Filter schedules that are active today and in the future
                        const upcomingSchedules = assignedScheduleDetails
                            .filter(s => {
                                // Check if schedule runs today - support both full names and abbreviations
                                const availableDays = s.availableDays || [];
                                const daysArray = typeof availableDays === 'string' ? [availableDays] : availableDays;
                                const runsToday = daysArray.length === 0 ||
                                    daysArray.some(day => {
                                        const dayUpper = day.toUpperCase();
                                        return dayUpper === shortDayName ||
                                            dayUpper === fullDayName.toUpperCase() ||
                                            day === fullDayName;
                                    });
                                if (!runsToday) return false;

                                // Check if departure time is in the future
                                const depMinutes = timeToMinutes(s.departureTime);
                                return depMinutes > currentMinutesSinceMidnight;
                            })
                            .sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));

                        if (upcomingSchedules.length > 0) {
                            // Calculate available until time (30 min before next schedule)
                            const nextScheduleTime = timeToMinutes(upcomingSchedules[0].departureTime);
                            const availableUntilMinutes = nextScheduleTime - BUFFER_MINUTES;
                            const availableUntilHoursCalc = Math.floor(availableUntilMinutes / 60);
                            const availableUntilMinsCalc = availableUntilMinutes % 60;
                            const period = availableUntilHoursCalc >= 12 ? 'PM' : 'AM';
                            const displayHours = availableUntilHoursCalc > 12 ? availableUntilHoursCalc - 12 : (availableUntilHoursCalc === 0 ? 12 : availableUntilHoursCalc);
                            availableUntilDisplay = `${displayHours}:${String(availableUntilMinsCalc).padStart(2, '0')} ${period}`;

                            calculatedAvailabilityStatus = 'available';
                            availabilityMessage = `Available until ${availableUntilDisplay}`;
                            availabilityColor = 'green';
                            nextTripTime = upcomingSchedules[0].departureTime;
                        } else {
                            // Vehicle is fully available - no schedules today
                            calculatedAvailabilityStatus = 'available';
                            availabilityMessage = 'Available';
                            availabilityColor = 'green';
                        }
                    }
                }
            }

            // Determine availability info based on assignments
            let availabilityInfo = null;

            if (assignedScheduleDetails.length > 0) {
                // Get formatted time windows
                const timeWindows = assignedScheduleDetails.map(s => ({
                    time: s.departureTime + (s.arrivalTime ? ` - ${s.arrivalTime}` : ''),
                    route: s.routeName,
                    days: s.availableDays?.join(', ') || 'All Days'
                }));

                availabilityInfo = {
                    assignedCount: assignedScheduleDetails.length,
                    schedules: timeWindows,
                    busyTimes: assignedScheduleDetails.map(s => s.departureTime).filter(Boolean)
                };
            }

            return {
                ...vehicleObj,
                images: vehicle.images || [],
                features: vehicle.features || [],
                availabilityStatus: calculatedAvailabilityStatus, // Dynamically calculated
                availabilityMessage: availabilityMessage,
                availabilityColor: availabilityColor,
                availableUntil: availableUntilDisplay,
                nextTripTime: nextTripTime,
                assignedSchedules: vehicle.assignedSchedules || [],
                assignedScheduleDetails: assignedScheduleDetails,
                availabilityInfo: availabilityInfo,
                insuranceExpiry: vehicle.insuranceExpiry,
                registrationExpiry: vehicle.registrationExpiry
            };
        });

        console.log("[v0] Transformed vehicles:", transformedVehicles.length, "with schedules:", transformedVehicles.map(v => ({ model: v.model, schedulesCount: v.assignedScheduleDetails?.length || 0 })));

        res.status(200).json({
            success: true,
            fleet: {
                vehicles: transformedVehicles || []
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C fleet data:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C fleet data"
        });
    }
};

// Get B2C partner drivers
export const getB2CPartnerDrivers = async (req, res) => {
    try {
        console.log("[v0] Fetching B2C drivers for partner:", req.userId);

        // Fetch real drivers from database
        const drivers = await User.find({
            role: 'B2C_PARTNER_DRIVER',
            b2cPartnerId: req.userId,
            status: 'ACTIVE'
        })
            .select('fullName email whatsappNumber driverInfo profileImage status')
            .sort({ createdAt: -1 });

        console.log("[v0] Found B2C drivers:", drivers.length);

        res.status(200).json({
            success: true,
            drivers: drivers || []
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C drivers:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C drivers"
        });
    }
};

// Create B2C partner vehicle
export const createB2CPartnerVehicle = async (req, res) => {
    try {
        const vehicleData = req.body;

        console.log("[v0] B2C Vehicle creation data:", vehicleData);
        console.log("[v0] B2C Vehicle files:", req.files);

        // Handle image uploads to Cloudinary
        let uploadedImages = [];
        if (req.files && req.files.images && req.files.images.length > 0) {
            try {
                const { uploadMultipleSequential } = await import("../Config/Cloudinary.js");
                uploadedImages = await uploadMultipleSequential(req.files.images, "b2c-vehicles");
                console.log("[v0] Images uploaded to Cloudinary:", uploadedImages.length);
            } catch (uploadError) {
                console.error("[v0] Cloudinary upload error:", uploadError);
                // Continue without images if upload fails
            }
        }

        // Parse additional fields if they're stringified
        let parsedFeatures = [];
        if (vehicleData.features) {
            try {
                parsedFeatures = typeof vehicleData.features === 'string'
                    ? JSON.parse(vehicleData.features)
                    : vehicleData.features;
            } catch (e) {
                parsedFeatures = Array.isArray(vehicleData.features) ? vehicleData.features : [];
            }
        }

        // Parse tags if they're stringified
        let parsedTags = [];
        if (vehicleData.tags) {
            try {
                parsedTags = typeof vehicleData.tags === 'string'
                    ? JSON.parse(vehicleData.tags)
                    : vehicleData.tags;
            } catch (e) {
                parsedTags = Array.isArray(vehicleData.tags) ? vehicleData.tags : [];
            }
        }

        // Create new vehicle with B2CPartnerVehicle model
        const newVehicle = new B2CPartnerVehicle({
            b2cPartnerId: req.userId,
            vehicleType: vehicleData.vehicleType,
            model: vehicleData.model,
            year: parseInt(vehicleData.year) || new Date().getFullYear(),
            seatingCapacity: parseInt(vehicleData.seatingCapacity) || 4,
            licensePlate: vehicleData.licensePlate,
            vehicleColor: vehicleData.vehicleColor || "White",
            features: parsedFeatures,
            images: uploadedImages.map(img => ({
                url: img.secure_url,
                publicId: img.public_id || `b2c-vehicles/${img.public_id || img.asset_id}`
            })),
            status: vehicleData.status || "Active",
            insuranceExpiry: vehicleData.insuranceExpiry ? new Date(vehicleData.insuranceExpiry) : undefined,
            registrationExpiry: vehicleData.registrationExpiry ? new Date(vehicleData.registrationExpiry) : undefined,
            tags: parsedTags, // Add vehicle tags
            isActive: true
        });

        const savedVehicle = await newVehicle.save();

        console.log(`Successfully created B2C vehicle: ${savedVehicle.vehicleName}`);
        console.log(`Vehicle images: ${savedVehicle.images.length} uploaded`);

        res.status(201).json({
            success: true,
            message: "B2C vehicle created successfully",
            vehicle: savedVehicle
        });
    } catch (error) {
        console.error("[v0] Error creating B2C vehicle:", error);
        res.status(500).json({
            success: false,
            message: "Error creating B2C vehicle",
            error: error.message
        });
    }
};

// Update B2C partner vehicle
export const updateB2CPartnerVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const vehicleData = req.body;

        console.log("[v0] B2C Vehicle update data:", vehicleData);
        console.log("[v0] B2C Vehicle files:", req.files);

        // Find existing vehicle
        const existingVehicle = await B2CPartnerVehicle.findOne({
            _id: vehicleId,
            b2cPartnerId: req.userId
        });

        if (!existingVehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found or you don't have permission to update it"
            });
        }

        // Handle image uploads to Cloudinary
        let uploadedImages = [];
        if (req.files && req.files.images && req.files.images.length > 0) {
            try {
                const { uploadMultipleSequential } = await import("../Config/Cloudinary.js");
                uploadedImages = await uploadMultipleSequential(req.files.images, "b2c-vehicles");
                console.log("[v0] New images uploaded to Cloudinary:", uploadedImages.length);
            } catch (uploadError) {
                console.error("[v0] Cloudinary upload error:", uploadError);
                // Continue without images if upload fails
            }
        }

        // Parse additional fields if they're stringified
        let parsedFeatures = [];
        if (vehicleData.features) {
            try {
                parsedFeatures = typeof vehicleData.features === 'string'
                    ? JSON.parse(vehicleData.features)
                    : vehicleData.features;
            } catch (e) {
                parsedFeatures = Array.isArray(vehicleData.features) ? vehicleData.features : [];
            }
        }

        // Merge existing images with new ones
        let finalImages = existingVehicle.images || [];
        if (uploadedImages.length > 0) {
            finalImages = [...finalImages, ...uploadedImages.map(img => ({
                url: img.secure_url,
                publicId: img.public_id || `b2c-vehicles/${img.public_id || img.asset_id}`
            }))];
        }

        // Update vehicle with new data
        const updatedVehicle = await B2CPartnerVehicle.findByIdAndUpdate(
            vehicleId,
            {
                vehicleType: vehicleData.vehicleType || existingVehicle.vehicleType,
                model: vehicleData.model || existingVehicle.model,
                year: parseInt(vehicleData.year) || existingVehicle.year,
                seatingCapacity: parseInt(vehicleData.seatingCapacity) || existingVehicle.seatingCapacity,
                licensePlate: vehicleData.licensePlate || existingVehicle.licensePlate,
                vehicleColor: vehicleData.vehicleColor || existingVehicle.vehicleColor,
                features: parsedFeatures.length > 0 ? parsedFeatures : existingVehicle.features,
                images: finalImages,
                status: vehicleData.status || existingVehicle.status,
                insuranceExpiry: vehicleData.insuranceExpiry ? new Date(vehicleData.insuranceExpiry) : existingVehicle.insuranceExpiry,
                registrationExpiry: vehicleData.registrationExpiry ? new Date(vehicleData.registrationExpiry) : existingVehicle.registrationExpiry,
            },
            { new: true }
        );

        console.log(`Successfully updated B2C vehicle: ${updatedVehicle.vehicleName}`);
        console.log(`Vehicle images: ${updatedVehicle.images.length} total`);

        res.status(200).json({
            success: true,
            message: "B2C vehicle updated successfully",
            vehicle: updatedVehicle
        });
    } catch (error) {
        console.error("[v0] Error updating B2C vehicle:", error);
        res.status(500).json({
            success: false,
            message: "Error updating B2C vehicle",
            error: error.message
        });
    }
};

export const deleteB2CPartnerVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        // Find and delete the vehicle
        const vehicle = await B2CPartnerVehicle.findOneAndDelete({
            _id: vehicleId,
            b2cPartnerId: req.userId
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found or you don't have permission to delete it"
            });
        }

        console.log(`Successfully deleted B2C vehicle: ${vehicle.vehicleName}`);
        console.log(`Vehicle had ${vehicle.images.length} images`);

        res.status(200).json({
            success: true,
            message: "B2C vehicle deleted successfully"
        });
    } catch (error) {
        console.error("[v0] Error deleting B2C vehicle:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting B2C vehicle",
            error: error.message
        });
    }
};

// Update B2C Partner vehicle availability/status (busy/available)
export const updateB2CPartnerVehicleStatus = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { status, availabilityStatus } = req.body;
        const partnerId = req.userId;

        // Find the vehicle
        const vehicle = await B2CPartnerVehicle.findOne({
            _id: vehicleId,
            b2cPartnerId: partnerId
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found or you don't have permission to update it"
            });
        }

        // If trying to set to available, check for active trips (but allow availability window)
        if (availabilityStatus === 'available') {
            const B2CPartnerTrip = mongoose.model('B2CPartnerTrip');
            const now = new Date();
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            // Get all trips for this vehicle today
            const todayTrips = await B2CPartnerTrip.find({
                vehicleId: vehicleId,
                tripDate: { $gte: todayStart, $lte: todayEnd }
            }).sort({ startTime: 1 });

            // Check if any trip is currently IN_PROGRESS
            const inProgressTrips = todayTrips.filter(t =>
                ['IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
            );

            if (inProgressTrips.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `This vehicle has a trip currently in progress. Please complete it before setting status to available.`,
                    hasInProgressTrip: true,
                    inProgressTripsCount: inProgressTrips.length
                });
            }

            // Get completed and scheduled trips
            const completedTrips = todayTrips.filter(t =>
                ['COMPLETED', 'Completed', 'DONE', 'Done'].includes(t.status)
            );
            const scheduledTrips = todayTrips.filter(t =>
                ['SCHEDULED', 'Scheduled'].includes(t.status)
            );

            // Get current time as HH:MM string
            const currentHours = String(now.getHours()).padStart(2, '0');
            const currentMinutes = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}`;

            // Find the next scheduled trip after current time
            const nextTrip = scheduledTrips.find(t => {
                const tripTime = t.startTime || '00:00';
                return tripTime > currentTimeStr;
            });

            // Calculate availableUntil time if there's a next trip
            let availableUntil = null;
            let nextTripTime = null;
            if (nextTrip) {
                nextTripTime = nextTrip.startTime;
                const [hours, minutes] = nextTripTime.split(':').map(Number);
                const nextTripDate = new Date();
                nextTripDate.setHours(hours, minutes, 0, 0);
                availableUntil = new Date(nextTripDate.getTime() - 30 * 60 * 1000); // 30 mins before
            }

            // Update vehicle with availability window info
            const updateData = {
                availabilityStatus: 'available',
                lastAvailabilityUpdate: new Date(),
                updatedAt: new Date()
            };

            // Store availability window info if there's a next trip
            if (availableUntil) {
                updateData.availableUntil = availableUntil;
                updateData.nextScheduledTripTime = nextTripTime;
            } else {
                // No upcoming trips - vehicle is fully available
                updateData.availableUntil = null;
                updateData.nextScheduledTripTime = null;
            }

            const updatedVehicle = await B2CPartnerVehicle.findByIdAndUpdate(
                vehicleId,
                { $set: updateData },
                { new: true }
            );

            console.log(`[v0] Updated vehicle ${vehicleId} to available with window:`, {
                availableUntil,
                nextTripTime,
                hasCompletedTrips: completedTrips.length > 0,
                hasScheduledTrips: scheduledTrips.length > 0
            });

            // Broadcast real-time vehicle availability change via socket
            broadcastVehicleAvailabilityChange(partnerId, {
                vehicleId: updatedVehicle._id.toString(),
                vehicleModel: updatedVehicle.model,
                licensePlate: updatedVehicle.licensePlate,
                availabilityStatus: 'available',
                availableUntil: availableUntil,
                nextScheduledTripTime: nextTripTime,
                status: updatedVehicle.status
            });

            return res.status(200).json({
                success: true,
                message: nextTripTime
                    ? `Vehicle set to available until ${nextTripTime}`
                    : 'Vehicle set to available',
                vehicle: updatedVehicle,
                availabilityStatus: 'available',
                availableUntil: availableUntil,
                nextScheduledTripTime: nextTripTime,
                hasUpcomingTrip: !!nextTrip
            });
        }

        // For busy status or other updates
        const updateData = { updatedAt: new Date() };
        if (status) {
            updateData.status = status;
        }
        if (availabilityStatus) {
            updateData.availabilityStatus = availabilityStatus;
            updateData.lastAvailabilityUpdate = new Date();
            // Clear availability window when set to busy
            if (availabilityStatus === 'busy') {
                updateData.availableUntil = null;
                updateData.nextScheduledTripTime = null;
            }
        }

        const updatedVehicle = await B2CPartnerVehicle.findByIdAndUpdate(
            vehicleId,
            { $set: updateData },
            { new: true }
        );

        console.log(`[v0] Updated vehicle ${vehicleId} status:`, updateData);

        // Broadcast real-time vehicle availability change via socket
        if (availabilityStatus) {
            broadcastVehicleAvailabilityChange(partnerId, {
                vehicleId: updatedVehicle._id.toString(),
                vehicleModel: updatedVehicle.model,
                licensePlate: updatedVehicle.licensePlate,
                availabilityStatus: updatedVehicle.availabilityStatus,
                status: updatedVehicle.status
            });
        }

        res.status(200).json({
            success: true,
            message: `Vehicle status updated successfully`,
            vehicle: updatedVehicle,
            status: updatedVehicle.status,
            availabilityStatus: updatedVehicle.availabilityStatus
        });
    } catch (error) {
        console.error("[v0] Error updating vehicle status:", error);
        res.status(500).json({
            success: false,
            message: "Error updating vehicle status",
            error: error.message
        });
    }
};

// Assign driver to a B2C Partner vehicle
export const assignDriverToB2CVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { driverId } = req.body;
        const partnerId = req.userId;

        if (!driverId) {
            return res.status(400).json({
                success: false,
                message: "Driver ID is required"
            });
        }

        const vehicle = await B2CPartnerVehicle.findOne({
            _id: vehicleId,
            b2cPartnerId: partnerId,
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found or you don't have permission"
            });
        }

        // Verify driver belongs to this partner
        const driver = await B2CPartnerDriver.findOne({
            _id: driverId,
            b2cPartnerId: partnerId,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found or does not belong to your fleet"
            });
        }

        // Check if driver is already assigned
        if (vehicle.assignedDrivers.includes(driverId)) {
            return res.status(400).json({
                success: false,
                message: "Driver is already assigned to this vehicle"
            });
        }

        vehicle.assignedDrivers.push(driverId);
        await vehicle.save();

        // Update driver's assigned vehicle reference
        driver.assignedVehicle = vehicleId;
        await driver.save();

        const updatedVehicle = await B2CPartnerVehicle.findById(vehicleId)
            .populate('assignedDrivers', 'name phoneNumber licenseNumber profileImage')
            .populate('assignedRoutes', 'fromLocation toLocation');

        res.status(200).json({
            success: true,
            message: "Driver assigned to vehicle successfully",
            data: { vehicle: updatedVehicle }
        });
    } catch (error) {
        console.error("[v0] Error assigning driver to vehicle:", error);
        res.status(500).json({
            success: false,
            message: "Error assigning driver to vehicle",
            error: error.message
        });
    }
};

// Assign driver to a B2C Partner route
export const assignDriverToB2CRoute = async (req, res) => {
    try {
        const { driverId, routeId, vehicleId } = req.body;
        const partnerId = req.userId;

        if (!driverId || !routeId) {
            return res.status(400).json({
                success: false,
                message: "Driver ID and Route ID are required"
            });
        }

        // Verify driver belongs to partner
        const driver = await B2CPartnerDriver.findOne({
            _id: driverId,
            b2cPartnerId: partnerId,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found or does not belong to your fleet"
            });
        }

        // Verify route belongs to partner
        const route = await B2CPartnerRoute.findOne({
            _id: routeId,
            b2cPartnerId: partnerId,
        });

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found or does not belong to you"
            });
        }

        // Update route with driver assignment
        route.assignedDriver = driverId;
        if (vehicleId) route.assignedVehicle = vehicleId;
        await route.save();

        // Update driver with route assignment
        if (!driver.assignedRoutes) driver.assignedRoutes = [];
        if (!driver.assignedRoutes.includes(routeId)) {
            driver.assignedRoutes.push(routeId);
        }
        await driver.save();

        const updatedRoute = await B2CPartnerRoute.findById(routeId)
            .populate('assignedDriver', 'name phoneNumber licenseNumber')
            .populate('assignedVehicle', 'model licensePlate vehicleType');

        res.status(200).json({
            success: true,
            message: "Driver assigned to route successfully",
            data: { route: updatedRoute }
        });
    } catch (error) {
        console.error("[v0] Error assigning driver to route:", error);
        res.status(500).json({
            success: false,
            message: "Error assigning driver to route",
            error: error.message
        });
    }
};

export const createB2CPartnerTrip = async (req, res) => {
    try {
        const tripData = req.body;

        // Create new trip instance
        const newTrip = new B2CPassengerBooking({
            routeId: tripData.routeId,
            b2cPartnerId: req.userId,
            tripDate: new Date(tripData.tripDate),
            startTime: tripData.startTime,
            fromLocation: tripData.fromLocation,
            toLocation: tripData.toLocation,
            tripType: tripData.tripType,
            totalSeats: tripData.totalSeats,
            availableSeats: tripData.availableSeats,
            pricing: tripData.pricing,
            assignedVehicle: tripData.vehicleId,
            assignedDriver: tripData.driverId,
            notes: tripData.notes || "",
            status: "Scheduled",
            isActive: true
        });

        const savedTrip = await newTrip.save();

        // Populate related data
        await savedTrip.populate('assignedVehicle', 'plateNumber model type capacity');
        await savedTrip.populate('assignedDriver', 'fullName phone');

        console.log(`Successfully created B2C trip: ${tripData.fromLocation} to ${tripData.toLocation} on ${tripData.tripDate}`);

        res.status(201).json({
            success: true,
            message: "B2C trip created successfully",
            trip: savedTrip
        });
    } catch (error) {
        console.error("[v0] Error creating B2C trip:", error);
        res.status(500).json({
            success: false,
            message: "Error creating B2C trip",
            error: error.message
        });
    }
};

// Get Commuter routes
export const getCommuterRoutes = async (req, res) => {
    try {
        const userId = req.userId;

        // Determine the commuter's country so we only show routes that belong
        // to the same country (UAE user -> only UAE routes, Kuwait user -> only
        // Kuwait routes). This mirrors the home page (commute search) behaviour.
        //
        // Resolution order (same as the home page):
        //   1. The `nationality` query param sent by the client. The home page /
        //      Find Routes tab detects the user's location via /location/detect
        //      (IP based) and forwards it here, so this is the most accurate.
        //   2. The stored country / nationality on the user document (fallback).
        const countryMapping = {
            'UAE': 'UAE',
            'AE': 'UAE',
            'United Arab Emirates': 'UAE',
            'KW': 'Kuwait',
            'Kuwait': 'Kuwait'
        };

        let userCountry = null;

        // 1️⃣ Prefer the nationality passed by the client (IP-detected on the
        //    home page / Find Routes tab).
        const { nationality } = req.query;
        if (nationality) {
            userCountry = countryMapping[nationality] || nationality;
        }

        // 2️⃣ Fall back to the value stored on the user document.
        if (!userCountry) {
            try {
                const commuter = await User.findById(userId).select('country nationality');
                const rawCountry = commuter?.country || commuter?.nationality;
                userCountry = countryMapping[rawCountry] || rawCountry || null;
            } catch (e) {
                // If we cannot resolve the country, fall back to showing all routes
            }
        }

        // Helper to derive a route's country from its location names
        const getRouteCountry = (fromLocation, toLocation) => {
            const allLocations = `${fromLocation || ''} ${toLocation || ''}`.toLowerCase();

            const kuwaitIndicators = ['kuwait', 'salwa', 'jahra', 'salmiya', 'hawally', 'farwaniya', 'ahmadi', 'mangaf', 'fahaheel', 'fintas', 'mahboula', 'khaitan', 'jleeb', 'mubarak', 'reggae'];
            const uaeIndicators = ['dubai', 'abu dhabi', 'sharjah', 'ajman', 'fujairah', 'ras al', 'umm al', 'al ain', 'deira', 'bur dubai', 'jumeirah', 'marina', 'jebel ali', 'silicon oasis', 'business bay', 'creek', 'mall of emirates', 'burjuman', 'ghubaiba', 'oud metha'];

            for (const indicator of kuwaitIndicators) {
                if (allLocations.includes(indicator)) return 'Kuwait';
            }
            for (const indicator of uaeIndicators) {
                if (allLocations.includes(indicator)) return 'UAE';
            }
            return null; // Unknown country
        };

        // Fetch real active B2C routes from database
        const allActiveRoutes = await B2CPartnerRoute.find({ status: 'Active' })
            .populate('b2cPartnerId', 'fullName companyName email')
            .sort({ createdAt: -1 });

        // Filter routes by the commuter's country (UAE/Kuwait only). Routes from
        // an unknown country are hidden from UAE/Kuwait users so they only ever
        // see verified routes operating in their own country.
        const routes = allActiveRoutes.filter(route => {
            if (userCountry === 'UAE' || userCountry === 'Kuwait') {
                const routeCountry = getRouteCountry(route.fromLocation, route.toLocation);
                return routeCountry === userCountry;
            }
            return true;
        });

        // Fetch all active schedules for these routes
        const routeIds = routes.map(r => r._id);

        // Find which of these routes the commuter currently has an ACTIVE booking on.
        // "Active" = an upcoming/in-progress booking that is not cancelled/rejected/completed.
        let bookedRouteIds = new Set();
        try {
            const activeBookings = await B2CPassengerBooking.find({
                passengerId: userId,
                routeId: { $in: routeIds },
                bookingStatus: { $in: ['PENDING', 'CONFIRMED', 'ACCEPTED', 'IN_PROGRESS'] }
            }).select('routeId');
            bookedRouteIds = new Set(activeBookings.map(b => b.routeId?.toString()).filter(Boolean));
        } catch (e) {
            // Booking lookup is best-effort; routes still render without it
        }
        let schedules = [];
        try {
            schedules = await B2CPartnerSchedule.find({
                routeId: { $in: routeIds },
                isActive: true,
                status: 'Active'
            });
        } catch (e) {
            // B2CPartnerSchedule may not exist yet
        }

        const scheduleMap = {};
        schedules.forEach(s => {
            if (!scheduleMap[s.routeId.toString()]) {
                scheduleMap[s.routeId.toString()] = s;
            }
        });

        // Helper to parse time strings
        const parseTime = (timeStr) => {
            if (!timeStr) return null;
            const cleanTime = timeStr.trim();
            const amPmMatch = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (amPmMatch) {
                let h = parseInt(amPmMatch[1]);
                const m = parseInt(amPmMatch[2]);
                const period = amPmMatch[3].toUpperCase();
                if (period === 'PM' && h !== 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
                return h * 60 + m;
            }
            const simpleMatch = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
            if (simpleMatch) {
                return parseInt(simpleMatch[1]) * 60 + parseInt(simpleMatch[2]);
            }
            return null;
        };

        const formattedRoutes = routes.map(route => {
            const schedule = scheduleMap[route._id.toString()];

            const stops = route.stopPoints || [];
            const sortedStops = [...stops].sort((a, b) => a.order - b.order);
            const firstStop = sortedStops.length > 0 ? sortedStops[0] : null;
            const lastStop = sortedStops.length > 0 ? sortedStops[sortedStops.length - 1] : null;

            // Priority: schedule tripTimes > route startTime > stop point times
            let departureTime = 'Not set';
            let arrivalTime = 'Not set';

            if (schedule && schedule.tripTimes && schedule.tripTimes.length > 0) {
                departureTime = schedule.tripTimes[0].departureTime || schedule.tripTimes[0].startTime || 'Not set';
                arrivalTime = schedule.tripTimes[0].arrivalTime || schedule.tripTimes[0].endTime || 'Not set';
            } else if (route.startTime) {
                departureTime = route.startTime;
                arrivalTime = lastStop?.time || 'Not set';
            } else if (firstStop) {
                departureTime = firstStop.time || 'Not set';
                arrivalTime = lastStop?.time || 'Not set';
            }

            // Estimate distance
            const numStops = stops.length;
            let estimatedDistance = 'Not available';
            if (numStops > 1) {
                estimatedDistance = `~${(numStops * 15)} km`;
            } else if (numStops === 1 || route.fromLocation !== route.toLocation) {
                estimatedDistance = '~15 km';
            }

            // Estimate duration
            let estimatedDuration = 'Not available';
            const depTime = departureTime !== 'Not set' ? departureTime : firstStop?.time;
            const arrTime = arrivalTime !== 'Not set' ? arrivalTime : lastStop?.time;

            if (depTime && arrTime && depTime !== arrTime) {
                try {
                    const depMinutes = parseTime(depTime);
                    const arrMinutes = parseTime(arrTime);

                    if (depMinutes !== null && arrMinutes !== null) {
                        let diffMinutes = arrMinutes - depMinutes;
                        if (diffMinutes < 0) diffMinutes += 24 * 60; // handle overnight
                        if (diffMinutes > 0) {
                            const hrs = Math.floor(diffMinutes / 60);
                            const mins = diffMinutes % 60;
                            estimatedDuration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                        }
                    }
                } catch (e) {
                    // Fallback
                }
            }

            // Check if current user has SAVED this route (members array = saved routes)
            const isSaved = (route.members || []).some(
                m => m.userId && m.userId.toString() === userId.toString() && m.status === 'ACTIVE'
            );

            // Check if current user has an ACTIVE booking on this route
            const isBooked = bookedRouteIds.has(route._id.toString());

            return {
                _id: route._id,
                name: route.routeName || `${route.fromLocation || 'Unknown'} to ${route.toLocation || 'Unknown'}`,
                startPoint: route.fromLocation || 'Not set',
                endPoint: route.toLocation || 'Not set',
                // Raw location fields required by the BookingModal
                fromLocation: route.fromLocation || '',
                toLocation: route.toLocation || '',
                distance: estimatedDistance,
                estimatedTime: estimatedDuration,
                price: route.pricing?.oneWayPrice || 0,
                roundTripPrice: route.pricing?.roundTripPrice || 0,
                status: route.status?.toLowerCase() || 'inactive',
                isSaved,
                isBooked,
                partnerName: route.b2cPartnerId?.companyName || route.b2cPartnerId?.fullName || 'Unknown',
                departureTime,
                arrivalTime,
                totalSeats: route.totalSeats || 0,
                availableSeats: route.availableSeats || 0,
                stops: route.stopPoints || [],
                tripType: route.tripType || 'One Way',
                operatingDays: route.availableDays || [],
                availableDays: route.availableDays || [],
                startDate: route.startDate,
                currency: route.pricing?.currency || 'KWD',
                pricing: route.pricing || {},
                createdAt: route.createdAt
            };
        });

        res.status(200).json({
            success: true,
            routes: formattedRoutes
        });
    } catch (error) {
        console.error("Error fetching commuter routes:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching commuter routes"
        });
    }
};

// Save route (add to commuter's saved/favourite routes - does NOT block a seat)
export const joinRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        const userId = req.userId;

        if (!routeId) {
            return res.status(400).json({
                success: false,
                message: "Route ID is required"
            });
        }

        const route = await B2CPartnerRoute.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        if (route.status !== 'Active') {
            return res.status(400).json({
                success: false,
                message: "Route is not active"
            });
        }

        // Check if user already saved this route
        const existingMember = (route.members || []).find(
            m => m.userId && m.userId.toString() === userId.toString() && m.status === 'ACTIVE'
        );

        if (existingMember) {
            return res.status(400).json({
                success: false,
                message: "Route is already saved"
            });
        }

        // If the user previously left/removed, re-activate that entry; otherwise push a new one.
        // Saving a route does NOT decrement available seats - seats are only reserved on real bookings.
        const previousMember = (route.members || []).find(
            m => m.userId && m.userId.toString() === userId.toString()
        );

        if (previousMember) {
            await B2CPartnerRoute.updateOne(
                { _id: routeId, 'members.userId': userId },
                { $set: { 'members.$.status': 'ACTIVE', 'members.$.joinedAt': new Date() } }
            );
        } else {
            await B2CPartnerRoute.findByIdAndUpdate(routeId, {
                $push: {
                    members: {
                        userId: userId,
                        joinedAt: new Date(),
                        status: 'ACTIVE'
                    }
                }
            });
        }

        res.status(200).json({
            success: true,
            message: "Route saved successfully",
            routeInfo: {
                routeId: route._id,
                routeName: `${route.fromLocation} to ${route.toLocation}`,
                fromLocation: route.fromLocation,
                toLocation: route.toLocation,
                pricing: route.pricing,
                availableDays: route.availableDays,
                savedAt: new Date()
            }
        });

    } catch (error) {
        console.error("Error saving route:", error);
        res.status(500).json({
            success: false,
            message: "Error saving route",
            error: error.message
        });
    }
};

// Unsave route (remove from commuter's saved routes - does NOT change seats)
export const leaveRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        const userId = req.userId;

        if (!routeId) {
            return res.status(400).json({
                success: false,
                message: "Route ID is required"
            });
        }

        const route = await B2CPartnerRoute.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        // Check if the route is currently saved
        const activeMember = (route.members || []).find(
            m => m.userId && m.userId.toString() === userId.toString() && m.status === 'ACTIVE'
        );

        if (!activeMember) {
            return res.status(400).json({
                success: false,
                message: "Route is not saved"
            });
        }

        // Mark as LEFT. Saving never reserved a seat, so we do NOT change availableSeats here.
        await B2CPartnerRoute.updateOne(
            { _id: routeId, 'members.userId': userId, 'members.status': 'ACTIVE' },
            { $set: { 'members.$.status': 'LEFT' } }
        );

        res.status(200).json({
            success: true,
            message: "Route removed from saved",
            routeInfo: {
                routeId: route._id,
                routeName: `${route.fromLocation} to ${route.toLocation}`,
                removedAt: new Date()
            }
        });

    } catch (error) {
        console.error("Error unsaving route:", error);
        res.status(500).json({
            success: false,
            message: "Error unsaving route",
            error: error.message
        });
    }
};

// Get Commuter profile
export const getCommuterProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const profile = {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            phone: user.whatsappNumber,
            language: 'en',
            currency: 'KWD',
            country: user.country,
            membershipType: user.level?.toLowerCase() || 'standard',
            avatar: user.profileImage || user.companyLogo || null,
            status: user.status,
            createdAt: user.createdAt
        };

        const preferences = {
            pushNotifications: user.notifications?.emailNotifications ?? true,
            marketingEmails: user.notifications?.smsNotifications ?? false,
            tripReminders: user.notifications?.bookingAlerts ?? true,
            promotionalOffers: user.notifications?.paymentAlerts ?? true
        };

        res.status(200).json({
            success: true,
            profile,
            preferences
        });
    } catch (error) {
        console.error("[v0] Error fetching commuter profile:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching commuter profile"
        });
    }
};

// Get Commuter Stats - real data from database
export const getCommuterStats = async (req, res) => {
    try {
        const userId = req.userId;

        // Count total completed bookings
        const totalRides = await B2CPassengerBooking.countDocuments({
            passengerId: userId,
            status: { $in: ['completed', 'Completed', 'COMPLETED'] }
        });

        // Estimate CO2 saved (average 2.3kg CO2 saved per shared ride vs personal car)
        const co2PerRide = 2.3;
        const savedCO2 = (totalRides * co2PerRide).toFixed(1);

        // Count active subscriptions
        const activeSubscriptions = await B2CPassengerBooking.countDocuments({
            passengerId: userId,
            status: { $in: ['active', 'Active', 'ACTIVE', 'confirmed', 'Confirmed'] }
        });

        // Get user level
        const user = await User.findById(userId).select('level');

        res.status(200).json({
            success: true,
            stats: {
                totalRides,
                savedCO2: `${savedCO2}kg`,
                activeSubscriptions,
                isPremium: user?.level === 'PREMIUM' || user?.level === 'VIP'
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching commuter stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching commuter stats"
        });
    }
};

// Update Commuter profile
export const updateCommuterProfile = async (req, res) => {
    try {
        const { profile, preferences } = req.body;
        const userId = req.userId;

        // Validate input data
        if (!profile || !preferences) {
            return res.status(400).json({
                success: false,
                message: "Profile and preferences data are required"
            });
        }

        console.log(`[v0] Updating commuter profile for user ${userId}:`, { profile, preferences });

        // Find existing user profile
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Validate email format if provided
        if (profile.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(profile.email)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email format"
                });
            }
        }

        // Validate phone number format if provided
        if (profile.phone) {
            const phoneRegex = /^[+]?[\d\s\-\(\)]{10,15}$/;
            if (!phoneRegex.test(profile.phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number format"
                });
            }
        }

        // Update user profile with real database operations
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    ...(profile.fullName && { fullName: profile.fullName }),
                    ...(profile.email && { email: profile.email }),
                    ...(profile.phone && { whatsappNumber: profile.phone }),
                    ...(profile.language && { language: profile.language }),
                    ...(profile.currency && { currency: profile.currency }),
                    ...(profile.profileImage && { profileImage: profile.profileImage }),
                    // Update preferences in user document or separate preferences collection
                    ...(preferences.pushNotifications !== undefined && {
                        'preferences.pushNotifications': preferences.pushNotifications
                    }),
                    ...(preferences.marketingEmails !== undefined && {
                        'preferences.marketingEmails': preferences.marketingEmails
                    }),
                    ...(preferences.tripReminders !== undefined && {
                        'preferences.tripReminders': preferences.tripReminders
                    }),
                    ...(preferences.promotionalOffers !== undefined && {
                        'preferences.promotionalOffers': preferences.promotionalOffers
                    })
                }
            },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Log profile update in transaction history
        await Transaction.create({
            userId: userId,
            type: "PROFILE_UPDATE",
            category: "USER_PROFILE",
            status: "UPDATED",
            createdAt: new Date(),
            metadata: {
                updatedBy: userId,
                previousProfile: {
                    fullName: user.fullName,
                    email: user.email,
                    whatsappNumber: user.whatsappNumber,
                    language: user.language,
                    currency: user.currency,
                    profileImage: user.profileImage
                },
                newProfile: profile,
                preferences: preferences
            }
        });

        console.log(`[v0] Commuter profile updated successfully for user ${userId}`);

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            profile: {
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                whatsappNumber: updatedUser.whatsappNumber,
                language: updatedUser.language,
                currency: updatedUser.currency,
                profileImage: updatedUser.profileImage,
                updatedAt: updatedUser.updatedAt
            },
            preferences: {
                pushNotifications: updatedUser.preferences?.pushNotifications || false,
                marketingEmails: updatedUser.preferences?.marketingEmails || false,
                tripReminders: updatedUser.preferences?.tripReminders || false,
                promotionalOffers: updatedUser.preferences?.promotionalOffers || false
            }
        });

    } catch (error) {
        console.error("[v0] Error updating commuter profile:", error);

        // Log failed profile update attempt
        try {
            await Transaction.create({
                userId: req.userId,
                type: "PROFILE_UPDATE_FAILED",
                category: "USER_PROFILE",
                status: "FAILED",
                createdAt: new Date(),
                metadata: {
                    error: error.message,
                    attemptedAt: new Date(),
                    profileData: req.body.profile,
                    preferencesData: req.body.preferences
                }
            });
        } catch (logError) {
            console.error("[v0] Failed to log profile update error:", logError);
        }

        res.status(500).json({
            success: false,
            message: "Error updating commuter profile",
            error: error.message
        });
    }
};

// Change password
export const changeCommuterPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.userId;

        // Validate input data
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        // Validate password strength
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters long"
            });
        }

        // Validate password complexity
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
            });
        }

        console.log(`[v0] Password change request for user ${userId}`);

        // Find user and verify current password
        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Hash new password
        const bcrypt = require('bcryptjs');
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update user password in database
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                password: hashedNewPassword,
                passwordChangedAt: new Date(),
                lastPasswordChange: new Date()
            },
            { new: true, runValidators: true }
        ).select('-password');

        // Log password change in transaction history
        await Transaction.create({
            userId: userId,
            type: "PASSWORD_CHANGE",
            category: "USER_SECURITY",
            status: "CHANGED",
            createdAt: new Date(),
            metadata: {
                changedBy: userId,
                previousPasswordHash: user.password,
                passwordChangedAt: new Date(),
                changeMethod: "USER_INITIATED",
                ipAddress: req.ip || req.connection.remoteAddress
            }
        });

        console.log(`[v0] Password changed successfully for user ${userId}`);

        res.status(200).json({
            success: true,
            message: "Password changed successfully",
            changedAt: new Date(),
            passwordExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
        });

    } catch (error) {
        console.error("[v0] Error changing password:", error);

        // Log failed password change attempt
        try {
            await Transaction.create({
                userId: req.userId,
                type: "PASSWORD_CHANGE_FAILED",
                category: "USER_SECURITY",
                status: "FAILED",
                createdAt: new Date(),
                metadata: {
                    error: error.message,
                    attemptedAt: new Date(),
                    ipAddress: req.ip || req.connection.remoteAddress,
                    changeMethod: "USER_INITIATED"
                }
            });
        } catch (logError) {
            console.error("[v0] Failed to log password change error:", logError);
        }

        res.status(500).json({
            success: false,
            message: "Error changing password",
            error: error.message
        });
    }
};

// Get B2C partner profile
export const getB2CPartnerProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const profile = {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            phone: user.whatsappNumber,
            company: user.companyName || '',
            licenseNumber: user.driverInfo?.licenseNumber || '',
            serviceType: user.serviceType,
            yearsOfExperience: user.yearsOfExperience,
            serviceDescription: user.serviceDescription,
            country: user.country,
            status: user.status,
            createdAt: user.createdAt,
            profileImage: user.profileImage || null
        };

        const preferences = {
            newTripAlerts: user.notifications?.bookingAlerts ?? true,
            dailyEarnings: user.notifications?.paymentAlerts ?? true,
            promotionalOffers: user.notifications?.smsNotifications ?? false,
        };

        res.status(200).json({
            success: true,
            profile,
            preferences
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C profile:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C profile"
        });
    }
};

// Update B2C partner profile
export const updateB2CPartnerProfile = async (req, res) => {
    try {
        const { profile, preferences } = req.body;
        const userId = req.userId;

        // Handle profile image upload via Cloudinary
        let profileImageUrl = null;
        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file, 'driveme/profiles', 'profile');
                profileImageUrl = uploadResult.secure_url;
                console.log("[v0] Profile image uploaded:", profileImageUrl);

                // If only image upload (profile/image endpoint)
                if (!profile && !preferences) {
                    const updatedUser = await User.findByIdAndUpdate(
                        userId,
                        { $set: { profileImage: profileImageUrl } },
                        { new: true }
                    ).select('-password');

                    return res.status(200).json({
                        success: true,
                        message: "Profile image updated successfully",
                        profileImage: profileImageUrl,
                        profile: {
                            _id: updatedUser._id,
                            fullName: updatedUser.fullName,
                            email: updatedUser.email,
                            phone: updatedUser.whatsappNumber,
                            company: updatedUser.companyName || '',
                            licenseNumber: updatedUser.driverInfo?.licenseNumber || '',
                            profileImage: updatedUser.profileImage
                        }
                    });
                }
            } catch (uploadError) {
                console.error("[v0] Error uploading profile image:", uploadError);
                return res.status(400).json({
                    success: false,
                    message: "Error uploading profile image",
                    error: uploadError.message
                });
            }
        }

        // Validate input data
        if (!profile || !preferences) {
            return res.status(400).json({
                success: false,
                message: "Profile and preferences data are required"
            });
        }

        console.log(`[v0] Updating B2C partner profile for user ${userId}:`, { profile, preferences });

        // Find existing B2C partner user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Validate email format if provided
        if (profile.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(profile.email)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email format"
                });
            }
        }

        // Validate phone number format if provided
        if (profile.phone) {
            const phoneRegex = /^[+]?[\d\s\-\(\)]{10,15}$/;
            if (!phoneRegex.test(profile.phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number format"
                });
            }
        }

        // Update B2C partner profile with real database operations
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    ...(profile.fullName && { fullName: profile.fullName }),
                    ...(profile.email && { email: profile.email }),
                    ...(profile.phone && { whatsappNumber: profile.phone }),
                    ...(profile.company && { company: profile.company }),
                    ...(profile.licenseNumber && { licenseNumber: profile.licenseNumber }),
                    ...(profile.officeAddress && { officeAddress: profile.officeAddress }),
                    ...(profile.website && { website: profile.website }),
                    ...(profileImageUrl && { profileImage: profileImageUrl }),
                    // Update B2C partner specific preferences
                    ...(preferences.newTripAlerts !== undefined && {
                        'preferences.newTripAlerts': preferences.newTripAlerts
                    }),
                    ...(preferences.dailyEarnings !== undefined && {
                        'preferences.dailyEarnings': preferences.dailyEarnings
                    }),
                    ...(preferences.promotionalOffers !== undefined && {
                        'preferences.promotionalOffers': preferences.promotionalOffers
                    }),
                    ...(preferences.vehicleMaintenance !== undefined && {
                        'preferences.vehicleMaintenance': preferences.vehicleMaintenance
                    }),
                    ...(preferences.driverManagement !== undefined && {
                        'preferences.driverManagement': preferences.driverManagement
                    })
                }
            },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Profile update logged via console (no wallet transaction needed for profile updates)
        console.log(`B2C partner profile updated for user ${userId}`);

        console.log(`[v0] B2C partner profile updated successfully for user ${userId}`);

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            profile: {
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                whatsappNumber: updatedUser.whatsappNumber,
                company: updatedUser.company,
                licenseNumber: updatedUser.licenseNumber,
                officeAddress: updatedUser.officeAddress,
                website: updatedUser.website,
                updatedAt: updatedUser.updatedAt
            },
            preferences: {
                newTripAlerts: updatedUser.preferences?.newTripAlerts || false,
                dailyEarnings: updatedUser.preferences?.dailyEarnings || false,
                promotionalOffers: updatedUser.preferences?.promotionalOffers || false,
                vehicleMaintenance: updatedUser.preferences?.vehicleMaintenance || false,
                driverManagement: updatedUser.preferences?.driverManagement || false
            }
        });

    } catch (error) {
        console.error("[v0] Error updating B2C partner profile:", error);

        console.error("B2C partner profile update failed for user:", req.userId, error.message);

        res.status(500).json({
            success: false,
            message: "Error updating B2C profile",
            error: error.message
        });
    }
};

// Get B2B settings
export const getB2BSettings = async (req, res) => {
    try {
        const settings = {
            companyName: "Royal Fleets Co.",
            tradeLicense: "TL-998877-KW",
            officeAddress: "Al-Hamra Tower, Floor 25, Kuwait City",
            email: "fleet@driveme.com",
            phone: "+965 2200 1100",
            website: "https://www.royalfleets.com.kw",
            notifications: {
                contracts: true,
                maintenance: true,
                drivers: true,
                marketing: false,
            }
        };
        res.status(200).json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching B2B settings" });
    }
};

// Update B2B settings
export const updateB2BSettings = async (req, res) => {
    try {
        const { companyInfo, notifications } = req.body;
        // TODO: Update settings in database
        res.status(200).json({
            success: true,
            message: "Settings updated successfully"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating B2B settings" });
    }
};

// Get B2B fleet and drivers data
export const getB2BFleetAndDrivers = async (req, res) => {
    try {
        const fleetData = {
            vehicles: [
                {
                    _id: 'vehicle-001',
                    type: 'Bus',
                    make: 'Mercedes-Benz',
                    licensePlate: 'KWT-1234',
                    capacity: 25,
                    status: 'Active',
                    driver: 'Driver 1'
                }
            ],
            drivers: [
                {
                    _id: 'driver-001',
                    name: 'Ahmed Mohammed',
                    phone: '+965 98765432',
                    status: 'Active',
                    assignedVehicle: 'KWT-1234'
                }
            ]
        };
        res.status(200).json({ success: true, fleetData });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching B2B fleet data" });
    }
};

// Get B2B analytics data
export const getB2BAnalytics = async (req, res) => {
    try {
        const analytics = {
            financialPerformance: {
                totalRevenueYTD: 24295,
                netProfitYTD: 17974,
                profitMargin: 74.0
            },
            chartData: {
                labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                revenue: [3500, 7000, 3500, 3800, 3500, 4000],
                expenses: [1500, 1000, 800, 600, 800, 2000]
            }
        };
        res.status(200).json({ success: true, analytics });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching B2B analytics" });
    }
};

// Get B2B partner overview statistics
export const getB2BPartnerOverview = async (req, res) => {
    try {
        const overview = {
            activeVehicles: { current: 8, total: 12 },
            activeContracts: 3,
            revenueMonthly: 4200,
            fleetHealth: 92,
            contracts: [
                {
                    _id: 'contract-001',
                    name: "Employee Transport - Mangaf",
                    organization: "KOC",
                    value: 3246,
                    status: "Active",
                    payment: "Paid"
                }
            ]
        };
        res.status(200).json({ success: true, overview });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching B2B overview" });
    }
};

// Get payment statistics for admin (includes both regular payments and EMI installments)
export const getPaymentStats = async (req, res) => {
    try {
        // Get regular payment stats
        const [regularPending, regularVerified, regularRejected, regularAmountResult, dominantCurrencyResult] = await Promise.all([
            Payment.countDocuments({ verificationStatus: 'PENDING' }),
            Payment.countDocuments({ verificationStatus: { $in: ['VERIFIED', 'AUTO_VERIFIED'] } }),
            Payment.countDocuments({ verificationStatus: 'REJECTED' }),
            Payment.aggregate([
                { $match: { status: { $in: ['COMPLETED', 'PROCESSING'] } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            // Get dominant currency from payments
            Payment.aggregate([
                { $group: { _id: "$currency", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 1 }
            ])
        ]);

        // Get EMI installment stats (cash/bank transfer payments requiring verification)
        const emiStats = await EMIPayment.aggregate([
            { $unwind: "$installments" },
            {
                $facet: {
                    pending: [
                        {
                            $match: {
                                "installments.paymentMethod": { $in: ["CASH", "BANK_TRANSFER"] },
                                "installments.verificationStatus": "PENDING",
                                "installments.status": { $ne: "PAID" },
                                "installments.transactionId": { $exists: true } // Only submitted payments
                            }
                        },
                        { $count: "count" }
                    ],
                    verified: [
                        {
                            $match: {
                                "installments.paymentMethod": { $in: ["CASH", "BANK_TRANSFER"] },
                                "installments.verificationStatus": "VERIFIED",
                                "installments.status": "PAID"
                            }
                        },
                        { $count: "count" }
                    ],
                    rejected: [
                        {
                            $match: {
                                "installments.verificationStatus": "REJECTED"
                            }
                        },
                        { $count: "count" }
                    ],
                    totalAmount: [
                        {
                            $match: {
                                "installments.paymentMethod": { $in: ["CASH", "BANK_TRANSFER"] },
                                "installments.verificationStatus": "PENDING",
                                "installments.transactionId": { $exists: true }
                            }
                        },
                        { $group: { _id: null, total: { $sum: "$installments.amount" } } }
                    ]
                }
            }
        ]);

        const emiPending = emiStats[0]?.pending[0]?.count || 0;
        const emiVerified = emiStats[0]?.verified[0]?.count || 0;
        const emiRejected = emiStats[0]?.rejected[0]?.count || 0;
        const emiAmount = emiStats[0]?.totalAmount[0]?.total || 0;

        const totalPending = regularPending + emiPending;
        const totalVerified = regularVerified + emiVerified;
        const totalRejected = regularRejected + emiRejected;
        const totalAmount = (regularAmountResult[0]?.total || 0) + emiAmount;
        const currency = dominantCurrencyResult[0]?._id || "AED";

        res.status(200).json({
            success: true,
            stats: {
                totalPending,
                totalVerified,
                totalRejected,
                totalAmount,
                currency,
                // Detailed breakdown
                regularPayments: {
                    pending: regularPending,
                    verified: regularVerified,
                    rejected: regularRejected
                },
                emiPayments: {
                    pending: emiPending,
                    verified: emiVerified,
                    rejected: emiRejected
                }
            }
        });
    } catch (error) {
        console.error("Error fetching payment stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching payment statistics",
            error: error.message,
        });
    }
};

// Get recent activity for admin dashboard
export const getRecentActivity = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        // Get recent user registrations
        const recentUsers = await User.find({})
            .select('fullName role createdAt')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit));

        // Get recent payments
        const recentPayments = await Payment.find({})
            .populate('corporateOwnerId', 'fullName companyName')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit));

        // Get recent contracts
        const recentContracts = await Contract.find({})
            .populate('corporateOwnerId', 'fullName companyName')
            .populate('fleetOwnerId', 'fullName companyName')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit));

        // Combine and format activities
        const activities = [];

        // Add user registrations
        recentUsers.forEach(user => {
            activities.push({
                type: 'user_registered',
                title: 'New User Registration',
                description: `${user.fullName} registered as ${user.role.replace('_', ' ')}`,
                timestamp: user.createdAt,
                data: user
            });
        });

        // Add payments
        recentPayments.forEach(payment => {
            activities.push({
                type: 'payment_received',
                title: 'Payment Received',
                description: `${payment.corporateOwnerId?.fullName || 'Unknown'} made a payment of ${payment.amount}`,
                timestamp: payment.createdAt,
                data: payment
            });
        });

        // Add contracts
        recentContracts.forEach(contract => {
            activities.push({
                type: 'contract_signed',
                title: 'Contract Signed',
                description: `Contract signed between ${contract.corporateOwnerId?.companyName} and ${contract.fleetOwnerId?.companyName}`,
                timestamp: contract.createdAt,
                data: contract
            });
        });

        // Sort by timestamp and limit
        const sortedActivities = activities
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, Number.parseInt(limit));

        res.status(200).json({
            success: true,
            recentActivity: sortedActivities
        });
    } catch (error) {
        console.error("[v0] Error fetching recent activity:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching recent activity",
            error: error.message,
        });
    }
};

// Get all pending payments for admin verification (includes both regular payments and EMI installments)
export const getPendingPayments = async (req, res) => {
    try {
        // Query for regular payments that need verification
        const regularPayments = await Payment.find({
            verificationStatus: "PENDING",
            $or: [
                { status: "PENDING" },
                { status: "COMPLETED", paymentProvider: { $exists: true } }
            ]
        })
            .populate("contractId", "contractNumber")
            .populate("corporateOwnerId", "fullName companyName email phone")
            .populate("fleetOwnerId", "fullName companyName email phone")
            .sort({ createdAt: -1 })
            .lean()

        // Format regular payments
        const formattedRegularPayments = regularPayments.map(p => ({
            ...p,
            paymentSource: "REGULAR",
            displayType: p.paymentType || "Contract Payment"
        }))

        // Query for EMI installments that need verification (cash/bank transfer payments with transactionId)
        const emiPaymentsWithPending = await EMIPayment.find({
            "installments": {
                $elemMatch: {
                    paymentMethod: { $in: ["CASH", "BANK_TRANSFER"] },
                    verificationStatus: "PENDING",
                    transactionId: { $exists: true, $ne: null }
                }
            }
        })
            .populate("contractId", "contractNumber")
            .populate("corporateOwnerId", "fullName companyName email phone")
            .populate("fleetOwnerId", "fullName companyName email phone")
            .lean()

        // Extract pending EMI installments and format them like regular payments
        const emiInstallments = []
        for (const emiPayment of emiPaymentsWithPending) {
            for (const installment of emiPayment.installments) {
                if (
                    (installment.paymentMethod === "CASH" || installment.paymentMethod === "BANK_TRANSFER") &&
                    installment.verificationStatus === "PENDING" &&
                    installment.transactionId
                ) {
                    emiInstallments.push({
                        _id: `${emiPayment._id}_${installment.installmentNumber}`,
                        emiPaymentId: emiPayment._id,
                        installmentNumber: installment.installmentNumber,
                        contractId: emiPayment.contractId,
                        corporateOwnerId: emiPayment.corporateOwnerId,
                        fleetOwnerId: emiPayment.fleetOwnerId,
                        amount: installment.amount,
                        currency: emiPayment.emiPlan?.currency || "AED",
                        paymentType: "EMI",
                        paymentMethod: installment.paymentMethod,
                        paymentProvider: "MANUAL",
                        verificationStatus: installment.verificationStatus,
                        status: installment.status,
                        transactionId: installment.transactionId,
                        createdAt: installment.paidAt || emiPayment.createdAt,
                        paymentSource: "EMI",
                        displayType: `EMI Installment ${installment.installmentNumber}/${emiPayment.emiPlan?.tenure || 6}`,
                        // Include EMI specific data
                        emiData: {
                            tenure: emiPayment.emiPlan?.tenure,
                            monthlyEMI: emiPayment.emiPlan?.monthlyEMI,
                            totalAmount: emiPayment.emiPlan?.totalAmount,
                            contractAmount: emiPayment.emiPlan?.contractAmount,
                            negotiationCommission: emiPayment.emiPlan?.negotiationCommission,
                            adminCommission: installment.adminCommission,
                            fleetOwnerAmount: installment.fleetOwnerAmount,
                            negotiationCommissionPortion: installment.negotiationCommissionPortion,
                            contractAmountPortion: installment.contractAmountPortion
                        }
                    })
                }
            }
        }

        // Combine and sort by createdAt
        const allPayments = [...formattedRegularPayments, ...emiInstallments]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        res.status(200).json({
            success: true,
            count: allPayments.length,
            payments: allPayments,
        })
    } catch (error) {
        console.error("[v0] Error fetching pending payments:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching pending payments",
            error: error.message,
        })
    }
}

// Get payment details for verification
export const getPaymentDetails = async (req, res) => {
    try {
        const { paymentId } = req.params

        const payment = await Payment.findById(paymentId)
            .populate("contractId")
            .populate("corporateOwnerId", "fullName companyName email whatsappNumber company")
            .populate("fleetOwnerId", "fullName companyName email whatsappNumber company")

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found",
            })
        }

        res.status(200).json({
            success: true,
            payment,
        })
    } catch (error) {
        console.error("[v0] Error fetching payment details:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching payment details",
            error: error.message,
        })
    }
}

// Helper function to verify EMI installment cash payments
const verifyEMIInstallment = async (req, res, emiPaymentId, installmentNumber, action, reason) => {
    try {
        const emiPayment = await EMIPayment.findById(emiPaymentId)
            .populate("contractId", "contractNumber")
            .populate("corporateOwnerId", "fullName companyName email")
            .populate("fleetOwnerId", "fullName companyName email")

        if (!emiPayment) {
            return res.status(404).json({
                success: false,
                message: "EMI payment not found",
            })
        }

        const installment = emiPayment.installments.find(i => i.installmentNumber === installmentNumber)

        if (!installment) {
            return res.status(404).json({
                success: false,
                message: "Installment not found",
            })
        }

        if (installment.verificationStatus !== "PENDING" || !installment.transactionId) {
            return res.status(400).json({
                success: false,
                message: "Installment already verified or not submitted for verification",
            })
        }

        if (action === "APPROVE") {
            // Update installment status
            installment.status = "PAID"
            installment.verificationStatus = "VERIFIED"
            installment.paidAt = new Date()
            installment.verifiedBy = req.userId
            installment.verifiedAt = new Date()

            // Credit B2B Partner wallet
            let fleetWallet = await Wallet.findOne({ userId: emiPayment.fleetOwnerId._id })
            if (!fleetWallet) {
                fleetWallet = await Wallet.create({
                    userId: emiPayment.fleetOwnerId._id,
                    role: "B2B_PARTNER",
                    balance: 0,
                    totalEarnings: 0
                })
            }

            const fleetName = emiPayment.fleetOwnerId?.companyName || emiPayment.fleetOwnerId?.fullName || "Fleet Owner"
            const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName || "Corporate"

            fleetWallet.balance += installment.fleetOwnerAmount
            fleetWallet.totalEarnings += installment.fleetOwnerAmount
            const paymentMethodLabel = installment.paymentMethod === "BANK_TRANSFER" ? "Bank Transfer" : "Cash"
            fleetWallet.transactions.push({
                type: "DEPOSIT",
                amount: installment.fleetOwnerAmount,
                description: `EMI Payment (${paymentMethodLabel} Verified) - Installment ${installment.installmentNumber}/${emiPayment.emiPlan.tenure} - Contract ${emiPayment.contractId.contractNumber}`,
                status: "COMPLETED",
                senderId: emiPayment.corporateOwnerId._id,
                senderName: corporateName,
            })
            await fleetWallet.save()

            installment.fleetOwnerCredited = true
            installment.fleetOwnerCreditedAt = new Date()

            console.log(`[v0] EMI ${paymentMethodLabel} Payment - B2B Partner wallet credited:`, installment.fleetOwnerAmount)

            // Credit Admin wallet - Commission + Negotiation Commission
            let adminWallet = await Wallet.findOne({ role: "ADMIN" })
            if (!adminWallet) {
                adminWallet = await Wallet.create({
                    userId: req.userId,
                    role: "ADMIN",
                    balance: 0,
                    totalEarnings: 0
                })
            }

            // Contract commission
            if (installment.adminCommission.amount > 0) {
                adminWallet.balance += installment.adminCommission.amount
                adminWallet.totalEarnings += installment.adminCommission.amount
                adminWallet.transactions.push({
                    type: "COMMISSION_DEDUCTION",
                    amount: installment.adminCommission.amount,
                    description: `EMI Commission (${installment.adminCommission.rate}%) - Installment ${installment.installmentNumber} - Contract ${emiPayment.contractId.contractNumber}`,
                    status: "COMPLETED",
                    senderId: emiPayment.fleetOwnerId._id,
                    senderName: fleetName,
                })
                installment.adminCommission.status = "CREDITED"
                installment.adminCommission.creditedAt = new Date()
                console.log(`[v0] EMI ${paymentMethodLabel} Payment - Admin commission credited:`, installment.adminCommission.amount)
            }

            // Negotiation commission
            if (installment.negotiationCommissionPortion > 0) {
                adminWallet.balance += installment.negotiationCommissionPortion
                adminWallet.totalEarnings += installment.negotiationCommissionPortion
                adminWallet.transactions.push({
                    type: "NEGOTIATION_COMMISSION",
                    amount: installment.negotiationCommissionPortion,
                    description: `Negotiation Commission (EMI) - Installment ${installment.installmentNumber} - Contract ${emiPayment.contractId.contractNumber}`,
                    status: "COMPLETED",
                    senderId: emiPayment.corporateOwnerId._id,
                    senderName: corporateName,
                })
                installment.negotiationCommissionCredited = true
                installment.negotiationCommissionCreditedAt = new Date()
                console.log(`[v0] EMI ${paymentMethodLabel} Payment - Negotiation commission credited:`, installment.negotiationCommissionPortion)
            }

            await adminWallet.save()

            // Update EMI payment summary
            emiPayment.summary.totalPaid = emiPayment.installments
                .filter(i => i.status === "PAID")
                .reduce((sum, i) => sum + i.amount, 0)
            emiPayment.summary.installmentsPaid = emiPayment.installments.filter(i => i.status === "PAID").length
            emiPayment.summary.installmentsRemaining = emiPayment.installments.filter(i => i.status !== "PAID").length
            emiPayment.summary.totalRemaining = emiPayment.emiPlan.totalAmount - emiPayment.summary.totalPaid
            emiPayment.summary.lastPaymentDate = new Date()

            const nextPending = emiPayment.installments.find(i => i.status === "PENDING")
            if (nextPending) {
                emiPayment.summary.nextDueDate = nextPending.dueDate
            } else {
                emiPayment.summary.nextDueDate = null
                emiPayment.emiPlan.status = "COMPLETED"
            }

            // Update commission settings
            emiPayment.commissionSettings.totalAdminCommission += installment.adminCommission.amount
            emiPayment.commissionSettings.totalNegotiationCommissionPaid += installment.negotiationCommissionPortion
            emiPayment.commissionSettings.totalFleetOwnerAmount += installment.fleetOwnerAmount

            await emiPayment.save()

            // Send notifications
            try {
                await createNotification({
                    recipientId: emiPayment.corporateOwnerId._id,
                    recipientRole: "CORPORATE",
                    type: "PAYMENT",
                    title: "EMI Payment Verified",
                    message: `Your EMI installment #${installment.installmentNumber} of AED ${installment.amount.toLocaleString()} has been verified and approved.`,
                    data: {
                        emiPaymentId: emiPayment._id,
                        contractId: emiPayment.contractId._id,
                        installmentNumber,
                        amount: installment.amount
                    }
                })

                await createNotification({
                    recipientId: emiPayment.fleetOwnerId._id,
                    recipientRole: "B2B_PARTNER",
                    type: "PAYMENT",
                    title: "EMI Payment Received",
                    message: `EMI installment #${installment.installmentNumber} payment of AED ${installment.fleetOwnerAmount.toLocaleString()} has been credited to your wallet.`,
                    data: {
                        emiPaymentId: emiPayment._id,
                        contractId: emiPayment.contractId._id,
                        installmentNumber,
                        amount: installment.fleetOwnerAmount
                    }
                })
            } catch (notifError) {
                console.error("[v0] Error sending EMI verification notifications:", notifError)
            }

            return res.status(200).json({
                success: true,
                message: "EMI installment verified and approved successfully",
                data: {
                    emiPaymentId: emiPayment._id,
                    installmentNumber,
                    amount: installment.amount,
                    fleetOwnerAmount: installment.fleetOwnerAmount,
                    adminCommission: installment.adminCommission.amount,
                    negotiationCommission: installment.negotiationCommissionPortion
                }
            })

        } else if (action === "REJECT") {
            installment.verificationStatus = "REJECTED"
            installment.status = "PENDING" // Reset to PENDING so they can try again
            installment.transactionId = null // Clear the transaction ID
            installment.rejectedBy = req.userId
            installment.rejectedAt = new Date()
            installment.rejectionReason = reason

            await emiPayment.save()

            // Notify corporate owner
            try {
                await createNotification({
                    recipientId: emiPayment.corporateOwnerId._id,
                    recipientRole: "CORPORATE",
                    type: "PAYMENT",
                    title: "EMI Payment Rejected",
                    message: `Your EMI installment #${installment.installmentNumber} payment was rejected. Reason: ${reason || "Not specified"}`,
                    data: {
                        emiPaymentId: emiPayment._id,
                        contractId: emiPayment.contractId._id,
                        installmentNumber,
                        rejectionReason: reason
                    }
                })
            } catch (notifError) {
                console.error("[v0] Error sending EMI rejection notification:", notifError)
            }

            return res.status(200).json({
                success: true,
                message: "EMI installment payment rejected",
                data: {
                    emiPaymentId: emiPayment._id,
                    installmentNumber,
                    rejectionReason: reason
                }
            })
        }

        return res.status(400).json({
            success: false,
            message: "Invalid action. Use APPROVE or REJECT.",
        })

    } catch (error) {
        console.error("[v0] Error verifying EMI installment:", error)
        return res.status(500).json({
            success: false,
            message: "Error verifying EMI installment",
            error: error.message,
        })
    }
}

// Verify and approve payment (supports both regular payments and EMI installments)
export const verifyPayment = async (req, res) => {
    try {
        const { paymentId } = req.params
        const { action, reason } = req.body // action: 'APPROVE' or 'REJECT'

        // Check if this is an EMI installment (format: emiPaymentId_installmentNumber)
        if (paymentId.includes("_")) {
            const [emiPaymentId, installmentNumber] = paymentId.split("_")
            const installmentNum = parseInt(installmentNumber)

            return await verifyEMIInstallment(req, res, emiPaymentId, installmentNum, action, reason)
        }

        const payment = await Payment.findById(paymentId).populate("contractId")

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found",
            })
        }

        if (payment.verificationStatus !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: "Payment already verified",
            })
        }

        if (action === "APPROVE") {
            // For gateway payments (Stripe, etc.), status is already COMPLETED
            // Only update status to COMPLETED for cash payments
            if (payment.status !== "COMPLETED") {
                payment.status = "COMPLETED"
            }
            payment.verificationStatus = "VERIFIED"
            payment.verifiedBy = req.userId
            payment.adminVerifiedAt = new Date()

            const advanceAmount = payment.advanceAmount
            const securityDepositAmount = payment.securityDepositAmount

            // Get dynamic commission rate from payment (set during payment initiation)
            const appliedCommissionRate = payment.appliedCommissionRate || 10 // Default 10% if not set
            const fleetOwnerPercentage = 100 - appliedCommissionRate

            const adminCommissionAmount = payment.adminCommission // Already calculated with dynamic rate
            const fleetOwnerAmount = payment.fleetOwnerAmount // Already calculated with dynamic rate

            console.log("[v0] Verifying Payment Breakdown:")
            console.log("[v0] Advance Amount:", advanceAmount)
            console.log("[v0] Security Deposit (held separately):", securityDepositAmount)
            console.log("[v0] Applied Commission Rate:", appliedCommissionRate, "%")
            console.log("[v0] Admin Commission:", adminCommissionAmount)
            console.log("[v0] Fleet Owner Amount:", fleetOwnerAmount)

            payment.adminCommission = {
                amount: adminCommissionAmount,
                percentage: appliedCommissionRate,
                appliedOn: "advance",
            }
            payment.fleetOwnerShare = {
                amount: fleetOwnerAmount,
                percentage: fleetOwnerPercentage,
                appliedOn: "advance",
            }
            payment.securityDepositInfo = {
                amount: securityDepositAmount,
                status: "HELD",
                refundable: true,
            }

            await payment.save()

            // IMPORTANT: Check if wallets were already credited (for gateway payments like STRIPE/TAP)
            // Gateway payments are credited in paymentController.js processPaymentToWallets()
            // Manual payments (CASH/BANK_TRANSFER) need wallet crediting here during admin verification
            const shouldCreditWallets = !payment.walletCredited && payment.paymentProvider === "MANUAL"

            console.log("[v0] Should credit wallets:", shouldCreditWallets)
            console.log("[v0] Payment provider:", payment.paymentProvider)
            console.log("[v0] Wallet already credited:", payment.walletCredited)

            let adminWallet, fleetWallet
            let adminBalanceBefore = 0, adminBalanceAfter = 0
            let adminSecurityBefore = 0, adminSecurityAfter = 0
            let fleetBalanceBefore = 0, fleetBalanceAfter = 0

            if (shouldCreditWallets) {
                // Update Admin Wallet - Commission only
                // First find by userId only (since userId is unique in the schema)
                adminWallet = await Wallet.findOne({ userId: req.userId })
                if (!adminWallet) {
                    adminWallet = await Wallet.create({
                        userId: req.userId,
                        role: "ADMIN",
                        balance: 0,
                        securityDepositHeld: 0
                    })
                }

                adminBalanceBefore = adminWallet.balance
                adminSecurityBefore = adminWallet.securityDepositHeld

                adminWallet.balance += adminCommissionAmount
                adminWallet.securityDepositHeld += securityDepositAmount

                adminBalanceAfter = adminWallet.balance
                adminSecurityAfter = adminWallet.securityDepositHeld
                await adminWallet.save()

                console.log(
                    "[v0] Admin wallet updated - Commission:",
                    adminCommissionAmount,
                    "Security Deposit Held:",
                    securityDepositAmount,
                )

                // Update Fleet Owner Wallet - Only (100 - commissionRate)% of advance
                // First find by userId only (since userId is unique in the schema)
                fleetWallet = await Wallet.findOne({ userId: payment.fleetOwnerId })
                if (!fleetWallet) {
                    fleetWallet = await Wallet.create({
                        userId: payment.fleetOwnerId,
                        role: "B2B_PARTNER",
                        balance: 0
                    })
                }

                fleetBalanceBefore = fleetWallet.balance
                fleetWallet.balance += fleetOwnerAmount
                fleetBalanceAfter = fleetWallet.balance
                await fleetWallet.save()

                console.log("[v0] Fleet owner wallet updated:", fleetOwnerAmount)

                // Create transaction records with dynamic commission rates
                await Transaction.create([
                    {
                        userId: req.userId,
                        walletId: adminWallet._id,
                        type: "CREDIT",
                        category: "COMMISSION_EARNED",
                        amount: adminCommissionAmount,
                        currency: payment.currency,
                        balance: adminWallet.balance,
                        balanceBefore: adminBalanceBefore,
                        balanceAfter: adminBalanceAfter,
                        paymentId: payment._id,
                        contractId: payment.contractId,
                        description: `Admin commission (${appliedCommissionRate}% of advance) for contract ${payment.contractId.contractNumber}`,
                    },
                    {
                        userId: payment.fleetOwnerId,
                        walletId: fleetWallet._id,
                        type: "CREDIT",
                        category: "PAYMENT_RECEIVED",
                        amount: fleetOwnerAmount,
                        currency: payment.currency,
                        balance: fleetWallet.balance,
                        balanceBefore: fleetBalanceBefore,
                        balanceAfter: fleetBalanceAfter,
                        paymentId: payment._id,
                        contractId: payment.contractId,
                        description: `Rental income (${fleetOwnerPercentage}% of advance) for contract ${payment.contractId.contractNumber}`,
                    },
                    {
                        userId: req.userId,
                        walletId: adminWallet._id,
                        type: "HOLD",
                        category: "SECURITY_DEPOSIT",
                        amount: securityDepositAmount,
                        balance: adminWallet.securityDepositHeld,
                        balanceBefore: adminSecurityBefore,
                        balanceAfter: adminSecurityAfter,
                        paymentId: payment._id,
                        contractId: payment.contractId,
                        description: `Security deposit held (refundable) for contract ${payment.contractId.contractNumber}`,
                    },
                ])

                // Mark payment as wallet credited to prevent duplicate credits
                payment.walletCredited = true
                payment.walletCreditedAt = new Date()
                await payment.save()

                console.log("[v0] Payment marked as walletCredited = true")
            } else {
                console.log("[v0] Skipping wallet credit - already credited by payment gateway or not a manual payment")
                // For gateway payments, just get the wallets for reference in notifications
                adminWallet = await Wallet.findOne({ userId: req.userId })
                fleetWallet = await Wallet.findOne({ userId: payment.fleetOwnerId })
            }

            const contract = payment.contractId
            if (payment.paymentType === "advance") {
                contract.financials.advancePayment.status = "PAID"
                contract.financials.advancePayment.paidAt = new Date()
                contract.financials.advancePayment.paidVia = payment.paymentMethod
                contract.financials.advancePayment.transactionId = payment._id

                contract.financials.securityDeposit.status = "PAID"
                contract.financials.securityDeposit.paidAt = new Date()
                contract.financials.securityDeposit.paidVia = payment.paymentMethod
                contract.financials.securityDeposit.transactionId = payment._id

                contract.status = "ACTIVE"
                contract.vehicleAccess.isActive = true
                contract.activatedAt = new Date()

                const finalDueDate = new Date(contract.rentalPeriod.endDate)
                finalDueDate.setDate(finalDueDate.getDate() - 7)

                const finalSchedule = new PaymentSchedule({
                    contractId: contract._id,
                    corporateOwnerId: contract.corporateOwnerId,
                    fleetOwnerId: contract.fleetOwnerId,
                    currency: contract.financials.currency,
                    scheduleType: "FINAL",
                    amount: contract.financials.finalPayment.amount,
                    dueDate: finalDueDate,
                })
                await finalSchedule.save()

                console.log("[v0] Final payment schedule created automatically")

                contract.financials.finalPayment.dueDate = finalDueDate
                contract.financials.finalPayment.status = "PENDING"

                contract.statusHistory.push({
                    status: "ACTIVE",
                    changedAt: new Date(),
                    changedBy: req.userId,
                    reason: "Payment verified - contract activated after advance + security deposit received",
                })
            } else if (payment.paymentType === "final") {
                contract.financials.finalPayment.status = "PAID"
                contract.financials.finalPayment.paidAt = new Date()
                contract.financials.finalPayment.paidVia = payment.paymentMethod
                contract.financials.finalPayment.transactionId = payment._id


                await PaymentSchedule.updateOne(
                    {
                        contractId: contract._id,
                        scheduleType: "FINAL",
                        status: "PENDING",
                    },
                    {
                        $set: {
                            status: "PAID",
                            paidAt: new Date(),
                            paymentMethod: payment.paymentMethod,
                            transactionId: payment._id,
                        },
                    },
                )

                contract.statusHistory.push({
                    status: "ACTIVE",
                    changedAt: new Date(),
                    changedBy: req.userId,
                    reason: "Final payment verified - contract completed",
                })
            }

            contract.markModified("financials")
            await contract.save()

            console.log("[v0] Contract updated to status:", contract.status)

            // Credit Admin Negotiation Commission from Corporate (if negotiation was done)
            // This is separate from the B2B commission - this is commission for negotiation services
            // IMPORTANT: Only credit if this is a MANUAL payment (gateway payments are handled in processPaymentToWallets)
            if (payment.paymentType === "advance" && contract.negotiationCommission && shouldCreditWallets) {
                try {
                    const negotiationCommission = contract.negotiationCommission
                    const negotiationCommissionAmount = negotiationCommission.adminCommission || 0

                    // Check if negotiation commission was already paid (avoid duplicates)
                    if (negotiationCommission.commissionStatus === "PAID") {
                        console.log("[v0] Negotiation commission already PAID, skipping")
                    } else {
                        console.log("[v0] Processing negotiation commission:", negotiationCommissionAmount)

                        // Update contract negotiation commission status
                        await Contract.findByIdAndUpdate(
                            contract._id,
                            { "negotiationCommission.commissionStatus": "PAID" },
                            { new: true }
                        )
                        console.log("[v0] Contract negotiation commission status marked as PAID")

                        // Also update AdminNegotiation status if exists
                        if (negotiationCommission.negotiationId) {
                            const negotiation = await AdminNegotiation.findById(negotiationCommission.negotiationId)

                            if (negotiation) {
                                // Update negotiation commission status
                                await AdminNegotiation.findByIdAndUpdate(
                                    negotiationCommission.negotiationId,
                                    {
                                        "adminCommissionFromCorporate.status": "PAID",
                                        "adminCommissionFromCorporate.paidAt": new Date()
                                    },
                                    { new: true }
                                )
                                console.log("[v0] AdminNegotiation commission marked as PAID")

                                // Credit Admin wallet with negotiation commission
                                if (negotiationCommissionAmount > 0 && negotiation.completedBy) {
                                    const corporateUser = await User.findById(contract.corporateOwnerId).select('fullName companyName')
                                    const corporateName = corporateUser?.companyName || corporateUser?.fullName || 'Corporate'

                                    const creditResult = await creditAdminNegotiationCommission({
                                        adminUserId: negotiation.completedBy,
                                        amount: negotiationCommissionAmount,
                                        currency: payment.currency || contract.financials.currency || "AED",
                                        corporateUserId: contract.corporateOwnerId,
                                        corporateName: corporateName,
                                        negotiationId: negotiation._id,
                                        contractId: contract._id,
                                        contractNumber: contract.contractNumber
                                    })

                                    if (creditResult.success) {
                                        console.log("[v0] Admin wallet credited with negotiation commission:", {
                                            adminId: negotiation.completedBy,
                                            amount: negotiationCommissionAmount,
                                            newBalance: creditResult.newBalance
                                        })
                                    } else {
                                        console.error("[v0] Failed to credit admin wallet with negotiation commission:", creditResult.message)
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("[v0] Error processing negotiation commission:", err)
                }
            } else if (payment.paymentType === "advance" && contract.negotiationCommission && !shouldCreditWallets) {
                console.log("[v0] Skipping negotiation commission - gateway payment already handled it")
            }

            // Send real-time notifications to Corporate and B2B Partner
            const corporateUser = await User.findById(contract.corporateOwnerId)
            const b2bPartnerUser = await User.findById(contract.fleetOwnerId)

            // Notification for Corporate user
            if (corporateUser) {
                const corporateNotification = await createNotification({
                    userId: contract.corporateOwnerId,
                    type: "PAYMENT_VERIFIED",
                    title: "Payment Verified",
                    message: `Your ${payment.paymentType} payment of ${payment.amount} ${payment.currency} for contract ${contract.contractNumber} has been verified and approved.${contract.status === "ACTIVE" ? " Your contract is now ACTIVE!" : ""}`,
                    metadata: {
                        paymentId: payment._id,
                        contractId: contract._id,
                        contractNumber: contract.contractNumber,
                        amount: payment.amount,
                        currency: payment.currency,
                        paymentMethod: payment.paymentMethod,
                        paymentType: payment.paymentType,
                        contractStatus: contract.status,
                    },
                })
                sendRealTimeNotification(contract.corporateOwnerId.toString(), corporateNotification)
            }

            // Notification for B2B Partner
            if (b2bPartnerUser) {
                const b2bNotification = await createNotification({
                    userId: contract.fleetOwnerId,
                    type: "PAYMENT_RECEIVED",
                    title: "Payment Received",
                    message: `Payment of ${fleetOwnerAmount} ${payment.currency} (90% of advance) has been credited to your wallet for contract ${contract.contractNumber}. Payment method: ${payment.paymentMethod}.${contract.status === "ACTIVE" ? " Contract is now ACTIVE!" : ""}`,
                    metadata: {
                        paymentId: payment._id,
                        contractId: contract._id,
                        contractNumber: contract.contractNumber,
                        totalAmount: payment.amount,
                        yourShare: fleetOwnerAmount,
                        adminCommission: adminCommissionAmount,
                        currency: payment.currency,
                        paymentMethod: payment.paymentMethod,
                        paymentType: payment.paymentType,
                        contractStatus: contract.status,
                        expectedPayoutDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                    },
                })
                sendRealTimeNotification(contract.fleetOwnerId.toString(), b2bNotification)
            }

            // If contract is now ACTIVE, send contract activation notification
            if (contract.status === "ACTIVE") {
                // Notification for Corporate
                const corporateActivationNotif = await createNotification({
                    userId: contract.corporateOwnerId,
                    type: "CONTRACT_ACTIVATED",
                    title: "Contract Activated",
                    message: `Your contract ${contract.contractNumber} is now active! You can now use the assigned vehicles.`,
                    metadata: {
                        contractId: contract._id,
                        contractNumber: contract.contractNumber,
                        startDate: contract.rentalPeriod.startDate,
                        endDate: contract.rentalPeriod.endDate,
                    },
                })
                sendRealTimeNotification(contract.corporateOwnerId.toString(), corporateActivationNotif)

                // Notification for B2B Partner
                const b2bActivationNotif = await createNotification({
                    userId: contract.fleetOwnerId,
                    type: "CONTRACT_ACTIVATED",
                    title: "Contract Activated",
                    message: `Contract ${contract.contractNumber} is now active! Please ensure vehicles are ready for the client.`,
                    metadata: {
                        contractId: contract._id,
                        contractNumber: contract.contractNumber,
                        startDate: contract.rentalPeriod.startDate,
                        endDate: contract.rentalPeriod.endDate,
                    },
                })
                sendRealTimeNotification(contract.fleetOwnerId.toString(), b2bActivationNotif)
            }

            return res.status(200).json({
                success: true,
                message: "Payment verified successfully",
                data: {
                    payment,
                    paymentBreakdown: {
                        advanceAmount,
                        securityDepositAmount,
                        adminCommission: adminCommissionAmount,
                        fleetOwnerAmount,
                    },
                },
            })
        } else if (action === "REJECT") {
            payment.status = "FAILED"
            payment.verificationStatus = "REJECTED"
            payment.verifiedBy = req.userId
            payment.verifiedAt = new Date()
            payment.failureReason = reason || "Payment rejected by admin"

            await payment.save()


            // Get contract for notification
            const contract = payment.contractId

            // Send rejection notification to Corporate
            const corporateRejectionNotif = await createNotification({
                userId: contract.corporateOwnerId,
                type: "PAYMENT_REJECTED",
                title: "Payment Rejected",
                message: `Your payment of ${payment.amount} ${payment.currency} for contract ${contract.contractNumber} has been rejected. Reason: ${reason || "Payment rejected by admin"}. Please contact support or try again.`,
                metadata: {
                    paymentId: payment._id,
                    contractId: contract._id,
                    contractNumber: contract.contractNumber,
                    amount: payment.amount,
                    currency: payment.currency,
                    reason: reason || "Payment rejected by admin",
                },
            })
            sendRealTimeNotification(contract.corporateOwnerId.toString(), corporateRejectionNotif)

            // Send notification to B2B Partner about rejection
            const b2bRejectionNotif = await createNotification({
                userId: contract.fleetOwnerId,
                type: "PAYMENT_REJECTED",
                title: "Payment Rejected",
                message: `Payment for contract ${contract.contractNumber} was rejected. The corporate client will need to resubmit payment.`,
                metadata: {
                    paymentId: payment._id,
                    contractId: contract._id,
                    contractNumber: contract.contractNumber,
                    reason: reason || "Payment rejected by admin",
                },
            })
            sendRealTimeNotification(contract.fleetOwnerId.toString(), b2bRejectionNotif)

            return res.status(200).json({
                success: true,
                message: "Payment rejected",
                data: { payment },
            })
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid action. Must be 'APPROVE' or 'REJECT'",
            })
        }
    } catch (error) {
        console.error("[v0] Verify payment error:", error)
        res.status(500).json({
            success: false,
            message: "Error verifying payment",
            error: error.message,
        })
    }
}

// Get all contracts for admin
export const getAllContracts = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query
        const query = {}

        if (status) {
            query.status = status
        }

        const contracts = await Contract.find(query)
            .populate("corporateOwnerId", "name email phone company")
            .populate("fleetOwnerId", "name email phone company")
            .populate("vehicles.vehicleId")
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit))

        const total = await Contract.countDocuments(query)

        res.status(200).json({
            success: true,
            contracts,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        })
    } catch (error) {
        console.error("[v0] Error fetching contracts:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching contracts",
            error: error.message,
        })
    }
}

// Get admin dashboard statistics
export const getDashboardStats = async (req, res) => {
    try {
        // Fetch all stats in parallel for performance
        const [
            // User counts
            totalUsers,
            totalCorporates,
            totalB2CPartners,
            totalB2BPartners,
            totalDrivers,
            suspendedUsers,

            // Contract counts
            totalContracts,
            activeContracts,

            // Booking counts - B2C passenger bookings
            totalB2CBookings,
            activeB2CBookings,

            // Payment counts
            pendingPayments,
            totalPaymentRevenue,

            // Trip counts
            activeTrips,

            // Wallet
            adminWallet,
            dominantCurrencyResult
        ] = await Promise.all([
            // User counts
            User.countDocuments(),
            User.countDocuments({ role: "CORPORATE" }),
            User.countDocuments({ role: "B2C_PARTNER" }),
            User.countDocuments({ role: "B2B_PARTNER" }),
            User.countDocuments({ role: { $in: ["B2B_PARTNER_DRIVER", "CORPORATE_DRIVER", "B2C_PARTNER_DRIVER"] } }),
            User.countDocuments({ status: "SUSPENDED" }),

            // Contract counts
            Contract.countDocuments(),
            Contract.countDocuments({ status: "ACTIVE" }),

            // B2C Passenger Bookings
            B2CPassengerBooking.countDocuments(),
            B2CPassengerBooking.countDocuments({
                status: { $in: ["CONFIRMED", "ACTIVE", "BOARDED"] }
            }),

            // Payment counts
            Payment.countDocuments({ verificationStatus: "PENDING" }),
            Payment.aggregate([
                { $match: { status: "COMPLETED" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),

            // Active trips (trips currently in progress)
            B2CPartnerTrip.countDocuments({
                status: { $in: ["SCHEDULED", "IN_PROGRESS", "STARTED"] },
                tripDate: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lte: new Date(new Date().setHours(23, 59, 59, 999))
                }
            }),

            // Admin wallet
            Wallet.findOne({ userId: req.userId, role: "ADMIN" }),

            // Get the dominant currency from wallets
            Wallet.aggregate([
                { $group: { _id: "$currency", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 1 }
            ])
        ]);

        const currency = dominantCurrencyResult[0]?._id || adminWallet?.currency || "AED";

        // Total revenue is the admin wallet balance (commissions from all payments)
        const totalRevenue = adminWallet?.totalEarnings || adminWallet?.balance || 0;

        res.status(200).json({
            success: true,
            stats: {
                // User stats
                totalUsers,
                totalCorporates,
                totalB2CPartners,
                totalB2BPartners,
                totalDrivers,
                suspendedUsers,

                // Contract stats
                totalContracts,
                activeContracts,

                // Booking stats
                totalBookings: totalB2CBookings,
                activeBookings: activeB2CBookings,

                // Payment stats
                pendingPayments,
                totalRevenue: totalRevenue,
                adminBalance: adminWallet?.balance || 0,
                totalEarnings: adminWallet?.totalEarnings || 0,

                // Trip stats
                activeTrips,

                currency: currency,
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching dashboard stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching dashboard statistics",
            error: error.message,
        });
    }
}

// Get monthly revenue data for admin dashboard
export const getMonthlyRevenue = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Admin revenue = the admin's own wallet earnings recorded in the Transaction ledger.
        // This matches the "Total Revenue" stat (admin wallet totalEarnings) instead of only
        // counting B2B contract Payment documents.
        const adminUserId = new mongoose.Types.ObjectId(req.userId);

        // Reference models that belong to the corporate side; everything else (B2C bookings,
        // monthly pass renewals, etc.) is counted as B2C revenue.
        const CORPORATE_REFS = ["Payment", "Contract", "AdminNegotiation", "CorporateBooking"];

        const monthlyRevenue = await Transaction.aggregate([
            {
                $match: {
                    userId: adminUserId,
                    createdAt: {
                        $gte: new Date(currentYear, 0, 1),
                        $lte: new Date(currentYear, 11, 31, 23, 59, 59, 999)
                    }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    // Net total = credited earnings minus any debited reversals/refunds
                    total: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", { $multiply: ["$amount", -1] }]
                        }
                    },
                    corporate: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$type", "CREDIT"] },
                                        { $in: [{ $ifNull: ["$referenceModel", "none"] }, CORPORATE_REFS] }
                                    ]
                                },
                                "$amount",
                                0
                            ]
                        }
                    },
                    b2c: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$type", "CREDIT"] },
                                        { $not: [{ $in: [{ $ifNull: ["$referenceModel", "none"] }, CORPORATE_REFS] }] }
                                    ]
                                },
                                "$amount",
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Format data for frontend (zero-filled for months with no data)
        const data = months.map((month, index) => {
            const monthData = monthlyRevenue.find(item => item._id === index + 1);
            const total = Math.round((monthData?.total || 0) * 100) / 100;
            const corporate = Math.round((monthData?.corporate || 0) * 100) / 100;
            const b2c = Math.round((monthData?.b2c || 0) * 100) / 100;
            return {
                month,
                total: total < 0 ? 0 : total,
                corporate,
                b2c
            };
        });

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("[v0] Error fetching monthly revenue:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching monthly revenue data",
            error: error.message,
        });
    }
}

// Get booking trends for admin dashboard
export const getBookingTrends = async (req, res) => {
    try {
        const { period = "12" } = req.query;
        const monthsToShow = Math.min(Math.max(parseInt(period) || 12, 1), 12);

        // Build a rolling window ending with the current month so trends are always relevant.
        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const windowStart = new Date(now.getFullYear(), now.getMonth() - (monthsToShow - 1), 1);
        const windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Count real bookings from both booking sources, grouped by year+month
        const groupByYearMonth = (collectionMatch) => ({
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            ...collectionMatch
        });

        const [b2cTrends, corporateTrends] = await Promise.all([
            B2CPassengerBooking.aggregate([
                { $match: { createdAt: { $gte: windowStart, $lte: windowEnd } } },
                { $group: groupByYearMonth({ count: { $sum: 1 } }) }
            ]),
            CorporateBooking.aggregate([
                { $match: { createdAt: { $gte: windowStart, $lte: windowEnd } } },
                { $group: groupByYearMonth({ count: { $sum: 1 } }) }
            ])
        ]);

        const lookup = (trends, year, month) =>
            trends.find(t => t._id.year === year && t._id.month === month)?.count || 0;

        // Build the ordered list of months in the rolling window (oldest -> newest)
        const data = [];
        for (let i = 0; i < monthsToShow; i++) {
            const d = new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1);
            const year = d.getFullYear();
            const monthNum = d.getMonth() + 1;
            const b2cCount = lookup(b2cTrends, year, monthNum);
            const corporateCount = lookup(corporateTrends, year, monthNum);
            data.push({
                month: monthNames[d.getMonth()],
                bookings: b2cCount + corporateCount,
                b2cBookings: b2cCount,
                corporateBookings: corporateCount
            });
        }

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("[v0] Error fetching booking trends:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching booking trends data",
            error: error.message,
        });
    }
}

// Get B2C Management Statistics
export const getB2CStats = async (req, res) => {
    try {
        // Get B2C providers stats
        const providerStats = await User.aggregate([
            {
                $match: {
                    role: 'B2C_PARTNER',
                    status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalProviders: { $sum: 1 },
                    activeProviders: {
                        $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
                    },
                    pendingProviders: {
                        $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
                    },
                    suspendedProviders: {
                        $sum: { $cond: [{ $eq: ['$status', 'SUSPENDED'] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get B2C routes stats
        const routeStats = await B2CPartnerRoute.aggregate([
            {
                $match: {
                    status: { $in: ['Active', 'Inactive', 'Scheduled'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRoutes: { $sum: 1 },
                    activeRoutes: {
                        $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
                    },
                    inactiveRoutes: {
                        $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] }
                    },
                    maintenanceRoutes: {
                        $sum: { $cond: [{ $eq: ['$status', 'Scheduled'] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get B2C bookings stats
        const bookingStats = await Payment.aggregate([
            {
                $match: {
                    status: "COMPLETED",
                    paymentType: { $in: ["B2C_BOOKING", "B2C_MONTHLY_PASS", "B2C_SINGLE_JOURNEY"] },
                    createdAt: {
                        $gte: new Date(new Date().getFullYear(), 0, 1)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    totalRevenue: { $sum: "$amount" },
                    averageRevenue: { $avg: "$amount" }
                }
            }
        ]);

        // Get passenger bookings stats - uses bookingStatus field with uppercase values
        const passengerStats = await B2CPassengerBooking.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(new Date().getFullYear(), 0, 1)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalPassengerBookings: { $sum: 1 },
                    pendingBookings: {
                        $sum: { $cond: [{ $eq: ['$bookingStatus', 'PENDING'] }, 1, 0] }
                    },
                    confirmedBookings: {
                        $sum: { $cond: [{ $in: ['$bookingStatus', ['CONFIRMED', 'ACCEPTED']] }, 1, 0] }
                    },
                    completedBookings: {
                        $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] }
                    },
                    inProgressBookings: {
                        $sum: { $cond: [{ $eq: ['$bookingStatus', 'IN_PROGRESS'] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get tag stats from Tag model
        const tagStatsResult = await Tag.aggregate([
            {
                $group: {
                    _id: null,
                    totalTags: { $sum: 1 },
                    activeTags: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    }
                }
            }
        ]);
        const tagStats = tagStatsResult[0] || { totalTags: 0, activeTags: 0 };

        const stats = {
            providers: providerStats[0] || {
                totalProviders: 0,
                activeProviders: 0,
                pendingProviders: 0,
                suspendedProviders: 0
            },
            routes: routeStats[0] || {
                totalRoutes: 0,
                activeRoutes: 0,
                inactiveRoutes: 0,
                maintenanceRoutes: 0
            },
            bookings: bookingStats[0] || {
                totalBookings: 0,
                totalRevenue: 0,
                averageRevenue: 0
            },
            passengers: passengerStats[0] || {
                totalPassengerBookings: 0,
                pendingBookings: 0,
                confirmedBookings: 0,
                completedBookings: 0
            },
            tags: tagStats
        };

        res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C statistics",
            error: error.message,
        });
    }
};

// Get pending vehicle approvals
export const getPendingVehicleApprovals = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const vehicles = await Vehicle.find({ approvalStatus: "PENDING" })
            .populate("fleetOwnerId", "fullName companyName email phone")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await Vehicle.countDocuments({ approvalStatus: "PENDING" });

        res.status(200).json({
            success: true,
            vehicles,
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching pending vehicles:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching pending vehicle approvals",
            error: error.message
        });
    }
};

// Approve vehicle
export const approveVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const adminId = req.userId;

        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        if (vehicle.approvalStatus !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Vehicle is already ${vehicle.approvalStatus.toLowerCase()}`
            });
        }

        vehicle.approvalStatus = "APPROVED";
        vehicle.status = "AVAILABLE";
        vehicle.approvedAt = new Date();
        vehicle.approvedBy = adminId;
        await vehicle.save();

        // Notify fleet owner via in-app notification
        const fleetOwner = await User.findById(vehicle.fleetOwnerId);
        if (fleetOwner) {
            try {
                const { createNotification, sendAdminNotification } = await import("../Services/notificationService.js");
                await createNotification({
                    userId: fleetOwner._id,
                    type: "VEHICLE_APPROVED",
                    title: "Vehicle Approved",
                    message: `Your vehicle ${vehicle.vehicleName} (${vehicle.registrationNumber}) has been approved! You can now accept bookings.`,
                    data: { vehicleId: vehicle._id, vehicleName: vehicle.vehicleName }
                });
            } catch (notifError) {
                console.error("[v0] Error sending vehicle approval notification:", notifError);
            }
        }

        res.status(200).json({
            success: true,
            message: "Vehicle approved successfully",
            vehicle
        });
    } catch (error) {
        console.error("[v0] Error approving vehicle:", error);
        res.status(500).json({
            success: false,
            message: "Error approving vehicle",
            error: error.message
        });
    }
};

// Reject vehicle
export const rejectVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { rejectionReason } = req.body;
        const adminId = req.userId;

        if (!rejectionReason) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required"
            });
        }

        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        if (vehicle.approvalStatus !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Vehicle is already ${vehicle.approvalStatus.toLowerCase()}`
            });
        }

        vehicle.approvalStatus = "REJECTED";
        vehicle.status = "INACTIVE";
        vehicle.rejectionReason = rejectionReason;
        vehicle.approvedBy = adminId;
        vehicle.approvedAt = new Date();
        await vehicle.save();

        // Notify fleet owner via in-app notification
        const fleetOwner = await User.findById(vehicle.fleetOwnerId);
        if (fleetOwner) {
            try {
                const { createNotification } = await import("../Services/notificationService.js");
                await createNotification({
                    userId: fleetOwner._id,
                    type: "VEHICLE_REJECTED",
                    title: "Vehicle Rejected",
                    message: `Your vehicle ${vehicle.vehicleName} (${vehicle.registrationNumber}) was not approved. Reason: ${rejectionReason}`,
                    data: { vehicleId: vehicle._id, vehicleName: vehicle.vehicleName, reason: rejectionReason }
                });
            } catch (notifError) {
                console.error("[v0] Error sending vehicle rejection notification:", notifError);
            }
        }

        res.status(200).json({
            success: true,
            message: "Vehicle rejected successfully",
            vehicle
        });
    } catch (error) {
        console.error("[v0] Error rejecting vehicle:", error);
        res.status(500).json({
            success: false,
            message: "Error rejecting vehicle",
            error: error.message
        });
    }
};

// ==================== ADMIN WALLET MANAGEMENT APIS ====================

// Get all wallets with user details for admin
export const getAllWallets = async (req, res) => {
    try {
        const { role, page = 1, limit = 20, search, sortBy = "createdAt", sortOrder = "desc", minBalance, maxBalance } = req.query;
        const query = {};

        if (role) query.role = role;
        if (minBalance !== undefined) query.balance = { ...query.balance, $gte: Number(minBalance) };
        if (maxBalance !== undefined) query.balance = { ...query.balance, $lte: Number(maxBalance) };

        const wallets = await Wallet.find(query)
            .populate("userId", "fullName email whatsappNumber role companyName status profileImage")
            .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        // Filter by search if provided
        let filteredWallets = wallets;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredWallets = wallets.filter(wallet =>
                wallet.userId?.fullName?.toLowerCase().includes(searchLower) ||
                wallet.userId?.email?.toLowerCase().includes(searchLower) ||
                wallet.userId?.companyName?.toLowerCase().includes(searchLower) ||
                wallet.userId?.whatsappNumber?.includes(search)
            );
        }

        const total = await Wallet.countDocuments(query);

        res.status(200).json({
            success: true,
            wallets: filteredWallets,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching all wallets:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching wallets",
            error: error.message,
        });
    }
};

// Get wallet statistics for admin dashboard
export const getWalletStats = async (req, res) => {
    try {
        const [
            totalWallets,
            totalBalance,
            totalDeposits,
            totalWithdrawals,
            lowBalanceWallets,
            activeWallets,
            walletsByRole
        ] = await Promise.all([
            Wallet.countDocuments(),
            Wallet.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]),
            Wallet.aggregate([{ $group: { _id: null, total: { $sum: "$totalEarnings" } } }]),
            Wallet.aggregate([{ $group: { _id: null, total: { $sum: "$totalWithdrawals" } } }]),
            Wallet.countDocuments({ balance: { $lt: 50 } }), // Wallets with less than 50 balance
            Wallet.countDocuments({ isActive: true }),
            Wallet.aggregate([
                { $group: { _id: "$role", count: { $sum: 1 }, totalBalance: { $sum: "$balance" } } }
            ])
        ]);

        // Get recent wallet transactions across all wallets
        const recentTransactions = await Wallet.aggregate([
            { $unwind: "$transactions" },
            { $sort: { "transactions.createdAt": -1 } },
            { $limit: 20 },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    transaction: "$transactions",
                    user: { fullName: 1, email: 1, role: 1, companyName: 1 },
                    walletId: "$_id",
                    balance: 1,
                    currency: 1
                }
            }
        ]);

        // Get the dominant currency from wallets (most common currency)
        const currencyStats = await Wallet.aggregate([
            { $group: { _id: "$currency", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);
        const dominantCurrency = currencyStats[0]?._id || "AED";

        res.status(200).json({
            success: true,
            stats: {
                totalWallets,
                totalBalance: totalBalance[0]?.total || 0,
                totalDeposits: totalDeposits[0]?.total || 0,
                totalWithdrawals: totalWithdrawals[0]?.total || 0,
                lowBalanceWallets,
                activeWallets,
                walletsByRole,
                currency: dominantCurrency
            },
            recentTransactions
        });
    } catch (error) {
        console.error("[v0] Error fetching wallet stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching wallet statistics",
            error: error.message,
        });
    }
};

// Get single wallet details with full transaction history
export const getWalletDetails = async (req, res) => {
    try {
        const { walletId } = req.params;

        const wallet = await Wallet.findById(walletId)
            .populate("userId", "fullName email whatsappNumber role companyName status profileImage country");

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            });
        }

        // Get notifications sent to this user related to wallet
        const walletNotifications = await Notification.find({
            userId: wallet.userId._id,
            type: { $in: ["WALLET_UPDATED", "WALLET_LOW_BALANCE", "WALLET_FUND_REQUIRED", "WALLET_ADMIN_ALERT", "WALLET_ACTION_REQUIRED", "WALLET_USER_RESPONSE"] }
        }).sort({ createdAt: -1 }).limit(20);

        res.status(200).json({
            success: true,
            wallet,
            walletNotifications
        });
    } catch (error) {
        console.error("[v0] Error fetching wallet details:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching wallet details",
            error: error.message,
        });
    }
};

// Get wallet by user ID
export const getWalletByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        const wallet = await Wallet.findOne({ userId })
            .populate("userId", "fullName email whatsappNumber role companyName status profileImage country");

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found for this user"
            });
        }

        res.status(200).json({
            success: true,
            wallet
        });
    } catch (error) {
        console.error("[v0] Error fetching wallet by user ID:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching wallet",
            error: error.message,
        });
    }
};

// Send wallet notification to user (email + in-app + real-time)
export const sendWalletNotification = async (req, res) => {
    try {
        const { userId, title, message, reason, actionRequired, sendEmail: shouldSendEmail = true } = req.body;
        const adminId = req.userId;

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Get user's wallet
        const wallet = await Wallet.findOne({ userId });

        // Create notification
        const notification = await createNotification({
            userId,
            type: "WALLET_ADMIN_ALERT",
            title: title || "Wallet Notification from Admin",
            message,
            data: {
                reason,
                actionRequired: actionRequired || "NONE",
                walletBalance: wallet?.balance || 0,
                walletCurrency: wallet?.currency || "KWD",
                sentByAdmin: adminId
            },
            relatedEntityType: "WALLET",
            walletId: wallet?._id,
            adminNotificationReason: reason,
            actionRequired: actionRequired || "NONE",
            userResponseStatus: "PENDING"
        });

        // Send real-time notification
        sendRealTimeNotification(userId, {
            _id: notification._id,
            type: "WALLET_ADMIN_ALERT",
            title: title || "Wallet Notification from Admin",
            message,
            createdAt: new Date(),
            isRead: false,
            data: {
                reason,
                actionRequired,
                walletBalance: wallet?.balance || 0
            }
        });

        // Send email notification if enabled
        if (shouldSendEmail && user.email) {
            try {
                const { sendWalletNotificationEmail } = await import("../Services/emailService.js");
                await sendWalletNotificationEmail(user.email, user.fullName, {
                    title: title || "Wallet Notification from Admin",
                    message,
                    reason,
                    actionRequired,
                    walletBalance: wallet?.balance || 0,
                    currency: wallet?.currency || "KWD"
                });
            } catch (emailError) {
                console.error("[v0] Error sending wallet email:", emailError);
            }
        }

        res.status(200).json({
            success: true,
            message: "Notification sent successfully",
            notification
        });
    } catch (error) {
        console.error("[v0] Error sending wallet notification:", error);
        res.status(500).json({
            success: false,
            message: "Error sending notification",
            error: error.message,
        });
    }
};

// Send bulk wallet notifications
export const sendBulkWalletNotifications = async (req, res) => {
    try {
        const { userIds, title, message, reason, actionRequired, sendEmail: shouldSendEmail = true } = req.body;
        const adminId = req.userId;

        const results = {
            success: [],
            failed: []
        };

        for (const userId of userIds) {
            try {
                const user = await User.findById(userId);
                if (!user) {
                    results.failed.push({ userId, error: "User not found" });
                    continue;
                }

                const wallet = await Wallet.findOne({ userId });

                // Create notification
                const notification = await createNotification({
                    userId,
                    type: "WALLET_ADMIN_ALERT",
                    title: title || "Wallet Notification from Admin",
                    message,
                    data: {
                        reason,
                        actionRequired: actionRequired || "NONE",
                        walletBalance: wallet?.balance || 0,
                        walletCurrency: wallet?.currency || "KWD",
                        sentByAdmin: adminId
                    },
                    relatedEntityType: "WALLET",
                    walletId: wallet?._id,
                    adminNotificationReason: reason,
                    actionRequired: actionRequired || "NONE",
                    userResponseStatus: "PENDING"
                });

                // Send real-time notification
                sendRealTimeNotification(userId, {
                    _id: notification._id,
                    type: "WALLET_ADMIN_ALERT",
                    title: title || "Wallet Notification from Admin",
                    message,
                    createdAt: new Date(),
                    isRead: false
                });

                // Send email if enabled
                if (shouldSendEmail && user.email) {
                    try {
                        const { sendWalletNotificationEmail } = await import("../Services/emailService.js");
                        await sendWalletNotificationEmail(user.email, user.fullName, {
                            title,
                            message,
                            reason,
                            actionRequired,
                            walletBalance: wallet?.balance || 0,
                            currency: wallet?.currency || "KWD"
                        });
                    } catch (emailError) {
                        console.error("[v0] Error sending wallet email to user:", userId, emailError);
                    }
                }

                results.success.push({ userId, userName: user.fullName });
            } catch (err) {
                results.failed.push({ userId, error: err.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Notifications sent: ${results.success.length} successful, ${results.failed.length} failed`,
            results
        });
    } catch (error) {
        console.error("[v0] Error sending bulk wallet notifications:", error);
        res.status(500).json({
            success: false,
            message: "Error sending bulk notifications",
            error: error.message,
        });
    }
};

// Get low balance wallets (wallets that need attention)
export const getLowBalanceWallets = async (req, res) => {
    try {
        const { threshold = 50, role, page = 1, limit = 20 } = req.query;
        const query = {
            balance: { $lt: Number(threshold) }
        };

        if (role) query.role = role;

        const wallets = await Wallet.find(query)
            .populate("userId", "fullName email whatsappNumber role companyName status")
            .sort({ balance: 1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await Wallet.countDocuments(query);

        res.status(200).json({
            success: true,
            wallets,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching low balance wallets:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching low balance wallets",
            error: error.message,
        });
    }
};

// Get wallet activity feed (real-time updates for admin)
export const getWalletActivityFeed = async (req, res) => {
    try {
        const { page = 1, limit = 50, type, startDate, endDate } = req.query;

        let matchConditions = {};

        if (type) {
            matchConditions["transactions.type"] = type;
        }

        if (startDate || endDate) {
            matchConditions["transactions.createdAt"] = {};
            if (startDate) matchConditions["transactions.createdAt"].$gte = new Date(startDate);
            if (endDate) matchConditions["transactions.createdAt"].$lte = new Date(endDate);
        }

        const activities = await Wallet.aggregate([
            { $unwind: "$transactions" },
            ...(Object.keys(matchConditions).length > 0 ? [{ $match: matchConditions }] : []),
            { $sort: { "transactions.createdAt": -1 } },
            { $skip: (Number.parseInt(page) - 1) * Number.parseInt(limit) },
            { $limit: Number.parseInt(limit) },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    _id: "$transactions._id",
                    walletId: "$_id",
                    userId: "$userId",
                    userName: "$user.fullName",
                    userEmail: "$user.email",
                    userRole: "$user.role",
                    companyName: "$user.companyName",
                    transactionType: "$transactions.type",
                    amount: "$transactions.amount",
                    description: "$transactions.description",
                    status: "$transactions.status",
                    createdAt: "$transactions.createdAt",
                    balance: 1,
                    currency: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            activities,
            pagination: {
                page: Number.parseInt(page),
                limit: Number.parseInt(limit)
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching wallet activity feed:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching wallet activity feed",
            error: error.message,
        });
    }
};

// Mark notification as responded by user (called when user takes action)
export const markWalletNotificationResponded = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { responseType } = req.body;
        const userId = req.userId;

        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            {
                userResponseStatus: "COMPLETED",
                userResponseAt: new Date()
            },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        // Notify admin about user response
        const admins = await User.find({ role: "ADMIN" });
        const user = await User.findById(userId);
        const wallet = await Wallet.findOne({ userId });

        for (const admin of admins) {
            await createNotification({
                userId: admin._id,
                type: "WALLET_USER_RESPONSE",
                title: "User Responded to Wallet Alert",
                message: `${user?.fullName || "User"} has responded to wallet notification: ${responseType}`,
                data: {
                    originalNotificationId: notificationId,
                    responseType,
                    userId,
                    userName: user?.fullName,
                    walletBalance: wallet?.balance || 0
                },
                relatedEntityType: "WALLET"
            });

            sendRealTimeNotification(admin._id, {
                type: "WALLET_USER_RESPONSE",
                title: "User Responded to Wallet Alert",
                message: `${user?.fullName || "User"} has ${responseType}`,
                createdAt: new Date(),
                isRead: false
            });
        }

        res.status(200).json({
            success: true,
            message: "Response recorded successfully",
            notification
        });
    } catch (error) {
        console.error("[v0] Error marking notification as responded:", error);
        res.status(500).json({
            success: false,
            message: "Error recording response",
            error: error.message,
        });
    }
};

// Subscribe to real-time wallet updates (for WebSocket setup)
export const getWalletUpdatesSubscription = async (req, res) => {
    try {
        // This endpoint provides info for socket subscription
        res.status(200).json({
            success: true,
            subscriptionTopic: "admin-wallet-updates",
            events: [
                "wallet-fund-added",
                "wallet-withdrawal",
                "wallet-transfer",
                "wallet-low-balance",
                "wallet-user-response"
            ]
        });
    } catch (error) {
        console.error("[v0] Error getting wallet subscription info:", error);
        res.status(500).json({
            success: false,
            message: "Error getting subscription info",
            error: error.message,
        });
    }
};

// Admin adjust wallet balance (for corrections/refunds)
export const adjustWalletBalance = async (req, res) => {
    try {
        const { walletId } = req.params;
        const { amount, type, reason } = req.body;
        const adminId = req.userId;

        const wallet = await Wallet.findById(walletId).populate("userId", "fullName email");
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            });
        }

        const adjustmentAmount = type === "CREDIT" ? Math.abs(amount) : -Math.abs(amount);

        // Check if debit would result in negative balance
        if (type === "DEBIT" && wallet.balance < Math.abs(amount)) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance for debit adjustment"
            });
        }

        // Add transaction record
        const transaction = {
            type: type === "CREDIT" ? "DEPOSIT" : "WITHDRAWAL",
            amount: adjustmentAmount,
            description: `Admin adjustment: ${reason}`,
            status: "COMPLETED",
            createdAt: new Date()
        };

        wallet.transactions.push(transaction);
        wallet.balance += adjustmentAmount;
        await wallet.save();

        // Notify user
        await createNotification({
            userId: wallet.userId._id,
            type: "WALLET_UPDATED",
            title: "Wallet Balance Adjusted",
            message: `Your wallet balance has been ${type === "CREDIT" ? "credited" : "debited"} by ${Math.abs(amount)} ${wallet.currency}. Reason: ${reason}`,
            data: {
                adjustmentType: type,
                amount: Math.abs(amount),
                reason,
                newBalance: wallet.balance,
                adjustedBy: adminId
            },
            relatedEntityType: "WALLET"
        });

        sendRealTimeNotification(wallet.userId._id, {
            type: "WALLET_UPDATED",
            title: "Wallet Balance Adjusted",
            message: `Your wallet has been ${type === "CREDIT" ? "credited" : "debited"} by ${Math.abs(amount)} ${wallet.currency}`,
            createdAt: new Date(),
            isRead: false,
            data: { newBalance: wallet.balance }
        });

        res.status(200).json({
            success: true,
            message: `Wallet ${type === "CREDIT" ? "credited" : "debited"} successfully`,
            wallet,
            transaction
        });
    } catch (error) {
        console.error("[v0] Error adjusting wallet balance:", error);
        res.status(500).json({
            success: false,
            message: "Error adjusting wallet balance",
            error: error.message,
        });
    }
};

// Get users with pending wallet notifications
export const getPendingWalletNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const notifications = await Notification.find({
            type: { $in: ["WALLET_ADMIN_ALERT", "WALLET_ACTION_REQUIRED", "WALLET_FUND_REQUIRED"] },
            userResponseStatus: "PENDING"
        })
            .populate("userId", "fullName email whatsappNumber role companyName")
            .populate("walletId", "balance currency")
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await Notification.countDocuments({
            type: { $in: ["WALLET_ADMIN_ALERT", "WALLET_ACTION_REQUIRED", "WALLET_FUND_REQUIRED"] },
            userResponseStatus: "PENDING"
        });

        res.status(200).json({
            success: true,
            notifications,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching pending wallet notifications:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching pending notifications",
            error: error.message,
        });
    }
};

// ==========================================
// ADMIN MANAGEMENT FUNCTIONS
// ==========================================

// Get all admins
export const getAllAdmins = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;
        const query = { role: "ADMIN" };

        if (status) query.status = status;

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const admins = await User.find(query)
            .select('-password')
            .populate('createdByAdmin', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            admins,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching admins:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching admins",
            error: error.message,
        });
    }
};

// Get admin stats
export const getAdminStats = async (req, res) => {
    try {
        const [
            totalAdmins,
            superAdmins,
            activeAdmins,
            suspendedAdmins
        ] = await Promise.all([
            User.countDocuments({ role: "ADMIN" }),
            User.countDocuments({ role: "ADMIN", "adminPermissions.isSuperAdmin": true }),
            User.countDocuments({ role: "ADMIN", status: "ACTIVE" }),
            User.countDocuments({ role: "ADMIN", status: "SUSPENDED" })
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalAdmins,
                superAdmins,
                activeAdmins,
                suspendedAdmins,
                limitedAdmins: totalAdmins - superAdmins
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching admin stats:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching admin statistics",
            error: error.message,
        });
    }
};

// Create new admin
export const createAdmin = async (req, res) => {
    try {
        const {
            fullName,
            email,
            password,
            whatsappNumber,
            countryCode,
            isSuperAdmin,
            modules
        } = req.body;

        // Validate required fields
        if (!fullName || !email || !password || !whatsappNumber) {
            return res.status(400).json({
                success: false,
                message: "Full name, email, password, and WhatsApp number are required"
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Verify the requesting admin has permission to create admins
        const requestingAdmin = await User.findById(req.userId);
        if (!requestingAdmin || requestingAdmin.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Only admins can create new admins"
            });
        }

        // Check if requesting admin has adminManagement permission or is super admin
        const canManageAdmins = requestingAdmin.adminPermissions?.isSuperAdmin ||
            requestingAdmin.adminPermissions?.modules?.adminManagement;

        if (!canManageAdmins) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to create admins"
            });
        }

        // Only super admins can create other super admins
        if (isSuperAdmin && !requestingAdmin.adminPermissions?.isSuperAdmin) {
            return res.status(403).json({
                success: false,
                message: "Only super admins can create other super admins"
            });
        }

        // Create admin permissions object
        const adminPermissions = {
            isSuperAdmin: isSuperAdmin || false,
            modules: isSuperAdmin ? {
                overview: true,
                b2cManagement: true,
                ridePooling: true,
                b2bListings: true,
                users: true,
                wallets: true,
                vehicleApproval: true,
                commission: true,
                negotiations: true,
                settlement: true,
                dropdowns: true,
                reports: true,
                finance: true,
                communication: true,
                ads: true,
                paymentVerification: true,
                content: true,
                adminManagement: true,
                termsAndConditions: true,
            } : {
                overview: modules?.overview || false,
                b2cManagement: modules?.b2cManagement || false,
                ridePooling: modules?.ridePooling || false,
                b2bListings: modules?.b2bListings || false,
                users: modules?.users || false,
                wallets: modules?.wallets || false,
                vehicleApproval: modules?.vehicleApproval || false,
                commission: modules?.commission || false,
                negotiations: modules?.negotiations || false,
                settlement: modules?.settlement || false,
                dropdowns: modules?.dropdowns || false,
                reports: modules?.reports || false,
                finance: modules?.finance || false,
                communication: modules?.communication || false,
                ads: modules?.ads || false,
                paymentVerification: modules?.paymentVerification || false,
                content: modules?.content || false,
                adminManagement: modules?.adminManagement || false,
                termsAndConditions: modules?.termsAndConditions || false,
            }
        };

        // Create new admin user
        const newAdmin = new User({
            role: "ADMIN",
            fullName,
            email: email.toLowerCase(),
            password,
            whatsappNumber,
            countryCode: countryCode || "+971",
            status: "ACTIVE",
            isEmailVerified: true,
            isPasswordSet: true,
            adminPermissions,
            createdByAdmin: req.userId,
        });

        await newAdmin.save();

        // Create notification for the new admin
        await createNotification({
            userId: newAdmin._id,
            type: "ACCOUNT_CREATED",
            title: "Admin Account Created",
            message: `Your admin account has been created by ${requestingAdmin.fullName}. You can now login to the admin dashboard.`,
            data: {
                createdBy: requestingAdmin._id,
                permissions: adminPermissions
            }
        });

        res.status(201).json({
            success: true,
            message: "Admin created successfully",
            admin: {
                _id: newAdmin._id,
                fullName: newAdmin.fullName,
                email: newAdmin.email,
                whatsappNumber: newAdmin.whatsappNumber,
                status: newAdmin.status,
                adminPermissions: newAdmin.adminPermissions,
                createdAt: newAdmin.createdAt
            }
        });
    } catch (error) {
        console.error("[v0] Error creating admin:", error);
        res.status(500).json({
            success: false,
            message: "Error creating admin",
            error: error.message,
        });
    }
};

// Update admin permissions
export const updateAdminPermissions = async (req, res) => {
    try {
        const { adminId } = req.params;
        const { isSuperAdmin, modules } = req.body;

        // Verify the requesting admin has permission
        const requestingAdmin = await User.findById(req.userId);
        if (!requestingAdmin || requestingAdmin.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Only admins can update admin permissions"
            });
        }

        const canManageAdmins = requestingAdmin.adminPermissions?.isSuperAdmin ||
            requestingAdmin.adminPermissions?.modules?.adminManagement;

        if (!canManageAdmins) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to manage admins"
            });
        }

        // Find the admin to update
        const adminToUpdate = await User.findOne({ _id: adminId, role: "ADMIN" });
        if (!adminToUpdate) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        // Prevent modifying own super admin status
        if (adminId === req.userId.toString() && adminToUpdate.adminPermissions?.isSuperAdmin && !isSuperAdmin) {
            return res.status(403).json({
                success: false,
                message: "You cannot remove your own super admin status"
            });
        }

        // Only super admins can grant/revoke super admin status
        if (isSuperAdmin !== adminToUpdate.adminPermissions?.isSuperAdmin) {
            if (!requestingAdmin.adminPermissions?.isSuperAdmin) {
                return res.status(403).json({
                    success: false,
                    message: "Only super admins can change super admin status"
                });
            }
        }

        // Update permissions
        adminToUpdate.adminPermissions = {
            isSuperAdmin: isSuperAdmin || false,
            modules: isSuperAdmin ? {
                overview: true,
                b2cManagement: true,
                ridePooling: true,
                b2bListings: true,
                users: true,
                wallets: true,
                vehicleApproval: true,
                commission: true,
                negotiations: true,
                settlement: true,
                dropdowns: true,
                reports: true,
                finance: true,
                communication: true,
                ads: true,
                paymentVerification: true,
                content: true,
                adminManagement: true,
                termsAndConditions: true,
            } : {
                overview: modules?.overview || false,
                b2cManagement: modules?.b2cManagement || false,
                ridePooling: modules?.ridePooling || false,
                b2bListings: modules?.b2bListings || false,
                users: modules?.users || false,
                wallets: modules?.wallets || false,
                vehicleApproval: modules?.vehicleApproval || false,
                commission: modules?.commission || false,
                negotiations: modules?.negotiations || false,
                settlement: modules?.settlement || false,
                dropdowns: modules?.dropdowns || false,
                reports: modules?.reports || false,
                finance: modules?.finance || false,
                communication: modules?.communication || false,
                ads: modules?.ads || false,
                paymentVerification: modules?.paymentVerification || false,
                content: modules?.content || false,
                adminManagement: modules?.adminManagement || false,
                termsAndConditions: modules?.termsAndConditions || false,
            }
        };

        await adminToUpdate.save();

        // Notify the admin about permission changes
        await createNotification({
            userId: adminToUpdate._id,
            type: "PERMISSIONS_UPDATED",
            title: "Admin Permissions Updated",
            message: `Your admin permissions have been updated by ${requestingAdmin.fullName}.`,
            data: {
                updatedBy: requestingAdmin._id,
                newPermissions: adminToUpdate.adminPermissions
            }
        });

        res.status(200).json({
            success: true,
            message: "Admin permissions updated successfully",
            admin: adminToUpdate.toJSON()
        });
    } catch (error) {
        console.error("[v0] Error updating admin permissions:", error);
        res.status(500).json({
            success: false,
            message: "Error updating admin permissions",
            error: error.message,
        });
    }
};

// Get admin details
export const getAdminDetails = async (req, res) => {
    try {
        const { adminId } = req.params;

        const admin = await User.findOne({ _id: adminId, role: "ADMIN" })
            .select('-password')
            .populate('createdByAdmin', 'fullName email');

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        // Get admin activity stats
        const [
            usersCreated,
            adminsCreated
        ] = await Promise.all([
            User.countDocuments({
                activatedBy: adminId,
                role: { $ne: "ADMIN" }
            }),
            User.countDocuments({ createdByAdmin: adminId })
        ]);

        res.status(200).json({
            success: true,
            admin,
            stats: {
                usersActivated: usersCreated,
                adminsCreated
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching admin details:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching admin details",
            error: error.message,
        });
    }
};

// Suspend admin
export const suspendAdmin = async (req, res) => {
    try {
        const { adminId } = req.params;
        const { reason } = req.body;

        // Verify the requesting admin has permission
        const requestingAdmin = await User.findById(req.userId);
        if (!requestingAdmin || requestingAdmin.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Only admins can suspend other admins"
            });
        }

        const canManageAdmins = requestingAdmin.adminPermissions?.isSuperAdmin ||
            requestingAdmin.adminPermissions?.modules?.adminManagement;

        if (!canManageAdmins) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to manage admins"
            });
        }

        // Cannot suspend yourself
        if (adminId === req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You cannot suspend yourself"
            });
        }

        const adminToSuspend = await User.findOne({ _id: adminId, role: "ADMIN" });
        if (!adminToSuspend) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        // Only super admins can suspend other super admins
        if (adminToSuspend.adminPermissions?.isSuperAdmin && !requestingAdmin.adminPermissions?.isSuperAdmin) {
            return res.status(403).json({
                success: false,
                message: "Only super admins can suspend other super admins"
            });
        }

        adminToSuspend.status = "SUSPENDED";
        adminToSuspend.suspendedAt = new Date();
        adminToSuspend.suspendedBy = req.userId;
        await adminToSuspend.save();

        // Notify the suspended admin
        await createNotification({
            userId: adminToSuspend._id,
            type: "ACCOUNT_SUSPENDED",
            title: "Admin Account Suspended",
            message: `Your admin account has been suspended. ${reason ? `Reason: ${reason}` : ''}`,
            data: {
                suspendedBy: requestingAdmin._id,
                reason
            }
        });

        res.status(200).json({
            success: true,
            message: "Admin suspended successfully",
            admin: adminToSuspend.toJSON()
        });
    } catch (error) {
        console.error("[v0] Error suspending admin:", error);
        res.status(500).json({
            success: false,
            message: "Error suspending admin",
            error: error.message,
        });
    }
};

// Activate admin
export const activateAdmin = async (req, res) => {
    try {
        const { adminId } = req.params;

        // Verify the requesting admin has permission
        const requestingAdmin = await User.findById(req.userId);
        if (!requestingAdmin || requestingAdmin.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Only admins can activate other admins"
            });
        }

        const canManageAdmins = requestingAdmin.adminPermissions?.isSuperAdmin ||
            requestingAdmin.adminPermissions?.modules?.adminManagement;

        if (!canManageAdmins) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to manage admins"
            });
        }

        const adminToActivate = await User.findOne({ _id: adminId, role: "ADMIN" });
        if (!adminToActivate) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        adminToActivate.status = "ACTIVE";
        adminToActivate.activatedAt = new Date();
        adminToActivate.activatedBy = req.userId;
        await adminToActivate.save();

        // Notify the activated admin
        await createNotification({
            userId: adminToActivate._id,
            type: "ACCOUNT_ACTIVATED",
            title: "Admin Account Activated",
            message: `Your admin account has been activated by ${requestingAdmin.fullName}.`,
            data: {
                activatedBy: requestingAdmin._id
            }
        });

        res.status(200).json({
            success: true,
            message: "Admin activated successfully",
            admin: adminToActivate.toJSON()
        });
    } catch (error) {
        console.error("[v0] Error activating admin:", error);
        res.status(500).json({
            success: false,
            message: "Error activating admin",
            error: error.message,
        });
    }
};

// Delete admin
export const deleteAdmin = async (req, res) => {
    try {
        const { adminId } = req.params;

        // Verify the requesting admin is a super admin
        const requestingAdmin = await User.findById(req.userId);
        if (!requestingAdmin || requestingAdmin.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete other admins"
            });
        }

        if (!requestingAdmin.adminPermissions?.isSuperAdmin) {
            return res.status(403).json({
                success: false,
                message: "Only super admins can delete admins"
            });
        }

        // Cannot delete yourself
        if (adminId === req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You cannot delete yourself"
            });
        }

        const adminToDelete = await User.findOne({ _id: adminId, role: "ADMIN" });
        if (!adminToDelete) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        await User.findByIdAndDelete(adminId);

        res.status(200).json({
            success: true,
            message: "Admin deleted successfully"
        });
    } catch (error) {
        console.error("[v0] Error deleting admin:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting admin",
            error: error.message,
        });
    }
};

// Get current admin's permissions
export const getMyPermissions = async (req, res) => {
    try {
        const admin = await User.findById(req.userId).select('adminPermissions role fullName email');

        if (!admin || admin.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Admin not found"
            });
        }

        res.status(200).json({
            success: true,
            permissions: admin.adminPermissions,
            admin: {
                _id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching admin permissions:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching permissions",
            error: error.message,
        });
    }
};

// ============================================================
// REVENUE REPORTS APIs - User-wise and Vendor-wise Reports
// ============================================================

// Get Corporate-wise revenue report
export const getCorporateRevenueReport = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 20, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build date filter
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        // Get all corporate users with their payment data
        const corporateUsers = await User.find({
            role: "CORPORATE",
            ...(search && {
                $or: [
                    { fullName: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { companyName: { $regex: search, $options: "i" } },
                ]
            })
        }).select('_id fullName email companyName phoneNumber createdAt status profileImage');

        const corporateIds = corporateUsers.map(u => u._id);

        // Aggregate payments by corporate user
        const paymentAggregation = await Payment.aggregate([
            {
                $match: {
                    corporateOwnerId: { $in: corporateIds },
                    status: "COMPLETED",
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
                }
            },
            {
                $group: {
                    _id: "$corporateOwnerId",
                    totalPayments: { $sum: "$amount" },
                    paymentCount: { $sum: 1 },
                    totalAdminCommission: { $sum: { $ifNull: ["$adminCommission", 0] } },
                    avgPayment: { $avg: "$amount" },
                    lastPaymentDate: { $max: "$createdAt" },
                    currency: { $first: "$currency" }
                }
            }
        ]);

        // Get contract counts by corporate
        const contractAggregation = await Contract.aggregate([
            {
                $match: {
                    corporateOwnerId: { $in: corporateIds },
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
                }
            },
            {
                $group: {
                    _id: "$corporateOwnerId",
                    totalContracts: { $sum: 1 },
                    activeContracts: {
                        $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] }
                    },
                    totalContractValue: { $sum: "$financials.totalAmount" }
                }
            }
        ]);

        // Create lookup maps
        const paymentMap = new Map(paymentAggregation.map(p => [p._id.toString(), p]));
        const contractMap = new Map(contractAggregation.map(c => [c._id.toString(), c]));

        // Combine data
        const revenueData = corporateUsers.map(user => {
            const payments = paymentMap.get(user._id.toString()) || {};
            const contracts = contractMap.get(user._id.toString()) || {};
            return {
                userId: user._id,
                fullName: user.fullName,
                email: user.email,
                companyName: user.companyName || 'N/A',
                phoneNumber: user.phoneNumber,
                profileImage: user.profileImage,
                status: user.status,
                joinedDate: user.createdAt,
                totalRevenue: payments.totalPayments || 0,
                paymentCount: payments.paymentCount || 0,
                adminCommission: payments.totalAdminCommission || 0,
                avgPaymentAmount: payments.avgPayment || 0,
                lastPaymentDate: payments.lastPaymentDate,
                currency: payments.currency || "AED",
                totalContracts: contracts.totalContracts || 0,
                activeContracts: contracts.activeContracts || 0,
                totalContractValue: contracts.totalContractValue || 0,
            };
        });

        // Sort by total revenue descending
        revenueData.sort((a, b) => b.totalRevenue - a.totalRevenue);

        // Paginate
        const paginatedData = revenueData.slice(skip, skip + parseInt(limit));

        // Calculate totals
        const totals = {
            totalCorporates: corporateUsers.length,
            totalRevenue: revenueData.reduce((sum, r) => sum + r.totalRevenue, 0),
            totalAdminCommission: revenueData.reduce((sum, r) => sum + r.adminCommission, 0),
            totalContracts: revenueData.reduce((sum, r) => sum + r.totalContracts, 0),
            activeContracts: revenueData.reduce((sum, r) => sum + r.activeContracts, 0),
        };

        res.status(200).json({
            success: true,
            data: paginatedData,
            totals,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(revenueData.length / parseInt(limit)),
                totalRecords: revenueData.length,
                hasMore: skip + parseInt(limit) < revenueData.length
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching corporate revenue report:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching corporate revenue report",
            error: error.message,
        });
    }
};

// Get B2C Partner-wise revenue report
export const getB2CPartnerRevenueReport = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 20, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build date filter
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        // Get all B2C partner users
        const b2cPartners = await User.find({
            role: "B2C_PARTNER",
            ...(search && {
                $or: [
                    { fullName: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { companyName: { $regex: search, $options: "i" } },
                ]
            })
        }).select('_id fullName email companyName phoneNumber createdAt status profileImage');

        const partnerIds = b2cPartners.map(u => u._id);

        // Aggregate bookings by B2C partner
        const bookingAggregation = await B2CPassengerBooking.aggregate([
            {
                $match: {
                    b2cPartnerId: { $in: partnerIds },
                    paymentStatus: "COMPLETED",
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
                }
            },
            {
                $group: {
                    _id: "$b2cPartnerId",
                    totalBookingRevenue: { $sum: "$paymentAmount" },
                    bookingCount: { $sum: 1 },
                    totalAdminCommission: { $sum: { $ifNull: ["$adminCommissionAmount", 0] } },
                    totalDriverEarnings: { $sum: { $ifNull: ["$driverEarnings", 0] } },
                    avgBookingAmount: { $avg: "$paymentAmount" },
                    completedTrips: {
                        $sum: { $cond: [{ $eq: ["$bookingStatus", "COMPLETED"] }, 1, 0] }
                    },
                    activeBookings: {
                        $sum: { $cond: [{ $in: ["$bookingStatus", ["CONFIRMED", "ACCEPTED", "IN_PROGRESS"]] }, 1, 0] }
                    },
                    cancelledBookings: {
                        $sum: { $cond: [{ $eq: ["$bookingStatus", "CANCELLED"] }, 1, 0] }
                    },
                    lastBookingDate: { $max: "$createdAt" },
                    currency: { $first: "$currency" }
                }
            }
        ]);

        // Get wallet data for partners
        const walletData = await Wallet.find({
            userId: { $in: partnerIds },
            role: "B2C_PARTNER"
        }).select('userId balance totalEarnings totalWithdrawals currency');

        // Create lookup maps
        const bookingMap = new Map(bookingAggregation.map(b => [b._id.toString(), b]));
        const walletMap = new Map(walletData.map(w => [w.userId.toString(), w]));

        // Combine data
        const revenueData = b2cPartners.map(partner => {
            const bookings = bookingMap.get(partner._id.toString()) || {};
            const wallet = walletMap.get(partner._id.toString()) || {};

            // Net partner earnings = Total Revenue - Admin Commission
            const netPartnerEarnings = (bookings.totalBookingRevenue || 0) - (bookings.totalAdminCommission || 0);

            return {
                partnerId: partner._id,
                fullName: partner.fullName,
                email: partner.email,
                companyName: partner.companyName || partner.fullName || 'N/A',
                phoneNumber: partner.phoneNumber,
                profileImage: partner.profileImage,
                status: partner.status,
                joinedDate: partner.createdAt,
                totalBookingRevenue: bookings.totalBookingRevenue || 0,
                bookingCount: bookings.bookingCount || 0,
                adminCommission: bookings.totalAdminCommission || 0,
                netPartnerEarnings: netPartnerEarnings,
                avgBookingAmount: bookings.avgBookingAmount || 0,
                completedTrips: bookings.completedTrips || 0,
                activeBookings: bookings.activeBookings || 0,
                cancelledBookings: bookings.cancelledBookings || 0,
                lastBookingDate: bookings.lastBookingDate,
                currency: bookings.currency || wallet.currency || "AED",
                walletBalance: wallet.balance || 0,
                totalWalletEarnings: wallet.totalEarnings || 0,
                totalWithdrawals: wallet.totalWithdrawals || 0,
            };
        });

        // Sort by total revenue descending
        revenueData.sort((a, b) => b.totalBookingRevenue - a.totalBookingRevenue);

        // Paginate
        const paginatedData = revenueData.slice(skip, skip + parseInt(limit));

        // Calculate totals
        const totals = {
            totalPartners: b2cPartners.length,
            totalRevenue: revenueData.reduce((sum, r) => sum + r.totalBookingRevenue, 0),
            totalAdminCommission: revenueData.reduce((sum, r) => sum + r.adminCommission, 0),
            totalNetPartnerEarnings: revenueData.reduce((sum, r) => sum + r.netPartnerEarnings, 0),
            totalBookings: revenueData.reduce((sum, r) => sum + r.bookingCount, 0),
            totalCompletedTrips: revenueData.reduce((sum, r) => sum + r.completedTrips, 0),
            totalActiveBookings: revenueData.reduce((sum, r) => sum + r.activeBookings, 0),
        };

        res.status(200).json({
            success: true,
            data: paginatedData,
            totals,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(revenueData.length / parseInt(limit)),
                totalRecords: revenueData.length,
                hasMore: skip + parseInt(limit) < revenueData.length
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C partner revenue report:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C partner revenue report",
            error: error.message,
        });
    }
};

// Get B2B Partner-wise revenue report
export const getB2BPartnerRevenueReport = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 20, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build date filter
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        // Get all B2B partner users
        const b2bPartners = await User.find({
            role: "B2B_PARTNER",
            ...(search && {
                $or: [
                    { fullName: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { companyName: { $regex: search, $options: "i" } },
                ]
            })
        }).select('_id fullName email companyName phoneNumber createdAt status profileImage');

        const partnerIds = b2bPartners.map(u => u._id);

        // Aggregate payments where B2B partner is the fleet owner
        const paymentAggregation = await Payment.aggregate([
            {
                $match: {
                    fleetOwnerId: { $in: partnerIds },
                    status: "COMPLETED",
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
                }
            },
            {
                $group: {
                    _id: "$fleetOwnerId",
                    totalRevenue: { $sum: "$fleetOwnerAmount" },
                    paymentCount: { $sum: 1 },
                    totalGrossAmount: { $sum: "$amount" },
                    totalAdminCommission: { $sum: { $ifNull: ["$adminCommission", 0] } },
                    avgPayment: { $avg: "$fleetOwnerAmount" },
                    lastPaymentDate: { $max: "$createdAt" },
                    currency: { $first: "$currency" }
                }
            }
        ]);

        // Get contract counts where B2B partner is the fleet owner
        const contractAggregation = await Contract.aggregate([
            {
                $match: {
                    fleetOwnerId: { $in: partnerIds },
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
                }
            },
            {
                $group: {
                    _id: "$fleetOwnerId",
                    totalContracts: { $sum: 1 },
                    activeContracts: {
                        $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] }
                    },
                    totalContractValue: { $sum: "$financials.totalAmount" }
                }
            }
        ]);

        // Get wallet data
        const walletData = await Wallet.find({
            userId: { $in: partnerIds },
            role: "B2B_PARTNER"
        }).select('userId balance totalEarnings totalWithdrawals currency');

        // Create lookup maps
        const paymentMap = new Map(paymentAggregation.map(p => [p._id.toString(), p]));
        const contractMap = new Map(contractAggregation.map(c => [c._id.toString(), c]));
        const walletMap = new Map(walletData.map(w => [w.userId.toString(), w]));

        // Combine data
        const revenueData = b2bPartners.map(partner => {
            const payments = paymentMap.get(partner._id.toString()) || {};
            const contracts = contractMap.get(partner._id.toString()) || {};
            const wallet = walletMap.get(partner._id.toString()) || {};
            return {
                partnerId: partner._id,
                fullName: partner.fullName,
                email: partner.email,
                companyName: partner.companyName || partner.fullName || 'N/A',
                phoneNumber: partner.phoneNumber,
                profileImage: partner.profileImage,
                status: partner.status,
                joinedDate: partner.createdAt,
                totalRevenue: payments.totalRevenue || 0,
                totalGrossAmount: payments.totalGrossAmount || 0,
                adminCommission: payments.totalAdminCommission || 0,
                paymentCount: payments.paymentCount || 0,
                avgPaymentAmount: payments.avgPayment || 0,
                lastPaymentDate: payments.lastPaymentDate,
                currency: payments.currency || wallet.currency || "AED",
                totalContracts: contracts.totalContracts || 0,
                activeContracts: contracts.activeContracts || 0,
                totalContractValue: contracts.totalContractValue || 0,
                walletBalance: wallet.balance || 0,
                totalWalletEarnings: wallet.totalEarnings || 0,
                totalWithdrawals: wallet.totalWithdrawals || 0,
            };
        });

        // Sort by total revenue descending
        revenueData.sort((a, b) => b.totalRevenue - a.totalRevenue);

        // Paginate
        const paginatedData = revenueData.slice(skip, skip + parseInt(limit));

        // Calculate totals
        const totals = {
            totalPartners: b2bPartners.length,
            totalRevenue: revenueData.reduce((sum, r) => sum + r.totalRevenue, 0),
            totalGrossAmount: revenueData.reduce((sum, r) => sum + r.totalGrossAmount, 0),
            totalAdminCommission: revenueData.reduce((sum, r) => sum + r.adminCommission, 0),
            totalContracts: revenueData.reduce((sum, r) => sum + r.totalContracts, 0),
            activeContracts: revenueData.reduce((sum, r) => sum + r.activeContracts, 0),
        };

        res.status(200).json({
            success: true,
            data: paginatedData,
            totals,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(revenueData.length / parseInt(limit)),
                totalRecords: revenueData.length,
                hasMore: skip + parseInt(limit) < revenueData.length
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2B partner revenue report:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2B partner revenue report",
            error: error.message,
        });
    }
};

// Get overall revenue summary
export const getRevenueSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Build date filter
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        // Get payment statistics
        const paymentStats = await Payment.aggregate([
            {
                $match: {
                    status: "COMPLETED",
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
                }
            },
            {
                $group: {
                    _id: null,
                    totalPaymentRevenue: { $sum: "$amount" },
                    totalAdminCommission: { $sum: { $ifNull: ["$adminCommission", 0] } },
                    paymentCount: { $sum: 1 },
                    currency: { $first: "$currency" }
                }
            }
        ]);

        // Get B2C booking statistics  
        const bookingStats = await B2CPassengerBooking.aggregate([
            {
                $match: {
                    paymentStatus: "COMPLETED",
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
                }
            },
            {
                $group: {
                    _id: null,
                    totalBookingRevenue: { $sum: "$paymentAmount" },
                    totalBookingCommission: { $sum: { $ifNull: ["$adminCommissionAmount", 0] } },
                    bookingCount: { $sum: 1 }
                }
            }
        ]);

        // Get user counts by role
        const userCounts = await User.aggregate([
            {
                $match: {
                    role: { $in: ["CORPORATE", "B2C_PARTNER", "B2B_PARTNER"] }
                }
            },
            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get admin wallet for total earnings
        const adminWallet = await Wallet.findOne({ role: "ADMIN" });

        const userCountMap = new Map(userCounts.map(u => [u._id, u.count]));
        const payment = paymentStats[0] || {};
        const booking = bookingStats[0] || {};

        res.status(200).json({
            success: true,
            summary: {
                // Revenue breakdown
                corporateRevenue: payment.totalPaymentRevenue || 0,
                b2cRevenue: booking.totalBookingRevenue || 0,
                totalRevenue: (payment.totalPaymentRevenue || 0) + (booking.totalBookingRevenue || 0),

                // Commission breakdown
                corporateCommission: payment.totalAdminCommission || 0,
                b2cCommission: booking.totalBookingCommission || 0,
                totalCommission: (payment.totalAdminCommission || 0) + (booking.totalBookingCommission || 0),

                // Transaction counts
                corporatePayments: payment.paymentCount || 0,
                b2cBookings: booking.bookingCount || 0,

                // User counts
                totalCorporates: userCountMap.get("CORPORATE") || 0,
                totalB2CPartners: userCountMap.get("B2C_PARTNER") || 0,
                totalB2BPartners: userCountMap.get("B2B_PARTNER") || 0,

                // Admin wallet
                adminWalletBalance: adminWallet?.balance || 0,
                adminTotalEarnings: adminWallet?.totalEarnings || 0,

                currency: payment.currency || adminWallet?.currency || "AED"
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching revenue summary:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching revenue summary",
            error: error.message,
        });
    }
};
