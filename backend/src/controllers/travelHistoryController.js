import TravelHistory from "../models/TravelHistory.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import User from "../models/User.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";
import mongoose from "mongoose";

// Get passenger's travel history
export const getPassengerTravelHistory = async (req, res) => {
    try {
        const passengerId = req.userId;
        const {
            page = 1,
            limit = 20,
            period = 'month',
            status
        } = req.query;

        // Calculate date range based on period
        const now = new Date();
        let startDate = new Date();

        switch (period) {
            case 'week':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case 'quarter':
                startDate.setMonth(now.getMonth() - 3);
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                startDate.setMonth(now.getMonth() - 1);
        }

        // First, get the passenger's bookings to find associated trips
        const bookingQuery = {
            passengerId: new mongoose.Types.ObjectId(passengerId)
        };

        // Get all bookings for this passenger
        const bookings = await B2CPassengerBooking.find(bookingQuery)
            .populate('routeId', 'routeName fromLocation toLocation')
            .populate('assignedDriverId', 'fullName contactNumber driverImage')
            .populate('b2cPartnerId', 'fullName name email')
            .lean();

        // Collect all trip IDs from monthlyTrips arrays
        const allTripIds = [];
        const bookingTripMap = new Map(); // Map tripId to booking info

        for (const booking of bookings) {
            if (booking.monthlyTrips && booking.monthlyTrips.length > 0) {
                for (const tripId of booking.monthlyTrips) {
                    allTripIds.push(tripId);
                    bookingTripMap.set(tripId.toString(), booking);
                }
            }
        }

        // Fetch trips from B2CPartnerTrip collection that belong to this passenger's bookings
        let tripQuery = {
            _id: { $in: allTripIds },
            tripDate: { $gte: startDate, $lte: now }
        };

        // Add status filter if provided
        if (status && status !== 'all') {
            if (status === 'COMPLETED') {
                tripQuery.status = 'Completed';
            } else if (status === 'CANCELLED') {
                tripQuery.status = 'Cancelled';
            } else if (status === 'IN_PROGRESS') {
                tripQuery.status = 'In Progress';
            } else if (status === 'SCHEDULED') {
                tripQuery.status = 'Scheduled';
            }
        }

        // Fetch the actual trips
        const trips = await B2CPartnerTrip.find(tripQuery)
            .populate('routeId', 'routeName fromLocation toLocation')
            .populate('vehicleId', 'model vehicleType licensePlate color')
            .populate('driverId', 'fullName contactNumber driverImage')
            .sort({ tripDate: -1, startTime: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const total = await B2CPartnerTrip.countDocuments(tripQuery);

        // Transform trips to travel history format with booking info
        const history = trips.map(trip => {
            const booking = bookingTripMap.get(trip._id.toString());

            return {
                _id: trip._id,
                tripId: trip._id,
                bookingId: booking?._id,
                tripDate: trip.tripDate,
                scheduledStartTime: trip.startTime,
                actualStartTime: trip.actualStartTime,
                completedAt: trip.completedAt,
                pickupLocation: booking?.pickupLocation || trip.fromLocation,
                dropoffLocation: booking?.dropoffLocation || trip.toLocation,
                fromLocation: trip.fromLocation,
                toLocation: trip.toLocation,
                vehicleType: trip.vehicleId?.vehicleType || trip.vehicleId?.model || 'N/A',
                vehicleModel: trip.vehicleId?.model,
                vehiclePlate: trip.vehicleId?.licensePlate,
                vehicleColor: trip.vehicleId?.color,
                driverName: booking?.driverName || trip.driverId?.fullName || 'N/A',
                driverImage: booking?.driverImage || trip.driverId?.driverImage,
                driverPhone: booking?.driverPhoneNumber || trip.driverId?.contactNumber,
                status: trip.status === 'Completed' ? 'COMPLETED' :
                    trip.status === 'Cancelled' ? 'CANCELLED' :
                        trip.status === 'In Progress' ? 'IN_PROGRESS' :
                            trip.status === 'Scheduled' ? 'SCHEDULED' :
                                trip.status,
                tripType: trip.tripType,
                seats: booking?.numberOfSeats || 1,
                routeName: trip.routeId?.routeName || booking?.routeId?.routeName,
                isMonthlyPass: booking?.isMonthlyPass || false,
                paymentAmount: booking?.paymentAmount,
                currency: booking?.currency || 'AED'
            };
        });

        // Also include booking-level data for bookings without trips in the date range
        // This ensures we show booking history even if trips weren't created yet
        const bookingsWithoutTripsInRange = bookings.filter(booking => {
            // Check if booking is within date range
            const bookingDate = new Date(booking.travelDate || booking.createdAt);
            return bookingDate >= startDate && bookingDate <= now;
        }).filter(booking => {
            // Exclude bookings whose trips are already in the history
            const hasTripsInHistory = history.some(h =>
                h.bookingId?.toString() === booking._id.toString()
            );
            return !hasTripsInHistory && (!booking.monthlyTrips || booking.monthlyTrips.length === 0);
        });

        // Add standalone bookings (one-time bookings without monthlyTrips)
        const standaloneBookingHistory = bookingsWithoutTripsInRange.map(booking => ({
            _id: booking._id,
            bookingId: booking._id,
            tripDate: booking.travelDate || booking.createdAt,
            pickupLocation: booking.pickupLocation,
            dropoffLocation: booking.dropoffLocation,
            driverName: booking.driverName || booking.assignedDriverId?.fullName || 'N/A',
            driverImage: booking.driverImage || booking.assignedDriverId?.driverImage,
            driverPhone: booking.driverPhoneNumber,
            status: booking.bookingStatus,
            tripType: booking.bookingType,
            seats: booking.numberOfSeats || 1,
            routeName: booking.routeId?.routeName,
            isMonthlyPass: booking.isMonthlyPass || false,
            paymentAmount: booking.paymentAmount,
            currency: booking.currency || 'AED'
        }));

        // Combine and sort
        const combinedHistory = [...history, ...standaloneBookingHistory]
            .sort((a, b) => new Date(b.tripDate) - new Date(a.tripDate));

        res.status(200).json({
            success: true,
            data: {
                history: combinedHistory,
                travelHistory: combinedHistory, // For backward compatibility
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil((total + standaloneBookingHistory.length) / parseInt(limit)),
                    totalTrips: total + standaloneBookingHistory.length,
                    hasNext: parseInt(page) * parseInt(limit) < (total + standaloneBookingHistory.length),
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting travel history:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving travel history",
            error: error.message
        });
    }
};

// Get travel history for a specific trip
export const getTripTravelHistory = async (req, res) => {
    try {
        const { tripId } = req.params;
        const passengerId = req.userId;

        const travelHistory = await TravelHistory.find({
            tripId,
            passengerId
        })
            .populate('tripId', 'startTime fromLocation toLocation')
            .populate('driverId', 'fullName contactNumber vehicleNumber')
            .sort({ travelDate: -1 });

        res.status(200).json({
            success: true,
            data: {
                travelHistory
            }
        });

    } catch (error) {
        console.error("Error getting trip travel history:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving trip travel history",
            error: error.message
        });
    }
};

// Add travel record (when passenger boards)
export const addTravelRecord = async (req, res) => {
    try {
        const {
            tripId,
            monthlyPassId,
            actualBoardingTime,
            actualPickupPoint,
            boardingCoordinates,
            driverId,
            driverName,
            driverContact,
            vehicleNumber,
            vehicleType
        } = req.body;

        const passengerId = req.userId;

        // Verify trip exists
        const trip = await B2CPartnerTrip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        // Check if travel record already exists
        const existingRecord = await TravelHistory.findOne({
            tripId,
            passengerId,
            travelDate: trip.tripDate
        });

        if (existingRecord) {
            return res.status(400).json({
                success: false,
                message: "Travel record already exists for this trip"
            });
        }

        // Create travel record
        const travelRecord = new TravelHistory({
            passengerId,
            tripId,
            monthlyPassId,
            routeId: trip.routeId,
            travelDate: trip.tripDate,
            scheduledTime: trip.startTime,
            actualBoardingTime: actualBoardingTime ? new Date(actualBoardingTime) : null,
            actualPickupPoint,
            pickupLocation: trip.fromLocation,
            dropoffLocation: trip.toLocation,
            boardingCoordinates,
            driverId,
            driverName,
            driverContact,
            vehicleNumber,
            vehicleType,
            status: actualBoardingTime ? "BOARDED" : "SCHEDULED"
        });

        await travelRecord.save();

        res.status(201).json({
            success: true,
            message: "Travel record added successfully",
            data: {
                travelId: travelRecord._id,
                status: travelRecord.status
            }
        });

    } catch (error) {
        console.error("Error adding travel record:", error);
        res.status(500).json({
            success: false,
            message: "Error adding travel record",
            error: error.message
        });
    }
};

// Update travel record (complete trip, add feedback)
export const updateTravelRecord = async (req, res) => {
    try {
        const { travelId } = req.params;
        const {
            status,
            actualDropoffTime,
            actualDropoffPoint,
            dropoffCoordinates,
            rating,
            feedback,
            complaints
        } = req.body;

        const travelRecord = await TravelHistory.findById(travelId);
        if (!travelRecord) {
            return res.status(404).json({
                success: false,
                message: "Travel record not found"
            });
        }

        // Update travel record
        if (status) travelRecord.status = status;
        if (actualDropoffTime) travelRecord.actualDropoffTime = new Date(actualDropoffTime);
        if (actualDropoffPoint) travelRecord.actualDropoffPoint = actualDropoffPoint;
        if (dropoffCoordinates) travelRecord.dropoffCoordinates = dropoffCoordinates;
        if (rating !== undefined) travelRecord.rating = rating;
        if (feedback) travelRecord.feedback = feedback;
        if (complaints) travelRecord.complaints = complaints;

        // Calculate if passenger was on time
        if (actualDropoffTime && travelRecord.scheduledTime) {
            const scheduledTime = new Date(travelRecord.travelDate);
            const [hours, minutes] = travelRecord.scheduledTime.split(':');
            scheduledTime.setHours(parseInt(hours), parseInt(minutes));

            const delayMs = actualDropoffTime - scheduledTime;
            travelRecord.delayMinutes = Math.floor(delayMs / (1000 * 60));
            travelRecord.wasOnTime = travelRecord.delayMinutes <= 5; // Within 5 minutes is on time
        }

        await travelRecord.save();

        res.status(200).json({
            success: true,
            message: "Travel record updated successfully",
            data: {
                travelId: travelRecord._id,
                status: travelRecord.status,
                wasOnTime: travelRecord.wasOnTime,
                delayMinutes: travelRecord.delayMinutes
            }
        });

    } catch (error) {
        console.error("Error updating travel record:", error);
        res.status(500).json({
            success: false,
            message: "Error updating travel record",
            error: error.message
        });
    }
};

// Rate trip and add feedback
export const rateTrip = async (req, res) => {
    try {
        const { travelId } = req.params;
        const { rating, feedback, complaints } = req.body;
        const passengerId = req.userId;

        // First try to find the record in TravelHistory collection
        let travelRecord = await TravelHistory.findOne({
            _id: travelId,
            passengerId
        });

        if (travelRecord) {
            // Record found in TravelHistory, update it
            if (travelRecord.status !== "COMPLETED") {
                return res.status(400).json({
                    success: false,
                    message: "Can only rate completed trips"
                });
            }

            travelRecord.rating = rating;
            travelRecord.feedback = feedback;
            if (complaints) {
                travelRecord.complaints = complaints.map(complaint => ({
                    ...complaint,
                    resolved: false
                }));
            }

            await travelRecord.save();

            // Update driver's rating
            if (travelRecord.driverId && rating) {
                await updateDriverRating(travelRecord.driverId, rating);
            }

            return res.status(200).json({
                success: true,
                message: "Trip rated successfully",
                data: {
                    travelId: travelRecord._id,
                    rating: travelRecord.rating,
                    feedback: travelRecord.feedback
                }
            });
        }

        // If not found in TravelHistory, look for it in B2CPartnerTrip
        // The travelId could be the trip ID itself
        let trip = await B2CPartnerTrip.findById(travelId);

        if (!trip) {
            // Also try to find by looking at the passenger's bookings
            const booking = await B2CPassengerBooking.findOne({
                passengerId: new mongoose.Types.ObjectId(passengerId),
                monthlyTrips: travelId
            });

            if (booking) {
                trip = await B2CPartnerTrip.findById(travelId);
            }
        }

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Travel record not found"
            });
        }

        // Check if trip is completed
        if (trip.status !== "Completed") {
            return res.status(400).json({
                success: false,
                message: "Can only rate completed trips"
            });
        }

        // Find the passenger entry in the trip (if exists)
        const passengerIndex = trip.passengers?.findIndex(
            p => p.userId?.toString() === passengerId.toString()
        );

        if (passengerIndex >= 0) {
            // Update passenger's rating in the trip
            trip.passengers[passengerIndex].rating = rating;
            trip.passengers[passengerIndex].feedback = feedback;
            trip.passengers[passengerIndex].ratedAt = new Date();
            await trip.save();
        } else {
            // Add rating to the trip's passengers array
            trip.passengers.push({
                userId: new mongoose.Types.ObjectId(passengerId),
                rating: rating,
                feedback: feedback,
                ratedAt: new Date(),
                status: "Completed"
            });
            await trip.save();
        }

        // Also store rating in the booking
        const bookingToUpdate = await B2CPassengerBooking.findOne({
            passengerId: new mongoose.Types.ObjectId(passengerId),
            monthlyTrips: travelId
        });

        if (bookingToUpdate) {
            // Store rating in booking if needed
            if (!bookingToUpdate.tripRatings) {
                bookingToUpdate.tripRatings = [];
            }

            const existingRatingIndex = bookingToUpdate.tripRatings.findIndex(
                r => r.tripId?.toString() === travelId.toString()
            );

            if (existingRatingIndex >= 0) {
                bookingToUpdate.tripRatings[existingRatingIndex].rating = rating;
                bookingToUpdate.tripRatings[existingRatingIndex].feedback = feedback;
                bookingToUpdate.tripRatings[existingRatingIndex].ratedAt = new Date();
            } else {
                bookingToUpdate.tripRatings.push({
                    tripId: travelId,
                    rating: rating,
                    feedback: feedback,
                    ratedAt: new Date()
                });
            }
            await bookingToUpdate.save();
        }

        // Update driver's rating - could be a B2CPartnerDriver or the B2CPartner (User) themselves
        const driverId = trip.driverId;
        if (driverId && rating) {
            await updateDriverRating(driverId, rating);

            // Also check if this is a self-driver (B2C Partner driving themselves)
            // If the driverId references a User instead of B2CPartnerDriver, update User's rating
            const isUserDriver = await User.findById(driverId);
            if (isUserDriver && isUserDriver.userType === 'B2C_PARTNER') {
                await updateUserDriverRating(driverId, rating);
            }
        }

        res.status(200).json({
            success: true,
            message: "Trip rated successfully",
            data: {
                travelId: travelId,
                tripId: trip._id,
                rating: rating,
                feedback: feedback
            }
        });

    } catch (error) {
        console.error("Error rating trip:", error);
        res.status(500).json({
            success: false,
            message: "Error rating trip",
            error: error.message
        });
    }
};

