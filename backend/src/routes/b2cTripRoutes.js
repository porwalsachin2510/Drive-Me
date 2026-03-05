import express from "express";
const router = express.Router();

// Import B2C Trip controllers
import {
    createB2CPartnerRoute,
    createB2CPartnerSchedule,
    getB2CPartnerRoutes,
    getB2CPartnerSchedules,
    getTodayTrips
} from "../controllers/b2cTripController.js";

import {
    createPassengerBooking,
    getPassengerBookings,
    getAvailableTrips
} from "../controllers/passengerBookingController.js";

import { verifyToken, checkB2CPartnerRole } from "../middleware/auth.js";

// B2C Partner Route Management
router.post("/routes", verifyToken, checkB2CPartnerRole, createB2CPartnerRoute);
router.get("/routes", verifyToken, checkB2CPartnerRole, getB2CPartnerRoutes);

// B2C Partner Schedule Management (MAIN TRIP CREATION)
router.post("/schedules", verifyToken, checkB2CPartnerRole, createB2CPartnerSchedule);
router.get("/schedules", verifyToken, checkB2CPartnerRole, getB2CPartnerSchedules);

// B2C Partner Trip Management
router.get("/trips/today", verifyToken, checkB2CPartnerRole, getTodayTrips);

// Passenger Booking Routes
router.post("/bookings", verifyToken, createPassengerBooking);
router.get("/bookings", verifyToken, getPassengerBookings);
router.get("/trips/available", verifyToken, getAvailableTrips);

export default router;
