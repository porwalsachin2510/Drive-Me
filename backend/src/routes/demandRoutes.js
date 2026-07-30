import express from "express"
import { verifyToken, checkAdminRole } from "../middleware/auth.js"
import { rateLimit } from "../middleware/rateLimiter.js"

import {
    getEmployees, getEmployeeById, createEmployee, updateEmployee, updateSalary, deleteEmployee,
    getEmployeeWallet, payEmployeeSalary,
} from "../controllers/demandEmployeeController.js"

import {
    getLeads, getLeadById, createLead, updateLead, assignLead, updateLeadStage,
    addActivity, bulkAssignLeads, deleteLead,
    getPublicCampaign, publicCreateLead, webhookCreateLead, bulkImportLeads,
} from "../controllers/demandLeadController.js"

import {
    getCampaigns, createCampaign, updateCampaign, deleteCampaign, rotateWebhookSecret,
} from "../controllers/demandCampaignController.js"

import {
    getRules, createRule, updateRule, deleteRule,
    getCommissions, createCommission, updateCommissionStatus, deleteCommission,
    reconcileCommissions,
} from "../controllers/demandCommissionController.js"

import {
    getExpenses, createExpense, updateExpense, updateApproval, updatePayment, deleteExpense,
} from "../controllers/demandExpenseController.js"

import {
    getPerformanceDashboard, getFinancialDashboard,
} from "../controllers/demandDashboardController.js"

import { getReport } from "../controllers/demandReportController.js"

const router = express.Router()

/* =================== PUBLIC (no auth) — automatic lead capture =================== */
// These MUST be declared before the admin auth middleware below.

// Public enquiry form meta + submission (rate-limited to curb abuse).
router.get("/public/campaigns/:slug", rateLimit({ keyName: "dg-public-get", max: 60 }), getPublicCampaign)
router.post("/public/leads/:slug", rateLimit({ keyName: "dg-public-lead", windowMs: 60 * 1000, max: 8 }), publicCreateLead)

// Webhook intake for external sources (secured by per-campaign secret token).
router.post("/webhooks/leads/:slug", rateLimit({ keyName: "dg-webhook", windowMs: 60 * 1000, max: 120 }), webhookCreateLead)

// The rest of the Demand Generation module is admin-only
router.use(verifyToken, checkAdminRole)

// ---- Workforce / Employees ----
router.get("/employees", getEmployees)
router.post("/employees", createEmployee)
router.get("/employees/:id", getEmployeeById)
router.put("/employees/:id", updateEmployee)
router.put("/employees/:id/salary", updateSalary)
router.get("/employees/:id/wallet", getEmployeeWallet)
router.post("/employees/:id/pay-salary", payEmployeeSalary)
router.delete("/employees/:id", deleteEmployee)

// ---- Leads / Workflow ----
router.get("/leads", getLeads)
router.post("/leads", createLead)
router.post("/leads/bulk-assign", bulkAssignLeads)
router.post("/leads/bulk-import", bulkImportLeads)
router.get("/leads/:id", getLeadById)
router.put("/leads/:id", updateLead)
router.patch("/leads/:id/assign", assignLead)
router.patch("/leads/:id/stage", updateLeadStage)
router.post("/leads/:id/activity", addActivity)
router.delete("/leads/:id", deleteLead)

// ---- Campaigns ----
router.get("/campaigns", getCampaigns)
router.post("/campaigns", createCampaign)
router.put("/campaigns/:id", updateCampaign)
router.post("/campaigns/:id/rotate-secret", rotateWebhookSecret)
router.delete("/campaigns/:id", deleteCampaign)

// ---- Commission Rules ----
router.get("/commission-rules", getRules)
router.post("/commission-rules", createRule)
router.put("/commission-rules/:id", updateRule)
router.delete("/commission-rules/:id", deleteRule)

// ---- Earned Commissions ----
router.get("/commissions", getCommissions)
router.post("/commissions", createCommission)
router.post("/commissions/reconcile", reconcileCommissions)
router.patch("/commissions/:id/status", updateCommissionStatus)
router.delete("/commissions/:id", deleteCommission)

// ---- Expenses ----
router.get("/expenses", getExpenses)
router.post("/expenses", createExpense)
router.put("/expenses/:id", updateExpense)
router.patch("/expenses/:id/approval", updateApproval)
router.patch("/expenses/:id/payment", updatePayment)
router.delete("/expenses/:id", deleteExpense)

// ---- Dashboards ----
router.get("/dashboard/performance", getPerformanceDashboard)
router.get("/dashboard/financial", getFinancialDashboard)

// ---- Reports ----
router.get("/reports", getReport)

export default router