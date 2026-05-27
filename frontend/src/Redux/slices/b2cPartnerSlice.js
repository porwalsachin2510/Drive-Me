import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"

// ============== ASYNC THUNKS ==============

// Fetch B2C Partner drivers with availability status
export const fetchB2CPartnerDrivers = createAsyncThunk(
    "b2cPartner/fetchDrivers",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/b2c-partner/drivers")
            return response.data.drivers || []
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch drivers")
        }
    }
)

// Fetch B2C Partner vehicles with availability status
export const fetchB2CPartnerVehicles = createAsyncThunk(
    "b2cPartner/fetchVehicles",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/b2c-partner/fleet")
            return response.data.fleet?.vehicles || []
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch vehicles")
        }
    }
)

// Fetch driver availability (for current user)
export const fetchDriverAvailability = createAsyncThunk(
    "b2cPartner/fetchDriverAvailability",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/b2c-daily-trips/driver/availability")
            return response.data.availability || {}
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch availability")
        }
    }
)

// Check and auto-update availability based on scheduled trips (call on dashboard load)
export const checkAndAutoUpdateAvailability = createAsyncThunk(
    "b2cPartner/checkAndAutoUpdateAvailability",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/b2c-daily-trips/driver/check-availability")
            return response.data.data || {}
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to check availability")
        }
    }
)

// Update driver availability status
export const updateDriverAvailability = createAsyncThunk(
    "b2cPartner/updateDriverAvailability",
    async (status, { rejectWithValue }) => {
        try {
            const response = await api.put("/b2c-daily-trips/driver/availability/status", { status })
            return { success: response.data.success, status: response.data.availabilityStatus, message: response.data.message }
        } catch (error) {
            return rejectWithValue({
                message: error.response?.data?.message || "Failed to update availability",
                hasIncompleteTrips: error.response?.data?.hasIncompleteTrips || false,
                incompleteTripsCount: error.response?.data?.incompleteTripsCount || 0,
                assignedScheduleInfo: error.response?.data?.assignedScheduleInfo || null
            })
        }
    }
)

