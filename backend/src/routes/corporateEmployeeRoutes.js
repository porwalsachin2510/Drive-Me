import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    bulkUploadEmployees,
    uploadEmployeesFromCSV,
    getEmployees,
    updateEmployee,
    deleteEmployee,
    getEmployeeAttendance,
    getRouteUtilization,
    approveEmployeeRegistration,
    assignStopsToEmployee,
    sendInvitationEmails,
    getEmployeeFeedbackSummary,
    assignRouteToEmployee,
    deactivateEmployee,
    getCorporateRoutes
} from "../controllers/corporateEmployeeController.js";

const router = express.Router();

// Static routes MUST come before parameterized routes to avoid /:employeeId matching first

// Employee management - static routes
router.post("/bulk-upload", verifyToken, bulkUploadEmployees);
router.post("/upload-csv", verifyToken, uploadEmployeesFromCSV);
router.get("/", verifyToken, getEmployees);

// Corporate routes for assignment
router.get("/routes", verifyToken, getCorporateRoutes);

// Invitations
router.post("/send-invitations", verifyToken, sendInvitationEmails);

// Reports
router.get("/attendance", verifyToken, getEmployeeAttendance);
router.get("/route-utilization", verifyToken, getRouteUtilization);
router.get("/feedback-summary", verifyToken, getEmployeeFeedbackSummary);

// Parameterized routes - MUST come after all static routes
router.post("/approve/:employeeId", verifyToken, approveEmployeeRegistration);
router.put("/:employeeId", verifyToken, updateEmployee);
router.delete("/:employeeId", verifyToken, deleteEmployee);
router.patch("/:employeeId/assign-stops", verifyToken, assignStopsToEmployee);
router.put("/:employeeId/assign-route", verifyToken, assignRouteToEmployee);
router.put("/:employeeId/deactivate", verifyToken, deactivateEmployee);

export default router;
