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

/**
 * Calculate negotiation commission (from savings amount)
 * @param {string} corporateId - The Corporate user ID
 * @param {number} savingsAmount - The amount saved via negotiation
 * @returns {Promise<Object>} Commission calculation result
 */
export const calculateNegotiationCommission = async (corporateId, savingsAmount) => {
    try {
        const settings = await CommissionSettings.findOne({ userId: corporateId, isActive: true })

        // Use negotiation-specific rate or default to 25%
        const rate = settings?.negotiationCommissionRate || 25

        const commission = (savingsAmount * rate) / 100

        return {
            savingsAmount: savingsAmount,
            adminCommission: commission,
            corporateKeeps: savingsAmount - commission,
            appliedRate: rate,
        }
    } catch (error) {
        console.error("Error calculating negotiation commission:", error)
        const defaultRate = 25
        const commission = (savingsAmount * defaultRate) / 100
        return {
            savingsAmount: savingsAmount,
            adminCommission: commission,
            corporateKeeps: savingsAmount - commission,
            appliedRate: defaultRate,
        }
    }
}
