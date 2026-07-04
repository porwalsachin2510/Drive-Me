import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../utils/api"
import { buildLocale, normalizeCountry, getPaymentMethods, DEFAULT_COUNTRY } from "../../config/localeConfig"

const STORAGE_KEY = "locale"

// Read a locale for instant first paint, BEFORE the API call resolves.
//
// Priority is deliberate and matters for correctness, not just speed:
//   1. The logged-in user's saved account country (DB truth). A registered
//      Kuwait user must see KWD even if a stale "locale" entry from a previous
//      session/device says UAE. The account country always wins.
//   2. A persisted anonymous selection in the "locale" key (public visitors who
//      picked a country before logging in).
//   3. Platform default.
const readPersistedLocale = () => {
    // 1) Logged-in user's saved country takes precedence over any cached locale.
    try {
        const token = localStorage.getItem("token")
        const user = JSON.parse(localStorage.getItem("user") || "null")
        if (token && user?.country) return buildLocale(user.country)
    } catch (e) {
        // ignore
    }
    // 2) Anonymous persisted selection.
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.country) return buildLocale(parsed.country)
        }
    } catch (e) {
        // ignore corrupt storage
    }
    return buildLocale(DEFAULT_COUNTRY)
}

const persistLocale = (locale) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ country: locale.country }))
    } catch (e) {
        // ignore
    }
}

// Read ONLY a genuinely persisted country choice (set on a previous visit via
// init/selection). Returns null when nothing was explicitly stored, so a
// first-time visitor still gets fresh IP/DB detection instead of a default.
const readPersistedCountry = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.country) return parsed.country
        }
    } catch (e) {
        // ignore corrupt storage
    }
    return null
}

/**
 * initLocale — bootstrap the user's locale once on app load.
 *
 * Source of truth order (handled by the backend):
 *   1. Logged-in user's saved country (DB)
 *   2. IP-based geo detection
 *
 * The backend persists the detected country to the user profile, so currency
 * and payment gateway stay consistent across the whole app.
 */
export const initLocale = createAsyncThunk(
    "locale/init",
    async (_, { rejectWithValue }) => {
        try {
            // Only forward a client-side country hint for ANONYMOUS visitors
            // (e.g. a country they picked on a previous visit). For a logged-in
            // user we send nothing: the backend locks their locale to their saved
            // account country (the source of truth), so a stale browser value can
            // neither change what they see nor corrupt their profile.
            const isLoggedIn = !!localStorage.getItem("token")
            const persistedCountry = isLoggedIn ? null : readPersistedCountry()
            const res = await api.get("/location/localization/config", {
                params: persistedCountry ? { country: persistedCountry } : {},
            })
            if (res.data?.success) {
                return {
                    country: res.data.country,
                    countryName: res.data.countryName,
                    displayName: res.data.displayName,
                    isoCode: res.data.isoCode,
                    phoneCode: res.data.phoneCode,
                    currency: res.data.currency,
                    currencySymbol: res.data.currencySymbol,
                    currencyDecimals: res.data.currencyDecimals,
                    paymentGateway: res.data.paymentGateway,
                    paymentMethods: res.data.paymentMethods || [],
                    serviceAvailable: res.data.serviceAvailable,
                    source: res.data.source,
                }
            }
            return rejectWithValue("Locale config request unsuccessful")
        } catch (error) {
            console.error("[locale] initLocale failed:", error?.message)
            return rejectWithValue(error?.message || "Failed to load locale")
        }
    }
)

/**
 * refineLocaleByLocation — auto-detect a COMMUTER's country from their REAL
 * location and sync the locale. Called by the navbar location badge:
 *   • With { lat, lng } from the browser Geolocation API (strongest signal).
 *   • With no args to fall back to server-side IP detection when GPS is
 *     unavailable or the user denied permission.
 *
 * The backend reverse-geocodes the coordinates, persists the resolved served
 * country to the commuter's profile, and returns the authoritative locale
 * (currency, gateway, payment methods, serviceAvailable). There is NO manual
 * country picking — a commuter can only ever be in the country they physically
 * are, which is what keeps routes/prices honest across UAE & Kuwait.
 */
