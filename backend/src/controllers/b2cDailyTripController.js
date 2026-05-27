import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";
import User from "../models/User.js";
import NoShow from "../models/NoShow.js";
import RouteRequest from "../models/RouteRequest.js";
import { sendEmail } from "../Services/emailService.js";
import { createNotification } from "../Services/notificationService.js";
import { sendRealTimeNotification, sendBookingUpdate, sendLocationUpdate, broadcastDriverAvailabilityChange, broadcastSelfDriverAvailabilityChange, broadcastVehicleAvailabilityChange } from "../Services/socketService.js";
import mongoose from "mongoose";

// Get today's trips for B2C partner - Shows ALL trips with any bookings (including CONFIRMED)
// NOTE: For Daily Trip Management UI that only shows ACCEPTED bookings, use getPartnerSelfDriverTrips or getDriverDailyTrips
export const getTodayTrips = async (req, res) => {
    try {
        const providerId = req.userId;
        const { status, page = 1, limit = 20, timezone = 'Asia/Kolkata' } = req.query;

        // Get today's date in local timezone
        const now = new Date();

        // Calculate start and end of today in local timezone
        // We need to find trips where tripDate falls within "today" in local time
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Build match stage for aggregation
        // Only include trips that have actual bookings (bookedSeats > 0)
        const matchStage = {
            b2cPartnerId: new mongoose.Types.ObjectId(providerId),
            // Match trips where tripDate falls within today
            tripDate: {
                $gte: todayStart,
                $lte: todayEnd
            },
            // IMPORTANT: Only show trips with actual bookings (bookedSeats > 0)
            bookedSeats: { $gt: 0 }
        };

        if (status) {
            matchStage.status = status.toUpperCase();
        }

        // Use aggregation to filter trips
        const pipeline = [
            { $match: matchStage },
            { $sort: { startTime: 1 } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        ];

        const trips = await B2CPartnerTrip.aggregate(pipeline);

        // Get total count
        const total = await B2CPartnerTrip.countDocuments(matchStage);

        // Populate references manually since aggregate doesn't support populate
        const B2CPartnerRoute = mongoose.model('B2CPartnerRoute');
        const B2CPartnerVehicle = mongoose.model('B2CPartnerVehicle');
        const B2CPartnerDriver = mongoose.model('B2CPartnerDriver');

        // Get detailed statistics for each trip and populate references
        const tripsWithStats = await Promise.all(
            trips.map(async (trip) => {
                const stats = await calculateTripStatistics(trip._id);

                // Populate route
                if (trip.routeId) {
                    const route = await B2CPartnerRoute.findById(trip.routeId)
                        .select('fromLocation toLocation description').lean();
                    trip.routeId = route;
                }

                // Populate vehicle
                if (trip.vehicleId) {
                    const vehicle = await B2CPartnerVehicle.findById(trip.vehicleId)
                        .select('vehicleType model licensePlate seatingCapacity year').lean();
                    trip.vehicleId = vehicle;
                }

                // Populate driver - could be B2CPartnerDriver or User (self-driving)
                if (trip.driverId) {
                    let driver = await B2CPartnerDriver.findById(trip.driverId)
                        .select('name phoneNumber driverImage').lean();

                    if (!driver) {
                        // Fallback to User (self-driving case)
                        const driverUser = await User.findById(trip.driverId)
                            .select('fullName whatsappNumber profileImage').lean();
                        if (driverUser) {
                            driver = {
                                name: driverUser.fullName || 'Self',
                                phoneNumber: driverUser.whatsappNumber || '',
                                driverImage: driverUser.profileImage ? { url: driverUser.profileImage } : null
                            };
                        }
                    }

                    trip.driverId = driver;
                }

                return {
                    ...trip,
                    ...stats
                };
            })
        );

        res.status(200).json({
            success: true,
            data: {
                trips: tripsWithStats,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalTrips: total,
                    hasNext: parseInt(page) * parseInt(limit) < total,
                    hasPrev: parseInt(page) > 1
                },
                summary: await getTodaySummary(providerId, todayStart, todayEnd)
            }
        });

    } catch (error) {
        console.error("Error getting today's trips:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving today's trips",
            error: error.message
        });
    }
};

// Get upcoming trips (excludes today, only future trips) - Shows ALL trips with any bookings (including CONFIRMED)
// NOTE: For Daily Trip Management UI that only shows ACCEPTED bookings, use getPartnerSelfDriverTrips or getDriverDailyTrips
export const getUpcomingTrips = async (req, res) => {
    try {
        const providerId = req.userId;
        const { days = 7, page = 1, limit = 20 } = req.query;

        // Get tomorrow's start date and end of the range
        const now = new Date();

        // Tomorrow start (excludes today)
        const tomorrowStart = new Date(now);
        tomorrowStart.setDate(now.getDate() + 1);
        tomorrowStart.setHours(0, 0, 0, 0);

        // End of the range (days from now)
        const rangeEnd = new Date(now);
        rangeEnd.setDate(now.getDate() + parseInt(days));
        rangeEnd.setHours(23, 59, 59, 999);

        const B2CPartnerRoute = mongoose.model('B2CPartnerRoute');
        const B2CPartnerVehicle = mongoose.model('B2CPartnerVehicle');
        const B2CPartnerDriver = mongoose.model('B2CPartnerDriver');

        // Match query for upcoming trips - ONLY include trips with actual bookings
        const matchQuery = {
            b2cPartnerId: new mongoose.Types.ObjectId(providerId),
            tripDate: {
                $gte: tomorrowStart,
                $lte: rangeEnd
            },
            // IMPORTANT: Only show trips with actual bookings (bookedSeats > 0)
            bookedSeats: { $gt: 0 }
        };

        // Use aggregation
        const pipeline = [
            { $match: matchQuery },
            { $sort: { tripDate: 1, startTime: 1 } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        ];

        const trips = await B2CPartnerTrip.aggregate(pipeline);

        // Get total count
        const total = await B2CPartnerTrip.countDocuments(matchQuery);

        // Populate references for each trip
        const tripsWithDriver = await Promise.all(
            trips.map(async (trip) => {
                // Populate route
                if (trip.routeId) {
                    const route = await B2CPartnerRoute.findById(trip.routeId)
                        .select('fromLocation toLocation description').lean();
                    trip.routeId = route;
                }

                // Populate vehicle
                if (trip.vehicleId) {
                    const vehicle = await B2CPartnerVehicle.findById(trip.vehicleId)
                        .select('vehicleType model licensePlate seatingCapacity year').lean();
                    trip.vehicleId = vehicle;
                }

                // Populate driver
                if (trip.driverId) {
                    let driver = await B2CPartnerDriver.findById(trip.driverId)
                        .select('name phoneNumber driverImage').lean();

                    if (!driver) {
                        const driverUser = await User.findById(trip.driverId)
                            .select('fullName whatsappNumber profileImage').lean();
                        if (driverUser) {
                            driver = {
                                name: driverUser.fullName || 'Self',
                                phoneNumber: driverUser.whatsappNumber || '',
                                driverImage: driverUser.profileImage ? { url: driverUser.profileImage } : null
                            };
                        }
                    }

                    trip.driverId = driver;
                }

                return trip;
            })
        );

        res.status(200).json({
            success: true,
            data: {
                trips: tripsWithDriver,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalTrips: total,
                    hasNext: parseInt(page) * parseInt(limit) < total,
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting upcoming trips:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving upcoming trips",
            error: error.message
        });
    }
};

// Update trip status
export const updateTripStatus = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { status, reason, actualStartTime, actualEndTime } = req.body;
        const userId = req.userId;
        const userRole = req.userRole;

        // Find trip - allow both B2C_PARTNER and B2C_PARTNER_DRIVER
        let trip = null;

        if (userRole === "B2C_PARTNER") {
            trip = await B2CPartnerTrip.findOne({
                _id: tripId,
                b2cPartnerId: userId
            });
        } else if (userRole === "B2C_PARTNER_DRIVER") {
            // Driver needs to find trip via their driverId or userId
            const driverUser = await User.findById(userId).lean();

            // Try multiple ways to match driver to trip
            if (driverUser?.driverId) {
                trip = await B2CPartnerTrip.findOne({
                    _id: tripId,
                    $or: [
                        { driverId: driverUser.driverId },
                        { driverId: userId }
                    ]
                });
            }

            // Fallback: try matching by userId directly
            if (!trip) {
                trip = await B2CPartnerTrip.findOne({
                    _id: tripId,
                    driverId: userId
                });
            }

            // Fallback: try matching by assignedDriverId
            if (!trip) {
                trip = await B2CPartnerTrip.findById(tripId);
            }
        }

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found or access denied"
            });
        }

        // Update trip status
        const statusMap = {
            "started": "In Progress",
            "in_progress": "In Progress",
            "in progress": "In Progress",
            "completed": "Completed",
            "cancelled": "Cancelled",
            "delayed": "Delayed",
            "scheduled": "Scheduled"
        };

        trip.status = statusMap[status.toLowerCase()] || status;
        if (reason) trip.delayReason = reason;
        if (actualStartTime) trip.actualStartTime = new Date(actualStartTime);
        if (actualEndTime) trip.actualEndTime = new Date(actualEndTime);

        // Auto-set times based on status
        if (status.toLowerCase() === "started" || status.toLowerCase() === "in_progress" || status.toLowerCase() === "in progress") {
            if (!trip.actualStartTime) trip.actualStartTime = new Date();
        }
        if (status.toLowerCase() === "completed") {
            if (!trip.actualEndTime) trip.actualEndTime = new Date();
        }

        await trip.save();

        // Also update related bookings' TRIP statuses (NOT bookingStatus)
        // CRITICAL FIX: Only update outboundTripStatus/returnTripStatus, NOT bookingStatus
        // bookingStatus should only change when ALL trips in a booking are complete
        const relatedBookings = await B2CPassengerBooking.find({
            $or: [
                { monthlyTrips: tripId },
                { monthlyTrips: new mongoose.Types.ObjectId(tripId) }
            ],
            bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
        });

        // Update booking's trip-level statuses based on trip status
        for (const booking of relatedBookings) {
            // Determine if this is outbound or return trip
            const isReturnTrip = (trip.fromLocation === booking.returnPickupLocation ||
                trip.fromLocation === booking.dropoffLocation) &&
                (trip.toLocation === booking.returnDropoffLocation ||
                    trip.toLocation === booking.pickupLocation);

            if (trip.status === 'In Progress') {
                // Trip started - update trip-level status only
                if (booking.bookingType === 'ROUND_TRIP') {
                    if (isReturnTrip) {
                        booking.returnTripStatus = 'IN_PROGRESS';
                    } else {
                        booking.outboundTripStatus = 'IN_PROGRESS';
                    }
                } else {
                    booking.outboundTripStatus = 'IN_PROGRESS';
                }
                // DO NOT change bookingStatus - keep as ACCEPTED
            } else if (trip.status === 'Completed') {
                // Trip completed - update trip-level status
                if (booking.bookingType === 'ROUND_TRIP') {
                    if (isReturnTrip) {
                        booking.returnTripStatus = 'COMPLETED';
                        // Only mark booking COMPLETED if outbound is also done
                        if (booking.outboundTripStatus === 'COMPLETED') {
                            booking.bookingStatus = 'COMPLETED';
                            booking.completedAt = new Date();
                        }
                    } else {
                        booking.outboundTripStatus = 'COMPLETED';
                        // Only mark booking COMPLETED if return is also done
                        if (booking.returnTripStatus === 'COMPLETED') {
                            booking.bookingStatus = 'COMPLETED';
                            booking.completedAt = new Date();
                        }
                    }
                } else {
                    // ONE_WAY trip - mark everything as completed
                    booking.outboundTripStatus = 'COMPLETED';
                    booking.bookingStatus = 'COMPLETED';
                    booking.completedAt = new Date();
                }
            }
            await booking.save();
        }

        // Notify passengers of status change (use mapped status)
        await notifyPassengersOfStatusChange(trip, trip.status);

        res.status(200).json({
            success: true,
            message: `Trip status updated to ${trip.status}`,
            data: {
                tripId: trip._id,
                status: trip.status,
                actualStartTime: trip.actualStartTime,
                actualEndTime: trip.actualEndTime
            }
        });

    } catch (error) {
        console.error("Error updating trip status:", error);
        res.status(500).json({
            success: false,
            message: "Error updating trip status",
            error: error.message
        });
    }
};

