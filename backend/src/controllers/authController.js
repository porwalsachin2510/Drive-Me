import User from "../models/User.js"
import OTP from "../models/OTP.js"
import jwt from "jsonwebtoken"
import { uploadToCloudinary } from "../Config/Cloudinary.js"
import { generateOTP, sendVerificationOTP } from "../Services/emailService.js"

const generateToken = (userId, role) => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE })
}

export const register = async (req, res) => {
    try {
        const {
            role,
            fullName,
            email,
            whatsappNumber,
            password,
            companyName,
            companyAddress,
            routeListings,
            fleetManagement,
            acceptedPaymentMethods,
            serviceType,
            yearsOfExperience,
            serviceDescription,
        } = req.body

        console.log("[v1] Register request:", { role, fullName, email })

        // Validation
        if (!role || !fullName || !email || !whatsappNumber || !password) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            })
        }

        const validRoles = ["COMMUTER", "CORPORATE", "B2C_PARTNER", "B2B_PARTNER", "CORPORATE_EMPLOYEE"]
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role",
            })
        }

        // Additional validation for CORPORATE_EMPLOYEE
        if (role === "CORPORATE_EMPLOYEE" && (!companyName || companyName.trim() === "")) {
            return res.status(400).json({
                success: false,
                message: "Company name is required for corporate employee registration.",
            })
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered",
            })
        }

        // Generate OTP
        const otp = generateOTP()
        
        // Save OTP to database
        await OTP.deleteMany({ email, purpose: "registration" }) // Clean up any existing OTPs
        const otpRecord = new OTP({
            email,
            otp,
            purpose: "registration"
        })
        await otpRecord.save()

        // Send OTP email
        const emailResult = await sendVerificationOTP(email, fullName, otp)
        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send verification email. Please try again.",
            })
        }

        // Handle profile image upload for COMMUTER, B2C_PARTNER, and B2B_PARTNER
        let profileImageUrl = null;
        if (req.files && req.files.profileImage && req.files.profileImage[0]) {
            try {
                const uploadResult = await uploadToCloudinary(req.files.profileImage[0], 'driveme/profiles', 'profile');
                profileImageUrl = uploadResult.secure_url;
                console.log("[v1] Profile image uploaded:", profileImageUrl);
            } catch (uploadError) {
                console.error("[v1] Error uploading profile image:", uploadError);
            }
        }

        // Store registration data temporarily (you could use Redis or session)
        // For now, we'll store it in the OTP document as metadata
        const registrationData = {
            role,
            fullName,
            email,
            whatsappNumber,
            password, // Plain password - User model pre-save hook will hash it
            companyName,
            companyAddress,
            routeListings,
            fleetManagement,
            acceptedPaymentMethods,
            serviceType,
            yearsOfExperience,
            serviceDescription,
            profileImage: profileImageUrl,
        }

        // Store registration data in OTP document (in production, use Redis)
        otpRecord.registrationData = registrationData
        await otpRecord.save()

        console.log("[v1] OTP sent for email verification:", { email, role })

        res.status(200).json({
            success: true,
            message: "Registration initiated! Please check your email for verification code.",
            requiresVerification: true,
            email: email,
        })
    } catch (error) {
        console.error("[v1] Register error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Registration failed",
        })
    }
}

