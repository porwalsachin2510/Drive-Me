import express from "express"
import { verifyToken } from "../middleware/auth.js"
import { uploadBriefDocuments as uploadBriefDocsMiddleware, handleMulterError } from "../Config/multerConfig.js"
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
    uploadBriefDocuments,
    getImportCandidates,
    listImportableContracts,
} from "../controllers/managedServiceBriefController.js"

const router = express.Router()

// Access control (corporate owner vs partner) is enforced inside the controller
// via resolveBriefAccess / resolveBriefAccessByQuotation, since both roles share
// these endpoints.

// Upload requirement document(s) BEFORE the quotation/brief exists. Returns
// Cloudinary descriptors that the client sends in the brief payload at submit.
// Declared first so the literal path isn't swallowed by "/:contractId".
router.post(
    "/upload-documents",
    verifyToken,
    uploadBriefDocsMiddleware,
    handleMulterError,
    uploadBriefDocuments,
)

// Contracts whose brief can be imported from. Declared before "/:contractId" so
// the literal path isn't swallowed by the param. Used by the company-wide
// Employee Management screen, which has no contract id of its own.
router.get("/importable-contracts", verifyToken, listImportableContracts)

// --- Quotation-stage brief (before a contract exists) ---
// Declared BEFORE the "/:contractId" routes so the literal "quotation" prefix is
// not swallowed by the :contractId param.
router.get("/quotation/:quotationId", verifyToken, getBriefByQuotation)
router.put("/quotation/:quotationId", verifyToken, updateBriefByQuotation)
router.post("/quotation/:quotationId/submit", verifyToken, submitBriefByQuotation)
router.post("/quotation/:quotationId/messages", verifyToken, postMessageByQuotation)

// Routes & people that can be turned into real records, merged from the
// structured brief items AND the attached requirement document(s). Read-only —
// creation happens through the operational endpoints. Either party may call it.
// Declared before "/:contractId" so the sub-path resolves correctly.
router.get("/:contractId/import-candidates", verifyToken, getImportCandidates)

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