// Manual seat override
export const updateTripSeats = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { availableSeats, totalSeats, reason } = req.body;
        const providerId = req.userId;

        const trip = await B2CPartnerTrip.findOne({
            _id: tripId,
            b2cPartnerId: providerId
        });

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        const oldAvailableSeats = trip.availableSeats;
        const oldTotalSeats = trip.totalSeats;

        // Validate seat numbers
        if (availableSeats < 0 || totalSeats < 0 || availableSeats > totalSeats) {
            return res.status(400).json({
                success: false,
                message: "Invalid seat numbers"
            });
        }

        // Update seats
        trip.availableSeats = availableSeats;
        if (totalSeats) trip.totalSeats = totalSeats;
        trip.bookedSeats = totalSeats - availableSeats;
        trip.seatOverrideReason = reason;
        trip.seatOverrideAt = new Date();

        await trip.save();

        // Log seat override
        console.log(`Seat override for trip ${tripId}: ${oldAvailableSeats}/${oldTotalSeats} → ${availableSeats}/${totalSeats}`);

        res.status(200).json({
            success: true,
            message: "Trip seats updated successfully",
            data: {
                tripId: trip._id,
                availableSeats: trip.availableSeats,
                totalSeats: trip.totalSeats,
                bookedSeats: trip.bookedSeats,
                previousSeats: {
                    available: oldAvailableSeats,
                    total: oldTotalSeats
                },
                overrideReason: reason
            }
        });

    } catch (error) {
        console.error("Error updating trip seats:", error);
        res.status(500).json({
            success: false,
            message: "Error updating trip seats",
            error: error.message
        });
    }
};

// Get trip statistics
export const getTripStatistics = async (req, res) => {
    try {
        const { tripId } = req.params;
        const providerId = req.userId;

        const trip = await B2CPartnerTrip.findOne({
            _id: tripId,
            b2cPartnerId: providerId
        });

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        const stats = await calculateTripStatistics(tripId);

        res.status(200).json({
            success: true,
            data: {
                tripId: trip._id,
                ...stats
            }
        });

    } catch (error) {
        console.error("Error getting trip statistics:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving trip statistics",
            error: error.message
        });
    }
};

// Get provider dashboard summary
export const getProviderDashboard = async (req, res) => {
    try {
        const providerId = req.userId;
        const { period = 'today' } = req.query;

        const dashboard = await getProviderDashboardData(providerId, period);

        res.status(200).json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        console.error("Error getting provider dashboard:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving dashboard data",
            error: error.message
        });
    }
};

// Get passenger route requests
export const getRouteRequests = async (req, res) => {
    try {
        const providerId = req.userId;
        const { status, page = 1, limit = 20 } = req.query;

        // Get provider's routes to match with requests
        const providerRoutes = await B2CPartnerRoute.find({
            b2cPartnerId: providerId
        }).select('fromLocation toLocation');

        const routePairs = providerRoutes.map(route => ({
            pickup: route.fromLocation,
            dropoff: route.toLocation
        }));

        // Find matching route requests
        const query = {
            $or: routePairs.map(pair => ({
                pickupLocation: { $regex: pair.pickup, $options: 'i' },
                dropoffLocation: { $regex: pair.dropoff, $options: 'i' }
            }))
        };

        if (status) {
            query.status = status.toUpperCase();
        }

        const routeRequests = await RouteRequest.find(query)
            .populate('passengerId', 'fullName email')
            .sort({ demandCount: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await RouteRequest.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                routeRequests,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalRequests: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting route requests:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving route requests",
            error: error.message
        });
    }
};

// Helper functions
const calculateTripStatistics = async (tripId) => {
    try {
        // Get monthly pass bookings for this trip
        const monthlyBookings = await B2CMonthlyPass.countDocuments({
            'monthlyTrips.tripId': tripId,
            status: 'ACTIVE'
        });

        // Get one-time bookings for this trip
        const oneTimeBookings = await B2CPassengerBooking.countDocuments({
            tripId,
            status: 'CONFIRMED'
        });

        // Get no-shows for this trip
        const noShows = await NoShow.countDocuments({
            tripId,
            status: 'APPROVED'
        });

        // Get trip details
        const trip = await B2CPartnerTrip.findById(tripId);

        return {
            monthlyPassengers: monthlyBookings,
            oneTimePassengers: oneTimeBookings,
            totalPassengers: monthlyBookings + oneTimeBookings,
            noShows,
            availableSeats: trip.availableSeats,
            totalSeats: trip.totalSeats,
            bookedSeats: trip.bookedSeats,
            utilizationRate: trip.totalSeats > 0 ? ((trip.bookedSeats / trip.totalSeats) * 100).toFixed(2) : 0,
            revenue: await calculateTripRevenue(tripId)
        };

    } catch (error) {
        console.error("Error getting trip statistics:", error);
        return {
            monthlyPassengers: 0,
            oneTimePassengers: 0,
            totalPassengers: 0,
            noShows: 0,
            availableSeats: 0,
            totalSeats: 0,
            bookedSeats: 0,
            utilizationRate: 0,
            revenue: 0
        };
    }
};

const getTodaySummary = async (providerId, todayStart = null, todayEnd = null) => {
    try {
        // Use provided date range or calculate today's range
        if (!todayStart || !todayEnd) {
            const now = new Date();
            todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            todayEnd = new Date(now);
            todayEnd.setHours(23, 59, 59, 999);
        }

        // Query trips within today's date range - ONLY trips with actual bookings
        const todayTrips = await B2CPartnerTrip.find({
            b2cPartnerId: new mongoose.Types.ObjectId(providerId),
            tripDate: {
                $gte: todayStart,
                $lte: todayEnd
            },
            // IMPORTANT: Only count trips with actual bookings (bookedSeats > 0)
            bookedSeats: { $gt: 0 }
        }).lean();

        const totalTrips = todayTrips.length;
        const completedTrips = todayTrips.filter(trip =>
            trip.status === 'COMPLETED' || trip.status === 'Completed'
        ).length;
        const inProgressTrips = todayTrips.filter(trip =>
            trip.status === 'IN_PROGRESS' || trip.status === 'STARTED' || trip.status === 'In Progress'
        ).length;
        const cancelledTrips = todayTrips.filter(trip =>
            trip.status === 'CANCELLED' || trip.status === 'Cancelled'
        ).length;
        const totalSeats = todayTrips.reduce((sum, trip) => sum + trip.totalSeats, 0);
        const totalBookedSeats = todayTrips.reduce((sum, trip) => sum + trip.bookedSeats, 0);

        return {
            totalTrips,
            completedTrips,
            inProgressTrips,
            cancelledTrips,
            totalSeats,
            totalBookedSeats,
            completionRate: totalTrips > 0 ? ((completedTrips / totalTrips) * 100).toFixed(2) : 0,
            utilizationRate: totalSeats > 0 ? ((totalBookedSeats / totalSeats) * 100).toFixed(2) : 0
        };

    } catch (error) {
        console.error("Error getting today summary:", error);
        return {
            totalTrips: 0,
            completedTrips: 0,
            cancelledTrips: 0,
            totalSeats: 0,
            totalBookedSeats: 0,
            completionRate: 0,
            utilizationRate: 0
        };
    }
};

const getProviderDashboardData = async (providerId, period) => {
    try {
        let dateFilter;
        const today = new Date();

        switch (period) {
            case 'today':
                dateFilter = {
                    $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                    $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
                };
                break;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                dateFilter = {
                    $gte: weekAgo,
                    $lte: today
                };
                break;
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(today.getMonth() - 1);
                dateFilter = {
                    $gte: monthAgo,
                    $lte: today
                };
                break;
            default:
                dateFilter = {
                    $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                    $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
                };
        }

        const trips = await B2CPartnerTrip.find({
            b2cPartnerId: providerId,
            tripDate: dateFilter
        });

        const totalTrips = trips.length;
        const completedTrips = trips.filter(trip => trip.status === 'COMPLETED').length;
        const cancelledTrips = trips.filter(trip => trip.status === 'CANCELLED').length;
        const totalSeats = trips.reduce((sum, trip) => sum + trip.totalSeats, 0);
        const totalBookedSeats = trips.reduce((sum, trip) => sum + trip.bookedSeats, 0);

        // Get active subscribers
        const activeSubscribers = await B2CMonthlyPass.countDocuments({
            partnerId: providerId,
            status: 'ACTIVE'
        });

        // Get revenue using real calculation
        const revenue = await calculateProviderRevenue(providerId, dateFilter);

        return {
            period,
            totalTrips,
            completedTrips,
            cancelledTrips,
            activeSubscribers,
            totalSeats,
            totalBookedSeats,
            completionRate: totalTrips > 0 ? ((completedTrips / totalTrips) * 100).toFixed(2) : 0,
            utilizationRate: totalSeats > 0 ? ((totalBookedSeats / totalSeats) * 100).toFixed(2) : 0,
            revenue
        };

    } catch (error) {
        console.error("Error getting provider dashboard data:", error);
        return {
            period,
            totalTrips: 0,
            completedTrips: 0,
            cancelledTrips: 0,
            activeSubscribers: 0,
            totalSeats: 0,
            totalBookedSeats: 0,
            completionRate: 0,
            utilizationRate: 0,
            revenue: 0
        };
    }
};

// Helper function to calculate provider revenue
const calculateProviderRevenue = async (providerId, dateFilter) => {
    try {
        // Get all trips in the period
        const trips = await B2CPartnerTrip.find({
            b2cPartnerId: providerId,
            tripDate: dateFilter
        });

        let totalRevenue = 0;

        for (const trip of trips) {
            // Get revenue for this specific trip
            const tripRevenue = await calculateTripRevenue(trip._id);
            totalRevenue += tripRevenue;
        }

        return totalRevenue;

    } catch (error) {
        console.error("Error calculating provider revenue:", error);
        return 0;
    }
};

// Helper function to calculate real trip revenue
const calculateTripRevenue = async (tripId) => {
    try {
        const trip = await B2CPartnerTrip.findById(tripId).populate('routeId');

        if (!trip) return 0;

        // Get monthly pass revenue
        const monthlyPasses = await B2CMonthlyPass.find({
            'monthlyTrips.tripId': tripId,
            status: 'ACTIVE'
        });

        const monthlyRevenue = monthlyPasses.reduce((sum, pass) => {
            return sum + (pass.pricing?.monthlyPrice || 0);
        }, 0);

        // Get one-time booking revenue
        const oneTimeBookings = await B2CPassengerBooking.find({
            tripId,
            status: 'CONFIRMED'
        });

        const oneTimeRevenue = oneTimeBookings.reduce((sum, booking) => {
            return sum + (booking.pricing?.oneWayPrice || 0);
        }, 0);

        return monthlyRevenue + oneTimeRevenue;

    } catch (error) {
        console.error("Error calculating trip revenue:", error);
        return 0;
    }
};

