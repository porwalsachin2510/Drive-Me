import api from "../utils/api";

// Corporate Employee API Service - Real backend integration

export const corporateEmployeeAPI = {
  /**
   * Get employee's assigned trips - via corporate-employee-users dashboard
   * Backend: GET /api/corporate-employee-users/dashboard (corporateEmployeeUserRoutes.js)
   */
  getEmployeeTrips: async (employeeId, date) => {
    try {
      const response = await api.get(
        `/corporate-employee-users/dashboard`,
        { params: { date } }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching employee trips:", error.message);
      throw error;
    }
  },

  /**
   * Get employee's assigned route information
   * Backend: GET /api/corporate-employee-users/route (corporateEmployeeUserRoutes.js)
   */
  getEmployeeAssignedRoute: async (employeeId) => {
    try {
      const response = await api.get(
        `/corporate-employee-users/route`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching assigned route:", error.message);
      throw error;
    }
  },

  /**
   * Get trip details with driver info
   * Backend: GET /api/corporate-operations/trips/:tripId/details (corporateOperationsRoutes.js)
   */
  getTripDetails: async (tripId) => {
    try {
      const response = await api.get(`/corporate-operations/trips/${tripId}/details`);
      return response.data;
    } catch (error) {
      console.error("Error fetching trip details:", error.message);
      throw error;
    }
  },

  /**
   * Check in for a trip - manage booking
   * Backend: POST /api/corporate-employee-users/booking (corporateEmployeeUserRoutes.js)
   */
  checkInTrip: async (tripId) => {
    try {
      const response = await api.post(`/corporate-employee-users/booking`, {
        tripId,
        action: 'check-in'
      });
      return response.data;
    } catch (error) {
      console.error("Error checking in:", error.message);
      throw error;
    }
  },

  /**
   * Cancel trip assignment
   * Backend: DELETE /api/trips/:tripId/cancel (tripRoutes.js)
   */
  cancelTrip: async (tripId) => {
    try {
      const response = await api.delete(`/trips/${tripId}/cancel`);
      return response.data;
    } catch (error) {
      console.error("Error cancelling trip:", error.message);
      throw error;
    }
  },

  /**
   * Get employee's no-show history
   * Backend: GET /api/no-show/my-no-shows (noShowRoutes.js)
   */
  getNoShowHistory: async () => {
    try {
      const response = await api.get(`/no-show/my-no-shows`);
      return response.data;
    } catch (error) {
      console.error("Error fetching no-show history:", error.message);
      throw error;
    }
  },

  /**
   * Get all notifications for employee
   * Backend: GET /api/notifications/user/:userId (notificationRoutes.js)
   */
  getNotifications: async (userId) => {
    try {
      const response = await api.get(`/notifications/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
      throw error;
    }
  },

  /**
   * Mark notification as read
   * Backend: PATCH /api/notifications/:notificationId/read (notificationRoutes.js)
   */
  markNotificationAsRead: async (notificationId) => {
    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      console.error("Error marking notification as read:", error.message);
      throw error;
    }
  },

  /**
   * Get daily corporate trips (for corporate admin view)
   * Backend: GET /api/corporate-operations/daily-trips (corporateOperationsRoutes.js)
   */
  getDailyTrips: async (date, contractId = null) => {
    try {
      let url = `/corporate-operations/daily-trips?date=${date}`;
      if (contractId) {
        url += `&contractId=${contractId}`;
      }
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error("Error fetching daily trips:", error.message);
      throw error;
    }
  },

  /**
   * Assign route to vehicle
   * Backend: POST /api/corporate-operations/assign-route-to-vehicle (corporateOperationsRoutes.js)
   */
  assignRouteToVehicle: async (assignmentData) => {
    try {
      const response = await api.post(
        `/corporate-operations/assign-route-to-vehicle`,
        assignmentData
      );
      return response.data;
    } catch (error) {
      console.error("Error assigning route to vehicle:", error.message);
      throw error;
    }
  },

  /**
   * Bulk assign employees to trips
   * Backend: POST /api/corporate-operations/trips/:tripId/assign-employees (corporateOperationsRoutes.js)
   */
  bulkAssignEmployees: async (assignments) => {
    try {
      // Process each assignment individually since backend expects per-trip assignment
      const results = [];
      for (const assignment of assignments) {
        const response = await api.post(
          `/corporate-operations/trips/${assignment.tripId}/assign-employees`,
          { employees: assignment.employeeIds, pickupPoint: assignment.pickupPoint }
        );
        results.push(response.data);
      }
      return { success: true, results };
    } catch (error) {
      console.error("Error bulk assigning employees:", error.message);
      throw error;
    }
  },

  /**
   * Generate daily trips from active routes
   * Backend: POST /api/trips/create-from-route (tripRoutes.js)
   */
  generateDailyTrips: async (data) => {
    try {
      const response = await api.post(
        `/trips/create-from-route`,
        data
      );
      return response.data;
    } catch (error) {
      console.error("Error generating daily trips:", error.message);
      throw error;
    }
  },

  /**
   * Get route assignment status
   * Backend: GET /api/corporate-operations/assigned-routes-status (corporateOperationsRoutes.js)
   */
  getRouteAssignmentStatus: async (routeId = null) => {
    try {
      let url = `/corporate-operations/assigned-routes-status`;
      if (routeId) {
        url += `?routeId=${routeId}`;
      }
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error("Error fetching route status:", error.message);
      throw error;
    }
  },

  /**
   * Get billing data for corporate
   * Backend: GET /api/corporate/billing-report (corporateRoutes.js)
   */
  getBillingData: async (period = "current") => {
    try {
      const response = await api.get("/corporate/billing-report", { params: { period } });
      return response.data;
    } catch (error) {
      console.error("Error fetching billing data:", error.message);
      throw error;
    }
  },

  /**
   * Get invoices for corporate
   * Backend: GET /api/corporate/invoices (corporateRoutes.js)
   */
  getInvoices: async () => {
    try {
      const response = await api.get("/corporate/invoices");
      return response.data;
    } catch (error) {
      console.error("Error fetching invoices:", error.message);
      throw error;
    }
  },

  /**
   * Mark not traveling today for employee
   * Backend: POST /api/corporate-employee-users/not-traveling-today
   */
  markNotTraveling: async (reason) => {
    try {
      const response = await api.post("/corporate-employee-users/not-traveling-today", { reason });
      return response.data;
    } catch (error) {
      console.error("Error marking not traveling:", error.message);
      throw error;
    }
  },

  /**
   * Rate a completed trip
   * Backend: POST /api/corporate-employee-users/rate-trip
   */
  rateTrip: async (tripId, rating, feedback) => {
    try {
      const response = await api.post("/corporate-employee-users/rate-trip", { tripId, rating, feedback });
      return response.data;
    } catch (error) {
      console.error("Error rating trip:", error.message);
      throw error;
    }
  },

  /**
   * Request route change
   * Backend: POST /api/corporate-employee-users/request-route-change
   */
  requestRouteChange: async (reason, preferredRoute) => {
    try {
      const response = await api.post("/corporate-employee-users/request-route-change", { reason, preferredRoute });
      return response.data;
    } catch (error) {
      console.error("Error requesting route change:", error.message);
      throw error;
    }
  },

  /**
   * Update trip status - use start or complete
   * Backend: POST /api/trips/:tripId/start or /complete (tripRoutes.js)
   */
  updateTripStatus: async (tripId, status) => {
    try {
      const endpoint = status === 'completed' ? 'complete' : 'start';
      const response = await api.post(`/trips/${tripId}/${endpoint}`);
      return response.data;
    } catch (error) {
      console.error("Error updating trip status:", error.message);
      throw error;
    }
  }
};

export default corporateEmployeeAPI;
