import express from "express";
import { verifyToken, checkAdminRole } from "../middleware/auth.js";
import {
    processMonthlySettlement,
    collectCommissionDebt,
    getPartnerSettlement,
    getAllSettlements
} from "../controllers/settlementController.js";

const router = express.Router();

// Admin routes
router.post("/monthly-settlement", verifyToken, checkAdminRole, processMonthlySettlement);
router.post("/collect-debt", verifyToken, checkAdminRole, collectCommissionDebt);
router.get("/all", verifyToken, checkAdminRole, getAllSettlements);

// Partner routes
router.get("/my-settlement", verifyToken, getPartnerSettlement);

export default router;
