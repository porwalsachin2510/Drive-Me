import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import User from "../models/User.js";
import { generateTripsForSchedule } from "../Services/tripGenerationService.js";

// Create Passenger Booking (ONE-WAY or ROUND-TRIP)
export const createPassengerBooking = async (req, res) => {
    try {
        console.log("[v0] Creating Passenger Booking:", JSON.stringify(req.body, null, 2));
        
        const {
            routeId,
            scheduleId,
            bookingType, // "ONE_WAY" or "ROUND_TRIP"
            pickupLocation,
            dropoffLocation,
            travelDate,
            numberOfSeats,
            paymentMethod
        } = req.body;

        // Validate required fields
        if (!routeId || !scheduleId || !bookingType || !pickupLocation || !dropoffLocation || !travelDate || !numberOfSeats || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // Get route and schedule details
        const route = await B2CPartnerRoute.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        // Find the specific schedule
        const schedule = await B2CPartnerSchedule.findById(scheduleId)
            .populate('routeId')
            .populate('assignedVehicle')
            .populate('assignedDriver');

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: "Schedule not found"
            });
        }

        // Ensure trip exists for travel date
        await generateTripsForSchedule(scheduleId, 1);
        
        const tripDate = new Date(travelDate);
        const trip = await B2CPartnerTrip.findOne({
            routeId: routeId,
            scheduleId: scheduleId,
            tripDate: {
                $gte: new Date(tripDate.setHours(0, 0, 0, 0)),
                $lt: new Date(tripDate.setHours(23, 59, 59, 999))
            }
        });

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not available for this date"
            });
        }

        // Check seat availability
        if (trip.availableSeats < numberOfSeats) {
            return res.status(400).json({
                success: false,
                message: `Only ${trip.availableSeats} seats available`
            });
        }

        // Calculate pricing - ONLY MONTHLY PASSES
        let totalAmount = 0;
        const isMonthly = req.body.isMonthly || true; // Default to monthly
        
        if (isMonthly) {
            if (bookingType === "ONE_WAY") {
                totalAmount = route.pricing.monthlyPrice * numberOfSeats;
            } else if (bookingType === "ROUND_TRIP") {
                totalAmount = (route.pricing.monthlyRoundTripPrice || route.pricing.monthlyPrice * 1.5) * numberOfSeats;
            }
        }

        // Create booking record
        const bookingData = {
            passengerId: req.userId,
            b2cPartnerId: route.b2cPartnerId,
            routeId: routeId,
            scheduleId: scheduleId,
            partnerId: route.b2cPartnerId,
            pickupLocation,
            dropoffLocation,
            bookingDate: new Date(),
            travelDate: new Date(travelDate),
            numberOfSeats: parseInt(numberOfSeats),
            paymentAmount: totalAmount,
            paymentMethod,
            paymentStatus: "PENDING",
            bookingStatus: "CONFIRMED",
            bookingType: bookingType, // "ONE_WAY" or "ROUND_TRIP"
            isMonthly: true,
            // Schedule and timing information
            scheduleTime: schedule.scheduleTime,
            tripStartTime: trip.startTime,
            fromLocation: route.fromLocation,
            toLocation: route.toLocation,
            routeName: `${route.fromLocation} → ${route.toLocation}`,
            // Store vehicle and driver info
            vehicleModel: schedule.assignedVehicle?.model || "",
            vehiclePlate: schedule.assignedVehicle?.licensePlate || "",
            driverName: schedule.assignedDriver?.name || "",
            driverPhoneNumber: schedule.assignedDriver?.phoneNumber || "",
            driverImage: schedule.assignedDriver?.driverImage?.url || "",
            // Monthly pass validity
            passStartDate: new Date(travelDate),
            passEndDate: new Date(new Date(travelDate).setDate(new Date(travelDate).getDate() + 30)),
            // For round trip, create return booking
            returnScheduleTime: bookingType === "ROUND_TRIP" ? "06:00 PM" : null
        };

        const booking = await B2CPassengerBooking.create(bookingData);

        // Update trip seats
        const newBookedSeats = trip.bookedSeats + numberOfSeats;
        const newAvailableSeats = trip.totalSeats - newBookedSeats;
        
        await B2CPartnerTrip.findByIdAndUpdate(trip._id, {
            bookedSeats: newBookedSeats,
            availableSeats: newAvailableSeats
        });

        // For ROUND_TRIP, create return booking
        if (bookingType === "ROUND_TRIP") {
            // Find return schedule (usually evening schedule for same route)
            const returnSchedule = await B2CPartnerSchedule.findOne({
                routeId: routeId,
                b2cPartnerId: route.b2cPartnerId,
                isActive: true,
                scheduleTime: "06:00 PM" // Default return time
            }).populate('assignedVehicle assignedDriver');

            if (returnSchedule) {
                // Ensure return trip exists
                await generateTripsForSchedule(returnSchedule._id, 1);
                
                const returnTrip = await B2CPartnerTrip.findOne({
                    routeId: routeId,
                    scheduleId: returnSchedule._id,
                    tripDate: {
                        $gte: new Date(tripDate.setHours(0, 0, 0, 0)),
                        $lt: new Date(tripDate.setHours(23, 59, 59, 999))
                    }
                });

                if (returnTrip && returnTrip.availableSeats >= numberOfSeats) {
                    // Create return booking
                    const returnBookingData = {
                        ...bookingData,
                        _id: undefined, // Let MongoDB create new ID
                        pickupLocation: dropoffLocation, // Swap pickup/dropoff
                        dropoffLocation: pickupLocation,
                        scheduleId: returnSchedule._id,
                        scheduleTime: returnSchedule.scheduleTime,
                        tripStartTime: returnTrip.startTime,
                        returnScheduleTime: null, // No return for return trip
                        vehicleModel: returnSchedule.assignedVehicle?.model || "",
                        vehiclePlate: returnSchedule.assignedVehicle?.licensePlate || "",
                        driverName: returnSchedule.assignedDriver?.name || "",
                        driverPhoneNumber: returnSchedule.assignedDriver?.phoneNumber || "",
                        driverImage: returnSchedule.assignedDriver?.driverImage?.url || "",
                        parentBookingId: booking._id // Link to main booking
                    };

                    await B2CPassengerBooking.create(returnBookingData);

                    // Update return trip seats
                    await B2CPartnerTrip.findByIdAndUpdate(returnTrip._id, {
                        bookedSeats: returnTrip.bookedSeats + numberOfSeats,
                        availableSeats: returnTrip.totalSeats - (returnTrip.bookedSeats + numberOfSeats)
                    });
                }
            }
        }

        console.log("[v0] Monthly pass booking created successfully:", booking._id);
        
        res.status(201).json({
            success: true,
            message: "Monthly pass booking created successfully",
            data: {
                booking: booking,
                scheduleTime: schedule.scheduleTime,
                routeName: `${route.fromLocation} → ${route.toLocation}`,
                passValidity: {
                    startDate: bookingData.passStartDate,
                    endDate: bookingData.passEndDate
                },
                travelTimes: {
                    goingTime: schedule.scheduleTime,
                    returnTime: bookingType === "ROUND_TRIP" ? "06:00 PM" : null
                }
            }
        });

    } catch (error) {
        console.error("[v0] Error creating passenger booking:", error.message);
        res.status(500).json({
            success: false,
            message: "Error creating booking",
            error: error.message
        });
    }
};

