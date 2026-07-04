import { getActiveCurrency } from "../config/localeConfig";
import api from "../utils/api";

// Public search for routes (no auth required) - used on landing page for guests
// Backend: GET /api/commute/public-search
export const publicSearchRoutes = async (params = {}) => {
  try {
    const response = await api.get("/commute/public-search", { params });
    return response.data;
  } catch (error) {
    console.error("Error searching public routes:", error);
    throw error;
  }
};

// Commuter search for available trips/routes (authenticated)
// Backend: GET /api/commute/search (commuteRoutes.js)
export const searchRoutes = async (params) => {
  const { pickupLocation, dropoffLocation, filterType, selectedDays, nationality } = params;
  try {
    const response = await api.get("/commute/search", {
      params: { pickupLocation, dropoffLocation, filterType, selectedDays, nationality }
    });
    return response.data;
  } catch (error) {
    console.error("Error searching routes:", error);
    throw error;
  }
};

// Get commuter's booking history
// Backend: GET /api/bookings/passenger (bookingRoutes.js)
export const getMyBookings = async () => {
  try {
    const response = await api.get("/bookings/passenger");
    return response.data;
  } catch (error) {
    console.error("Error fetching bookings:", error);
    throw error;
  }
};

// Book a trip
// Backend: POST /api/trips/:tripId/book (tripRoutes.js)
export const bookTrip = async (tripId, bookingData) => {
  try {
    const response = await api.post(`/trips/${tripId}/book`, bookingData);
    return response.data;
  } catch (error) {
    console.error("Error booking trip:", error);
    throw error;
  }
};

// Get trip details with live tracking
// Backend: GET /api/trips/available has trips, individual trip via corporate-operations or b2c-trips
export const getTripDetails = async (tripId) => {
  try {
    const response = await api.get(`/trips/${tripId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching trip details:", error);
    throw error;
  }
};

// Get commuter wallet and balance
// Backend: GET /api/wallet/balance (walletRoutes.js)
export const getWalletInfo = async () => {
  try {
    const response = await api.get("/wallet/balance");
    return response.data;
  } catch (error) {
    console.error("Error fetching wallet info:", error);
    throw error;
  }
};

// Add money to wallet via payment session
// Backend: POST /api/wallet/create-payment-session (walletRoutes.js)
export const addWalletMoney = async (amount, paymentMethod) => {
  try {
    const response = await api.post("/wallet/create-payment-session", {
      amount,
      paymentMethod,
      currency: getActiveCurrency()
    });
    return response.data;
  } catch (error) {
    console.error("Error adding money to wallet:", error);
    throw error;
  }
};

// Cancel booking
// Backend: PUT /api/bookings/:bookingId/cancel (bookingRoutes.js)
export const cancelBooking = async (bookingId, cancellationReason = "") => {
  try {
    const response = await api.put(`/bookings/${bookingId}/cancel`, { cancellationReason });
    return response.data;
  } catch (error) {
    console.error("Error cancelling booking:", error);
    throw error;
  }
};

// Get user profile
// Backend: GET /api/users/me (users.js) and GET /api/commuter/profile (commuterRoutes.js)
export const getCommuterProfile = async () => {
  try {
    const response = await api.get("/commuter/profile");
    return response.data;
  } catch (error) {
    console.error("Error fetching profile:", error);
    throw error;
  }
};

// Update profile
// Backend: PUT /api/commuter/profile (commuterRoutes.js)
export const updateCommuterProfile = async (profileData) => {
  try {
    const response = await api.put("/commuter/profile", profileData);
    return response.data;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

// Get travel history/ratings
// Backend: GET /api/travel-history/my-history (travelHistoryRoutes.js)
export const getTravelHistory = async () => {
  try {
    const response = await api.get("/travel-history/my-history");
    return response.data;
  } catch (error) {
    console.error("Error fetching travel history:", error);
    throw error;
  }
};

// Rate a trip
// Backend: POST /api/travel-history/rate/:travelId (travelHistoryRoutes.js)
export const rateTrip = async (travelId, rating, review) => {
  try {
    const response = await api.post(`/travel-history/rate/${travelId}`, {
      rating,
      review
    });
    return response.data;
  } catch (error) {
    console.error("Error rating trip:", error);
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

// Get commuter routes (joined routes)
// Backend: GET /api/commuter/routes (commuterRoutes.js)
export const getSavedRoutes = async () => {
  try {
    const response = await api.get("/commuter/routes");
    return response.data;
  } catch (error) {
    console.error("Error fetching saved routes:", error);
    throw error;
  }
};

// Join a route
// Backend: POST /api/commuter/routes/:routeId/join (commuterRoutes.js)
export const saveRoute = async (routeId) => {
  try {
    const response = await api.post(`/commuter/routes/${routeId}/join`);
    return response.data;
  } catch (error) {
    console.error("Error joining route:", error);
    throw error;
  }
};

export default {
  publicSearchRoutes,
  searchRoutes,
  getMyBookings,
  bookTrip,
  getTripDetails,
  getWalletInfo,
  addWalletMoney,
  cancelBooking,
  getCommuterProfile,
  updateCommuterProfile,
  getTravelHistory,
  rateTrip,
  getNotifications,
  markNotificationRead,
  getSavedRoutes,
  saveRoute
};
