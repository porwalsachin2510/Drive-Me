import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    createRouteRequest,
    getPassengerRouteRequests,
    getRouteRequestsForProviders,
    respondToRouteRequest,
    getMostRequestedRoutes,
    showInterestInRoute
} from "../controllers/routeRequestController.js";

const router = express.Router();

// Passenger routes
router.post("/request", verifyToken, createRouteRequest);
router.get("/my-requests", verifyToken, getPassengerRouteRequests);
// Most requested corridors + join an existing corridor's demand (commuter search page)
router.get("/most-requested", verifyToken, getMostRequestedRoutes);
router.post("/show-interest", verifyToken, showInterestInRoute);

// Provider routes
router.get("/provider-requests", verifyToken, getRouteRequestsForProviders);
router.post("/respond/:requestId", verifyToken, respondToRouteRequest);

export default router;
