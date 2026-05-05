import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

const initialState = {
    contracts: [],
    currentContract: null,
    loading: false,
    error: null,
    statistics: {
        total: 0,
        active: 0,
        pending: 0,
        completed: 0,
    },
}

export const createContractFromQuotation = createAsyncThunk(
    "contract/createFromQuotation",
    async ({ quotationId, data }, { rejectWithValue }) => {
        try {
            const response = await api.post("/contracts/create-from-quotation", {
                quotationId,
                ...data, // Spread additional data fields
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to create contract")
        }
    },
)

export const getContractById = createAsyncThunk("contract/getById", async ({ contractId, silent = false }, { rejectWithValue }) => {
    try {
        // Validate contractId before making API call
        if (!contractId || contractId === "undefined" || contractId === "null") {
            return rejectWithValue("Invalid contract ID")
        }
        const response = await api.get(`/contracts/${contractId}`)
        return { data: response.data, silent }
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch contract")
    }
})

export const uploadContractDocument = createAsyncThunk(
    "contract/uploadDocument",
    async ({ contractId, formData }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/upload-document`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            })

            return response.data
        } catch (error) {
            console.error("Upload error:", error)
            return rejectWithValue(error.response?.data?.message || "Failed to upload contract document")
        }
    },
)

export const createPaymentSchedules = createAsyncThunk(
    "contract/createPaymentSchedules",
    async ({ contractId, advancePaymentDueDate, securityDepositDueDate, installmentPlan }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/payment-schedules/contracts/${contractId}/schedules`, {
                advancePaymentDueDate,
                securityDepositDueDate,
                installmentPlan,
            })
            return response.data
        } catch (error) {
            console.error("Error creating payment schedules:", error)
            return rejectWithValue(error.response?.data?.message || "Failed to create payment schedules")
        }
    },
)

export const signContract = createAsyncThunk(
    "contract/sign",
    async ({ contractId, signature, ipAddress }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/sign`, { signature, ipAddress })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to sign contract")
        }
    },
)

export const processPayment = createAsyncThunk(
    "contract/processPayment",
    async ({ contractId, paymentType, amount, transactionId }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/payment`, {
                paymentType,
                amount,
                transactionId,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to process payment")
        }
    },
)

export const getCorporateContracts = createAsyncThunk(
    "contract/getCorporateContracts",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/contracts/corporate/all")
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch contracts")
        }
    },
)

export const getFleetContracts = createAsyncThunk("contract/getFleetContracts", async (_, { rejectWithValue }) => {
    try {
        const response = await api.get("/contracts/fleet/all")
        return response.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch contracts")
    }
})

export const assignVehicles = createAsyncThunk(
    "contract/assignVehicles",
    async ({ contractId, vehicleAssignments }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/assign-vehicles`, { vehicleAssignments })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to assign vehicles")
        }
    },
)

export const corporateAcceptContract = createAsyncThunk(
    "contract/corporateAccept",
    async ({ contractId, acceptanceNotes }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/corporate-accept`, { acceptanceNotes })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to accept contract")
        }
    },
)

export const corporateRejectContract = createAsyncThunk(
    "contract/corporateReject",
    async ({ contractId, rejectionReason }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/corporate-reject`, { rejectionReason })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to reject contract")
        }
    },
)

// Due Date Extension Request - Corporate
export const requestDueDateExtension = createAsyncThunk(
    "contract/requestDueDateExtension",
    async ({ contractId, newProposedDate, reason }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/request-due-date-extension`, {
                newProposedDate,
                reason,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to request due date extension")
        }
    },
)

// Due Date Extension Response - B2B Partner
export const respondToDueDateExtension = createAsyncThunk(
    "contract/respondToDueDateExtension",
    async ({ contractId, action, responseNotes, counterOfferedDate }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/respond-due-date-extension`, {
                action,
                responseNotes,
                counterOfferedDate,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to respond to due date extension")
        }
    },
)

// Get Due Date Extension Requests for B2B Partner
export const getDueDateExtensionRequests = createAsyncThunk(
    "contract/getDueDateExtensionRequests",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/contracts/fleet/due-date-requests")
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch due date extension requests")
        }
    },
)

export const approveContract = createAsyncThunk(
    "contract/approve",
    async ({ contractId, approvalNotes }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/approve`, { approvalNotes })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to approve contract")
        }
    },
)

// Upload signed contract document - Corporate
export const uploadSignedContractDocument = createAsyncThunk(
    "contract/uploadSignedDocument",
    async ({ contractId, formData }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/upload-signed-document`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            })
            return response.data
        } catch (error) {
            console.error("Upload signed document error:", error)
            return rejectWithValue(error.response?.data?.message || "Failed to upload signed contract document")
        }
    },
)

// Verify signed contract document - B2B Partner
export const verifySignedContractDocument = createAsyncThunk(
    "contract/verifySignedDocument",
    async ({ contractId, action, verificationNotes, rejectionReason }, { rejectWithValue }) => {
        try {
            const response = await api.post(`/contracts/${contractId}/verify-signed-document`, {
                action,
                verificationNotes,
                rejectionReason,
            })
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to verify signed contract document")
        }
    },
)

// Download contract document
export const downloadContractDocument = createAsyncThunk(
    "contract/downloadDocument",
    async ({ contractId, type = "original" }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/contracts/${contractId}/download-document?type=${type}`)
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to download contract document")
        }
    },
)

