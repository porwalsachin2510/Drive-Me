import express from "express";
import { verifyToken, checkAdminRole } from "../middleware/auth.js";
import {
    updateSubscriptionSettings,
    getSubscriptionSettings,
    cancelSubscription,
    renewSubscription,
    requestCashRenewal,
    confirmCashRenewal,
    getPendingCashRenewals,
    processRenewals,
    sendRenewalReminders
} from "../controllers/subscriptionSettingsController.js";

const router = express.Router();

// Commuter routes
router.get("/settings", verifyToken, getSubscriptionSettings);
router.put("/settings", verifyToken, updateSubscriptionSettings);
router.post("/cancel", verifyToken, cancelSubscription);
router.post("/renew", verifyToken, renewSubscription);
router.post("/renew/cash", verifyToken, requestCashRenewal);

// Admin routes
router.get("/admin/pending-cash", verifyToken, checkAdminRole, getPendingCashRenewals);
router.post("/admin/confirm-cash", verifyToken, checkAdminRole, confirmCashRenewal);

// Cron routes
router.post("/process-renewals", processRenewals);
router.post("/send-reminders", sendRenewalReminders);

export default router;
