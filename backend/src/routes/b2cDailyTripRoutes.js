import express from "express";
import { verifyToken, checkB2CPartnerRole, checkDriverRole } from "../middleware/auth.js";
import {
    getTodayTrips,
    getUpcomingTrips,
    updateTripStatus,
    updateTripSeats,
    getTripStatistics,
    getProviderDashboard,
    getRouteRequests,
    getDriverDailyTrips,
    startDriverTrip,
    completeDriverTrip,
    getPartnerSelfDriverTrips,
    startPartnerTrip,
    completePartnerTrip,
    updateB2CDriverLocation,
    getActiveB2CTrip,
    checkAndUpdateAvailability
} from "../controllers/b2cDailyTripController.js";
import {
    updateDriverAvailabilityStatus,
    getMyAvailabilityStatus,
    updateAvailableTimeSlots,
    getDriverIncompleteTrips,
    getDetailedAvailabilityInfo
} from "../controllers/driverController.js";

const router = express.Router();

// Daily trip management
router.get("/today", verifyToken, checkB2CPartnerRole, getTodayTrips);
router.get("/upcoming", verifyToken, checkB2CPartnerRole, getUpcomingTrips);
// Allow both B2C_PARTNER and B2C_PARTNER_DRIVER to update trip status
router.put("/status/:tripId", verifyToken, updateTripStatus);
router.put("/seats/:tripId", verifyToken, checkB2CPartnerRole, updateTripSeats);

// B2C Partner self-driver routes - For B2C_PARTNER who is driving themselves
// These allow B2C Partners to manage trips when they are the driver
router.get("/partner/self-driver-trips", verifyToken, checkB2CPartnerRole, getPartnerSelfDriverTrips);
router.put("/partner/start/:tripId", verifyToken, checkB2CPartnerRole, startPartnerTrip);
router.put("/partner/complete/:tripId", verifyToken, checkB2CPartnerRole, completePartnerTrip);

// Driver-specific routes - Route-centric trip management
// These endpoints show trips with ALL passengers grouped together
router.get("/driver/trips", verifyToken, getDriverDailyTrips);
router.put("/driver/start/:tripId", verifyToken, startDriverTrip);
router.put("/driver/complete/:tripId", verifyToken, completeDriverTrip);

// B2C Driver location tracking routes - For both partner self-driver and partner driver
router.get("/driver/active-trip", verifyToken, getActiveB2CTrip);
router.post("/driver/update-location", verifyToken, updateB2CDriverLocation);

// Driver availability management
router.get("/driver/availability", verifyToken, getMyAvailabilityStatus);
router.get("/driver/availability/detailed", verifyToken, getDetailedAvailabilityInfo);
router.put("/driver/availability/status", verifyToken, updateDriverAvailabilityStatus);
router.put("/driver/availability/time-slots", verifyToken, updateAvailableTimeSlots);
router.get("/driver/incomplete-trips", verifyToken, getDriverIncompleteTrips);
// Check and auto-update availability based on scheduled trips (call on login/dashboard load)
router.get("/driver/check-availability", verifyToken, checkAndUpdateAvailability);
// Statistics and dashboard
router.get("/statistics/:tripId", verifyToken, checkB2CPartnerRole, getTripStatistics);
router.get("/dashboard", verifyToken, checkB2CPartnerRole, getProviderDashboard);

// Route requests (demand)
router.get("/route-requests", verifyToken, checkB2CPartnerRole, getRouteRequests);

export default router;
