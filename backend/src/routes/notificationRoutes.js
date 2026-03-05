import express from "express"
import { verifyToken } from "../middleware/auth.js"
import {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    getUnreadNotificationCount
} from "../controllers/notificationController.js"

const router = express.Router()

// Get user notifications
router.get("/user/:userId", verifyToken, getUserNotifications)

// Mark notification as read
router.patch("/:notificationId/read", verifyToken, markNotificationAsRead)

// Mark all notifications as read for user
router.patch("/user/:userId/read-all", verifyToken, markAllNotificationsAsRead)

// Delete notification
router.delete("/:notificationId", verifyToken, deleteNotification)

// Get unread notification count
router.get("/user/:userId/unread-count", verifyToken, getUnreadNotificationCount)

export default router
