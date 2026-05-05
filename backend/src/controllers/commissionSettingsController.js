import CommissionSettings from "../models/CommissionSettings.js"
import User from "../models/User.js"
import Contract from "../models/Contract.js"
import AdminNegotiation from "../models/AdminNegotiation.js"
import { DEFAULT_COMMISSION_PERCENTAGE } from "../Services/HelperUtilities.js"

/**
 * Get all users with their commission settings
 * GET /api/commission/users-with-settings
 */
export const getUsersWithSettings = async (req, res) => {
    try {
        const { role, search, page = 1, limit = 50 } = req.query

        // Build user query
        const userQuery = {
            role: { $in: ["CORPORATE", "B2B_PARTNER", "B2C_PARTNER"] },
            status: "ACTIVE",
        }

        if (role && role !== "ALL") {
            userQuery.role = role
        }

        if (search) {
            const searchLower = search.toLowerCase()
            userQuery.$or = [
                { fullName: { $regex: searchLower, $options: "i" } },
                { email: { $regex: searchLower, $options: "i" } },
                { companyName: { $regex: searchLower, $options: "i" } },
            ]
        }

        // Get users
        const users = await User.find(userQuery)
            .select("_id fullName email companyName role status createdAt")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        // Get commission settings for these users
        const userIds = users.map((u) => u._id)
        const settings = await CommissionSettings.find({ userId: { $in: userIds } }).lean()
        const settingsMap = {}
        settings.forEach((s) => {
            settingsMap[s.userId.toString()] = s
        })

        // Combine users with their settings
        const usersWithSettings = users.map((user) => {
            const setting = settingsMap[user._id.toString()]
            return {
                ...user.toObject(),
                commissionSettings: setting || {
                    defaultCommissionRate: DEFAULT_COMMISSION_PERCENTAGE,
                    customRates: [],
                    negotiationCommissionRate: 25,
                },
            }
        })

        const total = await User.countDocuments(userQuery)

        res.json({
            success: true,
            users: usersWithSettings,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error("Error getting users with settings:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get users with settings",
            error: error.message,
        })
    }
}

/**
 * Get all commission settings for Admin
 * GET /api/admin/commission/settings
 */
export const getAllCommissionSettings = async (req, res) => {
    try {
        const { role, search, page = 1, limit = 20 } = req.query

        const query = {}
        if (role) {
            query.role = role
        }

        // Get settings with user details
        const settings = await CommissionSettings.find(query)
            .populate("userId", "fullName email companyName role status")
            .populate("setBy", "fullName email")
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        // If search is provided, filter by user name/email/company
        let filteredSettings = settings
        if (search) {
            const searchLower = search.toLowerCase()
            filteredSettings = settings.filter(
                (s) =>
                    s.userId?.fullName?.toLowerCase().includes(searchLower) ||
                    s.userId?.email?.toLowerCase().includes(searchLower) ||
                    s.userId?.companyName?.toLowerCase().includes(searchLower)
            )
        }

        const total = await CommissionSettings.countDocuments(query)

        // Get users without commission settings (to show defaults)
        const usersWithSettings = settings.map((s) => s.userId?._id?.toString())
        const usersWithoutSettings = await User.find({
            role: { $in: ["CORPORATE", "B2B_PARTNER", "B2C_PARTNER"] },
            _id: { $nin: usersWithSettings },
        })
            .select("fullName email companyName role status")
            .limit(50)

        res.json({
            success: true,
            data: {
                settings: filteredSettings,
                usersWithoutSettings: usersWithoutSettings.map((u) => ({
                    userId: u._id,
                    user: u,
                    role: u.role,
                    defaultCommissionRate: DEFAULT_COMMISSION_PERCENTAGE,
                    customRates: [],
                    isDefault: true,
                })),
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit),
                },
            },
        })
    } catch (error) {
        console.error("Error getting commission settings:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get commission settings",
            error: error.message,
        })
    }
}

/**
 * Get commission settings for a specific user
 * GET /api/admin/commission/settings/:userId
 */
