import express from "express"
import { verifyToken } from "../middleware/auth.js"
import {
    listRequests,
    createRequest,
    updateStatus,
    addComment,
    getTargets,
} from "../controllers/rosterChangeRequestController.js"

const router = express.Router()

// Access control (corporate owner vs partner) is enforced inside the controller
// via resolveAccess, since both roles share these endpoints.

// Roster/route items available as targets for MODIFY / REMOVE requests.
router.get("/:contractId/targets", verifyToken, getTargets)

// List all change requests for a contract (+ summary).
router.get("/:contractId", verifyToken, listRequests)

// Corporate raises a new change request.
router.post("/:contractId", verifyToken, createRequest)

// Drive the workflow (partner: acknowledge/progress/complete/reject,
// corporate: cancel).
router.patch("/:contractId/:requestId/status", verifyToken, updateStatus)

// Either party posts a comment on a request.
router.post("/:contractId/:requestId/comment", verifyToken, addComment)

export default router
