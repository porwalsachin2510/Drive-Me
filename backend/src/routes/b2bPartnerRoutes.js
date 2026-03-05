import express from "express"
const router = express.Router()
import {
    getB2BPartnerOverview,
    getB2BPartnerSettings,
    updateB2BPartnerSettings,
    getB2BPartnerAnalytics,
} from "../controllers/b2bPartnerController.js"
import { verifyToken, checkFleetOwnerRole } from "../middleware/auth.js"
import { getB2BPartnerInvoices } from "../controllers/billingController.js"

// B2B Partner Overview (Unique - not available in existing routes)
router.get("/overview", verifyToken, checkFleetOwnerRole, getB2BPartnerOverview)

// B2B Partner Settings (Unique - not available in existing routes)
router.get("/settings", verifyToken, checkFleetOwnerRole, getB2BPartnerSettings)
router.put("/settings", verifyToken, checkFleetOwnerRole, updateB2BPartnerSettings)

// B2B Partner Analytics (Unique - not available in existing routes)
router.get("/analytics", verifyToken, checkFleetOwnerRole, getB2BPartnerAnalytics)

// B2B Partner Invoices
router.get("/invoices", verifyToken, checkFleetOwnerRole, getB2BPartnerInvoices)

export default router
