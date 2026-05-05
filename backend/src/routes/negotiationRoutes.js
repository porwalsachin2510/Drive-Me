import express from "express"
import {
    requestNegotiation,
    getAllNegotiations,
    getNegotiationDetails,
    adminNegotiationAction,
    b2bPartnerResponse,
    completeNegotiation,
    cancelNegotiation,
    failNegotiation,
    addNegotiationNote,
    getMyNegotiations,
    getPartnerNegotiations,
} from "../controllers/adminNegotiationController.js"
import { verifyToken, checkAdminRole } from "../middleware/auth.js"

const router = express.Router()

// Corporate user routes
router.post("/quotations/:quotationId/request-negotiation", verifyToken, requestNegotiation)
router.get("/my-negotiations", verifyToken, getMyNegotiations)

// B2B Partner routes
router.get("/partner-negotiations", verifyToken, getPartnerNegotiations)
router.post("/negotiations/:negotiationId/b2b-response", verifyToken, b2bPartnerResponse)

// Cancel (can be done by corporate or admin)
router.post("/negotiations/:negotiationId/cancel", verifyToken, cancelNegotiation)

// Admin only routes
router.get("/admin/negotiations", verifyToken, checkAdminRole, getAllNegotiations)
router.get("/admin/negotiations/:negotiationId", verifyToken, checkAdminRole, getNegotiationDetails)
router.post("/admin/negotiations/:negotiationId/action", verifyToken, checkAdminRole, adminNegotiationAction)
router.post("/admin/negotiations/:negotiationId/complete", verifyToken, checkAdminRole, completeNegotiation)
router.post("/admin/negotiations/:negotiationId/fail", verifyToken, checkAdminRole, failNegotiation)
router.post("/admin/negotiations/:negotiationId/notes", verifyToken, checkAdminRole, addNegotiationNote)

export default router
