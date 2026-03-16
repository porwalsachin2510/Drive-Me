import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendRealTimeNotification } from "./socketService.js";

// Create notification with null safety
export const createNotification = async (notificationData) => {
    try {
        // Sanitize notification data to prevent undefined values
        const sanitizedData = {
            ...notificationData,
            title: notificationData.title || "Notification",
            message: (notificationData.message || "You have a new notification").replace(/undefined/g, "N/A"),
            type: notificationData.type || "GENERAL",
        };
        
        // Ensure userId exists
        if (!sanitizedData.userId) {
            console.error("[v0] Notification skipped: no userId provided");
            return null;
        }
        
        const notification = new Notification(sanitizedData);
        await notification.save();

        // Send real-time notification if user is online
        await sendRealTimeNotification(sanitizedData.userId, {
            type: sanitizedData.type,
            title: sanitizedData.title,
            message: sanitizedData.message,
            data: sanitizedData.data || {},
            notificationId: notification._id,
            createdAt: notification.createdAt,
        });

        // Also broadcast to all Admin users so they can monitor activities
        // Skip if this is already an admin notification to avoid loops
        if (!notificationData.skipAdminBroadcast) {
            try {
                await sendAdminNotificationForMonitoring(
                    `[Monitor] ${sanitizedData.title}`,
                    sanitizedData.message,
                    `ADMIN_MONITOR_${sanitizedData.type}`,
                    {
                        ...sanitizedData.data,
                        originalUserId: sanitizedData.userId,
                        originalNotificationId: notification._id,
                    }
                );
            } catch (adminErr) {
                // Don't fail if admin notification fails
                console.error("[v0] Failed to send admin monitor notification:", adminErr.message);
            }
        }

        console.log(`[v0] Notification created and sent: ${notification._id}`);
        return notification;
    } catch (error) {
        console.error("[v0] Error creating notification:", error);
        // Don't throw - notifications should not break main flow
        return null;
    }
};

