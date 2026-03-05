import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import corporateOperationsService from "../../services/corporateOperationsService";

// Async thunks
export const fetchDailyTrips = createAsyncThunk(
  "corporateOps/fetchDailyTrips",
  async (date, { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.getDailyTrips(date);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch trips");
    }
  }
);

export const fetchTripDetails = createAsyncThunk(
  "corporateOps/fetchTripDetails",
  async (tripId, { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.getTripDetails(tripId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch trip details");
    }
  }
);

export const fetchAssignedVehicles = createAsyncThunk(
  "corporateOps/fetchAssignedVehicles",
  async (_, { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.getAssignedVehicles();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch vehicles");
    }
  }
);

export const fetchEmployeeRoutes = createAsyncThunk(
  "corporateOps/fetchEmployeeRoutes",
  async (_, { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.getEmployeeRoutes();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch routes");
    }
  }
);

export const fetchEmployees = createAsyncThunk(
  "corporateOps/fetchEmployees",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.getEmployees(filters);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch employees");
    }
  }
);

export const bulkUploadEmployees = createAsyncThunk(
  "corporateOps/bulkUploadEmployees",
  async (employees, { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.bulkUploadEmployees(employees);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to upload employees");
    }
  }
);

export const fetchAttendanceReport = createAsyncThunk(
  "corporateOps/fetchAttendanceReport",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.getAttendanceReport(filters);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch attendance");
    }
  }
);

export const fetchContracts = createAsyncThunk(
  "corporateOps/fetchContracts",
  async (status = "", { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.getContracts(status);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch contracts");
    }
  }
);

export const fetchQuotations = createAsyncThunk(
  "corporateOps/fetchQuotations",
  async (_, { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.getQuotations();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch quotations");
    }
  }
);

export const fetchAnalytics = createAsyncThunk(
  "corporateOps/fetchAnalytics",
  async (period = "monthly", { rejectWithValue }) => {
    try {
      const response = await corporateOperationsService.getPerformanceAnalytics(period);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch analytics");
    }
  }
);

// Slice
const initialState = {
  dailyTrips: [],
  tripDetails: null,
  assignedVehicles: [],
  employeeRoutes: [],
  employees: [],
  attendanceReport: [],
  contracts: [],
  quotations: [],
  analytics: null,
  selectedTrip: null,
  loading: false,
  error: null,
  uploadStatus: null,
};

const corporateOperationsSliceEnhanced = createSlice({
  name: "corporateOpsEnhanced",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    selectTrip: (state, action) => {
      state.selectedTrip = action.payload;
    },
    clearTripDetails: (state) => {
      state.tripDetails = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Daily Trips
    builder
      .addCase(fetchDailyTrips.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyTrips.fulfilled, (state, action) => {
        state.loading = false;
        state.dailyTrips = action.payload;
      })
      .addCase(fetchDailyTrips.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Trip Details
    builder
      .addCase(fetchTripDetails.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTripDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.tripDetails = action.payload;
      })
      .addCase(fetchTripDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Assigned Vehicles
    builder
      .addCase(fetchAssignedVehicles.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAssignedVehicles.fulfilled, (state, action) => {
        state.loading = false;
        state.assignedVehicles = action.payload;
      })
      .addCase(fetchAssignedVehicles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Employee Routes
    builder
      .addCase(fetchEmployeeRoutes.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEmployeeRoutes.fulfilled, (state, action) => {
        state.loading = false;
        state.employeeRoutes = action.payload;
      })
      .addCase(fetchEmployeeRoutes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Employees
    builder
      .addCase(fetchEmployees.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loading = false;
        state.employees = action.payload;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Bulk Upload Employees
    builder
      .addCase(bulkUploadEmployees.pending, (state) => {
        state.loading = true;
        state.uploadStatus = "uploading";
      })
      .addCase(bulkUploadEmployees.fulfilled, (state, action) => {
        state.loading = false;
        state.uploadStatus = "success";
        state.employees.push(...action.payload);
      })
      .addCase(bulkUploadEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.uploadStatus = "failed";
      });

    // Fetch Attendance Report
    builder
      .addCase(fetchAttendanceReport.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAttendanceReport.fulfilled, (state, action) => {
        state.loading = false;
        state.attendanceReport = action.payload;
      })
      .addCase(fetchAttendanceReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Contracts
    builder
      .addCase(fetchContracts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchContracts.fulfilled, (state, action) => {
        state.loading = false;
        state.contracts = action.payload;
      })
      .addCase(fetchContracts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Quotations
    builder
      .addCase(fetchQuotations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchQuotations.fulfilled, (state, action) => {
        state.loading = false;
        state.quotations = action.payload;
      })
      .addCase(fetchQuotations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Analytics
    builder
      .addCase(fetchAnalytics.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.analytics = action.payload;
      })
      .addCase(fetchAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, selectTrip, clearTripDetails } = corporateOperationsSliceEnhanced.actions;

export const selectDailyTrips = (state) => state.corporateOpsEnhanced?.dailyTrips || [];
export const selectTripDetails = (state) => state.corporateOpsEnhanced?.tripDetails;
export const selectAssignedVehicles = (state) => state.corporateOpsEnhanced?.assignedVehicles || [];
export const selectEmployeeRoutes = (state) => state.corporateOpsEnhanced?.employeeRoutes || [];
export const selectEmployees = (state) => state.corporateOpsEnhanced?.employees || [];
export const selectAttendanceReport = (state) => state.corporateOpsEnhanced?.attendanceReport || [];
export const selectContracts = (state) => state.corporateOpsEnhanced?.contracts || [];
export const selectQuotations = (state) => state.corporateOpsEnhanced?.quotations || [];
export const selectAnalytics = (state) => state.corporateOpsEnhanced?.analytics;
export const selectCorporateOpsLoading = (state) => state.corporateOpsEnhanced?.loading || false;
export const selectCorporateOpsError = (state) => state.corporateOpsEnhanced?.error;

export default corporateOperationsSliceEnhanced.reducer;