// Update vehicle status (AVAILABLE / BUSY / MAINTENANCE)
export const updateVehicleStatus = createAsyncThunk(
    "b2cPartner/updateVehicleStatus",
    async ({ vehicleId, status }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/b2c-partner/vehicles/${vehicleId}/status`, { status })
            return { vehicleId, status: response.data.status, vehicle: response.data.vehicle }
        } catch (error) {
            return rejectWithValue({
                message: error.response?.data?.message || "Failed to update vehicle status",
                hasActiveAssignments: error.response?.data?.hasActiveAssignments || false
            })
        }
    }
)

// Check driver's incomplete trips before allowing availability change
export const checkDriverIncompleteTrips = createAsyncThunk(
    "b2cPartner/checkDriverIncompleteTrips",
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get("/b2c-daily-trips/driver/incomplete-trips")
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || "Failed to check incomplete trips")
        }
    }
)

// ============== INITIAL STATE ==============
const initialState = {
    // Drivers
    drivers: [],
    driversLoading: false,
    driversError: null,

    // Vehicles
    vehicles: [],
    vehiclesLoading: false,
    vehiclesError: null,

    // Current user's availability
    myAvailability: {
        status: 'available',
        assignedSchedules: [],
        hasIncompleteTrips: false,
        incompleteTripsCount: 0,
        lastUpdate: null
    },
    availabilityLoading: false,
    availabilityError: null,
    availabilityUpdateMessage: null,

    // Vehicle status update
    vehicleStatusLoading: false,
    vehicleStatusError: null,

    // General
    lastFetched: null
}

// ============== SLICE ==============
const b2cPartnerSlice = createSlice({
    name: "b2cPartner",
    initialState,
    reducers: {
        // Clear errors
        clearDriversError: (state) => {
            state.driversError = null
        },
        clearVehiclesError: (state) => {
            state.vehiclesError = null
        },
        clearAvailabilityError: (state) => {
            state.availabilityError = null
            state.availabilityUpdateMessage = null
        },
        clearVehicleStatusError: (state) => {
            state.vehicleStatusError = null
        },

        // Real-time updates from socket
        updateDriverAvailabilityInStore: (state, action) => {
            const { driverId, availabilityStatus, isSelfDriver } = action.payload

            if (isSelfDriver) {
                // Update self-driver status
                state.myAvailability.status = availabilityStatus
                state.myAvailability.lastUpdate = new Date().toISOString()
            }

            // Update in drivers list
            const driverIndex = state.drivers.findIndex(d =>
                d._id === driverId || d.userId === driverId
            )
            if (driverIndex !== -1) {
                state.drivers[driverIndex].availabilityStatus = availabilityStatus
            }
        },

        // Update vehicle availability in store (from socket or trip completion)
        updateVehicleAvailabilityInStore: (state, action) => {
            const { vehicleId, availabilityStatus, status } = action.payload
            const vehicleIndex = state.vehicles.findIndex(v => v._id === vehicleId)
            if (vehicleIndex !== -1) {
                if (availabilityStatus) {
                    state.vehicles[vehicleIndex].availabilityStatus = availabilityStatus
                }
                if (status) {
                    state.vehicles[vehicleIndex].status = status
                }
            }
        },

        // Mark driver as busy (when assigned to schedule)
        markDriverBusy: (state, action) => {
            const { driverId, scheduleId, tripTimeIndex } = action.payload
            const driverIndex = state.drivers.findIndex(d => d._id === driverId || d.userId === driverId)
            if (driverIndex !== -1) {
                state.drivers[driverIndex].availabilityStatus = 'busy'
                if (!state.drivers[driverIndex].assignedSchedules) {
                    state.drivers[driverIndex].assignedSchedules = []
                }
                state.drivers[driverIndex].assignedSchedules.push({ scheduleId, tripTimeIndex })
            }
        },

        // Mark vehicle as busy (when assigned to schedule)
        markVehicleBusy: (state, action) => {
            const { vehicleId, scheduleId, tripTimeIndex } = action.payload
            const vehicleIndex = state.vehicles.findIndex(v => v._id === vehicleId)
            if (vehicleIndex !== -1) {
                state.vehicles[vehicleIndex].availabilityStatus = 'busy'
                if (!state.vehicles[vehicleIndex].assignedSchedules) {
                    state.vehicles[vehicleIndex].assignedSchedules = []
                }
                state.vehicles[vehicleIndex].assignedSchedules.push({ scheduleId, tripTimeIndex })
            }
        },

        // Release driver (when trip completes)
        releaseDriver: (state, action) => {
            const { driverId, scheduleId, tripTimeIndex } = action.payload
            const driverIndex = state.drivers.findIndex(d => d._id === driverId || d.userId === driverId)
            if (driverIndex !== -1) {
                const driver = state.drivers[driverIndex]
                if (driver.assignedSchedules) {
                    driver.assignedSchedules = driver.assignedSchedules.filter(
                        s => !(s.scheduleId === scheduleId && s.tripTimeIndex === tripTimeIndex)
                    )
                    // If no more assignments, mark as offline (not available - user should manually set available)
                    if (driver.assignedSchedules.length === 0) {
                        driver.availabilityStatus = 'offline'
                    }
                }
            }
        },

        // Release vehicle (when trip completes)
        releaseVehicle: (state, action) => {
            const { vehicleId, scheduleId, tripTimeIndex } = action.payload
            const vehicleIndex = state.vehicles.findIndex(v => v._id === vehicleId)
            if (vehicleIndex !== -1) {
                const vehicle = state.vehicles[vehicleIndex]
                if (vehicle.assignedSchedules) {
                    vehicle.assignedSchedules = vehicle.assignedSchedules.filter(
                        s => !(s.scheduleId === scheduleId && s.tripTimeIndex === tripTimeIndex)
                    )
                    // If no more assignments, mark as available
                    if (vehicle.assignedSchedules.length === 0) {
                        vehicle.availabilityStatus = 'available'
                    }
                }
            }
        },

        // Update my availability status
        setMyAvailabilityStatus: (state, action) => {
            state.myAvailability.status = action.payload.status
            state.myAvailability.lastUpdate = new Date().toISOString()
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch drivers
            .addCase(fetchB2CPartnerDrivers.pending, (state) => {
                state.driversLoading = true
                state.driversError = null
            })
            .addCase(fetchB2CPartnerDrivers.fulfilled, (state, action) => {
                state.driversLoading = false
                state.drivers = action.payload
                state.lastFetched = new Date().toISOString()
            })
            .addCase(fetchB2CPartnerDrivers.rejected, (state, action) => {
                state.driversLoading = false
                state.driversError = action.payload
            })

            // Fetch vehicles
            .addCase(fetchB2CPartnerVehicles.pending, (state) => {
                state.vehiclesLoading = true
                state.vehiclesError = null
            })
            .addCase(fetchB2CPartnerVehicles.fulfilled, (state, action) => {
                state.vehiclesLoading = false
                state.vehicles = action.payload
            })
            .addCase(fetchB2CPartnerVehicles.rejected, (state, action) => {
                state.vehiclesLoading = false
                state.vehiclesError = action.payload
            })

            // Fetch availability
            .addCase(fetchDriverAvailability.pending, (state) => {
                state.availabilityLoading = true
                state.availabilityError = null
            })
            .addCase(fetchDriverAvailability.fulfilled, (state, action) => {
                state.availabilityLoading = false
                state.myAvailability = {
                    status: action.payload.status || 'available',
                    assignedSchedules: action.payload.assignedSchedules || [],
                    hasIncompleteTrips: action.payload.hasIncompleteTrips || false,
                    incompleteTripsCount: action.payload.incompleteTripsCount || 0,
                    lastUpdate: new Date().toISOString()
                }
            })
            .addCase(fetchDriverAvailability.rejected, (state, action) => {
                state.availabilityLoading = false
                state.availabilityError = action.payload
            })

            // Update availability
            .addCase(updateDriverAvailability.pending, (state) => {
                state.availabilityLoading = true
                state.availabilityError = null
                state.availabilityUpdateMessage = null
            })
            .addCase(updateDriverAvailability.fulfilled, (state, action) => {
                state.availabilityLoading = false
                state.myAvailability.status = action.payload.status
                state.myAvailability.lastUpdate = new Date().toISOString()
                state.availabilityUpdateMessage = action.payload.message
            })
            .addCase(updateDriverAvailability.rejected, (state, action) => {
                state.availabilityLoading = false
                state.availabilityError = action.payload?.message || action.payload
                state.myAvailability.hasIncompleteTrips = action.payload?.hasIncompleteTrips || false
                state.myAvailability.incompleteTripsCount = action.payload?.incompleteTripsCount || 0
            })

            // Update vehicle status
            .addCase(updateVehicleStatus.pending, (state) => {
                state.vehicleStatusLoading = true
                state.vehicleStatusError = null
            })
            .addCase(updateVehicleStatus.fulfilled, (state, action) => {
                state.vehicleStatusLoading = false
                const vehicleIndex = state.vehicles.findIndex(v => v._id === action.payload.vehicleId)
                if (vehicleIndex !== -1) {
                    state.vehicles[vehicleIndex].status = action.payload.status
                    if (action.payload.vehicle) {
                        state.vehicles[vehicleIndex] = {
                            ...state.vehicles[vehicleIndex],
                            ...action.payload.vehicle
                        }
                    }
                }
            })
            .addCase(updateVehicleStatus.rejected, (state, action) => {
                state.vehicleStatusLoading = false
                state.vehicleStatusError = action.payload?.message || action.payload
            })

            // Check incomplete trips
            .addCase(checkDriverIncompleteTrips.fulfilled, (state, action) => {
                state.myAvailability.hasIncompleteTrips = action.payload.hasIncompleteTrips
                state.myAvailability.incompleteTripsCount = action.payload.incompleteTripsCount || 0
            })

            // Check and auto-update availability
            .addCase(checkAndAutoUpdateAvailability.fulfilled, (state, action) => {
                if (action.payload.statusUpdated) {
                    state.myAvailability.status = action.payload.currentStatus
                    state.myAvailability.lastUpdate = new Date().toISOString()
                }
                state.myAvailability.scheduledTripsToday = action.payload.scheduledTripsToday || 0
            })
    },
})

export const {
    clearDriversError,
    clearVehiclesError,
    clearAvailabilityError,
    clearVehicleStatusError,
    updateDriverAvailabilityInStore,
    updateVehicleAvailabilityInStore,
    markDriverBusy,
    markVehicleBusy,
    releaseDriver,
    releaseVehicle,
    setMyAvailabilityStatus
} = b2cPartnerSlice.actions

export default b2cPartnerSlice.reducer
