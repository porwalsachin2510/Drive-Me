import Trip from "../models/Trip.js";
import Route from "../models/Route.js";
import Contract from "../models/Contract.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import MonthlyPass from "../models/MonthlyPass.js";
import CorporateEmployee from "../models/CorporateEmployee.js";
import { io } from "../index.js";
import { createNotification } from "../Services/notificationService.js";

// @desc    Create recurring trips from route
// @route   POST /api/trips/create-from-route
// @access  Private (CORPORATE only)
// export const createTripsFromRoute = async (req, res) => {
//     try {
//         const corporateId = req.userId;
//         const { 
//             routeId,
//             tripSchedules // Array of { startTime, endTime, tripType, direction }
//         } = req.body;

//         // Validate route belongs to corporate
//         const route = await Route.findOne({ 
//             _id: routeId, 
//             corporateId,
//             status: "ACTIVE" 
//         }).populate("contractId");

//         if (!route) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Route not found or unauthorized"
//             });
//         }

//         // Get contract details
//         const contract = route.contractId;
//         if (!contract || contract.status !== "ACTIVE") {
//             return res.status(400).json({
//                 success: false,
//                 message: "Contract is not active"
//             });
//         }

//         // Find assigned vehicle and driver for this route
//         const assignedVehicle = contract.vehicles.find(v => 
//             v.assignedVehicles.some(av => 
//                 av.routeDetails && av.routeDetails.toString() === routeId
//             )
//         );

//         if (!assignedVehicle) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No vehicle assigned to this route"
//             });
//         }

//         const assignedVehicleDetail = assignedVehicle.assignedVehicles.find(av => 
//             av.routeDetails && av.routeDetails.toString() === routeId
//         );

//         // Create ongoing trips starting from route's routeStartDate
//         const trips = [];
//         const schedulesToUse = tripSchedules && tripSchedules.length > 0 ? tripSchedules : [
//             { startTime: "09:00", endTime: "12:00", tripType: "ONE_WAY", direction: "FORWARD" }
//         ];

//         // Create trips for next 30 days from route start date (ongoing trips)
//         const routeStartDate = new Date(route.routeStartDate);
//         const endDate = new Date(routeStartDate);
//         endDate.setDate(endDate.getDate() + 30); // Create trips for next 30 days

//         for (let date = new Date(routeStartDate); date <= endDate; date.setDate(date.getDate() + 1)) {
//             const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            
//             // Use route's availableDays
//             if (route.availableDays.includes(dayOfWeek)) {
//                 // Create multiple trips for this day based on schedules
//                 for (const schedule of schedulesToUse) {
//                     const tripDate = new Date(date);
//                     const tripDateTime = new Date(tripDate);
                    
//                     // Set time for this specific trip schedule
//                     const [hours, minutes] = schedule.startTime.split(':');
//                     tripDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

//                     // Determine from/to locations based on direction
//                     let fromLocation, toLocation;
//                     if (schedule.direction === "FORWARD") {
//                         fromLocation = route.fromLocation;
//                         toLocation = route.toLocation;
//                     } else {
//                         fromLocation = route.toLocation;
//                         toLocation = route.fromLocation;
//                     }

//                     const trip = new Trip({
//                         contractId: contract._id,
//                         routeId: route._id,
//                         vehicleId: assignedVehicle.vehicleId,
//                         driverId: assignedVehicleDetail.driverId,
//                         corporateId: corporateId,
//                         b2bPartnerId: contract.fleetOwnerId,
                        
//                         tripDate: tripDateTime,
//                         startTime: schedule.startTime,
//                         endTime: schedule.endTime,
//                         fromLocation: fromLocation,
//                         toLocation: toLocation,
//                         totalDistance: route.totalDistance,
//                         estimatedDuration: route.estimatedDuration,
                        
//                         totalSeats: route.totalSeats,
//                         availableSeats: route.availableSeats,
//                         pricePerSeat: route.pricePerSeat,
//                         currency: route.currency,
                        
