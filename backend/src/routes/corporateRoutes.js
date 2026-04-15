import express from "express";
import { verifyToken, checkCorporateOwnerRole } from "../middleware/auth.js";
import { getCorporateStats, getCorporateRoutes, getCorporateRouteDetails } from "../controllers/corporateStatsController.js";
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

// @route   GET /api/corporate/routes
// @desc    Get all corporate routes with schedules and trip details
// @access  Private (CORPORATE only)
router.get("/routes", verifyToken, checkCorporateOwnerRole, getCorporateRoutes);

// @route   GET /api/corporate/routes/:routeId
// @desc    Get single route details with full schedule and trip history
// @access  Private (CORPORATE only)
router.get("/routes/:routeId", verifyToken, checkCorporateOwnerRole, getCorporateRouteDetails);

export default router;
