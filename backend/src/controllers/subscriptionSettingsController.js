import SubscriptionSettings from "../models/SubscriptionSettings.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
import User from "../models/User.js";
import { sendEmail } from "../Services/emailService.js";

// Update subscription settings
export const updateSubscriptionSettings = async (req, res) => {
    try {
        const userId = req.userId;
        const {
            autoRenewal,
            renewalReminderDays,
            renewalPaymentMethod,
            emailNotifications,
            smsNotifications,
            pushNotifications
        } = req.body;

        // Find or create subscription settings
        let settings = await SubscriptionSettings.findOne({ userId });
        
        if (!settings) {
            settings = new SubscriptionSettings({ userId });
        }

        // Update settings
        if (autoRenewal !== undefined) settings.autoRenewal = autoRenewal;
        if (renewalReminderDays !== undefined) settings.renewalReminderDays = renewalReminderDays;
        if (renewalPaymentMethod !== undefined) settings.renewalPaymentMethod = renewalPaymentMethod;
        
        if (emailNotifications) {
            settings.emailNotifications = { ...settings.emailNotifications, ...emailNotifications };
        }
        if (smsNotifications) {
            settings.smsNotifications = { ...settings.smsNotifications, ...smsNotifications };
        }
        if (pushNotifications) {
            settings.pushNotifications = { ...settings.pushNotifications, ...pushNotifications };
        }

        // Calculate next renewal date if auto-renewal is enabled
        if (autoRenewal) {
            const activePass = await B2CMonthlyPass.findOne({
                passengerId: userId,
                status: "ACTIVE"
            }).sort({ endDate: -1 });
            
            if (activePass) {
                settings.nextRenewalDate = new Date(activePass.endDate);
            }
        } else {
            settings.nextRenewalDate = null;
        }

        await settings.save();

        res.status(200).json({
            success: true,
            message: "Subscription settings updated successfully",
            data: {
                settings: {
                    autoRenewal: settings.autoRenewal,
                    renewalReminderDays: settings.renewalReminderDays,
                    renewalPaymentMethod: settings.renewalPaymentMethod,
                    nextRenewalDate: settings.nextRenewalDate,
                    emailNotifications: settings.emailNotifications,
                    smsNotifications: settings.smsNotifications,
                    pushNotifications: settings.pushNotifications
                }
            }
        });

    } catch (error) {
        console.error("Error updating subscription settings:", error);
        res.status(500).json({
            success: false,
            message: "Error updating subscription settings",
            error: error.message
        });
    }
};

// Get subscription settings
export const getSubscriptionSettings = async (req, res) => {
    try {
        const userId = req.userId;
        
        let settings = await SubscriptionSettings.findOne({ userId });
        
        // If no settings exist, create default settings
        if (!settings) {
            settings = new SubscriptionSettings({ userId });
            await settings.save();
        }

        res.status(200).json({
            success: true,
            data: {
                settings: {
                    autoRenewal: settings.autoRenewal,
                    renewalReminderDays: settings.renewalReminderDays,
                    renewalPaymentMethod: settings.renewalPaymentMethod,
                    nextRenewalDate: settings.nextRenewalDate,
                    lastRenewalDate: settings.lastRenewalDate,
                    emailNotifications: settings.emailNotifications,
                    smsNotifications: settings.smsNotifications,
                    pushNotifications: settings.pushNotifications,
                    renewalHistory: settings.renewalHistory,
                    cancellationReason: settings.cancellationReason,
                    cancellationDate: settings.cancellationDate
                }
            }
        });

    } catch (error) {
        console.error("Error getting subscription settings:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving subscription settings",
            error: error.message
        });
    }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
    try {
        const userId = req.userId;
        const { reason, immediateEffect } = req.body;

        const settings = await SubscriptionSettings.findOne({ userId });
        if (!settings) {
            return res.status(404).json({
                success: false,
                message: "Subscription settings not found"
            });
        }

        // Update cancellation settings
        settings.autoRenewal = false;
        settings.cancellationReason = reason;
        settings.cancellationDate = new Date();

        await settings.save();

        // If immediate effect, cancel active passes
        if (immediateEffect) {
            await B2CMonthlyPass.updateMany(
                { passengerId: userId, status: "ACTIVE" },
                { status: "CANCELLED", updatedAt: new Date() }
            );
        }

        // Add to renewal history
        settings.renewalHistory.push({
            date: new Date(),
            status: "CANCELLED",
            amount: 0,
            paymentMethod: "CANCELLATION",
            failureReason: reason
        });

        await settings.save();

        // Send confirmation email
        await sendCancellationEmail(userId, reason);

        res.status(200).json({
            success: true,
            message: "Subscription cancelled successfully",
            data: {
                cancellationDate: settings.cancellationDate,
                immediateEffect,
                autoRenewal: false
            }
        });

    } catch (error) {
        console.error("Error cancelling subscription:", error);
        res.status(500).json({
            success: false,
            message: "Error cancelling subscription",
            error: error.message
        });
    }
};