// Helper function to update B2CPartnerDriver rating
const updateDriverRating = async (driverId, rating) => {
    try {
        const driverDoc = await B2CPartnerDriver.findById(driverId);

        if (driverDoc) {
            const currentCount = driverDoc.ratings?.count || 0;
            const currentAverage = driverDoc.ratings?.average || 0;
            const newCount = currentCount + 1;
            const newAverage = ((currentAverage * currentCount) + rating) / newCount;

            await B2CPartnerDriver.findByIdAndUpdate(driverId, {
                $set: {
                    'ratings.average': Math.round(newAverage * 10) / 10,
                    'ratings.count': newCount
                },
                $push: {
                    'ratings.history': {
                        rating: rating,
                        date: new Date()
                    }
                }
            });
        }
    } catch (driverRatingError) {
        console.error("Error updating B2C driver rating:", driverRatingError);
    }
};

// Helper function to update User (B2C Partner self-driver) rating
const updateUserDriverRating = async (userId, rating) => {
    try {
        const user = await User.findById(userId);

        if (user) {
            const currentCount = user.driverRatings?.count || 0;
            const currentAverage = user.driverRatings?.average || 0;
            const newCount = currentCount + 1;
            const newAverage = ((currentAverage * currentCount) + rating) / newCount;

            await User.findByIdAndUpdate(userId, {
                $set: {
                    'driverRatings.average': Math.round(newAverage * 10) / 10,
                    'driverRatings.count': newCount
                },
                $push: {
                    'driverRatings.history': {
                        rating: rating,
                        date: new Date()
                    }
                }
            });
        }
    } catch (userRatingError) {
        console.error("Error updating user driver rating:", userRatingError);
    }
};

