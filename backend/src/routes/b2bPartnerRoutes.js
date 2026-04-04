import express from "express"
const router = express.Router()
import {
    getB2BPartnerOverview,
    getB2BPartnerSettings,
    updateB2BPartnerSettings,
    getB2BPartnerAnalytics,
    getB2BPartnerRoutes,
    updateB2BPartnerRoute,
    deleteB2BPartnerRoute,
    getB2BContractAssignedVehicles,
    assignRouteToContractVehicle,
    updateContractVehicle,
    updateContractDriver,
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

// B2B Partner Routes Management
router.get("/routes", verifyToken, checkFleetOwnerRole, getB2BPartnerRoutes)
router.put("/routes/:routeId", verifyToken, checkFleetOwnerRole, updateB2BPartnerRoute)
router.delete("/routes/:routeId", verifyToken, checkFleetOwnerRole, deleteB2BPartnerRoute)

// B2B Partner Contract Vehicle Management
router.get("/contracts/:contractId/assigned-vehicles", verifyToken, checkFleetOwnerRole, getB2BContractAssignedVehicles)
router.post("/contracts/:contractId/assign-route/:assignedVehicleId", verifyToken, checkFleetOwnerRole, assignRouteToContractVehicle)
router.put("/contracts/:contractId/update-vehicle/:assignedVehicleId", verifyToken, checkFleetOwnerRole, updateContractVehicle)
router.put("/contracts/:contractId/update-driver/:assignedVehicleId", verifyToken, checkFleetOwnerRole, updateContractDriver)

export default router
