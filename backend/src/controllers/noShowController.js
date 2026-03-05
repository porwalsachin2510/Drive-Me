import NoShow from "../models/NoShow.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import User from "../models/User.js";
import { sendEmail } from "../Services/emailService.js";

// Mark no-show for a trip
export const markNoShow = async (req, res) => {
    try {
        const { tripId, bookingId, monthlyPassId, reason, customReason, date } = req.body;
        const passengerId = req.userId;

        // Validate required fields
        if (!reason || !date) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields for no-show marking (reason, date)"
            });
        }

        // Try to find the trip using multiple strategies
        let trip = null;
        let resolvedBooking = null;
        
        // Strategy 1: Direct trip lookup by tripId
        if (tripId) {
            trip = await B2CPartnerTrip.findById(tripId);
        }
        
        // Strategy 2: Use bookingId to find associated trip
        if (!trip && bookingId) {
            resolvedBooking = await B2CPassengerBooking.findById(bookingId);
            
            if (resolvedBooking) {
                // 2a: If booking has a direct tripId reference, use it
                if (resolvedBooking.tripId) {
                    trip = await B2CPartnerTrip.findById(resolvedBooking.tripId);
                }
                
                // 2b: Search in booking's monthlyTrips array for matching date
                if (!trip && resolvedBooking.monthlyTrips && resolvedBooking.monthlyTrips.length > 0) {
                    const targetDate = new Date(date);
                    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
                    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
                    
                    trip = await B2CPartnerTrip.findOne({
                        _id: { $in: resolvedBooking.monthlyTrips },
                        tripDate: { $gte: dayStart, $lt: dayEnd }
                    });
                }
                
                // 2c: Find by route and date from the booking
                if (!trip) {
                    const targetDate = new Date(date);
                    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
                    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
                    
                    // Try with routeId from the booking
                    if (resolvedBooking.routeId) {
                        trip = await B2CPartnerTrip.findOne({
                            routeId: resolvedBooking.routeId,
                            tripDate: { $gte: dayStart, $lt: dayEnd },
                            status: { $ne: "Cancelled" }
                        });
                    }
                    
                    // 2d: Try with b2cPartnerId from the booking
                    if (!trip && resolvedBooking.b2cPartnerId) {
                        trip = await B2CPartnerTrip.findOne({
                            b2cPartnerId: resolvedBooking.b2cPartnerId,
                            tripDate: { $gte: dayStart, $lt: dayEnd },
                            status: { $ne: "Cancelled" }
                        });
                    }
                }
            }
        }
        
        // Strategy 3: If tripId was actually a bookingId (common frontend mistake)
        if (!trip && tripId && !bookingId) {
            resolvedBooking = await B2CPassengerBooking.findById(tripId);
            if (resolvedBooking) {
                const targetDate = new Date(date);
                const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
                const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
                
                if (resolvedBooking.tripId) {
                    trip = await B2CPartnerTrip.findById(resolvedBooking.tripId);
                }
                if (!trip && resolvedBooking.monthlyTrips?.length > 0) {
                    trip = await B2CPartnerTrip.findOne({
                        _id: { $in: resolvedBooking.monthlyTrips },
                        tripDate: { $gte: dayStart, $lt: dayEnd }
                    });
                }
                if (!trip && resolvedBooking.routeId) {
                    trip = await B2CPartnerTrip.findOne({
                        routeId: resolvedBooking.routeId,
                        tripDate: { $gte: dayStart, $lt: dayEnd },
                        status: { $ne: "Cancelled" }
                    });
                }
                if (!trip && resolvedBooking.b2cPartnerId) {
                    trip = await B2CPartnerTrip.findOne({
                        b2cPartnerId: resolvedBooking.b2cPartnerId,
                        tripDate: { $gte: dayStart, $lt: dayEnd },
                        status: { $ne: "Cancelled" }
                    });
                }
            }
        }
        
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "No trip found for the specified date. Please ensure a trip exists for this date."
            });
        }

        // Verify monthly pass if provided
        let monthlyPass = null;
        if (monthlyPassId) {
            monthlyPass = await B2CMonthlyPass.findById(monthlyPassId);
            if (monthlyPass && monthlyPass.passengerId.toString() !== passengerId) {
                return res.status(403).json({
                    success: false,
                    message: "Monthly pass does not belong to you"
                });
            }
        }

        // Use resolved trip ID
        const resolvedTripId = trip._id;

        // Check if no-show already exists for this trip and date
        const existingNoShow = await NoShow.findOne({
            tripId: resolvedTripId,
            passengerId,
            date: new Date(date)
        });

        if (existingNoShow) {
            return res.status(400).json({
                success: false,
                message: "No-show already marked for this trip",
                noShowId: existingNoShow._id
            });
        }

        // Get passenger's no-show history
        const previousNoShows = await NoShow.countDocuments({
            passengerId,
            status: "APPROVED"
        });

        // Create no-show record
        const noShow = new NoShow({
            tripId: resolvedTripId,
            monthlyPassId,
            passengerId,
            date: new Date(date),
            reason,
            customReason: reason === "OTHER" ? customReason : null,
            isRecurring: previousNoShows > 2,
            previousNoShows
        });

        await noShow.save();

        // Release the seat for this trip
        if (trip.bookedSeats > 0) {
            await B2CPartnerTrip.findByIdAndUpdate(resolvedTripId, {
                $inc: { availableSeats: 1, bookedSeats: -1 }
            });
        }

        // Update no-show record
        noShow.seatReleased = true;
        noShow.releasedAt = new Date();
        await noShow.save();

        // Notify B2C partner
        await notifyProviderOfNoShow(trip, noShow);

        res.status(201).json({
            success: true,
            message: "No-show marked successfully",
            data: {
                noShowId: noShow._id,
                seatReleased: true,
                tripDate: trip.tripDate,
                availableSeats: trip.availableSeats + 1
            }
        });

    } catch (error) {
        console.error("Error marking no-show:", error);
        res.status(500).json({
            success: false,
            message: "Error marking no-show",
            error: error.message
        });
    }
};

