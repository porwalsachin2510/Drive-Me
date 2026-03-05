import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import Trip from "../models/Trip.js";
import User from "../models/User.js";
import {
    updateTripLocation,
    startTrip as startTripService,
    completeTrip as completeTripService,
    reportEmergency as reportEmergencyService,
    reportTripDelay,
} from "../Services/locationTrackingService.js";

// Get active trip for driver
export const getActiveTrip = async (req, res) => {
    try {
        const driverId = req.userId;
        const userId = req.userId;

        // Find active trip for this driver
        const trip = await B2CPartnerTrip.findOne({
            $or: [
                { driverId: driverId },
                { 'assignedDriver': driverId },
                { b2cPartnerId: driverId }
            ],
            status: { $in: ['Scheduled', 'In Progress', 'SCHEDULED', 'IN_PROGRESS'] }
        }).populate('routeId passengers.userId');

        if (!trip) {
            return res.json({
                success: true,
                trip: null
            });
        }

        res.json({
            success: true,
            trip
        });

    } catch (error) {
        console.error('Error getting active trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get active trip'
        });
    }
};

// Update driver location
export const updateLocation = async (req, res) => {
    try {
        const { tripId, latitude, longitude, address, speed, timestamp } = req.body;
        const driverId = req.userId;

        // Update trip location
        const result = await updateTripLocation(
            tripId,
            latitude,
            longitude,
            address,
            speed
        );

        res.json({
            success: true,
            message: 'Location updated successfully',
            data: result
        });

    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update location'
        });
    }
};

// Start trip
export const startTrip = async (req, res) => {
    try {
        const { tripId } = req.params;
        const driverId = req.userId;

        const result = await startTripService(tripId, driverId);

        res.json({
            success: true,
            message: 'Trip started successfully',
            data: result
        });

    } catch (error) {
        console.error('Error starting trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start trip'
        });
    }
};

// Complete trip
export const completeTrip = async (req, res) => {
    try {
        const { tripId } = req.params;
        const driverId = req.userId;

        const result = await completeTripService(tripId);

        res.json({
            success: true,
            message: 'Trip completed successfully',
            data: result
        });

    } catch (error) {
        console.error('Error completing trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete trip'
        });
    }
};

// Report emergency
export const reportEmergency = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { emergencyType, message, location } = req.body;
        const driverId = req.userId;

        const result = await reportEmergencyService(
            tripId,
            emergencyType,
            message,
            location
        );

        res.json({
            success: true,
            message: 'Emergency reported successfully',
            data: result
        });

    } catch (error) {
        console.error('Error reporting emergency:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to report emergency'
        });
    }
};

// Report trip delay
export const delayTrip = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { delayMinutes, reason } = req.body;
        const driverId = req.userId;

        const result = await reportTripDelay(
            tripId,
            delayMinutes,
            reason
        );

        res.json({
            success: true,
            message: 'Trip delay reported successfully',
            data: result
        });

    } catch (error) {
        console.error('Error reporting trip delay:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to report trip delay'
        });
    }
};

// Get driver location by driverId (for passengers/corporate to track)
export const getDriverLocation = async (req, res) => {
    try {
        const { driverId } = req.params;

        // Resolve actual driver model ID - driverId param could be userId or drivers._id
        let actualDriverId = driverId
        const driverUser = await User.findById(driverId)
        if (driverUser && driverUser.driverId) {
            actualDriverId = driverUser.driverId.toString()
        }

        // Find the active trip for the driver in B2CPartnerTrip
        let trip = await B2CPartnerTrip.findOne({
            $or: [
                { driverId: driverId },
                { driverId: actualDriverId },
                { 'assignedDriver': driverId },
                { b2cPartnerId: driverId }
            ],
            status: { $in: ['In Progress', 'IN_PROGRESS', 'Scheduled', 'SCHEDULED'] }
        }).select('currentLocation locationHistory status driverId routeId');

        // If not found in B2CPartnerTrip, check Trip model (B2B/Corporate trips)
        if (!trip) {
            trip = await Trip.findOne({
                $or: [
                    { driverId: driverId },
                    { driverId: actualDriverId }
                ],
                status: { $in: ['IN_PROGRESS', 'SCHEDULED'] }
            }).select('currentLocation driverLocation status driverId routeId');
        }

        if (!trip) {
            return res.json({
                success: true,
                data: {
                    driverId,
                    location: null,
                    message: 'No active trip found for this driver'
                }
            });
        }

        res.json({
            success: true,
            data: {
                driverId,
                tripId: trip._id,
                location: trip.currentLocation || trip.driverLocation || null,
                locationHistory: (trip.locationHistory || []).slice(-10),
                tripStatus: trip.status
            }
        });

    } catch (error) {
        console.error('Error getting driver location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get driver location'
        });
    }
};

export default {
    getActiveTrip,
    updateLocation,
    startTrip,
    completeTrip,
    reportEmergency,
    delayTrip,
    getDriverLocation
};
