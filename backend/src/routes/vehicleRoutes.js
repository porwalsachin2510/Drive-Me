import express from "express"
import {
    addVehicle,
    getMyVehicles,
    searchVehicles,
    getVehicleById,
    getFleetOwnerVehicles,
    updateVehicle,
    deleteVehicle,
    updateVehicleStatus,
    getAvailableVehicles,
} from "../controllers/vehicleController.js"
import { verifyToken, checkFleetOwnerRole } from "../middleware/auth.js"
import { upload } from "../Config/multerConfig.js"

const router = express.Router()

// Public routes
router.get("/search", searchVehicles)
router.get("/fleet-owner/:fleetOwnerId", getFleetOwnerVehicles)
router.get("/:id", getVehicleById)

// Protected routes (Fleet Owner only)
router.post(
    "/",
    verifyToken,
    checkFleetOwnerRole,
    upload.fields([
        { name: "images", maxCount: 10 },
        { name: "registration", maxCount: 1 },
        { name: "insurance", maxCount: 1 },
        { name: "inspection", maxCount: 1 },
    ]),
    addVehicle,
)
router.get("/my/vehicles", verifyToken, checkFleetOwnerRole, getMyVehicles)
router.put(
    "/:id",
    verifyToken,
    checkFleetOwnerRole,
    upload.fields([
        { name: "images", maxCount: 10 },
        { name: "registration", maxCount: 1 },
        { name: "insurance", maxCount: 1 },
        { name: "inspection", maxCount: 1 },
    ]),
    updateVehicle,
)
router.delete("/:id", verifyToken, checkFleetOwnerRole, deleteVehicle)
router.patch("/:id/status", verifyToken, checkFleetOwnerRole, updateVehicleStatus)
router.get("/available", verifyToken, checkFleetOwnerRole, getAvailableVehicles)
export default router
