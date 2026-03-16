import express from "express"
import { verifyToken } from "../middleware/auth.js"
import { getAllUsers, getCurrentUser, updateUserProfile, updateUserProfileLogo, changePassword } from "../controllers/userController.js"
import { upload, handleMulterError } from "../Config/multerConfig.js"

const router = express.Router()

// Get all users (requires authentication)
router.get("/all", verifyToken, getAllUsers)

// Get current user
router.get("/me", verifyToken, getCurrentUser)

// Profile routes (alias for /me with update support)
router.get("/profile", verifyToken, getCurrentUser)
router.put("/profile", verifyToken, updateUserProfile)

// Company logo upload route
router.put("/profile/logo", verifyToken, upload.single('companyLogo'), handleMulterError, updateUserProfileLogo)

// Change password
router.put("/change-password", verifyToken, changePassword)

export default router
