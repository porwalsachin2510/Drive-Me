import TravelHistory from "../models/TravelHistory.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
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
            startDate, 
            endDate, 
            status,
            routeId 
        } = req.query;

        const query = { passengerId };
        
        if (startDate && endDate) {
            query.travelDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (status) {
            query.status = status.toUpperCase();
        }
        
        if (routeId) {
            query.routeId = routeId;
        }

        const travelHistory = await TravelHistory.find(query)
            .populate('tripId', 'startTime fromLocation toLocation vehicleId')
            .populate('monthlyPassId', 'passType startDate endDate')
            .populate('routeId', 'routeName fromLocation toLocation')
            .populate('driverId', 'fullName contactNumber')
            .sort({ travelDate: -1, scheduledTime: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await TravelHistory.countDocuments(query);

        // Calculate statistics
        const statistics = await calculatePassengerStatistics(passengerId, startDate, endDate);

        res.status(200).json({
            success: true,
            data: {
                travelHistory,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalTrips: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                },
                statistics
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

        const travelRecord = await TravelHistory.findOne({
            _id: travelId,
            passengerId
        });

        if (!travelRecord) {
            return res.status(404).json({
                success: false,
                message: "Travel record not found"
            });
        }

        if (travelRecord.status !== "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "Can only rate completed trips"
            });
        }

        // Update rating and feedback
        travelRecord.rating = rating;
        travelRecord.feedback = feedback;
        if (complaints) {
            travelRecord.complaints = complaints.map(complaint => ({
                ...complaint,
                resolved: false
            }));
        }

        await travelRecord.save();

        // Update driver's rating in B2CPartnerDriver model
        if (travelRecord.driverId && rating) {
            try {
                const driverDoc = await B2CPartnerDriver.findById(travelRecord.driverId);

                if (driverDoc) {
                    const currentCount = driverDoc.ratings?.count || 0;
                    const currentAverage = driverDoc.ratings?.average || 0;
                    const newCount = currentCount + 1;
                    const newAverage = ((currentAverage * currentCount) + rating) / newCount;

                    await B2CPartnerDriver.findByIdAndUpdate(travelRecord.driverId, {
                        $set: {
                            'ratings.average': Math.round(newAverage * 10) / 10,
                            'ratings.count': newCount
                        }
                    });
                }
            } catch (driverRatingError) {
                console.error("Error updating B2C driver rating:", driverRatingError);
            }
        }

        res.status(200).json({
            success: true,
            message: "Trip rated successfully",
            data: {
                travelId: travelRecord._id,
                rating: travelRecord.rating,
                feedback: travelRecord.feedback
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