export const refineLocaleByLocation = createAsyncThunk(
    "locale/refineByLocation",
    async ({ lat, lng } = {}, { rejectWithValue }) => {
        try {
            const params = {}
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                params.lat = lat
                params.lng = lng
            }
            const res = await api.get("/location/localization/config", { params })
            if (res.data?.success) return res.data
            return rejectWithValue("Failed to detect location")
        } catch (error) {
            return rejectWithValue(error?.message || "Failed to detect location")
        }
    }
)

/** Manually set the locale to a specific country (used by the admin currency selector). */
export const setLocaleCountry = createAsyncThunk(
    "locale/setCountry",
    async (country, { rejectWithValue }) => {
        try {
            const res = await api.get("/location/localization/config", {
                params: { country: normalizeCountry(country) },
            })
            if (res.data?.success) return res.data
            return rejectWithValue("Failed to set country")
        } catch (error) {
            return rejectWithValue(error?.message || "Failed to set country")
        }
    }
)

const persistedLocale = readPersistedLocale()

const initialState = {
    ...persistedLocale,
    paymentMethods: getPaymentMethods(persistedLocale.country),
    status: "idle", // idle | loading | ready | error
    source: "persisted",
    error: null,
}

const localeSlice = createSlice({
    name: "locale",
    initialState,
    reducers: {
        // Apply a locale directly (e.g. immediately after login from user.country).
        applyLocaleFromCountry: (state, action) => {
            const locale = buildLocale(action.payload)
            Object.assign(state, locale)
            state.paymentMethods = getPaymentMethods(locale.country)
            persistLocale(locale)
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(initLocale.pending, (state) => {
                state.status = "loading"
                state.error = null
            })
            .addCase(initLocale.fulfilled, (state, action) => {
                Object.assign(state, action.payload)
                if (!action.payload.paymentMethods?.length) {
                    state.paymentMethods = getPaymentMethods(action.payload.country)
                }
                state.status = "ready"
                persistLocale(action.payload)
            })
            .addCase(initLocale.rejected, (state, action) => {
                state.status = "error"
                state.error = action.payload
            })
            .addCase(setLocaleCountry.fulfilled, (state, action) => {
                Object.assign(state, {
                    country: action.payload.country,
                    countryName: action.payload.countryName,
                    displayName: action.payload.displayName,
                    isoCode: action.payload.isoCode,
                    phoneCode: action.payload.phoneCode,
                    currency: action.payload.currency,
                    currencySymbol: action.payload.currencySymbol,
                    currencyDecimals: action.payload.currencyDecimals,
                    paymentGateway: action.payload.paymentGateway,
                    paymentMethods: action.payload.paymentMethods?.length
                        ? action.payload.paymentMethods
                        : getPaymentMethods(action.payload.country),
                    serviceAvailable: action.payload.serviceAvailable,
                })
                state.status = "ready"
                persistLocale(state)
            })
            .addCase(refineLocaleByLocation.fulfilled, (state, action) => {
                Object.assign(state, {
                    country: action.payload.country,
                    countryName: action.payload.countryName,
                    displayName: action.payload.displayName,
                    isoCode: action.payload.isoCode,
                    phoneCode: action.payload.phoneCode,
                    currency: action.payload.currency,
                    currencySymbol: action.payload.currencySymbol,
                    currencyDecimals: action.payload.currencyDecimals,
                    paymentGateway: action.payload.paymentGateway,
                    paymentMethods: action.payload.paymentMethods?.length
                        ? action.payload.paymentMethods
                        : getPaymentMethods(action.payload.country),
                    serviceAvailable: action.payload.serviceAvailable,
                    source: action.payload.source,
                })
                state.status = "ready"
                persistLocale(state)
                // Keep the persisted "user" copy in sync so a refresh doesn't
                // revert to a stale country — but ONLY for a served market, so we
                // never write an unsupported "coming soon" code into the profile.
                if (action.payload.serviceAvailable) {
                    try {
                        const user = JSON.parse(localStorage.getItem("user") || "null")
                        if (user) {
                            user.country = action.payload.country
                            user.nationality = action.payload.countryName
                            localStorage.setItem("user", JSON.stringify(user))
                        }
                    } catch (e) {
                        // ignore storage issues
                    }
                }
            })
    },
})

export const { applyLocaleFromCountry } = localeSlice.actions
export default localeSlice.reducer
