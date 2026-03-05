import { createSlice } from "@reduxjs/toolkit"

const initialState = {
    user: localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null,
    token: localStorage.getItem("token") || null,
    isAuthenticated: !!localStorage.getItem("token"),
    loading: false,
    error: null,
}

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        loginSuccess: (state, action) => {
            state.user = action.payload.user
            state.token = action.payload.token
            state.isAuthenticated = true
            state.error = null
            state.loading = false
            localStorage.setItem("token", action.payload.token)
            localStorage.setItem("user", JSON.stringify(action.payload.user))
        },

        registerSuccess: (state, action) => {
            state.user = action.payload.user
            state.token = action.payload.token
            state.isAuthenticated = true
            state.error = null
            state.loading = false
            localStorage.setItem("token", action.payload.token)
            localStorage.setItem("user", JSON.stringify(action.payload.user))
        },

        authStart: (state) => {
            state.loading = true
            state.error = null
        },

        authError: (state, action) => {
            state.loading = false
            state.error = action.payload
            state.isAuthenticated = false
        },

        logout: (state) => {
            state.user = null
            state.token = null
            state.isAuthenticated = false
            state.error = null
            state.loading = false
            localStorage.removeItem("token")
            localStorage.removeItem("user")
        },

        clearError: (state) => {
            state.error = null
        },
    },
})

export const { loginSuccess, registerSuccess, authStart, authError, logout, clearError } = authSlice.actions
export default authSlice.reducer
