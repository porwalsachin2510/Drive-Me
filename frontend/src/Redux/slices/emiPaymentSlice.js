import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

// Create EMI Plan
export const createEMIPlan = createAsyncThunk(
    "emiPayment/createEMIPlan",
    async ({ contractId, tenure }, { rejectWithValue }) => {
        try {
            const response = await api.post("/emi-payments/create", { contractId, tenure })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to create EMI plan")
        }
    }
)

// Get EMI Plan by Contract
export const getEMIPlanByContract = createAsyncThunk(
    "emiPayment/getEMIPlanByContract",
    async ({ contractId }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/emi-payments/contract/${contractId}`)
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch EMI plan")
        }
    }
)

// Pay EMI Installment
export const payEMIInstallment = createAsyncThunk(
    "emiPayment/payEMIInstallment",
    async ({ emiPaymentId, installmentNumber, paymentMethod }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/emi-payments/${emiPaymentId}/pay-installment`, {
                installmentNumber,
                paymentMethod,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to process EMI payment")
        }
    }
)

// Verify EMI Online Payment (after Stripe redirect)
export const verifyEMIOnlinePayment = createAsyncThunk(
    "emiPayment/verifyEMIOnlinePayment",
    async ({ sessionId, provider }, { rejectWithValue }) => {
        try {
            const response = await api.post("/emi-payments/verify-online", {
                sessionId,
                provider: provider || "stripe"
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to verify EMI payment")
        }
    }
)

// Get Corporate EMI Payments
export const getCorporateEMIPayments = createAsyncThunk(
    "emiPayment/getCorporateEMIPayments",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/emi-payments/corporate/all")
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch EMI payments")
        }
    }
)

// Get B2B Partner EMI Payments
export const getB2BPartnerEMIPayments = createAsyncThunk(
    "emiPayment/getB2BPartnerEMIPayments",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/emi-payments/b2b/all")
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch EMI payments")
        }
    }
)

// Request Service Suspension (B2B Partner)
export const requestServiceSuspension = createAsyncThunk(
    "emiPayment/requestServiceSuspension",
    async ({ emiPaymentId, reason }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/emi-payments/${emiPaymentId}/request-suspension`, { reason })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to request suspension")
        }
    }
)

// Admin Actions
// Get All EMI Payments (Admin)
export const getAllEMIPaymentsAdmin = createAsyncThunk(
    "emiPayment/getAllEMIPaymentsAdmin",
    async ({ status, overdue } = {}, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams()
            if (status) params.append("status", status)
            if (overdue) params.append("overdue", overdue)
            const response = await api.get(`/emi-payments/admin/all?${params.toString()}`)
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch EMI payments")
        }
    }
)

// Verify EMI Payment (Admin)
export const verifyEMIPayment = createAsyncThunk(
    "emiPayment/verifyEMIPayment",
    async ({ emiPaymentId, installmentNumber, action, notes }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/emi-payments/${emiPaymentId}/verify-payment`, {
                installmentNumber,
                action,
                notes,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to verify EMI payment")
        }
    }
)

// Send EMI Warning (Admin)
export const sendEMIWarning = createAsyncThunk(
    "emiPayment/sendEMIWarning",
    async ({ emiPaymentId, warningType, message }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/emi-payments/${emiPaymentId}/send-warning`, {
                warningType,
                message,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to send warning")
        }
    }
)

// Toggle Service Status (Admin)
export const toggleServiceStatus = createAsyncThunk(
    "emiPayment/toggleServiceStatus",
    async ({ emiPaymentId, action, reason }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/emi-payments/${emiPaymentId}/toggle-service`, {
                action,
                reason,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to update service status")
        }
    }
)

const initialState = {
    currentEMIPlan: null,
    emiPayments: [],
    adminEMIPayments: [],
    adminStats: null,
    loading: false,
    error: null,
}

const emiPaymentSlice = createSlice({
    name: "emiPayment",
    initialState,
    reducers: {
        clearEMIError: (state) => {
            state.error = null
        },
        clearCurrentEMIPlan: (state) => {
            state.currentEMIPlan = null
        },
    },
    extraReducers: (builder) => {
        builder
            // Create EMI Plan
            .addCase(createEMIPlan.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(createEMIPlan.fulfilled, (state, action) => {
                state.loading = false
                state.currentEMIPlan = action.payload.data?.emiPayment || null
            })
            .addCase(createEMIPlan.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get EMI Plan by Contract
            .addCase(getEMIPlanByContract.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getEMIPlanByContract.fulfilled, (state, action) => {
                state.loading = false
                state.currentEMIPlan = action.payload.data?.emiPayment || null
            })
            .addCase(getEMIPlanByContract.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Pay EMI Installment
            .addCase(payEMIInstallment.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(payEMIInstallment.fulfilled, (state) => {
                state.loading = false
            })
            .addCase(payEMIInstallment.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Verify EMI Online Payment
            .addCase(verifyEMIOnlinePayment.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(verifyEMIOnlinePayment.fulfilled, (state, action) => {
                state.loading = false
                // Update current EMI plan if returned
                if (action.payload.data?.emiPayment) {
                    state.currentEMIPlan = action.payload.data.emiPayment
                }
            })
            .addCase(verifyEMIOnlinePayment.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get Corporate EMI Payments
            .addCase(getCorporateEMIPayments.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getCorporateEMIPayments.fulfilled, (state, action) => {
                state.loading = false
                state.emiPayments = action.payload.data?.emiPayments || []
            })
            .addCase(getCorporateEMIPayments.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get B2B Partner EMI Payments
            .addCase(getB2BPartnerEMIPayments.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getB2BPartnerEMIPayments.fulfilled, (state, action) => {
                state.loading = false
                state.emiPayments = action.payload.data?.emiPayments || []
            })
            .addCase(getB2BPartnerEMIPayments.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Admin - Get All EMI Payments
            .addCase(getAllEMIPaymentsAdmin.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getAllEMIPaymentsAdmin.fulfilled, (state, action) => {
                state.loading = false
                state.adminEMIPayments = action.payload.data?.emiPayments || []
                state.adminStats = action.payload.data?.stats || null
            })
            .addCase(getAllEMIPaymentsAdmin.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Verify EMI Payment
            .addCase(verifyEMIPayment.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(verifyEMIPayment.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload.data?.emiPayment) {
                    const index = state.adminEMIPayments.findIndex(
                        (e) => e._id === action.payload.data.emiPayment._id
                    )
                    if (index !== -1) {
                        state.adminEMIPayments[index] = action.payload.data.emiPayment
                    }
                }
            })
            .addCase(verifyEMIPayment.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Toggle Service Status
            .addCase(toggleServiceStatus.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(toggleServiceStatus.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload.data?.emiPayment) {
                    const index = state.adminEMIPayments.findIndex(
                        (e) => e._id === action.payload.data.emiPayment._id
                    )
                    if (index !== -1) {
                        state.adminEMIPayments[index] = action.payload.data.emiPayment
                    }
                }
            })
            .addCase(toggleServiceStatus.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
    },
})

export const { clearEMIError, clearCurrentEMIPlan } = emiPaymentSlice.actions
export default emiPaymentSlice.reducer