// Manually renew subscription
export const renewSubscription = async (req, res) => {
    try {
        const userId = req.userId;
        const { paymentMethod } = req.body;

        const settings = await SubscriptionSettings.findOne({ userId });
        if (!settings) {
            return res.status(404).json({
                success: false,
                message: "Subscription settings not found"
            });
        }

        // Find active pass to renew
        const activePass = await B2CMonthlyPass.findOne({
            passengerId: userId,
            status: { $in: ["ACTIVE", "EXPIRED"] }
        }).sort({ endDate: -1 });

        if (!activePass) {
            return res.status(404).json({
                success: false,
                message: "No active or recently expired subscription found to renew"
            });
        }

        // Create new monthly pass
        const startDate = new Date() > new Date(activePass.endDate) 
            ? new Date() 
            : new Date(activePass.endDate);
        const newEndDate = new Date(startDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);

        const newPass = new B2CMonthlyPass({
            passengerId: activePass.passengerId,
            routeId: activePass.routeId,
            scheduleId: activePass.scheduleId,
            partnerId: activePass.partnerId,
            passType: activePass.passType,
            outboundTripTime: activePass.outboundTripTime,
            returnTripTime: activePass.returnTripTime,
            pickupLocation: activePass.pickupLocation,
            dropoffLocation: activePass.dropoffLocation,
            returnPickupLocation: activePass.returnPickupLocation,
            returnDropoffLocation: activePass.returnDropoffLocation,
            startDate: startDate,
            endDate: newEndDate,
            durationMonths: 1,
            totalAmount: activePass.totalAmount,
            paymentMethod: paymentMethod || activePass.paymentMethod,
            adminCommission: activePass.totalAmount * 0.2,
            partnerEarnings: activePass.totalAmount * 0.8,
            status: "ACTIVE"
        });

        await newPass.save();

        // Update old pass
        if (activePass.status === "ACTIVE") {
            activePass.status = "RENEWED";
            await activePass.save();
        }

        // Update subscription settings
        settings.autoRenewal = true;
        settings.lastRenewalDate = new Date();
        settings.nextRenewalDate = newEndDate;
        settings.cancellationReason = null;
        settings.cancellationDate = null;
        settings.currentRenewalAttempts = 0;

        settings.renewalHistory.push({
            date: new Date(),
            status: "SUCCESS",
            amount: activePass.totalAmount,
            paymentMethod: paymentMethod || settings.renewalPaymentMethod
        });

        await settings.save();

        res.status(200).json({
            success: true,
            message: "Subscription renewed successfully",
            data: {
                newPass,
                nextRenewalDate: newEndDate,
                amount: activePass.totalAmount
            }
        });

    } catch (error) {
        console.error("Error renewing subscription:", error);
        res.status(500).json({
            success: false,
            message: "Error renewing subscription",
            error: error.message
        });
    }
};

// Process renewals (cron job function)
export const processRenewals = async () => {
    try {
        console.log("Processing subscription renewals...");
        
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find subscriptions due for renewal
        const dueSubscriptions = await SubscriptionSettings.find({
            autoRenewal: true,
            nextRenewalDate: {
                $gte: today,
                $lt: tomorrow
            }
        }).populate('userId');

        for (const subscription of dueSubscriptions) {
            try {
                // Get active monthly pass
                const activePass = await B2CMonthlyPass.findOne({
                    passengerId: subscription.userId._id,
                    status: "ACTIVE",
                    endDate: { $lte: subscription.nextRenewalDate }
                });

                if (activePass) {
                    // Process renewal
                    await processSingleRenewal(subscription, activePass);
                }
            } catch (error) {
                console.error(`Error processing renewal for user ${subscription.userId._id}:`, error);
            }
        }

        console.log(`Processed ${dueSubscriptions.length} subscription renewals`);

    } catch (error) {
        console.error("Error processing renewals:", error);
    }
};

