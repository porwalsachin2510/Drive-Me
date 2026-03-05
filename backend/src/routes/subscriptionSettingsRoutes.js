import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    updateSubscriptionSettings,
    getSubscriptionSettings,
    cancelSubscription,
    renewSubscription,
    processRenewals,
    sendRenewalReminders
} from "../controllers/subscriptionSettingsController.js";

const router = express.Router();

// User routes
router.get("/settings", verifyToken, getSubscriptionSettings);
router.put("/settings", verifyToken, updateSubscriptionSettings);
router.post("/cancel", verifyToken, cancelSubscription);
router.post("/renew", verifyToken, renewSubscription);

// Admin/Cron routes
router.post("/process-renewals", processRenewals);
router.post("/send-reminders", sendRenewalReminders);

export default router;