//                         tripType: schedule.tripType || "ONE_WAY",
//                         direction: schedule.direction,
//                         scheduleIndex: schedulesToUse.indexOf(schedule),
                        
//                         createdBy: corporateId,
//                     });

//                     const savedTrip = await trip.save();
//                     trips.push(savedTrip);

//                     // Send real-time notification to driver
//                     if (assignedVehicleDetail.driverId) {
//                         io.to(`driver_${assignedVehicleDetail.driverId}`).emit('newTripAssigned', {
//                             trip: savedTrip,
//                             message: `New trip assigned: ${fromLocation} → ${toLocation} on ${tripDateTime.toLocaleDateString()} at ${schedule.startTime}`
//                         });
//                     }
//                 }
//             }
//         }

//         res.status(201).json({
//             success: true,
//             message: `Created ${trips.length} trips successfully`,
//             data: { trips }
//         });

//     } catch (error) {
//         console.error("Error creating trips from route:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to create trips"
//         });
//     }
// };

// @desc    Create recurring trips from route
// @route   POST /api/trips/create-from-route
// @access  Private (CORPORATE only)
export const createTripsFromRoute = async (req, res) => {
    try {
        const corporateId = req.userId;
        const {
            routeId,
            tripSchedules // Array of { startTime, endTime, tripType, direction }
        } = req.body;

        // Validate route belongs to corporate
        const route = await Route.findOne({
            _id: routeId,
            corporateId,
            status: "ACTIVE"
        }).populate("contractId");

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found or unauthorized"
            });
        }

        // Get contract details
        const contract = route.contractId;
        if (!contract || contract.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Contract is not active"
            });
        }

        // Find assigned vehicle and driver for this route
        const assignedVehicle = contract.vehicles.find(v =>
            v.assignedVehicles.some(av =>
                av.routeDetails && av.routeDetails.toString() === routeId
            )
        );

        if (!assignedVehicle) {
            return res.status(400).json({
                success: false,
                message: "No vehicle assigned to this route"
            });
        }

        const assignedVehicleDetail = assignedVehicle.assignedVehicles.find(av =>
            av.routeDetails && av.routeDetails.toString() === routeId
        );

        // Create ongoing trips starting from route's routeStartDate
        const trips = [];
        const schedulesToUse = tripSchedules && tripSchedules.length > 0 ? tripSchedules : [
            { startTime: "09:00", endTime: "12:00", tripType: "ONE_WAY", direction: "FORWARD" }
        ];

        // Create trips for next 30 days from route start date (ongoing trips)
        const routeStartDate = new Date(route.routeStartDate);
        const endDate = new Date(routeStartDate);
        endDate.setDate(endDate.getDate() + 30); // Create trips for next 30 days

        for (let date = new Date(routeStartDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

            // Use route's availableDays
            if (route.availableDays.includes(dayOfWeek)) {
                // Create multiple trips for this day based on schedules
                for (const schedule of schedulesToUse) {
                    const tripDate = new Date(date);
                    const tripDateTime = new Date(tripDate);

                    // Set time for this specific trip schedule
                    const [hours, minutes] = schedule.startTime.split(':');
                    tripDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                    // Determine from/to locations based on direction
                    let fromLocation, toLocation;
                    if (schedule.direction === "FORWARD") {
                        fromLocation = route.fromLocation;
                        toLocation = route.toLocation;
                    } else {
                        fromLocation = route.toLocation;
                        toLocation = route.fromLocation;
                    }

                    // Check vehicle assignment rule for driver assignment
                    let driverId = null;
                    let driverStatus = "UNASSIGNED";

                    if (assignedVehicleDetail.driverAssignedBy === "WITH_DRIVER" ||
                        (assignedVehicleDetail.driverAssignedBy !== "WITHOUT_DRIVER" && assignedVehicleDetail.driverId)) {
                        // Auto-assign driver if vehicle assignment has a driver
                        driverId = assignedVehicleDetail.driverId;
                        driverStatus = "ASSIGNED";
                    } else if (assignedVehicleDetail.driverAssignedBy === "WITHOUT_DRIVER") {
                        // Driver will be assigned separately by corporate admin
                        driverStatus = "PENDING_ASSIGNMENT";
                    }

                    const trip = new Trip({
                        contractId: contract._id,
                        routeId: route._id,
                        vehicleId: assignedVehicle.vehicleId,
                        driverId: driverId,
                        driverStatus: driverStatus,
                        corporateId: corporateId,
                        b2bPartnerId: contract.fleetOwnerId,

                        tripDate: tripDateTime,
                        startTime: schedule.startTime,
                        endTime: schedule.endTime,
                        fromLocation: fromLocation,
                        toLocation: toLocation,
                        totalDistance: route.totalDistance,
                        estimatedDuration: route.estimatedDuration,

                        totalSeats: route.totalSeats,
                        availableSeats: route.availableSeats,
                        pricePerSeat: route.pricePerSeat,
                        currency: route.currency,

                        tripType: schedule.tripType || "ONE_WAY",
                        direction: schedule.direction,
                        scheduleIndex: schedulesToUse.indexOf(schedule),

                        createdBy: corporateId,
                    });

                    const savedTrip = await trip.save();
                    trips.push(savedTrip);

                    // Send real-time notification to driver if auto-assigned
                    if (driverId && driverStatus === "ASSIGNED") {
                        io.to(`driver_${driverId}`).emit('newTripAssigned', {
                            trip: savedTrip,
                            message: `New trip assigned: ${fromLocation} → ${toLocation} on ${tripDateTime.toLocaleDateString()} at ${schedule.startTime}`
                        });
                    } else if (driverStatus === "PENDING_ASSIGNMENT") {
                        // Notify corporate admin to assign driver
                        io.to(`corporate_${corporateId}`).emit('tripNeedsDriverAssignment', {
                            tripId: savedTrip._id,
                            message: `Trip requires driver assignment: ${fromLocation} → ${toLocation}`
                        });
                    }
                }
            }
        }

        res.status(201).json({
            success: true,
            message: `Created ${trips.length} trips successfully`,
            data: { trips }
        });

    } catch (error) {
        console.error("Error creating trips from route:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create trips"
        });
    }
};

