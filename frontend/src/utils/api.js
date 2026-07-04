/* eslint-disable no-unused-vars */
import axios from "axios"
import { initializeSocket, getSocket } from "./socket"
import { getActiveCurrency } from "../config/localeConfig"

// "On behalf of corporate" context for B2B partners managing a MANAGED-service
// contract. When set, every request carries the contract id so the backend
// scopes the operation to the corporate owner (see resolveCorporateContext).
const ONBEHALF_KEY = "onBehalfContractId"

export const setOnBehalfContract = (contractId) => {
    if (contractId) {
        sessionStorage.setItem(ONBEHALF_KEY, contractId)
    } else {
        sessionStorage.removeItem(ONBEHALF_KEY)
    }
}

export const getOnBehalfContract = () => sessionStorage.getItem(ONBEHALF_KEY)

export const clearOnBehalfContract = () => sessionStorage.removeItem(ONBEHALF_KEY)

const api = axios.create({
    baseURL: `${import.meta.env.VITE_BACKEND_URL}/api`,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
})

// Request interceptor
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token")
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }

        // When a B2B partner is operating on behalf of a corporate (managed
        // services), attach the contract id so the backend can scope corporate
        // operations correctly. Skip if a caller already set it explicitly.
        try {
            const onBehalf = sessionStorage.getItem(ONBEHALF_KEY)
            if (onBehalf && !config.headers["x-onbehalf-contract"]) {
                config.headers["x-onbehalf-contract"] = onBehalf
            }
        } catch (e) {
            // never block a request on storage access
        }
        
        // Attach the viewer's active display currency to EVERY request so that
        // admin endpoints can convert all stored (native-currency) amounts into
        // the currency the admin selected in the dashboard. Endpoints that don't
        // care about it simply ignore the extra query param. We don't override a
        // displayCurrency that a caller explicitly set.
        try {
            const displayCurrency = getActiveCurrency()
            if (displayCurrency) {
                config.params = { displayCurrency, ...(config.params || {}) }
            }
        } catch (e) {
            // never block a request on locale resolution
        }

        return config
    },
    (error) => {
        return Promise.reject(error)
    },
)

// Response interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Only redirect to login if there was actually a token (expired session)
            // Don't redirect for unauthenticated public requests
            const hadToken = localStorage.getItem("token")
            const isPublicEndpoint = error.config?.url?.includes("public")
            if (hadToken && !isPublicEndpoint) {
                localStorage.removeItem("token")
                window.location.href = "/login"
            }
        }
        return Promise.reject(error)
    },
)

// Socket connection method
api.getSocket = () => {
    const token = localStorage.getItem("token")
    if (!getSocket() && token) {
        initializeSocket(token)
    }
    return getSocket()
}

export default api
