import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminDashboardAPI from "../../services/adminDashboardAPI";

// Async thunks
export const fetchDashboardStats = createAsyncThunk(
  "adminDashboard/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.getDashboardStats();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch dashboard stats"
      );
    }
  }
);

export const fetchUsers = createAsyncThunk(
  "adminDashboard/fetchUsers",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.getUsers(filters);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch users"
      );
    }
  }
);

export const fetchPendingPayments = createAsyncThunk(
  "adminDashboard/fetchPendingPayments",
  async (_, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.getPendingPayments();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch pending payments"
      );
    }
  }
);

export const verifyPaymentAction = createAsyncThunk(
  "adminDashboard/verifyPayment",
  async ({ paymentId, status, notes }, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.verifyPayment(
        paymentId,
        status,
        notes
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to verify payment"
      );
    }
  }
);

export const fetchB2CPartners = createAsyncThunk(
  "adminDashboard/fetchB2CPartners",
  async (_, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.getB2CPartners();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch B2C partners"
      );
    }
  }
);

export const fetchB2BClients = createAsyncThunk(
  "adminDashboard/fetchB2BClients",
  async (_, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.getB2BClients();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch B2B clients"
      );
    }
  }
);

export const fetchFinancialSummary = createAsyncThunk(
  "adminDashboard/fetchFinancialSummary",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.getFinancialSummary(filters);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch financial summary"
      );
    }
  }
);

export const fetchTripReports = createAsyncThunk(
  "adminDashboard/fetchTripReports",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.getTripReports(filters);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch trip reports"
      );
    }
  }
);

export const fetchPendingQuotations = createAsyncThunk(
  "adminDashboard/fetchPendingQuotations",
  async (_, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.getPendingQuotations();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch quotations"
      );
    }
  }
);

export const approveQuotationAction = createAsyncThunk(
  "adminDashboard/approveQuotation",
  async (quotationId, { rejectWithValue }) => {
    try {
      const response = await adminDashboardAPI.approveQuotation(quotationId);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to approve quotation"
      );
    }
  }
);

// Initial state
const initialState = {
  dashboard: {
    stats: null,
    loading: false,
    error: null,
  },
  users: {
    data: [],
    loading: false,
    error: null,
    total: 0,
  },
  payments: {
    pending: [],
    loading: false,
    error: null,
  },
  partners: {
    b2c: [],
    b2b: [],
    loading: false,
    error: null,
  },
  finance: {
    summary: null,
    loading: false,
    error: null,
  },
  reports: {
    trips: [],
    loading: false,
    error: null,
  },
  quotations: {
    pending: [],
    loading: false,
    error: null,
  },
  ui: {
    activeTab: "overview",
    selectedUserId: null,
    selectedPaymentId: null,
  },
};