// Get passenger bookings
export const getPassengerBookings = async (req, res) => {
    try {
        const bookings = await B2CPassengerBooking.find({
            passengerId: req.userId
        })
            .populate({
                path: 'routeId',
                select: 'fromLocation toLocation assignedVehicle assignedDriver',
                populate: [
                    { path: 'assignedVehicle', select: 'model licensePlate vehicleType vehicleColor' },
                    { path: 'assignedDriver', select: 'name phoneNumber driverImage' }
                ]
            })
            .populate('b2cPartnerId', 'fullName email businessName name phone')
            .sort({ travelDate: -1 });

        // Enrich bookings with vehicle and driver info from route if not already present
        const enrichedBookings = bookings.map(booking => {
            const bookingObj = booking.toObject();

            // Get vehicle info from route if not stored on booking
            if (!bookingObj.vehicleModel && bookingObj.routeId?.assignedVehicle) {
                bookingObj.vehicleModel = bookingObj.routeId.assignedVehicle.model;
                bookingObj.vehiclePlate = bookingObj.routeId.assignedVehicle.licensePlate;
                bookingObj.vehicleType = bookingObj.routeId.assignedVehicle.vehicleType;
                bookingObj.vehicleColor = bookingObj.routeId.assignedVehicle.vehicleColor;
            }

            // Get driver info from route if not stored on booking
            if (!bookingObj.driverName && bookingObj.routeId?.assignedDriver) {
                bookingObj.driverName = bookingObj.routeId.assignedDriver.name;
                bookingObj.driverPhoneNumber = bookingObj.routeId.assignedDriver.phoneNumber;
                bookingObj.driverImage = bookingObj.routeId.assignedDriver.driverImage?.url;
            }

            return bookingObj;
        });

        res.status(200).json({
            success: true,
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error("[v0] Error fetching passenger bookings:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message
        });
    }
};

// Get available trips for a route on specific date
export const getAvailableTrips = async (req, res) => {
    try {
        const { routeId, date } = req.query;
        
        if (!routeId || !date) {
            return res.status(400).json({
                success: false,
                message: "Route ID and date are required"
            });
        }

        const targetDate = new Date(date);
        const trips = await B2CPartnerTrip.find({
            routeId: routeId,
            tripDate: {
                $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                $lt: new Date(targetDate.setHours(23, 59, 59, 999))
            },
            status: { $in: ["Scheduled", "In Progress"] }
        })
        .populate('vehicleId', 'model licensePlate')
        .populate('driverId', 'name phoneNumber')
        .sort({ startTime: 1 });

        res.status(200).json({
            success: true,
            trips,
            date: targetDate
        });

    } catch (error) {
        console.error("[v0] Error fetching available trips:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching trips",
            error: error.message
        });
    }
};
