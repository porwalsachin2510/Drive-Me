import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    createRouteRequest,
    getPassengerRouteRequests,
    getRouteRequestsForProviders,
    respondToRouteRequest
} from "../controllers/routeRequestController.js";

const router = express.Router();

// Passenger routes
router.post("/request", verifyToken, createRouteRequest);
router.get("/my-requests", verifyToken, getPassengerRouteRequests);

// Provider routes
router.get("/provider-requests", verifyToken, getRouteRequestsForProviders);
router.post("/respond/:requestId", verifyToken, respondToRouteRequest);

export default router;
