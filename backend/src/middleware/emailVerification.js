import User from "../models/User.js"

export const requireEmailVerification = async (req, res, next) => {
    try {
        // Skip email verification check for login and OTP endpoints
        const publicRoutes = ['/auth/login', '/auth/register', '/auth/verify-otp', '/auth/resend-otp']
        if (publicRoutes.some(route => req.path.includes(route))) {
            return next()
        }

        // For authenticated routes, check if user's email is verified
        if (req.user && !req.user.isEmailVerified) {
            return res.status(403).json({
                success: false,
                message: "Email verification required. Please verify your email to access this feature.",
                requiresVerification: true
            })
        }

        next()
    } catch (error) {
        console.error("Email verification middleware error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}

export const checkEmailVerificationStatus = async (req, res, next) => {
    try {
        if (req.user) {
            req.user.isEmailVerified = req.user.isEmailVerified || false
        }
        next()
    } catch (error) {
        console.error("Check email verification status error:", error)
        next()
    }
}