// @desc    Get available trips for corporate employees
// @route   GET /api/trips/available
// @access  Private (CORPORATE employees only)
export const getAvailableTrips = async (req, res) => {
    try {
        const employeeId = req.userId;
        const { date, fromLocation, toLocation } = req.query;

        // Get employee details
        const employee = await User.findById(employeeId);
        if (!employee || !["CORPORATE_DRIVER", "CORPORATE", "CORPORATE_EMPLOYEE"].includes(employee.role)) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        // Build query
        const query = {
            corporateId: employee.companyId || employee._id,
            status: "SCHEDULED",
            availableSeats: { $gt: 0 },
            tripDate: { $gte: new Date().setHours(0, 0, 0, 0) }
        };

        if (date) {
            const targetDate = new Date(date);
            query.tripDate = {
                $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                $lt: new Date(targetDate.setHours(23, 59, 59, 999))
            };
        }

        if (fromLocation) {
            query.fromLocation = { $regex: fromLocation, $options: 'i' };
        }

        if (toLocation) {
            query.toLocation = { $regex: toLocation, $options: 'i' };
        }

        const trips = await Trip.find(query)
            .populate('routeId', 'stopPoints estimatedDuration fromLocation toLocation')
            .populate('vehicleId', 'make model licensePlate vehicleName')
            .populate('driverId', 'fullName phone')
            .sort({ tripDate: 1, startTime: 1 });

        // Enrich trips with stopPoints from route for pickup selection
        const enrichedTrips = trips.map(trip => {
            const tripObj = trip.toObject();
            tripObj.stopPoints = trip.routeId?.stopPoints || [];
            return tripObj;
        });

        res.json({
            success: true,
            data: { trips: enrichedTrips }
        });

    } catch (error) {
        console.error("Error fetching available trips:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trips"
        });
    }
};

