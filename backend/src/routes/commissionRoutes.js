import express from "express"
import {
    getAllCommissionSettings,
    getCommissionSettingsByUser,
    createCommissionSettings,
    updateCommissionSettings,
    deleteCommissionSettings,
    getContractsWithCommission,
    getCommissionSummary,
    bulkUpdateCommissionSettings,
    getUsersWithSettings,
} from "../controllers/commissionSettingsController.js"
import { verifyToken, checkAdminRole } from "../middleware/auth.js"

const router = express.Router()

// Commission Settings Management (Admin only)
router.get("/users-with-settings", verifyToken, checkAdminRole, getUsersWithSettings)
router.get("/settings", verifyToken, checkAdminRole, getAllCommissionSettings)
router.get("/settings/:userId", verifyToken, checkAdminRole, getCommissionSettingsByUser)
router.post("/settings", verifyToken, checkAdminRole, createCommissionSettings)
router.put("/settings/:userId", verifyToken, checkAdminRole, updateCommissionSettings)
router.delete("/settings/:userId", verifyToken, checkAdminRole, deleteCommissionSettings)
router.post("/settings/bulk", verifyToken, checkAdminRole, bulkUpdateCommissionSettings)

// Commission Reports (Admin only)
router.get("/contracts", verifyToken, checkAdminRole, getContractsWithCommission)
router.get("/summary", verifyToken, checkAdminRole, getCommissionSummary)

export default router
