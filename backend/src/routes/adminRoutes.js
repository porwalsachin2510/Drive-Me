import express from "express"
const router = express.Router()
import { upload, handleMulterError } from "../Config/multerConfig.js"
import {
    getPendingPayments,
    getPaymentDetails,
    verifyPayment,
    getAllContracts,
    getDashboardStats,
    getAllUsers,
    getUserStats,
    suspendUser,
    activateUser,
    deleteUser,
    getUserDetails,
    editUser,
    getRecentActivity,
    getB2CProviders,
    getB2CProviderStats,
    suspendB2CProvider,
    activateB2CProvider,
    getFinanceMetrics,
    getPayoutRequests,
    getTransactions,
    approvePayout,
    rejectPayout,
    completePayout,
    processAutomaticPayout,
    getPayoutGatewayInfo,
    getFraudAlerts,
    getUserActivity,
    getSystemLogs,
    getCustomReports,
    getCommTemplates,
    getCommMessages,
    getCommConfig,
    sendWhatsAppMessage,
    sendBulkWhatsApp,
    sendEmail,
    sendBulkEmail,
    sendSMS,
    sendBulkSMS,
    updateCommConfig,
    getAdCampaigns,
    getAdStats,
    createAdCampaign,
    updateAdCampaign,
    deleteAdCampaign,
    toggleAdCampaignStatus,
    getPublicActiveCampaigns,
    trackCampaignClick,
    trackCampaignView,
    getPaymentStats,
    getRidePoolingStats,
    getPassengerInterests,
    getUserSuggestedRoutes,
    approveSuggestedRoute,
    rejectSuggestedRoute,
    getB2BStats,
    getB2BProviders,
    getB2CProvidersFromB2B,
    suspendB2BProvider,
    activateB2BProvider,
    updatePassengerInterestStatus,
    toggleOnlinePayments,
    getOnlinePaymentStatus,
    getB2CRoutes,
    createB2CRoute,
    updateB2CRoute,
    deleteB2CRoute,
    getB2CTags,
    createB2CTag,
    updateB2CTag,
    deleteB2CTag,
    getTagsByCategory,
    getPublicTags,
    getB2CPassengerReassignments,
    processPassengerReassignment,
    getB2CEarningsPayments,
    resolveFraudAlert,
    investigateFraudAlert,
    generateCustomReport,
    getB2BFleetAndDrivers,
    getB2BAnalytics,
    getB2BPartnerOverview,
    getB2BSettings,
    updateB2BSettings,
    getMonthlyRevenue,
    getBookingTrends,
    getB2CStats,
    getPendingVehicleApprovals,
    approveVehicle,
    rejectVehicle,
    // Wallet Management APIs
    getAllWallets,
    getWalletStats,
    getWalletDetails,
    getWalletByUserId,
    sendWalletNotification,
    sendBulkWalletNotifications,
    getLowBalanceWallets,
    getWalletActivityFeed,
    markWalletNotificationResponded,
    getWalletUpdatesSubscription,
    adjustWalletBalance,
    getPendingWalletNotifications,
    // Admin Management APIs
    getAllAdmins,
    getAdminStats,
    createAdmin,
    updateAdminPermissions,
    getAdminDetails,
    suspendAdmin,
    activateAdmin,
    deleteAdmin,
    getMyPermissions,
    // Revenue Reports APIs
    getCorporateRevenueReport,
    getB2CPartnerRevenueReport,
    getB2BPartnerRevenueReport,
    getRevenueSummary
} from "../controllers/adminController.js";
import { verifyToken, checkAdminRole } from "../middleware/auth.js"

// Dashboard
router.get("/dashboard/stats", verifyToken, checkAdminRole, getDashboardStats)
router.get("/recent-activity", verifyToken, checkAdminRole, getRecentActivity)
router.get("/revenue/monthly", verifyToken, checkAdminRole, getMonthlyRevenue)
router.get("/bookings/trends", verifyToken, checkAdminRole, getBookingTrends)
router.get("/b2c/stats", verifyToken, checkAdminRole, getB2CStats)

// Users Management
router.get("/users", verifyToken, checkAdminRole, getAllUsers)
router.get("/users/stats", verifyToken, checkAdminRole, getUserStats)
router.get("/users/:userId", verifyToken, checkAdminRole, getUserDetails)
router.put("/users/:userId", verifyToken, checkAdminRole, editUser)
router.put("/users/:userId/suspend", verifyToken, checkAdminRole, suspendUser)
router.put("/users/:userId/activate", verifyToken, checkAdminRole, activateUser)
router.delete("/users/:userId", verifyToken, checkAdminRole, deleteUser)

// B2C Providers Management
router.get("/providers/b2c", verifyToken, checkAdminRole, getB2CProviders)
router.get("/providers/b2c/stats", verifyToken, checkAdminRole, getB2CProviderStats)
router.put("/providers/b2c/:providerId/suspend", verifyToken, checkAdminRole, suspendB2CProvider)
router.put("/providers/b2c/:providerId/activate", verifyToken, checkAdminRole, activateB2CProvider)

