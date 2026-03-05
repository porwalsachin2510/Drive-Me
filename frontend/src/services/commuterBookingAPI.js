import api from "../utils/api";

// Commuter Booking API Service - Real backend integration
// Mapped to actual backend routes from index.js

export const commuterBookingAPI = {
  /**
   * Get available trips for booking
   * Backend: GET /api/b2c-trips/trips/available (b2cTripRoutes.js -> passengerBookingController)
   */
  getAvailableTrips: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/b2c-trips/trips/available?${params}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching available trips:", error.message);
      throw error;
    }
  },

  /**
   * Book a trip seat
   * Backend: POST /api/b2c-trips/bookings (b2cTripRoutes.js -> passengerBookingController)
   */
  bookTrip: async (tripId, bookingData) => {
    try {
      const response = await api.post(`/b2c-trips/bookings`, {
        tripId,
        ...bookingData
      });
      return response.data;
    } catch (error) {
      console.error("Error booking trip:", error.message);
      throw error;
    }
  },

  /**
   * Cancel booking
   * Backend: PUT /api/bookings/:bookingId/cancel (bookingRoutes.js)
   */
  cancelBooking: async (bookingId, cancellationReason = "") => {
    try {
      const response = await api.put(`/bookings/${bookingId}/cancel`, {
        cancellationReason
      });
      return response.data;
    } catch (error) {
      console.error("Error cancelling booking:", error.message);
      throw error;
    }
  },

  /**
   * Get my bookings (passenger bookings)
   * Backend: GET /api/b2c-trips/bookings (b2cTripRoutes.js -> passengerBookingController)
   */
  getMyBookings: async (status = null) => {
    try {
      let url = `/b2c-trips/bookings`;
      if (status) {
        url += `?status=${status}`;
      }
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error("Error fetching my bookings:", error.message);
      throw error;
    }
  },

  /**
   * Get booking details
   * Backend: GET /api/b2c-bookings/booking/:bookingId (b2cBookingRoutes.js)
   */
  getBookingDetails: async (bookingId) => {
    try {
      const response = await api.get(`/b2c-bookings/booking/${bookingId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching booking details:", error.message);
      throw error;
    }
  },

  /**
   * Get trip live tracking - uses driver location endpoint
   * Backend: GET /api/driver/active-trip (driverLocationRoutes.js)
   * Note: Real-time tracking is via Socket.io, this is for initial data
   */
  getTripLiveTracking: async (tripId) => {
    try {
      const response = await api.get(`/b2c-trips/trips/today`);
      return response.data;
    } catch (error) {
      console.error("Error fetching live tracking:", error.message);
      throw error;
    }
  },

  /**
   * Get available routes (for route selection)
   * Backend: GET /api/b2c-schedules/routes (b2cScheduleRoutes.js)
   */
  getAvailableRoutes: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/b2c-schedules/routes?${params}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching available routes:", error.message);
      throw error;
    }
  },

  /**
   * Get monthly passes for a user
   * Backend: GET /api/monthly-pass/user/:userId (b2cMonthlyPassRoutes.js)
   */
  getMonthlyPasses: async (userId) => {
    try {
      const response = await api.get(`/monthly-pass/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching monthly passes:", error.message);
      throw error;
    }
  },

  /**
   * Buy/Create monthly pass
   * Backend: POST /api/monthly-pass/create (b2cMonthlyPassRoutes.js)
   */
  buyMonthlyPass: async (passData) => {
    try {
      const response = await api.post(`/monthly-pass/create`, passData);
      return response.data;
    } catch (error) {
      console.error("Error buying monthly pass:", error.message);
      throw error;
    }
  },

  /**
   * Get my monthly passes
   * Backend: GET /api/monthly-pass/user/:userId (b2cMonthlyPassRoutes.js)
   */
  getMyMonthlyPasses: async (userId) => {
    try {
      const response = await api.get(`/monthly-pass/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching my monthly passes:", error.message);
      throw error;
    }
  },

  /**
   * Rate trip
   * Backend: POST /api/travel-history/rate/:travelId (travelHistoryRoutes.js)
   */
  rateTrip: async (tripId, ratingData) => {
    try {
      const response = await api.post(`/travel-history/rate/${tripId}`, ratingData);
      return response.data;
    } catch (error) {
      console.error("Error rating trip:", error.message);
      throw error;
    }
  },

  /**
   * Get wallet balance
   * Backend: GET /api/wallet/balance (walletRoutes.js)
   */
  getWallet: async () => {
    try {
      const response = await api.get(`/wallet/balance`);
      return response.data;
    } catch (error) {
      console.error("Error fetching wallet:", error.message);
      throw error;
    }
  },

  /**
   * Add funds to wallet via payment session
   * Backend: POST /api/wallet/create-payment-session (walletRoutes.js)
   */
  addFundsToWallet: async (data) => {
    try {
      const response = await api.post(`/wallet/create-payment-session`, {
        ...data,
        currency: data.currency || "KWD"
      });
      return response.data;
    } catch (error) {
      console.error("Error adding funds:", error.message);
      throw error;
    }
  },

  /**
   * Mark No-Show for a trip
   * Backend: POST /api/no-show/mark (noShowRoutes.js)
   */
  markNoShow: async (noShowData) => {
    try {
      const response = await api.post(`/no-show/mark`, noShowData);
      return response.data;
    } catch (error) {
      console.error("Error marking no-show:", error.message);
      throw error;
    }
  },

  /**
   * Get passenger no-show history
   * Backend: GET /api/no-show/passenger (noShowRoutes.js)
   */
  getNoShowHistory: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const response = await api.get(`/no-show/my-no-shows?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching no-show history:", error.message);
      throw error;
    }
  }
};

export default commuterBookingAPI;