// Get travel statistics
export const getTravelStatistics = async (req, res) => {
    try {
        const passengerId = req.userId;
        const { startDate, endDate, groupBy = "month" } = req.query;

        const statistics = await calculatePassengerStatistics(passengerId, startDate, endDate, groupBy);

        res.status(200).json({
            success: true,
            data: {
                statistics
            }
        });

    } catch (error) {
        console.error("Error getting travel statistics:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving travel statistics",
            error: error.message
        });
    }
};

// Helper functions
const calculatePassengerStatistics = async (passengerId, startDate, endDate, groupBy = "month") => {
    try {
        const matchStage = {
            passengerId: new mongoose.Types.ObjectId(passengerId)
        };

        if (startDate && endDate) {
            matchStage.travelDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const groupStage = {};
        switch (groupBy) {
            case "day":
                groupStage._id = { $dateToString: { format: "%Y-%m-%d", date: "$travelDate" } };
                break;
            case "week":
                groupStage._id = { $dateToString: { format: "%Y-%U", date: "$travelDate" } };
                break;
            case "month":
            default:
                groupStage._id = { $dateToString: { format: "%Y-%m", date: "$travelDate" } };
                break;
            case "year":
                groupStage._id = { $dateToString: { format: "%Y", date: "$travelDate" } };
                break;
        }

        const statistics = await TravelHistory.aggregate([
            { $match: matchStage },
            {
                $group: {
                    ...groupStage,
                    totalTrips: { $sum: 1 },
                    completedTrips: {
                        $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
                    },
                    missedTrips: {
                        $sum: { $cond: [{ $eq: ["$status", "MISSED"] }, 1, 0] }
                    },
                    cancelledTrips: {
                        $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] }
                    },
                    averageRating: { $avg: "$rating" },
                    totalDelayMinutes: { $sum: "$delayMinutes" },
                    onTimeTrips: {
                        $sum: { $cond: ["$wasOnTime", 1, 0] }
                    }
                }
            },
            { $sort: { "_id": -1 } }
        ]);

        // Get overall statistics
        const overallStats = await TravelHistory.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalTrips: { $sum: 1 },
                    completedTrips: {
                        $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
                    },
                    missedTrips: {
                        $sum: { $cond: [{ $eq: ["$status", "MISSED"] }, 1, 0] }
                    },
                    cancelledTrips: {
                        $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] }
                    },
                    averageRating: { $avg: "$rating" },
                    totalDelayMinutes: { $sum: "$delayMinutes" },
                    onTimeTrips: {
                        $sum: { $cond: ["$wasOnTime", 1, 0] }
                    }
                }
            }
        ]);

        const overall = overallStats[0] || {
            totalTrips: 0,
            completedTrips: 0,
            missedTrips: 0,
            cancelledTrips: 0,
            averageRating: 0,
            totalDelayMinutes: 0,
            onTimeTrips: 0
        };

        // Calculate derived metrics
        overall.completionRate = overall.totalTrips > 0 ? (overall.completedTrips / overall.totalTrips) * 100 : 0;
        overall.onTimeRate = overall.completedTrips > 0 ? (overall.onTimeTrips / overall.completedTrips) * 100 : 0;
        overall.averageDelayPerTrip = overall.completedTrips > 0 ? overall.totalDelayMinutes / overall.completedTrips : 0;

        return {
            overall,
            grouped: statistics
        };

    } catch (error) {
        console.error("Error calculating statistics:", error);
        return {
            overall: {
                totalTrips: 0,
                completedTrips: 0,
                missedTrips: 0,
                cancelledTrips: 0,
                averageRating: 0,
                totalDelayMinutes: 0,
                onTimeTrips: 0,
                completionRate: 0,
                onTimeRate: 0,
                averageDelayPerTrip: 0
            },
            grouped: []
        };
    }
};

