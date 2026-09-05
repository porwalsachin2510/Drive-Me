/**
 * Handles login redirect with return location
 * @param {Function} navigate - React Router navigation function
 * @param {String} returnPath - Path to return to after login
 * @param {Object} returnState - State to pass back on return
 * @param {String} requiredRole - Role required to access the page
 */
export const redirectToLogin = (navigate, returnPath = "/", returnState = null, requiredRole = null) => {
    navigate("/login", {
        state: {
            returnTo: returnPath,
            returnState: returnState,
            requiredRole: requiredRole,
            message: `Please login to continue${requiredRole ? ` as a ${requiredRole} user` : ""}`,
        },
    });
};

/**
 * Checks if user should be redirected based on role
 * @param {String} currentRole - User's current role
 * @param {Array} allowedRoles - Array of allowed roles
 * @returns {Boolean} - True if user has access
 */
import { expandRoleFamilies } from "./roleFamilies";

export const checkRoleAccess = (currentRole, allowedRoles) => {
    if (!currentRole) return false;
    return expandRoleFamilies(allowedRoles)?.includes(currentRole) ?? false;
};

/**
 * Stores navigation state in localStorage for persistence
 * @param {String} key - Key to store the state under
 * @param {Object} state - State to store
 */
export const storeNavigationState = (key, state) => {
    try {
        localStorage.setItem(`nav_state_${key}`, JSON.stringify(state));
    } catch (error) {
        console.error("Failed to store navigation state:", error);
    }
};

/**
 * Retrieves navigation state from localStorage
 * @param {String} key - Key to retrieve
 * @returns {Object|null} - Retrieved state or null
 */
export const getNavigationState = (key) => {
    try {
        const state = localStorage.getItem(`nav_state_${key}`);
        return state ? JSON.parse(state) : null;
    } catch (error) {
        console.error("Failed to retrieve navigation state:", error);
        return null;
    }
};

/**
 * Clears navigation state from localStorage
 * @param {String} key - Key to clear
 */
export const clearNavigationState = (key) => {
    try {
        localStorage.removeItem(`nav_state_${key}`);
    } catch (error) {
        console.error("Failed to clear navigation state:", error);
    }
};
