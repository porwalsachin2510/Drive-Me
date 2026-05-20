import express from "express";
const router = express.Router();
import {
    getB2CPartnerBookings,
    getB2CPartnerBookingHistory,
    getB2CPartnerDriverBookings,
    updateBookingStatus,
    getB2CBookingDetails,
    getPassengerDetails
} from "../controllers/b2cBookingController.js";
import { verifyToken } from "../middleware/auth.js";

// B2C Partner Routes
router.get("/partner/bookings", verifyToken, getB2CPartnerBookings);
router.get("/partner/bookings/history", verifyToken, getB2CPartnerBookingHistory);
router.get("/booking/:bookingId", verifyToken, getB2CBookingDetails);
router.get("/booking/:bookingId/passenger", verifyToken, getPassengerDetails);
router.put("/booking/:bookingId/status", verifyToken, updateBookingStatus);

// B2C Driver Routes  
router.get("/driver/bookings", verifyToken, getB2CPartnerDriverBookings);

export default router;
