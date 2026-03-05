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
  deleteAdvertisement
};