// Send daily trip reminders (30 minutes before)
export const sendDailyTripReminders = async () => {
    try {
        console.log("[v0] Sending daily trip reminders...");
        
        const now = new Date();
        const reminderTime = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
        
        // Get all active subscriptions with trips in the next 30 minutes
        const Subscription = (await import("../models/Subscription.js")).default;
        const B2CPartnerTrip = (await import("../models/B2CPartnerTrip.js")).default;
        
        const upcomingTrips = await B2CPartnerTrip.find({
            tripDate: {
                $gte: new Date(now.setHours(0, 0, 0, 0)),
                $lt: new Date(now.setHours(23, 59, 59, 999))
            },
            startTime: {
                $gte: now.toTimeString().slice(0, 5),
                $lte: reminderTime.toTimeString().slice(0, 5)
            },
            status: "Scheduled",
        }).populate('passengers.userId');

        for (const trip of upcomingTrips) {
            for (const passenger of trip.passengers) {
                if (passenger.userId && passenger.status === "Confirmed") {
                    await createNotification({
                        userId: passenger.userId._id,
                        type: "TRIP_REMINDER",
                        title: "Trip Starting Soon!",
                        message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} starts in 30 minutes at ${trip.startTime}`,
                        data: {
                            tripId: trip._id,
                            routeId: trip.routeId,
                            startTime: trip.startTime,
                            fromLocation: trip.fromLocation,
                            toLocation: trip.toLocation,
                            vehicleInfo: trip.vehicleInfo,
                            driverInfo: trip.driverInfo,
                        },
                    });
                }
            }
        }

        console.log(`[v0] Sent reminders for ${upcomingTrips.length} trips`);
    } catch (error) {
        console.error("[v0] Error sending daily trip reminders:", error);
    }
};

// Send trip start notification
export const sendTripStartNotification = async (tripId, driverId) => {
    try {
        const B2CPartnerTrip = (await import("../models/B2CPartnerTrip.js")).default;
        
        const trip = await B2CPartnerTrip.findById(tripId).populate('passengers.userId');
        
        if (!trip) {
            throw new Error("Trip not found");
        }

        // Update trip status
        trip.status = "In Progress";
        trip.actualStartTime = new Date();
        await trip.save();

        // Send notifications to all confirmed passengers
        const passengers = trip.passengers || [];
        for (const passenger of passengers) {
            if (passenger.userId && (passenger.status === "Confirmed" || passenger.status === "Boarded")) {
                await createNotification({
                    userId: passenger.userId._id || passenger.userId,
                    type: "TRIP_STARTED",
                    title: "Trip Started!",
                    message: `Your trip from ${trip.fromLocation || 'pickup'} to ${trip.toLocation || 'destination'} has started. Driver is en route.`,
                    data: {
                        tripId: trip._id,
                        driverInfo: trip.driverInfo || {},
                        vehicleInfo: trip.vehicleInfo || {},
                        fromLocation: trip.fromLocation || '',
                        toLocation: trip.toLocation || '',
                    },
                });

                // Update passenger status
                passenger.status = "Boarded";
            }
        }

        await trip.save();
        console.log(`[v0] Trip start notifications sent for trip: ${tripId}`);
    } catch (error) {
        console.error("[v0] Error sending trip start notification:", error);
        throw error;
    }
};

// Send trip completion notification
export const sendTripCompletionNotification = async (tripId) => {
    try {
        const B2CPartnerTrip = (await import("../models/B2CPartnerTrip.js")).default;
        
        const trip = await B2CPartnerTrip.findById(tripId).populate('passengers.userId');
        
        if (!trip) {
            throw new Error("Trip not found");
        }

        // Update trip status
        trip.status = "Completed";
        trip.actualEndTime = new Date();
        await trip.save();

        // Send notifications to all passengers
        for (const passenger of trip.passengers) {
            if (passenger.userId) {
                await createNotification({
                    userId: passenger.userId._id,
                    type: "TRIP_COMPLETED",
                    title: "Trip Completed!",
                    message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} has been completed safely.`,
                    data: {
                        tripId: trip._id,
                        completionTime: trip.actualEndTime,
                    },
                });

                // Update passenger status
                if (passenger.status !== "No Show") {
                    passenger.status = "Completed";
                }
            }
        }

        await trip.save();
        console.log(`[v0] Trip completion notifications sent for trip: ${tripId}`);
    } catch (error) {
        console.error("[v0] Error sending trip completion notification:", error);
        throw error;
    }
};

// Send subscription renewal reminder
export const sendSubscriptionRenewalReminder = async (subscriptionId) => {
    try {
        const Subscription = (await import("../models/Subscription.js")).default;
        
        const subscription = await Subscription.findById(subscriptionId).populate('userId routeId');
        
        if (!subscription) {
            throw new Error("Subscription not found");
        }

        const daysRemaining = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 7 && daysRemaining > 0) {
            await createNotification({
                userId: subscription.userId._id,
                type: "SUBSCRIPTION_RENEWAL",
                title: "Subscription Expiring Soon!",
                message: `Your subscription for route ${subscription.routeId.fromLocation} to ${subscription.routeId.toLocation} expires in ${daysRemaining} days.`,
                data: {
                    subscriptionId: subscription._id,
                    routeId: subscription.routeId._id,
                    endDate: subscription.endDate,
                    daysRemaining,
                    autoRenewal: subscription.autoRenewal,
                },
            });

            console.log(`[v0] Renewal reminder sent for subscription: ${subscriptionId}`);
        }
    } catch (error) {
        console.error("[v0] Error sending subscription renewal reminder:", error);
        throw error;
    }
};

// Send payment reminder
export const sendPaymentReminder = async (userId, amount, dueDate, paymentType) => {
    try {
        await createNotification({
            userId,
            type: "PAYMENT_REMINDER",
            title: "Payment Due!",
            message: `Your ${paymentType} payment of AED ${amount} is due on ${dueDate.toLocaleDateString()}`,
            data: {
                amount,
                dueDate,
                paymentType,
            },
        });

        console.log(`[v0] Payment reminder sent to user: ${userId}`);
    } catch (error) {
        console.error("[v0] Error sending payment reminder:", error);
        throw error;
    }
};

