import jwt from "jsonwebtoken"
import User from "../models/User.js"
import Contract from "../models/Contract.js"

export const verifyToken = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "No token provided",
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.userId = decoded.userId
        req.userRole = decoded.role
        next()
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        })
    }
}

// Optional authentication - sets userId if token exists, continues if not
export const optionalAuth = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]
    if (!token) {
        req.userId = null
        req.userRole = null
        return next()
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.userId = decoded.userId
        req.userRole = decoded.role
    } catch (error) {
        req.userId = null
        req.userRole = null
    }
    next()
}

// START: NEW MIDDLEWARE TO CHECK COMMUTER ROLE
export const checkCommuterRole = async (req, res, next) => {
    // USER ROLE IS ALREADY SET BY verifyToken MIDDLEWARE IN req.userRole
    if (req.userRole !== "COMMUTER") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only commuters can access this resource.",
        })
    }

    // Defense-in-depth: a commuter must be ACTIVE to perform ANY operation.
    // Commuters are ACTIVE as soon as their phone OTP is verified (no KYC /
    // admin-approval gate), so this primarily blocks SUSPENDED accounts even if
    // they somehow still hold a valid token.
    try {
        const user = await User.findById(req.userId).select("status").lean()
        if (!user) {
            return res.status(401).json({ success: false, message: "Account not found." })
        }
        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                code: "ACCOUNT_NOT_ACTIVE",
                message: "Your account is not active. Please contact support.",
            })
        }
        next()
    } catch (err) {
        return res.status(500).json({ success: false, message: "Authorization check failed." })
    }
}
// END: NEW MIDDLEWARE TO CHECK COMMUTER ROLE

export const checkFleetOwnerRole = (req, res, next) => {
    if (req.userRole !== "B2B_PARTNER") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only fleet owners can access this resource.",
        })
    }
    next()
}

export const checkB2CPartnerRole = (req, res, next) => {
    if (req.userRole !== "B2C_PARTNER") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only B2C partners can access this resource.",
        })
    }
    next()
}

export const checkB2BPartnerRole = (req, res, next) => {
    if (req.userRole !== "B2B_PARTNER") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only B2B partners can access this resource.",
        })
    }
    next()
}

export const checkCorporateOwnerRole = (req, res, next) => {
    if (req.userRole !== "CORPORATE") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only corporate owners can access this resource.",
        })
    }
    next()
}

export const checkAdminRole = (req, res, next) => {
    if (req.userRole !== "ADMIN") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only Admin can access this resource.",
        })
    }
    next()
}

export const checkDriverRole = (req, res, next) => {
    const driverRoles = ["B2C_PARTNER_DRIVER", "B2B_PARTNER_DRIVER", "CORPORATE_DRIVER", "B2C_PARTNER"];
    if (!driverRoles.includes(req.userRole)) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only drivers can access this resource.",
        })
    }
    next()
}

export const checkCorporateEmployeeRole = (req, res, next) => {
    if (req.userRole !== "CORPORATE_EMPLOYEE") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only corporate employees can access this resource.",
        })
    }
    next()
}

// ===== Demand Generation Staff Portal auth =====
// These tokens are issued by the Staff Portal login (a DemandEmployee, NOT a
// User). They are marked with kind: "DEMAND_PORTAL" so they can never be
// confused with a customer/admin session token.
export const verifyDemandPortalToken = (req, res, next) => {
    const token = req.cookies?.demandPortalToken || req.headers.authorization?.split(" ")[1]

    if (!token) {
        return res.status(401).json({ success: false, message: "No token provided" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        if (decoded.kind !== "DEMAND_PORTAL" || !decoded.demandEmployeeId) {
            return res.status(401).json({ success: false, message: "Invalid portal token" })
        }
        req.demandEmployeeId = decoded.demandEmployeeId
        req.portalRole = decoded.portalRole
        next()
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" })
    }
}

export const checkFieldRole = (req, res, next) => {
    if (req.portalRole !== "FIELD") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Field staff only.",
        })
    }
    next()
}

export const checkFinanceRole = (req, res, next) => {
    if (req.portalRole !== "FINANCE") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Finance staff only.",
        })
    }
    next()
}

export const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access",
            })
        }
        next()
    }
}

/**
 * Resolve the effective corporate context for an operation.
 *
 * - CORPORATE users: pass through unchanged (req.userId remains the corporate id).
 * - B2B_PARTNER users: only allowed when acting on a MANAGED contract they own.
 *   They must supply the target contract via `onBehalfContractId`
 *   (request body, query string, or `x-onbehalf-contract` header).
 *   On success, req.userId is rewritten to the contract's corporateOwnerId so all
 *   downstream corporate controllers operate within the corporate's scope, while
 *   the real actor is preserved on req.actorId / req.actingRole for activity logging.
 *
 * This lets the B2B partner perform every corporate operation (routes, schedules,
 * employees, trips, invitations) on behalf of the corporate without duplicating
 * controller logic, and records created automatically appear in the corporate's
 * own panels as live data.
 */
export const resolveCorporateContext = async (req, res, next) => {
    try {
        if (req.userRole === "B2B_PARTNER") {
            const contractId =
                req.body?.onBehalfContractId ||
                req.query?.onBehalfContractId ||
                req.headers["x-onbehalf-contract"] ||
                req.params?.contractId

            if (!contractId) {
                return res.status(400).json({
                    success: false,
                    message: "onBehalfContractId is required for partner-managed operations.",
                })
            }

            const contract = await Contract.findById(contractId).select(
                "corporateOwnerId fleetOwnerId serviceMode",
            )

            if (!contract) {
                return res.status(404).json({ success: false, message: "Contract not found." })
            }

            if (contract.fleetOwnerId.toString() !== req.userId) {
                return res.status(403).json({
                    success: false,
                    message: "You are not the partner for this contract.",
                })
            }

            if (contract.serviceMode !== "MANAGED") {
                return res.status(403).json({
                    success: false,
                    message: "Operations on behalf of corporate are only allowed for managed-service contracts.",
                })
            }

            // Impersonate the corporate's scope for downstream controllers
            req.actorId = req.userId
            req.actingRole = "B2B_PARTNER"
            req.userId = contract.corporateOwnerId.toString()
            req.onBehalfContractId = contractId
            req.onBehalfCorporateId = contract.corporateOwnerId.toString()
            return next()
        }

        // CORPORATE (and any other role) pass through unchanged.
        req.actorId = req.userId
        req.actingRole = req.userRole
        return next()
    } catch (error) {
        console.error("[auth] resolveCorporateContext error:", error.message)
        return res.status(500).json({ success: false, message: "Authorization check failed." })
    }
}