export const getCommissionSettingsByUser = async (req, res) => {
    try {
        const { userId } = req.params

        let settings = await CommissionSettings.findOne({ userId })
            .populate("userId", "fullName email companyName role status")
            .populate("setBy", "fullName email")
            .populate("rateHistory.changedBy", "fullName email")

        if (!settings) {
            // Return default settings
            const user = await User.findById(userId).select("fullName email companyName role status")
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                })
            }

            settings = {
                userId: user,
                role: user.role,
                defaultCommissionRate: DEFAULT_COMMISSION_PERCENTAGE,
                customRates: [],
                negotiationCommissionRate: 25,
                isDefault: true,
                rateHistory: [],
            }
        }

        res.json({
            success: true,
            settings,
        })
    } catch (error) {
        console.error("Error getting user commission settings:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get user commission settings",
            error: error.message,
        })
    }
}

/**
 * Create commission settings for a user
 * POST /api/admin/commission/settings
 */
export const createCommissionSettings = async (req, res) => {
    try {
        const { userId, defaultCommissionRate, customRates, negotiationCommissionRate, notes } = req.body

        // Validate user exists
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        // Check if settings already exist
        const existingSettings = await CommissionSettings.findOne({ userId })
        if (existingSettings) {
            return res.status(400).json({
                success: false,
                message: "Commission settings already exist for this user. Use update instead.",
            })
        }

        // Validate commission rates are within range (allow up to 100% for custom rates)
        if (defaultCommissionRate < 0 || defaultCommissionRate > 100) {
            return res.status(400).json({
                success: false,
                message: "Commission rate must be between 0 and 100%",
            })
        }

        const settings = new CommissionSettings({
            userId,
            role: user.role,
            defaultCommissionRate: defaultCommissionRate ?? DEFAULT_COMMISSION_PERCENTAGE,
            customRates: customRates || [],
            negotiationCommissionRate: negotiationCommissionRate ?? 25,
            setBy: req.userId,
            notes,
            rateHistory: [
                {
                    previousRate: DEFAULT_COMMISSION_PERCENTAGE,
                    newRate: defaultCommissionRate ?? DEFAULT_COMMISSION_PERCENTAGE,
                    rateType: "default",
                    changedBy: req.userId,
                    changedAt: new Date(),
                    reason: "Initial commission settings created",
                },
            ],
        })

        await settings.save()

        const populatedSettings = await CommissionSettings.findById(settings._id)
            .populate("userId", "fullName email companyName role status")
            .populate("setBy", "fullName email")

        res.status(201).json({
            success: true,
            message: "Commission settings created successfully",
            data: populatedSettings,
        })
    } catch (error) {
        console.error("Error creating commission settings:", error)
        res.status(500).json({
            success: false,
            message: "Failed to create commission settings",
            error: error.message,
        })
    }
}

/**
 * Update commission settings for a user
 * PUT /api/admin/commission/settings/:userId
 */
