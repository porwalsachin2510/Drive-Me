import jwt from "jsonwebtoken"

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
export const checkCommuterRole = (req, res, next) => {
    // USER ROLE IS ALREADY SET BY verifyToken MIDDLEWARE IN req.userRole
    if (req.userRole !== "COMMUTER") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only commuters can access this resource.",
        })
    }
    next()
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
