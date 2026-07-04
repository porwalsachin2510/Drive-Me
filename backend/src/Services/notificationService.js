import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendRealTimeNotification } from "./socketService.js";

// Re-export sendRealTimeNotification for convenience
export { sendRealTimeNotification };

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

        // Some legacy callers (e.g. admin payment verification) only pass
        // `recipientId`. Treat it as the delivery target so those notifications
        // are not silently dropped.
        if (!sanitizedData.userId && sanitizedData.recipientId) {
            sanitizedData.userId = sanitizedData.recipientId;
        }

        // Ensure a delivery target exists
        if (!sanitizedData.userId) {
            console.error("[v0] Notification skipped: no userId/recipientId provided");
            return null;
        }

        // Duplicate-suppression guard (real DB operation). The same logical event
        // (e.g. a monthly pass activation) can trigger createNotification more than
        // once — double-submits, retried requests, or several services reacting to
        // the same change. Without this, the user sees the identical notification
        // repeated. If an identical notification (same recipient + type + title +
        // message) was persisted within the dedup window, reuse it instead of
        // creating another copy.
        if (!sanitizedData.allowDuplicate) {
            try {
                const DEDUP_WINDOW_MS = 60 * 1000; // 60 seconds
                const existing = await Notification.findOne({
                    userId: sanitizedData.userId,
                    type: sanitizedData.type,
                    title: sanitizedData.title,
                    message: sanitizedData.message,
                    createdAt: { $gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
                }).sort({ createdAt: -1 });

                if (existing) {
                    console.log(
                        "[v0] Duplicate notification suppressed:",
                        sanitizedData.type,
                        "-",
                        sanitizedData.title
                    );
                    return existing;
                }
            } catch (dedupErr) {
                console.log("[v0] Notification dedup check skipped:", dedupErr.message);
            }
        }

        const notification = new Notification(sanitizedData);
        await notification.save();

        // Populate related documents so the frontend receives rich data
        // (merged from the legacy controller-level createNotification).
        try {
            if (sanitizedData.relatedUserId) {
                await notification.populate("relatedUserId", "fullName email phone");
            }
            if (sanitizedData.recipientId) {
                await notification.populate("recipientId", "fullName email phone");
            }
            if (sanitizedData.bookingId) {
                try {
                    await notification.populate({
                        path: "bookingId",
                        model: "B2CPassengerBooking",
                        select: "pickupLocation dropoffLocation travelDate numberOfSeats",
                    });
                } catch {
                    try {
                        await notification.populate({
                            path: "bookingId",
                            model: "CorporateBooking",
                            select: "pickupLocation dropoffLocation travelDate numberOfSeats",
                        });
                    } catch (popErr) {
                        console.log("[v0] Could not populate bookingId:", popErr.message);
                    }
                }
            }
        } catch (popErr) {
            console.log("[v0] Notification populate skipped:", popErr.message);
        }

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

// Send trip reminders ~30 minutes before departure. Designed to be called
// every few minutes by a cron. Uses a real datetime window (tripDate + startTime)
// and a per-trip flag (notificationsSent.reminder30Min) to avoid duplicates.
export const sendDailyTripReminders = async () => {
    try {
        const B2CPartnerTrip = (await import("../models/B2CPartnerTrip.js")).default;

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Candidate trips for today that are still scheduled and not yet reminded
        const candidateTrips = await B2CPartnerTrip.find({
            tripDate: { $gte: todayStart, $lte: todayEnd },
            status: "Scheduled",
            "notificationsSent.reminder30Min": { $ne: true },
        }).populate("passengers.userId", "_id");

        let remindedTrips = 0;

        for (const trip of candidateTrips) {
            // Build the actual departure datetime from tripDate + "HH:mm"
            if (!trip.startTime || !trip.startTime.includes(":")) continue;
            const [hours, minutes] = trip.startTime.split(":").map(Number);
            const departure = new Date(trip.tripDate);
            departure.setHours(hours, minutes, 0, 0);

            const minutesUntil = (departure - now) / 60000;
            // Fire when departure is within the next 0-35 minutes
            if (minutesUntil < 0 || minutesUntil > 35) continue;

            for (const passenger of trip.passengers || []) {
                if (passenger.userId && passenger.status === "Confirmed") {
                    await createNotification({
                        userId: passenger.userId._id || passenger.userId,
                        type: "TRIP_REMINDER",
                        title: "Trip Starting Soon!",
                        message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} departs at ${trip.startTime} (about ${Math.round(minutesUntil)} min).`,
                        data: {
                            tripId: trip._id,
                            routeId: trip.routeId,
                            bookingId: passenger.bookingId,
                            startTime: trip.startTime,
                            fromLocation: trip.fromLocation,
                            toLocation: trip.toLocation,
                            pickupPoint: passenger.pickupPoint,
                        },
                    });
                }
            }

            // Mark as reminded so we don't notify again
            trip.notificationsSent = trip.notificationsSent || {};
            trip.notificationsSent.reminder30Min = true;
            await trip.save();
            remindedTrips++;
        }

        console.log(`[v0] Trip reminders sent for ${remindedTrips} trip(s)`);
        return remindedTrips;
    } catch (error) {
        console.error("[v0] Error sending daily trip reminders:", error);
        return 0;
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

// Notify all confirmed passengers (and the driver) when a driver is assigned
// to upcoming B2C trips of a route. Used when a B2C partner assigns/changes the
// driver for a route. `driverUserId` is optional and used to also notify the
// driver's own user account when the driver has a linked login.
export const notifyDriverAssignedForRoute = async (routeId, driverDoc, driverUserId = null) => {
    try {
        const B2CPartnerTrip = (await import("../models/B2CPartnerTrip.js")).default;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingTrips = await B2CPartnerTrip.find({
            routeId,
            tripDate: { $gte: today },
            status: { $in: ["Scheduled", "Delayed"] },
        });

        const driverName = driverDoc?.name || driverDoc?.fullName || "Your driver";
        const driverPhone = driverDoc?.phoneNumber || driverDoc?.phone || "";

        const notifiedPassengers = new Set();

        for (const trip of upcomingTrips) {
            for (const passenger of trip.passengers || []) {
                if (
                    passenger.userId &&
                    passenger.status === "Confirmed" &&
                    !notifiedPassengers.has(passenger.userId.toString())
                ) {
                    notifiedPassengers.add(passenger.userId.toString());
                    await createNotification({
                        userId: passenger.userId,
                        type: "DRIVER_ASSIGNED",
                        title: "Driver Assigned",
                        message: `${driverName} is now your driver for ${trip.fromLocation} to ${trip.toLocation}.`,
                        data: {
                            tripId: trip._id,
                            routeId,
                            bookingId: passenger.bookingId,
                            driverName,
                            driverPhone,
                            fromLocation: trip.fromLocation,
                            toLocation: trip.toLocation,
                        },
                    });
                }
            }
        }

        // Notify the driver's own account if they have a linked login
        if (driverUserId) {
            await createNotification({
                userId: driverUserId,
                type: "TRIP_ASSIGNED",
                title: "New Route Assigned",
                message: `You have been assigned to ${upcomingTrips.length} upcoming trip(s).`,
                data: { routeId, tripCount: upcomingTrips.length },
            });
        }

        console.log(`[v0] Driver-assigned notifications sent to ${notifiedPassengers.size} passenger(s) for route ${routeId}`);
        return notifiedPassengers.size;
    } catch (error) {
        console.error("[v0] Error sending driver assigned notification:", error);
        return 0;
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

// Scan all ACTIVE contracts and warn both parties when one expires within the
// next 7 days. De-duplicated so each contract triggers at most one warning per
// remaining-day value (prevents daily spam from the cron).
export const sendContractExpiryWarnings = async () => {
    try {
        const Contract = (await import("../models/Contract.js")).default;

        const now = new Date();
        const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const expiringContracts = await Contract.find({
            status: "ACTIVE",
            "rentalPeriod.endDate": { $gte: now, $lte: sevenDaysLater },
        }).select("contractNumber corporateOwnerId fleetOwnerId rentalPeriod");

        let warned = 0;

        for (const contract of expiringContracts) {
            const endDate = contract.rentalPeriod?.endDate;
            if (!endDate) continue;

            const daysRemaining = Math.max(
                0,
                Math.ceil((new Date(endDate) - now) / (1000 * 60 * 60 * 24))
            );

            // Skip if we already warned for this contract at this day-count today
            const alreadyWarned = await Notification.findOne({
                type: "CONTRACT_EXPIRY_WARNING",
                "data.contractId": contract._id,
                "data.daysRemaining": daysRemaining,
            });
            if (alreadyWarned) continue;

            const recipients = [contract.corporateOwnerId, contract.fleetOwnerId].filter(Boolean);
            for (const recipient of recipients) {
                await createNotification({
                    userId: recipient,
                    type: "CONTRACT_EXPIRY_WARNING",
                    title: "Contract Expiring Soon",
                    message: `Contract ${contract.contractNumber || ""} expires in ${daysRemaining} day(s) on ${new Date(endDate).toLocaleDateString()}.`,
                    data: {
                        contractId: contract._id,
                        contractNumber: contract.contractNumber,
                        expiryDate: endDate,
                        daysRemaining,
                    },
                });
                warned++;
            }
        }

        console.log(`[v0] Contract expiry warnings sent: ${warned} (across ${expiringContracts.length} contract(s))`);
        return warned;
    } catch (error) {
        console.error("[v0] Error sending contract expiry warnings:", error);
        return 0;
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

// ---------------------------------------------------------------------------
// B2C Monthly Pass notifications
// These are imported by paymentController / b2cMonthlyPassController. If they
// are missing the server crashes on boot. Implemented against the
// B2CMonthlyPass model with real DB lookups.
// ---------------------------------------------------------------------------

// Load a pass with its route so we can build a descriptive message
const loadPassWithRoute = async (passId) => {
    const B2CMonthlyPass = (await import("../models/B2CMonthlyPass.js")).default;
    return B2CMonthlyPass.findById(passId).populate("routeId", "fromLocation toLocation");
};

const passRouteLabel = (pass) =>
    pass?.routeId?.fromLocation && pass?.routeId?.toLocation
        ? `${pass.routeId.fromLocation} to ${pass.routeId.toLocation}`
        : "your route";

// Pass booked (payment pending / just created)
export const sendPassBookedNotification = async (passId) => {
    try {
        const pass = await loadPassWithRoute(passId);
        if (!pass) return;

        const routeLabel = passRouteLabel(pass);
        const data = {
            passId: pass._id,
            routeId: pass.routeId?._id,
            startDate: pass.startDate,
            endDate: pass.endDate,
            amount: pass.totalAmount,
        };

        // Notify the passenger
        if (pass.passengerId) {
            await createNotification({
                userId: pass.passengerId,
                type: "SUBSCRIPTION_RENEWAL",
                title: "Monthly Pass Booked",
                message: `Your monthly pass for ${routeLabel} has been booked.`,
                data,
            });
        }
        // Notify the partner who owns the route
        if (pass.partnerId) {
            await createNotification({
                userId: pass.partnerId,
                type: "NEW_BOOKING",
                title: "New Monthly Pass Sold",
                message: `A passenger booked a monthly pass for ${routeLabel}.`,
                data,
            });
        }
    } catch (error) {
        console.error("[v0] Error sending pass booked notification:", error);
    }
};

// Pass activated (payment confirmed)
export const sendPassActivatedNotification = async (passId) => {
    try {
        const pass = await loadPassWithRoute(passId);
        if (!pass) return;

        const routeLabel = passRouteLabel(pass);
        if (pass.passengerId) {
            await createNotification({
                userId: pass.passengerId,
                type: "SUBSCRIPTION_RENEWAL",
                title: "Monthly Pass Activated",
                message: `Your monthly pass for ${routeLabel} is now active until ${pass.endDate ? new Date(pass.endDate).toLocaleDateString() : "the end date"}.`,
                data: {
                    passId: pass._id,
                    routeId: pass.routeId?._id,
                    startDate: pass.startDate,
                    endDate: pass.endDate,
                },
            });
        }
    } catch (error) {
        console.error("[v0] Error sending pass activated notification:", error);
    }
};

// Pass cancelled
export const sendPassCancelledNotification = async (passId, reason = "") => {
    try {
        const pass = await loadPassWithRoute(passId);
        if (!pass) return;

        const routeLabel = passRouteLabel(pass);
        const data = { passId: pass._id, routeId: pass.routeId?._id, reason };

        if (pass.passengerId) {
            await createNotification({
                userId: pass.passengerId,
                type: "BOOKING_CANCELLED",
                title: "Monthly Pass Cancelled",
                message: `Your monthly pass for ${routeLabel} has been cancelled${reason ? `: ${reason}` : "."}`,
                data,
            });
        }
        if (pass.partnerId) {
            await createNotification({
                userId: pass.partnerId,
                type: "BOOKING_CANCELLED",
                title: "Monthly Pass Cancelled",
                message: `A monthly pass for ${routeLabel} was cancelled${reason ? `: ${reason}` : "."}`,
                data,
            });
        }
    } catch (error) {
        console.error("[v0] Error sending pass cancelled notification:", error);
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
