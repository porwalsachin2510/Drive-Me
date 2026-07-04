import User from "../models/User.js"
import { uploadToCloudinary } from "../Config/Cloudinary.js"
import { withOwnerPermissions } from "../Services/ownerService.js"

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password")

        res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            users,
            total: users.length,
        })
    } catch (error) {
        console.error("Get users error:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        res.status(200).json({
            success: true,
            message: "User retrieved successfully",
            // Force the real platform owner to always carry full super-admin
            // permissions + an isPrimaryOwner flag so the UI never locks them out.
            user: withOwnerPermissions(user.toJSON()),
        })
    } catch (error) {
        console.error("Get current user error:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

export const updateUserProfile = async (req, res) => {
    try {
        const userId = req.userId
        const allowedFields = [
            "fullName", "whatsappNumber", "companyName", "companyAddress",
            "serviceType", "yearsOfExperience", "serviceDescription",
            "address", "city", "country", "profileImage", "companyLogo",
            "website", "tradeLicense", "nationality",
            "contactPerson", "contactEmail", "contactPhone",
            "notifications", "driverInfo", "uiPreferences"
        ]

        const updateData = {}
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field]
            }
        }

        // Special handling for driverInfo - merge with existing data
        if (updateData.driverInfo) {
            const existingUser = await User.findById(userId)
            if (existingUser?.driverInfo) {
                updateData.driverInfo = {
                    ...existingUser.driverInfo.toObject ? existingUser.driverInfo.toObject() : existingUser.driverInfo,
                    ...updateData.driverInfo
                }
            }
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select("-password")

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user,
        })
    } catch (error) {
        console.error("Update profile error:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

export const updateUserProfileLogo = async (req, res) => {
    try {
        const userId = req.userId

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No logo file provided",
            })
        }

        console.log("[v0] Uploading company logo for user:", userId)

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(
            req.file,
            `driveme/company-logos/${userId}`,
            'companyLogo'
        )

        const logoUrl = uploadResult.secure_url

        // Update user with new logo URL
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { companyLogo: logoUrl } },
            { new: true }
        ).select("-password")

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        console.log("[v0] Company logo uploaded successfully:", logoUrl)

        res.status(200).json({
            success: true,
            message: "Logo uploaded successfully",
            logoUrl,
            user,
        })
    } catch (error) {
        console.error("[v0] Upload logo error:", error)
        res.status(500).json({
            success: false,
            message: "Failed to upload logo",
            error: error.message,
        })
    }
}

export const updateMenuLayout = async (req, res) => {
    try {
        const userId = req.userId
        const { menuLayout, sidebarCollapsed } = req.body

        // Validate menuLayout
        if (menuLayout && !["sidebar", "top"].includes(menuLayout)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu layout. Must be 'sidebar' or 'top'",
            })
        }

        const updateData = {}
        if (menuLayout !== undefined) {
            updateData["uiPreferences.menuLayout"] = menuLayout
        }
        if (sidebarCollapsed !== undefined) {
            updateData["uiPreferences.sidebarCollapsed"] = sidebarCollapsed
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }
        ).select("-password")

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        res.status(200).json({
            success: true,
            message: "Menu layout updated successfully",
            user,
            uiPreferences: user.uiPreferences,
        })
    } catch (error) {
        console.error("Update menu layout error:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

export const changePassword = async (req, res) => {
    try {
        const userId = req.userId
        const { currentPassword, newPassword } = req.body

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required",
            })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters",
            })
        }

        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        const isMatch = await user.comparePassword(currentPassword)
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect",
            })
        }

        user.password = newPassword
        await user.save()

        res.status(200).json({
            success: true,
            message: "Password changed successfully",
        })
    } catch (error) {
        console.error("Change password error:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}
