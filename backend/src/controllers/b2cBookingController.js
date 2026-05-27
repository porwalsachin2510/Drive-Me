import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import User from "../models/User.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import mongoose from "mongoose";

// Get B2C Partner Booking History (COMPLETED and CANCELLED bookings)
export const getB2CPartnerBookingHistory = async (req, res) => {
    try {
        const partnerId = req.userId;
        const { page = 1, limit = 12, status } = req.query;

        // Build query for history (COMPLETED and CANCELLED)
        let statusFilter = ['COMPLETED', 'CANCELLED'];
        if (status && ['COMPLETED', 'CANCELLED'].includes(status.toUpperCase())) {
            statusFilter = [status.toUpperCase()];
        }

        const query = {
            b2cPartnerId: partnerId,
            bookingStatus: { $in: statusFilter }
        };

        // Get total count
        const totalCount = await B2CPassengerBooking.countDocuments(query);

        // Get paginated bookings
        // Note: B2CPassengerBooking schema doesn't have vehicleId - vehicle info is stored as strings (vehicleModel, vehiclePlate)
        // or can be obtained from the route's assignedVehicle
        const bookings = await B2CPassengerBooking.find(query)
            .populate('passengerId', 'fullName email whatsappNumber profileImage')
            .populate('routeId', 'fromLocation toLocation routeName assignedVehicle')
            .populate('assignedDriverId', 'fullName email whatsappNumber')
            .sort({ updatedAt: -1, bookingDate: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        // Format bookings for history display
        // Get vehicle info from route's assignedVehicle if needed
        const formattedBookingsPromises = bookings.map(async (booking) => {
            let vehicleInfo = null;

            // Get vehicle info from route's assignedVehicle
            if (booking.routeId?.assignedVehicle) {
                try {
                    const vehicle = await B2CPartnerVehicle.findById(booking.routeId.assignedVehicle);
                    if (vehicle) {
                        vehicleInfo = `${vehicle.vehicleType} ${vehicle.model}`;
                    }
                } catch (err) {
                    console.error("[v0] Error fetching vehicle for booking:", err);
                }
            }

            // Fallback to inline vehicle info stored in booking
            if (!vehicleInfo && booking.vehicleModel) {
                vehicleInfo = `${booking.vehicleModel}`;
                if (booking.vehiclePlate) {
                    vehicleInfo += ` (${booking.vehiclePlate})`;
                }
            }

            return {
                _id: booking._id,
                bookingId: booking._id.toString().slice(-8).toUpperCase(),
                tripId: `TRP-${booking._id.toString().slice(-6).toUpperCase()}`,
                status: booking.bookingStatus.toLowerCase(),
                date: booking.bookingDate || booking.createdAt,
                time: booking.timeSlot?.departure || '05:30 AM',
                amount: booking.paymentAmount || booking.totalAmount || booking.fareAmount || 0,
                currency: booking.currency || 'AED',
                pickup: booking.routeId?.fromLocation || booking.pickupLocation || 'N/A',
                dropoff: booking.routeId?.toLocation || booking.dropoffLocation || 'N/A',
                passengerName: booking.passengerId?.fullName || booking.passengerName || 'N/A',
                passengerPhone: booking.passengerId?.whatsappNumber || '',
                passengerEmail: booking.passengerId?.email || '',
                driverName: booking.assignedDriverId?.fullName || booking.driverName || (booking.isSelfDriver ? 'Self-Driving' : 'N/A'),
                vehicleInfo: vehicleInfo,
                numberOfSeats: booking.numberOfSeats || 1,
                isMonthlyPass: booking.isMonthlyPass || false,
                isSelfDriver: booking.isSelfDriver || false,
                completedAt: booking.completedAt,
                cancelledAt: booking.cancelledAt,
                cancelReason: booking.cancelReason
            };
        });

        const formattedBookings = await Promise.all(formattedBookingsPromises);

        // Get stats
        const completedCount = await B2CPassengerBooking.countDocuments({
            b2cPartnerId: partnerId,
            bookingStatus: 'COMPLETED'
        });
        const cancelledCount = await B2CPassengerBooking.countDocuments({
            b2cPartnerId: partnerId,
            bookingStatus: 'CANCELLED'
        });

        res.status(200).json({
            success: true,
            data: {
                bookings: formattedBookings,
                stats: {
                    total: totalCount,
                    completed: completedCount,
                    cancelled: cancelledCount
                },
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalItems: totalCount,
                    hasNext: parseInt(page) * parseInt(limit) < totalCount,
                    hasPrev: parseInt(page) > 1
                }
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C partner booking history:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching booking history",
            error: error.message
        });
    }
};

// Get B2C Partner Bookings (for B2C_PARTNER dashboard)
export const getB2CPartnerBookings = async (req, res) => {
    try {
        const partnerId = req.userId;
        console.log("[v0] getB2CPartnerBookings called for partnerId:", partnerId);

        // Get all bookings for this partner
        const bookings = await B2CPassengerBooking.find({
            b2cPartnerId: partnerId
        })
            .populate('passengerId', 'fullName email whatsappNumber profileImage country countryCode')
            .populate('routeId', 'fromLocation toLocation routeName')
            .populate('assignedDriverId', 'fullName email whatsappNumber')
            .sort({ bookingDate: -1 });

        console.log("[v0] Found", bookings.length, "bookings for partner");

        // Import B2CPartnerSchedule for resolving driver info from schedules
        const B2CPartnerSchedule = (await import('../models/B2CPartnerSchedule.js')).default;

        // Process bookings to add driver names for ROUND_TRIP bookings
        // NOTE: outboundDriverId/returnDriverId may store either:
        // - User._id (for B2C_PARTNER self-driver) 
        // - B2CPartnerDriver._id (for assigned drivers)
        // We need to handle both cases

        const formattedBookings = await Promise.all(bookings.map(async (booking) => {
            const bookingObj = booking.toObject();

            console.log("[v0] Processing booking:", bookingObj._id, "- returnDriverId:", bookingObj.returnDriverId, "returnIsSelfDriver:", bookingObj.returnIsSelfDriver);

            // Helper function to get driver ID as string (handles both ObjectId and populated objects)
            const getDriverId = (driverIdField) => {
                if (!driverIdField) return null;
                // If it's a populated object, get the _id
                if (typeof driverIdField === 'object' && driverIdField._id) {
                    return driverIdField._id.toString();
                }
                // If it's an ObjectId or string
                return driverIdField.toString();
            };

            // CRITICAL FIX: For ONE_WAY bookings with null outboundDriverId, resolve from schedule's tripTimes
            // This handles bookings that were created before the tripTime matching fix
            if (!bookingObj.outboundDriverId && bookingObj.linkedSchedule && bookingObj.outboundTripTime) {
                try {
                    const schedule = await B2CPartnerSchedule.findById(bookingObj.linkedSchedule);
                    if (schedule && schedule.tripTimes) {
                        // Find the matching tripTime by departureTime or arrivalTime
                        let matchedTripTime = schedule.tripTimes.find(tt =>
                            tt.departureTime === bookingObj.outboundTripTime
                        );
                        if (!matchedTripTime) {
                            // For return direction ONE_WAY, check arrivalTime
                            matchedTripTime = schedule.tripTimes.find(tt =>
                                tt.arrivalTime === bookingObj.outboundTripTime
                            );
                        }

                        if (matchedTripTime && matchedTripTime.assignedDriver) {
                            const driverId = matchedTripTime.assignedDriver.toString();
                            const partnerId = bookingObj.b2cPartnerId?._id?.toString() || bookingObj.b2cPartnerId?.toString();

                            // Check if driver is B2C Partner (self-driver) or B2CPartnerDriver
                            const isSelf = driverId === partnerId;

                            bookingObj.outboundDriverId = matchedTripTime.assignedDriver;
                            bookingObj.outboundVehicleId = matchedTripTime.assignedVehicle;
                            bookingObj.outboundIsSelfDriver = isSelf;
                            bookingObj.isSelfDriver = isSelf;

                            console.log("[v0] Resolved outbound driver from schedule tripTime:", {
                                driverId,
                                isSelf,
                                outboundTripTime: bookingObj.outboundTripTime
                            });
                        }
                    }
                } catch (scheduleErr) {
                    console.error("[v0] Error resolving schedule driver:", scheduleErr.message);
                }
            }

            // Handle OUTBOUND driver
            if (bookingObj.outboundIsSelfDriver) {
                // Self-driver - get name from User (B2C_PARTNER)
                const outboundId = getDriverId(bookingObj.outboundDriverId);
                if (outboundId) {
                    const partnerUser = await User.findById(outboundId);
                    if (partnerUser) {
                        bookingObj.outboundDriverName = partnerUser.fullName || 'Self-Driving';
                    } else {
                        bookingObj.outboundDriverName = bookingObj.driverName || 'Self-Driving';
                    }
                } else {
                    bookingObj.outboundDriverName = bookingObj.driverName || 'Self-Driving';
                }
            } else if (bookingObj.outboundDriverId) {
                // Assigned driver - could be User._id or B2CPartnerDriver._id
                const outboundId = getDriverId(bookingObj.outboundDriverId);
                if (outboundId) {
                    // First try B2CPartnerDriver (most common case for assigned drivers)
                    const outboundDriver = await B2CPartnerDriver.findById(outboundId);
                    if (outboundDriver) {
                        bookingObj.outboundDriverName = outboundDriver.name;
                        bookingObj.outboundDriverPhone = outboundDriver.phoneNumber;
                        bookingObj.outboundDriverImage = outboundDriver.driverImage?.url;
                    } else {
                        // Fallback: try User collection
                        const driverUser = await User.findById(outboundId);
                        if (driverUser) {
                            bookingObj.outboundDriverName = driverUser.fullName;
                            bookingObj.outboundDriverPhone = driverUser.whatsappNumber;
                            bookingObj.outboundDriverImage = driverUser.profileImage;
                        }
                    }
                }
            }

            // Handle RETURN driver
            if (bookingObj.returnIsSelfDriver) {
                // Self-driver - get name from User (B2C_PARTNER)
                const returnId = getDriverId(bookingObj.returnDriverId);
                if (returnId) {
                    const partnerUser = await User.findById(returnId);
                    if (partnerUser) {
                        bookingObj.returnDriverName = partnerUser.fullName || 'Self-Driving';
                    } else {
                        bookingObj.returnDriverName = bookingObj.driverName || 'Self-Driving';
                    }
                } else {
                    bookingObj.returnDriverName = bookingObj.driverName || 'Self-Driving';
                }
            } else if (bookingObj.returnDriverId) {
                // Assigned driver - could be User._id or B2CPartnerDriver._id
                const returnId = getDriverId(bookingObj.returnDriverId);
                console.log("[v0] Looking up return driver with ID:", returnId);
                if (returnId) {
                    // First try B2CPartnerDriver (most common case for assigned drivers)
                    const returnDriver = await B2CPartnerDriver.findById(returnId);
                    console.log("[v0] B2CPartnerDriver lookup result:", returnDriver ? returnDriver.name : "NOT FOUND");
                    if (returnDriver) {
                        bookingObj.returnDriverName = returnDriver.name;
                        bookingObj.returnDriverPhone = returnDriver.phoneNumber;
                        bookingObj.returnDriverImage = returnDriver.driverImage?.url;
                    } else {
                        // Fallback: try User collection
                        const driverUser = await User.findById(returnId);
                        console.log("[v0] User lookup result:", driverUser ? driverUser.fullName : "NOT FOUND");
                        if (driverUser) {
                            bookingObj.returnDriverName = driverUser.fullName;
                            bookingObj.returnDriverPhone = driverUser.whatsappNumber;
                            bookingObj.returnDriverImage = driverUser.profileImage;
                        }
                    }
                }
            }

            console.log("[v0] Final returnDriverName:", bookingObj.returnDriverName);
            return bookingObj;
        }));

        // Filter bookings based on driver assignment
        const selfDriverBookings = formattedBookings.filter(booking => booking.isSelfDriver);
        const assignedDriverBookings = formattedBookings.filter(booking => !booking.isSelfDriver);

        res.status(200).json({
            success: true,
            data: {
                allBookings: formattedBookings,
                selfDriverBookings, // Bookings where partner is driving
                assignedDriverBookings, // Bookings where assigned drivers are driving
                stats: {
                    total: formattedBookings.length,
                    selfDriver: selfDriverBookings.length,
                    assignedDriver: assignedDriverBookings.length,
                    pending: formattedBookings.filter(b => b.bookingStatus === 'PENDING').length,
                    confirmed: formattedBookings.filter(b => b.bookingStatus === 'CONFIRMED').length,
                    completed: formattedBookings.filter(b => b.bookingStatus === 'COMPLETED').length
                }
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C partner bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message
        });
    }
};

// Get B2C Driver Bookings (for B2C_PARTNER_DRIVER dashboard)
export const getB2CDriverBookings = async (req, res) => {
    try {
        const driverId = req.userId;



        // Get all bookings assigned to this driver
        const bookings = await B2CPassengerBooking.find({
            assignedDriverId: driverId,
            isSelfDriver: false // Only get bookings where they are assigned driver
        })
            .populate('passengerId', 'name email phone')
            .populate('routeId', 'fromLocation toLocation routeName')
            .populate('b2cPartnerId', 'name email businessName')
            .sort({ bookingDate: -1 });



        res.status(200).json({
            success: true,
            data: {
                bookings,
                stats: {
                    total: bookings.length,
                    pending: bookings.filter(b => b.bookingStatus === 'PENDING').length,
                    confirmed: bookings.filter(b => b.bookingStatus === 'CONFIRMED').length,
                    completed: bookings.filter(b => b.bookingStatus === 'COMPLETED').length,
                    today: bookings.filter(b => {
                        const bookingDate = new Date(b.bookingDate);
                        const today = new Date();
                        return bookingDate.toDateString() === today.toDateString();
                    }).length
                }
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C driver bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message
        });
    }
};

// Update Booking Status (for both partner and driver)
export const updateBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status, notes } = req.body;
        const userId = req.userId;



        const booking = await B2CPassengerBooking.findById(bookingId)
            .populate('passengerId', 'name email phone')
            .populate('b2cPartnerId', 'name email phone')
            .populate('assignedDriverId', 'name email phone');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        // Check if user has permission to update this booking
        const canUpdate = booking.b2cPartnerId._id.toString() === userId ||
            booking.assignedDriverId?.toString() === userId;

        if (!canUpdate) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to update this booking"
            });
        }

        // Update booking status
        booking.bookingStatus = status;
        if (notes) booking.notes = notes;
        booking.updatedAt = new Date();

        await booking.save();

        // Send notification to passenger
        // TODO: Implement notification service



        res.status(200).json({
            success: true,
            message: "Booking status updated successfully",
            booking
        });
    } catch (error) {
        console.error("[v0] Error updating booking status:", error);
        res.status(500).json({
            success: false,
            message: "Error updating booking status",
            error: error.message
        });
    }
};

