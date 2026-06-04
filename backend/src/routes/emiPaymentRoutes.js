import express from "express"
import { verifyToken, requireRole } from "../middleware/auth.js"
import {
    createEMIPlan,
    getEMIPlanByContract,
    getEMIEligibility,
    payEMIInstallment,
    verifyEMIPayment,
    verifyEMIOnlinePayment,
    sendEMIWarning,
    requestServiceSuspension,
    toggleServiceStatus,
    getAllEMIPaymentsAdmin,
    getCorporateEMIPayments,
    getB2BPartnerEMIPayments,
    handleEMIStripeWebhook,
} from "../controllers/emiPaymentController.js"

const router = express.Router()

// Public routes
// Payment gateway callback (supports both GET and POST)
router.get("/verify-online", verifyEMIOnlinePayment)
router.post("/verify-online", verifyEMIOnlinePayment)

// Stripe webhook for EMI payments (must use raw body parser)
router.post("/webhook/stripe", express.raw({ type: "application/json" }), handleEMIStripeWebhook)

// Corporate routes
router.post("/create", verifyToken, requireRole(["CORPORATE"]), createEMIPlan)
router.get("/corporate/all", verifyToken, requireRole(["CORPORATE"]), getCorporateEMIPayments)
router.post("/:emiPaymentId/pay-installment", verifyToken, requireRole(["CORPORATE"]), payEMIInstallment)

// B2B Partner routes
router.get("/b2b/all", verifyToken, requireRole(["B2B_PARTNER"]), getB2BPartnerEMIPayments)
router.post("/:emiPaymentId/request-suspension", verifyToken, requireRole(["B2B_PARTNER"]), requestServiceSuspension)

// Common routes (Corporate or B2B Partner)
router.get("/contract/:contractId", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), getEMIPlanByContract)
router.get("/eligibility/:contractId", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), getEMIEligibility)

// Admin routes
router.get("/admin/all", verifyToken, requireRole(["ADMIN"]), getAllEMIPaymentsAdmin)
router.post("/:emiPaymentId/verify-payment", verifyToken, requireRole(["ADMIN"]), verifyEMIPayment)
router.post("/:emiPaymentId/send-warning", verifyToken, requireRole(["ADMIN"]), sendEMIWarning)
router.post("/:emiPaymentId/toggle-service", verifyToken, requireRole(["ADMIN"]), toggleServiceStatus)

export default router
