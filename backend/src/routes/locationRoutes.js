import express from "express"
import { detectUserLocation, shareDriverLocation, getDriverLocationById } from "../controllers/locationController.js"
import { verifyToken } from "../middleware/auth.js"

const router = express.Router()

// Public route - no authentication needed for location detection
// This allows guests to see routes on the landing page
router.get("/detect", detectUserLocation)

// Driver location sharing - for B2C_PARTNER and B2C_PARTNER_DRIVER
// POST /api/location/share - Share driver location during active trip
router.post("/share", verifyToken, shareDriverLocation)

// Get driver location by ID - for passengers tracking their driver
// GET /api/location/driver/:driverId
router.get("/driver/:driverId", verifyToken, getDriverLocationById)

export default router
