import api from "../utils/api";

// Get active trip for driver
// Backend: GET /api/driver/active-trip (driverLocationRoutes.js)
export const getTodaysTrips = async () => {
  try {
    const response = await api.get("/driver/active-trip");
    return response.data;
  } catch (error) {
    console.error("Error fetching active trip:", error);
    throw error;
  }
};

// Get trip details - use general trips endpoint
// Backend: individual trip details via /api/trips or corporate-operations
export const getTripDetails = async (tripId) => {
  try {
    const response = await api.get(`/driver/active-trip`);
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

// Reach pickup point - use trip start as equivalent
export const reachPickupPoint = async (tripId) => {
  try {
    const response = await api.post(`/driver/trips/${tripId}/start`);
    return response.data;
  } catch (error) {
    console.error("Error reaching pickup point:", error);
    throw error;
  }
};

// Pickup passenger - handled via booking status update
export const pickupPassenger = async (tripId, passengerId) => {
  try {
    const response = await api.put(`/bookings/${tripId}/start`, {
      passengerId
    });
    return response.data;
  } catch (error) {
    console.error("Error picking up passenger:", error);
    throw error;
  }
};

// Drop off passenger - handled via booking completion
export const dropoffPassenger = async (tripId, passengerId) => {
  try {
    const response = await api.put(`/bookings/${tripId}/complete`, {
      passengerId
    });
    return response.data;
  } catch (error) {
    console.error("Error dropping off passenger:", error);
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

// Update location (real-time tracking)
// Backend: POST /api/driver/update-location (driverLocationRoutes.js)
export const updateLocation = async (latitude, longitude) => {
  try {
    const response = await api.post("/driver/update-location", {
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    });
    return response.data;
  } catch (error) {
    console.error("Error updating location:", error);
    throw error;
  }
};

// Get vehicle details - use user's profile for vehicle info
export const getVehicleDetails = async () => {
  try {
    const response = await api.get("/users/me");
    return response.data;
  } catch (error) {
    console.error("Error fetching vehicle details:", error);
    throw error;
  }
};

// Get driver profile
// Backend: GET /api/users/me (users.js)
export const getProfile = async () => {
  try {
    const response = await api.get("/users/me");
    return response.data;
  } catch (error) {
    console.error("Error fetching driver profile:", error);
    throw error;
  }
};

// Update driver profile - no direct update route, use users endpoint
export const updateProfile = async (profileData) => {
  try {
    const response = await api.put("/users/me", profileData);
    return response.data;
  } catch (error) {
    console.error("Error updating driver profile:", error);
    throw error;
  }
};

// Get earnings - use wallet balance as proxy
export const getEarnings = async (period = "monthly") => {
  try {
    const response = await api.get("/wallet/balance");
    return response.data;
  } catch (error) {
    console.error("Error fetching earnings:", error);
    throw error;
  }
};

// Get trip history - use travel history
// Backend: GET /api/travel-history/my-history (travelHistoryRoutes.js)
export const getTripHistory = async (filters = {}) => {
  try {
    const response = await api.get("/travel-history/my-history", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching trip history:", error);
    throw error;
  }
};

// Get performance metrics - use travel statistics
// Backend: GET /api/travel-history/statistics (travelHistoryRoutes.js)
export const getPerformanceMetrics = async () => {
  try {
    const response = await api.get("/travel-history/statistics");
    return response.data;
  } catch (error) {
    console.error("Error fetching performance metrics:", error);
    throw error;
  }
};

// Get ratings and reviews - use travel history
export const getRatingsAndReviews = async () => {
  try {
    const response = await api.get("/travel-history/my-history");
    return response.data;
  } catch (error) {
    console.error("Error fetching ratings:", error);
    throw error;
  }
};

// Report emergency
// Backend: POST /api/driver/trips/:tripId/emergency (driverLocationRoutes.js)
export const reportEmergency = async (emergencyData) => {
  try {
    const { tripId, ...data } = emergencyData;
    const response = await api.post(`/driver/trips/${tripId}/emergency`, data);
    return response.data;
  } catch (error) {
    console.error("Error reporting emergency:", error);
    throw error;
  }
};

// Get notifications
// Backend: GET /api/notifications/user/:userId (notificationRoutes.js)
export const getNotifications = async (userId) => {
  try {
    const response = await api.get(`/notifications/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
};

// Mark notification as read
// Backend: PATCH /api/notifications/:notificationId/read (notificationRoutes.js)
export const markNotificationRead = async (notificationId) => {
  try {
    const response = await api.patch(
      `/notifications/${notificationId}/read`
    );
    return response.data;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

// Get attendance - use travel history as proxy
export const getAttendance = async (filters = {}) => {
  try {
    const response = await api.get("/travel-history/my-history", {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching attendance:", error);
    throw error;
  }
};

// Mark attendance - use travel record
export const markAttendance = async (attendanceData) => {
  try {
    const response = await api.post("/travel-history/add", attendanceData);
    return response.data;
  } catch (error) {
    console.error("Error marking attendance:", error);
    throw error;
  }
};

export default {
  getTodaysTrips,
  getTripDetails,
  startTrip,
  reachPickupPoint,
  pickupPassenger,
  dropoffPassenger,
  completeTrip,
  updateLocation,
  getVehicleDetails,
  getProfile,
  updateProfile,
  getEarnings,
  getTripHistory,
  getPerformanceMetrics,
  getRatingsAndReviews,
  reportEmergency,
  getNotifications,
  markNotificationRead,
  getAttendance,
  markAttendance
};