// @desc    Book a seat on a trip
// @route   POST /api/trips/:tripId/book
// @access  Private (CORPORATE employees only)
export const bookTripSeat = async (req, res) => {
    try {
        const employeeId = req.userId;
        const { tripId } = req.params;
        const { pickupPoint, pickupTime, seatNumber, useMonthlyPass } = req.body;

        // Get employee details
        const employee = await User.findById(employeeId);
        if (!employee || !["CORPORATE_DRIVER", "CORPORATE", "CORPORATE_EMPLOYEE"].includes(employee.role)) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        // Get trip details
        const trip = await Trip.findById(tripId)
            .populate('routeId', 'stopPoints');

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        // Check if trip is available for booking
        if (trip.status !== "SCHEDULED") {
            return res.status(400).json({
                success: false,
                message: "Trip is not available for booking"
            });
        }

        if (trip.availableSeats <= 0) {
            return res.status(400).json({
                success: false,
                message: "No seats available"
            });
        }

        // Check if employee already booked this trip
        const existingBooking = trip.passengers.find(p => 
            p.employeeId.toString() === employeeId
        );

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: "You have already booked this trip"
            });
        }

        // Validate pickup point - check stopPoints if available, or allow fromLocation/toLocation
        const stopPoints = trip.routeId?.stopPoints || [];
        const stopPoint = stopPoints.find(sp => sp.location === pickupPoint);
        
        // If no stop points on route or pickup matches from/to location, allow it
        if (!stopPoint && stopPoints.length > 0) {
            // Check if pickup matches trip's from/to location as fallback
            if (pickupPoint !== trip.fromLocation && pickupPoint !== trip.toLocation) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid pickup point"
                });
            }
        }

        // Handle monthly pass - only check if explicitly requested
        let monthlyPass = null;
        if (useMonthlyPass === true) {
            try {
                monthlyPass = await MonthlyPass.findOne({
                    employeeId,
                    status: "ACTIVE",
                    validFrom: { $lte: trip.tripDate },
                    validTo: { $gte: trip.tripDate },
                    routeId: trip.routeId
                });
            } catch (e) {
                // MonthlyPass collection may not exist
            }

            if (!monthlyPass) {
                return res.status(400).json({
                    success: false,
                    message: "No active monthly pass found for this route"
                });
            }

            if (monthlyPass.remainingTrips <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "No trips remaining in your monthly pass"
                });
            }
        }

        // Add passenger to trip
        const passenger = {
            employeeId,
            seatNumber,
            pickupPoint,
            pickupTime: stopPoint?.time || pickupTime || trip.startTime,
            bookingStatus: "CONFIRMED",
            bookedAt: new Date(),
            monthlyPass: monthlyPass?._id
        };

        trip.passengers.push(passenger);
        trip.availableSeats -= 1;
        trip.bookedSeats += 1;

        // Update monthly pass if used
        if (monthlyPass) {
            monthlyPass.usedTrips += 1;
            monthlyPass.remainingTrips -= 1;
            await monthlyPass.save();
        }

        await trip.save();

        // Notify driver about new booking
        if (trip.driverId) {
            io.to(`driver-${trip.driverId}`).emit('passenger-booked', {
                tripId: trip._id,
                passenger: {
                    employeeId,
                    seatNumber,
                    pickupPoint,
                    pickupTime: stopPoint?.time || pickupTime || trip.startTime
                }
            });
        }

        res.json({
            success: true,
            message: "Seat booked successfully",
            data: {
                trip,
                booking: passenger,
                usedMonthlyPass: !!monthlyPass
            }
        });

    } catch (error) {
        console.error("Error booking trip seat:", error);
        res.status(500).json({
            success: false,
            message: "Failed to book seat"
        });
    }
};

