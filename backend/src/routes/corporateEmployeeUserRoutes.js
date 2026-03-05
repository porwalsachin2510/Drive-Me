import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    registerCorporateEmployee,
    getEmployeeDashboard,
    getAssignedRoute,
    manageBooking,
    markNotTravelingToday,
    rateTrip,
    requestRouteChange
} from "../controllers/corporateEmployeeUserController.js";

const router = express.Router();

// Employee registration and dashboard
router.post("/register", verifyToken, registerCorporateEmployee);
router.get("/dashboard", verifyToken, getEmployeeDashboard);
router.get("/route", verifyToken, getAssignedRoute);

// Booking management
router.post("/booking", verifyToken, manageBooking);
router.post("/not-traveling-today", verifyToken, markNotTravelingToday);

// Feedback and requests
router.post("/rate-trip", verifyToken, rateTrip);
router.post("/request-route-change", verifyToken, requestRouteChange);

export default router;
