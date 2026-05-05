import express from "express"
import { verifyToken, optionalAuth } from "../middleware/auth.js"
import { checkCommuterRole } from "../middleware/auth.js"
import { searchCommuteRoutes, publicSearchRoutes, getRouteDetails, getPublicRouteDetails } from "../controllers/commuteSearchController.js"

const router = express.Router()

// PUBLIC: Search B2C routes without login (for landing page)
router.get("/public-search", publicSearchRoutes)

// PUBLIC: Get route details by ID (for mobile app and landing page)
router.get("/routes/:routeId", getPublicRouteDetails)

// PROTECTED: Get route details by ID (for authenticated users - includes more info)
router.get("/routes/:routeId/details", verifyToken, getRouteDetails)

// PROTECTED: Search commute routes for authenticated commuters (includes corporate routes)
router.get(
    "/search",
    verifyToken,
    checkCommuterRole,
    searchCommuteRoutes,
)

export default router
