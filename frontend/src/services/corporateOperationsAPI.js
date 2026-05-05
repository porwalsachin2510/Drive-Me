import api from "../utils/api";

/**
 * Corporate Operations API Service
 * Handles all API calls related to corporate employee trips and operations
 */

// Get all daily trips for corporate
export const getDailyTrips = async (date) => {
    try {
        const response = await api.get(`/corporate-operations/daily-trips?date=${date}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching daily trips:", error);
        throw error;
    }
};

// Get employee's assigned trips
export const getEmployeeAssignedTrips = async (employeeId, date = null) => {
    try {
        let url = `/corporate-operations/employee/${employeeId}/trips`;
        if (date) {
            url += `?date=${date}`;
        }
        const response = await api.get(url);
        return response.data;
    } catch (error) {
        console.error("Error fetching employee trips:", error);
        throw error;
    }
};

// Assign route to vehicle
export const assignRouteToVehicle = async (routeId, vehicleId, driverId, corporateDriverId = null) => {
    try {
        const response = await api.post("/corporate-operations/assign-route-to-vehicle", {
            routeId,
            vehicleId,
            driverId,
            corporateDriverId
        });
        return response.data;
    } catch (error) {
        console.error("Error assigning route to vehicle:", error);
        throw error;
    }
};

// Get assigned routes status
export const getAssignedRoutesStatus = async (routeId = null) => {
    try {
        let url = "/corporate-operations/assigned-routes-status";
        if (routeId) {
            url += `?routeId=${routeId}`;
        }
        const response = await api.get(url);
        return response.data;
    } catch (error) {
        console.error("Error fetching routes status:", error);
        throw error;
    }
};

// Assign employees to trip
export const assignEmployeesToTrip = async (tripId, employees) => {
    try {
        const response = await api.post(
            `/corporate-operations/trips/${tripId}/assign-employees`,
            { employees }
        );
        return response.data;
    } catch (error) {
        console.error("Error assigning employees to trip:", error);
        throw error;
    }
};

// Get trip details with real-time tracking
export const getTripDetails = async (tripId) => {
    try {
        const response = await api.get(`/corporate-operations/trips/${tripId}/details`);
        return response.data;
    } catch (error) {
        console.error("Error fetching trip details:", error);
        throw error;
    }
};

// Sync negotiation commission for existing contracts
export const syncNegotiationCommission = async (contractId) => {
    try {
        const response = await api.post(`/contracts/${contractId}/sync-negotiation-commission`);
        return response.data;
    } catch (error) {
        console.error("Error syncing negotiation commission:", error);
        throw error;
    }
};

export default {
    getDailyTrips,
    getEmployeeAssignedTrips,
    assignRouteToVehicle,
    getAssignedRoutesStatus,
    assignEmployeesToTrip,
    getTripDetails,
    syncNegotiationCommission
};