// @desc    Cancel trip booking
// @route   DELETE /api/trips/:tripId/cancel
// @access  Private (CORPORATE employees only)
export const cancelTripBooking = async (req, res) => {
    try {
        const employeeId = req.userId;
        const { tripId } = req.params;

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        // Find and remove passenger
        const passengerIndex = trip.passengers.findIndex(p => 
            p.employeeId.toString() === employeeId
        );

        if (passengerIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        const passenger = trip.passengers[passengerIndex];

        // Restore monthly pass if used
        if (passenger.monthlyPass) {
            const monthlyPass = await MonthlyPass.findById(passenger.monthlyPass);
            if (monthlyPass) {
                monthlyPass.usedTrips -= 1;
                monthlyPass.remainingTrips += 1;
                await monthlyPass.save();
            }
        }

        // Remove passenger and restore seat
        trip.passengers.splice(passengerIndex, 1);
        trip.availableSeats += 1;
        trip.bookedSeats -= 1;

        await trip.save();

        // Notify driver about cancellation
        io.to(`driver-${trip.driverId}`).emit('passenger-cancelled', {
            tripId: trip._id,
            employeeId
        });

        res.json({
            success: true,
            message: "Booking cancelled successfully"
        });

    } catch (error) {
        console.error("Error cancelling trip booking:", error);
        res.status(500).json({
            success: false,
            message: "Failed to cancel booking"
        });
    }
};

// @desc    Get employee's trip bookings
// @route   GET /api/trips/my-bookings
// @access  Private (CORPORATE employees only)
export const getMyBookings = async (req, res) => {
    try {
        const employeeId = req.userId;
        const { status, date } = req.query;

        // Build query - only show upcoming active bookings, not completed
        const query = { 
            "passengers.employeeId": employeeId,
            status: { $in: ['SCHEDULED', 'IN_PROGRESS'] }
        };

        if (status) {
            query.status = status;
        }

        if (date) {
            const targetDate = new Date(date);
            query.tripDate = {
                $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                $lt: new Date(targetDate.setHours(23, 59, 59, 999))
            };
        }

        const trips = await Trip.find(query)
            .populate('routeId', 'fromLocation toLocation stopPoints')
            .populate('vehicleId', 'vehicleName registrationNumber vehicleCategory model licensePlate')
            .populate('driverId', 'name email phone fullName whatsappNumber')
            .sort({ tripDate: 1 });

        // Resolve driver names and add seat info
        const myBookings = await Promise.all(trips.map(async (trip) => {
            const myPassenger = trip.passengers.find(p => 
                p.employeeId.toString() === employeeId
            );

            // Skip if passenger not found (safety check)
            if (!myPassenger) {
                return null;
            }

            const tripObj = trip.toObject();

            // Resolve driver name - try multiple sources
            let driverName = null;
            let driverContact = null;
            const populatedDriver = tripObj.driverId;

            // 1. Check if populate worked (populated object has _id and name/fullName)
            if (populatedDriver && typeof populatedDriver === 'object' && populatedDriver._id) {
                driverName = populatedDriver.name || populatedDriver.fullName || null;
                driverContact = populatedDriver.phone || populatedDriver.whatsappNumber || null;
            }

            // 2. If no name yet, check if driverId is actually a Driver model ObjectId
            if (!driverName && populatedDriver) {
                const driverObjectId = (typeof populatedDriver === 'object' && populatedDriver._id) ? populatedDriver._id : populatedDriver;
                if (driverObjectId) {
                    try {
                        // Check Driver model directly
                        const driverDoc = await Driver.findById(driverObjectId).select('name phone email');
                        if (driverDoc) {
                            driverName = driverDoc.name;
                            driverContact = driverDoc.phone || driverContact;
                        }
                    } catch (e) {
                        console.log("[v0] Driver lookup failed:", e.message);
                    }
                }
            }

            // 3. If still no name, find the User account that has this driverId
            if (!driverName && populatedDriver) {
                const driverObjectId = (typeof populatedDriver === 'object' && populatedDriver._id) ? populatedDriver._id : populatedDriver;
                if (driverObjectId) {
                    try {
                        const driverUser = await User.findOne({ driverId: driverObjectId }).select('fullName whatsappNumber phone');
                        if (driverUser) {
                            driverName = driverUser.fullName;
                            driverContact = driverUser.whatsappNumber || driverUser.phone || driverContact;
                        }
                    } catch (e) {
                        console.log("[v0] User lookup failed:", e.message);
                    }
                }
            }

            // 4. Last resort: look up the User directly by _id (if driverId IS a User _id)
            if (!driverName && populatedDriver) {
                const driverObjectId = (typeof populatedDriver === 'object' && populatedDriver._id) ? populatedDriver._id : populatedDriver;
                if (driverObjectId) {
                    try {
                        const userDoc = await User.findById(driverObjectId).select('fullName whatsappNumber phone');
                        if (userDoc) {
                            driverName = userDoc.fullName;
                            driverContact = userDoc.whatsappNumber || userDoc.phone || driverContact;
                        }
                    } catch (e) {
                        console.log("[v0] User direct lookup failed:", e.message);
                    }
                }
            }

            return {
                ...tripObj,
                driverId: (populatedDriver && typeof populatedDriver === 'object') ? populatedDriver._id : populatedDriver,
                driverName: driverName || 'Not assigned',
                driverContact: driverContact || 'Not available',
                vehicleName: tripObj.vehicleId?.vehicleName || tripObj.vehicleId?.model || 'Not assigned',
                vehicleNumber: tripObj.vehicleId?.registrationNumber || tripObj.vehicleId?.licensePlate || 'Not assigned',
                seatNumber: myPassenger?.seatNumber || 'N/A',
                pickupPoint: myPassenger?.pickupPoint || 'Not specified',
                pickupTime: myPassenger?.pickupTime || 'Not specified',
                myBooking: myPassenger
            };
        })).then(results => results.filter(b => b !== null)); // Filter out null entries

        res.json({
            success: true,
            data: { bookings: myBookings }
        });

    } catch (error) {
        console.error("Error fetching my bookings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings"
        });
    }
};

