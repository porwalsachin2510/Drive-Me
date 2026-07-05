import express from "express"
import { verifyToken } from "../middleware/auth.js"
import { searchAddress, reverseGeocode, routeBetween } from "../controllers/geocodeController.js"

const router = express.Router()

// All geocoding is behind auth so only signed-in users can drive our shared
// Nominatim/OSRM budget. The controller serializes calls to honor the public
// server's 1 req/sec fair-use policy.
router.get("/search", verifyToken, searchAddress)
router.get("/reverse", verifyToken, reverseGeocode)
router.get("/route", verifyToken, routeBetween)

export default router