// Send renewal reminders
export const sendRenewalReminders = async () => {
    try {
        console.log("Sending renewal reminders...");
        
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + 7); // 7 days from now

        // Find subscriptions due for reminder
        const dueForReminder = await SubscriptionSettings.find({
            autoRenewal: true,
            nextRenewalDate: {
                $gte: reminderDate,
                $lt: new Date(reminderDate.getTime() + 24 * 60 * 60 * 1000) // Within 24 hours
            }
        }).populate('userId');

        for (const subscription of dueForReminder) {
            try {
                await sendRenewalReminderEmail(subscription);
            } catch (error) {
                console.error(`Error sending reminder for user ${subscription.userId._id}:`, error);
            }
        }

        console.log(`Sent ${dueForReminder.length} renewal reminders`);

    } catch (error) {
        console.error("Error sending renewal reminders:", error);
    }
};

// Helper functions
const processSingleRenewal = async (subscription, activePass) => {
    try {
        // Create new monthly pass
        const newEndDate = new Date(activePass.endDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);

        const newPass = new B2CMonthlyPass({
            passengerId: activePass.passengerId,
            routeId: activePass.routeId,
            scheduleId: activePass.scheduleId,
            partnerId: activePass.partnerId,
            passType: activePass.passType,
            outboundTripTime: activePass.outboundTripTime,
            returnTripTime: activePass.returnTripTime,
            pickupLocation: activePass.pickupLocation,
            dropoffLocation: activePass.dropoffLocation,
            returnPickupLocation: activePass.returnPickupLocation,
            returnDropoffLocation: activePass.returnDropoffLocation,
            startDate: activePass.endDate,
            endDate: newEndDate,
            durationMonths: 1,
            totalAmount: activePass.totalAmount,
            paymentMethod: activePass.paymentMethod,
            adminCommission: activePass.totalAmount * 0.2,
            partnerEarnings: activePass.totalAmount * 0.8,
            status: "ACTIVE"
        });

        await newPass.save();

        // Update old pass status
        activePass.status = "RENEWED";
        await activePass.save();

        // Update subscription settings
        subscription.lastRenewalDate = new Date();
        subscription.nextRenewalDate = newEndDate;
        subscription.currentRenewalAttempts = 0;

        subscription.renewalHistory.push({
            date: new Date(),
            status: "SUCCESS",
            amount: activePass.totalAmount,
            paymentMethod: subscription.renewalPaymentMethod
        });

        await subscription.save();

        // Send success notification
        await sendRenewalSuccessEmail(subscription, newPass);

    } catch (error) {
        // Update renewal history with failure
        subscription.renewalHistory.push({
            date: new Date(),
            status: "FAILED",
            amount: activePass.totalAmount,
            paymentMethod: subscription.renewalPaymentMethod,
            failureReason: error.message
        });
        subscription.currentRenewalAttempts += 1;
        await subscription.save();

        throw error;
    }
};

const sendRenewalReminderEmail = async (subscription) => {
    try {
        const user = await User.findById(subscription.userId._id);
        if (user && subscription.emailNotifications.renewalReminder) {
            await sendEmail({
                to: user.email,
                subject: "Subscription Renewal Reminder",
                template: "renewalReminder",
                data: {
                    userName: user.fullName,
                    renewalDate: subscription.nextRenewalDate,
                    daysLeft: Math.ceil((subscription.nextRenewalDate - new Date()) / (1000 * 60 * 60 * 24)),
                    autoRenewal: subscription.autoRenewal,
                    renewalPaymentMethod: subscription.renewalPaymentMethod
                }
            });
        }
    } catch (error) {
        console.error("Error sending renewal reminder email:", error);
    }
};

const sendRenewalSuccessEmail = async (subscription, newPass) => {
    try {
        const user = await User.findById(subscription.userId._id);
        if (user && subscription.emailNotifications.renewalSuccess) {
            await sendEmail({
                to: user.email,
                subject: "Subscription Renewed Successfully",
                template: "renewalSuccess",
                data: {
                    userName: user.fullName,
                    renewalDate: new Date(),
                    nextRenewalDate: newPass.endDate,
                    amount: newPass.totalAmount,
                    paymentMethod: subscription.renewalPaymentMethod
                }
            });
        }
    } catch (error) {
        console.error("Error sending renewal success email:", error);
    }
};

const sendCancellationEmail = async (userId, reason) => {
    try {
        const user = await User.findById(userId);
        if (user) {
            await sendEmail({
                to: user.email,
                subject: "Subscription Cancelled",
                template: "subscriptionCancelled",
                data: {
                    userName: user.fullName,
                    cancellationDate: new Date(),
                    reason: reason
                }
            });
        }
    } catch (error) {
        console.error("Error sending cancellation email:", error);
    }
};
