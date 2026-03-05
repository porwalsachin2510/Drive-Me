import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

export const searchVehicles = createAsyncThunk("vehicle/searchVehicles", async (searchParams, { rejectWithValue }) => {
    try {
        const response = await api.get("/vehicles/search", { params: searchParams })
        return response.data.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Search failed")
    }
})

export const getVehicleById = createAsyncThunk("vehicle/getVehicleById", async (vehicleId, { rejectWithValue }) => {

    try {
        const response = await api.get(`/vehicles/${vehicleId}`)
        return response.data.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch vehicle")
    }
})

export const getFleetOwnerVehicles = createAsyncThunk(
    "vehicle/getFleetOwnerVehicles",
    async (fleetOwnerId, { rejectWithValue }) => {
        try {
            const response = await api.get(`/vehicles/fleet-owner/${fleetOwnerId}`)
            return response.data.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch vehicles")
        }
    },
)

export const getMyVehicles = createAsyncThunk("vehicle/getMyVehicles", async (params, { rejectWithValue }) => {
    try {
        const response = await api.get("/vehicles/my/vehicles", { params })
        return response.data.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch vehicles")
    }
})

export const addVehicle = createAsyncThunk("vehicle/addVehicle", async (formData, { rejectWithValue }) => {
    try {
        const response = await api.post("/vehicles", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        return response.data.data
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to add vehicle")
    }
})

const vehicleSlice = createSlice({
    name: "vehicle",
    initialState: {
        vehicles: [],
        groupedByFleetOwner: [],
        selectedVehicles: [],
        currentVehicle: null,
        fleetOwnerData: null,
        searchResults: null,
        loading: false,
        error: null,
    },
    reducers: {
        setSelectedVehicles: (state, action) => {
            state.selectedVehicles = action.payload
        },
        addSelectedVehicle: (state, action) => {
            const exists = state.selectedVehicles.find((v) => v._id === action.payload._id)
            if (!exists) {
                state.selectedVehicles.push(action.payload)
            }
        },
        removeSelectedVehicle: (state, action) => {
            state.selectedVehicles = state.selectedVehicles.filter((v) => v._id !== action.payload)
        },
        clearSelectedVehicles: (state) => {
            state.selectedVehicles = []
        },
        clearError: (state) => {
            state.error = null
        },
    },
    extraReducers: (builder) => {
        builder
            // Search Vehicles
            .addCase(searchVehicles.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(searchVehicles.fulfilled, (state, action) => {
                state.loading = false
                state.vehicles = action.payload.vehicles
                state.groupedByFleetOwner = action.payload.groupedByFleetOwner
                state.searchResults = action.payload
            })
            .addCase(searchVehicles.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get Vehicle By ID
            .addCase(getVehicleById.pending, (state) => {
                state.loading = true
            })
            .addCase(getVehicleById.fulfilled, (state, action) => {
                state.loading = false
                state.currentVehicle = action.payload.vehicle
            })
            .addCase(getVehicleById.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get Fleet Owner Vehicles
            .addCase(getFleetOwnerVehicles.pending, (state) => {
                state.loading = true
            })
            .addCase(getFleetOwnerVehicles.fulfilled, (state, action) => {
                state.loading = false
                state.vehicles = action.payload.vehicles
                state.fleetOwnerData = action.payload.fleetOwner
            })
            .addCase(getFleetOwnerVehicles.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Get My Vehicles
            .addCase(getMyVehicles.pending, (state) => {
                state.loading = true
            })
            .addCase(getMyVehicles.fulfilled, (state, action) => {
                state.loading = false
                state.vehicles = action.payload.vehicles
            })
            .addCase(getMyVehicles.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Add Vehicle
            .addCase(addVehicle.pending, (state) => {
                state.loading = true
            })
            .addCase(addVehicle.fulfilled, (state, action) => {
                state.loading = false
                state.vehicles.push(action.payload.vehicle)
            })
            .addCase(addVehicle.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
    },
})

export const { setSelectedVehicles, addSelectedVehicle, removeSelectedVehicle, clearSelectedVehicles, clearError } =
    vehicleSlice.actions

export default vehicleSlice.reducer
