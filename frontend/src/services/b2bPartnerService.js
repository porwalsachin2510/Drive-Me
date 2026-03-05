import api from "../utils/api";

// Get daily trips for B2B partner
// Backend: GET /api/b2b-operations/dashboard (b2bOperationsRoutes.js)
export const getDailyTrips = async (date) => {
  try {
    const response = await api.get("/b2b-operations/dashboard", {
      params: { date }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching daily trips:", error);
    throw error;
  }
};

// Get trip details - use trips endpoint
// Backend: trips are accessed via /api/trips (tripRoutes.js)
export const getTripDetails = async (tripId) => {
  try {
    const response = await api.get(`/trips/${tripId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching trip details:", error);
    throw error;
  }
};

// Start trip
// Backend: POST /api/trips/:tripId/start (tripRoutes.js)
export const startTrip = async (tripId) => {
  try {
    const response = await api.post(`/trips/${tripId}/start`);
    return response.data;
  } catch (error) {
    console.error("Error starting trip:", error);
    throw error;
  }
};

// Complete trip
// Backend: POST /api/trips/:tripId/complete (tripRoutes.js)
export const completeTrip = async (tripId, completionData) => {
  try {
    const response = await api.post(
      `/trips/${tripId}/complete`,
      completionData
    );
    return response.data;
  } catch (error) {
    console.error("Error completing trip:", error);
    throw error;
  }
};

// Get drivers
// Backend: GET /api/b2b/drivers (driverRoutes.js mounted at /api/b2b/drivers)
export const getDrivers = async () => {
  try {
    const response = await api.get("/b2b/drivers");
    return response.data;
  } catch (error) {
    console.error("Error fetching drivers:", error);
    throw error;
  }
};

// Get driver details
export const getDriverDetails = async (driverId) => {
  try {
    const response = await api.get(`/b2b/drivers/${driverId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching driver details:", error);
    throw error;
  }
};

// Assign driver to trip
// Backend: POST /api/trips/:tripId/assign-driver (tripRoutes.js)
export const assignDriverToTrip = async (tripId, driverId) => {
  try {
    const response = await api.post(
      `/trips/${tripId}/assign-driver`,
      { driverId }
    );
    return response.data;
  } catch (error) {
    console.error("Error assigning driver:", error);
    throw error;
  }
};

// Get vehicles
// Backend: GET /api/vehicles/my/vehicles (vehicleRoutes.js)
export const getVehicles = async () => {
  try {
    const response = await api.get("/vehicles/my/vehicles");
    return response.data;
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    throw error;
  }
};

// Get vehicle details
export const getVehicleDetails = async (vehicleId) => {
  try {
    const response = await api.get(`/vehicles/${vehicleId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching vehicle details:", error);
    throw error;
  }
};

// Get routes - via contracts
export const getRoutes = async (filters = {}) => {
  try {
    const response = await api.get("/contracts/fleet/all", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching routes:", error);
    throw error;
  }
};

// Create route - via dedicated routes
// Backend: POST /api/b2b-operations/dedicated-routes (b2bOperationsRoutes.js)
export const createRoute = async (routeData) => {
  try {
    const response = await api.post("/b2b-operations/dedicated-routes", routeData);
    return response.data;
  } catch (error) {
    console.error("Error creating route:", error);
    throw error;
  }
};

// Update route - no direct update, use dedicated-routes POST again
export const updateRoute = async (routeId, routeData) => {
  try {
    const response = await api.post(
      `/b2b-operations/dedicated-routes`,
      { ...routeData, routeId }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating route:", error);
    throw error;
  }
};

// Delete route - not directly supported, use status update
export const deleteRoute = async (routeId) => {
  try {
    const response = await api.post(`/b2b-operations/dedicated-routes`, {
      routeId,
      action: 'delete'
    });
    return response.data;
  } catch (error) {
    console.error("Error deleting route:", error);
    throw error;
  }
};

// Get contracts
// Backend: GET /api/contracts/fleet/all (contractRoutes.js)
export const getContracts = async (status = "") => {
  try {
    const response = await api.get("/contracts/fleet/all", {
      params: { status }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching contracts:", error);
    throw error;
  }
};

// Get contract details
// Backend: GET /api/contracts/:contractId (contractRoutes.js)
export const getContractDetails = async (contractId) => {
  try {
    const response = await api.get(`/contracts/${contractId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching contract details:", error);
    throw error;
  }
};

// Assign vehicle to contract
// Backend: POST /api/contracts/:contractId/assign-vehicles (contractRoutes.js)
export const assignVehicleToContract = async (contractId, vehicleData) => {
  try {
    const response = await api.post(
      `/contracts/${contractId}/assign-vehicles`,
      vehicleData
    );
    return response.data;
  } catch (error) {
    console.error("Error assigning vehicle:", error);
    throw error;
  }
};

// Get quotations sent
// Backend: GET /api/quotations/fleet (quotationRoutes.js)
export const getQuotationsSent = async () => {
  try {
    const response = await api.get("/quotations/fleet");
    return response.data;
  } catch (error) {
    console.error("Error fetching quotations:", error);
    throw error;
  }
};

// Send quotation
// Backend: POST /api/quotations (quotationRoutes.js)
export const sendQuotation = async (requirementId, quotationData) => {
  try {
    const response = await api.post(
      `/quotations`,
      { ...quotationData, requirementId }
    );
    return response.data;
  } catch (error) {
    console.error("Error sending quotation:", error);
    throw error;
  }
};

// Get earnings - via settlement
// Backend: GET /api/settlement (settlementRoutes.js)
export const getEarnings = async (period = "monthly") => {
  try {
    const response = await api.get("/settlement", {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching earnings:", error);
    throw error;
  }
};

// Get earnings breakdown - via wallet statement
export const getEarningsBreakdown = async (dateRange = {}) => {
  try {
    const response = await api.get("/wallet/statement", {
      params: dateRange
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching earnings breakdown:", error);
    throw error;
  }
};

// Get analytics - use dashboard
export const getAnalytics = async (period = "monthly") => {
  try {
    const response = await api.get("/b2b-operations/dashboard", {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching analytics:", error);
    throw error;
  }
};

// Get B2B partner profile
// Backend: GET /api/users/profile (users.js)
export const getProfile = async () => {
  try {
    const response = await api.get("/users/profile");
    return response.data;
  } catch (error) {
    console.error("Error fetching profile:", error);
    throw error;
  }
};

// Update B2B partner profile
// Backend: PUT /api/users/profile (users.js)
export const updateProfile = async (profileData) => {
  try {
    const response = await api.put("/users/profile", profileData);
    return response.data;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

// Get requirements from corporate
// Backend: GET /api/requirements/corporate (requirementRoutes.js)
export const getRequirements = async () => {
  try {
    const response = await api.get("/requirements");
    return response.data;
  } catch (error) {
    console.error("Error fetching requirements:", error);
    throw error;
  }
};

export default {
  getDailyTrips,
  getTripDetails,
  startTrip,
  completeTrip,
  getDrivers,
  getDriverDetails,
  assignDriverToTrip,
  getVehicles,
  getVehicleDetails,
  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  getContracts,
  getContractDetails,
  assignVehicleToContract,
  getQuotationsSent,
  sendQuotation,
  getEarnings,
  getEarningsBreakdown,
  getAnalytics,
  getProfile,
  updateProfile,
  getRequirements
};
