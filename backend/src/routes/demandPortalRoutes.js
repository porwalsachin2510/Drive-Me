import express from "express"
import { verifyDemandPortalToken, checkFieldRole, checkFinanceRole } from "../middleware/auth.js"
import { upload, handleMulterError } from "../Config/multerConfig.js"
import {
    portalLogin, getMe,
    getMyLeads, getMyLeadById, updateMyLeadStage, addMyLeadActivity, onboardMyLead,
    getMyExpenses, submitMyExpense, getMyCommissions,
    getFinanceCommissions, financeUpdateCommissionStatus,
    getFinanceExpenses, financeUpdateExpenseApproval, financeUpdateExpensePayment, getFinancePayoutSummary,
    getMyNotifications, markNotificationRead, markAllNotificationsRead,
    getMyWallet, requestStaffWithdrawal,
} from "../controllers/demandPortalController.js"

const router = express.Router()

// ---- Public ----
router.post("/login", portalLogin)

// ---- Authenticated staff ----
router.use(verifyDemandPortalToken)
router.get("/me", getMe)

// ---- Notifications (any authenticated staff) ----
router.get("/notifications", getMyNotifications)
router.patch("/notifications/read-all", markAllNotificationsRead)
router.patch("/notifications/:id/read", markNotificationRead)

// ---- Wallet (any authenticated staff: field + finance) ----
router.get("/wallet", getMyWallet)
router.post("/wallet/withdraw", requestStaffWithdrawal)

// ---- Field rep (Rahul) ----
router.get("/leads", checkFieldRole, getMyLeads)
router.get("/leads/:id", checkFieldRole, getMyLeadById)
router.patch("/leads/:id/stage", checkFieldRole, updateMyLeadStage)
router.post(
    "/leads/:id/onboard",
    checkFieldRole,
    upload.fields([
        { name: "profileImage", maxCount: 1 },
        { name: "tradeLicense", maxCount: 1 },
        { name: "companyLogo", maxCount: 1 },
    ]),
    handleMulterError,
    onboardMyLead
)
router.post("/leads/:id/activity", checkFieldRole, addMyLeadActivity)
router.get("/expenses", checkFieldRole, getMyExpenses)
router.post("/expenses", checkFieldRole, submitMyExpense)
router.get("/commissions", checkFieldRole, getMyCommissions)

// ---- Finance ----
router.get("/finance/commissions", checkFinanceRole, getFinanceCommissions)
router.patch("/finance/commissions/:id/status", checkFinanceRole, financeUpdateCommissionStatus)
router.get("/finance/expenses", checkFinanceRole, getFinanceExpenses)
router.patch("/finance/expenses/:id/approval", checkFinanceRole, financeUpdateExpenseApproval)
router.patch("/finance/expenses/:id/payment", checkFinanceRole, financeUpdateExpensePayment)
router.get("/finance/summary", checkFinanceRole, getFinancePayoutSummary)

export default router