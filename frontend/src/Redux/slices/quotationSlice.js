import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

export const requestQuotation = createAsyncThunk(
    "quotation/requestQuotation",
    async (quotationData, { rejectWithValue }) => {
        try {
            const response = await api.post("/quotations/request", quotationData)
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to request quotation")
        }
    },
)

export const getMyQuotations = createAsyncThunk("quotation/getMyQuotations", async (params, { rejectWithValue }) => {
    try {
        const response = await api.post("/quotations/getcorporateownerquotations", params)
        return response.data.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch quotations")
    }
})

export const getQuotationById = createAsyncThunk(
    "quotation/getQuotationById",
    async (quotationId, { rejectWithValue }) => {
        try {
            const response = await api.get(`/quotations/getcorporateownerquotation/${quotationId}`)
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch quotation")
        }
    },
)

export const acceptQuotation = createAsyncThunk(
    "quotation/acceptQuotation",
    async ({ quotationId, data }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/quotations/corporate/${quotationId}/decision`, data)
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to accept quotation")
        }
    },
)

export const rejectQuotation = createAsyncThunk(
    "quotation/rejectQuotation",
    async ({ quotationId, data }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/quotations/corporate/${quotationId}/decision`, data)
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to reject quotation")
        }
    },
)

// export const getQuotationById = createAsyncThunk(
//     "quotation/getQuotationById",
//     async (quotationId, { rejectWithValue }) => {

//         try {
//             const response = await api.get(`/quotations/getcorporateownerquotation/${quotationId}`)

//             return response.data.data
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || "Failed to fetch quotation")
//         }
//     },
// )

// export const sendQuotationResponse = createAsyncThunk(
//     "quotation/sendQuotationResponse",
//     async ({ quotationId, responseData }, { rejectWithValue }) => {
//         try {
//             const response = await api.post(`/quotations/${quotationId}/respond`, responseData)
//             return response.data.data
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || "Failed to send response")
//         }
//     },
// )

// export const negotiateQuotation = createAsyncThunk(
//     "quotation/negotiateQuotation",
//     async ({ quotationId, negotiationData }, { rejectWithValue }) => {
//         try {
//             const response = await api.post(`/quotations/${quotationId}/negotiate`, negotiationData)
//             return response.data.data
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || "Failed to negotiate")
//         }
//     },
// )

// export const acceptQuotation = createAsyncThunk(
//     "quotation/acceptQuotation",
//     async ({ quotationId, acceptanceData }, { rejectWithValue }) => {
//         try {
//             const response = await api.post(`/quotations/${quotationId}/accept`, acceptanceData)
//             return response.data.data
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || "Failed to accept quotation")
//         }
//     },
// )

// export const rejectQuotation = createAsyncThunk(
//     "quotation/rejectQuotation",
//     async ({ quotationId, reason }, { rejectWithValue }) => {
//         try {
//             const response = await api.post(`/quotations/${quotationId}/reject`, { reason })
//             return response.data.data
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || "Failed to reject quotation")
//         }
//     },
// )

export const negotiateQuotation = createAsyncThunk(
    "quotation/negotiateQuotation",
    async ({ quotationId, counterOffer, message }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/quotations/corporate/${quotationId}/negotiate`, {
                counterOffer,
                message,
            })
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to negotiate quotation")
        }
    },
)

export const fetchFleetQuotations = createAsyncThunk(
    "quotation/fetchFleetQuotations",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/quotations/fleet/my-quotations")
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch fleet quotations")
        }
    },
)

export const respondToQuotation = createAsyncThunk(
    "quotation/respondToQuotation",
    async ({ quotationId, status, message, terms, quotedPrice }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/quotations/fleet/${quotationId}/respond`, {
                status,
                message,
                terms,
                quotedPrice, // Send the entire quotedPrice object
            })

            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to respond to quotation")
        }
    },
)


