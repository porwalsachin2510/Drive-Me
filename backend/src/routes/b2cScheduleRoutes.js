import express from "express";
const router = express.Router();
import {
    createB2CPartnerRoute,
    createB2CPartnerSchedule,
    getB2CPartnerRoutes,
    getB2CPartnerSchedules,
    updateB2CPartnerSchedule,
    deleteB2CPartnerSchedule,
    deleteB2CPartnerRoute,
    getTodayTrips,
    createB2CPartnerTrip
} from "../controllers/b2cScheduleController.js";
import { verifyToken, checkB2CPartnerRole } from "../middleware/auth.js";

// B2C Partner Routes Management
router.get("/routes", verifyToken, checkB2CPartnerRole, getB2CPartnerRoutes);
router.post("/routes", verifyToken, checkB2CPartnerRole, createB2CPartnerRoute);
router.delete("/routes/:routeId", verifyToken, checkB2CPartnerRole, deleteB2CPartnerRoute);

// B2C Partner Schedules Management
router.get("/schedules", verifyToken, checkB2CPartnerRole, getB2CPartnerSchedules);
router.post("/schedules", verifyToken, checkB2CPartnerRole, createB2CPartnerSchedule);
router.put("/schedules/:scheduleId", verifyToken, checkB2CPartnerRole, updateB2CPartnerSchedule);
router.delete("/schedules/:scheduleId", verifyToken, checkB2CPartnerRole, deleteB2CPartnerSchedule);

// B2C Partner Trips Management
router.get("/trips/today", verifyToken, checkB2CPartnerRole, getTodayTrips);
router.post("/trips", verifyToken, checkB2CPartnerRole, createB2CPartnerTrip);

export default router;
