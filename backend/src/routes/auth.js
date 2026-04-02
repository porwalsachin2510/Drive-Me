import express from "express"
import jwt from "jsonwebtoken"
import { register, login, adminLogin, logout, verifyOTP, resendOTP, setPassword, validatePasswordToken, forgotPassword, verifyResetOTP, resetPassword, getUserById } from "../controllers/authController.js"
import { verifyToken } from "../middleware/auth.js"
import { upload } from "../Config/multerConfig.js"

const router = express.Router()

const generateToken = (userId, role) => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE })
}

// Register
router.post(
    "/register",
    upload.fields([
        { name: "tradeLicense", maxCount: 1 },
        { name: "companyLogo", maxCount: 1 },
        { name: "profileImage", maxCount: 1 },
        // B2B Partner vehicle images - up to 10 vehicles
        { name: "fleetImages_0", maxCount: 5 },
        { name: "fleetImages_1", maxCount: 5 },
        { name: "fleetImages_2", maxCount: 5 },
        { name: "fleetImages_3", maxCount: 5 },
        { name: "fleetImages_4", maxCount: 5 },
        { name: "fleetImages_5", maxCount: 5 },
        { name: "fleetImages_6", maxCount: 5 },
        { name: "fleetImages_7", maxCount: 5 },
        { name: "fleetImages_8", maxCount: 5 },
        { name: "fleetImages_9", maxCount: 5 },
        // B2C Partner route images - up to 10 routes
        { name: "routeImages_0", maxCount: 5 },
        { name: "routeImages_1", maxCount: 5 },
        { name: "routeImages_2", maxCount: 5 },
        { name: "routeImages_3", maxCount: 5 },
        { name: "routeImages_4", maxCount: 5 },
        { name: "routeImages_5", maxCount: 5 },
        { name: "routeImages_6", maxCount: 5 },
        { name: "routeImages_7", maxCount: 5 },
        { name: "routeImages_8", maxCount: 5 },
        { name: "routeImages_9", maxCount: 5 },

        { name: "driverImage_0", maxCount: 1 },
        { name: "driverImage_1", maxCount: 1 },
    ]),
    register,
)

// Login
router.post("/login", login)

// Admin Login
router.post("/admin-login", adminLogin)

// Verify OTP
router.post("/verify-otp", verifyOTP)

// Resend OTP
router.post("/resend-otp", resendOTP)

// Logout
router.post("/logout", verifyToken, logout)

// Password setup for invited employees
router.get("/validate-password-token/:token", validatePasswordToken)
router.post("/set-password", setPassword)

// Forgot Password
router.post("/forgot-password", forgotPassword)
router.post("/verify-reset-otp", verifyResetOTP)
router.post("/reset-password", resetPassword)

// Get user by ID (for corporate driver dashboard to fetch corporate owner info)
router.get("/user/:id", verifyToken, getUserById)

export default router
