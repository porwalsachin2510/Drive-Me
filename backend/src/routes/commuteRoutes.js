import express from "express"
import { verifyToken, optionalAuth } from "../middleware/auth.js"
import { checkCommuterRole } from "../middleware/auth.js"
import { searchCommuteRoutes, publicSearchRoutes } from "../controllers/commuteSearchController.js"

const router = express.Router()

// PUBLIC: Search B2C routes without login (for landing page)
router.get("/public-search", publicSearchRoutes)

// PROTECTED: Search commute routes for authenticated commuters (includes corporate routes)
router.get(
    "/search",
    verifyToken,
    checkCommuterRole,
    searchCommuteRoutes,
)

export default router