export const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            })
        }

        const user = await User.findOne({ email })

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            })
        }

        // Verify user is an ADMIN
        if (user.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin credentials required.",
            })
        }

        const isPasswordValid = await user.comparePassword(password)

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            })
        }

        // Update lastLogin timestamp
        user.lastLogin = new Date()
        await user.save()

        const token = generateToken(user._id, user.role)

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(200).json({
            success: true,
            message: "Admin login successful",
            token,
            user: user.toJSON(),
        })
    } catch (error) {
        console.error("Admin login error:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body

        console.log("request body", req.body);

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            })
        }

        const user = await User.findOne({ email })

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            })
        }

        const isPasswordValid = await user.comparePassword(password);

        console.log("isPasswordValid", isPasswordValid)

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid Password credentials",
            })
        }

        // Update lastLogin timestamp
        user.lastLogin = new Date()
        await user.save()
        
        const token = generateToken(user._id, user.role)

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: user.toJSON(),
        })
    } catch (error) {
        console.error("Login error:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            })
        }

        // Find valid OTP record
        const otpRecord = await OTP.findOne({
            email: email.toLowerCase(),
            purpose: "registration",
            isUsed: false,
            expiresAt: { $gt: new Date() }
        })

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification code",
            })
        }

        // Verify OTP
        const isValid = otpRecord.verify(otp)
        if (!isValid) {
            await otpRecord.save() // Save the incremented attempt count
            
            if (otpRecord.attempts >= otpRecord.maxAttempts) {
                return res.status(400).json({
                    success: false,
                    message: "Maximum attempts reached. Please request a new verification code.",
                })
            }
            
            return res.status(400).json({
                success: false,
                message: `Invalid verification code. ${otpRecord.maxAttempts - otpRecord.attempts} attempts remaining.`,
            })
        }

        // Mark OTP as used
        await otpRecord.save()

        // Get registration data
        const registrationData = otpRecord.registrationData
        if (!registrationData) {
            return res.status(400).json({
                success: false,
                message: "Registration session expired. Please register again.",
            })
        }

        // Create user with verified email
        const userData = {
            ...registrationData,
            isEmailVerified: true,
        }

        // Handle role-specific data processing
        if (userData.role === "COMMUTER") {
            const matchingCorporateUser = await User.findOne({
                role: "CORPORATE",
                companyName: { $regex: new RegExp(`^${userData.fullName.trim()}$`, "i") },
            })
                .select("companyName")
                .lean()
                .exec()

            if (matchingCorporateUser) {
                userData.companyName = matchingCorporateUser.companyName
                userData.companyId = matchingCorporateUser._id
            } else {
                userData.companyName = null
            }
        }

        if (userData.role === "CORPORATE_EMPLOYEE") {
            // Check if companyName exists and is not empty
            if (!userData.companyName || userData.companyName.trim() === "") {
                return res.status(400).json({
                    success: false,
                    message: "Company name is required for corporate employee registration.",
                })
            }

            const matchingCorporateUser = await User.findOne({
                role: "CORPORATE",
                companyName: { $regex: new RegExp(`^${userData.companyName.trim()}$`, "i") },
            })
                .select("companyName")
                .lean()
                .exec()

            if (!matchingCorporateUser) {
                return res.status(400).json({
                    success: false,
                    message: "Company not found. Please contact your corporate admin.",
                })
            }

            userData.companyName = matchingCorporateUser.companyName
            userData.companyId = matchingCorporateUser._id
        }

        if (userData.role === "B2C_PARTNER") {
            userData.serviceType = userData.serviceType || null
            userData.yearsOfExperience = userData.yearsOfExperience ? Number.parseInt(userData.yearsOfExperience) : null
            userData.serviceDescription = userData.serviceDescription || null

            const parsedRoutes = JSON.parse(userData.routeListings || "[]")
            const processedRoutes = []

            for (let i = 0; i < parsedRoutes.length; i++) {
                const route = parsedRoutes[i]
                const routeData = {
                    fromLocation: route.fromLocation,
                    toLocation: route.toLocation,
                    stops: route.stopPoints || [],
                    inboundStart: route.inboundStart,
                    routeStartDate: route.routeStartDate,
                    oneWayPrice: Number.parseFloat(route.oneWayPrice),
                    roundTripPrice: Number.parseFloat(route.roundTripPrice),
                    monthlyPrice: Number(route.monthlyPrice),
                    totalSeats: Number.parseInt(route.totalSeats),
                    availableSeats: Number.parseInt(route.availableSeats),
                    availableDays: route.availableDays,
                    driverName: route.driverName,
                    nationality: route.nationality,
                    licenseNumber: route.licenseNumber,
                    experience: Number.parseInt(route.experience),
                    vehicleModel: route.vehicleModel,
                    vehiclePlate: route.vehiclePlate,
                    images: [],
                }
                processedRoutes.push(routeData)
            }

            userData.routeListings = processedRoutes
            userData.acceptedPaymentMethods = JSON.parse(userData.acceptedPaymentMethods || "[]")
        }

        if (userData.role === "B2B_PARTNER") {
            userData.fleetManagement = []
            userData.acceptedPaymentMethods = JSON.parse(userData.acceptedPaymentMethods || "[]")
        }

        // Create user
        const newUser = new User(userData)
        await newUser.save()

        console.log("[v1] User created and verified successfully:", newUser._id)

        // Generate token
        const token = generateToken(newUser._id, newUser.role)

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(201).json({
            success: true,
            message: "Email verified and registration completed successfully!",
            token,
            user: {
                _id: newUser._id,
                role: newUser.role,
                fullName: newUser.fullName,
                email: newUser.email,
                whatsappNumber: newUser.whatsappNumber,
                isEmailVerified: newUser.isEmailVerified,
            },
        })
    } catch (error) {
        console.error("[v1] OTP verification error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Verification failed",
        })
    }
}

export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            })
        }

        // Check if there's a pending registration
        const existingOTP = await OTP.findOne({
            email: email.toLowerCase(),
            purpose: "registration",
            isUsed: false,
            expiresAt: { $gt: new Date() }
        }).populate('registrationData')

        if (!existingOTP || !existingOTP.registrationData) {
            return res.status(400).json({
                success: false,
                message: "No pending registration found. Please register again.",
            })
        }

        // Generate new OTP
        const newOTP = generateOTP()
        
        // Update existing record
        existingOTP.otp = newOTP
        existingOTP.attempts = 0
        existingOTP.expiresAt = new Date(Date.now() + 10 * 60 * 1000) // Reset expiry
        await existingOTP.save()

        // Send new OTP email
        const emailResult = await sendVerificationOTP(
            email, 
            existingOTP.registrationData.fullName, 
            newOTP
        )

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send verification email. Please try again.",
            })
        }

        console.log("[v1] OTP resent for email verification:", { email })

        res.status(200).json({
            success: true,
            message: "New verification code sent to your email",
        })
    } catch (error) {
        console.error("[v1] Resend OTP error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to resend verification code",
        })
    }
}

