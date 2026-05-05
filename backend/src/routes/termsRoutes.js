import express from "express"
import {
    getLatestTerms,
    getTermsByVersion,
    createTerms,
    updateTerms,
    getAllTermsVersions,
    activateTermsVersion,
    getTermsAcceptances,
} from "../controllers/termsController.js"
import { verifyToken, checkAdminRole } from "../middleware/auth.js"

const router = express.Router()

// Public routes (for signup)
router.get("/latest", getLatestTerms)
router.get("/:version", getTermsByVersion)

// Admin routes
router.get("/", verifyToken, checkAdminRole, getAllTermsVersions)
router.post("/", verifyToken, checkAdminRole, createTerms)
router.put("/:version", verifyToken, checkAdminRole, updateTerms)
router.put("/:version/activate", verifyToken, checkAdminRole, activateTermsVersion)
router.get("/:version/acceptances", verifyToken, checkAdminRole, getTermsAcceptances)

export default router
