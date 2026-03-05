import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import corporateOperationsAPI from "../../services/corporateOperationsAPI";

const initialState = {
    dailyTrips: [],
    employeeTrips: [],
    assignedRoutes: [],
    currentTripDetails: null,
    loading: false,
    error: null,
    success: false,
};

// Async thunks
export const fetchDailyTrips = createAsyncThunk(
    "corporateOperations/fetchDailyTrips",
    async (date, { rejectWithValue }) => {
        try {
            const response = await corporateOperationsAPI.getDailyTrips(date);
            return response;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch daily trips");
        }
    }
);

export const fetchEmployeeTrips = createAsyncThunk(
    "corporateOperations/fetchEmployeeTrips",
    async ({ employeeId, date }, { rejectWithValue }) => {
        try {
            const response = await corporateOperationsAPI.getEmployeeAssignedTrips(employeeId, date);
            return response;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch employee trips");
        }
    }
);

export const fetchAssignedRoutesStatus = createAsyncThunk(
    "corporateOperations/fetchAssignedRoutesStatus",
    async (routeId, { rejectWithValue }) => {
        try {
            const response = await corporateOperationsAPI.getAssignedRoutesStatus(routeId);
            return response;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch routes status");
        }
    }
);

export const assignRoute = createAsyncThunk(
    "corporateOperations/assignRoute",
    async ({ routeId, vehicleId, driverId, corporateDriverId }, { rejectWithValue }) => {
        try {
            const response = await corporateOperationsAPI.assignRouteToVehicle(
                routeId,
                vehicleId,
                driverId,
                corporateDriverId
            );
            return response;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to assign route");
        }
    }
);

export const assignEmployeesToTripThunk = createAsyncThunk(
    "corporateOperations/assignEmployeesToTrip",
    async ({ tripId, employees }, { rejectWithValue }) => {
        try {
            const response = await corporateOperationsAPI.assignEmployeesToTrip(tripId, employees);
            return response;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to assign employees");
        }
    }
);

export const fetchTripDetails = createAsyncThunk(
    "corporateOperations/fetchTripDetails",
    async (tripId, { rejectWithValue }) => {
        try {
            const response = await corporateOperationsAPI.getTripDetails(tripId);
            return response;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch trip details");
        }
    }
);

// Slice
const corporateOperationsSlice = createSlice({
    name: "corporateOperations",
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        clearSuccess: (state) => {
            state.success = false;
        },
    },
    extraReducers: (builder) => {
        // fetchDailyTrips
        builder
            .addCase(fetchDailyTrips.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDailyTrips.fulfilled, (state, action) => {
                state.loading = false;
                state.dailyTrips = action.payload.data?.trips || [];
                state.success = true;
            })
            .addCase(fetchDailyTrips.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // fetchEmployeeTrips
        builder
            .addCase(fetchEmployeeTrips.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchEmployeeTrips.fulfilled, (state, action) => {
                state.loading = false;
                state.employeeTrips = action.payload.data?.trips || [];
                state.success = true;
            })
            .addCase(fetchEmployeeTrips.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // fetchAssignedRoutesStatus
        builder
            .addCase(fetchAssignedRoutesStatus.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAssignedRoutesStatus.fulfilled, (state, action) => {
                state.loading = false;
                state.assignedRoutes = action.payload.data?.routes || [];
                state.success = true;
            })
            .addCase(fetchAssignedRoutesStatus.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // assignRoute
        builder
            .addCase(assignRoute.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(assignRoute.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
            })
            .addCase(assignRoute.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // assignEmployeesToTripThunk
        builder
            .addCase(assignEmployeesToTripThunk.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(assignEmployeesToTripThunk.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
            })
            .addCase(assignEmployeesToTripThunk.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // fetchTripDetails
        builder
            .addCase(fetchTripDetails.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTripDetails.fulfilled, (state, action) => {
                state.loading = false;
                state.currentTripDetails = action.payload.data;
                state.success = true;
            })
            .addCase(fetchTripDetails.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const { clearError, clearSuccess } = corporateOperationsSlice.actions;
export default corporateOperationsSlice.reducer;
