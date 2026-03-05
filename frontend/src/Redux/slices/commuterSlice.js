import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import commuterAPI from "../../services/commuterAPI";

// Async thunks
export const publicSearchRoutes = createAsyncThunk(
  "commuter/publicSearchRoutes",
  async (params, { rejectWithValue }) => {
    try {
      const response = await commuterAPI.publicSearchRoutes(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Public search failed");
    }
  }
);

export const searchRoutes = createAsyncThunk(
  "commuter/searchRoutes",
  async (params, { rejectWithValue }) => {
    try {
      const response = await commuterAPI.searchRoutes(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Search failed");
    }
  }
);

export const fetchMyBookings = createAsyncThunk(
  "commuter/fetchMyBookings",
  async (_, { rejectWithValue }) => {
    try {
      const response = await commuterAPI.getMyBookings();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch bookings");
    }
  }
);

export const bookTrip = createAsyncThunk(
  "commuter/bookTrip",
  async ({ tripId, bookingData }, { rejectWithValue }) => {
    try {
      const response = await commuterAPI.bookTrip(tripId, bookingData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Booking failed");
    }
  }
);

export const fetchTripDetails = createAsyncThunk(
  "commuter/fetchTripDetails",
  async (tripId, { rejectWithValue }) => {
    try {
      const response = await commuterAPI.getTripDetails(tripId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch trip details");
    }
  }
);

export const fetchWalletInfo = createAsyncThunk(
  "commuter/fetchWalletInfo",
  async (_, { rejectWithValue }) => {
    try {
      const response = await commuterAPI.getWalletInfo();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch wallet");
    }
  }
);

export const fetchTravelHistory = createAsyncThunk(
  "commuter/fetchTravelHistory",
  async (_, { rejectWithValue }) => {
    try {
      const response = await commuterAPI.getTravelHistory();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch history");
    }
  }
);

export const fetchNotifications = createAsyncThunk(
  "commuter/fetchNotifications",
  async (userId, { rejectWithValue }) => {
    try {
      const response = await commuterAPI.getNotifications(userId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch notifications");
    }
  }
);

// Slice
const initialState = {
  searchResults: [],
  myBookings: [],
  currentTrip: null,
  wallet: { balance: 0, transactions: [] },
  travelHistory: [],
  notifications: [],
  loading: false,
  error: null,
};

const commuterSlice = createSlice({
  name: "commuter",
  initialState,
  reducers: {
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    clearError: (state) => {
      state.error = null;
    },
    addNotification: (state, action) => {
      state.notifications.unshift(action.payload);
    },
    updateTripStatus: (state, action) => {
      if (state.currentTrip?.id === action.payload.tripId) {
        state.currentTrip.status = action.payload.status;
      }
      const booking = state.myBookings.find(b => b.tripId === action.payload.tripId);
      if (booking) {
        booking.status = action.payload.status;
      }
    },
  },
  extraReducers: (builder) => {
    // Public Search Routes (no auth)
    builder
      .addCase(publicSearchRoutes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(publicSearchRoutes.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload?.routes || action.payload || [];
      })
      .addCase(publicSearchRoutes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Search Routes (authenticated)
    builder
      .addCase(searchRoutes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchRoutes.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload?.routes || action.payload || [];
      })
      .addCase(searchRoutes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch My Bookings
    builder
      .addCase(fetchMyBookings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.myBookings = action.payload;
      })
      .addCase(fetchMyBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Book Trip
    builder
      .addCase(bookTrip.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bookTrip.fulfilled, (state, action) => {
        state.loading = false;
        state.myBookings.push(action.payload);
      })
      .addCase(bookTrip.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Trip Details
    builder
      .addCase(fetchTripDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTripDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentTrip = action.payload;
      })
      .addCase(fetchTripDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Wallet Info
    builder
      .addCase(fetchWalletInfo.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWalletInfo.fulfilled, (state, action) => {
        state.loading = false;
        state.wallet = action.payload;
      })
      .addCase(fetchWalletInfo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Travel History
    builder
      .addCase(fetchTravelHistory.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTravelHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.travelHistory = action.payload;
      })
      .addCase(fetchTravelHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Notifications
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  clearSearchResults,
  clearError,
  addNotification,
  updateTripStatus,
} = commuterSlice.actions;

export const selectSearchResults = (state) => state.commuter.searchResults;
export const selectMyBookings = (state) => state.commuter.myBookings;
export const selectCurrentTrip = (state) => state.commuter.currentTrip;
export const selectWallet = (state) => state.commuter.wallet;
export const selectTravelHistory = (state) => state.commuter.travelHistory;
export const selectNotifications = (state) => state.commuter.notifications;
export const selectLoading = (state) => state.commuter.loading;
export const selectError = (state) => state.commuter.error;

export default commuterSlice.reducer;
