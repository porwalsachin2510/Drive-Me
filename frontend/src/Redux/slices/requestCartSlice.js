import { createSlice } from "@reduxjs/toolkit"

/**
 * requestCart
 *
 * Client-side cart that lets a corporate combine vehicles from MULTIPLE B2B
 * partners (and multiple vehicle types / quantities) into a single request.
 * On submit we create one quotation per partner (see quotationSlice
 * `createGroupedQuotations`), all linked under one request group on the backend.
 *
 * Shape:
 * {
 *   requirement: { serviceType, serviceMode, rentalDuration, durationValue,
 *                  startDate, location, budgetRange, driverRequired,
 *                  fuelIncluded, vehicleTypes, features },
 *   partners: {
 *     [fleetOwnerId]: {
 *       ownerData: {...},
 *       vehicles: { [vehicleId]: { data, quantity } },
 *       managedServiceBrief: null | {...}
 *     }
 *   }
 * }
 */

const STORAGE_KEY = "drivemego_request_cart"

const emptyState = {
    requirement: null,
    partners: {},
}

const loadState = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { ...emptyState }
        const parsed = JSON.parse(raw)
        return {
            requirement: parsed.requirement || null,
            partners: parsed.partners || {},
        }
    } catch {
        return { ...emptyState }
    }
}

const persist = (state) => {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ requirement: state.requirement, partners: state.partners }),
        )
    } catch {
        // ignore quota / serialization errors
    }
}

const requestCartSlice = createSlice({
    name: "requestCart",
    initialState: loadState(),
    reducers: {
        // Store the shared requirement snapshot the corporate searched with.
        setRequirement: (state, action) => {
            state.requirement = action.payload || null
            persist(state)
        },

        // Add a vehicle (with quantity) from a specific partner to the cart. If
        // it already exists, its quantity is increased.
        addVehicleToCart: (state, action) => {
            const { fleetOwnerId, ownerData, vehicle, quantity } = action.payload
            if (!fleetOwnerId || !vehicle?._id) return
            const qty = Math.max(1, Number(quantity) || 1)

            if (!state.partners[fleetOwnerId]) {
                state.partners[fleetOwnerId] = {
                    ownerData: ownerData || null,
                    vehicles: {},
                    managedServiceBrief: null,
                }
            }
            // Keep the latest owner data if provided.
            if (ownerData) state.partners[fleetOwnerId].ownerData = ownerData

            const existing = state.partners[fleetOwnerId].vehicles[vehicle._id]
            state.partners[fleetOwnerId].vehicles[vehicle._id] = {
                data: vehicle,
                quantity: existing ? existing.quantity + qty : qty,
            }
            persist(state)
        },

        // Set an absolute quantity for a vehicle. Quantity <= 0 removes it.
        updateVehicleQty: (state, action) => {
            const { fleetOwnerId, vehicleId, quantity } = action.payload
            const partner = state.partners[fleetOwnerId]
            if (!partner || !partner.vehicles[vehicleId]) return
            const qty = Number(quantity)
            if (!qty || qty <= 0) {
                delete partner.vehicles[vehicleId]
            } else {
                partner.vehicles[vehicleId].quantity = qty
            }
            // Drop the partner entirely if it has no vehicles left.
            if (Object.keys(partner.vehicles).length === 0) {
                delete state.partners[fleetOwnerId]
            }
            persist(state)
        },

        removeVehicleFromCart: (state, action) => {
            const { fleetOwnerId, vehicleId } = action.payload
            const partner = state.partners[fleetOwnerId]
            if (!partner) return
            delete partner.vehicles[vehicleId]
            if (Object.keys(partner.vehicles).length === 0) {
                delete state.partners[fleetOwnerId]
            }
            persist(state)
        },

        // Attach / update the Managed-Service brief for a partner (per-partner).
        setPartnerBrief: (state, action) => {
            const { fleetOwnerId, brief } = action.payload
            if (!state.partners[fleetOwnerId]) return
            state.partners[fleetOwnerId].managedServiceBrief = brief || null
            persist(state)
        },

        clearPartner: (state, action) => {
            const fleetOwnerId = action.payload
            delete state.partners[fleetOwnerId]
            persist(state)
        },

        clearCart: (state) => {
            state.requirement = null
            state.partners = {}
            persist(state)
        },
    },
})

export const {
    setRequirement,
    addVehicleToCart,
    updateVehicleQty,
    removeVehicleFromCart,
    setPartnerBrief,
    clearPartner,
    clearCart,
} = requestCartSlice.actions

// ---- Selectors ----
export const selectCartPartners = (state) => state.requestCart.partners
export const selectCartRequirement = (state) => state.requestCart.requirement

// Total number of vehicle units (sum of quantities) across all partners.
export const selectCartTotalUnits = (state) => {
    const partners = state.requestCart.partners || {}
    return Object.values(partners).reduce((sum, p) => {
        return (
            sum +
            Object.values(p.vehicles || {}).reduce((s, v) => s + (v.quantity || 0), 0)
        )
    }, 0)
}

// Number of distinct partners in the cart.
export const selectCartPartnerCount = (state) =>
    Object.keys(state.requestCart.partners || {}).length

export default requestCartSlice.reducer