// Get Booking Details (with driver info for passenger)
// Get B2C Partner Driver Bookings (for B2C_PARTNER_DRIVER dashboard)
export const getB2CPartnerDriverBookings = async (req, res) => {
    try {
        const userId = req.userId;

        console.log("[v0] getB2CPartnerDriverBookings called for userId:", userId);

        // First get the B2C_PARTNER_DRIVER user to find their driverId
        const driverUser = await User.findById(userId);

        if (!driverUser || driverUser.role !== "B2C_PARTNER_DRIVER") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only B2C_PARTNER_DRIVER can access this resource."
            });
        }

        const driverId = driverUser.driverId;
        const b2cPartnerId = driverUser.b2cPartnerId;

        console.log("[v0] Driver lookup:", { userId, driverId: driverId?.toString(), b2cPartnerId: b2cPartnerId?.toString() });

        // COMPREHENSIVE QUERY: Find bookings where driver is assigned via ANY of:
        // - assignedDriverId (primary driver assignment)
        // - outboundDriverId (outbound trip driver for ROUND_TRIP)
        // - returnDriverId (return trip driver for ROUND_TRIP)
        // Note: driverId is the B2CPartnerDriver._id (ObjectId), which is what's stored in these fields
        let bookings = await B2CPassengerBooking.find({
            $or: [
                { assignedDriverId: driverId },
                { outboundDriverId: driverId },
                { returnDriverId: driverId }
            ]
        })
            .populate('passengerId', 'fullName email whatsappNumber profileImage countryCode')
            .populate('routeId', 'fromLocation toLocation routeName stops')
            .populate('b2cPartnerId', 'fullName email whatsappNumber profileImage')
            .sort({ bookingDate: -1 });

        console.log("[v0] Bookings found by driver ID query:", bookings.length);
        bookings.forEach(b => {
            console.log("[v0] Booking:", b._id.toString(), "- assignedDriverId:", b.assignedDriverId?.toString(), "outboundDriverId:", b.outboundDriverId?.toString(), "returnDriverId:", b.returnDriverId?.toString());
        });

        // APPROACH 2: If no bookings found, try to find via schedules that have this driver assigned
        if (bookings.length === 0 && driverId) {
            // Import B2CPartnerSchedule model dynamically
            const B2CPartnerSchedule = (await import('../models/B2CPartnerSchedule.js')).default;

            // Find schedules where this driver is assigned (either at schedule level or in tripTimes)
            const driverSchedules = await B2CPartnerSchedule.find({
                $or: [
                    { assignedDriver: driverId },
                    { 'tripTimes.assignedDriver': driverId }
                ],
                isActive: true
            });

            console.log("[v0] Schedules found for driver:", driverSchedules.length);

            if (driverSchedules.length > 0) {
                const scheduleIds = driverSchedules.map(s => s._id);

                // CRITICAL FIX: Find which tripTimes have this driver assigned
                // Then match bookings by their outboundTripTime or returnTripTime
                const driverTripTimes = [];
                for (const schedule of driverSchedules) {
                    for (const tripTime of schedule.tripTimes || []) {
                        if (tripTime.assignedDriver?.toString() === driverId.toString()) {
                            driverTripTimes.push({
                                scheduleId: schedule._id,
                                departureTime: tripTime.departureTime,
                                arrivalTime: tripTime.arrivalTime
                            });
                        }
                    }
                }

                console.log("[v0] Driver assigned tripTimes:", driverTripTimes);

                // Get bookings linked to these schedules AND match their trip times
                const scheduleBookings = await B2CPassengerBooking.find({
                    linkedSchedule: { $in: scheduleIds }
                })
                    .populate('passengerId', 'fullName email whatsappNumber profileImage countryCode')
                    .populate('routeId', 'fromLocation toLocation routeName stops')
                    .populate('b2cPartnerId', 'fullName email whatsappNumber profileImage')
                    .sort({ bookingDate: -1 });

                // Filter bookings to only those where the driver is assigned to their trip time
                bookings = scheduleBookings.filter(booking => {
                    // Check if booking's outboundTripTime or returnTripTime matches driver's assigned times
                    for (const dtt of driverTripTimes) {
                        if (booking.linkedSchedule?.toString() === dtt.scheduleId.toString()) {
                            // For ONE_WAY return direction, outboundTripTime matches arrivalTime
                            if (booking.outboundTripTime === dtt.departureTime ||
                                booking.outboundTripTime === dtt.arrivalTime) {
                                return true;
                            }
                            // For ROUND_TRIP, check returnTripTime as well
                            if (booking.bookingType === 'ROUND_TRIP' &&
                                (booking.returnTripTime === dtt.departureTime ||
                                    booking.returnTripTime === dtt.arrivalTime)) {
                                return true;
                            }
                        }
                    }
                    return false;
                });

                console.log("[v0] Bookings found via schedule tripTime matching:", bookings.length);
            }
        }

        // APPROACH 3: Also check if there are any bookings for routes where this driver's schedule is active
        if (bookings.length === 0 && b2cPartnerId) {
            // Get all bookings for this partner's routes
            const partnerBookings = await B2CPassengerBooking.find({
                b2cPartnerId: b2cPartnerId,
                isSelfDriver: false
            })
                .populate('passengerId', 'fullName email whatsappNumber profileImage countryCode')
                .populate('routeId', 'fromLocation toLocation routeName assignedDriverId stops')
                .populate('b2cPartnerId', 'fullName email whatsappNumber profileImage')
                .sort({ bookingDate: -1 });

            // Filter to bookings where route's assignedDriverId matches this driver
            bookings = partnerBookings.filter(b =>
                b.routeId?.assignedDriverId?.toString() === driverId?.toString()
            );

            console.log("[v0] Bookings found via route.assignedDriverId query:", bookings.length);
        }

        console.log("[v0] Total bookings returning for driver:", bookings.length);

        res.status(200).json({
            success: true,
            data: {
                bookings,
                stats: {
                    total: bookings.length,
                    pending: bookings.filter(b => b.bookingStatus === 'PENDING').length,
                    confirmed: bookings.filter(b => b.bookingStatus === 'CONFIRMED').length,
                    accepted: bookings.filter(b => b.bookingStatus === 'ACCEPTED').length,
                    completed: bookings.filter(b => b.bookingStatus === 'COMPLETED').length,
                    rejected: bookings.filter(b => b.bookingStatus === 'REJECTED').length
                }
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching driver bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching driver bookings",
            error: error.message
        });
    }
};

