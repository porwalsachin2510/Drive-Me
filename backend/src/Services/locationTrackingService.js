import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import { sendRealTimeNotification } from "./socketService.js";
import { sendDelayNotification, sendEmergencyNotification } from "./notificationService.js";

// Store active connections and locations
const activeConnections = new Map();
const tripLocations = new Map();

// Initialize location tracking for a trip
export const initializeTripTracking = async (tripId, driverId, vehicleId) => {
    try {
        console.log(`[v0] Initializing location tracking for trip: ${tripId}`);
        
        // Store trip tracking info
        tripLocations.set(tripId, {
            driverId,
            vehicleId,
            startTime: new Date(),
            locations: [],
            isActive: true,
        });

        return true;
    } catch (error) {
        console.error("[v0] Error initializing trip tracking:", error);
        return false;
    }
};

// Update trip location
export const updateTripLocation = async (tripId, latitude, longitude, address, speed = null) => {
    try {
        const tripTracking = tripLocations.get(tripId);
        
        if (!tripTracking || !tripTracking.isActive) {
            console.log(`[v0] Trip ${tripId} not actively tracked`);
            return false;
        }

        const locationData = {
            latitude,
            longitude,
            address,
            speed,
            timestamp: new Date(),
        };

        // Update trip in database
        await B2CPartnerTrip.findByIdAndUpdate(tripId, {
            currentLocation: {
                latitude,
                longitude,
                address,
                lastUpdated: new Date(),
            },
        });

        // Store in memory tracking
        tripTracking.locations.push(locationData);
        
        // Keep only last 100 locations to prevent memory issues
        if (tripTracking.locations.length > 100) {
            tripTracking.locations = tripTracking.locations.slice(-100);
        }

        // Broadcast location to connected passengers
        await broadcastLocationToPassengers(tripId, locationData);

        console.log(`[v0] Location updated for trip ${tripId}: ${latitude}, ${longitude}`);
        return true;
    } catch (error) {
        console.error("[v0] Error updating trip location:", error);
        return false;
    }
};

// Broadcast location to passengers
const broadcastLocationToPassengers = async (tripId, locationData) => {
    try {
        const trip = await B2CPartnerTrip.findById(tripId).populate('passengers.userId');
        
        if (!trip) return;

        for (const passenger of trip.passengers) {
            if (passenger.userId && passenger.status !== "No Show") {
                await sendRealTimeNotification(passenger.userId._id, {
                    type: "LOCATION_UPDATE",
                    data: {
                        tripId,
                        location: locationData,
                        vehicleInfo: trip.vehicleInfo,
                        estimatedArrival: calculateEstimatedArrival(locationData, trip),
                    },
                });
            }
        }
    } catch (error) {
        console.error("[v0] Error broadcasting location:", error);
    }
};

// Calculate estimated arrival time
const calculateEstimatedArrival = (currentLocation, trip) => {
    try {
        // Simple estimation - in real app, use Google Maps API or similar
        const averageSpeed = 40; // km/h
        const distance = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            trip.toLocation.coordinates?.latitude || 0,
            trip.toLocation.coordinates?.longitude || 0
        );
        
        const timeInMinutes = (distance / averageSpeed) * 60;
        const arrivalTime = new Date(Date.now() + timeInMinutes * 60000);
        
        return arrivalTime.toTimeString().slice(0, 5);
    } catch (error) {
        return trip.startTime;
    }
};

// Calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// Start trip (driver starts the journey)
export const startTrip = async (tripId, driverId) => {
    try {
        console.log(`[v0] Starting trip: ${tripId}`);
        
        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            throw new Error("Trip not found");
        }

        // Update trip status
        trip.status = "In Progress";
        trip.actualStartTime = new Date();
        await trip.save();

        // Initialize tracking
        await initializeTripTracking(tripId, driverId, trip.vehicleId);

        // Send trip start notification
        const { sendTripStartNotification } = await import("./notificationService.js");
        await sendTripStartNotification(tripId, driverId);

        return true;
    } catch (error) {
        console.error("[v0] Error starting trip:", error);
        return false;
    }
};

// Complete trip
export const completeTrip = async (tripId, finalLocation = null) => {
    try {
        console.log(`[v0] Completing trip: ${tripId}`);
        
        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            throw new Error("Trip not found");
        }

        // Update trip status
        trip.status = "Completed";
        trip.actualEndTime = new Date();
        
        if (finalLocation) {
            trip.currentLocation = {
                ...finalLocation,
                lastUpdated: new Date(),
            };
        }
        
        await trip.save();

        // Stop tracking
        const tripTracking = tripLocations.get(tripId);
        if (tripTracking) {
            tripTracking.isActive = false;
        }

        // Send completion notification
        const { sendTripCompletionNotification } = await import("./notificationService.js");
        await sendTripCompletionNotification(tripId);

        return true;
    } catch (error) {
        console.error("[v0] Error completing trip:", error);
        return false;
    }
};

