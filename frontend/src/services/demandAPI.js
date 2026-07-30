import axios from "axios"
import api from "../utils/api"

/**
 * Demand Generation API client.
 * All endpoints are admin-only and mounted under /api/demand on the backend.
 */

const unwrap = (res) => res.data

// ---------------- Employees / Workforce ----------------
export const getEmployees = (params = {}) => api.get("/demand/employees", { params }).then(unwrap)
export const getEmployee = (id) => api.get(`/demand/employees/${id}`).then(unwrap)
export const createEmployee = (payload) => api.post("/demand/employees", payload).then(unwrap)
export const updateEmployee = (id, payload) => api.put(`/demand/employees/${id}`, payload).then(unwrap)
export const updateSalary = (id, payload) => api.put(`/demand/employees/${id}/salary`, payload).then(unwrap)
export const getEmployeeWallet = (id) => api.get(`/demand/employees/${id}/wallet`).then(unwrap)
export const payEmployeeSalary = (id, payload) => api.post(`/demand/employees/${id}/pay-salary`, payload).then(unwrap)
export const deleteEmployee = (id) => api.delete(`/demand/employees/${id}`).then(unwrap)

// ---------------- Leads / Workflow ----------------
export const getLeads = (params = {}) => api.get("/demand/leads", { params }).then(unwrap)
export const getLead = (id) => api.get(`/demand/leads/${id}`).then(unwrap)
export const createLead = (payload) => api.post("/demand/leads", payload).then(unwrap)
export const updateLead = (id, payload) => api.put(`/demand/leads/${id}`, payload).then(unwrap)
export const assignLead = (id, payload) => api.patch(`/demand/leads/${id}/assign`, payload).then(unwrap)
export const updateLeadStage = (id, payload) => api.patch(`/demand/leads/${id}/stage`, payload).then(unwrap)
export const addLeadActivity = (id, payload) => api.post(`/demand/leads/${id}/activity`, payload).then(unwrap)
export const bulkAssignLeads = (payload) => api.post("/demand/leads/bulk-assign", payload).then(unwrap)
export const deleteLead = (id) => api.delete(`/demand/leads/${id}`).then(unwrap)

export const bulkImportLeads = (payload) => api.post("/demand/leads/bulk-import", payload).then(unwrap)

// ---------------- Campaigns ----------------
export const getCampaigns = (params = {}) => api.get("/demand/campaigns", { params }).then(unwrap)
export const createCampaign = (payload) => api.post("/demand/campaigns", payload).then(unwrap)
export const updateCampaign = (id, payload) => api.put(`/demand/campaigns/${id}`, payload).then(unwrap)
export const rotateCampaignSecret = (id) => api.post(`/demand/campaigns/${id}/rotate-secret`).then(unwrap)
export const deleteCampaign = (id) => api.delete(`/demand/campaigns/${id}`).then(unwrap)

// ---------------- Public lead capture (no auth) ----------------
// Uses a bare axios instance so no admin/session token or interceptors leak
// into the public request.
const publicApi = axios.create({
    baseURL: `${import.meta.env.VITE_BACKEND_URL}/api`,
    headers: { "Content-Type": "application/json" },
})
export const getPublicCampaign = (slug) => publicApi.get(`/demand/public/campaigns/${slug}`).then(unwrap)
export const submitPublicLead = (slug, payload) => publicApi.post(`/demand/public/leads/${slug}`, payload).then(unwrap)

// ---------------- Commission Rules ----------------
export const getCommissionRules = () => api.get("/demand/commission-rules").then(unwrap)
export const createCommissionRule = (payload) => api.post("/demand/commission-rules", payload).then(unwrap)
export const updateCommissionRule = (id, payload) => api.put(`/demand/commission-rules/${id}`, payload).then(unwrap)
export const deleteCommissionRule = (id) => api.delete(`/demand/commission-rules/${id}`).then(unwrap)

// ---------------- Earned Commissions ----------------
export const getCommissions = (params = {}) => api.get("/demand/commissions", { params }).then(unwrap)
export const createCommission = (payload) => api.post("/demand/commissions", payload).then(unwrap)
export const updateCommissionStatus = (id, status) => api.patch(`/demand/commissions/${id}/status`, { status }).then(unwrap)
export const deleteCommission = (id) => api.delete(`/demand/commissions/${id}`).then(unwrap)
export const reconcileCommissions = () => api.post("/demand/commissions/reconcile").then(unwrap)

// ---------------- Expenses ----------------
export const getExpenses = (params = {}) => api.get("/demand/expenses", { params }).then(unwrap)
export const createExpense = (payload) => api.post("/demand/expenses", payload).then(unwrap)
export const updateExpense = (id, payload) => api.put(`/demand/expenses/${id}`, payload).then(unwrap)
export const updateExpenseApproval = (id, payload) => api.patch(`/demand/expenses/${id}/approval`, payload).then(unwrap)
export const updateExpensePayment = (id, paymentStatus) => api.patch(`/demand/expenses/${id}/payment`, { paymentStatus }).then(unwrap)
export const deleteExpense = (id) => api.delete(`/demand/expenses/${id}`).then(unwrap)

// ---------------- Dashboards ----------------
export const getPerformanceDashboard = (params = {}) => api.get("/demand/dashboard/performance", { params }).then(unwrap)
export const getFinancialDashboard = (params = {}) => api.get("/demand/dashboard/financial", { params }).then(unwrap)

// ---------------- Reports ----------------
export const getReport = (params = {}) => api.get("/demand/reports", { params }).then(unwrap)

// ---------------- Constants ----------------
export const LEAD_STAGES = [
    "NEW", "ASSIGNED", "CONTACTED", "FOLLOW_UP", "INTERESTED",
    "DOCUMENTATION_PENDING", "ONBOARDED", "ACTIVE", "LOST",
]

export const EXPENSE_CATEGORIES = ["TRAVEL", "FUEL", "MEALS", "ACCOMMODATION", "MARKETING", "OTHER"]

export const COMMISSION_TRIGGERS = [
    "CUSTOMER_ONBOARDED", "B2B_PARTNER_ONBOARDED", "B2C_PARTNER_ONBOARDED",
    "CAMPAIGN_INCENTIVE", "MONTHLY_PERFORMANCE",
]