// B2C Management Routes
router.get("/b2c/routes", verifyToken, checkAdminRole, getB2CRoutes)
router.post("/b2c/routes", verifyToken, checkAdminRole, createB2CRoute)
router.put("/b2c/routes/:routeId", verifyToken, checkAdminRole, updateB2CRoute)
router.delete("/b2c/routes/:routeId", verifyToken, checkAdminRole, deleteB2CRoute)

router.get("/b2c/tags", verifyToken, checkAdminRole, getB2CTags)
router.post("/b2c/tags", verifyToken, checkAdminRole, createB2CTag)
router.put("/b2c/tags/:tagId", verifyToken, checkAdminRole, updateB2CTag)
router.delete("/b2c/tags/:tagId", verifyToken, checkAdminRole, deleteB2CTag)

// Public tags endpoint (for search filtering) and partner tags endpoint
router.get("/tags/public", getPublicTags)
router.get("/tags/by-category", verifyToken, getTagsByCategory)

router.get("/b2c/passenger-reassignments", verifyToken, checkAdminRole, getB2CPassengerReassignments)
router.put("/b2c/passenger-reassignments/:reassignmentId/process", verifyToken, checkAdminRole, processPassengerReassignment)

router.get("/b2c/earnings-payments", verifyToken, checkAdminRole, getB2CEarningsPayments)

// B2B Partner Management Routes
router.get("/b2b/overview", verifyToken, checkAdminRole, getB2BPartnerOverview)
router.get("/b2b/fleet-drivers", verifyToken, checkAdminRole, getB2BFleetAndDrivers)
router.get("/b2b/analytics", verifyToken, checkAdminRole, getB2BAnalytics)
router.get("/b2b/settings", verifyToken, checkAdminRole, getB2BSettings)
router.put("/b2b/settings", verifyToken, checkAdminRole, updateB2BSettings)

// Finance Management
router.get("/finance/metrics", verifyToken, checkAdminRole, getFinanceMetrics)
router.get("/finance/payouts", verifyToken, checkAdminRole, getPayoutRequests)
router.get("/finance/transactions", verifyToken, checkAdminRole, getTransactions)
router.get("/finance/payouts/:payoutId/gateway-info", verifyToken, checkAdminRole, getPayoutGatewayInfo)
router.put("/finance/payouts/:payoutId/approve", verifyToken, checkAdminRole, approvePayout)
router.put("/finance/payouts/:payoutId/reject", verifyToken, checkAdminRole, rejectPayout)
router.put("/finance/payouts/:payoutId/complete", verifyToken, checkAdminRole, completePayout)
router.put("/finance/payouts/:payoutId/process-automatic", verifyToken, checkAdminRole, processAutomaticPayout)

// Reports Management
router.get("/reports/fraud-alerts", verifyToken, checkAdminRole, getFraudAlerts)
router.put("/reports/fraud-alerts/:alertId/resolve", verifyToken, checkAdminRole, resolveFraudAlert)
router.put("/reports/fraud-alerts/:alertId/investigate", verifyToken, checkAdminRole, investigateFraudAlert)
router.get("/reports/user-activity", verifyToken, checkAdminRole, getUserActivity)
router.get("/reports/system-logs", verifyToken, checkAdminRole, getSystemLogs)
router.get("/reports", verifyToken, checkAdminRole, getCustomReports)
router.post("/reports/generate", verifyToken, checkAdminRole, generateCustomReport)

// Revenue Reports - User-wise and Vendor-wise
router.get("/reports/revenue/summary", verifyToken, checkAdminRole, getRevenueSummary)
router.get("/reports/revenue/corporate", verifyToken, checkAdminRole, getCorporateRevenueReport)
router.get("/reports/revenue/b2c-partners", verifyToken, checkAdminRole, getB2CPartnerRevenueReport)
router.get("/reports/revenue/b2b-partners", verifyToken, checkAdminRole, getB2BPartnerRevenueReport)

// Communication Management
router.get("/comm/templates", verifyToken, checkAdminRole, getCommTemplates)
router.get("/comm/messages", verifyToken, checkAdminRole, getCommMessages)
router.get("/comm/config", verifyToken, checkAdminRole, getCommConfig)
router.post("/comm/whatsapp/send", verifyToken, checkAdminRole, sendWhatsAppMessage)
router.post("/comm/whatsapp/send-bulk", verifyToken, checkAdminRole, sendBulkWhatsApp)
router.post("/comm/email/send", verifyToken, checkAdminRole, sendEmail)
router.post("/comm/email/send-bulk", verifyToken, checkAdminRole, sendBulkEmail)
router.post("/comm/sms/send", verifyToken, checkAdminRole, sendSMS)
router.post("/comm/sms/send-bulk", verifyToken, checkAdminRole, sendBulkSMS)
router.put("/comm/config/:type", verifyToken, checkAdminRole, updateCommConfig)

// Public Advertisement Routes (no auth required)
router.get("/ads/public/campaigns", getPublicActiveCampaigns)
router.post("/ads/public/campaigns/:campaignId/click", trackCampaignClick)
router.post("/ads/public/campaigns/:campaignId/view", trackCampaignView)