// Get Driver Daily Trips - Route-centric view with all passengers for each trip
// This groups trips by route+schedule+time, showing ALL passengers on each trip
// export const getDriverDailyTrips = async (req, res) => {
//     try {
//         const userId = req.userId;
//         const userRole = req.userRole;
//         const { filter = 'today', page = 1, limit = 50 } = req.query;

//         console.log("[v0] getDriverDailyTrips - userId:", userId, "userRole:", userRole);

//         // Get driver info
//         const driverUser = await User.findById(userId);
//         if (!driverUser) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Driver not found"
//             });
//         }

//         console.log("[v0] Driver user found:", {
//             _id: driverUser._id,
//             role: driverUser.role,
//             driverId: driverUser.driverId,
//             b2cPartnerId: driverUser.b2cPartnerId,
//             fullName: driverUser.fullName
//         });

//         // Get driver ID and b2cPartnerId - driver might be linked via driverId or b2cPartnerId
//         const driverId = driverUser.driverId || userId;
//         const b2cPartnerId = driverUser.b2cPartnerId || null;

//         // Calculate date range based on filter
//         const now = new Date();
//         const todayStart = new Date(now);
//         todayStart.setHours(0, 0, 0, 0);
//         const todayEnd = new Date(now);
//         todayEnd.setHours(23, 59, 59, 999);

//         let dateFilter = {};
//         if (filter === 'today') {
//             dateFilter = { $gte: todayStart, $lte: todayEnd };
//         } else if (filter === 'upcoming') {
//             dateFilter = { $gte: todayStart };
//         } else {
//             // 'all' - no date filter
//             dateFilter = { $gte: new Date('2020-01-01') };
//         }

//         // Get model references
//         const B2CPartnerSchedule = mongoose.model('B2CPartnerSchedule');
//         const B2CPartnerVehicle = mongoose.model('B2CPartnerVehicle');
//         const B2CPartnerDriver = mongoose.model('B2CPartnerDriver');

//         // APPROACH 1: Find trips via bookings assigned to this driver
//         // Get ONLY ACCEPTED/IN_PROGRESS/COMPLETED bookings assigned to this driver
//         // CRITICAL: Do NOT include CONFIRMED (not yet accepted) bookings
//         const bookingQuery = {
//             $or: [
//                 { assignedDriverId: driverId },
//                 { assignedDriverId: userId },
//                 { assignedDriverId: new mongoose.Types.ObjectId(driverId) },
//                 { assignedDriverId: new mongoose.Types.ObjectId(userId) }
//             ],
//             bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
//         };

//         console.log("[v0] Booking query:", JSON.stringify(bookingQuery));

//         const driverBookings = await B2CPassengerBooking.find(bookingQuery).lean();

//         console.log("[v0] Found driver bookings:", driverBookings.length);

//         // Collect all trip IDs from bookings' monthlyTrips array
//         const tripIdsFromBookings = new Set();
//         driverBookings.forEach(booking => {
//             if (booking.monthlyTrips && Array.isArray(booking.monthlyTrips)) {
//                 booking.monthlyTrips.forEach(tripId => {
//                     tripIdsFromBookings.add(tripId.toString());
//                 });
//             }
//         });

//         console.log("[v0] Trip IDs from bookings:", tripIdsFromBookings.size);

//         // APPROACH 2: Find trips via schedules assigned to this driver
//         const scheduleQuery = {
//             $or: [
//                 { assignedDriver: driverId },
//                 { assignedDriver: userId },
//                 { assignedDriver: new mongoose.Types.ObjectId(driverId) },
//                 { assignedDriver: new mongoose.Types.ObjectId(userId) }
//             ],
//             isActive: true
//         };

//         const driverSchedules = await B2CPartnerSchedule.find(scheduleQuery).lean();

//         console.log("[v0] Found driver schedules:", driverSchedules.length);

//         // Get route IDs from schedules
//         const scheduleRouteIds = driverSchedules.map(s => s.routeId);

//         // APPROACH 3: Find trips directly linked via driverId
//         // Build comprehensive query for trips
//         const tripQueryConditions = [
//             // Direct driver assignment on trip (both driverId formats)
//             { driverId: driverId },
//             { driverId: userId },
//             { driverId: new mongoose.Types.ObjectId(driverId) },
//             { driverId: new mongoose.Types.ObjectId(userId) }
//         ];

//         // Add trip IDs from bookings
//         if (tripIdsFromBookings.size > 0) {
//             tripQueryConditions.push({
//                 _id: { $in: Array.from(tripIdsFromBookings).map(id => new mongoose.Types.ObjectId(id)) }
//             });
//         }

//         // Add trips from routes with assigned schedules
//         if (scheduleRouteIds.length > 0) {
//             tripQueryConditions.push({ routeId: { $in: scheduleRouteIds } });
//         }

//         // If this driver is the B2C_PARTNER themselves (self-driver scenario)
//         // they should see trips where they are the b2cPartnerId AND driverId matches their userId
//         if (driverUser.role === 'B2C_PARTNER') {
//             tripQueryConditions.push({ b2cPartnerId: userId });
//         }

//         const tripQuery = {
//             tripDate: dateFilter,
//             $or: tripQueryConditions
//         };

//         console.log("[v0] Trip query conditions count:", tripQueryConditions.length);

//         const trips = await B2CPartnerTrip.find(tripQuery)
//             .sort({ tripDate: 1, startTime: 1 })
//             .skip((parseInt(page) - 1) * parseInt(limit))
//             .limit(parseInt(limit))
//             .lean();

//         // For each trip, get all passengers (from ACCEPTED bookings that reference this trip)
//         const tripsWithPassengers = await Promise.all(
//             trips.map(async (trip) => {
//                 const passengerMap = new Map();

//                 // Find ONLY ACCEPTED/IN_PROGRESS/COMPLETED bookings that have this trip ID in their monthlyTrips array
//                 // CRITICAL: Do NOT include CONFIRMED (not yet accepted) bookings
//                 const bookingsWithThisTrip = await B2CPassengerBooking.find({
//                     monthlyTrips: trip._id,
//                     bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
//                 })
//                     .populate('passengerId', 'fullName email whatsappNumber profileImage')
//                     .lean();

//                 bookingsWithThisTrip.forEach(booking => {
//                     if (booking.passengerId) {
//                         const passengerId = booking.passengerId._id.toString();
//                         if (!passengerMap.has(passengerId)) {
//                             passengerMap.set(passengerId, {
//                                 _id: booking.passengerId._id,
//                                 fullName: booking.passengerId.fullName || booking.passengerName || 'N/A',
//                                 email: booking.passengerId.email,
//                                 phone: booking.passengerId.whatsappNumber,
//                                 profileImage: booking.passengerId.profileImage,
//                                 bookingType: booking.isMonthlyPass ? 'Monthly Pass' : 'One Time',
//                                 seats: booking.numberOfSeats || 1,
//                                 bookingId: booking._id,
//                                 bookingStatus: booking.bookingStatus
//                             });
//                         }
//                     }
//                 });

//                 // NOTE: Removed route-based matching as it causes wrong passengers to appear
//                 // Passengers should only show on trips that are in their monthlyTrips array

//                 const passengers = Array.from(passengerMap.values());
//                 const totalSeatsBooked = passengers.reduce((sum, p) => sum + (p.seats || 1), 0);

//                 // Populate route info
//                 let routeInfo = null;
//                 if (trip.routeId) {
//                     const route = await B2CPartnerRoute.findById(trip.routeId)
//                         .select('fromLocation toLocation routeName')
//                         .lean();
//                     routeInfo = route;
//                 }

//                 // Populate vehicle info
//                 let vehicleInfo = null;
//                 if (trip.vehicleId) {
//                     const vehicle = await B2CPartnerVehicle.findById(trip.vehicleId)
//                         .select('vehicleType model licensePlate seatingCapacity')
//                         .lean();
//                     vehicleInfo = vehicle;
//                 }

//                 return {
//                     _id: trip._id,
//                     tripDate: trip.tripDate,
//                     startTime: trip.startTime,
//                     status: trip.status,
//                     fromLocation: trip.fromLocation || routeInfo?.fromLocation,
//                     toLocation: trip.toLocation || routeInfo?.toLocation,
//                     tripType: trip.tripType,
//                     routeId: trip.routeId,
//                     routeInfo,
//                     vehicleInfo,
//                     totalSeats: trip.totalSeats,
//                     bookedSeats: totalSeatsBooked,
//                     availableSeats: trip.totalSeats - totalSeatsBooked,
//                     passengers,
//                     passengerCount: passengers.length,
//                     actualStartTime: trip.actualStartTime,
//                     actualEndTime: trip.actualEndTime
//                 };
//             })
//         );

//         // Get counts for stats
//         const totalCount = await B2CPartnerTrip.countDocuments(tripQuery);

//         const todayQuery = {
//             ...tripQuery,
//             tripDate: { $gte: todayStart, $lte: todayEnd }
//         };
//         const todayCount = await B2CPartnerTrip.countDocuments(todayQuery);

//         const completedTodayQuery = {
//             ...todayQuery,
//             status: 'Completed'
//         };
//         const completedToday = await B2CPartnerTrip.countDocuments(completedTodayQuery);

//         res.status(200).json({
//             success: true,
//             data: {
//                 trips: tripsWithPassengers,
//                 stats: {
//                     todayTrips: todayCount,
//                     completedToday,
//                     totalTrips: totalCount,
//                     inProgressTrips: tripsWithPassengers.filter(t => t.status === 'In Progress').length
//                 },
//                 pagination: {
//                     currentPage: parseInt(page),
//                     totalPages: Math.ceil(totalCount / parseInt(limit)),
//                     totalTrips: totalCount,
//                     hasNext: parseInt(page) * parseInt(limit) < totalCount,
//                     hasPrev: parseInt(page) > 1
//                 }
//             }
//         });

//     } catch (error) {
//         console.error("Error getting driver daily trips:", error);
//         res.status(500).json({
//             success: false,
//             message: "Error retrieving driver trips",
//             error: error.message
//         });
//     }
// };