// @desc    Start trip (Driver only)
// @route   POST /api/trips/:tripId/start
// @access  Private (Driver only)
export const startTrip = async (req, res) => {
    try {
        const driverId = req.userId;
        const { tripId } = req.params;

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        if (trip.driverId.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        if (trip.status !== "SCHEDULED") {
            return res.status(400).json({
                success: false,
                message: "Trip cannot be started"
            });
        }

        // Update trip status
        trip.status = "IN_PROGRESS";
        
        // Add trip event
        trip.events.push({
            eventType: "TRIP_STARTED",
            timestamp: new Date(),
            description: "Trip started by driver",
            location: trip.fromLocation
        });

        await trip.save();

        // Notify all passengers via socket AND persistent notification
        for (const passenger of trip.passengers) {
            if (passenger.employeeId) {
                // Socket notification
                io.to(`notifications-${passenger.employeeId}`).emit('trip-started', {
                    tripId: trip._id,
                    startTime: new Date(),
                    driverLocation: trip.driverLocation
                });

                // Find the user account for this employee to create persistent notification
                try {
                    const employee = await CorporateEmployee.findById(passenger.employeeId).select('userId');
                    const notifUserId = employee?.userId || passenger.employeeId;
                    await createNotification({
                        userId: notifUserId,
                        type: "TRIP_STARTED",
                        title: "Trip Started",
                        message: `Your trip from ${trip.fromLocation || 'pickup'} to ${trip.toLocation || 'destination'} has started`,
                        data: {
                            tripId: trip._id,
                            fromLocation: trip.fromLocation,
                            toLocation: trip.toLocation
                        }
                    });
                } catch (notifErr) {
                    console.error("Error creating trip start notification:", notifErr);
                }
            }
        }

        res.json({
            success: true,
            message: "Trip started successfully",
            data: { trip }
        });

    } catch (error) {
        console.error("Error starting trip:", error);
        res.status(500).json({
            success: false,
            message: "Failed to start trip"
        });
    }
};

// @desc    Complete trip (Driver only)
// @route   POST /api/trips/:tripId/complete
// @access  Private (Driver only)
export const completeTrip = async (req, res) => {
    try {
        const driverId = req.userId;
        const { tripId } = req.params;

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        if (trip.driverId.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        if (trip.status !== "IN_PROGRESS") {
            return res.status(400).json({
                success: false,
                message: "Trip is not in progress"
            });
        }

        // Update trip status
        trip.status = "COMPLETED";
        
        // Add trip event
        trip.events.push({
            eventType: "TRIP_COMPLETED",
            timestamp: new Date(),
            description: "Trip completed successfully",
            location: trip.toLocation
        });

        await trip.save();

        // Notify all passengers via socket AND persistent notification
        for (const passenger of trip.passengers) {
            if (passenger.employeeId) {
                io.to(`notifications-${passenger.employeeId}`).emit('trip-completed', {
                    tripId: trip._id,
                    completionTime: new Date()
                });

                try {
                    const employee = await CorporateEmployee.findById(passenger.employeeId).select('userId');
                    const notifUserId = employee?.userId || passenger.employeeId;
                    await createNotification({
                        userId: notifUserId,
                        type: "TRIP_COMPLETED",
                        title: "Trip Completed",
                        message: `Your trip from ${trip.fromLocation || 'pickup'} to ${trip.toLocation || 'destination'} has been completed`,
                        data: {
                            tripId: trip._id,
                            fromLocation: trip.fromLocation,
                            toLocation: trip.toLocation
                        }
                    });
                } catch (notifErr) {
                    console.error("Error creating trip complete notification:", notifErr);
                }
            }
        }

        res.json({
            success: true,
            message: "Trip completed successfully",
            data: { trip }
        });

    } catch (error) {
        console.error("Error completing trip:", error);
        res.status(500).json({
            success: false,
            message: "Failed to complete trip"
        });
    }
};

// @desc    Update driver location (Real-time tracking)
// @route   POST /api/trips/:tripId/location
// @access  Private (Driver only)
export const updateDriverLocation = async (req, res) => {
    try {
        const driverId = req.userId;
        const { tripId } = req.params;
        const { lat, lng } = req.body;

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        if (trip.driverId.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        // Update driver location
        trip.driverLocation = {
            lat,
            lng,
            lastUpdated: new Date()
        };

        await trip.save();

        // Broadcast location to all passengers
        trip.passengers.forEach(passenger => {
            io.to(`notifications-${passenger.employeeId}`).emit('driver-location-update', {
                tripId: trip._id,
                location: { lat, lng },
                timestamp: new Date()
            });
        });

        res.json({
            success: true,
            message: "Location updated successfully"
        });

    } catch (error) {
        console.error("Error updating driver location:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update location"
        });
    }
};

// @desc    Get corporate trips (Corporate admin)
// @route   GET /api/trips/corporate
// @access  Private (Corporate admin only)
export const getCorporateTrips = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { date, status, vehicleId } = req.query;

        // Build query
        const query = { corporateId };

        if (date) {
            const targetDate = new Date(date);
            query.tripDate = {
                $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                $lt: new Date(targetDate.setHours(23, 59, 59, 999))
            };
        }

        if (status) {
            query.status = status;
        }

        if (vehicleId) {
            query.vehicleId = vehicleId;
        }

        const trips = await Trip.find(query)
            .populate('routeId', 'fromLocation toLocation totalDistance')
            .populate('vehicleId', 'make model licensePlate')
            .populate('driverId', 'fullName phone')
            .populate('passengers.employeeId', 'fullName email')
            .sort({ tripDate: -1, startTime: -1 });

        res.json({
            success: true,
            data: { trips }
        });

    } catch (error) {
        console.error("Error fetching corporate trips:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trips"
        });
    }
};

