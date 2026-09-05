import express from "express"
import { verifyToken } from "../middleware/auth.js"
import {
    getSlaConfig,
    updateSlaConfig,
    getSlaPerformance,
    listComplaints,
    createComplaint,
    updateComplaint,
    getBillingConfig,
    updateBillingConfig,
    previewMonthlyBill,
    generateMonthlyInvoice,
    listOperationalInvoices,
    payOperationalInvoice,
    confirmOperationalInvoicePayment,
} from "../controllers/managedServiceController.js"

const router = express.Router()

// Access control (corporate owner vs operating partner) is enforced inside the
// controller via resolveAccess, since both roles share these endpoints for a
// MANAGED-service contract.

// --- SLA & performance tracking ---
router.get("/:contractId/sla", verifyToken, getSlaConfig)
router.put("/:contractId/sla", verifyToken, updateSlaConfig) // corporate only
router.get("/:contractId/sla/performance", verifyToken, getSlaPerformance)

// --- Complaints ---
router.get("/:contractId/complaints", verifyToken, listComplaints)
router.post("/:contractId/complaints", verifyToken, createComplaint)
router.patch("/:contractId/complaints/:complaintId", verifyToken, updateComplaint)

// --- Operation-based billing ---
router.get("/:contractId/billing/config", verifyToken, getBillingConfig)
router.put("/:contractId/billing/config", verifyToken, updateBillingConfig) // partner only
router.get("/:contractId/billing/preview", verifyToken, previewMonthlyBill)
router.post("/:contractId/billing/generate", verifyToken, generateMonthlyInvoice) // partner only
router.get("/:contractId/billing/invoices", verifyToken, listOperationalInvoices)
router.post("/:contractId/billing/invoices/:invoiceId/pay", verifyToken, payOperationalInvoice) // corporate only
router.patch(
    "/:contractId/billing/invoices/:invoiceId/confirm-payment",
    verifyToken,
    confirmOperationalInvoicePayment,
) // partner only

export default router