export const updateCommissionSettings = async (req, res) => {
    try {
        const { userId } = req.params
        const { defaultCommissionRate, customRates, negotiationCommissionRate, emiCommissionSettings, notes, reason } = req.body

        // Validate commission rates (allow up to 100% for custom EMI rates)
        if (defaultCommissionRate !== undefined && (defaultCommissionRate < 0 || defaultCommissionRate > 100)) {
            return res.status(400).json({
                success: false,
                message: "Commission rate must be between 0 and 100%",
            })
        }

        let settings = await CommissionSettings.findOne({ userId })

        if (!settings) {
            // Create new settings if doesn't exist
            const user = await User.findById(userId)
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                })
            }

            settings = new CommissionSettings({
                userId,
                role: user.role,
                defaultCommissionRate: defaultCommissionRate ?? DEFAULT_COMMISSION_PERCENTAGE,
                customRates: customRates || [],
                negotiationCommissionRate: negotiationCommissionRate ?? 25,
                setBy: req.userId,
                notes,
                rateHistory: [
                    {
                        previousRate: DEFAULT_COMMISSION_PERCENTAGE,
                        newRate: defaultCommissionRate ?? DEFAULT_COMMISSION_PERCENTAGE,
                        rateType: "default",
                        changedBy: req.userId,
                        changedAt: new Date(),
                        reason: reason || "Initial commission settings created",
                    },
                ],
            })

            await settings.save()
        } else {
            // Track rate changes
            if (defaultCommissionRate !== undefined && defaultCommissionRate !== settings.defaultCommissionRate) {
                settings.rateHistory.push({
                    previousRate: settings.defaultCommissionRate,
                    newRate: defaultCommissionRate,
                    rateType: "default",
                    changedBy: req.userId,
                    changedAt: new Date(),
                    reason: reason || "Commission rate updated by admin",
                })
                settings.defaultCommissionRate = defaultCommissionRate
            }

            if (customRates !== undefined) {
                settings.customRates = customRates
            }

            if (negotiationCommissionRate !== undefined) {
                if (negotiationCommissionRate !== settings.negotiationCommissionRate) {
                    settings.rateHistory.push({
                        previousRate: settings.negotiationCommissionRate,
                        newRate: negotiationCommissionRate,
                        rateType: "negotiation",
                        changedBy: req.userId,
                        changedAt: new Date(),
                        reason: reason || "Negotiation commission rate updated",
                    })
                }
                settings.negotiationCommissionRate = negotiationCommissionRate
            }

            // Update EMI commission settings
            if (emiCommissionSettings !== undefined) {
                const oldEmiSettings = settings.emiCommissionSettings || {}
                const newEmiSettings = {
                    emiCommissionRate: emiCommissionSettings.emiCommissionRate ?? oldEmiSettings.emiCommissionRate ?? 20,
                    lateFeeCommissionRate: emiCommissionSettings.lateFeeCommissionRate ?? oldEmiSettings.lateFeeCommissionRate ?? 0,
                    lateFeePercentage: emiCommissionSettings.lateFeePercentage ?? oldEmiSettings.lateFeePercentage ?? 2,
                    gracePeriodDays: emiCommissionSettings.gracePeriodDays ?? oldEmiSettings.gracePeriodDays ?? 0,
                    overdueWarningThreshold: emiCommissionSettings.overdueWarningThreshold ?? oldEmiSettings.overdueWarningThreshold ?? 2,
                    suspensionThreshold: emiCommissionSettings.suspensionThreshold ?? oldEmiSettings.suspensionThreshold ?? 3,
                }

                // Track EMI commission rate changes
                if (newEmiSettings.emiCommissionRate !== (oldEmiSettings.emiCommissionRate || 20)) {
                    settings.rateHistory.push({
                        previousRate: oldEmiSettings.emiCommissionRate || 20,
                        newRate: newEmiSettings.emiCommissionRate,
                        rateType: "emi",
                        changedBy: req.userId,
                        changedAt: new Date(),
                        reason: reason || "EMI commission rate updated",
                    })
                }

                settings.emiCommissionSettings = newEmiSettings
            }
            
            if (notes !== undefined) {
                settings.notes = notes
            }

            settings.setBy = req.userId
            await settings.save()
        }

        const populatedSettings = await CommissionSettings.findById(settings._id)
            .populate("userId", "fullName email companyName role status")
            .populate("setBy", "fullName email")
            .populate("rateHistory.changedBy", "fullName email")

        res.json({
            success: true,
            message: "Commission settings updated successfully",
            data: populatedSettings,
        })
    } catch (error) {
        console.error("Error updating commission settings:", error)
        res.status(500).json({
            success: false,
            message: "Failed to update commission settings",
            error: error.message,
        })
    }
}

/**
 * Get all contracts with commission details
 * GET /api/admin/commission/contracts
 */