// Get passenger's no-show history
export const getPassengerNoShows = async (req, res) => {
    try {
        const passengerId = req.userId;
        const { status, page = 1, limit = 10, startDate, endDate } = req.query;

        const query = { passengerId };
        if (status) {
            query.status = status.toUpperCase();
        }
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const noShows = await NoShow.find(query)
            .populate('tripId', 'tripDate startTime fromLocation toLocation')
            .populate('monthlyPassId', 'passType startDate endDate')
            .sort({ date: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await NoShow.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                noShows,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalNoShows: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                },
                statistics: {
                    totalNoShows: total,
                    thisMonth: await NoShow.countDocuments({
                        passengerId,
                        date: {
                            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                        }
                    }),
                    recurringNoShows: await NoShow.countDocuments({
                        passengerId,
                        isRecurring: true
                    })
                }
            }
        });

    } catch (error) {
        console.error("Error getting no-show history:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving no-show history",
            error: error.message
        });
    }
};

// Get no-shows for B2C partners
export const getProviderNoShows = async (req, res) => {
    try {
        const providerId = req.userId;
        const { status, page = 1, limit = 20, date } = req.query;

        // Get trips belonging to this provider
        const providerTrips = await B2CPartnerTrip.find({
            b2cPartnerId: providerId
        }).select('_id');

        const tripIds = providerTrips.map(trip => trip._id);

        const query = { tripId: { $in: tripIds } };
        if (status) {
            query.status = status.toUpperCase();
        }
        if (date) {
            const targetDate = new Date(date);
            query.date = {
                $gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
                $lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
            };
        }

        const noShows = await NoShow.find(query)
            .populate('passengerId', 'fullName email')
            .populate('tripId', 'tripDate startTime fromLocation toLocation')
            .sort({ date: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await NoShow.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                noShows,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalNoShows: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                },
                statistics: {
                    todayNoShows: await NoShow.countDocuments({
                        tripId: { $in: tripIds },
                        date: {
                            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                            $lt: new Date(new Date().setHours(23, 59, 59, 999))
                        }
                    }),
                    thisWeekNoShows: await NoShow.countDocuments({
                        tripId: { $in: tripIds },
                        date: {
                            $gte: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())),
                            $lt: new Date()
                        }
                    }),
                    thisMonthNoShows: await NoShow.countDocuments({
                        tripId: { $in: tripIds },
                        date: {
                            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                            $lt: new Date()
                        }
                    })
                }
            }
        });

    } catch (error) {
        console.error("Error getting provider no-shows:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving no-shows",
            error: error.message
        });
    }
};

