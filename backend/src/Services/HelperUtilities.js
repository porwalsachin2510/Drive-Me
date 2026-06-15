import CommissionSettings from "../models/CommissionSettings.js"

// Default commission percentage (fallback if no settings found)
export const DEFAULT_COMMISSION_PERCENTAGE = 20

// Legacy static commission (kept for backward compatibility)
export const ADMIN_COMMISSION_PERCENTAGE = 20

// Legacy function (kept for backward compatibility)
export const calculateCommission = (amount) => {
    const commission = (amount * ADMIN_COMMISSION_PERCENTAGE) / 100
    const fleetOwnerAmount = amount - commission
    return {
        totalAmount: amount,
        adminCommission: commission,
        fleetOwnerAmount: fleetOwnerAmount,
    }
}

// Legacy function (kept for backward compatibility)
export const calculateDriverCommission = (amount) => {
    const commission = (amount * ADMIN_COMMISSION_PERCENTAGE) / 100
    const driverEarnings = amount - commission
    return {
        totalAmount: amount,
        adminCommission: commission,
        driverEarnings: driverEarnings,
    }
}

/**
 * Calculate dynamic commission based on user's commission settings
 * @param {string} userId - The user ID to calculate commission for
 * @param {number} amount - The total amount
 * @param {string} rateType - Type of rate: CONTRACT, BOOKING, MONTHLY_PASS, NEGOTIATION
 * @returns {Promise<Object>} Commission calculation result
 */
export const calculateDynamicCommission = async (userId, amount, rateType = null) => {
    try {
        const settings = await CommissionSettings.findOne({ userId, isActive: true })

        let rate = DEFAULT_COMMISSION_PERCENTAGE // Default fallback

        if (settings) {
            // Check for custom rate for specific type
            if (rateType && settings.customRates?.length > 0) {
                const now = new Date()
                const customRate = settings.customRates.find(
                    (r) =>
                        r.rateType === rateType &&
                        r.effectiveFrom <= now &&
                        (!r.effectiveUntil || r.effectiveUntil >= now)
                )
                if (customRate) {
                    rate = customRate.rate
                } else {
                    rate = settings.defaultCommissionRate
                }
            } else {
                rate = settings.defaultCommissionRate
            }
        }

        const commission = (amount * rate) / 100
        const partnerAmount = amount - commission

        return {
            totalAmount: amount,
            adminCommission: commission,
            partnerAmount: partnerAmount,
            fleetOwnerAmount: partnerAmount, // Alias for backward compatibility
            driverEarnings: partnerAmount, // Alias for backward compatibility
            appliedRate: rate,
        }
    } catch (error) {
        console.error("Error calculating dynamic commission:", error)
        // Fallback to default calculation
        const commission = (amount * DEFAULT_COMMISSION_PERCENTAGE) / 100
        return {
            totalAmount: amount,
            adminCommission: commission,
            partnerAmount: amount - commission,
            fleetOwnerAmount: amount - commission,
            driverEarnings: amount - commission,
            appliedRate: DEFAULT_COMMISSION_PERCENTAGE,
        }
    }
}

/**
 * Calculate dynamic driver commission based on B2C Partner's settings
 * @param {string} b2cPartnerId - The B2C Partner user ID
 * @param {number} amount - The total booking amount
 * @returns {Promise<Object>} Commission calculation result
 */
export const calculateDynamicDriverCommission = async (b2cPartnerId, amount) => {
    return calculateDynamicCommission(b2cPartnerId, amount, "BOOKING")
}

// Default negotiation commission rate (fallback if no settings found)
export const DEFAULT_NEGOTIATION_COMMISSION_RATE = 25

/**
 * Resolve the effective negotiation commission rate for a Corporate user.
 *
 * Priority (mirrors the Commission Management list logic):
 *   1. An ACTIVE custom rate rule of type "NEGOTIATION" (the rule Admin set,
 *      e.g. 40% effective for a date window) — highest priority.
 *   2. The user's configured `negotiationCommissionRate`.
 *   3. The system default (25%).
 *
 * @param {string} corporateId - The Corporate user ID
 * @returns {Promise<{ rate: number, source: string }>} Resolved rate + its source
 */
export const resolveNegotiationCommissionRate = async (corporateId) => {
    try {
        const settings = await CommissionSettings.findOne({ userId: corporateId, isActive: true })

        if (!settings) {
            return { rate: DEFAULT_NEGOTIATION_COMMISSION_RATE, source: "default" }
        }

        // 1. Highest priority: an active custom NEGOTIATION rule
        if (settings.customRates?.length > 0) {
            const now = new Date()
            const customRate = settings.customRates.find(
                (r) =>
                    r.rateType === "NEGOTIATION" &&
                    new Date(r.effectiveFrom) <= now &&
                    (!r.effectiveUntil || new Date(r.effectiveUntil) >= now)
            )
            if (customRate && customRate.rate !== undefined && customRate.rate !== null) {
                return { rate: customRate.rate, source: "custom_rule" }
            }
        }

        // 2. Configured negotiation commission rate
        if (settings.negotiationCommissionRate !== undefined && settings.negotiationCommissionRate !== null) {
            return { rate: settings.negotiationCommissionRate, source: "configured" }
        }

        // 3. Fallback
        return { rate: DEFAULT_NEGOTIATION_COMMISSION_RATE, source: "default" }
    } catch (error) {
        console.error("Error resolving negotiation commission rate:", error)
        return { rate: DEFAULT_NEGOTIATION_COMMISSION_RATE, source: "default" }
    }
}

/**
 * Calculate negotiation commission (from savings amount)
 * @param {string} corporateId - The Corporate user ID
 * @param {number} savingsAmount - The amount saved via negotiation
 * @returns {Promise<Object>} Commission calculation result
 */
export const calculateNegotiationCommission = async (corporateId, savingsAmount) => {
    try {
        const { rate } = await resolveNegotiationCommissionRate(corporateId)

        const commission = (savingsAmount * rate) / 100

        return {
            savingsAmount: savingsAmount,
            adminCommission: commission,
            corporateKeeps: savingsAmount - commission,
            appliedRate: rate,
        }
    } catch (error) {
        console.error("Error calculating negotiation commission:", error)
        const defaultRate = DEFAULT_NEGOTIATION_COMMISSION_RATE
        const commission = (savingsAmount * defaultRate) / 100
        return {
            savingsAmount: savingsAmount,
            adminCommission: commission,
            corporateKeeps: savingsAmount - commission,
            appliedRate: defaultRate,
        }
    }
}
