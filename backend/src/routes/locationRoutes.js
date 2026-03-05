import express from "express"
import { detectUserLocation } from "../controllers/locationController.js"

const router = express.Router()

// Public route - no authentication needed for location detection
// This allows guests to see routes on the landing page
router.get("/detect", detectUserLocation)

export default router
