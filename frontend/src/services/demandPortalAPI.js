import axios from "axios"

/**
 * Demand Generation Staff Portal API client.
 *
 * This uses its OWN axios instance and its OWN token (`dgPortalToken`) so a
 * field rep / finance officer session never collides with the main customer/
 * admin session token used by src/utils/api.js.
 */

const PORTAL_TOKEN_KEY = "dgPortalToken"
const PORTAL_EMPLOYEE_KEY = "dgPortalEmployee"

const portalApi = axios.create({
    baseURL: `${import.meta.env.VITE_BACKEND_URL}/api/demand-portal`,
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
})

portalApi.interceptors.request.use((config) => {
    const token = localStorage.getItem(PORTAL_TOKEN_KEY)
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

portalApi.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error.response?.status === 401 && localStorage.getItem(PORTAL_TOKEN_KEY)) {
            localStorage.removeItem(PORTAL_TOKEN_KEY)
            localStorage.removeItem(PORTAL_EMPLOYEE_KEY)
            if (!window.location.pathname.startsWith("/staff-login")) {
                window.location.href = "/staff-login"
            }
        }
        return Promise.reject(error)
    }
)

const unwrap = (res) => res.data

// ---- Session ----
export const portalLogin = async (payload) => {
    const data = await portalApi.post("/login", payload).then(unwrap)
    if (data?.success && data.token) {
        localStorage.setItem(PORTAL_TOKEN_KEY, data.token)
        localStorage.setItem(PORTAL_EMPLOYEE_KEY, JSON.stringify(data.employee))
    }
    return data
}

export const portalLogout = () => {
    localStorage.removeItem(PORTAL_TOKEN_KEY)
    localStorage.removeItem(PORTAL_EMPLOYEE_KEY)
}

export const getPortalToken = () => localStorage.getItem(PORTAL_TOKEN_KEY)

export const getPortalEmployee = () => {
    try {
        return JSON.parse(localStorage.getItem(PORTAL_EMPLOYEE_KEY) || "null")
    } catch {
        return null
    }
}

export const getMe = () => portalApi.get("/me").then(unwrap)

// ---- Field (Rahul) ----
export const getMyLeads = (params = {}) => portalApi.get("/leads", { params }).then(unwrap)
export const getMyLead = (id) => portalApi.get(`/leads/${id}`).then(unwrap)
export const updateMyLeadStage = (id, payload) => portalApi.patch(`/leads/${id}/stage`, payload).then(unwrap)
export const onboardMyLead = (id, payload) => {
    // The onboarding form may include file uploads (profile image, trade
    // license, company logo), so it can be sent as multipart FormData. Let the
    // browser set the multipart boundary automatically in that case.
    const isForm = typeof FormData !== "undefined" && payload instanceof FormData
    return portalApi
        .post(`/leads/${id}/onboard`, payload, isForm ? { headers: { "Content-Type": "multipart/form-data" } } : undefined)
        .then(unwrap)
}
export const addMyLeadActivity = (id, payload) => portalApi.post(`/leads/${id}/activity`, payload).then(unwrap)
export const getMyExpenses = () => portalApi.get("/expenses").then(unwrap)
export const submitMyExpense = (payload) => portalApi.post("/expenses", payload).then(unwrap)
export const getMyCommissions = () => portalApi.get("/commissions").then(unwrap)

// ---- Wallet (any authenticated staff: field + finance) ----
export const getMyWallet = () => portalApi.get("/wallet").then(unwrap)
export const requestStaffWithdrawal = (payload) => portalApi.post("/wallet/withdraw", payload).then(unwrap)

// ---- Notifications ----
export const getMyNotifications = (params = {}) => portalApi.get("/notifications", { params }).then(unwrap)
export const markNotificationRead = (id) => portalApi.patch(`/notifications/${id}/read`).then(unwrap)
export const markAllNotificationsRead = () => portalApi.patch("/notifications/read-all").then(unwrap)