// @desc    Assign driver to a trip
// @route   POST /api/trips/:tripId/assign-driver
// @access  Private (Corporate admin or B2B Partner)
export const assignDriverToTrip = async (req, res) => {
    try {
        const userId = req.userId;
        const { tripId } = req.params;
        const { driverId } = req.body;

        // Get trip details
        const trip = await Trip.findById(tripId).populate('contractId');
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        // Verify authorization - must be corporate owner or fleet owner
        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        const isAuthorized =
            trip.corporateId.toString() === userId ||
            trip.b2bPartnerId.toString() === userId ||
            user.role === "ADMIN";

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to assign drivers for this trip"
            });
        }

        // Get driver details
        const driver = await User.findById(driverId);
        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        // Validate driver role
        const validRoles = ["B2C_PARTNER_DRIVER", "B2B_PARTNER_DRIVER", "CORPORATE_DRIVER"];
        if (!validRoles.includes(driver.role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid driver role for assignment"
            });
        }

        // Check if trip already has a driver assigned
        if (trip.driverId) {
            return res.status(400).json({
                success: false,
                message: "A driver is already assigned to this trip"
            });
        }

        // Verify vehicle assignment details if from contract
        if (trip.contractId) {
            const contract = await Contract.findById(trip.contractId);
            if (contract) {
                const vehicleAssignment = contract.vehicles
                    .flatMap(v => v.assignedVehicles)
                    .find(av => av.vehicleId.toString() === trip.vehicleId.toString());

                if (!vehicleAssignment) {
                    return res.status(400).json({
                        success: false,
                        message: "Vehicle not found in contract assignments"
                    });
                }

                // Check with/without driver flag
                if (vehicleAssignment.driverAssignedBy === "B2B_PARTNER" &&
                    !["B2B_PARTNER_DRIVER", "B2C_PARTNER_DRIVER"].includes(driver.role)) {
                    return res.status(400).json({
                        success: false,
                        message: "Driver must be from B2B Partner for this vehicle assignment"
                    });
                }

                if (vehicleAssignment.driverAssignedBy === "CORPORATE" &&
                    driver.role !== "CORPORATE_DRIVER") {
                    return res.status(400).json({
                        success: false,
                        message: "Driver must be a Corporate Driver for this vehicle assignment"
                    });
                }
            }
        }

        // Assign driver to trip
        trip.driverId = driverId;
        trip.driverStatus = "ASSIGNED";

        // Add assignment event
        trip.events.push({
            eventType: "DRIVER_ASSIGNED",
            timestamp: new Date(),
            description: `Driver ${driver.fullName} assigned to trip`,
            location: trip.fromLocation
        });

        await trip.save();

        // Notify driver via socket
        io.to(`driver_${driverId}`).emit('trip-assigned', {
            tripId: trip._id,
            trip: {
                fromLocation: trip.fromLocation,
                toLocation: trip.toLocation,
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                endTime: trip.endTime,
                totalSeats: trip.totalSeats,
                passengers: trip.passengers.length
            },
            message: `You have been assigned to a new trip`
        });

        res.json({
            success: true,
            message: "Driver assigned to trip successfully",
            data: {
                trip: trip.toObject(),
                assignedDriver: {
                    _id: driver._id,
                    fullName: driver.fullName,
                    phone: driver.phone,
                    role: driver.role
                }
            }
        });

    } catch (error) {
        console.error("Error assigning driver to trip:", error);
        res.status(500).json({
            success: false,
            message: "Failed to assign driver to trip"
        });
    }
};
