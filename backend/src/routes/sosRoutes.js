import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    raiseSOS,
    getMyAlerts,
    getMyActiveAlert,
    getAlerts,
    acknowledgeSOS,
    resolveSOS,
    cancelSOS,
} from "../controllers/sosController.js";

const router = express.Router();

// Raise an SOS (employee/driver)
router.post("/", verifyToken, raiseSOS);
router.post("/raise", verifyToken, raiseSOS);

// My alerts
router.get("/my-alerts", verifyToken, getMyAlerts);
router.get("/my-active", verifyToken, getMyActiveAlert);

// Ops view (corporate owner / B2B partner / admin)
router.get("/", verifyToken, getAlerts);

// Responder actions
router.patch("/:alertId/acknowledge", verifyToken, acknowledgeSOS);
router.patch("/:alertId/resolve", verifyToken, resolveSOS);

// Raiser cancels (false alarm)
router.patch("/:alertId/cancel", verifyToken, cancelSOS);

export default router;
