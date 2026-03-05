import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

const initialState = {
    wallet: null,
    balance: 0,
    transactions: [],
    payouts: [],
    loading: false,
    error: null,
}

// Get wallet balance
export const getWalletBalance = createAsyncThunk("wallet/getWalletBalance", async (_, { rejectWithValue }) => {
    try {
        const response = await api.get("/wallet/balance")
        return response.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch wallet balance")
    }
})

// Get wallet transactions
export const getWalletTransactions = createAsyncThunk(
    "wallet/getWalletTransactions",
    async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/wallet/transactions?page=${page}&limit=${limit}`)
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch transactions")
        }
    },
)

// Add funds to wallet
export const addFundsToWallet = createAsyncThunk(
    "wallet/addFundsToWallet",
    async ({ amount, paymentMethod, paymentDetails }, { rejectWithValue }) => {
        try {
            const response = await api.post("/wallet/add-funds", {
                amount,
                paymentMethod,
                paymentDetails
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to add funds")
        }
    }
)

// Withdraw funds from wallet
export const withdrawFromWallet = createAsyncThunk(
    "wallet/withdrawFromWallet",
    async ({ amount, iban, bankCode, accountHolderName, currency = "KWD", country = "KW" }, { rejectWithValue }) => {
        try {
            const response = await api.post("/wallet/withdraw", {
                amount: parseFloat(amount),
                iban,
                bankCode,
                accountHolderName,
                currency,
                country
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to withdraw funds")
        }
    }
)

// Request payout
export const requestPayout = createAsyncThunk("wallet/requestPayout", async (payoutData, { rejectWithValue }) => {
    try {
        const response = await api.post("/wallet/payout", payoutData)
        return response.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to request payout")
    }
})

// Get user payouts
export const getUserPayouts = createAsyncThunk(
    "wallet/getUserPayouts",
    async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/wallet/payouts?page=${page}&limit=${limit}`)
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch payouts")
        }
    },
)

// Get wallet statement
export const getWalletStatement = createAsyncThunk(
    "wallet/getWalletStatement",
    async ({ startDate, endDate, page = 1, limit = 20 }, { rejectWithValue }) => {
        try {
            const response = await api.get(
                `/wallet/statement?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=${limit}`
            )
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch wallet statement")
        }
    }
)

// Transfer funds
export const transferFunds = createAsyncThunk(
    "wallet/transferFunds",
    async ({ recipientId, amount, description }, { rejectWithValue }) => {
        try {
            const response = await api.post("/wallet/transfer", {
                recipientId,
                amount,
                description
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to transfer funds")
        }
    }
)

const walletSlice = createSlice({
    name: "wallet",
    initialState,
    reducers: {
        clearWalletError: (state) => {
            state.error = null
        },
        updateBalance: (state, action) => {
            state.balance = action.payload
        },
        updateWalletBalance: (state, action) => {
            state.balance = action.payload
        },
        addTransaction: (state, action) => {
            state.transactions.unshift(action.payload)
        },
        updateWallet: (state, action) => {
            state.wallet = action.payload
            state.balance = action.payload.balance
        }
    },
    extraReducers: (builder) => {
        builder
            // Get wallet balance
            .addCase(getWalletBalance.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getWalletBalance.fulfilled, (state, action) => {
                state.loading = false
                state.wallet = action.payload.data.wallet
                state.balance = action.payload.data.wallet.balance
            })
            .addCase(getWalletBalance.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Get wallet transactions
            .addCase(getWalletTransactions.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getWalletTransactions.fulfilled, (state, action) => {
                state.loading = false
                state.transactions = action.payload.data.transactions
            })
            .addCase(getWalletTransactions.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Add funds to wallet
            .addCase(addFundsToWallet.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(addFundsToWallet.fulfilled, (state, action) => {
                state.loading = false
                state.wallet = action.payload.data.wallet
                state.balance = action.payload.data.wallet.balance
                state.transactions.unshift(action.payload.data.transaction)
            })
            .addCase(addFundsToWallet.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Withdraw from wallet
            .addCase(withdrawFromWallet.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(withdrawFromWallet.fulfilled, (state, action) => {
                state.loading = false
                state.wallet = action.payload.data.wallet
                state.balance = action.payload.data.wallet.balance
                state.transactions.unshift(action.payload.data.transaction)
            })
            .addCase(withdrawFromWallet.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Request payout
            .addCase(requestPayout.pending, (state) => {
                state.loading = true
                state.error = null
            })
            // eslint-disable-next-line no-unused-vars
            .addCase(requestPayout.fulfilled, (state, action) => {
                state.loading = false
                // Payout request successful
            })
            .addCase(requestPayout.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Get user payouts
            .addCase(getUserPayouts.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getUserPayouts.fulfilled, (state, action) => {
                state.loading = false
                state.payouts = action.payload.data.payouts
            })
            .addCase(getUserPayouts.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Get wallet statement
            .addCase(getWalletStatement.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getWalletStatement.fulfilled, (state, action) => {
                state.loading = false
                state.transactions = action.payload.data.transactions
            })
            .addCase(getWalletStatement.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Transfer funds
            .addCase(transferFunds.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(transferFunds.fulfilled, (state, action) => {
                state.loading = false
                state.wallet = action.payload.data.wallet
                state.balance = action.payload.data.wallet.balance
                state.transactions.unshift(action.payload.data.transaction)
            })
            .addCase(transferFunds.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
    },
})

export const {
    clearWalletError,
    updateBalance,
    addTransaction,
    updateWallet,
    updateWalletBalance
} = walletSlice.actions

export default walletSlice.reducer
