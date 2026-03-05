import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import commuterBookingAPI from "../../services/commuterBookingAPI";

// Async thunks
// Note: commuterBookingAPI methods already return response.data,
// so we use the result directly (no .data access needed)
export const fetchAvailableTrips = createAsyncThunk(
  "commuterBooking/fetchAvailableTrips",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const data = await commuterBookingAPI.getAvailableTrips(filters);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch available trips"
      );
    }
  }
);

export const bookTripAction = createAsyncThunk(
  "commuterBooking/bookTrip",
  async ({ tripId, bookingData }, { rejectWithValue }) => {
    try {
      const data = await commuterBookingAPI.bookTrip(tripId, bookingData);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to book trip"
      );
    }
  }
);

export const cancelBookingAction = createAsyncThunk(
  "commuterBooking/cancelBooking",
  async (bookingId, { rejectWithValue }) => {
    try {
      const data = await commuterBookingAPI.cancelBooking(bookingId);
      return { ...data, bookingId };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to cancel booking"
      );
    }
  }
);

export const fetchMyBookings = createAsyncThunk(
  "commuterBooking/fetchMyBookings",
  async (status = null, { rejectWithValue }) => {
    try {
      const data = await commuterBookingAPI.getMyBookings(status);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch my bookings"
      );
    }
  }
);

export const fetchTripLiveTracking = createAsyncThunk(
  "commuterBooking/fetchTripLiveTracking",
  async (tripId, { rejectWithValue }) => {
    try {
      const data = await commuterBookingAPI.getTripLiveTracking(tripId);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch live tracking"
      );
    }
  }
);

export const fetchMyMonthlyPasses = createAsyncThunk(
  "commuterBooking/fetchMyMonthlyPasses",
  async (userId, { rejectWithValue }) => {
    try {
      const data = await commuterBookingAPI.getMyMonthlyPasses(userId);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch monthly passes"
      );
    }
  }
);

export const fetchWallet = createAsyncThunk(
  "commuterBooking/fetchWallet",
  async (_, { rejectWithValue }) => {
    try {
      const data = await commuterBookingAPI.getWallet();
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch wallet"
      );
    }
  }
);

// Initial state
const initialState = {
  availableTrips: {
    data: [],
    loading: false,
    error: null,
    filters: {},
  },
  myBookings: {
    data: [],
    loading: false,
    error: null,
  },
  liveTracking: {
    data: null,
    loading: false,
    error: null,
    tripId: null,
  },
  monthlyPasses: {
    data: [],
    loading: false,
    error: null,
  },
  wallet: {
    data: null,
    loading: false,
    error: null,
  },
  booking: {
    isBooking: false,
    bookingError: null,
  },
  ui: {
    selectedTripId: null,
    selectedBookingId: null,
  },
};

