import express from "express"
import {
    requestQuotation,
    getCorporateOwnerQuotations,
    getCorporateOwnerQuotationById,
    respondToQuotation,
    fetchFleetQuotations,
    getFleetQuotationById,
    corporateDecisionOnQuotation,
    negotiateQuotation
} from "../controllers/quotationController.js"
import { verifyToken, checkCorporateOwnerRole, checkFleetOwnerRole } from "../middleware/auth.js"

const router = express.Router()

// Corporate Owner routes
router.post("/request", verifyToken, checkCorporateOwnerRole, requestQuotation)

// Corporate Owner Routes
router.post(
    "/getcorporateownerquotations",
    verifyToken,
    checkCorporateOwnerRole,
    getCorporateOwnerQuotations
)

router.get(
    "/getcorporateownerquotation/:quotationId",
    verifyToken,
    checkCorporateOwnerRole,
    getCorporateOwnerQuotationById
)

// @route   POST /api/quotations/corporate/:quotationId/decision
// @desc    Corporate owner accepts or rejects the quoted price
// @access  Private (CORPORATE only)
router.post("/corporate/:quotationId/decision", verifyToken, checkCorporateOwnerRole, corporateDecisionOnQuotation)

// @route   POST /api/quotations/corporate/:quotationId/negotiate
// @desc    Corporate owner negotiates the quoted price
// @access  Private (CORPORATE only)
router.post("/corporate/:quotationId/negotiate", verifyToken, checkCorporateOwnerRole, negotiateQuotation)

// ============================================
// FLEET OWNER ROUTES (B2B_PARTNER role)
// ============================================

// @desc    Fetch all quotations for the logged-in fleet owner
// @access  Private (B2B_PARTNER only)
router.get("/fleet/my-quotations", verifyToken, checkFleetOwnerRole, fetchFleetQuotations)


// @desc    Get single quotation details for fleet owner
// @access  Private (B2B_PARTNER only)
router.get("/fleet/:quotationId", verifyToken, checkFleetOwnerRole, getFleetQuotationById)

// @desc    Fleet owner responds to quotation (approve/reject with pricing)
// @access  Private (B2B_PARTNER only)
router.post("/fleet/:quotationId/respond", verifyToken, checkFleetOwnerRole, respondToQuotation)

export default router