// ---- Finance ----
export const getFinanceCommissions = (params = {}) => portalApi.get("/finance/commissions", { params }).then(unwrap)
export const updateFinanceCommissionStatus = (id, status) =>
    portalApi.patch(`/finance/commissions/${id}/status`, { status }).then(unwrap)
export const getFinanceExpenses = (params = {}) => portalApi.get("/finance/expenses", { params }).then(unwrap)
export const updateFinanceExpenseApproval = (id, approvalStatus, rejectionReason = "") =>
    portalApi.patch(`/finance/expenses/${id}/approval`, { approvalStatus, rejectionReason }).then(unwrap)
export const updateFinanceExpensePayment = (id, paymentStatus) =>
    portalApi.patch(`/finance/expenses/${id}/payment`, { paymentStatus }).then(unwrap)
export const getFinancePayoutSummary = () => portalApi.get("/finance/summary").then(unwrap)

// ---- Constants ----
export const LEAD_STAGES = [
    "NEW", "ASSIGNED", "CONTACTED", "FOLLOW_UP", "INTERESTED",
    "DOCUMENTATION_PENDING", "ONBOARDED", "ACTIVE", "LOST",
]

// Stages a field rep is allowed to move a lead into (cannot go back to NEW).
export const FIELD_STAGE_OPTIONS = [
    "ASSIGNED", "CONTACTED", "FOLLOW_UP", "INTERESTED",
    "DOCUMENTATION_PENDING", "ONBOARDED", "ACTIVE", "LOST",
]

export const EXPENSE_CATEGORIES = ["TRAVEL", "FUEL", "MEALS", "ACCOMMODATION", "MARKETING", "OTHER"]

// Payment methods a field rep can select while onboarding a customer/partner.
export const PAYMENT_METHODS = ["Cash", "Credit Card", "Bank Transfer", "Mobile Wallet"]

// Platform roles a field employee can onboard a lead into (mirrors the public
// Register page). The onboarding form defaults to the lead's intended role but
// the employee may change it.
export const ONBOARD_ROLES = [
    { id: "COMMUTER", label: "Commuter" },
    { id: "CORPORATE", label: "Corporate" },
    { id: "B2C_PARTNER", label: "B2C Partner" },
    { id: "B2B_PARTNER", label: "B2B Partner" },
]

// Roles that must accept the Terms & Conditions before onboarding.
export const ONBOARD_ROLES_REQUIRING_TERMS = ["CORPORATE", "B2C_PARTNER", "B2B_PARTNER"]

// Resolve which platform role a lead was INTENDED for — from its own typing,
// then (for loosely-typed / legacy leads) the campaign it came in under.
export const roleForLeadValue = (lead) => {
    if (!lead) return "COMMUTER"
    if (lead.partnerType === "B2B") return "B2B_PARTNER"
    if (lead.partnerType === "B2C") return "B2C_PARTNER"
    if (lead.partnerType === "CORPORATE") return "CORPORATE"
    const target = lead.campaign?.target
    if (lead.leadCategory === "PARTNER") {
        if (target === "B2C_PARTNER") return "B2C_PARTNER"
        if (target === "CORPORATE") return "CORPORATE"
        return "B2B_PARTNER"
    }
    if (lead.leadCategory === "CUSTOMER") return "COMMUTER"
    if (target === "B2B_PARTNER") return "B2B_PARTNER"
    if (target === "B2C_PARTNER") return "B2C_PARTNER"
    if (target === "CORPORATE") return "CORPORATE"
    return "COMMUTER"
}

const ROLE_LABELS = {
    COMMUTER: "Commuter",
    CORPORATE: "Corporate",
    B2C_PARTNER: "B2C Partner",
    B2B_PARTNER: "B2B Partner",
}

// Which platform role a lead becomes once onboarded (for display).
export const roleForLeadLabel = (lead) => ROLE_LABELS[roleForLeadValue(lead)] || "Commuter"

export default portalApi