// Send route request notification to B2C partners
export const sendRouteRequestNotification = async (b2cPartnerId, routeRequest) => {
    try {
        await createNotification({
            userId: b2cPartnerId,
            type: "ROUTE_REQUEST",
            title: "New Route Request!",
            message: `Passengers are requesting a route from ${routeRequest.fromLocation} to ${routeRequest.toLocation}`,
            data: {
                routeRequest,
                requestedBy: routeRequest.userId,
                requestCount: routeRequest.requestCount,
            },
        });

        console.log(`[v0] Route request notification sent to partner: ${b2cPartnerId}`);
    } catch (error) {
        console.error("[v0] Error sending route request notification:", error);
        throw error;
    }
};

// Send corporate employee notifications
export const sendCorporateNotifications = async (companyId, message, type, data) => {
    try {
        const CorporateEmployee = (await import("../models/CorporateEmployee.js")).default;
        
        const employees = await CorporateEmployee.find({
            companyId,
            "transportDetails.transportStatus": "ACTIVE",
        }).populate('userId');

        for (const employee of employees) {
            await createNotification({
                userId: employee.userId._id,
                type: type || "CORPORATE_UPDATE",
                title: "Transport Update",
                message: message,
                data: {
                    companyId,
                    employeeId: employee._id,
                    ...data,
                },
            });
        }

        console.log(`[v0] Corporate notification sent to ${employees.length} employees`);
    } catch (error) {
        console.error("[v0] Error sending corporate notifications:", error);
        throw error;
    }
};

// Send delay notification
export const sendDelayNotification = async (tripId, delayMinutes, reason) => {
    try {
        const B2CPartnerTrip = (await import("../models/B2CPartnerTrip.js")).default;
        
        const trip = await B2CPartnerTrip.findById(tripId).populate('passengers.userId');
        
        if (!trip) {
            throw new Error("Trip not found");
        }

        // Update trip delay info
        trip.delayReason = reason;
        await trip.save();

        // Send notifications to all passengers
        for (const passenger of trip.passengers) {
            if (passenger.userId && passenger.status !== "No Show") {
                await createNotification({
                    userId: passenger.userId._id,
                    type: "TRIP_DELAY",
                    title: "Trip Delayed!",
                    message: `Your trip is delayed by ${delayMinutes} minutes. Reason: ${reason}`,
                    data: {
                        tripId: trip._id,
                        delayMinutes,
                        reason,
                        newStartTime: trip.delayedStartTime,
                    },
                });
            }
        }

        console.log(`[v0] Delay notification sent for trip: ${tripId}`);
    } catch (error) {
        console.error("[v0] Error sending delay notification:", error);
        throw error;
    }
};

// Send emergency notification
export const sendEmergencyNotification = async (tripId, emergencyType, message) => {
    try {
        const B2CPartnerTrip = (await import("../models/B2CPartnerTrip.js")).default;
        
        const trip = await B2CPartnerTrip.findById(tripId).populate('passengers.userId b2cPartnerId');
        
        if (!trip) {
            throw new Error("Trip not found");
        }

        // Send to all passengers
        for (const passenger of trip.passengers) {
            if (passenger.userId) {
                await createNotification({
                    userId: passenger.userId._id,
                    type: "EMERGENCY",
                    title: "Emergency Alert!",
                    message: message,
                    data: {
                        tripId: trip._id,
                        emergencyType,
                        currentLocation: trip.currentLocation,
                    },
                });
            }
        }

        // Send to B2C partner
        await createNotification({
            userId: trip.b2cPartnerId._id,
            type: "EMERGENCY",
            title: "Emergency Alert!",
            message: `Emergency reported on trip ${trip.fromLocation} to ${trip.toLocation}: ${message}`,
            data: {
                tripId: trip._id,
                emergencyType,
                passengerCount: trip.passengers.length,
            },
        });

        console.log(`[v0] Emergency notification sent for trip: ${tripId}`);
    } catch (error) {
        console.error("[v0] Error sending emergency notification:", error);
        throw error;
    }
};