// Get Driver Daily Trips - Route-centric view with all passengers for each trip
// This groups trips by route+schedule+time, showing ALL passengers on each trip
export const getDriverDailyTrips = async (req, res) => {
    try {
        const userId = req.userId;
        const { filter = 'today', page = 1, limit = 50 } = req.query;

        // Get driver info
        const driverUser = await User.findById(userId);
        if (!driverUser) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        // Get driver ID - driver might be linked via driverId field
        const driverId = driverUser.driverId || userId;

        console.log("[v0] Driver lookup:", {
            userId: userId?.toString(),
            driverId: driverId?.toString(),
            b2cPartnerId: driverUser.b2cPartnerId?.toString()
        });

        // Calculate date range based on filter
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        let dateFilter = {};
        if (filter === 'today') {
            dateFilter = { $gte: todayStart, $lte: todayEnd };
        } else if (filter === 'upcoming') {
            dateFilter = { $gte: todayStart };
        } else {
            // 'all' - no date filter
            dateFilter = { $gte: new Date('2020-01-01') };
        }

        // Get model references
        const B2CPartnerVehicle = mongoose.model('B2CPartnerVehicle');

        // CRITICAL FIX: Driver should ONLY see trips where they are the DRIVER
        // Not trips via bookings or schedules - only trips where trip.driverId matches
        // This ensures B2C Partner Driver sees only their assigned trips (5:00 AM and 2:00 PM)
        // and NOT trips assigned to the partner owner (4:00 AM and 1:00 PM)
        //
        // IMPORTANT: We don't filter by bookedSeats > 0 anymore because bookedSeats 
        // is incremented on booking creation (CONFIRMED), not on ACCEPTANCE.
        // Instead, we'll filter trips after checking if they have ACCEPTED bookings.

        // Convert IDs to ObjectId for proper comparison
        const driverIdObj = mongoose.Types.ObjectId.isValid(driverId) ? new mongoose.Types.ObjectId(driverId) : driverId;
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

        const tripQuery = {
            tripDate: dateFilter,
            $or: [
                // Direct driver assignment on trip - match both driverId variations
                { driverId: driverIdObj },
                { driverId: userIdObj },
                // Also match string versions for safety
                { driverId: driverId?.toString?.() || driverId },
                { driverId: userId?.toString?.() || userId }
            ]
        };

        console.log("[v0] Trip query for driver:", JSON.stringify({
            tripDate: 'today',
            driverIdObj: driverIdObj?.toString(),
            userIdObj: userIdObj?.toString()
        }));

        const allTrips = await B2CPartnerTrip.find(tripQuery)
            .sort({ tripDate: 1, startTime: 1 })
            .lean();

        // For each trip, get all passengers (from ACCEPTED bookings that reference this trip)
        // Only include trips that have at least one ACCEPTED booking
        const tripsWithPassengers = [];

        for (const trip of allTrips) {
            const passengerMap = new Map();

            // METHOD 1: Find bookings that have this trip ID in their monthlyTrips array
            // This is the ONLY correct method - it shows passengers who booked THIS specific trip
            // CRITICAL: Only show passengers from ACCEPTED bookings - NOT CONFIRMED
            // CONFIRMED bookings are waiting for partner acceptance and should NOT appear in Daily Trips
            const bookingsWithThisTrip = await B2CPassengerBooking.find({
                monthlyTrips: trip._id,
                bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
            })
                .populate('passengerId', 'fullName email whatsappNumber profileImage')
                .lean();

            // CRITICAL: Skip trips with NO accepted bookings
            // This prevents showing trips before bookings are accepted
            if (bookingsWithThisTrip.length === 0) {
                continue;
            }

            bookingsWithThisTrip.forEach(booking => {
                if (booking.passengerId) {
                    const passengerId = booking.passengerId._id.toString();
                    if (!passengerMap.has(passengerId)) {
                        passengerMap.set(passengerId, {
                            _id: booking.passengerId._id,
                            fullName: booking.passengerId.fullName || booking.passengerName || 'N/A',
                            email: booking.passengerId.email,
                            phone: booking.passengerId.whatsappNumber,
                            profileImage: booking.passengerId.profileImage,
                            bookingType: booking.isMonthlyPass ? 'Monthly Pass' : 'One Time',
                            seats: booking.numberOfSeats || 1,
                            bookingId: booking._id
                        });
                    }
                }
            });

            // METHOD 2 and METHOD 3 REMOVED - They used route-based matching which showed 
            // ALL passengers on a route regardless of their specific trip time booking.
            // This caused the bug where every trip showed 2 passengers instead of 1.
            // 
            // The monthlyTrips array in B2CPassengerBooking is the single source of truth
            // for which passengers are on which trips.

            const passengers = Array.from(passengerMap.values());
            const totalSeatsBooked = passengers.reduce((sum, p) => sum + (p.seats || 1), 0);

            // Populate route info
            let routeInfo = null;
            if (trip.routeId) {
                const route = await B2CPartnerRoute.findById(trip.routeId)
                    .select('fromLocation toLocation routeName')
                    .lean();
                routeInfo = route;
            }

            // Populate vehicle info
            let vehicleInfo = null;
            if (trip.vehicleId) {
                const vehicle = await B2CPartnerVehicle.findById(trip.vehicleId)
                    .select('vehicleType model licensePlate seatingCapacity')
                    .lean();
                vehicleInfo = vehicle;
            }

            tripsWithPassengers.push({
                _id: trip._id,
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                status: trip.status,
                fromLocation: trip.fromLocation || routeInfo?.fromLocation,
                toLocation: trip.toLocation || routeInfo?.toLocation,
                tripType: trip.tripType,
                routeId: trip.routeId,
                routeInfo,
                vehicleInfo,
                totalSeats: trip.totalSeats,
                bookedSeats: totalSeatsBooked,
                availableSeats: trip.totalSeats - totalSeatsBooked,
                passengers,
                passengerCount: passengers.length,
                actualStartTime: trip.actualStartTime,
                actualEndTime: trip.actualEndTime
            });
        }

        // Apply pagination after filtering
        const totalCount = tripsWithPassengers.length;
        const paginatedTrips = tripsWithPassengers
            .slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit));

        // Get counts for stats - need to count trips with ACCEPTED bookings for today
        const todayTripIds = allTrips
            .filter(t => {
                const tripDate = new Date(t.tripDate);
                return tripDate >= todayStart && tripDate <= todayEnd;
            })
            .map(t => t._id);

        // Count trips that actually have accepted bookings for today
        let todayCount = 0;
        let completedToday = 0;
        let inProgressCount = 0;

        for (const tripId of todayTripIds) {
            const acceptedBookingCount = await B2CPassengerBooking.countDocuments({
                monthlyTrips: tripId,
                bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
            });
            if (acceptedBookingCount > 0) {
                todayCount++;
                const tripData = allTrips.find(t => t._id.toString() === tripId.toString());
                if (tripData?.status === 'Completed') completedToday++;
                if (tripData?.status === 'In Progress') inProgressCount++;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                trips: paginatedTrips,
                stats: {
                    todayTrips: todayCount,
                    completedToday,
                    totalTrips: totalCount,
                    inProgressTrips: inProgressCount
                },
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalTrips: totalCount,
                    hasNext: parseInt(page) * parseInt(limit) < totalCount,
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting driver daily trips:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving driver trips",
            error: error.message
        });
    }
};