export const validatePasswordToken = async (req, res) => {
    try {
        const { token } = req.params

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Token is required",
            })
        }

        const user = await User.findOne({
            passwordSetupToken: token,
            passwordSetupTokenExpiry: { $gt: new Date() }
        })

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired token. Please contact your corporate admin for a new invitation.",
            })
        }

        res.status(200).json({
            success: true,
            message: "Token is valid",
            data: {
                email: user.email,
                fullName: user.fullName,
            }
        })
    } catch (error) {
        console.error("Validate password token error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Token validation failed",
        })
    }
}

export const setPassword = async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body

        if (!token || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Token, password, and confirm password are required",
            })
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match",
            })
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long",
            })
        }

        const user = await User.findOne({
            passwordSetupToken: token,
            passwordSetupTokenExpiry: { $gt: new Date() }
        })

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired token. Please contact your corporate admin for a new invitation.",
            })
        }

        // Update user password and clear the token
        user.password = password // Will be hashed by pre-save hook
        user.passwordSetupToken = null
        user.passwordSetupTokenExpiry = null
        user.isPasswordSet = true
        user.isEmailVerified = true
        await user.save()

        // Generate login token
        const loginToken = generateToken(user._id, user.role)

        res.cookie("token", loginToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(200).json({
            success: true,
            message: "Password set successfully! You can now login.",
            token: loginToken,
            user: user.toJSON(),
        })
    } catch (error) {
        console.error("Set password error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to set password",
        })
    }
}

export const logout = (req, res) => {
    try {
        // The verifyToken middleware ensures this, so we can proceed safely
        const userId = req.userId // Set by verifyToken middleware

        // Clear the authentication cookie
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        })

        // Clear any other session-related cookies if they exist
        res.clearCookie("session", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        })

        res.status(200).json({
            success: true,
            message: "Logout successful",
            userId, // Confirm which user logged out
        })
    } catch (error) {
        console.error("Logout error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Logout failed",
        })
    }
}

// Forgot Password - Send OTP
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            })
        }

        // Check if user exists
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this email address",
            })
        }

        // Generate OTP
        const otp = generateOTP()

        // Save OTP to database
        await OTP.deleteMany({ email, purpose: "password_reset" })
        const otpRecord = new OTP({
            email,
            otp,
            purpose: "password_reset",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        })
        await otpRecord.save()

        // Send OTP email
        const emailResult = await sendVerificationOTP(email, user.fullName, otp)
        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP. Please try again.",
            })
        }

        res.status(200).json({
            success: true,
            message: "OTP sent to your email address",
        })
    } catch (error) {
        console.error("Forgot password error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to process request",
        })
    }
}

// Verify Reset OTP
export const verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            })
        }

        // Find OTP record
        const otpRecord = await OTP.findOne({
            email,
            otp,
            purpose: "password_reset",
            expiresAt: { $gt: new Date() }
        })

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP",
            })
        }

        // Generate a temporary reset token
        const resetToken = jwt.sign(
            { email, purpose: "password_reset" },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        )

        // Mark OTP as verified but don't delete yet
        otpRecord.isVerified = true
        await otpRecord.save()

        res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            resetToken,
        })
    } catch (error) {
        console.error("Verify reset OTP error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to verify OTP",
        })
    }
}

// Reset Password
export const resetPassword = async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body

        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email, reset token, and new password are required",
            })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long",
            })
        }

        // Verify the reset token
        let decoded
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET)
        } catch (tokenError) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token. Please request a new OTP.",
            })
        }

        if (decoded.email !== email || decoded.purpose !== "password_reset") {
            return res.status(400).json({
                success: false,
                message: "Invalid reset token",
            })
        }

        // Find user
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        // Update password
        user.password = newPassword // Will be hashed by pre-save hook
        await user.save()

        // Delete all OTPs for this email
        await OTP.deleteMany({ email, purpose: "password_reset" })

        res.status(200).json({
            success: true,
            message: "Password reset successful",
        })
    } catch (error) {
        console.error("Reset password error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to reset password",
        })
    }
}

// Get user by ID
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params

        const user = await User.findById(id).select('-password -otp')

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        res.status(200).json({
            success: true,
            user: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                companyName: user.companyName,
                companyLogo: user.companyLogo,
                phone: user.whatsappNumber || user.phone,
                profileImage: user.profileImage,
            }
        })
    } catch (error) {
        console.error("Get user by ID error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get user",
        })
    }
}
