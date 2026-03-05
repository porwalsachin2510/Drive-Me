import User from "../models/User.js"
import Notification from "../models/Notification.js"

// Create notification helper function
export const createNotification = async (notificationData) => {
    try {
        const notification = new Notification(notificationData)
        await notification.save()

        // Populate related user data if relatedUserId exists
        if (notificationData.relatedUserId) {
            await notification.populate("relatedUserId", "fullName email phone")
        }

        // Populate booking data for both B2C and Corporate bookings
        if (notificationData.bookingId) {
            // Try to populate as B2CPassengerBooking first
            try {
                await notification.populate({
                    path: "bookingId",
                    model: "B2CPassengerBooking",
                    select: "pickupLocation dropoffLocation travelDate numberOfSeats"
                })
            } catch (error) {
                // If B2CPassengerBooking fails, try CorporateBooking
                try {
                    await notification.populate({
                        path: "bookingId",
                        model: "CorporateBooking",
                        select: "pickupLocation dropoffLocation travelDate numberOfSeats"
                    })
                } catch (corpError) {
                    console.log("Could not populate bookingId:", corpError.message)
                }
            }
        }

        if (notificationData.recipientId) {
            await notification.populate("recipientId", "fullName email phone")
        }

        return notification
    } catch (error) {
        console.error("Error creating notification:", error)
        throw error
    }
}

// Get user notifications
export const getUserNotifications = async (req, res) => {
    try {
        const { userId } = req.params
        const { page = 1, limit = 20 } = req.query

        const notifications = await Notification.find({
            $or: [
                { userId },
                { recipientId: userId }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate("recipientId", "fullName email phone")
            .populate("relatedUserId", "fullName email phone")
            .populate({
                path: "bookingId",
                model: "B2CPassengerBooking",
                select: "pickupLocation dropoffLocation travelDate numberOfSeats"
            })
            .populate({
                path: "bookingId",
                model: "CorporateBooking",
                select: "pickupLocation dropoffLocation travelDate numberOfSeats"
            })

        const total = await Notification.countDocuments({
            $or: [
                { userId },
                { recipientId: userId }
            ]
        })

        return res.status(200).json({
            success: true,
            data: {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        })
    } catch (error) {
        console.error("Error getting notifications:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching notifications"
        })
    }
}

// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params
        const { userId } = req.body

        const notification = await Notification.findOneAndUpdate(
            {
                _id: notificationId,
                $or: [
                    { userId },
                    { recipientId: userId }
                ]
            },
            {
                isRead: true,
                readAt: new Date()
            },
            { new: true }
        ).populate("relatedUserId", "fullName email phone")
            .populate({
                path: "bookingId",
                model: "B2CPassengerBooking",
                select: "pickupLocation dropoffLocation travelDate numberOfSeats"
            })
            .populate({
                path: "bookingId",
                model: "CorporateBooking",
                select: "pickupLocation dropoffLocation travelDate numberOfSeats"
            })

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: {
                notification
            }
        })
    } catch (error) {
        console.error("Error marking notification as read:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while marking notification as read"
        })
    }
}

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const { userId } = req.params

        await Notification.updateMany(
            {
                $or: [
                    { userId },
                    { recipientId: userId }
                ],
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        )

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read"
        })
    } catch (error) {
        console.error("Error marking all notifications as read:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while marking all notifications as read"
        })
    }
}

// Delete notification
export const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params
        const { userId } = req.body

        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            $or: [
                { userId },
                { recipientId: userId }
            ]
        })

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully",
            data: {
                notification
            }
        })
    } catch (error) {
        console.error("Error deleting notification:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while deleting notification"
        })
    }
}

// Get unread notification count
export const getUnreadNotificationCount = async (req, res) => {
    try {
        const { userId } = req.params

        const count = await Notification.countDocuments({
            $or: [
                { userId, isRead: false },
                { recipientId: userId, isRead: false }
            ]
        })

        return res.status(200).json({
            success: true,
            data: {
                unreadCount: count
            }
        })
    } catch (error) {
        console.error("Error getting unread notification count:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while getting unread notification count"
        })
    }
}

// Create booking notification
export const createBookingNotification = async (userId, type, message, relatedUserId = null, bookingId = null) => {
    try {
        const notificationData = {
            userId,
            type,
            message,
            relatedUserId,
            bookingId,
            isRead: false,
            createdAt: new Date()
        }

        return await createNotification(notificationData)
    } catch (error) {
        console.error("Error creating booking notification:", error)
        throw error
    }
}

// Create driver assignment notification
export const createDriverAssignmentNotification = async (driverId, bookingId, passengerName) => {
    try {
        const notificationData = {
            userId: driverId,
            type: "DRIVER_ASSIGNED",
            title: "New Assignment",
            message: `You have been assigned to a booking for ${passengerName}`,
            relatedUserId: passengerName,
            bookingId,
            isRead: false,
            createdAt: new Date()
        }

        return await createNotification(notificationData)
    } catch (error) {
        console.error("Error creating driver assignment notification:", error)
        throw error
    }
}

// Create booking status notification
export const createBookingStatusNotification = async (userId, bookingId, status, passengerName = null) => {
    try {
        const notificationData = {
            userId,
            type: status,
            title: `Booking ${status}`,
            message: `Your booking has been ${status.toLowerCase()}${passengerName ? ` for ${passengerName}` : ''}`,
            relatedUserId: passengerName,
            bookingId,
            isRead: false,
            createdAt: new Date()
        }

        return await createNotification(notificationData)
    } catch (error) {
        console.error("Error creating booking status notification:", error)
        throw error
    }
}

// Create corporate booking notification
export const createCorporateBookingNotification = async (corporateOwnerId, driverId, passengerId, bookingId) => {
    try {
        const notificationData = {
            userId: corporateOwnerId,
            type: "CORPORATE_BOOKING",
            title: "New Corporate Booking",
            message: `New corporate booking assigned to driver`,
            relatedUserId: driverId,
            bookingId,
            isRead: false,
            createdAt: new Date()
        }

        return await createNotification(notificationData)
    } catch (error) {
        console.error("Error creating corporate booking notification:", error)
        throw error
    }
}