// Start trip and update all related bookings
export const startDriverTrip = async (req, res) => {
    try {
        const { tripId } = req.params;
        const userId = req.userId;
        const userRole = req.userRole;

        console.log("[v0] startDriverTrip - tripId:", tripId, "userId:", userId, "userRole:", userRole);

        // Get user info to check authorization
        const driverUser = await User.findById(userId);
        if (!driverUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const driverId = driverUser.driverId || userId;

        // Find the trip
        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        // Check authorization - verify driver is assigned to this trip or is the B2C Partner
        const isAuthorized =
            trip.driverId?.toString() === driverId?.toString() ||
            trip.driverId?.toString() === userId.toString() ||
            trip.b2cPartnerId?.toString() === userId.toString() ||
            (driverUser.b2cPartnerId && trip.b2cPartnerId?.toString() === driverUser.b2cPartnerId?.toString());

        if (!isAuthorized) {
            console.log("[v0] Unauthorized - trip.driverId:", trip.driverId, "driverId:", driverId, "userId:", userId);
            return res.status(403).json({
                success: false,
                message: "You are not authorized to start this trip"
            });
        }

        console.log("[v0] Starting trip:", tripId, "current status:", trip.status);

        // Update trip status
        trip.status = 'In Progress';
        trip.actualStartTime = new Date();
        await trip.save();

        // Update ONLY bookings that have this trip in their monthlyTrips array
        // CRITICAL: Do NOT use route-based matching as it affects wrong bookings
        const relatedBookings = await B2CPassengerBooking.find({
            $or: [
                { monthlyTrips: tripId },
                { monthlyTrips: new mongoose.Types.ObjectId(tripId) }
            ],
            bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
        });

        console.log("[v0] Found related bookings:", relatedBookings.length);

        // Update each booking's trip status (NOT bookingStatus)
        // CRITICAL FIX: Only update outboundTripStatus/returnTripStatus, NOT bookingStatus
        // bookingStatus should remain as ACCEPTED until trip is completed
        // This is because "trip start" is a trip-level action, not a booking-level action
        for (const booking of relatedBookings) {
            // DO NOT change bookingStatus to IN_PROGRESS - it should remain ACCEPTED
            // Only update trip-specific fields
            booking.startedAt = new Date();
            booking.tripStartedBy = userRole || 'B2C_PARTNER_DRIVER';

            // CRITICAL: Update outboundTripStatus or returnTripStatus based on trip direction
            // Check if this trip is the outbound or return trip for this booking
            const isReturnTrip = (trip.fromLocation === booking.returnPickupLocation ||
                trip.fromLocation === booking.dropoffLocation) &&
                (trip.toLocation === booking.returnDropoffLocation ||
                    trip.toLocation === booking.pickupLocation);

            if (booking.bookingType === 'ROUND_TRIP') {
                if (isReturnTrip) {
                    booking.returnTripStatus = 'IN_PROGRESS';
                    console.log("[v0] Setting returnTripStatus=IN_PROGRESS for booking:", booking._id);
                } else {
                    booking.outboundTripStatus = 'IN_PROGRESS';
                    console.log("[v0] Setting outboundTripStatus=IN_PROGRESS for booking:", booking._id);
                }
            } else {
                // ONE_WAY trip - use outboundTripStatus
                booking.outboundTripStatus = 'IN_PROGRESS';
            }

            await booking.save();

            // Emit socket event to each booking room so passengers can track
            try {
                sendBookingUpdate(booking._id.toString(), 'b2c-trip-started', {
                    bookingId: booking._id,
                    tripId: trip._id,
                    driverId: userId,
                    status: 'IN_PROGRESS',
                    message: 'Your trip has started! You can now track the driver.',
                    tripInfo: {
                        fromLocation: trip.fromLocation,
                        toLocation: trip.toLocation,
                        startTime: trip.startTime
                    }
                });
                console.log(`[v0] Emitted b2c-trip-started to booking ${booking._id}`);
            } catch (socketErr) {
                console.error("[v0] Error emitting trip started socket event:", socketErr);
            }
        }

        // Notify passengers
        await notifyPassengersOfStatusChange(trip, 'In Progress');

        res.status(200).json({
            success: true,
            message: "Trip started successfully",
            data: {
                tripId: trip._id,
                status: trip.status,
                actualStartTime: trip.actualStartTime,
                bookingsUpdated: relatedBookings.length
            }
        });

    } catch (error) {
        console.error("Error starting driver trip:", error);
        res.status(500).json({
            success: false,
            message: "Error starting trip",
            error: error.message
        });
    }
};

// Complete trip and update all related bookings
export const completeDriverTrip = async (req, res) => {
    try {
        const { tripId } = req.params;
        const userId = req.userId;
        const userRole = req.userRole;

        console.log("[v0] completeDriverTrip - tripId:", tripId, "userId:", userId, "userRole:", userRole);

        // Get user info to check authorization
        const driverUser = await User.findById(userId);
        if (!driverUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const driverId = driverUser.driverId || userId;

        // Find the trip
        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        // Check authorization - verify driver is assigned to this trip or is the B2C Partner
        const isAuthorized =
            trip.driverId?.toString() === driverId?.toString() ||
            trip.driverId?.toString() === userId.toString() ||
            trip.b2cPartnerId?.toString() === userId.toString() ||
            (driverUser.b2cPartnerId && trip.b2cPartnerId?.toString() === driverUser.b2cPartnerId?.toString());

        if (!isAuthorized) {
            console.log("[v0] Unauthorized - trip.driverId:", trip.driverId, "driverId:", driverId, "userId:", userId);
            return res.status(403).json({
                success: false,
                message: "You are not authorized to complete this trip"
            });
        }

        console.log("[v0] Completing trip:", tripId, "current status:", trip.status);

        // Update trip status
        trip.status = 'Completed';
        trip.actualEndTime = new Date();
        await trip.save();

        // Update ONLY bookings that have this trip in their monthlyTrips array
        // CRITICAL: Do NOT use route-based matching as it affects wrong bookings
        const relatedBookings = await B2CPassengerBooking.find({
            $or: [
                { monthlyTrips: tripId },
                { monthlyTrips: new mongoose.Types.ObjectId(tripId) }
            ],
            bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
        });

        console.log("[v0] Found related bookings:", relatedBookings.length);

        // Update each booking's trip status (NOT bookingStatus until both trips are done for ROUND_TRIP)
        // CRITICAL: Do NOT use route-based matching as it affects wrong bookings
        for (const booking of relatedBookings) {
            // CRITICAL: For ROUND_TRIP bookings, determine if this is outbound or return trip
            // and only mark booking as COMPLETED when BOTH trips are done
            const isReturnTrip = (trip.fromLocation === booking.returnPickupLocation ||
                trip.fromLocation === booking.dropoffLocation) &&
                (trip.toLocation === booking.returnDropoffLocation ||
                    trip.toLocation === booking.pickupLocation);

            if (booking.bookingType === 'ROUND_TRIP') {
                if (isReturnTrip) {
                    booking.returnTripStatus = 'COMPLETED';
                    console.log("[v0] Setting returnTripStatus=COMPLETED for booking:", booking._id);

                    // Only mark booking COMPLETED if outbound is also done
                    if (booking.outboundTripStatus === 'COMPLETED') {
                        booking.bookingStatus = 'COMPLETED';
                        booking.completedAt = new Date();
                        console.log("[v0] BOTH trips completed - setting bookingStatus=COMPLETED for booking:", booking._id);
                    } else {
                        // Keep booking status as ACCEPTED - outbound not done yet
                        // DO NOT change to IN_PROGRESS or COMPLETED prematurely
                        console.log("[v0] Return trip done but outbound still:", booking.outboundTripStatus);
                    }
                } else {
                    booking.outboundTripStatus = 'COMPLETED';
                    console.log("[v0] Setting outboundTripStatus=COMPLETED for booking:", booking._id);

                    // Only mark booking COMPLETED if return is also done
                    if (booking.returnTripStatus === 'COMPLETED') {
                        booking.bookingStatus = 'COMPLETED';
                        booking.completedAt = new Date();
                        console.log("[v0] BOTH trips completed - setting bookingStatus=COMPLETED for booking:", booking._id);
                    } else {
                        // Keep booking as ACCEPTED - return trip still pending
                        // DO NOT change bookingStatus - passenger still needs to track return trip
                        console.log("[v0] Outbound trip done but return still:", booking.returnTripStatus);
                    }
                }
            } else {
                // ONE_WAY trip - mark everything as completed
                booking.outboundTripStatus = 'COMPLETED';
                booking.bookingStatus = 'COMPLETED';
                booking.completedAt = new Date();
            }

            await booking.save();
        }

        // Update monthly pass trip statuses
        await B2CMonthlyPass.updateMany(
            { 'monthlyTrips.tripId': tripId },
            { $set: { 'monthlyTrips.$.status': 'Completed' } }
        );

        // Check if driver has any more incomplete trips today - if not, mark as offline
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const remainingDriverTrips = await B2CPartnerTrip.countDocuments({
            driverId: driverId,
            tripDate: { $gte: todayStart, $lte: todayEnd },
            status: { $in: ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress', 'STARTED', 'Started'] },
            _id: { $ne: tripId }
        });

        if (remainingDriverTrips === 0) {
            // No more trips today - set driver to offline
            if (driverUser.role === 'B2C_PARTNER') {
                // Self-driver
                driverUser.selfDriverAvailability = driverUser.selfDriverAvailability || {};
                driverUser.selfDriverAvailability.status = 'offline';
                driverUser.selfDriverAvailability.lastUpdate = new Date();
                await driverUser.save();

                broadcastSelfDriverAvailabilityChange(userId, {
                    driverName: driverUser.fullName || 'Self',
                    status: 'offline'
                });
            } else if (driverUser.role === 'B2C_PARTNER_DRIVER') {
                // Update B2CPartnerDriver
                const driver = await B2CPartnerDriver.findByIdAndUpdate(
                    driverId,
                    {
                        $set: {
                            availabilityStatus: 'offline',
                            lastAvailabilityUpdate: new Date()
                        }
                    },
                    { new: true }
                );

                if (driver && driverUser.b2cPartnerId) {
                    broadcastDriverAvailabilityChange(driverUser.b2cPartnerId.toString(), {
                        driverId: driver._id.toString(),
                        driverName: driver.name,
                        availabilityStatus: 'offline',
                        isSelfDriver: false
                    });
                }
            }
            console.log("[v0] Driver has no more trips today - set to offline:", driverId);
        }

        // Check if vehicle has any more incomplete trips today - if not, mark as available
        if (trip.vehicleId) {
            const remainingVehicleTrips = await B2CPartnerTrip.countDocuments({
                vehicleId: trip.vehicleId,
                tripDate: { $gte: todayStart, $lte: todayEnd },
                status: { $in: ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress', 'STARTED', 'Started'] },
                _id: { $ne: tripId }
            });

            if (remainingVehicleTrips === 0) {
                const vehicle = await B2CPartnerVehicle.findByIdAndUpdate(
                    trip.vehicleId,
                    {
                        $set: {
                            availabilityStatus: 'available',
                            lastAvailabilityUpdate: new Date()
                        }
                    },
                    { new: true }
                );

                if (vehicle) {
                    broadcastVehicleAvailabilityChange(trip.b2cPartnerId?.toString(), {
                        vehicleId: vehicle._id.toString(),
                        vehicleModel: vehicle.model,
                        licensePlate: vehicle.licensePlate,
                        availabilityStatus: 'available',
                        status: vehicle.status
                    });
                    console.log("[v0] Vehicle has no more trips today - set to available:", trip.vehicleId);
                }
            }
        }

        // Notify passengers
        await notifyPassengersOfStatusChange(trip, 'Completed');

        res.status(200).json({
            success: true,
            message: "Trip completed successfully",
            data: {
                tripId: trip._id,
                status: trip.status,
                actualEndTime: trip.actualEndTime,
                bookingsUpdated: relatedBookings.length
            }
        });

    } catch (error) {
        console.error("Error completing driver trip:", error);
        res.status(500).json({
            success: false,
            message: "Error completing trip",
            error: error.message
        });
    }
};

// Helper function to notify passengers of trip status changes
const notifyPassengersOfStatusChange = async (trip, status) => {
    try {
        // Get passengers via bookings that have this trip in their monthlyTrips array
        const bookingsWithTrip = await B2CPassengerBooking.find({
            $or: [
                { monthlyTrips: trip._id },
                { monthlyTrips: new mongoose.Types.ObjectId(trip._id) },
                { routeId: trip.routeId }
            ],
            bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS', 'CONFIRMED'] }
        }).populate('passengerId', 'email fullName whatsappNumber');

        // Get passengers from monthly passes for this route
        const monthlyPasses = await B2CMonthlyPass.find({
            routeId: trip.routeId,
            status: 'ACTIVE'
        }).populate('passengerId', 'email fullName whatsappNumber');

        // Track notified user IDs to avoid duplicates
        const notifiedUserIds = new Set();

        // Determine notification type and message based on status
        const statusLower = status.toLowerCase();
        let notificationType = 'TRIP_STATUS_UPDATE';
        let notificationTitle = 'Trip Status Update';
        let notificationMessage = `Your trip from ${trip.fromLocation || 'pickup'} to ${trip.toLocation || 'destination'} status has been updated to ${status}.`;

        if (statusLower === 'in progress' || statusLower === 'started') {
            notificationType = 'TRIP_STARTED';
            notificationTitle = 'Trip Started!';
            notificationMessage = `Your trip from ${trip.fromLocation || 'pickup'} to ${trip.toLocation || 'destination'} has started. The driver is on the way!`;
        } else if (statusLower === 'completed') {
            notificationType = 'TRIP_COMPLETED';
            notificationTitle = 'Trip Completed!';
            notificationMessage = `Your trip from ${trip.fromLocation || 'pickup'} to ${trip.toLocation || 'destination'} has been completed. Thank you for traveling with us!`;
        } else if (statusLower === 'cancelled') {
            notificationType = 'TRIP_CANCELLED';
            notificationTitle = 'Trip Cancelled';
            notificationMessage = `Your trip from ${trip.fromLocation || 'pickup'} to ${trip.toLocation || 'destination'} has been cancelled. ${trip.cancellationReason || ''}`;
        } else if (statusLower === 'delayed') {
            notificationType = 'TRIP_DELAYED';
            notificationTitle = 'Trip Delayed';
            notificationMessage = `Your trip from ${trip.fromLocation || 'pickup'} to ${trip.toLocation || 'destination'} has been delayed. ${trip.delayReason || 'Please check for updates.'}`;
        }

        // Send notifications to passengers from bookings
        for (const booking of bookingsWithTrip) {
            if (booking.passengerId && booking.passengerId._id) {
                const passengerId = booking.passengerId._id.toString();

                if (!notifiedUserIds.has(passengerId)) {
                    notifiedUserIds.add(passengerId);

                    const notificationData = {
                        tripId: trip._id,
                        routeId: trip.routeId,
                        bookingId: booking._id,
                        fromLocation: trip.fromLocation || '',
                        toLocation: trip.toLocation || '',
                        tripDate: trip.tripDate,
                        tripTime: trip.startTime,
                        newStatus: status,
                        driverInfo: trip.driverInfo || {},
                        vehicleInfo: trip.vehicleInfo || {}
                    };

                    // Send real-time socket notification
                    try {
                        sendRealTimeNotification(booking.passengerId._id, {
                            type: notificationType,
                            title: notificationTitle,
                            message: notificationMessage,
                            data: notificationData,
                            createdAt: new Date().toISOString()
                        });
                        console.log(`[v0] Real-time notification sent to passenger ${passengerId} for trip ${trip._id}`);
                    } catch (socketErr) {
                        console.error("[v0] Error sending socket notification:", socketErr);
                    }

                    // Create persistent notification in database
                    try {
                        await createNotification({
                            userId: booking.passengerId._id,
                            type: notificationType,
                            title: notificationTitle,
                            message: notificationMessage,
                            data: notificationData,
                            skipAdminBroadcast: true
                        });
                    } catch (notifErr) {
                        console.error("[v0] Error creating notification:", notifErr);
                    }

                    // Send email notification
                    if (booking.passengerId.email) {
                        try {
                            await sendEmail({
                                to: booking.passengerId.email,
                                subject: `${notificationTitle}: ${trip.fromLocation || ''} to ${trip.toLocation || ''}`,
                                template: "tripStatusUpdate",
                                data: {
                                    passengerName: booking.passengerId.fullName || 'Valued Customer',
                                    route: `${trip.fromLocation || 'Pickup'} to ${trip.toLocation || 'Destination'}`,
                                    tripDate: trip.tripDate,
                                    tripTime: trip.startTime,
                                    newStatus: status,
                                    reason: trip.cancellationReason || trip.delayReason || ''
                                }
                            });
                        } catch (emailErr) {
                            console.error("[v0] Error sending trip status email:", emailErr);
                        }
                    }
                }
            }
        }

        // Send notifications to monthly pass passengers
        for (const pass of monthlyPasses) {
            if (pass.passengerId && pass.passengerId._id) {
                const passengerId = pass.passengerId._id.toString();

                if (!notifiedUserIds.has(passengerId)) {
                    notifiedUserIds.add(passengerId);

                    const notificationData = {
                        tripId: trip._id,
                        routeId: trip.routeId,
                        monthlyPassId: pass._id,
                        fromLocation: trip.fromLocation || '',
                        toLocation: trip.toLocation || '',
                        tripDate: trip.tripDate,
                        tripTime: trip.startTime,
                        newStatus: status,
                        driverInfo: trip.driverInfo || {},
                        vehicleInfo: trip.vehicleInfo || {}
                    };

                    // Send real-time socket notification
                    try {
                        sendRealTimeNotification(pass.passengerId._id, {
                            type: notificationType,
                            title: notificationTitle,
                            message: notificationMessage,
                            data: notificationData,
                            createdAt: new Date().toISOString()
                        });
                        console.log(`[v0] Real-time notification sent to monthly pass holder ${passengerId} for trip ${trip._id}`);
                    } catch (socketErr) {
                        console.error("[v0] Error sending socket notification:", socketErr);
                    }

                    // Create persistent notification in database
                    try {
                        await createNotification({
                            userId: pass.passengerId._id,
                            type: notificationType,
                            title: notificationTitle,
                            message: notificationMessage,
                            data: notificationData,
                            skipAdminBroadcast: true
                        });
                    } catch (notifErr) {
                        console.error("[v0] Error creating notification:", notifErr);
                    }

                    // Send email notification
                    if (pass.passengerId.email) {
                        try {
                            await sendEmail({
                                to: pass.passengerId.email,
                                subject: `${notificationTitle}: ${trip.fromLocation || ''} to ${trip.toLocation || ''}`,
                                template: "tripStatusUpdate",
                                data: {
                                    passengerName: pass.passengerId.fullName || 'Valued Customer',
                                    route: `${trip.fromLocation || 'Pickup'} to ${trip.toLocation || 'Destination'}`,
                                    tripDate: trip.tripDate,
                                    tripTime: trip.startTime,
                                    newStatus: status,
                                    reason: trip.cancellationReason || trip.delayReason || ''
                                }
                            });
                        } catch (emailErr) {
                            console.error("[v0] Error sending trip status email:", emailErr);
                        }
                    }
                }
            }
        }

        console.log(`[v0] Trip status notifications sent to ${notifiedUserIds.size} passengers for trip ${trip._id}, status: ${status}`);
    } catch (error) {
        console.error("[v0] Error notifying passengers of status change:", error);
    }
};


// Get B2C Partner Self-Driver Trips - For B2C_PARTNER who is driving themselves
// Shows trips where isSelfDriver is true on bookings OR where driverId matches the b2cPartnerId
// IMPORTANT: Only shows trips for ACCEPTED/IN_PROGRESS/COMPLETED bookings
export const getPartnerSelfDriverTrips = async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        const { filter = 'today', page = 1, limit = 50 } = req.query;

        console.log("[v0] getPartnerSelfDriverTrips - userId:", userId, "filter:", filter);

        // Only B2C_PARTNER can access this endpoint
        if (userRole !== 'B2C_PARTNER') {
            return res.status(403).json({
                success: false,
                message: "Only B2C Partners can access self-driver trips"
            });
        }

        // Get partner info
        const partnerUser = await User.findById(userId);
        if (!partnerUser) {
            return res.status(404).json({
                success: false,
                message: "Partner not found"
            });
        }

        // Calculate date range based on filter
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        let dateFilter = {};
        if (filter === 'today') {
            dateFilter = { $gte: todayStart, $lte: todayEnd };
        } else if (filter === 'upcoming') {
            dateFilter = { $gte: todayStart };
        } else {
            // 'all' - no date filter
            dateFilter = { $gte: new Date('2020-01-01') };
        }

        // Get model references
        const B2CPartnerVehicle = mongoose.model('B2CPartnerVehicle');

        // CRITICAL FIX: Partner should ONLY see trips where they are the DRIVER
        // Not just trips from their bookings - only trips where trip.driverId === partner's userId
        // This ensures B2C Partner sees only self-driving trips (4:00 AM and 1:00 PM)
        // and NOT trips assigned to their employed drivers (5:00 AM and 2:00 PM)
        // 
        // IMPORTANT: We don't filter by bookedSeats > 0 anymore because bookedSeats 
        // is incremented on booking creation (CONFIRMED), not on ACCEPTANCE.
        // Instead, we'll filter trips after checking if they have ACCEPTED bookings.
        const tripQuery = {
            tripDate: dateFilter,
            driverId: new mongoose.Types.ObjectId(userId)  // ONLY trips where this user is the driver
        };

        const allTrips = await B2CPartnerTrip.find(tripQuery)
            .sort({ tripDate: 1, startTime: 1 })
            .lean();

        // For each trip, get passengers ONLY from ACCEPTED bookings
        // CRITICAL: Do not include passengers from CONFIRMED (not yet accepted) bookings
        // Only include trips that have at least one ACCEPTED booking
        const tripsWithPassengers = [];

        for (const trip of allTrips) {
            const passengerMap = new Map();

            // Find ONLY ACCEPTED/IN_PROGRESS/COMPLETED bookings that have this trip in their monthlyTrips array
            // Do NOT use route matching as it causes wrong passengers to show
            // CRITICAL: CONFIRMED bookings are NOT included - they are waiting for partner acceptance
            const bookingsWithThisTrip = await B2CPassengerBooking.find({
                monthlyTrips: trip._id,
                bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
            })
                .populate('passengerId', 'fullName email whatsappNumber profileImage')
                .lean();

            // CRITICAL: Skip trips with NO accepted bookings
            // This prevents showing trips before bookings are accepted
            if (bookingsWithThisTrip.length === 0) {
                continue;
            }

            bookingsWithThisTrip.forEach(booking => {
                if (booking.passengerId) {
                    const passengerId = booking.passengerId._id.toString();
                    if (!passengerMap.has(passengerId)) {
                        passengerMap.set(passengerId, {
                            _id: booking.passengerId._id,
                            fullName: booking.passengerId.fullName || booking.passengerName || 'N/A',
                            email: booking.passengerId.email,
                            phone: booking.passengerId.whatsappNumber,
                            profileImage: booking.passengerId.profileImage,
                            bookingType: booking.isMonthlyPass ? 'Monthly Pass' : 'One Time',
                            seats: booking.numberOfSeats || 1,
                            bookingId: booking._id,
                            bookingStatus: booking.bookingStatus
                        });
                    }
                }
            });

            // NOTE: Removed route-based monthly pass matching as it causes duplicate/wrong passengers
            // Passengers should only show up on trips that are explicitly in their monthlyTrips array

            const passengers = Array.from(passengerMap.values());
            const totalSeatsBooked = passengers.reduce((sum, p) => sum + (p.seats || 1), 0);

            // Populate route info
            let routeInfo = null;
            if (trip.routeId) {
                const route = await B2CPartnerRoute.findById(trip.routeId)
                    .select('fromLocation toLocation routeName')
                    .lean();
                routeInfo = route;
            }

            // Populate vehicle info
            let vehicleInfo = null;
            if (trip.vehicleId) {
                const vehicle = await B2CPartnerVehicle.findById(trip.vehicleId)
                    .select('vehicleType model licensePlate seatingCapacity')
                    .lean();
                vehicleInfo = vehicle;
            }

            tripsWithPassengers.push({
                _id: trip._id,
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                status: trip.status || 'Scheduled',
                fromLocation: trip.fromLocation || routeInfo?.fromLocation,
                toLocation: trip.toLocation || routeInfo?.toLocation,
                tripType: trip.tripType,
                routeId: trip.routeId,
                routeInfo,
                vehicleInfo,
                totalSeats: trip.totalSeats || 7,
                bookedSeats: totalSeatsBooked,
                availableSeats: (trip.totalSeats || 7) - totalSeatsBooked,
                passengers,
                passengerCount: passengers.length,
                actualStartTime: trip.actualStartTime,
                actualEndTime: trip.actualEndTime,
                isSelfDriver: true
            });
        }

        // Apply pagination after filtering
        const totalCount = tripsWithPassengers.length;
        const paginatedTrips = tripsWithPassengers
            .slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit));

        // Get counts for stats - need to count trips with ACCEPTED bookings for today
        const todayTripIds = allTrips
            .filter(t => {
                const tripDate = new Date(t.tripDate);
                return tripDate >= todayStart && tripDate <= todayEnd;
            })
            .map(t => t._id);

        // Count trips that actually have accepted bookings for today
        let todayCount = 0;
        let completedToday = 0;
        let inProgressCount = 0;

        for (const tripId of todayTripIds) {
            const acceptedBookingCount = await B2CPassengerBooking.countDocuments({
                monthlyTrips: tripId,
                bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
            });
            if (acceptedBookingCount > 0) {
                todayCount++;
                const tripData = allTrips.find(t => t._id.toString() === tripId.toString());
                if (tripData?.status === 'Completed') completedToday++;
                if (tripData?.status === 'In Progress') inProgressCount++;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                trips: paginatedTrips,
                stats: {
                    todayTrips: todayCount,
                    completedToday,
                    totalTrips: totalCount,
                    inProgressTrips: inProgressCount
                },
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalTrips: totalCount,
                    hasNext: parseInt(page) * parseInt(limit) < totalCount,
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting partner self-driver trips:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving self-driver trips",
            error: error.message
        });
    }
};

