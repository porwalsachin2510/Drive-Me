import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    markNoShow,
    getPassengerNoShows,
    getProviderNoShows,
    updateNoShowStatus
} from "../controllers/noShowController.js";

const router = express.Router();

// Passenger routes
router.post("/mark", verifyToken, markNoShow);
router.get("/my-no-shows", verifyToken, getPassengerNoShows);

// Provider routes
router.get("/provider-no-shows", verifyToken, getProviderNoShows);
router.put("/update-status/:noShowId", verifyToken, updateNoShowStatus);

export default router;
