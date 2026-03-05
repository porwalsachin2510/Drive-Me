import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"


export const createDriver = createAsyncThunk("driver/createDriver", async (driverData, { rejectWithValue }) => {
    try {
        const response = await api.post("/b2b/drivers", driverData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        })
        return response.data.driver
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to create driver")
    }
})

export const createCorporateDriver = createAsyncThunk("driver/createDriver", async (driverData, { rejectWithValue }) => {
    try {
        const response = await api.post("/b2b/drivers/create-corporate-driver", driverData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        })
        return response.data.driver
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to create driver")
    }
})

export const fetchFleetDrivers = createAsyncThunk("driver/fetchFleetDrivers", async (_, { rejectWithValue }) => {
    try {
        const response = await api.get("/b2b/drivers")
        return response.data.drivers
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to fetch drivers")
    }
})

export const fetchAvailableDrivers = createAsyncThunk(
    "driver/fetchAvailableDrivers",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/b2b/drivers/available")
            return response.data.drivers
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch available drivers")
        }
    },
)

export const updateDriver = createAsyncThunk(
    "driver/updateDriver",
    async ({ driverId, driverData }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/b2b/drivers/${driverId}`, driverData)
            return response.data.driver
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to update driver")
        }
    },
)

export const deleteDriver = createAsyncThunk("driver/deleteDriver", async (driverId, { rejectWithValue }) => {
    try {
        await api.delete(`/b2b/drivers/${driverId}`)
        return driverId
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to delete driver")
    }
})

// Initial state
const initialState = {
    drivers: [],
    availableDrivers: [],
    selectedDriver: null,
    loading: false,
    error: null,
    success: false,
}

// Slice
const driverSlice = createSlice({
    name: "driver",
    initialState,
    reducers: {
        clearDriverError: (state) => {
            state.error = null
        },
        clearDriverSuccess: (state) => {
            state.success = false
        },
        setSelectedDriver: (state, action) => {
            state.selectedDriver = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch fleet drivers
            .addCase(fetchFleetDrivers.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchFleetDrivers.fulfilled, (state, action) => {
                state.loading = false
                state.drivers = action.payload
            })
            .addCase(fetchFleetDrivers.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Fetch available drivers
            .addCase(fetchAvailableDrivers.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchAvailableDrivers.fulfilled, (state, action) => {
                state.loading = false
                state.availableDrivers = action.payload
            })
            .addCase(fetchAvailableDrivers.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Create driver
            .addCase(createDriver.pending, (state) => {
                state.loading = true
                state.error = null
                state.success = false
            })
            .addCase(createDriver.fulfilled, (state, action) => {
                state.loading = false
                state.drivers.unshift(action.payload)
                state.success = true
            })
            .addCase(createDriver.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Update driver
            .addCase(updateDriver.pending, (state) => {
                state.loading = true
                state.error = null
                state.success = false
            })
            .addCase(updateDriver.fulfilled, (state, action) => {
                state.loading = false
                const index = state.drivers.findIndex((driver) => driver._id === action.payload._id)
                if (index !== -1) {
                    state.drivers[index] = action.payload
                }
                state.success = true
            })
            .addCase(updateDriver.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            // Delete driver
            .addCase(deleteDriver.pending, (state) => {
                state.loading = true
                state.error = null
                state.success = false
            })
            .addCase(deleteDriver.fulfilled, (state, action) => {
                state.loading = false
                state.drivers = state.drivers.filter((driver) => driver._id !== action.payload)
                state.success = true
            })
            .addCase(deleteDriver.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
    },
})

export const { clearDriverError, clearDriverSuccess, setSelectedDriver } = driverSlice.actions
export default driverSlice.reducer