// Approve/reject no-show (for providers)
export const updateNoShowStatus = async (req, res) => {
    try {
        const { noShowId } = req.params;
        const { status, providerResponse, processRefund } = req.body;

        if (!noShowId || !status) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const noShow = await NoShow.findById(noShowId)
            .populate('tripId')
            .populate('passengerId');

        if (!noShow) {
            return res.status(404).json({
                success: false,
                message: "No-show record not found"
            });
        }

        noShow.status = status.toUpperCase();
        noShow.providerResponse = providerResponse;

        if (status.toUpperCase() === "APPROVED" && processRefund) {
            // Calculate refund amount (proportional to days remaining in month)
            const monthlyPass = await B2CMonthlyPass.findById(noShow.monthlyPassId);
            if (monthlyPass) {
                const daysInMonth = new Date(monthlyPass.endDate.getFullYear(), monthlyPass.endDate.getMonth() + 1, 0).getDate();
                const daysRemaining = Math.ceil((monthlyPass.endDate - new Date()) / (1000 * 60 * 60 * 24));
                const refundAmount = (monthlyPass.totalAmount / daysInMonth) * Math.min(daysRemaining, 1);
                
                noShow.refundProcessed = true;
                noShow.refundAmount = refundAmount;
                noShow.refundDate = new Date();
            }
        }

        await noShow.save();

        // Notify passenger
        await notifyPassengerOfNoShowUpdate(noShow);

        res.status(200).json({
            success: true,
            message: `No-show ${status.toLowerCase()} successfully`,
            data: {
                noShowId: noShow._id,
                status: noShow.status,
                refundProcessed: noShow.refundProcessed,
                refundAmount: noShow.refundAmount
            }
        });

    } catch (error) {
        console.error("Error updating no-show status:", error);
        res.status(500).json({
            success: false,
            message: "Error updating no-show status",
            error: error.message
        });
    }
};

// Helper functions
const notifyProviderOfNoShow = async (trip, noShow) => {
    try {
        const provider = await User.findById(trip.b2cPartnerId);
        if (provider) {
            await sendEmail({
                to: provider.email,
                subject: "Passenger No-Show Notification",
                template: "noShowNotification",
                data: {
                    providerName: provider.fullName,
                    tripDate: trip.tripDate,
                    tripTime: trip.startTime,
                    route: `${trip.fromLocation} → ${trip.toLocation}`,
                    passengerReason: noShow.reason,
                    seatReleased: true,
                    availableSeats: trip.availableSeats + 1
                }
            });
        }
    } catch (error) {
        console.error("Error notifying provider of no-show:", error);
    }
};

const notifyPassengerOfNoShowUpdate = async (noShow) => {
    try {
        const passenger = await User.findById(noShow.passengerId);
        if (passenger) {
            await sendEmail({
                to: passenger.email,
                subject: "Your No-Show Request Update",
                template: "noShowUpdate",
                data: {
                    passengerName: passenger.fullName,
                    status: noShow.status,
                    providerResponse: noShow.providerResponse,
                    refundProcessed: noShow.refundProcessed,
                    refundAmount: noShow.refundAmount
                }
            });
        }
    } catch (error) {
        console.error("Error notifying passenger of no-show update:", error);
    }
};