// Slice
const commuterBookingSlice = createSlice({
  name: "commuterBooking",
  initialState,
  reducers: {
    selectTrip: (state, action) => {
      state.ui.selectedTripId = action.payload;
    },
    selectBooking: (state, action) => {
      state.ui.selectedBookingId = action.payload;
    },
    setFilters: (state, action) => {
      state.availableTrips.filters = action.payload;
    },
    updateLiveLocation: (state, action) => {
      if (state.liveTracking.data) {
        state.liveTracking.data.driverLocation = action.payload;
      }
    },
    clearError: (state, action) => {
      if (action.payload === "booking") {
        state.booking.bookingError = null;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch available trips
    builder
      .addCase(fetchAvailableTrips.pending, (state) => {
        state.availableTrips.loading = true;
        state.availableTrips.error = null;
      })
      .addCase(fetchAvailableTrips.fulfilled, (state, action) => {
        state.availableTrips.loading = false;
        state.availableTrips.data = action.payload.trips || [];
      })
      .addCase(fetchAvailableTrips.rejected, (state, action) => {
        state.availableTrips.loading = false;
        state.availableTrips.error = action.payload;
      });

    // Book trip
    builder
      .addCase(bookTripAction.pending, (state) => {
        state.booking.isBooking = true;
        state.booking.bookingError = null;
      })
      .addCase(bookTripAction.fulfilled, (state, action) => {
        state.booking.isBooking = false;
        state.myBookings.data.unshift(action.payload.booking);
      })
      .addCase(bookTripAction.rejected, (state, action) => {
        state.booking.isBooking = false;
        state.booking.bookingError = action.payload;
      });

    // Cancel booking
    builder
      .addCase(cancelBookingAction.pending, (state) => {
        state.booking.isBooking = true;
      })
      .addCase(cancelBookingAction.fulfilled, (state, action) => {
        state.booking.isBooking = false;
        state.myBookings.data = state.myBookings.data.filter(
          (b) => b._id !== action.payload.bookingId
        );
      })
      .addCase(cancelBookingAction.rejected, (state, action) => {
        state.booking.isBooking = false;
        state.booking.bookingError = action.payload;
      });

    // Fetch my bookings
    builder
      .addCase(fetchMyBookings.pending, (state) => {
        state.myBookings.loading = true;
        state.myBookings.error = null;
      })
      .addCase(fetchMyBookings.fulfilled, (state, action) => {
        state.myBookings.loading = false;
        state.myBookings.data = action.payload.bookings || [];
      })
      .addCase(fetchMyBookings.rejected, (state, action) => {
        state.myBookings.loading = false;
        state.myBookings.error = action.payload;
      });

    // Fetch live tracking
    builder
      .addCase(fetchTripLiveTracking.pending, (state) => {
        state.liveTracking.loading = true;
        state.liveTracking.error = null;
      })
      .addCase(fetchTripLiveTracking.fulfilled, (state, action) => {
        state.liveTracking.loading = false;
        state.liveTracking.data = action.payload;
      })
      .addCase(fetchTripLiveTracking.rejected, (state, action) => {
        state.liveTracking.loading = false;
        state.liveTracking.error = action.payload;
      });

    // Fetch monthly passes
    builder
      .addCase(fetchMyMonthlyPasses.pending, (state) => {
        state.monthlyPasses.loading = true;
        state.monthlyPasses.error = null;
      })
      .addCase(fetchMyMonthlyPasses.fulfilled, (state, action) => {
        state.monthlyPasses.loading = false;
        state.monthlyPasses.data = action.payload.passes || [];
      })
      .addCase(fetchMyMonthlyPasses.rejected, (state, action) => {
        state.monthlyPasses.loading = false;
        state.monthlyPasses.error = action.payload;
      });

    // Fetch wallet
    builder
      .addCase(fetchWallet.pending, (state) => {
        state.wallet.loading = true;
        state.wallet.error = null;
      })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.wallet.loading = false;
        state.wallet.data = action.payload;
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.wallet.loading = false;
        state.wallet.error = action.payload;
      });
  },
});

// Selectors
export const selectAvailableTrips = (state) =>
  state.commuterBooking.availableTrips.data;
export const selectAvailableTripsLoading = (state) =>
  state.commuterBooking.availableTrips.loading;
export const selectAvailableTripsError = (state) =>
  state.commuterBooking.availableTrips.error;

export const selectMyBookings = (state) => state.commuterBooking.myBookings.data;
export const selectMyBookingsLoading = (state) =>
  state.commuterBooking.myBookings.loading;

export const selectLiveTracking = (state) =>
  state.commuterBooking.liveTracking.data;
export const selectLiveTrackingLoading = (state) =>
  state.commuterBooking.liveTracking.loading;

export const selectMyMonthlyPasses = (state) =>
  state.commuterBooking.monthlyPasses.data;

export const selectWallet = (state) => state.commuterBooking.wallet.data;
export const selectWalletLoading = (state) =>
  state.commuterBooking.wallet.loading;

export const selectIsBooking = (state) => state.commuterBooking.booking.isBooking;
export const selectBookingError = (state) =>
  state.commuterBooking.booking.bookingError;

export const {
  selectTrip,
  selectBooking,
  setFilters,
  updateLiveLocation,
  clearError,
} = commuterBookingSlice.actions;

export default commuterBookingSlice.reducer;