// Report trip delay
export const reportTripDelay = async (tripId, delayMinutes, reason) => {
    try {
        console.log(`[v0] Reporting delay for trip: ${tripId}, delay: ${delayMinutes} minutes`);
        
        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            throw new Error("Trip not found");
        }

        // Calculate new start time
        const originalStartTime = new Date(`${trip.tripDate.toDateString()} ${trip.startTime}`);
        const delayedStartTime = new Date(originalStartTime.getTime() + delayMinutes * 60000);
        
        trip.delayedStartTime = delayedStartTime.toTimeString().slice(0, 5);
        await trip.save();

        // Send delay notification
        await sendDelayNotification(tripId, delayMinutes, reason);

        return true;
    } catch (error) {
        console.error("[v0] Error reporting trip delay:", error);
        return false;
    }
};

// Report emergency
export const reportEmergency = async (tripId, emergencyType, message, location = null) => {
    try {
        console.log(`[v0] Emergency reported for trip: ${tripId}, type: ${emergencyType}`);
        
        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            throw new Error("Trip not found");
        }

        // Update trip status to emergency
        trip.status = "Emergency";
        
        if (location) {
            trip.currentLocation = {
                ...location,
                lastUpdated: new Date(),
            };
        }
        
        await trip.save();

        // Send emergency notification
        await sendEmergencyNotification(tripId, emergencyType, message);

        return true;
    } catch (error) {
        console.error("[v0] Error reporting emergency:", error);
        return false;
    }
};

// Get current trip location for passenger
export const getTripLocation = async (req, res) => {
    try {
        const { tripId } = req.params;
        const userId = req.userId;

        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        // Verify user is a passenger on this trip
        const isPassenger = trip.passengers.some(
            p => p.userId.toString() === userId && p.status !== "No Show"
        );

        if (!isPassenger) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to view this trip location",
            });
        }

        // Get current location from tracking
        const tripTracking = tripLocations.get(tripId);
        let currentLocation = trip.currentLocation;
        
        if (tripTracking && tripTracking.locations.length > 0) {
            const latestLocation = tripTracking.locations[tripTracking.locations.length - 1];
            currentLocation = {
                latitude: latestLocation.latitude,
                longitude: latestLocation.longitude,
                address: latestLocation.address,
                lastUpdated: latestLocation.timestamp,
                speed: latestLocation.speed,
            };
        }

        return res.status(200).json({
            success: true,
            data: {
                tripId,
                status: trip.status,
                currentLocation,
                vehicleInfo: trip.vehicleInfo,
                driverInfo: trip.driverInfo,
                estimatedArrival: currentLocation ? calculateEstimatedArrival(currentLocation, trip) : null,
            },
        });
    } catch (error) {
        console.error("[v0] Error getting trip location:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get trip location",
            error: error.message,
        });
    }
};

// Get trip history for admin
export const getTripHistory = async (req, res) => {
    try {
        const { tripId } = req.params;
        const userId = req.userId;

        // Verify user is admin or trip owner
        const trip = await B2CPartnerTrip.findById(tripId).populate('b2cPartnerId');
        
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        // Check authorization (admin or trip owner)
        if (req.userRole !== "ADMIN" && trip.b2cPartnerId._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to view trip history",
            });
        }

        // Get location history from tracking
        const tripTracking = tripLocations.get(tripId);
        const locationHistory = tripTracking ? tripTracking.locations : [];

        return res.status(200).json({
            success: true,
            data: {
                tripId,
                status: trip.status,
                startTime: trip.actualStartTime,
                endTime: trip.actualEndTime,
                locationHistory,
                passengerCount: trip.passengers.length,
                completedPassengers: trip.passengers.filter(p => p.status === "Completed").length,
            },
        });
    } catch (error) {
        console.error("[v0] Error getting trip history:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get trip history",
            error: error.message,
        });
    }
};

// Get active trips for real-time monitoring
export const getActiveTrips = async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.userRole;

        let filter = { status: "In Progress" };

        // Filter based on user role
        if (userRole === "B2C_PARTNER") {
            filter.b2cPartnerId = userId;
        } else if (userRole === "COMMUTER") {
            filter["passengers.userId"] = userId;
        }

        const activeTrips = await B2CPartnerTrip.find(filter)
            .populate('b2cPartnerId', 'fullName')
            .populate('driverId', 'name phoneNumber')
            .populate('vehicleId', 'model licensePlate')
            .sort({ tripDate: 1, startTime: 1 });

        return res.status(200).json({
            success: true,
            data: { activeTrips },
        });
    } catch (error) {
        console.error("[v0] Error getting active trips:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get active trips",
            error: error.message,
        });
    }
};

// Clean up old tracking data (run periodically)
export const cleanupTrackingData = () => {
    try {
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

        for (const [tripId, tracking] of tripLocations.entries()) {
            if (tracking.startTime < cutoffTime || !tracking.isActive) {
                tripLocations.delete(tripId);
                console.log(`[v0] Cleaned up tracking data for trip: ${tripId}`);
            }
        }
    } catch (error) {
        console.error("[v0] Error cleaning up tracking data:", error);
    }
};

// Get tracking statistics
export const getTrackingStatistics = async (req, res) => {
    try {
        const totalActiveTrips = tripLocations.size;
        const activeConnectionsCount = activeConnections.size;
        
        const stats = {
            activeTrips: totalActiveTrips,
            activeConnections: activeConnectionsCount,
            timestamp: new Date(),
        };

        return res.status(200).json({
            success: true,
            data: { stats },
        });
    } catch (error) {
        console.error("[v0] Error getting tracking statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get tracking statistics",
            error: error.message,
        });
    }
};
