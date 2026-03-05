import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

// Admin login
export const adminLogin = createAsyncThunk("admin/adminLogin", async (credentials, { rejectWithValue }) => {
    try {
        const response = await api.post("/auth/admin-login", credentials)
        return response.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Admin login failed")
    }
})

// Admin edit user
export const editUser = createAsyncThunk("admin/editUser", async ({ userId, updates }, { rejectWithValue }) => {
    try {
        const response = await api.put(`/admin/users/${userId}`, updates)
        return response.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to edit user")
    }
})

// Get dashboard stats
export const getDashboardStats = createAsyncThunk("admin/getDashboardStats", async (_, { rejectWithValue }) => {
    try {
        const response = await api.get(`/admin/dashboard/stats`)
        return response.data.stats
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch dashboard stats")
    }
})

// Get pending payments
export const getPendingPayments = createAsyncThunk("admin/getPendingPayments", async (_, { rejectWithValue }) => {
    try {
        
        const response = await api.get(`/admin/payments/pending`)
        return response.data.payments
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch pending payments")
    }
})

// Get payment details
export const getPaymentDetails = createAsyncThunk("admin/getPaymentDetails", async (paymentId, { rejectWithValue }) => {
    try {
       
        const response = await api.get(`/admin/payments/${paymentId}`)
        return response.data.payment
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch payment details")
    }
})

// Verify payment
export const verifyPayment = createAsyncThunk(
    "admin/verifyPayment",
    async ({ paymentId, action, reason }, { rejectWithValue }) => {
        try {
           
            const response = await api.put(
                `/admin/payments/${paymentId}/verify`,
                { action, reason },
                
            )
            return response.data.payment
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to verify payment")
        }
    },
)

// Get all contracts
export const getAllContracts = createAsyncThunk(
    "admin/getAllContracts",
    async ({ status, page = 1, limit = 10 }, { rejectWithValue }) => {
        try {
            
            const params = new URLSearchParams({ page, limit })
            if (status) params.append("status", status)

            const response = await api.get(`/admin/contracts?${params}`)
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch contracts")
        }
    },
)

// Get B2C partners
export const getB2CPartners = createAsyncThunk(
    "admin/getB2CPartners",
    async (filters = {}, { rejectWithValue }) => {
        try {
            const response = await api.get("/admin/b2c-partners", { params: filters })
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch B2C partners")
        }
    }
)

// Get B2B clients
export const getB2BClients = createAsyncThunk(
    "admin/getB2BClients",
    async (filters = {}, { rejectWithValue }) => {
        try {
            const response = await api.get("/admin/b2b-clients", { params: filters })
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch B2B clients")
        }
    }
)

// Get all users
export const getAllUsers = createAsyncThunk(
    "admin/getAllUsers",
    async (filters = {}, { rejectWithValue }) => {
        try {
            const response = await api.get("/admin/users", { params: filters })
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch users")
        }
    }
)

// Get finance summary
export const getFinanceSummary = createAsyncThunk(
    "admin/getFinanceSummary",
    async (dateRange = {}, { rejectWithValue }) => {
        try {
            const response = await api.get("/admin/finance/summary", { params: dateRange })
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch finance summary")
        }
    }
)

// Get ride pooling stats
export const getRidePoolingStats = createAsyncThunk(
    "admin/getRidePoolingStats",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/admin/ride-pooling/stats")
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch ride pooling stats")
        }
    }
)

const adminSlice = createSlice({
    name: "admin",
    initialState: {
        stats: null,
        pendingPayments: [],
        selectedPayment: null,
        contracts: [],
        b2cPartners: [],
        b2bClients: [],
        users: [],
        financeSummary: null,
        ridePoolingStats: null,
        pagination: null,
        loading: false,
        error: null,
    },
    reducers: {
        clearError: (state) => {
            state.error = null
        },
        clearSelectedPayment: (state) => {
            state.selectedPayment = null
        },
    },
    extraReducers: (builder) => {
        builder
            // Dashboard stats
            .addCase(getDashboardStats.pending, (state) => {
                state.loading = true
            })
            .addCase(getDashboardStats.fulfilled, (state, action) => {
                state.loading = false
                state.stats = action.payload
            })
            .addCase(getDashboardStats.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Pending payments
            .addCase(getPendingPayments.pending, (state) => {
                state.loading = true
            })
            .addCase(getPendingPayments.fulfilled, (state, action) => {
                state.loading = false
                state.pendingPayments = action.payload
            })
            .addCase(getPendingPayments.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Payment details
            .addCase(getPaymentDetails.fulfilled, (state, action) => {
                state.selectedPayment = action.payload
            })
            // Verify payment
            .addCase(verifyPayment.fulfilled, (state, action) => {
                state.pendingPayments = state.pendingPayments.filter((p) => p._id !== action.payload._id)
                state.selectedPayment = null
            })
            // Contracts
            .addCase(getAllContracts.fulfilled, (state, action) => {
                state.contracts = action.payload.contracts
                state.pagination = action.payload.pagination
            })
            // B2C Partners
            .addCase(getB2CPartners.pending, (state) => {
                state.loading = true
            })
            .addCase(getB2CPartners.fulfilled, (state, action) => {
                state.loading = false
                state.b2cPartners = action.payload
            })
            .addCase(getB2CPartners.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // B2B Clients
            .addCase(getB2BClients.pending, (state) => {
                state.loading = true
            })
            .addCase(getB2BClients.fulfilled, (state, action) => {
                state.loading = false
                state.b2bClients = action.payload
            })
            .addCase(getB2BClients.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Users
            .addCase(getAllUsers.pending, (state) => {
                state.loading = true
            })
            .addCase(getAllUsers.fulfilled, (state, action) => {
                state.loading = false
                state.users = action.payload
            })
            .addCase(getAllUsers.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Finance Summary
            .addCase(getFinanceSummary.pending, (state) => {
                state.loading = true
            })
            .addCase(getFinanceSummary.fulfilled, (state, action) => {
                state.loading = false
                state.financeSummary = action.payload
            })
            .addCase(getFinanceSummary.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Ride Pooling Stats
            .addCase(getRidePoolingStats.pending, (state) => {
                state.loading = true
            })
            .addCase(getRidePoolingStats.fulfilled, (state, action) => {
                state.loading = false
                state.ridePoolingStats = action.payload
            })
            .addCase(getRidePoolingStats.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
    },
})

export const { clearError, clearSelectedPayment } = adminSlice.actions

// Selectors
export const selectStats = (state) => state.admin.stats
export const selectPendingPayments = (state) => state.admin.pendingPayments
export const selectSelectedPayment = (state) => state.admin.selectedPayment
export const selectContracts = (state) => state.admin.contracts
export const selectB2CPartners = (state) => state.admin.b2cPartners
export const selectB2BClients = (state) => state.admin.b2bClients
export const selectUsers = (state) => state.admin.users
export const selectFinanceSummary = (state) => state.admin.financeSummary
export const selectRidePoolingStats = (state) => state.admin.ridePoolingStats
export const selectAdminLoading = (state) => state.admin.loading
export const selectAdminError = (state) => state.admin.error

export default adminSlice.reducer