// Get user notifications
export const getUserNotifications = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 20, unreadOnly = false } = req.query;

        const filter = { userId };
        if (unreadOnly === "true") {
            filter.isRead = false;
        }

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Notification.countDocuments(filter);

        return res.status(200).json({
            success: true,
            data: {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching notifications:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch notifications",
            error: error.message,
        });
    }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.userId;

        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: { notification },
        });
    } catch (error) {
        console.error("[v0] Error marking notification as read:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to mark notification as read",
            error: error.message,
        });
    }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const userId = req.userId;

        await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read",
        });
    } catch (error) {
        console.error("[v0] Error marking all notifications as read:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to mark all notifications as read",
            error: error.message,
        });
    }
};

// Delete notification
export const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.userId;

        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            userId,
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully",
        });
    } catch (error) {
        console.error("[v0] Error deleting notification:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete notification",
            error: error.message,
        });
    }
};

// Send quotation notification to B2B partners
export const sendQuotationNotification = async (b2bPartnerIds, requirementId, quotationDetails) => {
    try {
        for (const partnerId of b2bPartnerIds) {
            await createNotification({
                userId: partnerId,
                type: "NEW_QUOTATION",
                title: "New Quotation Received!",
                message: `A new quotation has been submitted for your requirement #${requirementId}`,
                data: {
                    requirementId,
                    quotationId: quotationDetails.quotationId,
                    partnerId: partnerId,
                    amount: quotationDetails.amount,
                    currency: quotationDetails.currency,
                    status: quotationDetails.status,
                },
            });
        }

        console.log(`[v0] Quotation notifications sent to ${b2bPartnerIds.length} partners`);
    } catch (error) {
        console.error("[v0] Error sending quotation notification:", error);
        throw error;
    }
};

// ============ CRITICAL NOTIFICATION FUNCTIONS ============

