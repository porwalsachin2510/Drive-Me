import api from "../utils/api";

// B2B Partner API Service - Real backend integration

export const b2bPartnerAPI = {
  /**
   * Get all active contracts for B2B partner
   * @returns {Promise} - List of contracts
   */
  getContracts: async () => {
    try {
      const response = await api.get("/contracts/fleet/all");
      return response.data;
    } catch (error) {
      console.error("Error fetching contracts:", error.message);
      throw error;
    }
  },

  /**
   * Get daily operations trips
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise} - Daily trips
   */
  // Backend: GET /api/b2b-operations/dashboard (b2bOperationsRoutes.js)
  getDailyTrips: async (date) => {
    try {
      const response = await api.get(`/b2b-operations/dashboard`, {
        params: { date }
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching daily trips:", error.message);
      throw error;
    }
  },

  /**
   * Get driver assignments for a trip
   * @param {string} tripId - Trip ID
   * @returns {Promise} - Driver assignment details
   */
  getTripDriverAssignments: async (tripId) => {
    try {
      const response = await api.get(`/trips/${tripId}/driver-assignments`);
      return response.data;
    } catch (error) {
      console.error("Error fetching driver assignments:", error.message);
      throw error;
    }
  },

  /**
   * Get vehicle assignments for contract
   * @param {string} contractId - Contract ID
   * @returns {Promise} - Vehicle assignments
   */
  getVehicleAssignments: async (contractId) => {
    try {
      const response = await api.get(
        `/vehicle-assignments?contractId=${contractId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching vehicle assignments:", error.message);
      throw error;
    }
  },

  /**
   * Get earnings/settlements for partner
   * @param {string} period - Period (monthly, quarterly, yearly)
   * @returns {Promise} - Earnings data
   */
  getEarnings: async (period = "monthly") => {
    try {
      const response = await api.get(`/settlement?period=${period}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching earnings:", error.message);
      throw error;
    }
  },

  /**
   * Get vehicle fleet list
   * @returns {Promise} - Vehicles list
   */
  getFleet: async () => {
    try {
      const response = await api.get("/vehicles/my/vehicles");
      return response.data;
    } catch (error) {
      console.error("Error fetching fleet:", error.message);
      throw error;
    }
  },

  /**
   * Get driver list
   * @returns {Promise} - Drivers list
   */
  getDrivers: async () => {
    try {
      const response = await api.get("/b2b/drivers");
      return response.data;
    } catch (error) {
      console.error("Error fetching drivers:", error.message);
      throw error;
    }
  },

  /**
   * Get route list for contract
   * @param {string} contractId - Contract ID
   * @returns {Promise} - Routes list
   */
  getRoutes: async (contractId) => {
    try {
      const response = await api.get(`/contracts/routes/${contractId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching routes:", error.message);
      throw error;
    }
  },

  /**
   * Update trip status
   * @param {string} tripId - Trip ID
   * @param {string} status - New status
   * @returns {Promise} - Updated trip
   */
  // Backend: POST /api/trips/:tripId/start (tripRoutes.js)
  updateTripStatus: async (tripId, status) => {
    try {
      const endpoint = status === 'completed' ? 'complete' : 'start';
      const response = await api.post(`/trips/${tripId}/${endpoint}`);
      return response.data;
    } catch (error) {
      console.error("Error updating trip status:", error.message);
      throw error;
    }
  },

  /**
   * Complete trip
   * @param {string} tripId - Trip ID
   * @param {object} completionData - Completion details
   * @returns {Promise} - Completed trip
   */
  // Backend: POST /api/trips/:tripId/complete (tripRoutes.js)
  completeTrip: async (tripId, completionData) => {
    try {
      const response = await api.post(`/trips/${tripId}/complete`, completionData);
      return response.data;
    } catch (error) {
      console.error("Error completing trip:", error.message);
      throw error;
    }
  },

  /**
   * Get trip details with passengers
   * @param {string} tripId - Trip ID
   * @returns {Promise} - Full trip details
   */
  getTripDetails: async (tripId) => {
    try {
      const response = await api.get(`/trips/${tripId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching trip details:", error.message);
      throw error;
    }
  },

  /**
   * Get contract details
   * @param {string} contractId - Contract ID
   * @returns {Promise} - Contract details
   */
  getContractDetails: async (contractId) => {
    try {
      const response = await api.get(`/contracts/${contractId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching contract details:", error.message);
      throw error;
    }
  },

  /**
   * Get seat map for a vehicle
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise} - Seat map data
   */
  getSeatMap: async (vehicleId) => {
    try {
      const response = await api.get(`/b2b-operations/vehicles/${vehicleId}/seat-map`);
      return response.data;
    } catch (error) {
      console.error("Error fetching seat map:", error.message);
      throw error;
    }
  },

  /**
   * Allocate employees to seats
   * @param {object} allocationData - {contractId, vehicleId, seatAllocations}
   * @returns {Promise} - Allocation result
   */
  allocateSeats: async (allocationData) => {
    try {
      const response = await api.post("/b2b-operations/allocate-employees-to-seats", allocationData);
      return response.data;
    } catch (error) {
      console.error("Error allocating seats:", error.message);
      throw error;
    }
  },

  /**
   * Get invoices for B2B partner
   * @param {object} params - Filter params
   * @returns {Promise} - Invoices data
   */
  getInvoices: async (params = {}) => {
    try {
      const response = await api.get("/b2b-partner/invoices", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching invoices:", error.message);
      throw error;
    }
  },

  /**
   * Generate reports
   * @param {string} reportType - Type of report
   * @param {object} filters - Report filters
   * @returns {Promise} - Report data
   */
  generateReport: async (reportType, filters = {}) => {
    try {
      const response = await api.post(`/reports/generate`, {
        type: reportType,
        filters
      });
      return response.data;
    } catch (error) {
      console.error("Error generating report:", error.message);
      throw error;
    }
  }
};

export default b2bPartnerAPI;
