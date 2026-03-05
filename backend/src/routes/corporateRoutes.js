import express from "express";
import { verifyToken, checkCorporateOwnerRole } from "../middleware/auth.js";
import { getCorporateStats } from "../controllers/corporateStatsController.js";
import { getBillingReport, getInvoices } from "../controllers/billingController.js";
import { getAvailableCorporateDrivers, getAllCorporateDrivers } from "../controllers/driverController.js";

const router = express.Router();

// @route   GET /api/corporate/stats
// @desc    Get corporate dashboard stats
// @access  Private (CORPORATE only)
router.get("/stats", verifyToken, checkCorporateOwnerRole, getCorporateStats);

// @route   GET /api/corporate/billing-report
// @desc    Get monthly billing report
// @access  Private (CORPORATE only)
router.get("/billing-report", verifyToken, checkCorporateOwnerRole, getBillingReport);

// @route   GET /api/corporate/invoices
// @desc    Get invoices list
// @access  Private (CORPORATE only)
router.get("/invoices", verifyToken, checkCorporateOwnerRole, getInvoices);

// @route   GET /api/corporate/corporate-drivers
// @desc    Get all corporate drivers
// @access  Private (CORPORATE only)
router.get("/corporate-drivers", verifyToken, checkCorporateOwnerRole, getAllCorporateDrivers);

// @route   GET /api/corporate/available-corporate-driver
// @desc    Get available corporate drivers (for assignment dropdown)
// @access  Private (CORPORATE only)
router.get("/available-corporate-driver", verifyToken, checkCorporateOwnerRole, getAvailableCorporateDrivers);

export default router;