// Get Passenger Details for a booking (for B2C_PARTNER)
export const getPassengerDetails = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.userId;

        // Find the booking
        const booking = await B2CPassengerBooking.findById(bookingId)
            .populate('passengerId', 'fullName email whatsappNumber profileImage country countryCode status createdAt');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        // Check if user has permission to view this booking's passenger details
        // Only B2C Partner who owns this booking can see passenger details
        const canView = booking.b2cPartnerId?.toString() === userId ||
            booking.partnerId?.toString() === userId;

        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to view passenger details"
            });
        }

        // Get passenger info
        const passenger = booking.passengerId;

        if (!passenger) {
            return res.status(404).json({
                success: false,
                message: "Passenger details not found"
            });
        }

        // Format passenger details
        const passengerDetails = {
            _id: passenger._id,
            fullName: passenger.fullName || "N/A",
            email: passenger.email || "N/A",
            phone: passenger.whatsappNumber || "N/A",
            countryCode: passenger.countryCode || "+971",
            profileImage: passenger.profileImage || null,
            country: passenger.country || "N/A",
            status: passenger.status || "N/A",
            memberSince: passenger.createdAt || null,
        };

        // Include booking summary info
        const bookingInfo = {
            bookingId: booking._id,
            bookingType: booking.bookingType,
            isMonthlyPass: booking.isMonthlyPass,
            numberOfSeats: booking.numberOfSeats,
            pickupLocation: booking.pickupLocation,
            dropoffLocation: booking.dropoffLocation,
            paymentAmount: booking.paymentAmount,
            currency: booking.currency,
            paymentStatus: booking.paymentStatus,
            bookingStatus: booking.bookingStatus,
            travelDate: booking.travelDate,
            bookingDate: booking.bookingDate,
        };

        res.status(200).json({
            success: true,
            data: {
                passenger: passengerDetails,
                booking: bookingInfo
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching passenger details:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching passenger details",
            error: error.message
        });
    }
};