// Start trip for B2C Partner (self-driver)
export const startPartnerTrip = async (req, res) => {
    try {
        const { tripId } = req.params;
        const userId = req.userId;
        const userRole = req.userRole;

        // Only B2C_PARTNER can start their own trips
        if (userRole !== 'B2C_PARTNER') {
            return res.status(403).json({
                success: false,
                message: "Only B2C Partners can start self-driver trips"
            });
        }

        // Find the trip
        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        // Verify trip belongs to this partner
        if (trip.b2cPartnerId?.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to start this trip"
            });
        }

        // Update trip status
        trip.status = 'In Progress';
        trip.actualStartTime = new Date();
        await trip.save();

        console.log("[v0] Trip started - tripId:", tripId, "userId:", userId);

        // ENHANCEMENT: Set driver/partner to busy when trip starts
        const user = await User.findById(userId);
        if (user && user.role === 'B2C_PARTNER') {
            if (!user.selfDriverAvailability) {
                user.selfDriverAvailability = {};
            }
            user.selfDriverAvailability.status = 'busy';
            user.selfDriverAvailability.lastUpdate = new Date();
            await user.save();

            // Broadcast self-driver availability change
            broadcastSelfDriverAvailabilityChange(userId, {
                driverName: user.fullName || 'Self',
                status: 'busy'
            });
            console.log("[v0] Self-driver set to busy on trip start:", userId);
        }

        // ENHANCEMENT: Set vehicle to busy when trip starts
        if (trip.vehicleId) {
            const vehicle = await B2CPartnerVehicle.findByIdAndUpdate(
                trip.vehicleId,
                {
                    $set: {
                        availabilityStatus: 'busy',
                        lastAvailabilityUpdate: new Date()
                    }
                },
                { new: true }
            );

            if (vehicle) {
                broadcastVehicleAvailabilityChange(trip.b2cPartnerId?.toString(), {
                    vehicleId: vehicle._id.toString(),
                    vehicleModel: vehicle.model,
                    licensePlate: vehicle.licensePlate,
                    availabilityStatus: 'busy',
                    status: vehicle.status
                });
                console.log("[v0] Vehicle set to busy on trip start:", trip.vehicleId);
            }
        }

        // Update ONLY bookings that have this trip in their monthlyTrips array
        // CRITICAL: Do NOT use route-based matching as it affects wrong bookings
        const relatedBookings = await B2CPassengerBooking.find({
            $or: [
                { monthlyTrips: tripId },
                { monthlyTrips: new mongoose.Types.ObjectId(tripId) }
            ],
            bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
        }).populate('passengerId', '_id fullName');

        console.log("[v0] Found", relatedBookings.length, "related bookings to update");

        for (const booking of relatedBookings) {
            // CRITICAL FIX: Do NOT change bookingStatus to IN_PROGRESS when trip starts
            // bookingStatus should remain as ACCEPTED - only trip-level statuses should change
            // Only update startedAt timestamp and trip-level statuses
            booking.startedAt = new Date();
            booking.tripStartedBy = 'B2C_PARTNER';

            // CRITICAL: Update outboundTripStatus or returnTripStatus based on trip direction
            const isReturnTrip = (trip.fromLocation === booking.returnPickupLocation ||
                trip.fromLocation === booking.dropoffLocation) &&
                (trip.toLocation === booking.returnDropoffLocation ||
                    trip.toLocation === booking.pickupLocation);

            if (booking.bookingType === 'ROUND_TRIP') {
                if (isReturnTrip) {
                    booking.returnTripStatus = 'IN_PROGRESS';
                    console.log("[v0] Setting returnTripStatus=IN_PROGRESS for booking:", booking._id);
                } else {
                    booking.outboundTripStatus = 'IN_PROGRESS';
                    console.log("[v0] Setting outboundTripStatus=IN_PROGRESS for booking:", booking._id);
                }
            } else {
                booking.outboundTripStatus = 'IN_PROGRESS';
            }

            await booking.save();

            // Emit socket event to each booking room so passengers can track
            try {
                sendBookingUpdate(booking._id.toString(), 'b2c-trip-started', {
                    bookingId: booking._id,
                    tripId: trip._id,
                    driverId: userId,
                    status: 'IN_PROGRESS',
                    message: 'Your trip has started! You can now track the driver.',
                    tripInfo: {
                        fromLocation: trip.fromLocation,
                        toLocation: trip.toLocation,
                        startTime: trip.startTime
                    }
                });
                console.log(`[v0] Emitted b2c-trip-started to booking ${booking._id} (self-driver)`);

                // Also send a real-time notification to the passenger
                if (booking.passengerId?._id) {
                    sendRealTimeNotification(booking.passengerId._id.toString(), {
                        type: "TRIP_STARTED",
                        title: "Trip Started",
                        message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} has started. You can now track the driver.`,
                        data: {
                            bookingId: booking._id,
                            tripId: trip._id,
                            driverId: userId,
                            isSelfDriver: true
                        }
                    });
                }
            } catch (socketErr) {
                console.error("[v0] Error emitting trip started socket event:", socketErr);
            }
        }

        // Notify passengers
        await notifyPassengersOfStatusChange(trip, 'In Progress');

        res.status(200).json({
            success: true,
            message: "Trip started successfully",
            data: {
                tripId: trip._id,
                status: trip.status,
                actualStartTime: trip.actualStartTime,
                bookingsUpdated: relatedBookings.length,
                isSelfDriver: true
            }
        });

    } catch (error) {
        console.error("Error starting partner trip:", error);
        res.status(500).json({
            success: false,
            message: "Error starting trip",
            error: error.message
        });
    }
};

// Complete trip for B2C Partner (self-driver)
export const completePartnerTrip = async (req, res) => {
    try {
        const { tripId } = req.params;
        const userId = req.userId;
        const userRole = req.userRole;

        // Only B2C_PARTNER can complete their own trips
        if (userRole !== 'B2C_PARTNER') {
            return res.status(403).json({
                success: false,
                message: "Only B2C Partners can complete self-driver trips"
            });
        }

        // Find the trip
        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        // Verify trip belongs to this partner
        if (trip.b2cPartnerId?.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to complete this trip"
            });
        }

        // Update trip status
        trip.status = 'Completed';
        trip.actualEndTime = new Date();
        await trip.save();

        // Update ONLY bookings that have this trip in their monthlyTrips array
        // CRITICAL: Do NOT use route-based matching as it affects wrong bookings
        const relatedBookings = await B2CPassengerBooking.find({
            $or: [
                { monthlyTrips: tripId },
                { monthlyTrips: new mongoose.Types.ObjectId(tripId) }
            ],
            bookingStatus: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
        });

        for (const booking of relatedBookings) {
            // CRITICAL: For ROUND_TRIP bookings, determine if this is outbound or return trip
            const isReturnTrip = (trip.fromLocation === booking.returnPickupLocation ||
                trip.fromLocation === booking.dropoffLocation) &&
                (trip.toLocation === booking.returnDropoffLocation ||
                    trip.toLocation === booking.pickupLocation);

            if (booking.bookingType === 'ROUND_TRIP') {
                if (isReturnTrip) {
                    booking.returnTripStatus = 'COMPLETED';
                    console.log("[v0] Setting returnTripStatus=COMPLETED for booking:", booking._id);

                    if (booking.outboundTripStatus === 'COMPLETED') {
                        booking.bookingStatus = 'COMPLETED';
                        booking.completedAt = new Date();
                        console.log("[v0] BOTH trips completed - setting bookingStatus=COMPLETED for booking:", booking._id);
                    } else {
                        // CRITICAL FIX: Keep booking as ACCEPTED - outbound not done yet
                        // DO NOT mark booking as COMPLETED prematurely
                        console.log("[v0] Return trip done but outbound still:", booking.outboundTripStatus, "- keeping booking as ACCEPTED");
                    }
                } else {
                    booking.outboundTripStatus = 'COMPLETED';
                    console.log("[v0] Setting outboundTripStatus=COMPLETED for booking:", booking._id);

                    if (booking.returnTripStatus === 'COMPLETED') {
                        booking.bookingStatus = 'COMPLETED';
                        booking.completedAt = new Date();
                        console.log("[v0] BOTH trips completed - setting bookingStatus=COMPLETED for booking:", booking._id);
                    } else {
                        // CRITICAL FIX: Keep booking as ACCEPTED - return trip still pending
                        // DO NOT mark booking as COMPLETED prematurely
                        // Passenger still needs to track the return trip later
                        console.log("[v0] Outbound trip done but return still:", booking.returnTripStatus, "- keeping booking as ACCEPTED");
                    }
                }
            } else {
                booking.outboundTripStatus = 'COMPLETED';
                booking.bookingStatus = 'COMPLETED';
                booking.completedAt = new Date();
            }

            await booking.save();
        }

        // Update monthly pass trip statuses
        await B2CMonthlyPass.updateMany(
            { 'monthlyTrips.tripId': tripId },
            { $set: { 'monthlyTrips.$.status': 'Completed' } }
        );

        // ENHANCED: Check driver availability after trip completion
        // Driver should be set to:
        // - 'offline' if no more trips today (all done)
        // - 'available' if there are still scheduled trips later (between trips window)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const remainingDriverTrips = await B2CPartnerTrip.find({
            driverId: trip.driverId,
            tripDate: { $gte: todayStart, $lte: todayEnd },
            status: { $in: ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress', 'STARTED', 'Started'] },
            _id: { $ne: tripId }
        }).sort({ startTime: 1 });

        // Helper to convert time to 24h format
        const convertDriverTo24h = (timeStr) => {
            if (!timeStr) return '23:59';
            const cleanTime = timeStr.replace(/\s*(AM|PM)/gi, (match, p1) => p1.toUpperCase()).trim();
            const parts = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (!parts) return '23:59';
            let hour = parseInt(parts[1]);
            const min = parts[2];
            const meridian = parts[3]?.toUpperCase();
            if (meridian === 'PM' && hour < 12) hour += 12;
            if (meridian === 'AM' && hour === 12) hour = 0;
            return `${String(hour).padStart(2, '0')}:${min}`;
        };

        const nowTime = new Date();
        const driverCurrentHours = String(nowTime.getHours()).padStart(2, '0');
        const driverCurrentMinutes = String(nowTime.getMinutes()).padStart(2, '0');
        const driverCurrentTimeStr = `${driverCurrentHours}:${driverCurrentMinutes}`;

        // Find next scheduled trip for this driver
        const nextDriverTrip = remainingDriverTrips.find(t => {
            const tripTime24h = convertDriverTo24h(t.startTime);
            return tripTime24h > driverCurrentTimeStr && ['SCHEDULED', 'Scheduled'].includes(t.status);
        });

        // Check for any in-progress trip
        const driverInProgressTrip = remainingDriverTrips.find(t =>
            ['IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
        );

        const user = await User.findById(userId);
        if (user) {
            let newStatus = 'offline';

            if (driverInProgressTrip) {
                // Still have in-progress trip - stay busy
                newStatus = 'busy';
            } else if (nextDriverTrip) {
                // Have upcoming scheduled trip - can be available until then
                newStatus = 'available';
            } else {
                // No more trips today - set to offline
                newStatus = 'offline';
            }

            user.selfDriverAvailability = user.selfDriverAvailability || {};
            user.selfDriverAvailability.status = newStatus;
            user.selfDriverAvailability.lastUpdate = new Date();
            await user.save();

            // Broadcast self-driver availability change
            broadcastSelfDriverAvailabilityChange(userId, {
                driverName: user.fullName || 'Self',
                status: newStatus
            });
            console.log("[v0] Self-driver status after trip completion:", newStatus, "userId:", userId);
        }

        // ENHANCED: Check if vehicle has any more incomplete trips today
        // Vehicle should be marked as available if:
        // 1. No more trips today, OR
        // 2. There's a gap before the next scheduled trip (between trips availability)
        if (trip.vehicleId) {
            const remainingVehicleTrips = await B2CPartnerTrip.find({
                vehicleId: trip.vehicleId,
                tripDate: { $gte: todayStart, $lte: todayEnd },
                status: { $in: ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress', 'STARTED', 'Started'] },
                _id: { $ne: tripId }
            }).sort({ startTime: 1 });

            // Helper to convert time to 24h format
            const convertTo24h = (timeStr) => {
                if (!timeStr) return '23:59';
                const cleanTime = timeStr.replace(/\s*(AM|PM)/gi, (match, p1) => p1.toUpperCase()).trim();
                const parts = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
                if (!parts) return '23:59';
                let hour = parseInt(parts[1]);
                const min = parts[2];
                const meridian = parts[3]?.toUpperCase();
                if (meridian === 'PM' && hour < 12) hour += 12;
                if (meridian === 'AM' && hour === 12) hour = 0;
                return `${String(hour).padStart(2, '0')}:${min}`;
            };

            const now = new Date();
            const currentHours = String(now.getHours()).padStart(2, '0');
            const currentMinutes = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}`;

            // Find next scheduled trip for this vehicle
            const nextVehicleTrip = remainingVehicleTrips.find(t => {
                const tripTime24h = convertTo24h(t.startTime);
                return tripTime24h > currentTimeStr && ['SCHEDULED', 'Scheduled'].includes(t.status);
            });

            // Check for any in-progress trip
            const vehicleInProgressTrip = remainingVehicleTrips.find(t =>
                ['IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
            );

            // Set vehicle available if:
            // - No trips remaining (all done for today), OR
            // - No in-progress trip AND next trip is in the future (between trips)
            const shouldBeAvailable = remainingVehicleTrips.length === 0 ||
                (!vehicleInProgressTrip && nextVehicleTrip);

            if (shouldBeAvailable) {
                const vehicle = await B2CPartnerVehicle.findByIdAndUpdate(
                    trip.vehicleId,
                    {
                        $set: {
                            availabilityStatus: 'available',
                            lastAvailabilityUpdate: new Date()
                        }
                    },
                    { new: true }
                );

                if (vehicle) {
                    // Broadcast vehicle availability change
                    broadcastVehicleAvailabilityChange(trip.b2cPartnerId?.toString(), {
                        vehicleId: vehicle._id.toString(),
                        vehicleModel: vehicle.model,
                        licensePlate: vehicle.licensePlate,
                        availabilityStatus: 'available',
                        status: vehicle.status
                    });
                    console.log("[v0] Vehicle set to available (between trips or all done):", trip.vehicleId);
                }
            }
        }

        // Notify passengers
        await notifyPassengersOfStatusChange(trip, 'Completed');

        res.status(200).json({
            success: true,
            message: "Trip completed successfully",
            data: {
                tripId: trip._id,
                status: trip.status,
                actualEndTime: trip.actualEndTime,
                bookingsUpdated: relatedBookings.length
            }
        });

    } catch (error) {
        console.error("Error completing partner trip:", error);
        res.status(500).json({
            success: false,
            message: "Error completing trip",
            error: error.message
        });
    }
};

// Update B2C Driver Location - Updates trip location and broadcasts to passengers
export const updateB2CDriverLocation = async (req, res) => {
    try {
        const userId = req.userId;
        const { latitude, longitude, address, tripId } = req.body;

        // Parse and validate latitude/longitude as numbers
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({
                success: false,
                message: "Valid latitude and longitude are required"
            });
        }

        console.log("[v0] updateB2CDriverLocation - userId:", userId, "tripId:", tripId, "lat:", lat, "lng:", lng);

        // Get user info
        const driverUser = await User.findById(userId);
        if (!driverUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const driverId = driverUser.driverId || userId;
        const isSelfDriver = driverUser.role === 'B2C_PARTNER';

        console.log("[v0] Driver info - driverId:", driverId, "isSelfDriver:", isSelfDriver, "role:", driverUser.role);

        // Find the active trip - prioritize In Progress over Scheduled
        let trip = null;
        if (tripId) {
            trip = await B2CPartnerTrip.findById(tripId);
        } else {
            // Find active trip for this driver - include b2cPartnerId for self-drivers
            // First try to find In Progress trip (most relevant for location updates)
            trip = await B2CPartnerTrip.findOne({
                $or: [
                    { driverId: driverId },
                    { driverId: userId },
                    { b2cPartnerId: userId }  // Important for self-driving partners
                ],
                status: 'In Progress'
            }).sort({ actualStartTime: -1 });  // Get most recently started

            // If no In Progress trip, try Scheduled
            if (!trip) {
                trip = await B2CPartnerTrip.findOne({
                    $or: [
                        { driverId: driverId },
                        { driverId: userId },
                        { b2cPartnerId: userId }
                    ],
                    status: 'Scheduled'
                }).sort({ tripDate: 1, startTime: 1 });  // Get soonest scheduled
            }
        }

        console.log("[v0] Found trip:", trip ? trip._id : "none", "status:", trip?.status);

        if (trip) {
            // Update the trip's currentLocation with parsed values
            trip.currentLocation = {
                latitude: lat,
                longitude: lng,
                address: address || '',
                lastUpdated: new Date()
            };


            // Also add to locationHistory for tracking
            if (!trip.locationHistory) {
                trip.locationHistory = [];
            }
            trip.locationHistory.push({
                latitude: lat,
                longitude: lng,
                timestamp: new Date()
            });
            // Keep only the last 100 location entries to prevent unbounded growth
            if (trip.locationHistory.length > 100) {
                trip.locationHistory = trip.locationHistory.slice(-100);
            }
            await trip.save();
            console.log("[v0] Updated trip currentLocation:", trip._id, "lat:", lat, "lng:", lng);

            // Find all related bookings and broadcast location to their rooms
            const relatedBookings = await B2CPassengerBooking.find({
                $or: [
                    { monthlyTrips: trip._id },
                    { monthlyTrips: new mongoose.Types.ObjectId(trip._id) },
                    {
                        routeId: trip.routeId,
                        bookingStatus: { $in: ['CONFIRMED', 'ACCEPTED', 'IN_PROGRESS'] }
                    }
                ]
            }).populate('passengerId', '_id');

            console.log("[v0] Broadcasting location to", relatedBookings.length, "bookings");

            // Broadcast location to each booking room
            for (const booking of relatedBookings) {
                try {
                    // Send via socket service to booking room
                    sendLocationUpdate(booking._id.toString(), {
                        driverId: userId,
                        location: { lat: lat, lng: lng },
                        address: address || '',
                        timestamp: new Date().toISOString(),
                        tripId: trip._id,
                        bookingId: booking._id
                    });
                    console.log("[v0] Sent location update to booking room:", booking._id);

                    // Also send notification to passenger directly for real-time updates
                    if (booking.passengerId?._id) {
                        sendRealTimeNotification(booking.passengerId._id.toString(), {
                            type: "LOCATION_UPDATE",
                            title: "Driver Location Update",
                            message: "Driver location updated",
                            data: {
                                driverId: userId,
                                location: { lat: lat, lng: lng },
                                tripId: trip._id,
                                bookingId: booking._id,
                                timestamp: new Date().toISOString()
                            }
                        });
                    }
                } catch (socketErr) {
                    console.error("[v0] Error broadcasting location to booking:", booking._id, socketErr);
                }
            }
        }

        res.status(200).json({
            success: true,
            message: "Location updated successfully",
            data: {
                tripId: trip?._id,
                location: { latitude: lat, longitude: lng, address },
                lastUpdated: new Date(),
                broadcastedToBookings: trip ? true : false
            }
        });

    } catch (error) {
        console.error("Error updating B2C driver location:", error);
        res.status(500).json({
            success: false,
            message: "Error updating location",
            error: error.message
        });
    }
};

// Get active trip for B2C driver (both partner self-driver and partner driver)
export const getActiveB2CTrip = async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.userRole;

        console.log("[v0] getActiveB2CTrip - userId:", userId, "userRole:", userRole);

        // Get user info
        const driverUser = await User.findById(userId);
        if (!driverUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const driverId = driverUser.driverId || userId;

        // Find active trip for this driver
        const trip = await B2CPartnerTrip.findOne({
            $or: [
                { driverId: driverId },
                { driverId: userId },
                { b2cPartnerId: userId }
            ],
            status: { $in: ['In Progress', 'Scheduled'] }
        })
            .populate('routeId', 'fromLocation toLocation')
            .populate('vehicleId', 'vehicleType model licensePlate');

        if (!trip) {
            return res.json({
                success: true,
                trip: null,
                message: "No active trip found"
            });
        }

        // Get related bookings for passenger info
        const relatedBookings = await B2CPassengerBooking.find({
            $or: [
                { monthlyTrips: trip._id },
                {
                    routeId: trip.routeId,
                    bookingStatus: { $in: ['CONFIRMED', 'ACCEPTED', 'IN_PROGRESS'] }
                }
            ]
        })
            .populate('passengerId', 'fullName whatsappNumber')
            .lean();

        res.json({
            success: true,
            trip: {
                ...trip.toObject(),
                passengers: relatedBookings.map(b => ({
                    bookingId: b._id,
                    name: b.passengerId?.fullName || b.passengerName || 'N/A',
                    phone: b.passengerId?.whatsappNumber || '',
                    seats: b.numberOfSeats || 1
                }))
            }
        });

    } catch (error) {
        console.error("Error getting active B2C trip:", error);
        res.status(500).json({
            success: false,
            message: "Error getting active trip",
            error: error.message
        });
    }
};

// Check and update availability status based on today's scheduled trips
// This endpoint should be called when a driver/partner logs in or loads the dashboard
export const checkAndUpdateAvailability = async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.userRole;

        console.log("[v0] checkAndUpdateAvailability - userId:", userId, "userRole:", userRole);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        let driverId = userId;
        let isSelfDriver = userRole === 'B2C_PARTNER';

        // Get user info
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (userRole === 'B2C_PARTNER_DRIVER' && user.driverId) {
            driverId = user.driverId;
        }

        // Check if driver has any scheduled or in-progress trips today with bookings
        const tripCount = await B2CPartnerTrip.countDocuments({
            $or: [
                { driverId: driverId },
                { driverId: userId },
                { b2cPartnerId: userId }
            ],
            tripDate: { $gte: todayStart, $lte: todayEnd },
            bookedSeats: { $gt: 0 },
            status: { $in: ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress'] }
        });

        console.log("[v0] Trips with bookings today:", tripCount);

        let currentStatus = 'available';
        let newStatus = tripCount > 0 ? 'busy' : 'available';
        let statusUpdated = false;

        if (isSelfDriver) {
            // Get current status
            currentStatus = user.selfDriverAvailability?.status || 'available';

            // Only update if transitioning to busy from available
            // Don't override if manually set to offline
            if (tripCount > 0 && currentStatus === 'available') {
                user.selfDriverAvailability = user.selfDriverAvailability || {};
                user.selfDriverAvailability.status = 'busy';
                user.selfDriverAvailability.lastUpdate = new Date();
                await user.save();
                statusUpdated = true;
                newStatus = 'busy';
                console.log("[v0] Updated B2C Partner to busy - has scheduled trips");

                // Broadcast the change
                broadcastSelfDriverAvailabilityChange(userId, {
                    driverName: user.fullName || 'Self',
                    status: 'busy'
                });
            } else {
                newStatus = currentStatus;
            }
        } else if (userRole === 'B2C_PARTNER_DRIVER') {
            const driver = await B2CPartnerDriver.findById(driverId);
            if (driver) {
                currentStatus = driver.availabilityStatus || 'available';

                // Only update if transitioning to busy from available
                if (tripCount > 0 && currentStatus === 'available') {
                    driver.availabilityStatus = 'busy';
                    driver.lastAvailabilityUpdate = new Date();
                    await driver.save();
                    statusUpdated = true;
                    newStatus = 'busy';
                    console.log("[v0] Updated B2C Partner Driver to busy - has scheduled trips");

                    // Broadcast the change
                    if (user.b2cPartnerId) {
                        broadcastDriverAvailabilityChange(user.b2cPartnerId.toString(), {
                            driverId: driver._id.toString(),
                            driverName: driver.name,
                            availabilityStatus: 'busy',
                            isSelfDriver: false
                        });
                    }
                } else {
                    newStatus = currentStatus;
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                previousStatus: currentStatus,
                currentStatus: newStatus,
                statusUpdated,
                scheduledTripsToday: tripCount,
                message: statusUpdated
                    ? `Status updated to ${newStatus} because you have ${tripCount} scheduled trip(s) today`
                    : `Status is ${newStatus}. You have ${tripCount} scheduled trip(s) today.`
            }
        });

    } catch (error) {
        console.error("Error checking/updating availability:", error);
        res.status(500).json({
            success: false,
            message: "Error checking availability status",
            error: error.message
        });
    }
};
