import express from "express";
import {
    createTripsFromRoute,
    getAvailableTrips,
    bookTripSeat,
    cancelTripBooking,
    getMyBookings,
    startTrip,
    completeTrip,
    updateDriverLocation,
    getCorporateTrips,
    assignDriverToTrip
} from "../controllers/tripController.js";
import {
    createMonthlyPass,
    getEmployeeMonthlyPasses,
    getCorporateMonthlyPasses,
    renewMonthlyPass,
    cancelMonthlyPass,
    getMonthlyPassStatistics
} from "../controllers/monthlyPassController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Trip routes
router.post("/create-from-route", verifyToken, createTripsFromRoute);
router.get("/available", verifyToken, getAvailableTrips);
router.get("/my-bookings", verifyToken, getMyBookings);
router.get("/corporate", verifyToken, getCorporateTrips);
router.post("/:tripId/assign-driver", verifyToken, assignDriverToTrip);
router.post("/:tripId/book", verifyToken, bookTripSeat);
router.delete("/:tripId/cancel", verifyToken, cancelTripBooking);
router.post("/:tripId/start", verifyToken, startTrip);
router.post("/:tripId/complete", verifyToken, completeTrip);
router.post("/:tripId/location", verifyToken, updateDriverLocation);

// Monthly pass routes
router.post("/monthly-pass/create", verifyToken, createMonthlyPass);
router.get("/monthly-pass/employee/:employeeId", verifyToken, getEmployeeMonthlyPasses);
router.get("/monthly-pass/corporate", verifyToken, getCorporateMonthlyPasses);
router.post("/monthly-pass/:passId/renew", verifyToken, renewMonthlyPass);
router.delete("/monthly-pass/:passId/cancel", verifyToken, cancelMonthlyPass);
router.get("/monthly-pass/statistics", verifyToken, getMonthlyPassStatistics);

export default router;
