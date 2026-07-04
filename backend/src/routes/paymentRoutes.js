import express from "express"
import {
    createPayment,
    verifyPayment,
    getPaymentByContract,
    getContractCommissionPreview,
    stripeWebhook,
    tapWebhook,
    createInstallmentPayment,
} from "../controllers/paymentController.js"
import { verifyToken, checkCorporateOwnerRole } from "../middleware/auth.js"

const router = express.Router()

// Create payment for contract
router.post("/contracts/:contractId/payment", verifyToken, checkCorporateOwnerRole, createPayment)

// Verify payment
router.get("/payment/verify", verifyPayment)

router.post("/installments/:scheduleItemId/payment", verifyToken, checkCorporateOwnerRole, createInstallmentPayment)

// Get payment by contract
router.get("/contracts/:contractId/payment", verifyToken, getPaymentByContract)

// Commission preview for a contract (used by the payment modal before paying)
router.get("/contracts/:contractId/commission-preview", verifyToken, getContractCommissionPreview)

// Stripe webhook (use raw body parser for signature verification)
router.post("/webhook/stripe", express.raw({ type: "application/json" }), stripeWebhook)

// Tap Payments webhook
router.post("/webhook/tap", tapWebhook)

export default router
