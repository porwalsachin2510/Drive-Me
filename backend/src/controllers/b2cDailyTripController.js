import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import User from "../models/User.js";
import NoShow from "../models/NoShow.js";
import RouteRequest from "../models/RouteRequest.js";
import { sendEmail } from "../Services/emailService.js";
import mongoose from "mongoose";

// Get today's trips for B2C partner
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
        const matchStage = {
            b2cPartnerId: new mongoose.Types.ObjectId(providerId),
            // Match trips where tripDate falls within today
            tripDate: {
                $gte: todayStart,
                $lte: todayEnd
            }
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

// Get upcoming trips (excludes today, only future trips)
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

        // Match query for upcoming trips
        const matchQuery = {
            b2cPartnerId: new mongoose.Types.ObjectId(providerId),
            tripDate: {
                $gte: tomorrowStart,
                $lte: rangeEnd
            }
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

        // Notify passengers of status change
        await notifyPassengersOfStatusChange(trip, status);

        res.status(200).json({
            success: true,
            message: `Trip status updated to ${status.toUpperCase()}`,
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

        // Query trips within today's date range
        const todayTrips = await B2CPartnerTrip.find({
            b2cPartnerId: new mongoose.Types.ObjectId(providerId),
            tripDate: {
                $gte: todayStart,
                $lte: todayEnd
            }
        }).lean();

        const totalTrips = todayTrips.length;
        const completedTrips = todayTrips.filter(trip =>
            trip.status === 'COMPLETED' || trip.status === 'Completed'
        ).length;
        const cancelledTrips = todayTrips.filter(trip =>
            trip.status === 'CANCELLED' || trip.status === 'Cancelled'
        ).length;
        const totalSeats = todayTrips.reduce((sum, trip) => sum + trip.totalSeats, 0);
        const totalBookedSeats = todayTrips.reduce((sum, trip) => sum + trip.bookedSeats, 0);

        return {
            totalTrips,
            completedTrips,
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

// Helper function to notify passengers of trip status changes
const notifyPassengersOfStatusChange = async (trip, status) => {
    try {
        // Get passengers for this trip
        const monthlyPasses = await B2CMonthlyPass.find({
            'monthlyTrips.tripId': trip._id,
            status: 'ACTIVE'
        }).populate('passengerId', 'email fullName');

        // Send notifications to all passengers
        for (const pass of monthlyPasses) {
            if (pass.passengerId) {
                await sendEmail({
                    to: pass.passengerId.email,
                    subject: `Trip Status Update: ${trip.fromLocation} → ${trip.toLocation}`,
                    template: "tripStatusUpdate",
                    data: {
                        passengerName: pass.passengerId.fullName,
                        route: `${trip.fromLocation} → ${trip.toLocation}`,
                        tripDate: trip.tripDate,
                        tripTime: trip.startTime,
                        newStatus: status,
                        reason: trip.cancellationReason
                    }
                });
            }
        }
    } catch (error) {
        console.error("Error notifying passengers of status change:", error);
    }
};