// Send trip start reminder (12 hours before trip)
export const sendTripStartReminder = async (tripId) => {
    try {
        const Trip = (await import("../models/Trip.js")).default;
        const trip = await Trip.findById(tripId).populate('passengers.employeeId');

        if (!trip) return;

        const tripTime = new Date(`${trip.tripDate} ${trip.startTime}`);
        const hoursUntilTrip = (tripTime - new Date()) / (1000 * 60 * 60);

        if (hoursUntilTrip > 11 && hoursUntilTrip <= 12) {
            for (const passenger of trip.passengers) {
                if (passenger.employeeId) {
                    await createNotification({
                        userId: passenger.employeeId.userId,
                        type: "TRIP_START_REMINDER",
                        title: "Upcoming Trip - 12 Hours Away",
                        message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} departs in 12 hours at ${trip.startTime}`,
                        data: {
                            tripId: trip._id,
                            startTime: trip.startTime,
                            fromLocation: trip.fromLocation,
                            toLocation: trip.toLocation
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error("[v0] Error sending trip start reminder:", error);
    }
};

// Send bus near stop notification (when driver is <2km from pickup stop)
export const sendBusNearStopNotification = async (tripId, driverId, currentLocation) => {
    try {
        const Trip = (await import("../models/Trip.js")).default;
        const trip = await Trip.findById(tripId).populate('passengers.employeeId');

        if (!trip || !currentLocation) return;

        // Calculate distance from current location to pickup stops
        for (const passenger of trip.passengers) {
            if (passenger.employeeId && passenger.status === "CONFIRMED") {
                const pickupCoords = passenger.pickupCoords || { lat: 0, lng: 0 };
                const distance = calculateDistance(
                    currentLocation.lat,
                    currentLocation.lng,
                    pickupCoords.lat,
                    pickupCoords.lng
                );

                if (distance < 2) { // Less than 2km
                    await createNotification({
                        userId: passenger.employeeId.userId,
                        type: "BUS_NEAR_STOP",
                        title: "Bus Arriving Soon!",
                        message: `The bus is ${Math.round(distance * 1000)}m away from your pickup point`,
                        data: {
                            tripId: trip._id,
                            distance: Math.round(distance * 1000),
                            eta: "2-5 minutes"
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error("[v0] Error sending bus near stop notification:", error);
    }
};

// Send driver assigned notification
export const sendDriverAssignedNotification = async (tripId, driverId) => {
    try {
        const Trip = (await import("../models/Trip.js")).default;
        const User = (await import("../models/User.js")).default;
        const trip = await Trip.findById(tripId).populate('passengers.employeeId');
        const driver = await User.findById(driverId);

        if (!trip || !driver) return;

        for (const passenger of trip.passengers) {
            if (passenger.employeeId) {
                await createNotification({
                    userId: passenger.employeeId.userId,
                    type: "DRIVER_ASSIGNED",
                    title: "Driver Assigned",
                    message: `${driver.fullName} is your driver for the trip from ${trip.fromLocation} to ${trip.toLocation}`,
                    data: {
                        tripId: trip._id,
                        driverId: driver._id,
                        driverName: driver.fullName,
                        driverPhone: driver.phone,
                        vehicleInfo: trip.vehicleInfo
                    }
                });
            }
        }

        // Also notify the driver
        await createNotification({
            userId: driverId,
            type: "TRIP_ASSIGNED",
            title: "New Trip Assigned",
            message: `You have been assigned a trip from ${trip.fromLocation} to ${trip.toLocation}`,
            data: {
                tripId: trip._id,
                startTime: trip.startTime,
                passengerCount: trip.passengers.length
            }
        });

    } catch (error) {
        console.error("[v0] Error sending driver assigned notification:", error);
    }
};

// Send payment success notification
export const sendPaymentSuccessNotification = async (userId, paymentDetails) => {
    try {
        await createNotification({
            userId,
            type: "PAYMENT_SUCCESS",
            title: "Payment Successful",
            message: `Your payment of AED ${paymentDetails.amount} has been successfully processed`,
            data: {
                transactionId: paymentDetails.transactionId,
                amount: paymentDetails.amount,
                paymentMethod: paymentDetails.method,
                timestamp: new Date(),
                receiptUrl: paymentDetails.receiptUrl
            }
        });

        console.log(`[v0] Payment success notification sent to user: ${userId}`);
    } catch (error) {
        console.error("[v0] Error sending payment success notification:", error);
    }
};

// Send contract expiry warning (7 days before expiry)
export const sendContractExpiryWarning = async (contractId) => {
    try {
        const Contract = (await import("../models/Contract.js")).default;
        const contract = await Contract.findById(contractId).populate('corporateId');

        if (!contract) return;

        const daysUntilExpiry = Math.ceil((contract.endDate - new Date()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry === 7) {
            await createNotification({
                userId: contract.corporateId._id,
                type: "CONTRACT_EXPIRY_WARNING",
                title: "Contract Expiring Soon",
                message: `Your contract for transport services expires in 7 days on ${contract.endDate.toLocaleDateString()}`,
                data: {
                    contractId: contract._id,
                    expiryDate: contract.endDate,
                    daysRemaining: 7,
                    autoRenewal: contract.autoRenewal
                }
            });

            console.log(`[v0] Contract expiry warning sent for contract: ${contractId}`);
        }
    } catch (error) {
        console.error("[v0] Error sending contract expiry warning:", error);
    }
};

// Send notification to all Admin users
export const sendAdminNotification = async (title, message, type = "ADMIN_ALERT", data = {}) => {
    try {
        const admins = await User.find({ role: "ADMIN" }).select('_id');
        for (const admin of admins) {
            await createNotification({
                userId: admin._id,
                type,
                title,
                message,
                data,
                skipAdminBroadcast: true // Prevent infinite loop
            });
        }
        console.log(`[v0] Admin notification sent to ${admins.length} admins: ${title}`);
    } catch (error) {
        console.error("[v0] Error sending admin notification:", error);
    }
};

// Send admin notification for monitoring user activities (prevents infinite loops)
const sendAdminNotificationForMonitoring = async (title, message, type = "ADMIN_MONITOR", data = {}) => {
    try {
        const admins = await User.find({ role: "ADMIN" }).select('_id');
        for (const admin of admins) {
            // Create notification directly to prevent recursive broadcast
            const notification = new Notification({
                userId: admin._id,
                type,
                title,
                message,
                data,
            });
            await notification.save();
            
            // Send real-time notification
            await sendRealTimeNotification(admin._id, {
                type,
                title,
                message,
                data,
                notificationId: notification._id,
                createdAt: notification.createdAt,
            });
        }
    } catch (error) {
        console.error("[v0] Error sending admin monitoring notification:", error);
    }
};

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
