import express from "express";
import { verifyToken, resolveCorporateContext } from "../middleware/auth.js";
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
    getCorporateRoutes,
    getRouteSchedule,
    resetEmployeePassword
} from "../controllers/corporateEmployeeController.js";

const router = express.Router();

// Static routes MUST come before parameterized routes to avoid /:employeeId matching first

// All corporate employee operations support a B2B partner acting on behalf of
// the corporate for MANAGED-service contracts (via onBehalfContractId).
// resolveCorporateContext scopes req.userId to the corporate owner in that case.

// Employee management - static routes
router.post("/bulk-upload", verifyToken, resolveCorporateContext, bulkUploadEmployees);
router.post("/upload-csv", verifyToken, resolveCorporateContext, uploadEmployeesFromCSV);
router.get("/", verifyToken, getEmployees);

// Corporate routes for assignment
router.get("/routes", verifyToken, resolveCorporateContext, getCorporateRoutes);
router.get("/route-schedule/:routeId", verifyToken, resolveCorporateContext, getRouteSchedule);

// Invitations
router.post("/send-invitations", verifyToken, resolveCorporateContext, sendInvitationEmails);

// Reports
router.get("/attendance", verifyToken, resolveCorporateContext, getEmployeeAttendance);
router.get("/route-utilization", verifyToken, resolveCorporateContext, getRouteUtilization);
router.get("/feedback-summary", verifyToken, resolveCorporateContext, getEmployeeFeedbackSummary);

// Parameterized routes - MUST come after all static routes
router.post("/approve/:employeeId", verifyToken, resolveCorporateContext, approveEmployeeRegistration);
router.put("/:employeeId", verifyToken, resolveCorporateContext, updateEmployee);
router.delete("/:employeeId", verifyToken, resolveCorporateContext, deleteEmployee);
router.patch("/:employeeId/assign-stops", verifyToken, resolveCorporateContext, assignStopsToEmployee);
router.put("/:employeeId/assign-route", verifyToken, resolveCorporateContext, assignRouteToEmployee);
router.put("/:employeeId/deactivate", verifyToken, resolveCorporateContext, deactivateEmployee);
router.post("/:employeeId/reset-password", verifyToken, resolveCorporateContext, resetEmployeePassword);

export default router;
