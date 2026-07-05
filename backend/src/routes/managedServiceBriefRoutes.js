import express from "express"
import { verifyToken } from "../middleware/auth.js"
import {
    getBrief,
    updateBrief,
    submitBrief,
    respondToBrief,
    updateItemFulfillment,
    reviewItem,
    postMessage,
    getBriefByQuotation,
    updateBriefByQuotation,
    submitBriefByQuotation,
    postMessageByQuotation,
} from "../controllers/managedServiceBriefController.js"

const router = express.Router()

// Access control (corporate owner vs partner) is enforced inside the controller
// via resolveBriefAccess / resolveBriefAccessByQuotation, since both roles share
// these endpoints.

// --- Quotation-stage brief (before a contract exists) ---
// Declared BEFORE the "/:contractId" routes so the literal "quotation" prefix is
// not swallowed by the :contractId param.
router.get("/quotation/:quotationId", verifyToken, getBriefByQuotation)
router.put("/quotation/:quotationId", verifyToken, updateBriefByQuotation)
router.post("/quotation/:quotationId/submit", verifyToken, submitBriefByQuotation)
router.post("/quotation/:quotationId/messages", verifyToken, postMessageByQuotation)

// Read the brief (corporate or partner)
router.get("/:contractId", verifyToken, getBrief)

// Corporate edits / submits the brief
router.put("/:contractId", verifyToken, updateBrief)
router.post("/:contractId/submit", verifyToken, submitBrief)

// Partner accepts the brief or requests clarification (execution handshake)
router.post("/:contractId/respond", verifyToken, respondToBrief)

// Partner updates fulfillment of a route/roster item
router.patch(
    "/:contractId/items/:section/:itemId/fulfillment",
    verifyToken,
    updateItemFulfillment,
)

// Corporate approves / rejects a partner-fulfilled item
router.patch(
    "/:contractId/items/:section/:itemId/review",
    verifyToken,
    reviewItem,
)

// Either party posts a clarification message
router.post("/:contractId/messages", verifyToken, postMessage)

export default router
