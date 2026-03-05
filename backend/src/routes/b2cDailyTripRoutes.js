import express from "express";
import { verifyToken, checkB2CPartnerRole, checkDriverRole } from "../middleware/auth.js";
import {
    getTodayTrips,
    getUpcomingTrips,
    updateTripStatus,
    updateTripSeats,
    getTripStatistics,
    getProviderDashboard,
    getRouteRequests
} from "../controllers/b2cDailyTripController.js";

const router = express.Router();

// Daily trip management
router.get("/today", verifyToken, checkB2CPartnerRole, getTodayTrips);
router.get("/upcoming", verifyToken, checkB2CPartnerRole, getUpcomingTrips);
// Allow both B2C_PARTNER and B2C_PARTNER_DRIVER to update trip status
router.put("/status/:tripId", verifyToken, updateTripStatus);
router.put("/seats/:tripId", verifyToken, checkB2CPartnerRole, updateTripSeats);

// Statistics and dashboard
router.get("/statistics/:tripId", verifyToken, checkB2CPartnerRole, getTripStatistics);
router.get("/dashboard", verifyToken, checkB2CPartnerRole, getProviderDashboard);

// Route requests (demand)
router.get("/route-requests", verifyToken, checkB2CPartnerRole, getRouteRequests);

export default router;
