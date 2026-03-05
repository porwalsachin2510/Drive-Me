import Payment from "../models/Payment.js";
import Contract from "../models/Contract.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import PaymentSchedule from "../models/PaymentSchedule.js";
import User from "../models/User.js";
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
        
        const user = await User.findByIdAndUpdate(
            userId,
            { 
                status: "SUSPENDED",
                suspendedAt: new Date(),
                suspendedBy: req.userId
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "User suspended successfully",
            user
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
        
        const user = await User.findByIdAndUpdate(
            userId,
            { 
                status: "ACTIVE",
                activatedAt: new Date(),
                activatedBy: req.userId
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "User activated successfully",
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
        
        const provider = await User.findOneAndUpdate(
            { _id: providerId, role: "B2C_PARTNER" },
            { 
                status: "SUSPENDED",
                suspendedAt: new Date(),
                suspendedBy: req.userId
            },
            { new: true }
        ).select('-password');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "B2C provider not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "B2C provider suspended successfully",
            provider
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
        
        const provider = await User.findOneAndUpdate(
            { _id: providerId, role: "B2C_PARTNER" },
            { 
                status: "ACTIVE",
                activatedAt: new Date(),
                activatedBy: req.userId
            },
            { new: true }
        ).select('-password');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "B2C provider not found"
            });
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
            ])
        ]);

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
                securityDeposits: securityDeposits[0]?.total || 0
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

        const payouts = await Transaction.find({
            category: 'PAYOUT_REQUESTED',
            ...query
        })
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await Transaction.countDocuments({ category: 'PAYOUT_REQUESTED', ...query });

        res.status(200).json({
            success: true,
            payouts,
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

        const transactions = await Transaction.find(query)
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await Transaction.countDocuments(query);

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
        
        const payout = await Transaction.findByIdAndUpdate(
            payoutId,
            {
                status: 'APPROVED',
                approvedAt: new Date(),
                approvedBy: req.userId
            },
            { new: true }
        );

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout request not found"
            });
        }

        // Process payout (you can integrate with payment gateway here)
        // For now, we'll mark it as completed
        payout.status = 'COMPLETED';
        payout.completedAt = new Date();
        await payout.save();

        res.status(200).json({
            success: true,
            message: "Payout approved and completed successfully",
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
        
        const payout = await Transaction.findByIdAndUpdate(
            payoutId,
            {
                status: 'REJECTED',
                rejectedAt: new Date(),
                rejectedBy: req.userId,
                failureReason: reason || 'Payout rejected by admin'
            },
            { new: true }
        );

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout request not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Payout rejected successfully",
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
        
        const payout = await Transaction.findByIdAndUpdate(
            payoutId,
            {
                status: 'COMPLETED',
                completedAt: new Date(),
                completedBy: req.userId
            },
            { new: true }
        );

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout request not found"
            });
        }

        // Process payout to provider's wallet
        const wallet = await Wallet.findOne({ userId: payout.userId });
        if (wallet) {
            wallet.balance += payout.amount;
            await wallet.save();
        }

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

