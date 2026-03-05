import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

export const fetchVehicleAssignmentById = createAsyncThunk(
    "vehicleAssignment/fetchVehicleAssignmentById",
    async (assignmentId, { rejectWithValue }) => {
        try {
            const response = await api.get(`/vehicle-assignments/assignment/${assignmentId}`)
            return response.data.assignment
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch assignment")
        }
    },
)

export const fetchVehicleAssignments = createAsyncThunk(
    "vehicleAssignment/fetchVehicleAssignments",
    async (_, { rejectWithValue }) => {
        try {          
            const response = await api.get("/vehicle-assignments/assignments");
            return response.data.assignments
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch assignments")
        }
    },
)

// Get contract for assignment
export const getContractForAssignment = createAsyncThunk(
    "vehicleAssignment/getContractForAssignment",
    async (contractId, { rejectWithValue }) => {
        try {
            const response = await api.get(`/vehicle-assignments/contract/${contractId}`)
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch contract")
        }
    },
)

// Assign vehicles
export const assignVehicles = createAsyncThunk(
    "vehicleAssignment/assignVehicles",
    async ({ contractId, assignments }, { rejectWithValue }) => {
        try {
            const response = await api.post(
                `/vehicle-assignments/contract/${contractId}/assign`,
                { assignments }
            )
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to assign vehicles")
        }
    },
)

export const assignVehiclesToContract = createAsyncThunk(
    "vehicleAssignment/assignVehiclesToContract",
    async ({ assignmentId, data }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/vehicle-assignments/assignment/${assignmentId}`, data)
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to assign vehicles")
        }
    },
)

// Get assigned vehicles
export const getAssignedVehicles = createAsyncThunk(
    "vehicleAssignment/getAssignedVehicles",
    async (contractId, { rejectWithValue }) => {
        try {
         
            const response = await api.get(`/vehicle-assignments/contract/${contractId}/assignments`, {
                
            })
            return response.data.assignments
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch assignments")
        }
    },
)

const vehicleAssignmentSlice = createSlice({
    name: "vehicleAssignment",
    initialState: {
        contract: null,
        availableVehicles: [],
        assignments: [],
        loading: false,
        error: null,
        success: false,
    },
    reducers: {
        clearError: (state) => {
            state.error = null
        },
        clearSuccess: (state) => {
            state.success = false
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchVehicleAssignments.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchVehicleAssignments.fulfilled, (state, action) => {
                state.loading = false
                state.assignments = action.payload
            })
            .addCase(fetchVehicleAssignments.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(getContractForAssignment.pending, (state) => {
                state.loading = true
            })
            .addCase(getContractForAssignment.fulfilled, (state, action) => {
                state.loading = false
                state.contract = action.payload.contract
                state.availableVehicles = action.payload.availableVehicles
            })
            .addCase(getContractForAssignment.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(assignVehicles.fulfilled, (state, action) => {
                state.success = true
                state.assignments = action.payload.assignments
            })
            .addCase(assignVehicles.rejected, (state, action) => {
                state.error = action.payload
            })
            .addCase(assignVehiclesToContract.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(assignVehiclesToContract.fulfilled, (state, action) => {
                state.loading = false
                state.success = true
                state.currentAssignment = action.payload.assignment
            })
            .addCase(assignVehiclesToContract.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(getAssignedVehicles.fulfilled, (state, action) => {
                state.assignments = action.payload
            })
    },
})

export const { clearError, clearSuccess } = vehicleAssignmentSlice.actions
export default vehicleAssignmentSlice.reducer