// Advertisement Management
router.get("/ads/campaigns", verifyToken, checkAdminRole, getAdCampaigns)
router.get("/ads/stats", verifyToken, checkAdminRole, getAdStats)
router.post("/ads/campaigns", verifyToken, checkAdminRole, upload.single('campaignImage'), handleMulterError, createAdCampaign)
router.put("/ads/campaigns/:campaignId", verifyToken, checkAdminRole, upload.single('campaignImage'), handleMulterError, updateAdCampaign)
router.delete("/ads/campaigns/:campaignId", verifyToken, checkAdminRole, deleteAdCampaign)
router.put("/ads/campaigns/:campaignId/status", verifyToken, checkAdminRole, toggleAdCampaignStatus)

// Ride Pooling Management
router.get("/ride-pooling/stats", verifyToken, checkAdminRole, getRidePoolingStats)
router.get("/ride-pooling/passenger-interests", verifyToken, checkAdminRole, getPassengerInterests)
router.put("/ride-pooling/passenger-interests/:interestId/status", verifyToken, checkAdminRole, updatePassengerInterestStatus)
router.get("/ride-pooling/suggested-routes", verifyToken, checkAdminRole, getUserSuggestedRoutes)
router.put("/ride-pooling/suggested-routes/:routeId/approve", verifyToken, checkAdminRole, approveSuggestedRoute)
router.put("/ride-pooling/suggested-routes/:routeId/reject", verifyToken, checkAdminRole, rejectSuggestedRoute)

// B2B Listings Management
router.get("/b2b/stats", verifyToken, checkAdminRole, getB2BStats)
router.get("/b2b/providers", verifyToken, checkAdminRole, getB2BProviders)
router.get("/b2b/b2c-providers", verifyToken, checkAdminRole, getB2CProvidersFromB2B)
router.put("/b2b/providers/:providerId/suspend", verifyToken, checkAdminRole, suspendB2BProvider)
router.put("/b2b/providers/:providerId/activate", verifyToken, checkAdminRole, activateB2BProvider)

// Online Payment Control
router.get("/payments/online/status", verifyToken, checkAdminRole, getOnlinePaymentStatus)
router.put("/payments/online/toggle", verifyToken, checkAdminRole, toggleOnlinePayments)

// Payments
router.get("/payments/pending", verifyToken, checkAdminRole, getPendingPayments)
router.get("/payments/stats", verifyToken, checkAdminRole, getPaymentStats)
router.get("/payments/:paymentId", verifyToken, checkAdminRole, getPaymentDetails)
router.put("/payments/:paymentId/verify", verifyToken, checkAdminRole, verifyPayment)

// Contracts
router.get("/contracts", verifyToken, checkAdminRole, getAllContracts)

// Vehicle Approvals
router.get("/vehicles/pending", verifyToken, checkAdminRole, getPendingVehicleApprovals)
router.put("/vehicles/:vehicleId/approve", verifyToken, checkAdminRole, approveVehicle)
router.put("/vehicles/:vehicleId/reject", verifyToken, checkAdminRole, rejectVehicle)

// Wallet Management Routes
router.get("/wallets", verifyToken, checkAdminRole, getAllWallets)
router.get("/wallets/stats", verifyToken, checkAdminRole, getWalletStats)
router.get("/wallets/low-balance", verifyToken, checkAdminRole, getLowBalanceWallets)
router.get("/wallets/activity-feed", verifyToken, checkAdminRole, getWalletActivityFeed)
router.get("/wallets/pending-notifications", verifyToken, checkAdminRole, getPendingWalletNotifications)
router.get("/wallets/subscription-info", verifyToken, checkAdminRole, getWalletUpdatesSubscription)
router.get("/wallets/:walletId", verifyToken, checkAdminRole, getWalletDetails)
router.get("/wallets/user/:userId", verifyToken, checkAdminRole, getWalletByUserId)
router.post("/wallets/send-notification", verifyToken, checkAdminRole, sendWalletNotification)
router.post("/wallets/send-bulk-notifications", verifyToken, checkAdminRole, sendBulkWalletNotifications)
router.put("/wallets/:walletId/adjust", verifyToken, checkAdminRole, adjustWalletBalance)
router.put("/wallets/notifications/:notificationId/responded", verifyToken, markWalletNotificationResponded)

// Admin Management Routes
router.get("/admins", verifyToken, checkAdminRole, getAllAdmins)
router.get("/admins/stats", verifyToken, checkAdminRole, getAdminStats)
router.get("/admins/my-permissions", verifyToken, checkAdminRole, getMyPermissions)
router.get("/admins/:adminId", verifyToken, checkAdminRole, getAdminDetails)
router.post("/admins", verifyToken, checkAdminRole, createAdmin)
router.put("/admins/:adminId/permissions", verifyToken, checkAdminRole, updateAdminPermissions)
router.put("/admins/:adminId/suspend", verifyToken, checkAdminRole, suspendAdmin)
router.put("/admins/:adminId/activate", verifyToken, checkAdminRole, activateAdmin)
router.delete("/admins/:adminId", verifyToken, checkAdminRole, deleteAdmin)

export default router
