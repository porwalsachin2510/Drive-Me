import express from "express"
const router = express.Router()
import {
    getContractForAssignment,
    assignVehicles,
    getAssignedVehicles,
    updateAssignmentStatus,
    reportDamage,
    getAllAssignments,
    getAssignmentById,
    updateAssignment,
} from "../controllers/vehicleAssignmentController.js";
import { verifyToken, checkFleetOwnerRole } from "../middleware/auth.js"

// Get all assignments for fleet owner
router.get("/assignments", verifyToken, checkFleetOwnerRole, getAllAssignments)

router.get("/assignment/:assignmentId", verifyToken, getAssignmentById)

// Get contract for assignment (Fleet Owner)
router.get("/contract/:contractId", verifyToken, checkFleetOwnerRole, getContractForAssignment)

// Assign vehicles (Fleet Owner)
router.post("/contract/:contractId/assign", verifyToken, checkFleetOwnerRole, assignVehicles)

router.put("/assignment/:assignmentId", verifyToken, checkFleetOwnerRole, updateAssignment)

// Get assigned vehicles
router.get("/contract/:contractId/assignments", verifyToken, getAssignedVehicles)

// Update assignment status
router.put("/assignment/:assignmentId/status", verifyToken, updateAssignmentStatus)

// Report damage
router.post("/assignment/:assignmentId/damage", verifyToken, reportDamage)

export default router
