import express from "express";
import { verifyToken, checkCorporateOwnerRole, resolveCorporateContext } from "../middleware/auth.js";
import { getCorporateStats, getCorporateRoutes, getCorporateRouteDetails } from "../controllers/corporateStatsController.js";
import { getBillingReport } from "../controllers/billingController.js";
import {
    getCorporateInvoices,
    getInvoiceById,
    downloadInvoicePdf,
    getInvoicePaymentRedirect,
} from "../controllers/invoiceController.js";
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
router.get("/invoices", verifyToken, checkCorporateOwnerRole, getCorporateInvoices);
router.get("/invoices/:id", verifyToken, checkCorporateOwnerRole, getInvoiceById);
router.get("/invoices/:id/pdf", verifyToken, checkCorporateOwnerRole, downloadInvoicePdf);
router.get("/invoices/:id/payment-redirect", verifyToken, checkCorporateOwnerRole, getInvoicePaymentRedirect);

// @route   GET /api/corporate/corporate-drivers
// @desc    Get all corporate drivers
// @access  Private (CORPORATE only)
router.get("/corporate-drivers", verifyToken, resolveCorporateContext, getAllCorporateDrivers);

// @route   GET /api/corporate/available-corporate-driver
// @desc    Get available corporate drivers (for assignment dropdown)
// @access  Private (CORPORATE only)
router.get("/available-corporate-driver", verifyToken, resolveCorporateContext, getAvailableCorporateDrivers);

// @route   GET /api/corporate/routes
// @desc    Get all corporate routes with schedules and trip details
// @access  Private (CORPORATE only)
router.get("/routes", verifyToken, resolveCorporateContext, getCorporateRoutes);

// @route   GET /api/corporate/routes/:routeId
// @desc    Get single route details with full schedule and trip history
// @access  Private (CORPORATE only)
router.get("/routes/:routeId", verifyToken, resolveCorporateContext, getCorporateRouteDetails);

export default router;
