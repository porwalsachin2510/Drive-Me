import express from "express";
import { verifyToken, checkAdminRole } from "../middleware/auth.js";
import {
    processMonthlySettlement,
    autoDebitMonthlyPass,
    getPartnerSettlement,
    getAllSettlements,
    processPayout
} from "../controllers/settlementController.js";

const router = express.Router();

// Admin routes
router.post("/monthly-settlement", verifyToken, checkAdminRole, processMonthlySettlement);
router.post("/auto-debit", verifyToken, checkAdminRole, autoDebitMonthlyPass);
router.get("/all", verifyToken, checkAdminRole, getAllSettlements);
router.post("/payout/:partnerId", verifyToken, checkAdminRole, processPayout);

// Partner routes
router.get("/my-settlement", verifyToken, getPartnerSettlement);

export default router;