// Get driver ratings (for B2C Partner self-driver or B2C Partner Driver)
export const getDriverRatings = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 20 } = req.query;

        // Check if the user is a B2C Partner (self-driver) or B2C Partner Driver
        const user = await User.findById(userId).select('role driverRatings driverId b2cPartnerId');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        let ratings = [];
        let totalRatings = 0;
        let averageRating = 0;

        // For B2C_PARTNER (self-driver), get ratings from User.driverRatings
        if (user.role === 'B2C_PARTNER') {
            averageRating = user.driverRatings?.average || 0;
            totalRatings = user.driverRatings?.count || 0;
            const history = user.driverRatings?.history || [];

            // Get paginated history
            const startIndex = (parseInt(page) - 1) * parseInt(limit);
            const paginatedHistory = history.slice(startIndex, startIndex + parseInt(limit));

            // Get detailed ratings from trips
            const trips = await B2CPartnerTrip.find({
                'passengers.rating': { $exists: true, $ne: null }
            })
                .populate('passengers.userId', 'fullName profileImage')
                .populate('routeId', 'routeName fromLocation toLocation')
                .sort({ tripDate: -1 })
                .lean();

            // Filter trips where this user was the driver (self-driver)
            const myTripsAsDriver = trips.filter(trip => {
                // For self-driver, check if driverId references the user themselves
                return trip.driverId?.toString() === userId.toString();
            });

            ratings = myTripsAsDriver.flatMap(trip => {
                return (trip.passengers || [])
                    .filter(p => p.rating)
                    .map(p => ({
                        _id: `${trip._id}_${p.userId?._id || 'unknown'}`,
                        tripId: trip._id,
                        tripDate: trip.tripDate,
                        rating: p.rating,
                        feedback: p.feedback || '',
                        ratedAt: p.ratedAt || trip.completedAt,
                        passengerName: p.userId?.fullName || 'Anonymous',
                        passengerImage: p.userId?.profileImage,
                        routeName: trip.routeId?.routeName || `${trip.fromLocation} → ${trip.toLocation}`
                    }));
            }).slice(startIndex, startIndex + parseInt(limit));
        }

        // For B2C_PARTNER_DRIVER, get ratings from B2CPartnerDriver model
        if (user.role === 'B2C_PARTNER_DRIVER' && user.driverId) {
            const driverDoc = await B2CPartnerDriver.findById(user.driverId);

            if (driverDoc) {
                averageRating = driverDoc.ratings?.average || 0;
                totalRatings = driverDoc.ratings?.count || 0;

                // Get detailed ratings from trips where this driver was assigned
                const trips = await B2CPartnerTrip.find({
                    driverId: user.driverId,
                    'passengers.rating': { $exists: true, $ne: null }
                })
                    .populate('passengers.userId', 'fullName profileImage')
                    .populate('routeId', 'routeName fromLocation toLocation')
                    .sort({ tripDate: -1 })
                    .limit(parseInt(limit))
                    .skip((parseInt(page) - 1) * parseInt(limit))
                    .lean();

                ratings = trips.flatMap(trip => {
                    return (trip.passengers || [])
                        .filter(p => p.rating)
                        .map(p => ({
                            _id: `${trip._id}_${p.userId?._id || 'unknown'}`,
                            tripId: trip._id,
                            tripDate: trip.tripDate,
                            rating: p.rating,
                            feedback: p.feedback || '',
                            ratedAt: p.ratedAt || trip.completedAt,
                            passengerName: p.userId?.fullName || 'Anonymous',
                            passengerImage: p.userId?.profileImage,
                            routeName: trip.routeId?.routeName || `${trip.fromLocation} → ${trip.toLocation}`
                        }));
                });
            }
        }

        // Get rating distribution (1-5 stars)
        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratings.forEach(r => {
            if (r.rating >= 1 && r.rating <= 5) {
                ratingDistribution[Math.round(r.rating)]++;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                ratings,
                averageRating: Math.round(averageRating * 10) / 10,
                totalRatings,
                ratingDistribution,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalRatings / parseInt(limit)),
                    hasNext: parseInt(page) * parseInt(limit) < totalRatings,
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting driver ratings:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving driver ratings",
            error: error.message
        });
    }
};
