import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import b2bPartnerAPI from "../../services/b2bPartnerAPI";

// Async thunks
export const fetchContracts = createAsyncThunk(
  "b2bPartner/fetchContracts",
  async (_, { rejectWithValue }) => {
    try {
      const response = await b2bPartnerAPI.getContracts();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch contracts"
      );
    }
  }
);

export const fetchDailyTrips = createAsyncThunk(
  "b2bPartner/fetchDailyTrips",
  async (date, { rejectWithValue }) => {
    try {
      const response = await b2bPartnerAPI.getDailyTrips(date);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch daily trips"
      );
    }
  }
);

export const fetchFleet = createAsyncThunk(
  "b2bPartner/fetchFleet",
  async (_, { rejectWithValue }) => {
    try {
      const response = await b2bPartnerAPI.getFleet();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch fleet"
      );
    }
  }
);

export const fetchDrivers = createAsyncThunk(
  "b2bPartner/fetchDrivers",
  async (_, { rejectWithValue }) => {
    try {
      const response = await b2bPartnerAPI.getDrivers();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch drivers"
      );
    }
  }
);

export const fetchEarnings = createAsyncThunk(
  "b2bPartner/fetchEarnings",
  async (period = "monthly", { rejectWithValue }) => {
    try {
      const response = await b2bPartnerAPI.getEarnings(period);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch earnings"
      );
    }
  }
);

export const completeTripAction = createAsyncThunk(
  "b2bPartner/completeTrip",
  async ({ tripId, completionData }, { rejectWithValue }) => {
    try {
      const response = await b2bPartnerAPI.completeTrip(tripId, completionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to complete trip"
      );
    }
  }
);

// Initial state
const initialState = {
  partner: {
    id: null,
    name: null,
    totalVehicles: 0,
    activeContracts: 0,
  },
  contracts: {
    data: [],
    loading: false,
    error: null,
  },
  dailyTrips: {
    data: [],
    loading: false,
    error: null,
    date: null,
  },
  fleet: {
    data: [],
    loading: false,
    error: null,
  },
  drivers: {
    data: [],
    loading: false,
    error: null,
  },
  earnings: {
    data: null,
    loading: false,
    error: null,
    period: "monthly",
  },
  ui: {
    selectedContractId: null,
    selectedTripId: null,
  },
};

// Slice
const b2bPartnerSlice = createSlice({
  name: "b2bPartner",
  initialState,
  reducers: {
    selectContract: (state, action) => {
      state.ui.selectedContractId = action.payload;
    },
    selectTrip: (state, action) => {
      state.ui.selectedTripId = action.payload;
    },
    updateTripStatus: (state, action) => {
      const { tripId, status } = action.payload;
      const trip = state.dailyTrips.data.find((t) => t._id === tripId);
      if (trip) {
        trip.status = status;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch contracts
    builder
      .addCase(fetchContracts.pending, (state) => {
        state.contracts.loading = true;
        state.contracts.error = null;
      })
      .addCase(fetchContracts.fulfilled, (state, action) => {
        state.contracts.loading = false;
        state.contracts.data = action.payload.contracts || [];
      })
      .addCase(fetchContracts.rejected, (state, action) => {
        state.contracts.loading = false;
        state.contracts.error = action.payload;
      });

    // Fetch daily trips
    builder
      .addCase(fetchDailyTrips.pending, (state) => {
        state.dailyTrips.loading = true;
        state.dailyTrips.error = null;
      })
      .addCase(fetchDailyTrips.fulfilled, (state, action) => {
        state.dailyTrips.loading = false;
        state.dailyTrips.data = action.payload.trips || [];
        state.dailyTrips.date = action.payload.date;
      })
      .addCase(fetchDailyTrips.rejected, (state, action) => {
        state.dailyTrips.loading = false;
        state.dailyTrips.error = action.payload;
      });

    // Fetch fleet
    builder
      .addCase(fetchFleet.pending, (state) => {
        state.fleet.loading = true;
        state.fleet.error = null;
      })
      .addCase(fetchFleet.fulfilled, (state, action) => {
        state.fleet.loading = false;
        state.fleet.data = action.payload.vehicles || [];
      })
      .addCase(fetchFleet.rejected, (state, action) => {
        state.fleet.loading = false;
        state.fleet.error = action.payload;
      });

    // Fetch drivers
    builder
      .addCase(fetchDrivers.pending, (state) => {
        state.drivers.loading = true;
        state.drivers.error = null;
      })
      .addCase(fetchDrivers.fulfilled, (state, action) => {
        state.drivers.loading = false;
        state.drivers.data = action.payload.drivers || [];
      })
      .addCase(fetchDrivers.rejected, (state, action) => {
        state.drivers.loading = false;
        state.drivers.error = action.payload;
      });

    // Fetch earnings
    builder
      .addCase(fetchEarnings.pending, (state) => {
        state.earnings.loading = true;
        state.earnings.error = null;
      })
      .addCase(fetchEarnings.fulfilled, (state, action) => {
        state.earnings.loading = false;
        state.earnings.data = action.payload.earnings || action.payload.data;
      })
      .addCase(fetchEarnings.rejected, (state, action) => {
        state.earnings.loading = false;
        state.earnings.error = action.payload;
      });

    // Complete trip
    builder
      .addCase(completeTripAction.pending, (state) => {
        state.dailyTrips.loading = true;
      })
      .addCase(completeTripAction.fulfilled, (state, action) => {
        state.dailyTrips.loading = false;
        const completedTrip = action.payload.data;
        const tripIndex = state.dailyTrips.data.findIndex(
          (t) => t._id === completedTrip._id
        );
        if (tripIndex !== -1) {
          state.dailyTrips.data[tripIndex] = completedTrip;
        }
      })
      .addCase(completeTripAction.rejected, (state, action) => {
        state.dailyTrips.loading = false;
        state.dailyTrips.error = action.payload;
      });
  },
});

// Selectors
export const selectContracts = (state) => state.b2bPartner.contracts.data;
export const selectContractsLoading = (state) =>
  state.b2bPartner.contracts.loading;
export const selectContractsError = (state) => state.b2bPartner.contracts.error;

export const selectDailyTrips = (state) => state.b2bPartner.dailyTrips.data;
export const selectDailyTripsLoading = (state) =>
  state.b2bPartner.dailyTrips.loading;
export const selectDailyTripsDate = (state) => state.b2bPartner.dailyTrips.date;

export const selectFleet = (state) => state.b2bPartner.fleet.data;
export const selectFleetLoading = (state) => state.b2bPartner.fleet.loading;

export const selectDrivers = (state) => state.b2bPartner.drivers.data;
export const selectDriversLoading = (state) => state.b2bPartner.drivers.loading;

export const selectEarnings = (state) => state.b2bPartner.earnings.data;
export const selectEarningsLoading = (state) =>
  state.b2bPartner.earnings.loading;

export const selectSelectedContractId = (state) =>
  state.b2bPartner.ui.selectedContractId;

export const { selectContract, selectTrip, updateTripStatus } =
  b2bPartnerSlice.actions;

export default b2bPartnerSlice.reducer;