const quotationSlice = createSlice({
    name: "quotation",
    initialState: {
        quotations: [],
        currentQuotation: null,
        loading: false,
        error: null,
        stats: null,
    },
    reducers: {
        clearError: (state) => {
            state.error = null
        },
    },
    extraReducers: (builder) => {
        builder
            // Request Quotation
            .addCase(requestQuotation.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(requestQuotation.fulfilled, (state, action) => {
                state.loading = false
                state.quotations.push(action.payload.quotation)
            })
            .addCase(requestQuotation.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get My Quotations
            .addCase(getMyQuotations.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getMyQuotations.fulfilled, (state, action) => {
                state.loading = false
                state.quotations = action.payload.quotations
                state.stats = action.payload.stats
            })
            .addCase(getMyQuotations.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            .addCase(getQuotationById.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getQuotationById.fulfilled, (state, action) => {
                state.loading = false
                state.currentQuotation = action.payload
            })
            .addCase(getQuotationById.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(acceptQuotation.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(acceptQuotation.fulfilled, (state, action) => {
                state.loading = false
                const index = state.quotations.findIndex((q) => q._id === action.payload.quotation._id)
                if (index !== -1) {
                    state.quotations[index] = action.payload.quotation
                }
                state.currentQuotation = action.payload.quotation
            })
            .addCase(acceptQuotation.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(rejectQuotation.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(rejectQuotation.fulfilled, (state, action) => {
                state.loading = false
                const index = state.quotations.findIndex((q) => q._id === action.payload.quotation._id)
                if (index !== -1) {
                    state.quotations[index] = action.payload.quotation
                }
                state.currentQuotation = action.payload.quotation
            })
            .addCase(rejectQuotation.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            
            // Get Quotation By ID
            // .addCase(getQuotationById.pending, (state) => {
            //     state.loading = true
            // })
            // .addCase(getQuotationById.fulfilled, (state, action) => {
            //     state.loading = false
            //     state.currentQuotation = action.payload;
            // })
            // .addCase(getQuotationById.rejected, (state, action) => {
            //     state.loading = false
            //     state.error = action.payload
            // })
            // Send Response
            // .addCase(sendQuotationResponse.fulfilled, (state, action) => {
            //     const index = state.quotations.findIndex((q) => q._id === action.payload.quotation._id)
            //     if (index !== -1) {
            //         state.quotations[index] = action.payload.quotation
            //     }
            //     state.currentQuotation = action.payload.quotation
            // })
            // Negotiate
            // .addCase(negotiateQuotation.fulfilled, (state, action) => {
            //     const index = state.quotations.findIndex((q) => q._id === action.payload.quotation._id)
            //     if (index !== -1) {
            //         state.quotations[index] = action.payload.quotation
            //     }
            //     state.currentQuotation = action.payload.quotation
            // })
            // Accept
            // .addCase(acceptQuotation.fulfilled, (state, action) => {
            //     const index = state.quotations.findIndex((q) => q._id === action.payload.quotation._id)
            //     if (index !== -1) {
            //         state.quotations[index] = action.payload.quotation
            //     }
            //     state.currentQuotation = action.payload.quotation
            // })
            // // Reject
            // .addCase(rejectQuotation.fulfilled, (state, action) => {
            //     const index = state.quotations.findIndex((q) => q._id === action.payload.quotation._id)
            //     if (index !== -1) {
            //         state.quotations[index] = action.payload.quotation
            //     }
            //     state.currentQuotation = action.payload.quotation
            // })
        
            // Negotiate Quotation
            .addCase(negotiateQuotation.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(negotiateQuotation.fulfilled, (state, action) => {
                state.loading = false
                const quotation = action.payload?.quotation
                if (quotation) {
                    const index = state.quotations.findIndex((q) => q._id === quotation._id)
                    if (index !== -1) {
                        state.quotations[index] = quotation
                    }
                    state.currentQuotation = quotation
                }
            })
            .addCase(negotiateQuotation.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Fetch Fleet Quotations
            .addCase(fetchFleetQuotations.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchFleetQuotations.fulfilled, (state, action) => {
                state.loading = false
                state.quotations = action.payload.quotations
                state.stats = action.payload.stats
            })
            .addCase(fetchFleetQuotations.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Respond to Quotation (Fleet Owner)
            .addCase(respondToQuotation.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(respondToQuotation.fulfilled, (state, action) => {
                state.loading = false
                const index = state.quotations.findIndex((q) => q._id === action.payload.quotation._id)
                if (index !== -1) {
                    state.quotations[index] = action.payload.quotation
                }
                state.currentQuotation = action.payload.quotation
            })
            .addCase(respondToQuotation.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
        
            
    },
})

export const { clearError } = quotationSlice.actions
export default quotationSlice.reducer
