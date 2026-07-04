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
import { verifyToken, resolveCorporateContext } from "../middleware/auth.js";

const router = express.Router();

// All corporate operations support a B2B partner acting on behalf of the
// corporate for MANAGED-service contracts (via onBehalfContractId).

// Daily trips management
router.get("/daily-trips", verifyToken, resolveCorporateContext, getDailyTrips);
router.get("/employee/:employeeId/trips", verifyToken, resolveCorporateContext, getEmployeeAssignedTrips);

// Route-Vehicle assignment
router.post("/assign-route-to-vehicle", verifyToken, resolveCorporateContext, assignRouteToVehicle);
router.get("/assigned-routes-status", verifyToken, resolveCorporateContext, getAssignedRoutesStatus);

// Employee trip assignment
router.post("/trips/:tripId/assign-employees", verifyToken, resolveCorporateContext, assignEmployeesToTrip);

// Trip details
router.get("/trips/:tripId/details", verifyToken, resolveCorporateContext, getTripDetails);

// Corporate employee bookings
router.get("/bookings", verifyToken, resolveCorporateContext, getCorporateEmployeeBookings);

export default router;
