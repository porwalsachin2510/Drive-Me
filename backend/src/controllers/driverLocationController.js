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

        // Resolve actual driver model ID - driverId param could be userId or drivers._id
        let actualDriverId = driverId;
        const driverUser = await User.findById(driverId);
        if (driverUser && driverUser.driverId) {
            actualDriverId = driverUser.driverId.toString();
        }

        // Get today's date range (start and end of day)
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        // If bookingId is provided, use it to find the correct trip for this specific booking
        if (bookingId) {
            const booking = await B2CPassengerBooking.findById(bookingId)
                .select('monthlyTrips routeId pickupLocation dropoffLocation returnPickupLocation returnDropoffLocation b2cPartnerId assignedDriverId isSelfDriver bookingStatus bookingType outboundDriverId outboundIsSelfDriver returnDriverId returnIsSelfDriver outboundTripTime returnTripTime');

            if (booking) {
                // CRITICAL FIX: Check if booking is ACCEPTED before allowing tracking
                // Passengers with CONFIRMED (not yet accepted) bookings should NOT be able to track
                // Only ACCEPTED, IN_PROGRESS, or COMPLETED bookings can track the driver
                const allowedTrackingStatuses = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];
                if (!allowedTrackingStatuses.includes(booking.bookingStatus)) {
                    return res.json({
                        success: true,
                        data: {
                            driverId,
                            location: null,
                            tripStatus: null,
                            isLocationAvailable: false,
                            bookingStatus: booking.bookingStatus,
                            trackingAllowed: false,
                            message: booking.bookingStatus === 'CONFIRMED'
                                ? 'Your booking is waiting for partner acceptance. Driver tracking will be available once your booking is accepted.'
                                : `Tracking is not available for ${booking.bookingStatus} bookings.`
                        }
                    });
                }

                // CRITICAL: For ROUND_TRIP bookings, we need to check BOTH outbound and return drivers
                // Build a list of all possible driver IDs for this booking
                const possibleDriverIds = [driverId, actualDriverId];

                // Add outbound driver
                if (booking.outboundDriverId) {
                    possibleDriverIds.push(booking.outboundDriverId.toString());
                    // If outbound is self-driver, b2cPartnerId is the driver
                    if (booking.outboundIsSelfDriver && booking.b2cPartnerId) {
                        possibleDriverIds.push(booking.b2cPartnerId.toString());
                    }
                }

                // Add return driver for ROUND_TRIP bookings
                if (booking.bookingType === 'ROUND_TRIP' && booking.returnDriverId) {
                    possibleDriverIds.push(booking.returnDriverId.toString());
                    // Also resolve the return driver's user ID if they have one
                    const returnDriverUser = await User.findOne({ driverId: booking.returnDriverId });
                    if (returnDriverUser) {
                        possibleDriverIds.push(returnDriverUser._id.toString());
                    }
                    // Also try finding user with this driverId in selfDriverAvailability or directly
                    const returnDriverById = await User.findById(booking.returnDriverId);
                    if (returnDriverById) {
                        possibleDriverIds.push(returnDriverById._id.toString());
                        if (returnDriverById.driverId) {
                            possibleDriverIds.push(returnDriverById.driverId.toString());
                        }
                    }
                }

                // Add b2cPartnerId for self-driving cases
                if (booking.b2cPartnerId) {
                    possibleDriverIds.push(booking.b2cPartnerId.toString());
                }

                // Remove duplicates
                const uniqueDriverIds = [...new Set(possibleDriverIds.filter(Boolean))];

                // FIRST: Try to find an IN_PROGRESS trip for ANY of the booking's drivers for today
                // This handles both outbound and return trips
                let trip = await B2CPartnerTrip.findOne({
                    $or: [
                        { driverId: { $in: uniqueDriverIds } },
                        { b2cPartnerId: { $in: uniqueDriverIds } }
                    ],
                    status: { $in: ['In Progress', 'IN_PROGRESS'] },
                    tripDate: { $gte: startOfDay, $lte: endOfDay }
                }).select('currentLocation locationHistory status driverId b2cPartnerId routeId fromLocation toLocation tripDate').sort({ actualStartTime: -1 });

                if (trip) {
                    // Verify this trip matches the booking's route (outbound OR return for ROUND_TRIP)
                    const tripMatchesOutboundRoute =
                        (trip.fromLocation === booking.pickupLocation && trip.toLocation === booking.dropoffLocation) ||
                        (trip.routeId && booking.routeId && trip.routeId.toString() === booking.routeId.toString());

                    // For ROUND_TRIP, also check if the trip matches the return route
                    const tripMatchesReturnRoute = booking.bookingType === 'ROUND_TRIP' && (
                        (trip.fromLocation === booking.returnPickupLocation && trip.toLocation === booking.returnDropoffLocation) ||
                        (trip.fromLocation === booking.dropoffLocation && trip.toLocation === booking.pickupLocation) // Reverse of outbound
                    );

                    if (tripMatchesOutboundRoute || tripMatchesReturnRoute || booking.monthlyTrips?.some(t => t.toString() === trip._id.toString())) {
                        const location = trip.currentLocation || null;

                        return res.json({
                            success: true,
                            data: {
                                driverId: trip.driverId?.toString() || driverId, // Return actual driver ID from trip
                                tripId: trip._id,
                                location: location,
                                locationHistory: (trip.locationHistory || []).slice(-10),
                                tripStatus: trip.status,
                                isLocationAvailable: !!(location && (location.latitude || location.lat)),
                                trackingAllowed: true,
                                isReturnTrip: tripMatchesReturnRoute // Indicate if this is the return trip
                            }
                        });
                    }
                }

                // SECOND: If no directly matching IN_PROGRESS trip, check booking's monthlyTrips array
                if (booking.monthlyTrips && booking.monthlyTrips.length > 0) {
                    trip = await B2CPartnerTrip.findOne({
                        _id: { $in: booking.monthlyTrips },
                        status: { $in: ['In Progress', 'IN_PROGRESS'] },
                        tripDate: { $gte: startOfDay, $lte: endOfDay }
                    }).select('currentLocation locationHistory status driverId b2cPartnerId routeId fromLocation toLocation tripDate');

                    if (trip) {
                        const location = trip.currentLocation || null;
                        return res.json({
                            success: true,
                            data: {
                                driverId,
                                tripId: trip._id,
                                location: location,
                                locationHistory: (trip.locationHistory || []).slice(-10),
                                tripStatus: trip.status,
                                isLocationAvailable: !!(location && (location.latitude || location.lat)),
                                trackingAllowed: true
                            }
                        });
                    }
                }

                // THIRD: Check for SCHEDULED trips if no in-progress trip found
                // Use uniqueDriverIds to find scheduled trips for any of the booking's drivers
                let scheduledTrip = await B2CPartnerTrip.findOne({
                    $or: [
                        { _id: { $in: booking.monthlyTrips || [] } },
                        {
                            $and: [
                                {
                                    $or: [
                                        { driverId: { $in: uniqueDriverIds } },
                                        { b2cPartnerId: { $in: uniqueDriverIds } }
                                    ]
                                },
                                {
                                    // Match either outbound OR return route
                                    $or: [
                                        { fromLocation: booking.pickupLocation, toLocation: booking.dropoffLocation },
                                        { fromLocation: booking.returnPickupLocation, toLocation: booking.returnDropoffLocation },
                                        { fromLocation: booking.dropoffLocation, toLocation: booking.pickupLocation } // Reverse for return
                                    ]
                                }
                            ]
                        }
                    ],
                    status: { $in: ['Scheduled', 'SCHEDULED'] },
                    tripDate: { $gte: startOfDay, $lte: endOfDay }
                }).select('_id status tripDate startTime fromLocation toLocation');

                if (scheduledTrip) {
                    return res.json({
                        success: true,
                        data: {
                            driverId,
                            tripId: scheduledTrip._id,
                            location: null,
                            tripStatus: scheduledTrip.status,
                            isLocationAvailable: false,
                            trackingAllowed: true,
                            message: `Trip for ${booking.pickupLocation} to ${booking.dropoffLocation} has not started yet. Driver location will be available once the trip begins.`
                        }
                    });
                }

                // No trip found for today's date on this route
                return res.json({
                    success: true,
                    data: {
                        driverId,
                        location: null,
                        tripStatus: null,
                        isLocationAvailable: false,
                        trackingAllowed: true,
                        message: `No trip scheduled for ${booking.pickupLocation} to ${booking.dropoffLocation} today.`
                    }
                });
            }
        }

        // Fallback: If no bookingId provided, use original logic (for backward compatibility)
        let trip = await B2CPartnerTrip.findOne({
            $or: [
                { driverId: driverId },
                { driverId: actualDriverId },
                { 'assignedDriver': driverId },
                { b2cPartnerId: driverId }
            ],
            status: { $in: ['In Progress', 'IN_PROGRESS'] },
            tripDate: { $gte: startOfDay, $lte: endOfDay }
        }).select('currentLocation locationHistory status driverId b2cPartnerId routeId').sort({ actualStartTime: -1 });

        // If not found in B2CPartnerTrip, check Trip model (B2B/Corporate trips)
        if (!trip) {
            trip = await Trip.findOne({
                $or: [
                    { driverId: driverId },
                    { driverId: actualDriverId }
                ],
                status: 'IN_PROGRESS'
            }).select('currentLocation driverLocation status driverId routeId');
        }

        if (!trip) {
            const scheduledTrip = await B2CPartnerTrip.findOne({
                $or: [
                    { driverId: driverId },
                    { driverId: actualDriverId },
                    { 'assignedDriver': driverId },
                    { b2cPartnerId: driverId }
                ],
                status: { $in: ['Scheduled', 'SCHEDULED'] },
                tripDate: { $gte: startOfDay, $lte: endOfDay }
            }).select('_id status tripDate startTime').sort({ tripDate: 1, startTime: 1 });

            if (scheduledTrip) {
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
