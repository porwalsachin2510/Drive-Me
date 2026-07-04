import express from "express";
const router = express.Router();
import {
    createB2CPartnerRoute,
    createB2CPartnerSchedule,
    getB2CPartnerRoutes,
    getB2CPartnerSchedules,
    getB2CPartnerRoutesByCountry,
    updateB2CPartnerSchedule,
    deleteB2CPartnerSchedule,
    deleteB2CPartnerRoute,
    getTodayTrips,
    createB2CPartnerTrip,
    checkSchedulingConflicts,
    checkRouteDependencies,
    changeRouteDriver,
    changeRouteVehicle,
    changeTripDriver,
    changeTripVehicle
} from "../controllers/b2cScheduleController.js";
import { verifyToken, checkB2CPartnerRole } from "../middleware/auth.js";

// B2C Partner Routes Management
router.get("/routes", verifyToken, checkB2CPartnerRole, getB2CPartnerRoutes);
router.get("/routes/by-country", verifyToken, getB2CPartnerRoutesByCountry);
router.post("/routes", verifyToken, checkB2CPartnerRole, createB2CPartnerRoute);
router.delete("/routes/:routeId", verifyToken, checkB2CPartnerRole, deleteB2CPartnerRoute);

// Route Dependency Check (call before deleting to get warning info)
router.get("/routes/:routeId/dependencies", verifyToken, checkB2CPartnerRole, checkRouteDependencies);

// Change driver / vehicle for an entire route (cascades to schedules, trips, bookings)
router.put("/routes/:routeId/change-driver", verifyToken, checkB2CPartnerRole, changeRouteDriver);
router.put("/routes/:routeId/change-vehicle", verifyToken, checkB2CPartnerRole, changeRouteVehicle);

// Change driver / vehicle for a SINGLE schedule trip-time (does not affect other trips)
router.put("/routes/:routeId/change-trip-driver", verifyToken, checkB2CPartnerRole, changeTripDriver);
router.put("/routes/:routeId/change-trip-vehicle", verifyToken, checkB2CPartnerRole, changeTripVehicle);

// Scheduling Conflict Check (call before creating route/schedule to validate)
router.post("/check-conflicts", verifyToken, checkB2CPartnerRole, checkSchedulingConflicts);

// B2C Partner Schedules Management
router.get("/schedules", verifyToken, checkB2CPartnerRole, getB2CPartnerSchedules);
router.post("/schedules", verifyToken, checkB2CPartnerRole, createB2CPartnerSchedule);
router.put("/schedules/:scheduleId", verifyToken, checkB2CPartnerRole, updateB2CPartnerSchedule);
router.delete("/schedules/:scheduleId", verifyToken, checkB2CPartnerRole, deleteB2CPartnerSchedule);

// B2C Partner Trips Management
router.get("/trips/today", verifyToken, checkB2CPartnerRole, getTodayTrips);
router.post("/trips", verifyToken, checkB2CPartnerRole, createB2CPartnerTrip);

export default router;
