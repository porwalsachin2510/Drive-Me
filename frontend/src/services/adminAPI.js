import api from "../utils/api";

// Admin Dashboard Overview
export const getDashboardStats = async () => {
  try {
    const response = await api.get("/admin/dashboard/stats");
    return response.data;
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw error;
  }
};

// B2C Management - Backend: /api/admin/providers/b2c (adminRoutes.js)
export const getB2CPartners = async (filters = {}) => {
  try {
    const response = await api.get("/admin/providers/b2c", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching B2C partners:", error);
    throw error;
  }
};

export const getB2CPartnerDetails = async (partnerId) => {
  try {
    const response = await api.get(`/admin/providers/b2c`, {
      params: { partnerId }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching B2C partner details:", error);
    throw error;
  }
};

// Backend: PUT /api/admin/providers/b2c/:providerId/activate (adminRoutes.js)
export const approveB2CPartner = async (partnerId) => {
  try {
    const response = await api.put(`/admin/providers/b2c/${partnerId}/activate`);
    return response.data;
  } catch (error) {
    console.error("Error approving B2C partner:", error);
    throw error;
  }
};

// Backend: PUT /api/admin/providers/b2c/:providerId/suspend (adminRoutes.js)
export const rejectB2CPartner = async (partnerId, reason) => {
  try {
    const response = await api.put(
      `/admin/providers/b2c/${partnerId}/suspend`,
      { reason }
    );
    return response.data;
  } catch (error) {
    console.error("Error rejecting B2C partner:", error);
    throw error;
  }
};

// B2B Management - Backend: /api/admin/b2b/providers (adminRoutes.js)
export const getB2BClients = async (filters = {}) => {
  try {
    const response = await api.get("/admin/b2b/providers", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching B2B clients:", error);
    throw error;
  }
};

export const getB2BClientDetails = async (clientId) => {
  try {
    const response = await api.get(`/admin/b2b/providers`, {
      params: { clientId }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching B2B client details:", error);
    throw error;
  }
};

// Backend: PUT /api/admin/b2b/providers/:providerId/activate (adminRoutes.js)
export const approveB2BClient = async (clientId) => {
  try {
    const response = await api.put(`/admin/b2b/providers/${clientId}/activate`);
    return response.data;
  } catch (error) {
    console.error("Error approving B2B client:", error);
    throw error;
  }
};

// Users Management
export const getAllUsers = async (filters = {}) => {
  try {
    const response = await api.get("/admin/users", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
};

export const getUserDetails = async (userId) => {
  try {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user details:", error);
    throw error;
  }
};

// Backend: PUT /api/admin/users/:userId/suspend (adminRoutes.js)
export const blockUser = async (userId, reason) => {
  try {
    const response = await api.put(`/admin/users/${userId}/suspend`, {
      reason
    });
    return response.data;
  } catch (error) {
    console.error("Error blocking user:", error);
    throw error;
  }
};

// Backend: PUT /api/admin/users/:userId (adminRoutes.js) - Edit user details
export const editUser = async (userId, updates) => {
  try {
    const response = await api.put(`/admin/users/${userId}`, updates);
    return response.data;
  } catch (error) {
    console.error("Error editing user:", error);
    throw error;
  }
};

// Backend: POST /api/auth/admin-login (auth.js) - Admin login
export const adminLogin = async (credentials) => {
  try {
    const response = await api.post("/auth/admin-login", credentials);
    return response.data;
  } catch (error) {
    console.error("Error admin login:", error);
    throw error;
  }
};

// Backend: PUT /api/admin/users/:userId/activate (adminRoutes.js)
export const unblockUser = async (userId) => {
  try {
    const response = await api.put(`/admin/users/${userId}/activate`);
    return response.data;
  } catch (error) {
    console.error("Error unblocking user:", error);
    throw error;
  }
};

// Payment Verification
// Backend: GET /api/admin/payments/pending (adminRoutes.js)
export const getPendingPayments = async () => {
  try {
    const response = await api.get("/admin/payments/pending");
    return response.data;
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    throw error;
  }
};

// Backend: PUT /api/admin/payments/:paymentId/verify (adminRoutes.js)
export const verifyPayment = async (paymentId) => {
  try {
    const response = await api.put(
      `/admin/payments/${paymentId}/verify`,
      { status: "verified" }
    );
    return response.data;
  } catch (error) {
    console.error("Error verifying payment:", error);
    throw error;
  }
};

// Backend: PUT /api/admin/payments/:paymentId/verify with rejected status (adminRoutes.js)
export const rejectPayment = async (paymentId, reason) => {
  try {
    const response = await api.put(
      `/admin/payments/${paymentId}/verify`,
      { status: "rejected", reason }
    );
    return response.data;
  } catch (error) {
    console.error("Error rejecting payment:", error);
    throw error;
  }
};

// Finance & Reports
// Backend: GET /api/admin/finance/metrics (adminRoutes.js)
export const getFinanceSummary = async (dateRange = {}) => {
  try {
    const response = await api.get("/admin/finance/metrics", {
      params: dateRange
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching finance summary:", error);
    throw error;
  }
};

// Backend: GET /api/admin/finance/transactions (adminRoutes.js)
export const getTransactionHistory = async (filters = {}) => {
  try {
    const response = await api.get("/admin/finance/transactions", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
};

// Backend: GET /api/admin/reports (adminRoutes.js)
export const getReports = async (reportType, filters = {}) => {
  try {
    const response = await api.get(`/admin/reports`, {
      params: { ...filters, type: reportType }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching reports:", error);
    throw error;
  }
};

// Analytics - Backend: GET /api/admin/b2b/analytics (adminRoutes.js)
export const getAnalytics = async (period = "monthly") => {
  try {
    const response = await api.get("/admin/b2b/analytics", {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching analytics:", error);
    throw error;
  }
};

// Ride Pooling Management
// Backend: GET /api/admin/ride-pooling/stats (adminRoutes.js)
export const getRidePoolingStats = async () => {
  try {
    const response = await api.get("/admin/ride-pooling/stats");
    return response.data;
  } catch (error) {
    console.error("Error fetching ride pooling stats:", error);
    throw error;
  }
};

// Backend: GET /api/admin/ride-pooling/passenger-interests (adminRoutes.js)
export const getRidePoolingTrips = async (filters = {}) => {
  try {
    const response = await api.get("/admin/ride-pooling/passenger-interests", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching ride pooling trips:", error);
    throw error;
  }
};

// Communications - Backend: GET /api/admin/comm/messages (adminRoutes.js)
export const getComplaints = async (filters = {}) => {
  try {
    const response = await api.get("/admin/comm/messages", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching complaints:", error);
    throw error;
  }
};

export const resolveComplaint = async (complaintId, resolution) => {
  try {
    const response = await api.post(
      `/admin/comm/email/send`,
      { complaintId, resolution }
    );
    return response.data;
  } catch (error) {
    console.error("Error resolving complaint:", error);
    throw error;
  }
};

// Advertisements - Backend: /api/admin/ads/campaigns (adminRoutes.js)
export const getAdvertisements = async () => {
  try {
    const response = await api.get("/admin/ads/campaigns");
    return response.data;
  } catch (error) {
    console.error("Error fetching advertisements:", error);
    throw error;
  }
};

export const createAdvertisement = async (adData) => {
  try {
    const response = await api.post("/admin/ads/campaigns", adData);
    return response.data;
  } catch (error) {
    console.error("Error creating advertisement:", error);
    throw error;
  }
};

export const updateAdvertisement = async (adId, adData) => {
  try {
    const response = await api.put(`/admin/ads/campaigns/${adId}`, adData);
    return response.data;
  } catch (error) {
    console.error("Error updating advertisement:", error);
    throw error;
  }
};

export const deleteAdvertisement = async (adId) => {
  try {
    const response = await api.delete(`/admin/ads/campaigns/${adId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting advertisement:", error);
    throw error;
  }
};

// ==========================================
// ADMIN MANAGEMENT APIs
// ==========================================

// Get all admins with pagination and filters
export const getAllAdmins = async (filters = {}) => {
  try {
    const response = await api.get("/admin/admins", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching admins:", error);
    throw error;
  }
};

// Get admin statistics
export const getAdminStats = async () => {
  try {
    const response = await api.get("/admin/admins/stats");
    return response.data;
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    throw error;
  }
};

// Get current admin's permissions
export const getMyPermissions = async () => {
  try {
    const response = await api.get("/admin/admins/my-permissions");
    return response.data;
  } catch (error) {
    console.error("Error fetching my permissions:", error);
    throw error;
  }
};

// Get admin details by ID
export const getAdminDetails = async (adminId) => {
  try {
    const response = await api.get(`/admin/admins/${adminId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching admin details:", error);
    throw error;
  }
};

// Create new admin
export const createAdmin = async (adminData) => {
  try {
    const response = await api.post("/admin/admins", adminData);
    return response.data;
  } catch (error) {
    console.error("Error creating admin:", error);
    throw error;
  }
};

// Update admin permissions
export const updateAdminPermissions = async (adminId, permissions) => {
  try {
    const response = await api.put(`/admin/admins/${adminId}/permissions`, permissions);
    return response.data;
  } catch (error) {
    console.error("Error updating admin permissions:", error);
    throw error;
  }
};

// Suspend admin
export const suspendAdmin = async (adminId, data = {}) => {
  try {
    const response = await api.put(`/admin/admins/${adminId}/suspend`, data);
    return response.data;
  } catch (error) {
    console.error("Error suspending admin:", error);
    throw error;
  }
};

// Activate admin
export const activateAdmin = async (adminId) => {
  try {
    const response = await api.put(`/admin/admins/${adminId}/activate`);
    return response.data;
  } catch (error) {
    console.error("Error activating admin:", error);
    throw error;
  }
};

// Delete admin
export const deleteAdmin = async (adminId) => {
  try {
    const response = await api.delete(`/admin/admins/${adminId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting admin:", error);
    throw error;
  }
};

// ==========================================
// COMMISSION SETTINGS APIs
// ==========================================

// Get all users with their commission settings
export const getUsersWithCommissionSettings = async (filters = {}) => {
  try {
    const response = await api.get("/commission/users-with-settings", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching users with settings:", error);
    throw error;
  }
};

// Get commission settings for a specific user
export const getUserCommissionSettings = async (userId) => {
  try {
    const response = await api.get(`/commission/settings/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user commission settings:", error);
    throw error;
  }
};

// Create commission settings for a user
export const createCommissionSettings = async (userId, settings) => {
  try {
    const response = await api.post("/commission/settings", {
      userId,
      ...settings
    });
    return response.data;
  } catch (error) {
    console.error("Error creating commission settings:", error);
    throw error;
  }
};

// Update commission settings for a user
export const updateCommissionSettings = async (userId, settings) => {
  try {
    const response = await api.put(`/commission/settings/${userId}`, settings);
    return response.data;
  } catch (error) {
    console.error("Error updating commission settings:", error);
    throw error;
  }
};

// Delete commission settings for a user
export const deleteCommissionSettings = async (userId) => {
  try {
    const response = await api.delete(`/commission/settings/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting commission settings:", error);
    throw error;
  }
};

// Get commission summary and reports
export const getCommissionSummary = async (filters = {}) => {
  try {
    const response = await api.get("/commission/summary", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching commission summary:", error);
    throw error;
  }
};

// Get contracts with commission details
export const getContractsWithCommission = async (filters = {}) => {
  try {
    const response = await api.get("/commission/contracts", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching contracts with commission:", error);
    throw error;
  }
};

// ==========================================
// ADMIN NEGOTIATION APIs
// ==========================================

// Get all negotiations (Admin view)
export const getAllNegotiations = async (filters = {}) => {
  try {
    const response = await api.get("/admin/negotiations", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching negotiations:", error);
    throw error;
  }
};

// Get negotiation details
export const getNegotiationDetails = async (negotiationId) => {
  try {
    const response = await api.get(`/admin/negotiations/${negotiationId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching negotiation details:", error);
    throw error;
  }
};

// Take action on negotiation (send message, offer)
export const takeNegotiationAction = async (negotiationId, action, data) => {
  try {
    const response = await api.post(`/admin/negotiations/${negotiationId}/action`, {
      action,
      ...data
    });
    return response.data;
  } catch (error) {
    console.error("Error taking negotiation action:", error);
    throw error;
  }
};

// Handle B2B Partner response to negotiation
export const handleB2BResponse = async (negotiationId, response) => {
  try {
    const apiResponse = await api.post(`/negotiations/${negotiationId}/b2b-response`, response);
    return apiResponse.data;
  } catch (error) {
    console.error("Error handling B2B response:", error);
    throw error;
  }
};

// Complete negotiation and update quotation price
export const completeNegotiation = async (negotiationId, data) => {
  try {
    const response = await api.post(`/admin/negotiations/${negotiationId}/complete`, data);
    return response.data;
  } catch (error) {
    console.error("Error completing negotiation:", error);
    throw error;
  }
};

// Cancel negotiation
export const cancelNegotiation = async (negotiationId, reason) => {
  try {
    const response = await api.post(`/negotiations/${negotiationId}/cancel`, {
      reason
    });
    return response.data;
  } catch (error) {
    console.error("Error cancelling negotiation:", error);
    throw error;
  }
};

// ==========================================
// TERMS & CONDITIONS APIs
// ==========================================

// Get latest terms and conditions
export const getLatestTerms = async () => {
  try {
    const response = await api.get("/terms/latest");
    return response.data;
  } catch (error) {
    console.error("Error fetching latest terms:", error);
    throw error;
  }
};

// Get specific terms version
export const getTermsVersion = async (version) => {
  try {
    const response = await api.get(`/terms/version/${version}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching terms version:", error);
    throw error;
  }
};

// Create new terms and conditions version
export const createTerms = async (termsData) => {
  try {
    const response = await api.post("/terms", termsData);
    return response.data;
  } catch (error) {
    console.error("Error creating terms:", error);
    throw error;
  }
};

// Get all terms versions (Admin)
export const getAllTermsVersions = async (filters = {}) => {
  try {
    const response = await api.get("/terms/all", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching all terms versions:", error);
    throw error;
  }
};

// Get user's accepted terms
export const getUserAcceptedTerms = async (userId) => {
  try {
    const response = await api.get(`/terms/user/${userId}/accepted`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user accepted terms:", error);
    throw error;
  }
};

export default {
  getDashboardStats,
  getB2CPartners,
  getB2CPartnerDetails,
  approveB2CPartner,
  rejectB2CPartner,
  getB2BClients,
  getB2BClientDetails,
  approveB2BClient,
  getAllUsers,
  getUserDetails,
  editUser,
  adminLogin,
  blockUser,
  unblockUser,
  getPendingPayments,
  verifyPayment,
  rejectPayment,
  getFinanceSummary,
  getTransactionHistory,
  getReports,
  getAnalytics,
  getRidePoolingStats,
  getRidePoolingTrips,
  getComplaints,
  resolveComplaint,
  getAdvertisements,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  // Admin Management
  getAllAdmins,
  getAdminStats,
  getMyPermissions,
  getAdminDetails,
  createAdmin,
  updateAdminPermissions,
  suspendAdmin,
  activateAdmin,
  deleteAdmin,
  // Commission Settings
  getUsersWithCommissionSettings,
  getUserCommissionSettings,
  createCommissionSettings,
  updateCommissionSettings,
  deleteCommissionSettings,
  getCommissionSummary,
  getContractsWithCommission,
  // Admin Negotiations
  getAllNegotiations,
  getNegotiationDetails,
  takeNegotiationAction,
  handleB2BResponse,
  completeNegotiation,
  cancelNegotiation,
  // Terms & Conditions
  getLatestTerms,
  getTermsVersion,
  createTerms,
  getAllTermsVersions,
  getUserAcceptedTerms
};
