import express from "express";
import {
    joinWaitlist,
    getWaitlistStats,
    getCountriesWithPendingNotifications,
    getWaitlistByCountry,
    sendNotificationsForCountry,
    sendSingleNotification,
} from "../controllers/expansionWaitlistController.js";
import { verifyToken, checkAdminRole } from "../middleware/auth.js";

const router = express.Router();

// Public endpoints - usable by visitors in unsupported countries (no auth).
router.post("/join", joinWaitlist);
router.get("/stats", getWaitlistStats);

// Admin endpoints - require authentication and ADMIN role.
router.get(
    "/admin/countries",
    verifyToken,
    checkAdminRole,
    getCountriesWithPendingNotifications
);
router.get(
    "/admin/country/:country",
    verifyToken,
    checkAdminRole,
    getWaitlistByCountry
);
router.post(
    "/admin/notify",
    verifyToken,
    checkAdminRole,
    sendNotificationsForCountry
);
router.post(
    "/admin/notify-single",
    verifyToken,
    checkAdminRole,
    sendSingleNotification
);

export default router;
