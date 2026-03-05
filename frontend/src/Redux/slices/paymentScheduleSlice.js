import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

export const createPaymentSchedules = createAsyncThunk(
    "paymentSchedule/create",
    async ({ contractId, advancePaymentDueDate, securityDepositDueDate, installmentPlan }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/payment-schedules/contracts/${contractId}/schedules`, {
                advancePaymentDueDate,
                securityDepositDueDate,
                installmentPlan,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to create payment schedules")
        }
    },
)

export const getPaymentScheduleByContract = createAsyncThunk(
    "paymentSchedule/getByContract",
    async ({ contractId, silent = false }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/payment-schedules/contracts/${contractId}/schedules`)
            return { schedules: response.data.schedules || [], silent }
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch payment schedules")
        }
    },
)

export const checkOverduePayments = createAsyncThunk("paymentSchedule/checkOverdue", async (_, { rejectWithValue }) => {
    try {
            const response = await api.post(`/payment-schedules/check-overdue`, {})
        return response.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to check overdue payments")
    }
})

export const markPaymentAsPaid = createAsyncThunk(
    "paymentSchedule/markAsPaid",
    async ({ scheduleId, paymentDetails }, { rejectWithValue }) => {
        try {
            const response = await api.patch(`/payment-schedules/${scheduleId}/mark-paid`, paymentDetails)
            return response.data.schedule
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to mark payment as paid")
        }
    },
)

export const getAllOverduePayments = createAsyncThunk(
    "paymentSchedule/getAllOverdue",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get(`/payment-schedules/overdue`)
            return response.data.overdueSchedules || []
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch overdue payments")
        }
    },
)

export const fetchPaymentSchedule = getPaymentScheduleByContract

const paymentScheduleSlice = createSlice({
    name: "paymentSchedule",
    initialState: {
        currentSchedule: null,
        overduePayments: [],
        loading: false,
        error: null,
    },
    reducers: {
        clearPaymentSchedule: (state) => {
            state.currentSchedule = null
            state.error = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(createPaymentSchedules.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(createPaymentSchedules.fulfilled, (state, action) => {
                state.loading = false
                state.currentSchedule = action.payload.schedules
            })
            .addCase(createPaymentSchedules.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get by contract
            .addCase(getPaymentScheduleByContract.pending, (state, action) => {
                if (!action.meta.arg?.silent) {
                    state.loading = true
                }
            })
            .addCase(getPaymentScheduleByContract.fulfilled, (state, action) => {
                state.loading = false
                state.currentSchedule = action.payload.schedules
            })
            .addCase(getPaymentScheduleByContract.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Check overdue
            .addCase(checkOverduePayments.pending, (state) => {
                state.loading = true
            })
            .addCase(checkOverduePayments.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload.overdueSchedules) {
                    state.overduePayments = action.payload.overdueSchedules
                }
            })
            .addCase(checkOverduePayments.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Mark as paid
            .addCase(markPaymentAsPaid.pending, (state) => {
                state.loading = true
            })
            .addCase(markPaymentAsPaid.fulfilled, (state, action) => {
                state.loading = false
                if (state.currentSchedule && Array.isArray(state.currentSchedule)) {
                    const index = state.currentSchedule.findIndex((item) => item._id === action.payload._id)
                    if (index !== -1) {
                        state.currentSchedule[index] = action.payload
                    }
                }
            })
            .addCase(markPaymentAsPaid.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get all overdue
            .addCase(getAllOverduePayments.pending, (state) => {
                state.loading = true
            })
            .addCase(getAllOverduePayments.fulfilled, (state, action) => {
                state.loading = false
                state.overduePayments = action.payload
            })
            .addCase(getAllOverduePayments.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
    },
})

export const { clearPaymentSchedule } = paymentScheduleSlice.actions
export default paymentScheduleSlice.reducer
