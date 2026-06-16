import express from "express";
import {
    joinWaitlist,
    getWaitlistStats,
} from "../controllers/expansionWaitlistController.js";

const router = express.Router();

// Public endpoints - usable by visitors in unsupported countries (no auth).
router.post("/join", joinWaitlist);
router.get("/stats", getWaitlistStats);

export default router;