// Slice
const adminDashboardSlice = createSlice({
  name: "adminDashboard",
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      state.ui.activeTab = action.payload;
    },
    selectUser: (state, action) => {
      state.ui.selectedUserId = action.payload;
    },
    selectPayment: (state, action) => {
      state.ui.selectedPaymentId = action.payload;
    },
    clearError: (state, action) => {
      if (action.payload === "dashboard") {
        state.dashboard.error = null;
      } else if (action.payload === "payments") {
        state.payments.error = null;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch dashboard stats
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.stats = action.payload.stats || action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      });

    // Fetch users
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.users.loading = true;
        state.users.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.users.loading = false;
        state.users.data = action.payload.users || [];
        state.users.total = action.payload.total || 0;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.users.loading = false;
        state.users.error = action.payload;
      });

    // Fetch pending payments
    builder
      .addCase(fetchPendingPayments.pending, (state) => {
        state.payments.loading = true;
        state.payments.error = null;
      })
      .addCase(fetchPendingPayments.fulfilled, (state, action) => {
        state.payments.loading = false;
        state.payments.pending = action.payload.payments || [];
      })
      .addCase(fetchPendingPayments.rejected, (state, action) => {
        state.payments.loading = false;
        state.payments.error = action.payload;
      });

    // Verify payment
    builder
      .addCase(verifyPaymentAction.pending, (state) => {
        state.payments.loading = true;
      })
      .addCase(verifyPaymentAction.fulfilled, (state, action) => {
        state.payments.loading = false;
        state.payments.pending = state.payments.pending.filter(
          (p) => p._id !== action.payload.paymentId
        );
      })
      .addCase(verifyPaymentAction.rejected, (state, action) => {
        state.payments.loading = false;
        state.payments.error = action.payload;
      });

    // Fetch B2C partners
    builder
      .addCase(fetchB2CPartners.pending, (state) => {
        state.partners.loading = true;
        state.partners.error = null;
      })
      .addCase(fetchB2CPartners.fulfilled, (state, action) => {
        state.partners.loading = false;
        state.partners.b2c = action.payload.partners || [];
      })
      .addCase(fetchB2CPartners.rejected, (state, action) => {
        state.partners.loading = false;
        state.partners.error = action.payload;
      });

    // Fetch B2B clients
    builder
      .addCase(fetchB2BClients.pending, (state) => {
        state.partners.loading = true;
        state.partners.error = null;
      })
      .addCase(fetchB2BClients.fulfilled, (state, action) => {
        state.partners.loading = false;
        state.partners.b2b = action.payload.clients || [];
      })
      .addCase(fetchB2BClients.rejected, (state, action) => {
        state.partners.loading = false;
        state.partners.error = action.payload;
      });

    // Fetch financial summary
    builder
      .addCase(fetchFinancialSummary.pending, (state) => {
        state.finance.loading = true;
        state.finance.error = null;
      })
      .addCase(fetchFinancialSummary.fulfilled, (state, action) => {
        state.finance.loading = false;
        state.finance.summary = action.payload;
      })
      .addCase(fetchFinancialSummary.rejected, (state, action) => {
        state.finance.loading = false;
        state.finance.error = action.payload;
      });

    // Fetch trip reports
    builder
      .addCase(fetchTripReports.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchTripReports.fulfilled, (state, action) => {
        state.reports.loading = false;
        state.reports.trips = action.payload.reports || [];
      })
      .addCase(fetchTripReports.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      });

    // Fetch pending quotations
    builder
      .addCase(fetchPendingQuotations.pending, (state) => {
        state.quotations.loading = true;
        state.quotations.error = null;
      })
      .addCase(fetchPendingQuotations.fulfilled, (state, action) => {
        state.quotations.loading = false;
        state.quotations.pending = action.payload.quotations || [];
      })
      .addCase(fetchPendingQuotations.rejected, (state, action) => {
        state.quotations.loading = false;
        state.quotations.error = action.payload;
      });

    // Approve quotation
    builder
      .addCase(approveQuotationAction.pending, (state) => {
        state.quotations.loading = true;
      })
      .addCase(approveQuotationAction.fulfilled, (state, action) => {
        state.quotations.loading = false;
        state.quotations.pending = state.quotations.pending.filter(
          (q) => q._id !== action.payload.quotationId
        );
      })
      .addCase(approveQuotationAction.rejected, (state, action) => {
        state.quotations.loading = false;
        state.quotations.error = action.payload;
      });
  },
});

// Selectors
export const selectDashboardStats = (state) =>
  state.adminDashboard.dashboard.stats;
export const selectDashboardLoading = (state) =>
  state.adminDashboard.dashboard.loading;
export const selectDashboardError = (state) =>
  state.adminDashboard.dashboard.error;

export const selectUsers = (state) => state.adminDashboard.users.data;
export const selectUsersLoading = (state) => state.adminDashboard.users.loading;
export const selectUsersTotal = (state) => state.adminDashboard.users.total;

export const selectPendingPayments = (state) =>
  state.adminDashboard.payments.pending;
export const selectPaymentsLoading = (state) =>
  state.adminDashboard.payments.loading;

export const selectB2CPartners = (state) => state.adminDashboard.partners.b2c;
export const selectB2BClients = (state) => state.adminDashboard.partners.b2b;
export const selectPartnersLoading = (state) =>
  state.adminDashboard.partners.loading;

export const selectFinancialSummary = (state) =>
  state.adminDashboard.finance.summary;
export const selectFinanceLoading = (state) =>
  state.adminDashboard.finance.loading;

export const selectTripReports = (state) => state.adminDashboard.reports.trips;
export const selectReportsLoading = (state) =>
  state.adminDashboard.reports.loading;

export const selectPendingQuotations = (state) =>
  state.adminDashboard.quotations.pending;
export const selectQuotationsLoading = (state) =>
  state.adminDashboard.quotations.loading;

export const selectActiveTab = (state) => state.adminDashboard.ui.activeTab;

export const { setActiveTab, selectUser, selectPayment, clearError } =
  adminDashboardSlice.actions;

export default adminDashboardSlice.reducer;
