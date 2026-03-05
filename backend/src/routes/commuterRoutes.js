import express from "express"
const router = express.Router()
import {
    getCommuterRoutes,
    joinRoute,
    leaveRoute,
    getCommuterProfile,
    updateCommuterProfile,
    changeCommuterPassword,
    getCommuterStats,
} from "../controllers/adminController.js"
import { verifyToken, checkCommuterRole } from "../middleware/auth.js"

// Commuter Routes Management
router.get("/routes", verifyToken, checkCommuterRole, getCommuterRoutes)
router.post("/routes/:routeId/join", verifyToken, checkCommuterRole, joinRoute)
router.post("/routes/:routeId/leave", verifyToken, checkCommuterRole, leaveRoute)

// Commuter Stats
router.get("/stats", verifyToken, checkCommuterRole, getCommuterStats)

// Commuter Profile Management
router.get("/profile", verifyToken, checkCommuterRole, getCommuterProfile)
router.put("/profile", verifyToken, checkCommuterRole, updateCommuterProfile)
router.put("/change-password", verifyToken, checkCommuterRole, changeCommuterPassword)

export default router
