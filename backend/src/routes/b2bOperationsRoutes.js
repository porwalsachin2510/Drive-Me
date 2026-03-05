import express from "express";
import { verifyToken, checkB2BPartnerRole } from "../middleware/auth.js";
import {
    createDedicatedRoutes,
    getVehicleSeatMap,
    allocateEmployeesToSeats,
    handleTemporaryTransfer,
    getOperationsDashboard,
    generateClientReports,
    getAvailableVehicles,
    getAvailableDrivers
} from "../controllers/b2bOperationsController.js";

const router = express.Router();

// Route and fleet management
router.post("/dedicated-routes", verifyToken, checkB2BPartnerRole, createDedicatedRoutes);
router.get("/vehicle/:vehicleId/seat-map", verifyToken, checkB2BPartnerRole, getVehicleSeatMap);
router.post("/allocate-seats", verifyToken, checkB2BPartnerRole, allocateEmployeesToSeats);
router.post("/temporary-transfer", verifyToken, checkB2BPartnerRole, handleTemporaryTransfer);

// Available vehicles and drivers for assignment
router.get("/vehicles/available", verifyToken, checkB2BPartnerRole, getAvailableVehicles);
router.get("/drivers/available", verifyToken, checkB2BPartnerRole, getAvailableDrivers);

// Dashboard and reporting
router.get("/dashboard", verifyToken, checkB2BPartnerRole, getOperationsDashboard);
router.post("/generate-report", verifyToken, checkB2BPartnerRole, generateClientReports);

export default router;