const contractSlice = createSlice({
    name: "contract",
    initialState,
    reducers: {
        clearContractError: (state) => {
            state.error = null
        },
        clearCurrentContract: (state) => {
            state.currentContract = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(createContractFromQuotation.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(createContractFromQuotation.fulfilled, (state, action) => {
                state.loading = false
                state.currentContract = action.payload
            })
            .addCase(createContractFromQuotation.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(getContractById.pending, (state, action) => {
                if (!action.meta.arg?.silent) {
                    state.loading = true
                }
                state.error = null
            })
            .addCase(getContractById.fulfilled, (state, action) => {
                state.loading = false
                state.currentContract = action.payload.data
            })
.addCase(getContractById.rejected, (state, action) => {
      state.loading = false
      // Only set error if not a silent poll to prevent error flash during background updates
      if (!action.meta.arg?.silent) {
        state.error = action.payload
      }
    })
            .addCase(uploadContractDocument.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(uploadContractDocument.fulfilled, (state, action) => {
                state.loading = false
                state.currentContract = action.payload
            })
            .addCase(uploadContractDocument.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(signContract.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(signContract.fulfilled, (state, action) => {
                state.loading = false
                state.currentContract = action.payload
            })
            .addCase(signContract.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(processPayment.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(processPayment.fulfilled, (state, action) => {
                state.loading = false
                state.currentContract = action.payload
            })
            .addCase(processPayment.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(getCorporateContracts.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getCorporateContracts.fulfilled, (state, action) => {
                state.loading = false
                state.contracts = action.payload.data?.contracts || []
                state.statistics = action.payload.data?.statistics || initialState.statistics
            })
            .addCase(getCorporateContracts.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(getFleetContracts.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getFleetContracts.fulfilled, (state, action) => {
                state.loading = false
                state.contracts = action.payload.data?.contracts || []
                state.statistics = action.payload.data?.statistics || initialState.statistics
            })
            .addCase(getFleetContracts.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            .addCase(createPaymentSchedules.pending, (state) => {
                state.loading = true
                state.error = null
            })
            // eslint-disable-next-line no-unused-vars
            .addCase(createPaymentSchedules.fulfilled, (state, action) => {
                state.loading = false
                // Schedule creation successful
            })
            .addCase(createPaymentSchedules.rejected, (state, action) => {
                state.loading = false
            })
        
            .addCase(approveContract.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(approveContract.fulfilled, (state, action) => {
                state.loading = false
                state.currentContract = action.payload
            })
            .addCase(approveContract.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Corporate Accept Contract
            .addCase(corporateAcceptContract.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(corporateAcceptContract.fulfilled, (state, action) => {
                state.loading = false
                const contract = action.payload?.data?.contract
                if (contract) {
                    state.currentContract = contract
                    const index = state.contracts.findIndex((c) => c._id === contract._id)
                    if (index !== -1) state.contracts[index] = contract
                }
            })
            .addCase(corporateAcceptContract.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Corporate Reject Contract
            .addCase(corporateRejectContract.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(corporateRejectContract.fulfilled, (state, action) => {
                state.loading = false
                const contract = action.payload?.data?.contract
                if (contract) {
                    state.currentContract = contract
                    const index = state.contracts.findIndex((c) => c._id === contract._id)
                    if (index !== -1) state.contracts[index] = contract
                }
            })
            .addCase(corporateRejectContract.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Request Due Date Extension
            .addCase(requestDueDateExtension.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(requestDueDateExtension.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload?.data?.contract) {
                    state.currentContract = { data: action.payload.data }
                }
            })
            .addCase(requestDueDateExtension.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Respond to Due Date Extension
            .addCase(respondToDueDateExtension.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(respondToDueDateExtension.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload?.data?.contract) {
                    state.currentContract = { data: action.payload.data }
                }
            })
            .addCase(respondToDueDateExtension.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get Due Date Extension Requests
            .addCase(getDueDateExtensionRequests.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getDueDateExtensionRequests.fulfilled, (state, action) => {
                state.loading = false
                state.dueDateRequests = action.payload?.data?.requests || []
            })
            .addCase(getDueDateExtensionRequests.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Upload Signed Contract Document
            .addCase(uploadSignedContractDocument.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(uploadSignedContractDocument.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload?.data?.contract) {
                    state.currentContract = { data: action.payload.data }
                }
            })
            .addCase(uploadSignedContractDocument.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Verify Signed Contract Document
            .addCase(verifySignedContractDocument.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(verifySignedContractDocument.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload?.data?.contract) {
                    state.currentContract = { data: action.payload.data }
                }
            })
            .addCase(verifySignedContractDocument.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Download Contract Document
            .addCase(downloadContractDocument.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(downloadContractDocument.fulfilled, (state) => {
                state.loading = false
            })
            .addCase(downloadContractDocument.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
    },
})

export const { clearContractError, clearCurrentContract } = contractSlice.actions
export default contractSlice.reducer
