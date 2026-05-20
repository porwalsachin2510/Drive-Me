import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
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
        const { bookingId } = req.query; // Get bookingId from query params

        console.log("[v0] getDriverLocation called for driverId:", driverId, "bookingId:", bookingId);

        // Resolve actual driver model ID - driverId param could be userId or drivers._id
        let actualDriverId = driverId;
        const driverUser = await User.findById(driverId);
        if (driverUser && driverUser.driverId) {
            actualDriverId = driverUser.driverId.toString();
        }

        console.log("[v0] Resolved actualDriverId:", actualDriverId, "Role:", driverUser?.role);

        // If bookingId is provided, use it to find the correct trip for this specific booking
        if (bookingId) {
            const booking = await B2CPassengerBooking.findById(bookingId)
                .select('monthlyTrips routeId pickupLocation dropoffLocation b2cPartnerId assignedDriverId');

            if (booking) {
                console.log("[v0] Found booking:", bookingId, "with", booking.monthlyTrips?.length || 0, "monthly trips");

                // Get today's date range (start and end of day)
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
                const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

                // Find an IN_PROGRESS trip that belongs to this booking's monthlyTrips
                // AND matches today's date AND has the same pickup/dropoff route
                let trip = null;

                if (booking.monthlyTrips && booking.monthlyTrips.length > 0) {
                    trip = await B2CPartnerTrip.findOne({
                        _id: { $in: booking.monthlyTrips },
                        status: { $in: ['In Progress', 'IN_PROGRESS'] },
                        tripDate: { $gte: startOfDay, $lte: endOfDay },
                        // Also verify the route matches
                        fromLocation: booking.pickupLocation,
                        toLocation: booking.dropoffLocation
                    }).select('currentLocation locationHistory status driverId b2cPartnerId routeId fromLocation toLocation tripDate');

                    if (trip) {
                        console.log("[v0] Found IN_PROGRESS trip for booking's route today:", trip._id, trip.fromLocation, "->", trip.toLocation);
                    }
                }

                // If no matching IN_PROGRESS trip, check for SCHEDULED trips for this booking today
                if (!trip) {
                    const scheduledTrip = await B2CPartnerTrip.findOne({
                        _id: { $in: booking.monthlyTrips || [] },
                        status: { $in: ['Scheduled', 'SCHEDULED'] },
                        tripDate: { $gte: startOfDay, $lte: endOfDay },
                        fromLocation: booking.pickupLocation,
                        toLocation: booking.dropoffLocation
                    }).select('_id status tripDate startTime fromLocation toLocation');

                    if (scheduledTrip) {
                        console.log("[v0] Found SCHEDULED trip for booking's route today:", scheduledTrip._id, scheduledTrip.fromLocation, "->", scheduledTrip.toLocation);
                        return res.json({
                            success: true,
                            data: {
                                driverId,
                                tripId: scheduledTrip._id,
                                location: null,
                                tripStatus: scheduledTrip.status,
                                isLocationAvailable: false,
                                message: `Trip for ${booking.pickupLocation} to ${booking.dropoffLocation} has not started yet. Driver location will be available once the trip begins.`
                            }
                        });
                    }

                    // No trip found for today's date on this route
                    console.log("[v0] No trip found for booking's route today:", booking.pickupLocation, "->", booking.dropoffLocation);
                    return res.json({
                        success: true,
                        data: {
                            driverId,
                            location: null,
                            tripStatus: null,
                            isLocationAvailable: false,
                            message: `No trip scheduled for ${booking.pickupLocation} to ${booking.dropoffLocation} today.`
                        }
                    });
                }

                // Return location for the matching IN_PROGRESS trip
                const location = trip.currentLocation || null;
                console.log("[v0] Returning location for matching trip", trip._id, ":", location);

                return res.json({
                    success: true,
                    data: {
                        driverId,
                        tripId: trip._id,
                        location: location,
                        locationHistory: (trip.locationHistory || []).slice(-10),
                        tripStatus: trip.status,
                        isLocationAvailable: !!(location && (location.latitude || location.lat))
                    }
                });
            }
        }

        // Fallback: If no bookingId provided, use original logic (for backward compatibility)
        // But this should ideally not be used for B2C tracking
        let trip = await B2CPartnerTrip.findOne({
            $or: [
                { driverId: driverId },
                { driverId: actualDriverId },
                { 'assignedDriver': driverId },
                { b2cPartnerId: driverId }
            ],
            status: { $in: ['In Progress', 'IN_PROGRESS'] }
        }).select('currentLocation locationHistory status driverId b2cPartnerId routeId').sort({ actualStartTime: -1 });

        console.log("[v0] B2CPartnerTrip IN_PROGRESS search result (fallback):", trip ? `Found trip ${trip._id} with status ${trip.status}` : "No in-progress trip found");

        // If not found in B2CPartnerTrip, check Trip model (B2B/Corporate trips)
        if (!trip) {
            trip = await Trip.findOne({
                $or: [
                    { driverId: driverId },
                    { driverId: actualDriverId }
                ],
                status: 'IN_PROGRESS'
            }).select('currentLocation driverLocation status driverId routeId');

            if (trip) {
                console.log("[v0] Found B2B/Corporate trip IN_PROGRESS:", trip._id);
            }
        }

        if (!trip) {
            const scheduledTrip = await B2CPartnerTrip.findOne({
                $or: [
                    { driverId: driverId },
                    { driverId: actualDriverId },
                    { 'assignedDriver': driverId },
                    { b2cPartnerId: driverId }
                ],
                status: { $in: ['Scheduled', 'SCHEDULED'] }
            }).select('_id status tripDate startTime').sort({ tripDate: 1, startTime: 1 });

            if (scheduledTrip) {
                console.log("[v0] Found SCHEDULED trip but not started:", scheduledTrip._id);
                return res.json({
                    success: true,
                    data: {
                        driverId,
                        tripId: scheduledTrip._id,
                        location: null,
                        tripStatus: scheduledTrip.status,
                        isLocationAvailable: false,
                        message: 'Trip has not started yet. Driver location will be available once the trip begins.'
                    }
                });
            }

            console.log("[v0] No active trip found for driver:", driverId);
            return res.json({
                success: true,
                data: {
                    driverId,
                    location: null,
                    tripStatus: null,
                    isLocationAvailable: false,
                    message: 'No active trip found for this driver'
                }
            });
        }

        const location = trip.currentLocation || trip.driverLocation || null;
        console.log("[v0] Returning location for IN_PROGRESS trip", trip._id, ":", location);

        res.json({
            success: true,
            data: {
                driverId,
                tripId: trip._id,
                location: location,
                locationHistory: (trip.locationHistory || []).slice(-10),
                tripStatus: trip.status,
                isLocationAvailable: !!(location && (location.latitude || location.lat))
            }
        });

    } catch (error) {
        console.error('[v0] Error getting driver location:', error);
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
