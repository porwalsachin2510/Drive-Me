import express from "express"
import { verifyToken } from "../middleware/auth.js"
import { getAllUsers, getCurrentUser, updateUserProfile, changePassword } from "../controllers/userController.js"

const router = express.Router()

// Get all users (requires authentication)
router.get("/all", verifyToken, getAllUsers)

// Get current user
router.get("/me", verifyToken, getCurrentUser)

// Profile routes (alias for /me with update support)
router.get("/profile", verifyToken, getCurrentUser)
router.put("/profile", verifyToken, updateUserProfile)

// Change password
router.put("/change-password", verifyToken, changePassword)

export default router
