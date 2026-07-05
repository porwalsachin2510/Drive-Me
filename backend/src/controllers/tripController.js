import Trip from "../models/Trip.js";
import Route from "../models/Route.js";
import Contract from "../models/Contract.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import MonthlyPass from "../models/MonthlyPass.js";
import CorporateEmployee from "../models/CorporateEmployee.js";
import { io } from "../index.js";
import { createNotification, sendRealTimeNotification, sendAdminNotification } from "../Services/notificationService.js";
import { broadcastManagedTripLocation } from "../Services/socketService.js";

// Haversine distance in meters between two {lat,lng} points.
const distanceMeters = (a, b) => {
    if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
    const R = 6371e3;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

// Resolve the User account ids for a managed trip's passengers so real-time
// events reach the rooms employees actually join (they join by userId, while
// trip.passengers[].employeeId is the CorporateEmployee document id).
const resolvePassengerUserIds = async (trip) => {
    const userIds = new Set();
    const employeeDocIds = [];
    for (const p of trip.passengers || []) {
        if (p.passengerId) userIds.add(p.passengerId.toString());
        if (p.employeeId) employeeDocIds.push(p.employeeId);
    }
    if (employeeDocIds.length) {
        const employees = await CorporateEmployee.find({ _id: { $in: employeeDocIds } }).select("userId");
        employees.forEach((e) => e.userId && userIds.add(e.userId.toString()));
    }
    return Array.from(userIds);
};

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

        // Determine which trip statuses to return.
        // - Default (My Scheduled Trips): only upcoming/active bookings.
        // - Trip History passes ?status=COMPLETED (comma-separated values supported,
        //   e.g. ?status=COMPLETED,CANCELLED) so finished trips can be listed.
        let statusFilter = ['SCHEDULED', 'IN_PROGRESS'];
        if (status) {
            statusFilter = status
                .split(',')
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean);
        }

        // Show history (completed/cancelled) newest-first, upcoming trips earliest-first
        const isHistoryView = statusFilter.some((s) =>
            ['COMPLETED', 'CANCELLED'].includes(s)
        );

        // Build query - check both passengerId (User ID) and employeeId (CorporateEmployee ID)
        const query = {
            $or: [
                { "passengers.passengerId": employeeId },
                { "passengers.employeeId": employeeId }
            ],
            status: { $in: statusFilter }
        };

        if (date) {
            const targetDate = new Date(date);
            query.tripDate = {
                $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                $lt: new Date(targetDate.setHours(23, 59, 59, 999))
            };
        }

        // Don't populate driverId here - it may reference CorporateDriver model, not User model
        // We'll look it up manually to handle both cases
        const trips = await Trip.find(query)
            .populate('routeId', 'fromLocation toLocation stopPoints')
            .populate('vehicleId', 'vehicleName registrationNumber vehicleCategory model licensePlate')
            .sort(isHistoryView ? { tripDate: -1, startTime: -1 } : { tripDate: 1, startTime: 1 });

        // Resolve driver names and add seat info
        const myBookings = await Promise.all(trips.map(async (trip) => {
            const myPassenger = trip.passengers.find(p =>
                (p.passengerId?.toString() === employeeId) ||
                (p.employeeId?.toString() === employeeId)
            );

            // Skip if passenger not found (safety check)
            if (!myPassenger) {
                return null;
            }

            const tripObj = trip.toObject();

            // Get the raw driverId (not populated since we removed .populate('driverId'))
            const driverObjectId = tripObj.driverId;

            // Resolve driver name - try multiple sources
            let driverName = null;
            let driverContact = null;

            if (driverObjectId) {
                // 1. Try CorporateDriver model first (most common for corporate trips)
                try {
                    const CorporateDriver = (await import('../models/CorporateDriver.js')).default;
                    const corpDriver = await CorporateDriver.findById(driverObjectId).select('name phone email');
                    if (corpDriver) {
                        driverName = corpDriver.name;
                        driverContact = corpDriver.phone || driverContact;
                    }
                } catch (e) {
                    // Not a CorporateDriver ID
                }

                // 2. If not found, try Driver model
                if (!driverName) {
                    try {
                        const driverDoc = await Driver.findById(driverObjectId).select('name phone email');
                        if (driverDoc) {
                            driverName = driverDoc.name;
                            driverContact = driverDoc.phone || driverContact;
                        }
                    } catch (e) {
                        // Not a Driver ID
                    }
                }

                // 3. If still not found, try User model directly
                if (!driverName) {
                    try {
                        const userDoc = await User.findById(driverObjectId).select('fullName whatsappNumber phone');
                        if (userDoc) {
                            driverName = userDoc.fullName;
                            driverContact = userDoc.whatsappNumber || userDoc.phone || driverContact;
                        }
                    } catch (e) {
                        // Not a User ID
                    }
                }

                // 4. Try finding User who has this driverId
                if (!driverName) {
                    try {
                        const driverUser = await User.findOne({ driverId: driverObjectId }).select('fullName whatsappNumber phone');
                        if (driverUser) {
                            driverName = driverUser.fullName;
                            driverContact = driverUser.whatsappNumber || driverUser.phone || driverContact;
                        }
                    } catch (e) {
                        // No user found with this driverId
                    }
                }
            }

            // 6. If still no driver, try to get from route schedule
            if (!driverName && tripObj.routeId) {
                try {
                    const CorporateRouteSchedule = (await import('../models/CorporateRouteSchedule.js')).default;
                    const CorporateDriverModel = (await import('../models/CorporateDriver.js')).default;
                    const routeId = typeof tripObj.routeId === 'object' ? tripObj.routeId._id : tripObj.routeId;
                    const schedule = await CorporateRouteSchedule.findOne({ routeId: routeId }).select('assignedDriver');
                    if (schedule?.assignedDriver) {
                        // First try as CorporateDriver model ID
                        const corpDriver = await CorporateDriverModel.findById(schedule.assignedDriver).select('name phone email');
                        if (corpDriver) {
                            driverName = corpDriver.name;
                            driverContact = corpDriver.phone || driverContact;
                        } else {
                            // Try as User model ID
                            const scheduleDriver = await User.findById(schedule.assignedDriver).select('fullName whatsappNumber phone');
                            if (scheduleDriver) {
                                driverName = scheduleDriver.fullName;
                                driverContact = scheduleDriver.whatsappNumber || scheduleDriver.phone || driverContact;
                            }
                        }
                    }
                } catch (e) {
                    console.log("[v0] Route schedule driver lookup failed:", e.message);
                }
            }

            // Get pickup info from passenger or trip
            const pickupStop = myPassenger?.pickupStop || myPassenger?.pickupPoint ||
                tripObj.stopPoints?.[0]?.location || tripObj.fromLocation || 'See schedule';
            const pickupTime = myPassenger?.pickupTime || tripObj.startTime || 'See schedule';

            return {
                ...tripObj,
                driverId: driverObjectId,
                driverName: driverName || 'Will be assigned',
                driverContact: driverContact || 'Not available',
                vehicleName: tripObj.vehicleId?.vehicleName || tripObj.vehicleId?.model || 'Company Vehicle',
                vehicleNumber: tripObj.vehicleId?.registrationNumber || tripObj.vehicleId?.licensePlate || 'See schedule',
                seatNumber: myPassenger?.seatNumber || 1,
                pickupPoint: pickupStop,
                pickupStop: pickupStop,
                pickupTime: pickupTime,
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

        // Check if trip is starting late
        const now = new Date();
        const scheduledDateTime = new Date(trip.tripDate);

        // Parse startTime (format: "HH:MM" or "HH:MM AM/PM")
        if (trip.startTime) {
            const timeParts = trip.startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (timeParts) {
                let hours = parseInt(timeParts[1]);
                const minutes = parseInt(timeParts[2]);
                const period = timeParts[3];

                if (period) {
                    if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                    if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
                }

                scheduledDateTime.setHours(hours, minutes, 0, 0);
            }
        }

        const lateThresholdMinutes = 5; // Consider late if more than 5 minutes past scheduled time
        const isLate = now > new Date(scheduledDateTime.getTime() + lateThresholdMinutes * 60 * 1000);
        const lateByMinutes = Math.floor((now - scheduledDateTime) / (1000 * 60));

        // Update trip status
        trip.status = "IN_PROGRESS";

        if (isLate) {
            trip.isLateStart = true;
            trip.lateStartMinutes = Math.max(0, lateByMinutes);
        }

        // Add trip event
        trip.events.push({
            eventType: "TRIP_STARTED",
            timestamp: new Date(),
            description: isLate ? `Trip started late by ${lateByMinutes} minutes` : "Trip started by driver",
            location: trip.fromLocation,
            isLate,
            lateByMinutes: isLate ? lateByMinutes : 0
        });

        await trip.save();

        // If trip started late, notify admin and driver owner
        if (isLate && lateByMinutes > 0) {
            // Get driver details
            const driver = await User.findById(driverId).select('fullName role companyId');
            const driverName = driver?.fullName || 'Driver';
            const driverRole = driver?.role;

            // Notify Admin about late trip start
            await sendAdminNotification(
                "Late Trip Start Warning",
                `${driverName} (${driverRole}) started trip ${lateByMinutes} minutes late. Trip: ${trip.fromLocation} to ${trip.toLocation}. Scheduled: ${trip.startTime}, Actual: ${now.toLocaleTimeString()}.`,
                "LATE_TRIP_START",
                {
                    tripId: trip._id,
                    driverId,
                    driverName,
                    driverRole,
                    lateByMinutes,
                    scheduledTime: trip.startTime,
                    actualStartTime: now.toISOString(),
                    fromLocation: trip.fromLocation,
                    toLocation: trip.toLocation,
                }
            );

            // Find the driver's owner based on role
            let ownerId = null;
            let ownerType = null;

            if (driverRole === 'B2B_PARTNER_DRIVER') {
                // Owner is the B2B Partner (companyId or the one who created the driver)
                const driverRecord = await Driver.findOne({ userId: driverId }).select('createdBy partnerId');
                ownerId = driverRecord?.partnerId || driverRecord?.createdBy || driver?.companyId;
                ownerType = 'B2B_PARTNER';
            } else if (driverRole === 'CORPORATE_DRIVER') {
                // Owner is the Corporate
                const driverRecord = await Driver.findOne({ userId: driverId }).select('createdBy corporateId');
                ownerId = driverRecord?.corporateId || driverRecord?.createdBy || driver?.companyId;
                ownerType = 'CORPORATE';
            } else if (driverRole === 'B2C_PARTNER_DRIVER') {
                // Owner is the B2C Partner
                const driverRecord = await Driver.findOne({ userId: driverId }).select('createdBy partnerId');
                ownerId = driverRecord?.partnerId || driverRecord?.createdBy || driver?.companyId;
                ownerType = 'B2C_PARTNER';
            }

            // Send notification to driver's owner
            if (ownerId) {
                const ownerNotification = await createNotification({
                    userId: ownerId,
                    type: "LATE_TRIP_START",
                    title: "Driver Started Trip Late",
                    message: `Your driver ${driverName} started a trip ${lateByMinutes} minutes late. Trip from ${trip.fromLocation} to ${trip.toLocation}. Scheduled: ${trip.startTime}. Please address this with the driver.`,
                    metadata: {
                        tripId: trip._id,
                        driverId,
                        driverName,
                        lateByMinutes,
                        scheduledTime: trip.startTime,
                        actualStartTime: now.toISOString(),
                        fromLocation: trip.fromLocation,
                        toLocation: trip.toLocation,
                    },
                });
                sendRealTimeNotification(ownerId.toString(), ownerNotification);
            }
        }

        // Notify all passengers via socket AND persistent notification
        for (const passenger of trip.passengers) {
            if (passenger.employeeId) {
                // Find the user account for this employee to create persistent notification
                try {
                    const employee = await CorporateEmployee.findById(passenger.employeeId).select('userId');
                    const notifUserId = employee?.userId || passenger.employeeId;
                    const tripStartNotif = await createNotification({
                        userId: notifUserId,
                        type: "TRIP_STARTED",
                        title: "Trip Started",
                        message: `Your trip from ${trip.fromLocation || 'pickup'} to ${trip.toLocation || 'destination'} has started`,
                        metadata: {
                            tripId: trip._id,
                            fromLocation: trip.fromLocation,
                            toLocation: trip.toLocation,
                            startTime: new Date().toISOString(),
                        }
                    });
                    // Send real-time notification using the service
                    sendRealTimeNotification(notifUserId.toString(), tripStartNotif);
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

        // Stop live location sharing so the employee tracking screen ends
        trip.tracking = {
            ...(trip.tracking || {}),
            isSharingLocation: false,
            lastPingAt: new Date(),
        };

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
        // employeeLat/employeeLng (optional) let us compute a per-viewer ETA to
        // the employee currently watching the ride.
        const { lat, lng, speed, employeeLat, employeeLng } = req.body;

        if (lat == null || lng == null) {
            return res.status(400).json({ success: false, message: "lat and lng are required" });
        }

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        if (!trip.driverId || trip.driverId.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        const now = new Date();
        const location = { lat, lng, lastUpdated: now };

        // Persist both fields (getDriverLocation falls back to currentLocation)
        trip.currentLocation = location;
        trip.driverLocation = location;

        // Append to capped rolling history (keep the most recent 50 pings)
        trip.locationHistory = [
            ...(trip.locationHistory || []),
            { lat, lng, speed: speed ?? null, timestamp: now },
        ].slice(-50);

        // Best-effort ETA toward the watching employee's coordinates
        let etaMinutes = null;
        let distMeters = null;
        if (employeeLat != null && employeeLng != null) {
            distMeters = distanceMeters({ lat, lng }, { lat: employeeLat, lng: employeeLng });
            if (distMeters != null) {
                const avgSpeedKmh = speed && speed > 3 ? speed : 30; // fallback urban avg
                etaMinutes = Math.max(1, Math.round((distMeters / 1000 / avgSpeedKmh) * 60));
            }
        }

        trip.tracking = {
            ...(trip.tracking || {}),
            isSharingLocation: true,
            startedAt: trip.tracking?.startedAt || now,
            lastPingAt: now,
            etaMinutes: etaMinutes ?? trip.tracking?.etaMinutes,
            distanceMeters: distMeters ?? trip.tracking?.distanceMeters,
        };

        await trip.save();

        // Broadcast to the rooms employees actually join (by userId + trip room),
        // plus corporate/partner ops boards.
        const employeeUserIds = await resolvePassengerUserIds(trip);
        broadcastManagedTripLocation(
            {
                tripId: trip._id,
                location: { lat, lng },
                status: trip.status,
                etaMinutes,
                distanceMeters: distMeters,
                speed: speed ?? null,
            },
            {
                employeeUserIds,
                corporateOwnerId: trip.corporateId,
                b2bPartnerId: trip.b2bPartnerId,
            },
        );

        res.json({
            success: true,
            message: "Location updated successfully",
            data: { location, etaMinutes, distanceMeters: distMeters },
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

// Resolve a friendly driver name/phone for a managed trip. driverId may point at
// a User, Driver or CorporateDriver document depending on how it was assigned.
const resolveTripDriver = async (trip) => {
    if (!trip.driverId) return { name: "To be assigned", phone: null };
    const id = trip.driverId._id || trip.driverId;
    try {
        const user = await User.findById(id).select("fullName phone whatsappNumber");
        if (user) return { name: user.fullName, phone: user.phone || user.whatsappNumber || null };
    } catch (e) { /* ignore */ }
    try {
        const drv = await Driver.findById(id).select("name phone");
        if (drv) return { name: drv.name, phone: drv.phone || null };
    } catch (e) { /* ignore */ }
    try {
        const linked = await User.findOne({ driverId: id }).select("fullName phone whatsappNumber");
        if (linked) return { name: linked.fullName, phone: linked.phone || linked.whatsappNumber || null };
    } catch (e) { /* ignore */ }
    return { name: "Driver", phone: null };
};

// Build a normalized live-tracking payload for a trip + the requesting employee.
const buildLivePayload = async (trip, employee, employeeCoords) => {
    const driver = await resolveTripDriver(trip);
    const myPassenger = employee
        ? (trip.passengers || []).find(
            (p) =>
                p.employeeId?.toString() === employee._id.toString() ||
                p.passengerId?.toString() === employee.userId?.toString(),
        )
        : null;

    const driverLoc = trip.currentLocation || trip.driverLocation || null;
    let etaMinutes = trip.tracking?.etaMinutes ?? null;
    let distMeters = trip.tracking?.distanceMeters ?? null;

    // Recompute a fresh ETA if the employee shared their coordinates
    if (driverLoc && driverLoc.lat != null && employeeCoords?.lat != null) {
        distMeters = distanceMeters(
            { lat: driverLoc.lat, lng: driverLoc.lng },
            { lat: employeeCoords.lat, lng: employeeCoords.lng },
        );
        if (distMeters != null) {
            etaMinutes = Math.max(1, Math.round((distMeters / 1000 / 30) * 60));
        }
    }

    return {
        tripId: trip._id,
        status: trip.status,
        fromLocation: trip.fromLocation,
        toLocation: trip.toLocation,
        startTime: trip.startTime,
        tripDate: trip.tripDate,
        direction: trip.direction,
        pickupStop: myPassenger?.pickupStop || null,
        dropoffStop: myPassenger?.dropoffStop || null,
        seatNumber: myPassenger?.seatNumber || null,
        vehicle: trip.vehicleId
            ? {
                name: trip.vehicleId.vehicleName || trip.vehicleId.model || null,
                plate: trip.vehicleId.registrationNumber || trip.vehicleId.licensePlate || null,
            }
            : null,
        driver,
        driverLocation: driverLoc,
        locationHistory: (trip.locationHistory || []).slice(-15),
        isSharingLocation: !!trip.tracking?.isSharingLocation,
        lastPingAt: trip.tracking?.lastPingAt || null,
        etaMinutes,
        distanceMeters: distMeters,
    };
};

// @desc    Employee: get my current trackable trip (today, scheduled/in-progress)
// @route   GET /api/trips/my-active-trip
// @access  Private (Corporate employee)
export const getMyActiveTrip = async (req, res) => {
    try {
        const employee = await CorporateEmployee.findOne({ userId: req.userId });
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee profile not found" });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        const trip = await Trip.findOne({
            corporateId: employee.companyId,
            tripDate: { $gte: todayStart, $lt: todayEnd },
            status: { $in: ["SCHEDULED", "IN_PROGRESS", "Scheduled", "InProgress"] },
            $or: [
                { "passengers.passengerId": req.userId },
                { "passengers.employeeId": employee._id },
            ],
        })
            .populate("vehicleId", "vehicleName registrationNumber model licensePlate")
            .sort({ status: -1, startTime: 1 });

        if (!trip) {
            return res.json({ success: true, data: { trip: null } });
        }

        const payload = await buildLivePayload(trip, employee, {
            lat: req.query.lat != null ? Number(req.query.lat) : null,
            lng: req.query.lng != null ? Number(req.query.lng) : null,
        });

        res.json({ success: true, data: { trip: payload } });
    } catch (error) {
        console.error("Error getting active trip:", error);
        res.status(500).json({ success: false, message: "Failed to get active trip" });
    }
};

// @desc    Get live tracking data for a specific trip
// @route   GET /api/trips/:tripId/live
// @access  Private (passenger employee / corporate owner / partner / admin)
export const getTripLive = async (req, res) => {
    try {
        const { tripId } = req.params;
        const trip = await Trip.findById(tripId).populate(
            "vehicleId",
            "vehicleName registrationNumber model licensePlate",
        );
        if (!trip) {
            return res.status(404).json({ success: false, message: "Trip not found" });
        }

        // Authorization: corporate owner, partner, admin, or a passenger employee
        const uid = req.userId.toString();
        let employee = await CorporateEmployee.findOne({ userId: req.userId });
        const isPassenger =
            employee &&
            (trip.passengers || []).some(
                (p) =>
                    p.employeeId?.toString() === employee._id.toString() ||
                    p.passengerId?.toString() === uid,
            );
        const isOwner =
            trip.corporateId?.toString() === uid ||
            trip.b2bPartnerId?.toString() === uid ||
            req.userRole === "ADMIN";

        if (!isPassenger && !isOwner) {
            return res.status(403).json({ success: false, message: "Not authorized to track this trip" });
        }

        const payload = await buildLivePayload(trip, employee, {
            lat: req.query.lat != null ? Number(req.query.lat) : null,
            lng: req.query.lng != null ? Number(req.query.lng) : null,
        });

        res.json({ success: true, data: { trip: payload } });
    } catch (error) {
        console.error("Error getting trip live data:", error);
        res.status(500).json({ success: false, message: "Failed to get live tracking data" });
    }
};
