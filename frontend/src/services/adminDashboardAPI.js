import api from "../utils/api";

// Admin Dashboard API Service - Real backend integration

export const adminDashboardAPI = {
  /**
   * Get dashboard overview statistics
   * @returns {Promise} - Dashboard stats
   */
  // Backend: GET /api/admin/dashboard/stats (adminRoutes.js)
  getDashboardStats: async () => {
    try {
      const response = await api.get("/admin/dashboard/stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching dashboard stats:", error.message);
      throw error;
    }
  },

  /**
   * Get all users with filters
   * @param {object} filters - {role, status, search}
   * @returns {Promise} - Users list
   */
  getUsers: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/admin/users?${params}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching users:", error.message);
      throw error;
    }
  },

  /**
   * Get user details
   * @param {string} userId - User ID
   * @returns {Promise} - User details
   */
  getUserDetails: async (userId) => {
    try {
      const response = await api.get(`/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching user details:", error.message);
      throw error;
    }
  },

  /**
   * Update user status
   * @param {string} userId - User ID
   * @param {string} status - New status
   * @returns {Promise} - Update confirmation
   */
  // Backend: PUT /api/admin/users/:userId/suspend or /activate (adminRoutes.js)
  updateUserStatus: async (userId, status) => {
    try {
      const action = status === "suspended" ? "suspend" : "activate";
      const response = await api.put(`/admin/users/${userId}/${action}`);
      return response.data;
    } catch (error) {
      console.error("Error updating user status:", error.message);
      throw error;
    }
  },

  /**
   * Get all B2C partners
   * @returns {Promise} - B2C partners list
   */
  // Backend: GET /api/admin/providers/b2c (adminRoutes.js)
  getB2CPartners: async () => {
    try {
      const response = await api.get("/admin/providers/b2c");
      return response.data;
    } catch (error) {
      console.error("Error fetching B2C partners:", error.message);
      throw error;
    }
  },

  /**
   * Get all B2B clients
   * @returns {Promise} - B2B clients list
   */
  // Backend: GET /api/admin/b2b/providers (adminRoutes.js)
  getB2BClients: async () => {
    try {
      const response = await api.get("/admin/b2b/providers");
      return response.data;
    } catch (error) {
      console.error("Error fetching B2B clients:", error.message);
      throw error;
    }
  },

  /**
   * Get pending payments for verification
   * @returns {Promise} - Pending payments
   */
  // Backend: GET /api/admin/payments/pending (adminRoutes.js)
  getPendingPayments: async () => {
    try {
      const response = await api.get("/admin/payments/pending");
      return response.data;
    } catch (error) {
      console.error("Error fetching pending payments:", error.message);
      throw error;
    }
  },

  /**
   * Verify payment
   * @param {string} paymentId - Payment ID
   * @param {string} status - verified or rejected
   * @param {string} notes - Admin notes
   * @returns {Promise} - Verification confirmation
   */
  // Backend: PUT /api/admin/payments/:paymentId/verify (adminRoutes.js)
  verifyPayment: async (paymentId, status, notes = "") => {
    try {
      const response = await api.put(`/admin/payments/${paymentId}/verify`, {
        status,
        notes
      });
      return response.data;
    } catch (error) {
      console.error("Error verifying payment:", error.message);
      throw error;
    }
  },

  /**
   * Get financial summary
   * @param {object} filters - {startDate, endDate, type}
   * @returns {Promise} - Financial data
   */
  // Backend: GET /api/admin/finance/metrics (adminRoutes.js)
  getFinancialSummary: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/admin/finance/metrics?${params}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching financial summary:", error.message);
      throw error;
    }
  },

  /**
   * Get all transactions
   * @param {object} filters - {startDate, endDate, type, status}
   * @returns {Promise} - Transactions list
   */
  // Backend: GET /api/admin/finance/transactions (adminRoutes.js)
  getTransactions: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/admin/finance/transactions?${params}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching transactions:", error.message);
      throw error;
    }
  },

  /**
   * Get trip reports
   * @param {object} filters - {startDate, endDate, status}
   * @returns {Promise} - Trip reports
   */
  // Backend: GET /api/admin/reports (adminRoutes.js)
  getTripReports: async (filters = {}) => {
    try {
      const params = new URLSearchParams({ ...filters, type: 'trips' }).toString();
      const response = await api.get(`/admin/reports?${params}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching trip reports:", error.message);
      throw error;
    }
  },

  /**
   * Get ride pooling analytics
   * @returns {Promise} - Ride pooling data
   */
  // Backend: GET /api/admin/ride-pooling/stats (adminRoutes.js)
  getRidePoolingAnalytics: async () => {
    try {
      const response = await api.get("/admin/ride-pooling/stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching ride pooling analytics:", error.message);
      throw error;
    }
  },

  /**
   * Get communication logs
   * @param {object} filters - {type, user, date}
   * @returns {Promise} - Communication logs
   */
  // Backend: GET /api/admin/comm/messages (adminRoutes.js)
  getCommunicationLogs: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/admin/comm/messages?${params}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching communication logs:", error.message);
      throw error;
    }
  },

  /**
   * Get advertisement data
   * @returns {Promise} - Ad campaigns
   */
  // Backend: GET /api/admin/ads/campaigns (adminRoutes.js)
  getAds: async () => {
    try {
      const response = await api.get("/admin/ads/campaigns");
      return response.data;
    } catch (error) {
      console.error("Error fetching ads:", error.message);
      throw error;
    }
  },

  /**
   * Create new advertisement
   * @param {object} adData - Ad information
   * @returns {Promise} - Created ad
   */
  // Backend: POST /api/admin/ads/campaigns (adminRoutes.js)
  createAd: async (adData) => {
    try {
      const response = await api.post("/admin/ads/campaigns", adData);
      return response.data;
    } catch (error) {
      console.error("Error creating ad:", error.message);
      throw error;
    }
  },

  /**
   * Get requirements (from corporates/b2b)
   * @param {string} status - Filter by status
   * @returns {Promise} - Requirements list
   */
  getRequirements: async (status = null) => {
    try {
      let url = "/admin/requirements";
      if (status) {
        url += `?status=${status}`;
      }
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error("Error fetching requirements:", error.message);
      throw error;
    }
  },

  /**
   * Get quotations pending approval
   * @returns {Promise} - Quotations list
   */
  getPendingQuotations: async () => {
    try {
      const response = await api.get("/admin/quotations?status=PENDING");
      return response.data;
    } catch (error) {
      console.error("Error fetching quotations:", error.message);
      throw error;
    }
  },

  /**
   * Approve quotation
   * @param {string} quotationId - Quotation ID
   * @returns {Promise} - Approval confirmation
   */
  approveQuotation: async (quotationId) => {
    try {
      const response = await api.patch(`/admin/quotations/${quotationId}/approve`);
      return response.data;
    } catch (error) {
      console.error("Error approving quotation:", error.message);
      throw error;
    }
  },

  /**
   * Reject quotation
   * @param {string} quotationId - Quotation ID
   * @param {string} reason - Rejection reason
   * @returns {Promise} - Rejection confirmation
   */
  rejectQuotation: async (quotationId, reason) => {
    try {
      const response = await api.patch(`/admin/quotations/${quotationId}/reject`, {
        reason
      });
      return response.data;
    } catch (error) {
      console.error("Error rejecting quotation:", error.message);
      throw error;
    }
  },

  /**
   * Export data to CSV
   * @param {string} reportType - Type of report to export
   * @param {object} filters - Export filters
   * @returns {Promise} - Export download
   */
  exportReport: async (reportType, filters = {}) => {
    try {
      const params = new URLSearchParams({
        type: reportType,
        ...filters
      }).toString();
      const response = await api.get(`/admin/export?${params}`, {
        responseType: "blob"
      });
      return response.data;
    } catch (error) {
      console.error("Error exporting report:", error.message);
      throw error;
    }
  }
};

export default adminDashboardAPI;