export const getB2CBookingDetails = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.userId;

        let booking = await B2CPassengerBooking.findById(bookingId)
            .populate('passengerId', 'name email phone fullName')
            .populate('b2cPartnerId', 'name email fullName phone profileImage whatsappNumber')
            .populate('assignedDriverId', 'name email phone driverImage phoneNumber fullName whatsappNumber')
            .populate('outboundDriverId', 'fullName email whatsappNumber profileImage driverId')
            .populate('returnDriverId', 'fullName email whatsappNumber profileImage driverId')
            .populate('routeId')
            .populate('linkedSchedule');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        // Check if user has permission to view this booking (before converting to object)
        const canView = booking.passengerId?._id?.toString() === userId ||
            booking.b2cPartnerId?._id?.toString() === userId ||
            booking.assignedDriverId?.toString() === userId;

        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to view this booking"
            });
        }

        // Manually populate assignedVehicle from route if route exists
        let bookingObj = booking.toObject();
        if (bookingObj.routeId?.assignedVehicle) {
            const vehicleId = bookingObj.routeId.assignedVehicle;
            const vehicle = await B2CPartnerVehicle.findById(vehicleId);
            if (vehicle) {
                // Attach vehicle to routeId as populated data
                bookingObj.routeId.assignedVehicle = vehicle.toObject();
            }
        }

        // Use bookingObj from here
        booking = bookingObj;

        // Prepare driver information - use stored fields first, then populated data
        let driverInfo = null;

        if (booking.driverName) {
            // Use directly stored driver info from booking
            driverInfo = {
                name: booking.driverName,
                phone: booking.driverPhoneNumber,
                profileImage: booking.driverImage,
                isSelfDriver: booking.isSelfDriver || false
            };
        } else if (booking.routeId?.assignedDriver) {
            // Get from populated route driver
            const routeDriver = booking.routeId.assignedDriver;
            driverInfo = {
                name: routeDriver.name,
                phone: routeDriver.phoneNumber,
                profileImage: routeDriver.driverImage?.url,
                isSelfDriver: false
            };
        } else if (booking.isSelfDriver && booking.b2cPartnerId) {
            // Partner is driving
            driverInfo = {
                name: booking.b2cPartnerId.businessName || booking.b2cPartnerId.name,
                phone: booking.b2cPartnerId.phone,
                profileImage: booking.b2cPartnerId.profileImage,
                isSelfDriver: true
            };
        }

        // Get vehicle info from route or partner's vehicles
        let vehicleInfo = null;

        if (booking.routeId?.assignedVehicle) {
            // Get vehicle from route
            const vehicle = booking.routeId.assignedVehicle;
            vehicleInfo = {
                model: vehicle.model,
                licensePlate: vehicle.licensePlate,
                vehicleType: vehicle.vehicleType,
                vehicleColor: vehicle.vehicleColor,
                seatingCapacity: vehicle.seatingCapacity,
                image: vehicle.images?.[0]?.url
            };
        }

        // If still no vehicle, try to get partner's vehicle directly
        if (!vehicleInfo && booking.b2cPartnerId) {
            try {
                const partnerId = booking.b2cPartnerId._id || booking.b2cPartnerId;
                // Try to find any active vehicle for this partner
                const partnerVehicle = await B2CPartnerVehicle.findOne({
                    b2cPartnerId: partnerId,
                    isActive: true
                }).sort({ createdAt: -1 });

                if (partnerVehicle) {
                    vehicleInfo = {
                        model: partnerVehicle.model,
                        licensePlate: partnerVehicle.licensePlate,
                        vehicleType: partnerVehicle.vehicleType,
                        vehicleColor: partnerVehicle.vehicleColor,
                        seatingCapacity: partnerVehicle.seatingCapacity,
                        image: partnerVehicle.images?.[0]?.url
                    };
                }
            } catch (vehicleErr) {
                console.error("Error fetching partner vehicle:", vehicleErr.message);
            }
        }

        // Get partner/service provider info - use fullName from User model
        let partnerInfo = null;
        if (booking.b2cPartnerId) {
            partnerInfo = {
                name: booking.b2cPartnerId.fullName || booking.b2cPartnerId.name || "N/A",
                phone: booking.b2cPartnerId.phone,
                email: booking.b2cPartnerId.email
            };
        } else if (booking.routeId?.b2cPartnerId) {
            partnerInfo = {
                name: booking.routeId.b2cPartnerId.fullName || booking.routeId.b2cPartnerId.name || "N/A",
                phone: booking.routeId.b2cPartnerId.phone,
                email: booking.routeId.b2cPartnerId.email
            };
        }

        // CRITICAL: For ROUND_TRIP bookings, check if any trips are "In Progress"
        // This allows tracking even when booking status is COMPLETED
        let hasActiveTripInProgress = false;
        let hasScheduledReturnTripToday = false;
        let activeTripInfo = null;

        // Get today's date range
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Collect all trip IDs
        const bookingTripIds = [];
        if (booking.monthlyTrips) bookingTripIds.push(...booking.monthlyTrips.map(t => t.toString()));
        if (booking.linkedTrip) bookingTripIds.push(booking.linkedTrip.toString());
        if (booking.linkedReturnTrip) bookingTripIds.push(booking.linkedReturnTrip.toString());

        if (bookingTripIds.length > 0) {
            const trips = await B2CPartnerTrip.find({
                _id: { $in: bookingTripIds }
            }).select('_id status tripDate startTime fromLocation toLocation driverId').lean();

            for (const trip of trips) {
                // Check if trip is in progress
                if (trip.status === 'In Progress' || trip.status === 'IN_PROGRESS' || trip.status === 'Started') {
                    hasActiveTripInProgress = true;
                    activeTripInfo = {
                        tripId: trip._id,
                        status: trip.status,
                        startTime: trip.startTime,
                        fromLocation: trip.fromLocation,
                        toLocation: trip.toLocation,
                        driverId: trip.driverId
                    };
                    break;
                }

                // Check for scheduled return trip today
                if (trip.tripDate && booking.bookingType === 'ROUND_TRIP') {
                    const tripDate = new Date(trip.tripDate);
                    if (tripDate >= todayStart && tripDate <= todayEnd &&
                        (trip.status === 'Scheduled' || trip.status === 'SCHEDULED')) {
                        const isReturnTrip = trip.fromLocation === booking.returnPickupLocation ||
                            trip.fromLocation === booking.dropoffLocation;
                        if (isReturnTrip && !activeTripInfo) {
                            hasScheduledReturnTripToday = true;
                            activeTripInfo = {
                                tripId: trip._id,
                                status: 'Scheduled',
                                startTime: trip.startTime,
                                fromLocation: trip.fromLocation,
                                toLocation: trip.toLocation,
                                driverId: trip.driverId,
                                isReturnTrip: true
                            };
                        }
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                booking: {
                    ...booking,
                    driverInfo,
                    vehicleInfo,
                    partnerInfo,
                    hasActiveTripInProgress,
                    hasScheduledReturnTripToday,
                    activeTripInfo
                }
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching booking details:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching booking details",
            error: error.message
        });
    }
};