export const getContractsWithCommission = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query

        const query = {}
        if (status) {
            query.status = status
        }

        const contracts = await Contract.find(query)
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("quotationId", "quotedPrice quotationNumber adminNegotiation")
            .populate("adminCommission.negotiationId")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        const total = await Contract.countDocuments(query)

        // Calculate total commissions
        const allContracts = await Contract.find({})
        const totalB2BCommission = allContracts.reduce(
            (sum, c) => sum + (c.adminCommission?.b2bPartner?.amount || 0),
            0
        )
        const totalCorporateCommission = allContracts.reduce(
            (sum, c) => sum + (c.adminCommission?.corporate?.amount || 0),
            0
        )
        const pendingB2BCommission = allContracts
            .filter((c) => c.adminCommission?.b2bPartner?.status === "PENDING")
            .reduce((sum, c) => sum + (c.adminCommission?.b2bPartner?.amount || 0), 0)
        const pendingCorporateCommission = allContracts
            .filter((c) => c.adminCommission?.corporate?.status === "PENDING")
            .reduce((sum, c) => sum + (c.adminCommission?.corporate?.amount || 0), 0)

        res.json({
            success: true,
            data: {
                contracts,
                summary: {
                    totalB2BCommission,
                    totalCorporateCommission,
                    totalCommission: totalB2BCommission + totalCorporateCommission,
                    pendingB2BCommission,
                    pendingCorporateCommission,
                    pendingTotal: pendingB2BCommission + pendingCorporateCommission,
                },
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit),
                },
            },
        })
    } catch (error) {
        console.error("Error getting contracts with commission:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get contracts with commission",
            error: error.message,
        })
    }
}

/**
 * Get commission summary/dashboard
 * GET /api/admin/commission/summary
 */
export const getCommissionSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query

        const dateFilter = {}
        if (startDate) dateFilter.$gte = new Date(startDate)
        if (endDate) dateFilter.$lte = new Date(endDate)

        // Get all commission settings
        const settingsCount = await CommissionSettings.countDocuments()
        const settingsByRole = await CommissionSettings.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 }, avgRate: { $avg: "$defaultCommissionRate" } } },
        ])

        // Get contract commission stats
        const contractQuery = {}
        if (Object.keys(dateFilter).length > 0) {
            contractQuery.createdAt = dateFilter
        }

        const contracts = await Contract.find(contractQuery)
        const totalContractValue = contracts.reduce((sum, c) => sum + (c.financials?.totalAmount || 0), 0)
        const totalB2BCommission = contracts.reduce(
            (sum, c) => sum + (c.adminCommission?.b2bPartner?.amount || 0),
            0
        )
        const totalCorporateCommission = contracts.reduce(
            (sum, c) => sum + (c.adminCommission?.corporate?.amount || 0),
            0
        )

        // Get negotiation stats
        const negotiations = await AdminNegotiation.find(
            Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
        )
        const successfulNegotiations = negotiations.filter((n) => n.status === "COMPLETED")
        const totalSavings = successfulNegotiations.reduce((sum, n) => sum + (n.priceSaved || 0), 0)
        const negotiationCommission = successfulNegotiations.reduce(
            (sum, n) => sum + (n.adminCommissionFromCorporate?.amount || 0),
            0
        )

        // Commission by status
        const commissionByStatus = {
            b2bPartner: {
                pending: contracts
                    .filter((c) => c.adminCommission?.b2bPartner?.status === "PENDING")
                    .reduce((sum, c) => sum + (c.adminCommission?.b2bPartner?.amount || 0), 0),
                paid: contracts
                    .filter((c) => c.adminCommission?.b2bPartner?.status === "PAID")
                    .reduce((sum, c) => sum + (c.adminCommission?.b2bPartner?.amount || 0), 0),
                waived: contracts
                    .filter((c) => c.adminCommission?.b2bPartner?.status === "WAIVED")
                    .reduce((sum, c) => sum + (c.adminCommission?.b2bPartner?.amount || 0), 0),
            },
            corporate: {
                pending: contracts
                    .filter((c) => c.adminCommission?.corporate?.status === "PENDING")
                    .reduce((sum, c) => sum + (c.adminCommission?.corporate?.amount || 0), 0),
                paid: contracts
                    .filter((c) => c.adminCommission?.corporate?.status === "PAID")
                    .reduce((sum, c) => sum + (c.adminCommission?.corporate?.amount || 0), 0),
                waived: contracts
                    .filter((c) => c.adminCommission?.corporate?.status === "WAIVED")
                    .reduce((sum, c) => sum + (c.adminCommission?.corporate?.amount || 0), 0),
            },
        }

        res.json({
            success: true,
            data: {
                overview: {
                    totalSettingsConfigured: settingsCount,
                    settingsByRole,
                    defaultCommissionRate: DEFAULT_COMMISSION_PERCENTAGE,
                },
                contracts: {
                    totalContracts: contracts.length,
                    totalContractValue,
                    totalB2BCommission,
                    totalCorporateCommission,
                    totalCommission: totalB2BCommission + totalCorporateCommission,
                    commissionByStatus,
                },
                negotiations: {
                    totalNegotiations: negotiations.length,
                    successfulNegotiations: successfulNegotiations.length,
                    failedNegotiations: negotiations.filter((n) => n.status === "FAILED").length,
                    inProgressNegotiations: negotiations.filter((n) => n.status === "IN_PROGRESS").length,
                    totalSavingsGenerated: totalSavings,
                    commissionFromNegotiations: negotiationCommission,
                },
            },
        })
    } catch (error) {
        console.error("Error getting commission summary:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get commission summary",
            error: error.message,
        })
    }
}

