import Contract from "../models/Contract.js"
import Vehicle from "../models/Vehicle.js"
import User from "../models/User.js"

/**
 * Determine the service mode (STANDARD | MANAGED) for a set of quotation vehicles.
 * A quotation is treated as MANAGED if any of its vehicles is a MANAGED_SERVICES vehicle.
 *
 * @param {Array} vehicles - quotation vehicles array: [{ vehicleId, quantity }]
 * @returns {Promise<"STANDARD"|"MANAGED">}
 */
export const deriveServiceMode = async (vehicles = []) => {
    try {
        const ids = vehicles
            .map((v) => (typeof v.vehicleId === "object" && v.vehicleId?._id ? v.vehicleId._id : v.vehicleId))
            .filter(Boolean)

        if (ids.length === 0) return "STANDARD"

        const managedCount = await Vehicle.countDocuments({
            _id: { $in: ids },
            serviceType: "MANAGED_SERVICES",
        })

        return managedCount > 0 ? "MANAGED" : "STANDARD"
    } catch (error) {
        console.error("[operationContext] deriveServiceMode error:", error.message)
        return "STANDARD"
    }
}

/**
 * Append an entry to a MANAGED contract's operation activity log.
 * Safe no-op for STANDARD contracts or missing data.
 *
 * @param {String} contractId
 * @param {Object} entry - { action, description, entityType, entityId, performedBy, performedByRole, performedByName, meta }
 */
export const logManagedActivity = async (contractId, entry = {}) => {
    try {
        if (!contractId) return

        let performedByName = entry.performedByName
        if (!performedByName && entry.performedBy) {
            const user = await User.findById(entry.performedBy).select("fullName companyName").lean()
            performedByName = user?.companyName || user?.fullName || "User"
        }

        await Contract.findByIdAndUpdate(contractId, {
            $push: {
                "managedOperations.activityLog": {
                    action: entry.action,
                    description: entry.description,
                    entityType: entry.entityType,
                    entityId: entry.entityId,
                    performedBy: entry.performedBy,
                    performedByName: performedByName || "User",
                    performedByRole: entry.performedByRole || "CORPORATE",
                    meta: entry.meta || {},
                    createdAt: new Date(),
                },
            },
        })
    } catch (error) {
        // Never let activity logging break the primary operation
        console.error("[operationContext] logManagedActivity error:", error.message)
    }
}

/**
 * Convenience helper used inside corporate operation controllers.
 * Reads the impersonation context placed on the request by resolveCorporateContext
 * and logs an activity entry against the on-behalf contract (if any).
 */
export const logRequestActivity = async (req, entry = {}) => {
    const contractId = entry.contractId || req.onBehalfContractId
    if (!contractId) return
    await logManagedActivity(contractId, {
        ...entry,
        performedBy: req.actorId || req.userId,
        performedByRole: req.actingRole || "CORPORATE",
    })
}
