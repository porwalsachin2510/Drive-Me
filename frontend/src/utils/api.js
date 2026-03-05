import axios from "axios"
import { initializeSocket, getSocket } from "./socket"

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
