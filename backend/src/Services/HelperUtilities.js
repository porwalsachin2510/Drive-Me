export const ADMIN_COMMISSION_PERCENTAGE = 20

export const calculateCommission = (amount) => {
    const commission = (amount * ADMIN_COMMISSION_PERCENTAGE) / 100
    const fleetOwnerAmount = amount - commission
    return {
        totalAmount: amount,
        adminCommission: commission,
        fleetOwnerAmount: fleetOwnerAmount,
    }
}

export const calculateDriverCommission = (amount) => {
    const commission = (amount * ADMIN_COMMISSION_PERCENTAGE) / 100
    const driverEarnings = amount - commission
    return {
        totalAmount: amount,
        adminCommission: commission,
        driverEarnings: driverEarnings,
    }
}