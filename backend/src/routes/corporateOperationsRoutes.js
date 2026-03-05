import express from "express";
import {
    getDailyTrips,
    getEmployeeAssignedTrips,
    assignRouteToVehicle,
    getAssignedRoutesStatus,
    assignEmployeesToTrip,
    getTripDetails,
    getCorporateEmployeeBookings
} from "../controllers/corporateOperationsController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Daily trips management
router.get("/daily-trips", verifyToken, getDailyTrips);
router.get("/employee/:employeeId/trips", verifyToken, getEmployeeAssignedTrips);

// Route-Vehicle assignment
router.post("/assign-route-to-vehicle", verifyToken, assignRouteToVehicle);
router.get("/assigned-routes-status", verifyToken, getAssignedRoutesStatus);

// Employee trip assignment
router.post("/trips/:tripId/assign-employees", verifyToken, assignEmployeesToTrip);

// Trip details
router.get("/trips/:tripId/details", verifyToken, getTripDetails);

// Corporate employee bookings
router.get("/bookings", verifyToken, getCorporateEmployeeBookings);

export default router;
