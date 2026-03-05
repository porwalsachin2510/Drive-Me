import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

const initialState = {
    currentPayment: null,
    advancePayment: null,
    finalPayment: null,
    loading: false,
    error: null,
    paymentUrl: null,
    paymentProvider: null,
}

export const createPayment = createAsyncThunk(
    "payment/createPayment",
    async ({ contractId, paymentMethod, paymentType = "advance", currency }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/payments/contracts/${contractId}/payment`, {
                paymentMethod,
                paymentType,
                currency,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to create payment")
        }
    },
)

export const verifyPayment = createAsyncThunk(
    "payment/verifyPayment",
    async ({ sessionId, provider }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/payments/payment/verify?session_id=${sessionId}&provider=${provider}`)
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to verify payment")
        }
    },
)

export const getPaymentByContract = createAsyncThunk(
    "payment/getPaymentByContract",
    async ({ contractId, silent = false }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/payments/contracts/${contractId}/payment`)
            return { data: response.data, silent }
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch payment")
        }
    },
)

const paymentSlice = createSlice({
    name: "payment",
    initialState,
    reducers: {
        clearPaymentError: (state) => {
            state.error = null
        },
        clearPaymentData: (state) => {
            state.paymentUrl = null
            state.paymentProvider = null
            state.currentPayment = null
            state.advancePayment = null
            state.finalPayment = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(createPayment.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(createPayment.fulfilled, (state, action) => {
                state.loading = false
                state.currentPayment = action.payload.data.payment
                state.paymentUrl = action.payload.data.paymentUrl
                state.paymentProvider = action.payload.data.provider

                if (action.payload.data.payment.paymentType === "advance") {
                    state.advancePayment = action.payload.data.payment
                } else if (action.payload.data.payment.paymentType === "final") {
                    state.finalPayment = action.payload.data.payment
                }
            })
            .addCase(createPayment.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(verifyPayment.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(verifyPayment.fulfilled, (state, action) => {
                state.loading = false
                state.currentPayment = action.payload.data.payment
            })
            .addCase(verifyPayment.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(getPaymentByContract.pending, (state, action) => {
                if (!action.meta.arg?.silent) {
                    state.loading = true
                }
                state.error = null
            })
            .addCase(getPaymentByContract.fulfilled, (state, action) => {
                state.loading = false
                // Backend now returns 200 with null payment when none exists
                const payment = action.payload?.data?.data?.payment || action.payload?.data?.payment || null
                state.currentPayment = payment
                state.error = null
            })
            .addCase(getPaymentByContract.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
    },
})

export const { clearPaymentError, clearPaymentData } = paymentSlice.actions
export default paymentSlice.reducer