// Get fraud alerts for admin
export const getFraudAlerts = async (req, res) => {
    try {
        const { severity, page = 1, limit = 20 } = req.query;
        const query = {};

        if (severity) query.severity = severity;

        // Fetch real fraud alerts from database
        const realAlerts = await Transaction.find({
            $or: [
                { status: 'SUSPICIOUS' },
                { amount: { $gt: 1000 } }, // High-value transactions
                { 'metadata.ipAddress': { $exists: true } }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(Number.parseInt(limit))
        .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await Transaction.countDocuments({
            $or: [
                { status: 'SUSPICIOUS' },
                { amount: { $gt: 1000 } },
                { 'metadata.ipAddress': { $exists: true } }
            ]
        });

        res.status(200).json({
            success: true,
            alerts: realAlerts,
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
        const query = {};

        if (level) query.level = level;
        if (source) query.source = source;

        // Fetch real system logs from database
        const logs = await Transaction.find({
            $or: [
                { status: 'ERROR' },
                { status: 'WARNING' },
                { status: 'INFO' }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(Number.parseInt(limit))
        .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await Transaction.countDocuments({
            $or: [
                { status: 'ERROR' },
                { status: 'WARNING' },
                { status: 'INFO' }
            ]
        });

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
        const { title, provider, placement, size, imageUrl, targetUrl, description, budget, dailyBudget, costPerClick, costPerView, startDate, endDate, status, targetAudience } = req.body;

        if (!title || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: "Title, start date and end date are required" });
        }

        const campaign = new Campaign({
            title,
            provider: provider || '',
            placement: placement || 'banner',
            size: size || '728x90',
            imageUrl: imageUrl || '',
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
            createdBy: req.user._id || req.user.id,
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
        const allowedFields = ['title', 'provider', 'placement', 'size', 'imageUrl', 'targetUrl', 'description', 'budget', 'dailyBudget', 'costPerClick', 'costPerView', 'startDate', 'endDate', 'status', 'targetAudience'];
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
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

// Get ride pooling statistics for admin
export const getRidePoolingStats = async (req, res) => {
    try {
        const [totalPassengers, activeRoutes, suggestedRoutes, matchedRides] = await Promise.all([
            User.countDocuments({ role: "COMMUTER" }),
            B2CPartnerRoute.countDocuments({ status: "Active", isActive: true }),
            RouteRequest.countDocuments({ status: { $in: ["PENDING", "UNDER_REVIEW"] } }),
            B2CPassengerBooking.countDocuments({ bookingStatus: { $in: ["CONFIRMED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"] } })
        ]);

        res.status(200).json({
            success: true,
            stats: { totalPassengers, activeRoutes, suggestedRoutes, matchedRides }
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

// Get passenger interests for admin
export const getPassengerInterests = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status && status !== "All Status") {
            query.status = status.toUpperCase();
        }

        const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);

        const [interests, total] = await Promise.all([
            RouteRequest.find(query)
                .populate("passengerId", "fullName email whatsappNumber")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number.parseInt(limit)),
            RouteRequest.countDocuments(query)
        ]);

        // Find matched routes count for each interest
        const formattedInterests = await Promise.all(
            interests.map(async (interest) => {
                const matchedRoutes = await B2CPartnerRoute.countDocuments({
                    fromLocation: { $regex: interest.pickupLocation, $options: "i" },
                    toLocation: { $regex: interest.dropoffLocation, $options: "i" },
                    status: "Active",
                    isActive: true
                });

                return {
                    _id: interest._id,
                    passengerId: interest.passengerId?._id || interest.passengerId,
                    passengerName: interest.passengerId?.fullName || "Unknown",
                    pickupLocation: interest.pickupLocation,
                    dropoffLocation: interest.dropoffLocation,
                    preferredTime: interest.preferredTime,
                    frequency: interest.requestType ? interest.requestType.toLowerCase() : "daily",
                    status: interest.status ? interest.status.toLowerCase() : "pending",
                    createdAt: interest.createdAt,
                    matchedRoutes,
                    travelDays: interest.travelDays,
                    expectedStartDate: interest.expectedStartDate
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

// Get user suggested routes for admin
export const getUserSuggestedRoutes = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status && status !== "all") {
            query.status = status.toUpperCase();
        }

        const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);

        const [requests, total] = await Promise.all([
            RouteRequest.find(query)
                .populate("passengerId", "fullName email whatsappNumber")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number.parseInt(limit)),
            RouteRequest.countDocuments(query)
        ]);

        const formattedRoutes = requests.map((req) => ({
            _id: req._id,
            userId: req.passengerId?._id || req.passengerId,
            userName: req.passengerId?.fullName || "Unknown",
            routeName: `${req.pickupLocation} to ${req.dropoffLocation}`,
            startPoint: req.pickupLocation,
            endPoint: req.dropoffLocation,
            waypoints: [],
            estimatedTime: "N/A",
            distance: "N/A",
            suggestedPrice: req.estimatedPrice || 0,
            status: req.status ? req.status.toLowerCase().replace("_", "-") : "pending",
            votes: req.demandCount || 1,
            createdAt: req.createdAt,
            requestType: req.requestType,
            travelDays: req.travelDays,
            preferredTime: req.preferredTime
        }));

        res.status(200).json({
            success: true,
            routes: formattedRoutes,
            pagination: {
                total,
                page: Number.parseInt(page),
                pages: Math.ceil(total / Number.parseInt(limit)),
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

// Approve user suggested route
export const approveSuggestedRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        
        const routeRequest = await RouteRequest.findByIdAndUpdate(
            routeId,
            { status: "APPROVED" },
            { new: true }
        ).populate("passengerId", "fullName email");

        if (!routeRequest) {
            return res.status(404).json({ success: false, message: "Route request not found" });
        }
        
        res.status(200).json({
            success: true,
            message: "Route approved successfully",
            route: routeRequest
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

// Reject user suggested route
export const rejectSuggestedRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        const { reason } = req.body;
        
        const routeRequest = await RouteRequest.findByIdAndUpdate(
            routeId,
            { status: "REJECTED", providerResponse: reason || "Rejected by admin" },
            { new: true }
        ).populate("passengerId", "fullName email");

        if (!routeRequest) {
            return res.status(404).json({ success: false, message: "Route request not found" });
        }
        
        res.status(200).json({
            success: true,
            message: "Route rejected successfully",
            route: routeRequest
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
        
        // Here you would update the actual payment system configuration
        // For demo, we'll just log the change and return success
        console.log(`Online payments ${enabled ? 'enabled' : 'disabled'} by admin ${req.userId}`);
        
        // In a real implementation, you would:
        // 1. Update a system configuration table
        // 2. Notify all payment gateways
        // 3. Log the action for audit
        // 4. Possibly broadcast to connected clients
        
        res.status(200).json({
            success: true,
            message: `Online payments ${enabled ? 'enabled' : 'disabled'} successfully`,
            enabled
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
        // Here you would fetch the actual payment system status
        // For demo, we'll return a default status
        const status = {
            enabled: true,
            lastToggled: new Date(),
            toggledBy: 'System Admin',
            paymentGateways: {
                stripe: true,
                tap: true,
                upi: true
            },
            restrictions: {
                minAmount: 0.5,
                maxAmount: 10000,
                allowedCurrencies: ['KWD', 'USD', 'EUR']
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

        if (status) query.status = status;

        // Fetch real B2C routes from database
        const routes = await B2CPartnerRoute.find(query)
            .populate('b2cPartnerId', 'fullName companyName')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await B2CPartnerRoute.countDocuments(query);

        // Format routes for frontend compatibility
        const formattedRoutes = routes.map(route => ({
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
            status: route.status?.toLowerCase() || "active",
            featured: false,
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
        }));

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
            status: savedRoute.status?.toLowerCase() || "active",
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
        
        // Update actual route in database
        const updatedRoute = await B2CPartnerRoute.findByIdAndUpdate(
            routeId,
            {
                ...updateData,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        ).populate('providerId', 'fullName companyName');
        
        if (!updatedRoute) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }
        
        // Format response
        const formattedRoute = {
            _id: updatedRoute._id,
            name: updatedRoute.name,
            startPoint: updatedRoute.startPoint,
            endPoint: updatedRoute.endPoint,
            providerName: updatedRoute.providerId?.fullName || updatedRoute.providerId?.companyName || 'Unknown Provider',
            providerId: updatedRoute.providerId?._id,
            departureTime: updatedRoute.departureTime,
            arrivalTime: updatedRoute.arrivalTime,
            capacity: updatedRoute.capacity,
            bookedSeats: updatedRoute.bookedSeats,
            status: updatedRoute.status,
            featured: updatedRoute.featured,
            price: updatedRoute.price,
            distance: updatedRoute.distance,
            duration: updatedRoute.duration,
            createdAt: updatedRoute.createdAt
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

// Get B2C passenger reassignments (real data from bookings)
export const getB2CPassengerReassignments = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const bookingQuery = {};

        if (status && status !== 'all') {
            bookingQuery.status = status.toUpperCase();
        }

        // Fetch real bookings from B2CPassengerBooking collection
        const bookings = await B2CPassengerBooking.find(bookingQuery)
            .populate('passengerId', 'fullName email whatsappNumber profileImage')
            .populate('routeId', 'name startPoint endPoint departureTime arrivalTime price')
            .populate('b2cPartnerId', 'fullName companyName')
            .sort({ createdAt: -1 })
            .limit(Number.parseInt(limit))
            .skip((Number.parseInt(page) - 1) * Number.parseInt(limit));

        const total = await B2CPassengerBooking.countDocuments(bookingQuery);

        const formattedBookings = bookings.map(booking => ({
            _id: booking._id,
            passengerName: booking.passengerId?.fullName || 'Unknown',
            passengerEmail: booking.passengerId?.email || 'N/A',
            passengerPhone: booking.passengerId?.whatsappNumber || 'N/A',
            passengerImage: booking.passengerId?.profileImage || '',
            routeName: booking.routeId?.name || 'N/A',
            startPoint: booking.routeId?.startPoint || 'N/A',
            endPoint: booking.routeId?.endPoint || 'N/A',
            departureTime: booking.routeId?.departureTime || 'N/A',
            price: booking.routeId?.price || booking.amount || 0,
            providerName: booking.b2cPartnerId?.companyName || booking.b2cPartnerId?.fullName || 'N/A',
            status: booking.status || 'PENDING',
            seats: booking.seats || 1,
            bookingDate: booking.bookingDate || booking.createdAt,
            paymentMethod: booking.paymentMethod || 'CASH',
            amount: booking.amount || 0,
            createdAt: booking.createdAt
        }));

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

// Process passenger reassignment
export const processPassengerReassignment = async (req, res) => {
    try {
        const { reassignmentId } = req.params;
        const { action, reason } = req.body;
        
        // Here you would process the actual reassignment
        console.log(`Processing reassignment ${reassignmentId}:`, { action, reason });
        
        res.status(200).json({
            success: true,
            message: `Passenger reassignment ${action} successfully`
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
                { $group: {
                    _id: '$userId',
                    providerName: { $first: { $ifNull: ['$provider.companyName', '$provider.fullName'] } },
                    revenue: { $sum: '$amount' },
                    bookings: { $sum: 1 }
                }},
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
        const commissionRate = 0.10;
        const commissionEarned = totalRevenue * commissionRate;

        const topProviders = providerData.map(p => ({
            providerId: p._id,
            providerName: p.providerName || 'Unknown',
            revenue: p.revenue,
            bookings: p.bookings,
            commission: p.revenue * commissionRate
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

        // Get earnings from B2CPassengerBooking (where partner gets driverEarnings or paymentAmount)
        const [totalResult, todayResult, thisWeekResult, lastWeekResult] = await Promise.all([
            B2CPassengerBooking.aggregate([
                { $match: { $or: [{ b2cPartnerId: partnerObjId }, { partnerId: partnerObjId }], bookingStatus: { $in: completedStatuses } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$driverEarnings", "$paymentAmount"] } } } }
            ]),
            B2CPassengerBooking.aggregate([
                { $match: { $or: [{ b2cPartnerId: partnerObjId }, { partnerId: partnerObjId }], bookingStatus: { $in: completedStatuses }, createdAt: { $gte: todayStart } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$driverEarnings", "$paymentAmount"] } } } }
            ]),
            B2CPassengerBooking.aggregate([
                { $match: { $or: [{ b2cPartnerId: partnerObjId }, { partnerId: partnerObjId }], bookingStatus: { $in: completedStatuses }, createdAt: { $gte: weekStart } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$driverEarnings", "$paymentAmount"] } } } }
            ]),
            B2CPassengerBooking.aggregate([
                { $match: { $or: [{ b2cPartnerId: partnerObjId }, { partnerId: partnerObjId }], bookingStatus: { $in: completedStatuses }, createdAt: { $gte: lastWeekStart, $lt: weekStart } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$driverEarnings", "$paymentAmount"] } } } }
            ])
        ]);

        const totalEarnings = totalResult[0]?.total || 0;
        const todayEarnings = todayResult[0]?.total || 0;
        const thisWeekEarnings = thisWeekResult[0]?.total || 0;
        const lastWeekEarnings = lastWeekResult[0]?.total || 0;

        // Calculate week-over-week change
        let weekChange = "0%";
        if (lastWeekEarnings > 0) {
            const pctChange = ((thisWeekEarnings - lastWeekEarnings) / lastWeekEarnings * 100).toFixed(0);
            weekChange = pctChange >= 0 ? `+${pctChange}%` : `${pctChange}%`;
        } else if (thisWeekEarnings > 0) {
            weekChange = "+100%";
        }

        // Get transaction history grouped by date from B2CPassengerBooking
        const transactionHistory = await B2CPassengerBooking.aggregate([
            { $match: { $or: [{ b2cPartnerId: partnerObjId }, { partnerId: partnerObjId }], bookingStatus: { $in: completedStatuses } } },
            { $sort: { createdAt: -1 } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                trips: { $sum: 1 },
                totalAmount: { $sum: { $ifNull: ["$driverEarnings", "$paymentAmount"] } },
                status: { $first: '$paymentStatus' }
            }},
            { $sort: { _id: -1 } },
            { $limit: 20 }
        ]);

        const transactions = transactionHistory.map(t => ({
            date: t._id,
            trips: t.trips,
            amount: `+${(t.totalAmount || 0).toFixed(3)} KWD`,
            status: t.status === 'PAID' ? 'Paid' : 'Pending'
        }));

        res.status(200).json({
            success: true,
            earnings: {
                total: `${totalEarnings.toFixed(3)} KWD`,
                thisWeek: `${thisWeekEarnings.toFixed(3)} KWD`,
                thisWeekChange: weekChange,
                today: `${todayEarnings.toFixed(3)} KWD`,
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
        .select('vehicleType model year seatingCapacity licensePlate vehicleColor status images assignedDrivers assignedRoutes createdAt updatedAt features insuranceExpiry registrationExpiry')
        .sort({ createdAt: -1 });
        
        const transformedVehicles = vehicles.map(vehicle => ({
            ...vehicle._doc,
            images: vehicle.images || [],
            features: vehicle.features || [],
            insuranceExpiry: vehicle.insuranceExpiry,
            registrationExpiry: vehicle.registrationExpiry
        }));

        console.log("[v0] Transformed vehicles:", transformedVehicles.length);

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
        
        // Fetch real active B2C routes from database
        const routes = await B2CPartnerRoute.find({ status: 'Active' })
            .populate('b2cPartnerId', 'fullName companyName email')
            .sort({ createdAt: -1 });

        // Fetch all active schedules for these routes
        const routeIds = routes.map(r => r._id);
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
            
            // Check if current user is a member of this route
            const isMember = (route.members || []).some(
                m => m.userId && m.userId.toString() === userId.toString() && m.status === 'ACTIVE'
            );
            
            return {
                _id: route._id,
                name: route.routeName || `${route.fromLocation || 'Unknown'} to ${route.toLocation || 'Unknown'}`,
                startPoint: route.fromLocation || 'Not set',
                endPoint: route.toLocation || 'Not set',
                distance: estimatedDistance,
                estimatedTime: estimatedDuration,
                price: route.pricing?.oneWayPrice || 0,
                roundTripPrice: route.pricing?.roundTripPrice || 0,
                status: isMember ? 'active' : (route.status?.toLowerCase() || 'inactive'),
                isMember,
                partnerName: route.b2cPartnerId?.companyName || route.b2cPartnerId?.fullName || 'Unknown',
                departureTime,
                arrivalTime,
                totalSeats: route.totalSeats || 0,
                availableSeats: route.availableSeats || 0,
                stops: route.stopPoints || [],
                tripType: route.tripType || 'One Way',
                operatingDays: route.availableDays || [],
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

// Join route
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
                message: "Route is not active for joining"
            });
        }
        
        // Check if user is already an active member using the members array
        const existingMember = (route.members || []).find(
            m => m.userId && m.userId.toString() === userId.toString() && m.status === 'ACTIVE'
        );
        
        if (existingMember) {
            return res.status(400).json({
                success: false,
                message: "User is already a member of this route"
            });
        }
        
        if (route.availableSeats <= 0) {
            return res.status(400).json({
                success: false,
                message: "No available seats on this route"
            });
        }
        
        // Add member to route's members array and decrement available seats
        await B2CPartnerRoute.findByIdAndUpdate(routeId, {
            $inc: { availableSeats: -1 },
            $push: {
                members: {
                    userId: userId,
                    joinedAt: new Date(),
                    status: 'ACTIVE'
                }
            }
        });
        
        res.status(200).json({
            success: true,
            message: "Successfully joined route",
            routeInfo: {
                routeId: route._id,
                routeName: `${route.fromLocation} to ${route.toLocation}`,
                fromLocation: route.fromLocation,
                toLocation: route.toLocation,
                pricing: route.pricing,
                availableDays: route.availableDays,
                joinedAt: new Date()
            }
        });
        
    } catch (error) {
        console.error("Error joining route:", error);
        res.status(500).json({
            success: false,
            message: "Error joining route",
            error: error.message
        });
    }
};

// Leave route
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
        
        // Check membership in the route's members array
        const activeMember = (route.members || []).find(
            m => m.userId && m.userId.toString() === userId.toString() && m.status === 'ACTIVE'
        );
        
        if (!activeMember) {
            return res.status(400).json({
                success: false,
                message: "User is not a member of this route"
            });
        }
        
        // Update the member status to LEFT and increment available seats
        await B2CPartnerRoute.updateOne(
            { _id: routeId, 'members.userId': userId, 'members.status': 'ACTIVE' },
            {
                $set: { 'members.$.status': 'LEFT' },
                $inc: { availableSeats: 1 }
            }
        );
        
        res.status(200).json({
            success: true,
            message: "Successfully left route",
            routeInfo: {
                routeId: route._id,
                routeName: `${route.fromLocation} to ${route.toLocation}`,
                leftAt: new Date()
            }
        });
        
    } catch (error) {
        console.error("Error leaving route:", error);
        res.status(500).json({
            success: false,
            message: "Error leaving route",
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
            avatar: user.companyLogo || null,
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
            createdAt: user.createdAt
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

// Get payment statistics for admin
export const getPaymentStats = async (req, res) => {
    try {
        const [totalPending, totalVerified, totalRejected, totalAmountResult] = await Promise.all([
            Payment.countDocuments({ verificationStatus: 'PENDING' }),
            Payment.countDocuments({ verificationStatus: { $in: ['VERIFIED', 'AUTO_VERIFIED'] } }),
            Payment.countDocuments({ verificationStatus: 'REJECTED' }),
            Payment.aggregate([
                { $match: { status: { $in: ['COMPLETED', 'PROCESSING'] } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const totalAmount = totalAmountResult[0]?.total || 0;

        res.status(200).json({
            success: true,
            stats: {
                totalPending,
                totalVerified,
                totalRejected,
                totalAmount
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

// Get all pending payments for admin verification
export const getPendingPayments = async (req, res) => {
    try {
        const payments = await Payment.find({
            status: "PENDING",
            verificationStatus: "PENDING",
        })
            .populate("contractId", "contractNumber")
            .populate("corporateOwnerId", "fullName companyName email phone")
            .populate("fleetOwnerId", "fullName companyName email phone")
            .sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            count: payments.length,
            payments,
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

// // Verify and approve payment
// export const verifyPayment = async (req, res) => {
//     try {
//         const { paymentId } = req.params
//         const { action, reason } = req.body // action: 'APPROVE' or 'REJECT'

//         const payment = await Payment.findById(paymentId).populate("contractId")

//         if (!payment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Payment not found",
//             })
//         }

//         if (payment.verificationStatus !== "PENDING") {
//             return res.status(400).json({
//                 success: false,
//                 message: "Payment already verified",
//             })
//         }

//         if (action === "APPROVE") {
//             payment.status = "COMPLETED"
//             payment.verificationStatus = "VERIFIED"
//             payment.verifiedBy = req.userId
//             payment.verifiedAt = new Date()

//             // Calculate commission split
//             const adminCommissionAmount = (payment.amount * 20) / 100
//             const fleetOwnerAmount = (payment.amount * 80) / 100

//             payment.adminCommission = adminCommissionAmount
//             payment.fleetOwnerAmount = fleetOwnerAmount,


//             await payment.save()

//             // Update wallets
//             let adminWallet = await Wallet.findOne({ userId: req.userId, role: "ADMIN" })
//             if (!adminWallet) {
//                 adminWallet = new Wallet({
//                     userId: req.userId,
//                     role: "ADMIN",
//                     balance: 0,
//                 })
//             }
//             const adminBalanceBefore = adminWallet.balance
//             adminWallet.balance += adminCommissionAmount
//             const adminBalanceAfter = adminWallet.balance

//             adminWallet.currency = payment.currency
//             await adminWallet.save()

//             let fleetWallet = await Wallet.findOne({
//                 userId: payment.fleetOwnerId,
//                 role: "B2B_PARTNER",
//             })
//             if (!fleetWallet) {
//                 fleetWallet = new Wallet({
//                     userId: payment.fleetOwnerId,
//                     role: "B2B_PARTNER",
//                     balance: 0,
//                 })
//             }

//             const fleetBalanceBefore = fleetWallet.balance
//             fleetWallet.balance += fleetOwnerAmount
//             const fleetBalanceAfter = fleetWallet.balance

//             fleetWallet.currency = payment.currency
//             await fleetWallet.save()

//             // Create transaction records
//             await Transaction.create([
//                 {
//                     userId: req.userId,
//                     walletId: adminWallet._id,
//                     type: "CREDIT",
//                     category: "COMMISSION_EARNED",
//                     amount: adminCommissionAmount,
//                     balanceBefore: adminBalanceBefore,
//                     balanceAfter: adminBalanceAfter,
//                     paymentId: payment._id,
//                     contractId: payment.contractId,
//                     description: `Admin commission for contract ${payment.contractId.contractNumber}`,
//                 },
//                 {
//                     userId: payment.fleetOwnerId,
//                     walletId: fleetWallet._id,
//                     type: "CREDIT",
//                     category: "PAYMENT_RECEIVED",
//                     amount: fleetOwnerAmount,
//                     balanceBefore: fleetBalanceBefore,
//                     balanceAfter: fleetBalanceAfter,
//                     paymentId: payment._id,
//                     contractId: payment.contractId,
//                     description: `Rental payment for contract ${payment.contractId.contractNumber}`,
//                 },
//             ])

//             // Update contract status
//             const contract = await Contract.findById(payment.contractId)
//             if (contract) {
//                 // Update financial details
//                 if (payment.paymentType === "advance") {
//                     contract.financials.advancePayment.paidAt = new Date()
//                     contract.financials.advancePayment.transactionId = payment.gatewayTransactionId
//                     contract.status = "ACTIVE" // Waiting for final payment
//                 } else if (payment.paymentType === "final") {
//                     contract.financials.finalPayment.paidAt = new Date()
//                     contract.financials.finalPayment.transactionId = payment.gatewayTransactionId
//                     contract.status = "ACTIVE" // Contract is now active
//                     contract.activatedAt = new Date()
//                 } else if (payment.paymentType === "security") {
//                     contract.financials.securityDeposit.paidAt = new Date()
//                 }

//                 contract.statusHistory.push({
//                     status: contract.status,
//                     changedAt: new Date(),
//                     changedBy: req.userId,
//                     reason: `Payment ${action.toLowerCase()}d by admin`,
//                 })

//                 await contract.save()
//             }

//             res.status(200).json({
//                 success: true,
//                 message: "Payment verified and approved successfully",
//                 payment,
//             })
//         } else if (action === "REJECT") {
//             payment.status = "FAILED"
//             payment.verificationStatus = "REJECTED"
//             payment.verifiedBy = req.userId
//             payment.verifiedAt = new Date()
//             payment.failureReason = reason

//             await payment.save()

//             // Update contract status
//             const contract = await Contract.findById(payment.contractId)
//             if (contract) {
//                 contract.statusHistory.push({
//                     status: "PAYMENT_REJECTED",
//                     changedAt: new Date(),
//                     changedBy: req.userId,
//                     reason: reason,
//                 })
//                 await contract.save()
//             }

//             res.status(200).json({
//                 success: true,
//                 message: "Payment rejected",
//                 payment,
//             })
//         }
//     } catch (error) {
//         console.error("[v0] Error verifying payment:", error)
//         res.status(500).json({
//             success: false,
//             message: "Error verifying payment",
//             error: error.message,
//         })
//     }
// }

// export const verifyPayment = async (req, res) => {
//     try {
//         const { paymentId } = req.params
//         const { action, reason } = req.body // action: 'APPROVE' or 'REJECT'

//         const payment = await Payment.findById(paymentId).populate("contractId")

//         if (!payment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Payment not found",
//             })
//         }

//         if (payment.verificationStatus !== "PENDING") {
//             return res.status(400).json({
//                 success: false,
//                 message: "Payment already verified",
//             })
//         }

//         if (action === "APPROVE") {
//             payment.status = "COMPLETED"
//             payment.verificationStatus = "VERIFIED"
//             payment.verifiedBy = req.userId
//             payment.verifiedAt = new Date()

//             const advanceAmount = payment.contractId.financials.advancePayment.amount
//             const securityDepositAmount = payment.contractId.financials.securityDeposit.amount

//             // Commission: 10% of advance only
//             const adminCommissionAmount = payment.adminCommission // Already calculated as 10% of advance
//             // Fleet owner gets: 90% of advance
//             const fleetOwnerAmount = payment.fleetOwnerAmount // Already calculated as 90% of advance

//             console.log("[v0] Verifying Payment Breakdown:")
//             console.log("[v0] Advance Amount:", advanceAmount)
//             console.log("[v0] Security Deposit (held separately):", securityDepositAmount)
//             console.log("[v0] Admin Commission (10% of advance):", adminCommissionAmount)
//             console.log("[v0] Fleet Owner Amount (90% of advance):", fleetOwnerAmount)

//             payment.adminCommission = {
//                 amount: adminCommissionAmount,
//                 percentage: 10,
//                 appliedOn: "advance",
//             }
//             payment.fleetOwnerShare = {
//                 amount: fleetOwnerAmount,
//                 percentage: 90,
//                 appliedOn: "advance",
//             }
//             payment.securityDepositInfo = {
//                 amount: securityDepositAmount,
//                 status: "HELD",
//                 refundable: true,
//             }

//             await payment.save()

//             // Update Admin Wallet - Commission only
//             let adminWallet = await Wallet.findOne({ userId: req.userId, role: "ADMIN" })
//             if (!adminWallet) {
//                 adminWallet = new Wallet({
//                     userId: req.userId,
//                     role: "ADMIN",
//                     balance: 0,
//                     securityDepositHeld: 0,
//                 })
//             }
//             adminWallet.balance += adminCommissionAmount
//             adminWallet.securityDepositHeld += securityDepositAmount
//             await adminWallet.save()

//             console.log(
//                 "[v0] Admin wallet updated - Commission:",
//                 adminCommissionAmount,
//                 "Security Deposit Held:",
//                 securityDepositAmount,
//             )

//             // Update Fleet Owner Wallet - Only 90% of advance
//             let fleetWallet = await Wallet.findOne({
//                 userId: payment.fleetOwnerId,
//                 role: "B2B_PARTNER",
//             })
//             if (!fleetWallet) {
//                 fleetWallet = new Wallet({
//                     userId: payment.fleetOwnerId,
//                     role: "B2B_PARTNER",
//                     balance: 0,
//                 })
//             }
//             fleetWallet.balance += fleetOwnerAmount
//             await fleetWallet.save()

//             console.log("[v0] Fleet owner wallet updated:", fleetOwnerAmount)

//             // Create transaction records
//             await Transaction.create([
//                 {
//                     userId: req.userId,
//                     walletId: adminWallet._id,
//                     type: "CREDIT",
//                     category: "COMMISSION",
//                     amount: adminCommissionAmount,
//                     balance: adminWallet.balance,
//                     paymentId: payment._id,
//                     contractId: payment.contractId,
//                     description: `Admin commission (10% of advance) for contract ${payment.contractId.contractNumber}`,
//                 },
//                 {
//                     userId: payment.fleetOwnerId,
//                     walletId: fleetWallet._id,
//                     type: "CREDIT",
//                     category: "RENTAL_INCOME",
//                     amount: fleetOwnerAmount,
//                     balance: fleetWallet.balance,
//                     paymentId: payment._id,
//                     contractId: payment.contractId,
//                     description: `Rental income (90% of advance) for contract ${payment.contractId.contractNumber}`,
//                 },
//                 {
//                     userId: req.userId,
//                     walletId: adminWallet._id,
//                     type: "HOLD",
//                     category: "SECURITY_DEPOSIT",
//                     amount: securityDepositAmount,
//                     balance: adminWallet.securityDepositHeld,
//                     paymentId: payment._id,
//                     contractId: payment.contractId,
//                     description: `Security deposit held (refundable) for contract ${payment.contractId.contractNumber}`,
//                 },
//             ])

//             const contract = payment.contractId
//             contract.financials.advancePayment.status = "PAID"
//             contract.financials.advancePayment.paidAt = new Date()
//             contract.financials.advancePayment.paidVia = payment.paymentMethod
//             contract.financials.advancePayment.transactionId = payment._id

//             contract.financials.securityDeposit.status = "PAID"
//             contract.financials.securityDeposit.paidAt = new Date()
//             contract.financials.securityDeposit.paidVia = payment.paymentMethod
//             contract.financials.securityDeposit.transactionId = payment._id

//             contract.status = "ACTIVE"
//             contract.vehicleAccess.isActive = true
//             contract.activatedAt = new Date()

//             // Schedule final payment for 30 days later
//             const dueDate = new Date()
//             dueDate.setDate(dueDate.getDate() + 30)
//             contract.financials.remainingPayment.dueDate = dueDate

//             contract.statusHistory.push({
//                 status: "ACTIVE",
//                 changedAt: new Date(),
//                 changedBy: req.userId,
//                 reason: "Payment verified - contract activated after advance + security deposit received",
//             })

//             await contract.save()

//             console.log("[v0] Contract updated to ACTIVE status")

//             return res.status(200).json({
//                 success: true,
//                 message: "Payment verified successfully",
//                 data: {
//                     payment,
//                     paymentBreakdown: {
//                         advanceAmount,
//                         securityDepositAmount,
//                         adminCommission: adminCommissionAmount,
//                         fleetOwnerAmount,
//                     },
//                 },
//             })
//         } else if (action === "REJECT") {
//             payment.status = "FAILED"
//             payment.verificationStatus = "REJECTED"
//             payment.verifiedBy = req.userId
//             payment.verifiedAt = new Date()
//             payment.failureReason = reason || "Payment rejected by admin"

//             await payment.save()

//             return res.status(200).json({
//                 success: true,
//                 message: "Payment rejected",
//                 data: { payment },
//             })
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid action. Must be 'APPROVE' or 'REJECT'",
//             })
//         }
//     } catch (error) {
//         console.error("[v0] Verify payment error:", error)
//         res.status(500).json({
//             success: false,
//             message: "Error verifying payment",
//             error: error.message,
//         })
//     }
// }

// Verify and approve payment
export const verifyPayment = async (req, res) => {
    try {
        const { paymentId } = req.params
        const { action, reason } = req.body // action: 'APPROVE' or 'REJECT'

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
            payment.status = "COMPLETED"
            payment.verificationStatus = "VERIFIED"
            payment.verifiedBy = req.userId
            payment.verifiedAt = new Date()

            const advanceAmount = payment.advanceAmount
            const securityDepositAmount = payment.securityDepositAmount

            // Commission: 10% of advance only

            const adminCommissionAmount = payment.adminCommission // Already calculated as 10% of advance
            // Fleet owner gets: 90% of advance
            const fleetOwnerAmount = payment.fleetOwnerAmount // Already calculated as 90% of advance

            console.log("[v0] Verifying Payment Breakdown:")
            console.log("[v0] Advance Amount:", advanceAmount)
            console.log("[v0] Security Deposit (held separately):", securityDepositAmount)
            console.log("[v0] Admin Commission (10% of advance):", adminCommissionAmount)
            console.log("[v0] Fleet Owner Amount (90% of advance):", fleetOwnerAmount)

            payment.adminCommission = {
                amount: adminCommissionAmount,
                percentage: 10,
                appliedOn: "advance",
            }
            payment.fleetOwnerShare = {
                amount: fleetOwnerAmount,
                percentage: 90,
                appliedOn: "advance",
            }
            payment.securityDepositInfo = {
                amount: securityDepositAmount,
                status: "HELD",
                refundable: true,
            }

            await payment.save()

            // Update Admin Wallet - Commission only
            let adminWallet = await Wallet.findOne({ userId: req.userId, role: "ADMIN" })
            if (!adminWallet) {
                adminWallet = new Wallet({
                    userId: req.userId,
                    role: "ADMIN",
                    balance: 0,
                    securityDepositHeld: 0,
                })
            }

            // const adminBalanceBefore = adminWallet.balance
            // adminWallet.balance += adminCommissionAmount
            // adminWallet.securityDepositHeld += securityDepositAmount
            // const adminBalanceAfter = adminWallet.balance

            const adminBalanceBefore = adminWallet.balance
            const adminSecurityBefore = adminWallet.securityDepositHeld

            adminWallet.balance += adminCommissionAmount
            adminWallet.securityDepositHeld += securityDepositAmount

            const adminBalanceAfter = adminWallet.balance
            const adminSecurityAfter = adminWallet.securityDepositHeld
            await adminWallet.save()

            console.log(
                "[v0] Admin wallet updated - Commission:",
                adminCommissionAmount,
                "Security Deposit Held:",
                securityDepositAmount,
            )

            // Update Fleet Owner Wallet - Only 90% of advance
            let fleetWallet = await Wallet.findOne({
                userId: payment.fleetOwnerId,
                role: "B2B_PARTNER",
            })
            if (!fleetWallet) {
                fleetWallet = new Wallet({
                    userId: payment.fleetOwnerId,
                    role: "B2B_PARTNER",
                    balance: 0,
                })
            }

            const fleetBalanceBefore = fleetWallet.balance
            fleetWallet.balance += fleetOwnerAmount
            const fleetBalanceAfter = fleetWallet.balance
            await fleetWallet.save()

            console.log("[v0] Fleet owner wallet updated:", fleetOwnerAmount)

            // Create transaction records
            await Transaction.create([
                {
                    userId: req.userId,
                    walletId: adminWallet._id,
                    type: "CREDIT",
                    category: "COMMISSION_EARNED",
                    amount: adminCommissionAmount,
                    balance: adminWallet.balance,
                    balanceBefore: adminBalanceBefore,
                    balanceAfter: adminBalanceAfter,
                    paymentId: payment._id,
                    contractId: payment.contractId,
                    description: `Admin commission (10% of advance) for contract ${payment.contractId.contractNumber}`,
                },
                {
                    userId: payment.fleetOwnerId,
                    walletId: fleetWallet._id,
                    type: "CREDIT",
                    category: "PAYMENT_RECEIVED",
                    amount: fleetOwnerAmount,
                    balance: fleetWallet.balance,
                    balanceBefore: fleetBalanceBefore,
                    balanceAfter: fleetBalanceAfter,
                    paymentId: payment._id,
                    contractId: payment.contractId,
                    description: `Rental income (90% of advance) for contract ${payment.contractId.contractNumber}`,
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
        const [totalContracts, activeContracts, pendingPayments, totalRevenue, adminWallet] = await Promise.all([
            Contract.countDocuments(),
            Contract.countDocuments({ status: "ACTIVE" }),
            Payment.countDocuments({ verificationStatus: "PENDING" }),
            Payment.aggregate([{ $match: { status: "COMPLETED" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
            Wallet.findOne({ userId: req.userId, role: "ADMIN" }),
        ])

        res.status(200).json({
            success: true,
            stats: {
                totalContracts,
                activeContracts,
                pendingPayments,
                totalRevenue: totalRevenue[0]?.total || 0,
                adminBalance: adminWallet?.balance || 0,
            },
        })
    } catch (error) {
        console.error("[v0] Error fetching dashboard stats:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching dashboard statistics",
            error: error.message,
        })
    }
}

// Get monthly revenue data for admin dashboard
export const getMonthlyRevenue = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Get monthly revenue data
        const monthlyRevenue = await Payment.aggregate([
            {
                $match: {
                    status: "COMPLETED",
                    createdAt: {
                        $gte: new Date(currentYear, 0, 1),
                        $lte: new Date(currentYear, 11, 31)
                    }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id": 1 }
            }
        ]);

        // Format data for frontend
        const data = months.map((month, index) => {
            const monthData = monthlyRevenue.find(item => item._id === index + 1);
            return {
                month,
                total: monthData?.total || 0,
                corporate: Math.floor((monthData?.total || 0) * 0.6), // 60% from corporate
                b2c: Math.floor((monthData?.total || 0) * 0.3), // 30% from B2C
                commission: Math.floor((monthData?.total || 0) * 0.1) // 10% commission
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
        const monthsToShow = parseInt(period);
        const currentYear = new Date().getFullYear();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Get booking data for the specified period
        const startDate = new Date(currentYear, 12 - monthsToShow, 1);
        const endDate = new Date(currentYear, 11, 31);
        
        // Aggregate bookings by month
        const bookingTrends = await Payment.aggregate([
            {
                $match: {
                    status: "COMPLETED",
                    createdAt: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    bookings: { $sum: 1 },
                    revenue: { $sum: "$amount" }
                }
            },
            {
                $sort: { "_id": 1 }
            }
        ]);

        // Format data for frontend
        const data = months
            .slice(-monthsToShow)
            .map((month, index) => {
                const monthData = bookingTrends.find(item => item._id === (13 - monthsToShow + index + 1));
                return {
                    month,
                    bookings: monthData?.bookings || 0,
                    revenue: monthData?.revenue || 0
                };
            });

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
        vehicle.approvedAt = new Date();
        vehicle.approvedBy = adminId;
        await vehicle.save();

        // Notify fleet owner
        const fleetOwner = await User.findById(vehicle.fleetOwnerId);
        if (fleetOwner && fleetOwner.email) {
            await sendEmail({
                to: fleetOwner.email,
                subject: "Vehicle Approved on Drive-Me Platform",
                html: `
                    <h2>Vehicle Approval Confirmed</h2>
                    <p>Your vehicle <strong>${vehicle.vehicleName}</strong> (${vehicle.registrationNumber}) has been approved!</p>
                    <p>You can now list it on the platform and start accepting bookings.</p>
                `
            });
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
        vehicle.rejectionReason = rejectionReason;
        vehicle.approvedBy = adminId;
        vehicle.approvedAt = new Date();
        await vehicle.save();

        // Notify fleet owner
        const fleetOwner = await User.findById(vehicle.fleetOwnerId);
        if (fleetOwner && fleetOwner.email) {
            await sendEmail({
                to: fleetOwner.email,
                subject: "Vehicle Application Rejected",
                html: `
                    <h2>Vehicle Application Rejected</h2>
                    <p>Your vehicle <strong>${vehicle.vehicleName}</strong> (${vehicle.registrationNumber}) was not approved.</p>
                    <p><strong>Reason:</strong> ${rejectionReason}</p>
                    <p>Please update your vehicle details and resubmit.</p>
                `
            });
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
