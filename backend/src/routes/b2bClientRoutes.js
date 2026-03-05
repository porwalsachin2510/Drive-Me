import express from "express";
import { verifyToken, checkB2BPartnerRole } from "../middleware/auth.js";
import {
    createClientInquiry,
    getClientRequirements,
    createProposal,
    getProposals,
    finalizeContract,
    getContracts,
    getClientDashboard
} from "../controllers/b2bClientController.js";

const router = express.Router();

// Client acquisition
router.post("/inquiry", verifyToken, checkB2BPartnerRole, createClientInquiry);
router.get("/requirements", verifyToken, checkB2BPartnerRole, getClientRequirements);

// Proposal management
router.post("/proposal", verifyToken, checkB2BPartnerRole, createProposal);
router.get("/proposals", verifyToken, checkB2BPartnerRole, getProposals);

// Contract management
router.post("/contract/finalize", verifyToken, checkB2BPartnerRole, finalizeContract);
router.get("/contracts", verifyToken, checkB2BPartnerRole, getContracts);

// Dashboard
router.get("/dashboard", verifyToken, checkB2BPartnerRole, getClientDashboard);

export default router;
