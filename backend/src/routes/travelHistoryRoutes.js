import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    getPassengerTravelHistory,
    getTripTravelHistory,
    addTravelRecord,
    updateTravelRecord,
    rateTrip,
    getTravelStatistics,
    getDriverRatings
} from "../controllers/travelHistoryController.js";

const router = express.Router();

// Passenger routes
router.get("/my-history", verifyToken, getPassengerTravelHistory);
router.get("/trip/:tripId", verifyToken, getTripTravelHistory);
router.post("/add", verifyToken, addTravelRecord);
router.put("/update/:travelId", verifyToken, updateTravelRecord);
router.post("/rate/:travelId", verifyToken, rateTrip);
router.get("/statistics", verifyToken, getTravelStatistics);
// Driver ratings routes
router.get("/driver-ratings", verifyToken, getDriverRatings);

export default router;
