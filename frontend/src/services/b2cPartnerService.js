import api from "../utils/api";

// Get daily trips for B2C partner
// Backend: GET /api/b2c-trips/trips/today (b2cTripRoutes.js)
export const getDailyTrips = async (date) => {
  try {
    const response = await api.get("/b2c-trips/trips/today", {
      params: { date }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching daily trips:", error);
    throw error;
  }
};

// Get trip details - via b2c-bookings
// Backend: GET /api/b2c-bookings/booking/:bookingId (b2cBookingRoutes.js)
export const getTripDetails = async (tripId) => {
  try {
    const response = await api.get(`/b2c-bookings/booking/${tripId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching trip details:", error);
    throw error;
  }
};

// Start trip
// Backend: POST /api/driver/trips/:tripId/start (driverLocationRoutes.js)
export const startTrip = async (tripId) => {
  try {
    const response = await api.post(`/driver/trips/${tripId}/start`);
    return response.data;
  } catch (error) {
    console.error("Error starting trip:", error);
    throw error;
  }
};

// Complete trip
// Backend: POST /api/driver/trips/:tripId/complete (driverLocationRoutes.js)
export const completeTrip = async (tripId, completionData) => {
  try {
    const response = await api.post(
      `/driver/trips/${tripId}/complete`,
      completionData
    );
    return response.data;
  } catch (error) {
    console.error("Error completing trip:", error);
    throw error;
  }
};

// Get drivers
// Backend: GET /api/b2c-partner/drivers (b2cPartnerRoutes.js)
export const getDrivers = async () => {
  try {
    const response = await api.get("/b2c-partner/drivers");
    return response.data;
  } catch (error) {
    console.error("Error fetching drivers:", error);
    throw error;
  }
};

// Get driver details - same endpoint, filter client-side
export const getDriverDetails = async (driverId) => {
  try {
    const response = await api.get(`/b2c-partner/drivers`);
    const drivers = response.data.drivers || response.data.data || [];
    const driver = Array.isArray(drivers) ? drivers.find(d => d._id === driverId) : null;
    return { success: true, driver };
  } catch (error) {
    console.error("Error fetching driver details:", error);
    throw error;
  }
};

// Get vehicles (fleet)
// Backend: GET /api/b2c-partner/fleet (b2cPartnerRoutes.js)
export const getVehicles = async () => {
  try {
    const response = await api.get("/b2c-partner/fleet");
    return response.data;
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    throw error;
  }
};

// Get vehicle details by ID
// Backend: GET /api/vehicles/:vehicleId (vehicleRoutes.js)
export const getVehicleDetails = async (vehicleId) => {
  try {
    const response = await api.get(`/vehicles/${vehicleId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching vehicle details:", error);
    throw error;
  }
};

// Get routes
// Backend: GET /api/b2c-partner/routes (b2cPartnerRoutes.js)
export const getRoutes = async (filters = {}) => {
  try {
    const response = await api.get("/b2c-partner/routes", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching routes:", error);
    throw error;
  }
};

// Create route
// Backend: POST /api/b2c-partner/routes (b2cPartnerRoutes.js)
export const createRoute = async (routeData) => {
  try {
    const response = await api.post("/b2c-partner/routes", routeData);
    return response.data;
  } catch (error) {
    console.error("Error creating route:", error);
    throw error;
  }
};

// Update route
// Backend: PUT /api/b2c-partner/routes/:routeId (b2cPartnerRoutes.js)
export const updateRoute = async (routeId, routeData) => {
  try {
    const response = await api.put(
      `/b2c-partner/routes/${routeId}`,
      routeData
    );
    return response.data;
  } catch (error) {
    console.error("Error updating route:", error);
    throw error;
  }
};

// Delete route
// Backend: DELETE /api/b2c-partner/routes/:routeId (b2cPartnerRoutes.js)
export const deleteRoute = async (routeId) => {
  try {
    const response = await api.delete(`/b2c-partner/routes/${routeId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting route:", error);
    throw error;
  }
};

// Assign driver to vehicle
// Backend: POST /api/b2c-partner/vehicles/:vehicleId/assign-driver (b2cPartnerRoutes.js)
export const assignDriverToVehicle = async (vehicleId, driverId) => {
  try {
    const response = await api.post(
      `/b2c-partner/vehicles/${vehicleId}/assign-driver`,
      { driverId }
    );
    return response.data;
  } catch (error) {
    console.error("Error assigning driver to vehicle:", error);
    throw error;
  }
};

// Assign driver to route
// Backend: POST /api/b2c-partner/assign-driver-route (b2cPartnerRoutes.js)
export const assignDriverToRoute = async (driverId, routeId, vehicleId = null) => {
  try {
    const response = await api.post(
      `/b2c-partner/assign-driver-route`,
      { driverId, routeId, vehicleId }
    );
    return response.data;
  } catch (error) {
    console.error("Error assigning driver to route:", error);
    throw error;
  }
};

// Get monthly pass subscriptions
// Backend: GET /api/monthly-pass/partner/:partnerId (b2cMonthlyPassRoutes.js)
export const getMonthlyPassSubscriptions = async (partnerId) => {
  try {
    const response = await api.get(`/monthly-pass/partner/${partnerId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching monthly passes:", error);
    throw error;
  }
};

// Get route bookings (partner bookings)
// Backend: GET /api/b2c-bookings/partner/bookings (b2cBookingRoutes.js)
export const getRouteBookings = async (routeId, dateRange = {}) => {
  try {
    const response = await api.get(`/b2c-bookings/partner/bookings`, {
      params: { routeId, ...dateRange }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching route bookings:", error);
    throw error;
  }
};

// Get passenger details for a booking
// Backend: GET /api/b2c-bookings/booking/:bookingId/passenger (b2cBookingRoutes.js)
export const getPassengerDetails = async (bookingId) => {
  try {
    const response = await api.get(`/b2c-bookings/booking/${bookingId}/passenger`);
    return response.data;
  } catch (error) {
    console.error("Error fetching passenger details:", error);
    throw error;
  }
};

// Get earnings
// Backend: GET /api/b2c-partner/earnings (b2cPartnerRoutes.js)
export const getEarnings = async (period = "monthly") => {
  try {
    const response = await api.get("/b2c-partner/earnings", {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching earnings:", error);
    throw error;
  }
};

// Get earnings breakdown - via wallet statement
// Backend: GET /api/wallet/statement (walletRoutes.js)
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

// Get analytics - use earnings as proxy
export const getAnalytics = async (period = "monthly") => {
  try {
    const response = await api.get("/b2c-partner/earnings", {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching analytics:", error);
    throw error;
  }
};

// Get B2C partner profile
// Backend: GET /api/b2c-partner/profile (b2cPartnerRoutes.js)
export const getProfile = async () => {
  try {
    const response = await api.get("/b2c-partner/profile");
    return response.data;
  } catch (error) {
    console.error("Error fetching profile:", error);
    throw error;
  }
};

// Update B2C partner profile
// Backend: PUT /api/b2c-partner/profile (b2cPartnerRoutes.js)
export const updateProfile = async (profileData) => {
  try {
    const response = await api.put("/b2c-partner/profile", profileData);
    return response.data;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

// Get account details - use profile
// Backend: GET /api/b2c-partner/profile (b2cPartnerRoutes.js)
export const getAccountDetails = async () => {
  try {
    const response = await api.get("/b2c-partner/profile");
    return response.data;
  } catch (error) {
    console.error("Error fetching account details:", error);
    throw error;
  }
};

// Get settlement details
// Backend: GET /api/settlement (settlementRoutes.js)
export const getSettlement = async (period = "monthly") => {
  try {
    const response = await api.get("/settlement", {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching settlement:", error);
    throw error;
  }
};

// Get transaction history
// Backend: GET /api/wallet/statement (walletRoutes.js)
export const getTransactionHistory = async (filters = {}) => {
  try {
    const response = await api.get("/wallet/statement", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    throw error;
  }
};

// Update B2C driver location (for both self-driver and partner driver)
// Backend: POST /api/b2c-daily-trips/driver/update-location (b2cDailyTripRoutes.js)
export const updateB2CDriverLocation = async (locationData) => {
  try {
    const response = await api.post("/b2c-daily-trips/driver/update-location", locationData);
    return response.data;
  } catch (error) {
    console.error("Error updating B2C driver location:", error);
    throw error;
  }
};

// Get active trip for B2C driver
// Backend: GET /api/b2c-daily-trips/driver/active-trip (b2cDailyTripRoutes.js)
export const getActiveB2CTrip = async () => {
  try {
    const response = await api.get("/b2c-daily-trips/driver/active-trip");
    return response.data;
  } catch (error) {
    console.error("Error fetching active B2C trip:", error);
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
  getVehicles,
  getVehicleDetails,
  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  assignDriverToVehicle,
  assignDriverToRoute,
  getMonthlyPassSubscriptions,
  getRouteBookings,
  getPassengerDetails,
  getEarnings,
  getEarningsBreakdown,
  getAnalytics,
  getProfile,
  updateProfile,
  getAccountDetails,
  getSettlement,
  getTransactionHistory,
  updateB2CDriverLocation,
  getActiveB2CTrip
};
