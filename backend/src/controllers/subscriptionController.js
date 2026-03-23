import Subscription from "../models/Subscription.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import paymentGatewayService from "../Services/paymentGatewayService.js";
import crypto from "crypto";

// Create new subscription
export const createSubscription = async (req, res) => {
    try {
        console.log("[v0] Create subscription request received");
        const { routeId, planType, paymentMethod, autoRenewal = true } = req.body;
        const userId = req.userId;

        console.log("[v0] Route ID:", routeId);
        console.log("[v0] Plan Type:", planType);
        console.log("[v0] Payment Method:", paymentMethod);
        console.log("[v0] User ID:", userId);

        // Get route details
        const route = await B2CPartnerRoute.findById(routeId).populate('b2cPartnerId');
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            });
        }

        // Check if route is active
        if (route.status !== "Active") {
            return res.status(400).json({
                success: false,
                message: "Route is not currently active",
            });
        }

        // Check if user already has active subscription for this route
        const existingSubscription = await Subscription.findOne({
            userId,
            routeId,
            status: "ACTIVE",
        });

        if (existingSubscription) {
            return res.status(400).json({
                success: false,
                message: "You already have an active subscription for this route",
            });
        }

        // Calculate pricing based on plan type
        let monthlyPrice = route.pricing.oneWayPrice;
        let totalDaysInPeriod = 30;

        switch (planType) {
            case "FULL_MONTH":
                monthlyPrice = route.pricing.monthlyPrice || route.pricing.oneWayPrice * 22;
                totalDaysInPeriod = 30;
                break;
            case "WEEKDAYS_ONLY":
                monthlyPrice = route.pricing.oneWayPrice * 22; // 22 weekdays
                totalDaysInPeriod = 22;
                break;
            case "CUSTOM_DAYS":
                monthlyPrice = route.pricing.oneWayPrice * 20; // 20 custom days
                totalDaysInPeriod = 20;
                break;
        }

        // Round trip pricing
        if (route.tripType === "Round Trip" && route.pricing.roundTripPrice) {
            monthlyPrice = route.pricing.roundTripPrice;
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        console.log("[v0] Monthly Price:", monthlyPrice);
        console.log("[v0] Subscription Period:", startDate, "to", endDate);

        // Check available seats
        if (route.availableSeats <= 0) {
            return res.status(400).json({
                success: false,
                message: "No seats available on this route",
            });
        }

        // Get user details for payment
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Create subscription record
        const subscription = new Subscription({
            userId,
            routeId,
            b2cPartnerId: route.b2cPartnerId._id,
            subscriptionType: "MONTHLY",
            planType,
            startDate,
            endDate,
            autoRenewal,
            status: "ACTIVE",
            pricing: {
                monthlyPrice,
                paidAmount: monthlyPrice,
                currency: "AED",
            },
            usageStats: {
                totalDaysInPeriod,
                daysUsed: 0,
                daysAbsent: 0,
            },
        });

        await subscription.save();

        // Process payment
        if (paymentMethod === "WALLET") {
            await processWalletPayment(userId, monthlyPrice, subscription._id, "SUBSCRIPTION");
        } else {
            // Create payment session for card/other methods
            const paymentSession = await paymentGatewayService.createPaymentSession({
                gateway: "STRIPE",
                amount: monthlyPrice,
                currency: "AED",
                customer: {
                    email: user.email,
                    name: user.fullName,
                },
                subscriptionId: subscription._id,
                redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/subscription/payment/verify`,
                metadata: {
                    subscriptionId: subscription._id,
                    userId,
                    routeId,
                },
            });

            subscription.paymentDetails.paymentMethod = paymentMethod;
            subscription.paymentDetails.gatewaySessionId = paymentSession.sessionId;
            subscription.paymentDetails.paymentStatus = "PENDING";
            await subscription.save();

            return res.status(200).json({
                success: true,
                message: "Subscription created. Payment required to activate.",
                data: {
                    subscription,
                    paymentSession,
                },
            });
        }

        // Update route available seats
        route.availableSeats -= 1;
        await route.save();

        // Create daily trips for the subscription period
        await createDailyTrips(subscription, route);

        console.log("[v0] Subscription created successfully:", subscription._id);

        return res.status(201).json({
            success: true,
            message: "Subscription created and activated successfully",
            data: { subscription },
        });

    } catch (error) {
        console.error("[v0] Error creating subscription:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create subscription",
            error: error.message,
        });
    }
};

// Process wallet payment
const processWalletPayment = async (userId, amount, referenceId, category) => {
    try {
        let wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            wallet = await Wallet.create({
                userId,
                balance: 0,
                currency: "AED",
            });
        }

        if (wallet.balance < amount) {
            throw new Error("Insufficient wallet balance");
        }

        const balanceBefore = wallet.balance;
        wallet.balance -= amount;
        await wallet.save();

        await Transaction.create({
            walletId: wallet._id,
            userId,
            type: "DEBIT",
            amount,
            category,
            description: `Payment for ${category} - ${referenceId}`,
            referenceId,
            referenceModel: category === "SUBSCRIPTION" ? "Subscription" : "Payment",
            balanceBefore,
            balanceAfter: wallet.balance,
        });

        console.log(`[v0] Wallet payment processed: ${amount} from user ${userId}`);
    } catch (error) {
        console.error("[v0] Wallet payment error:", error);
        throw error;
    }
};

// Create daily trips for subscription
const createDailyTrips = async (subscription, route) => {
    try {
        const trips = [];
        const startDate = new Date(subscription.startDate);
        const endDate = new Date(subscription.endDate);

        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            // Skip weekends if weekdays only
            if (subscription.planType === "WEEKDAYS_ONLY") {
                const dayOfWeek = date.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip Saturday, Sunday
            }

            const tripDate = new Date(date);
            const trip = new B2CPartnerTrip({
                routeId: route._id,
                b2cPartnerId: route.b2cPartnerId._id,
                vehicleId: route.assignedVehicle,
                driverId: route.assignedDriver,
                tripDate,
                startTime: route.startTime,
                tripType: route.tripType,
                fromLocation: route.fromLocation,
                toLocation: route.toLocation,
                stopPoints: route.stopPoints,
                totalSeats: route.totalSeats,
                availableSeats: route.availableSeats,
                status: "Scheduled",
                passengers: [{
                    userId: subscription.userId,
                    status: "Confirmed",
                }],
            });

            trips.push(trip);
        }

        if (trips.length > 0) {
            await B2CPartnerTrip.insertMany(trips);
            console.log(`[v0] Created ${trips.length} daily trips for subscription ${subscription._id}`);
        }
    } catch (error) {
        console.error("[v0] Error creating daily trips:", error);
        throw error;
    }
};

// Get user subscriptions
export const getUserSubscriptions = async (req, res) => {
    try {
        const userId = req.userId;
        const { status } = req.query;

        const filter = { userId };
        if (status) {
            filter.status = status;
        }

        const subscriptions = await Subscription.find(filter)
            .populate('routeId', 'fromLocation toLocation startTime tripType')
            .populate('b2cPartnerId', 'fullName companyName')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: { subscriptions },
        });
    } catch (error) {
        console.error("[v0] Error fetching subscriptions:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch subscriptions",
            error: error.message,
        });
    }
};

// Get B2C Partner subscriptions
export const getPartnerSubscriptions = async (req, res) => {
    try {
        const b2cPartnerId = req.userId;
        const { status, routeId } = req.query;

        const filter = { b2cPartnerId };
        if (status) filter.status = status;
        if (routeId) filter.routeId = routeId;

        const subscriptions = await Subscription.find(filter)
            .populate('userId', 'fullName email phoneNumber')
            .populate('routeId', 'fromLocation toLocation startTime tripType')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: { subscriptions },
        });
    } catch (error) {
        console.error("[v0] Error fetching partner subscriptions:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch subscriptions",
            error: error.message,
        });
    }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const userId = req.userId;
        const { reason } = req.body;

        const subscription = await Subscription.findById(subscriptionId);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found",
            });
        }

        // Verify ownership
        if (subscription.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to cancel this subscription",
            });
        }

        // Update subscription status
        subscription.status = "CANCELLED";
        subscription.cancellationDetails = {
            cancelledAt: new Date(),
            cancelledBy: userId,
            reason: reason || "User requested cancellation",
        };

        await subscription.save();

        // Update route available seats
        const route = await B2CPartnerRoute.findById(subscription.routeId);
        if (route) {
            route.availableSeats += 1;
            await route.save();
        }

        // Cancel future trips
        await B2CPartnerTrip.updateMany(
            {
                routeId: subscription.routeId,
                tripDate: { $gte: new Date() },
                "passengers.userId": userId,
            },
            {
                $pull: { passengers: { userId } },
                $set: { availableSeats: { $inc: 1 } },
            }
        );

        console.log("[v0] Subscription cancelled:", subscriptionId);

        return res.status(200).json({
            success: true,
            message: "Subscription cancelled successfully",
            data: { subscription },
        });
    } catch (error) {
        console.error("[v0] Error cancelling subscription:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel subscription",
            error: error.message,
        });
    }
};

// Renew subscription
export const renewSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const userId = req.userId;

        const subscription = await Subscription.findById(subscriptionId);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found",
            });
        }

        // Verify ownership
        if (subscription.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to renew this subscription",
            });
        }

        // Check if already active
        if (subscription.status === "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Subscription is already active",
            });
        }

        // Calculate new dates
        const newStartDate = new Date(subscription.endDate);
        const newEndDate = new Date(newStartDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);

        // Reset usage stats
        subscription.startDate = newStartDate;
        subscription.endDate = newEndDate;
        subscription.status = "ACTIVE";
        subscription.usageStats = {
            totalDaysInPeriod: subscription.usageStats.totalDaysInPeriod,
            daysUsed: 0,
            daysAbsent: 0,
            noShowDays: [],
        };
        subscription.cancellationDetails = undefined;

        await subscription.save();

        // Create new daily trips
        const route = await B2CPartnerRoute.findById(subscription.routeId);
        if (route) {
            await createDailyTrips(subscription, route);
        }

        console.log("[v0] Subscription renewed:", subscriptionId);

        return res.status(200).json({
            success: true,
            message: "Subscription renewed successfully",
            data: { subscription },
        });
    } catch (error) {
        console.error("[v0] Error renewing subscription:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to renew subscription",
            error: error.message,
        });
    }
};

// Mark no-show for a day
export const markNoShow = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const userId = req.userId;
        const { date, reason } = req.body;

        const subscription = await Subscription.findById(subscriptionId);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found",
            });
        }

        // Verify ownership
        if (subscription.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to update this subscription",
            });
        }

        const noShowDate = new Date(date);
        
        // Add to no-show days
        subscription.usageStats.noShowDays.push({
            date: noShowDate,
            reason: reason || "User marked no-show",
            notifiedAt: new Date(),
        });
        subscription.usageStats.daysAbsent += 1;

        await subscription.save();

        // Update trip passenger status
        await B2CPartnerTrip.updateOne(
            {
                routeId: subscription.routeId,
                tripDate: noShowDate,
                "passengers.userId": userId,
            },
            {
                $set: { "passengers.$.status": "No Show" },
                $inc: { availableSeats: 1 },
            }
        );

        console.log("[v0] No-show marked for subscription:", subscriptionId, "on date:", date);

        return res.status(200).json({
            success: true,
            message: "No-show marked successfully",
            data: { subscription },
        });
    } catch (error) {
        console.error("[v0] Error marking no-show:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to mark no-show",
            error: error.message,
        });
    }
};