/**
 * Delete commission settings (revert to default)
 * DELETE /api/admin/commission/settings/:userId
 */
export const deleteCommissionSettings = async (req, res) => {
    try {
        const { userId } = req.params

        const settings = await CommissionSettings.findOneAndDelete({ userId })

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: "Commission settings not found for this user",
            })
        }

        res.json({
            success: true,
            message: "Commission settings deleted. User will now use default rates.",
        })
    } catch (error) {
        console.error("Error deleting commission settings:", error)
        res.status(500).json({
            success: false,
            message: "Failed to delete commission settings",
            error: error.message,
        })
    }
}

/**
 * Bulk update commission settings for multiple users
 * POST /api/admin/commission/settings/bulk
 */
export const bulkUpdateCommissionSettings = async (req, res) => {
    try {
        const { userIds, defaultCommissionRate, reason } = req.body

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "User IDs array is required",
            })
        }

        if (defaultCommissionRate < 0 || defaultCommissionRate > 35) {
            return res.status(400).json({
                success: false,
                message: "Commission rate must be between 0 and 35%",
            })
        }

        const results = {
            updated: 0,
            created: 0,
            errors: [],
        }

        for (const userId of userIds) {
            try {
                let settings = await CommissionSettings.findOne({ userId })

                if (settings) {
                    settings.rateHistory.push({
                        previousRate: settings.defaultCommissionRate,
                        newRate: defaultCommissionRate,
                        rateType: "default",
                        changedBy: req.userId,
                        changedAt: new Date(),
                        reason: reason || "Bulk commission rate update",
                    })
                    settings.defaultCommissionRate = defaultCommissionRate
                    settings.setBy = req.userId
                    await settings.save()
                    results.updated++
                } else {
                    const user = await User.findById(userId)
                    if (user) {
                        const newSettings = new CommissionSettings({
                            userId,
                            role: user.role,
                            defaultCommissionRate,
                            setBy: req.userId,
                            rateHistory: [
                                {
                                    previousRate: DEFAULT_COMMISSION_PERCENTAGE,
                                    newRate: defaultCommissionRate,
                                    rateType: "default",
                                    changedBy: req.userId,
                                    changedAt: new Date(),
                                    reason: reason || "Bulk commission settings created",
                                },
                            ],
                        })
                        await newSettings.save()
                        results.created++
                    }
                }
            } catch (err) {
                results.errors.push({ userId, error: err.message })
            }
        }

        res.json({
            success: true,
            message: `Bulk update completed: ${results.updated} updated, ${results.created} created`,
            data: results,
        })
    } catch (error) {
        console.error("Error in bulk update:", error)
        res.status(500).json({
            success: false,
            message: "Failed to bulk update commission settings",
            error: error.message,
        })
    }
}
