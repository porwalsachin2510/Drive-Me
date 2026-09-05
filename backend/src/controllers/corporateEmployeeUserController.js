import User from "../models/User.js";
import CorporateEmployee from "../models/CorporateEmployee.js";
import Contract from "../models/Contract.js";
import Route from "../models/Route.js";
import Trip from "../models/Trip.js";
import Vehicle from "../models/Vehicle.js";
import Driver from "../models/Driver.js";
import CorporateDriver from "../models/CorporateDriver.js";
import CorporateRouteSchedule from "../models/CorporateRouteSchedule.js";
import MonthlyPass from "../models/MonthlyPass.js";
import { sendEmail } from "../Services/emailService.js";
import { passengerRoleForOwner, CUSTOMER_ROLES } from "../utils/roleFamilies.js";

// Register corporate employee
export const registerCorporateEmployee = async (req, res) => {
    try {
        const {
            companyEmail,
            employeeId,
            fullName,
            email,
            password,
            contactNumber,
            department,
            designation,
            workShift,
            pickupLocation,
            dropoffLocation
        } = req.body;

        // Verify company email matches invitation. Accept BOTH customer segments
        // (a CORPORATE company or a SCHOOL_CUSTOMER school) so a school's students
        // can self-register the same way corporate employees do.
        const company = await User.findOne({
            email: companyEmail,
            role: { $in: CUSTOMER_ROLES }
        });

        if (!company) {
            return res.status(400).json({
                success: false,
                message: "Invalid company email or company not found"
            });
        }

        // Check if employee already exists
        const existingEmployee = await CorporateEmployee.findOne({
            $or: [
                { employeeId },
                { "personalInfo.email": email },
                { "personalInfo.phoneNumber": contactNumber }
            ]
        });

        if (existingEmployee) {
            return res.status(400).json({
                success: false,
                message: "Employee already registered"
            });
        }

        // Create user account
        const user = new User({
            fullName,
            email,
            password,
            // Tag the passenger login with its segment role: a SCHOOL_CUSTOMER's
            // registrant becomes a SCHOOL_STUDENT, a CORPORATE's a CORPORATE_EMPLOYEE.
            role: passengerRoleForOwner(company.role),
            companyId: company._id,
            isActive: true
        });

        await user.save();

        // Parse full name into first/last
        const nameParts = (fullName || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || firstName;

        // Create corporate employee record with correct schema mapping
        const employee = new CorporateEmployee({
            userId: user._id,
            companyId: company._id,
            employeeId,
            personalInfo: {
                firstName,
                lastName,
                email,
                phoneNumber: contactNumber || "",
                department: department || "",
                designation: designation || "",
                workLocation: ""
            },
            transportDetails: {
                pickupPoint: pickupLocation || "",
                dropOffPoint: dropoffLocation || "",
                shiftType: workShift || "FULL_DAY",
                transportStatus: "ACTIVE"
            },
            accessControl: {
                isActive: true,
                accessLevel: "EMPLOYEE"
            },
            documents: {
                verificationStatus: "VERIFIED"
            }
        });

        await employee.save();

        // Send welcome email
        await sendWelcomeEmail(user, employee);

        res.status(201).json({
            success: true,
            message: "Employee registered successfully",
            data: {
                employeeId: employee._id,
                userId: user._id
            }
        });

    } catch (error) {
        console.error("Error registering corporate employee:", error);
        res.status(500).json({
            success: false,
            message: "Error registering employee",
            error: error.message
        });
    }
};

// Get employee dashboard
export const getEmployeeDashboard = async (req, res) => {
    try {
        const userId = req.userId;
        const { period = 'month' } = req.query;

        // Get employee details
        const employee = await CorporateEmployee.findOne({ userId })
            .populate('companyId', 'companyName businessName fullName')
            .populate('transportDetails.assignedRoute', 'fromLocation toLocation stopPoints vehicleId assignedDriver');

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Get travel history from trips collection (include past trips too)
        const historyData = await getEmployeeTravelHistoryFromTrips(userId, employee, period);

        // Get upcoming trips from trips collection
        const upcomingTripsData = await getUpcomingTripsFromTrips(userId, employee);

        // Get assigned vehicle details from contract
        const vehicleInfo = await getAssignedVehicleInfoFromContract(employee);

        // Get today's trips separately for the Trip Info tab
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        // Don't populate driverId since it may reference CorporateDriver model, not User
        const todayTripsRaw = await Trip.find({
            corporateId: employee.companyId,
            tripDate: { $gte: todayStart, $lt: todayEnd },
            status: { $in: ['SCHEDULED', 'IN_PROGRESS', 'Scheduled', 'Confirmed'] },
            $or: [
                { 'passengers.passengerId': userId },
                { 'passengers.employeeId': employee._id }
            ]
        })
            .populate('routeId', 'fromLocation toLocation stopPoints')
            .populate('vehicleId', 'vehicleName registrationNumber vehicleCategory model licensePlate')
            .sort({ startTime: 1 });

        // Resolve driver names - driverId may be CorporateDriver, Driver, or User model ID
        const resolveDriverInfo = async (trip) => {
            // Get the raw driverId from the trip document (not populated)
            const driverObjectId = trip.driverId;
            let driverName = null;
            let driverContact = null;

            if (!driverObjectId) {
                // Try to get from CorporateRouteSchedule first (most reliable source)
                if (trip.routeId) {
                    try {
                        const routeId = typeof trip.routeId === 'object' ? trip.routeId._id : trip.routeId;
                        const schedule = await CorporateRouteSchedule.findOne({ routeId: routeId }).select('assignedDriver');
                        if (schedule?.assignedDriver) {
                            // First try as CorporateDriver model ID
                            const corpDriver = await CorporateDriver.findById(schedule.assignedDriver).select('name phone email');
                            if (corpDriver) {
                                driverName = corpDriver.name;
                                driverContact = corpDriver.phone || null;
                            } else {
                                // Try as User model ID
                                const scheduleDriver = await User.findById(schedule.assignedDriver).select('fullName whatsappNumber phone');
                                if (scheduleDriver) {
                                    driverName = scheduleDriver.fullName;
                                    driverContact = scheduleDriver.whatsappNumber || scheduleDriver.phone || null;
                                }
                            }
                        }
                    } catch (e) { }
                }
                // If still no driver, fallback to vehicleInfo from contract
                if (!driverName) {
                    return {
                        driverName: vehicleInfo?.driverName || 'Will be assigned',
                        driverContact: vehicleInfo?.driverContact || 'Not available'
                    };
                }
                return { driverName, driverContact: driverContact || 'Not available' };
            }

            // 1. First try CorporateDriver model (most common for corporate trips)
            try {
                const corpDriver = await CorporateDriver.findById(driverObjectId).select('name phone email');
                if (corpDriver) {
                    driverName = corpDriver.name;
                    driverContact = corpDriver.phone || null;
                }
            } catch (e) { }

            // 2. If not found, try Driver model
            if (!driverName) {
                try {
                    const driverRecord = await Driver.findById(driverObjectId).select('name phone email');
                    if (driverRecord) {
                        driverName = driverRecord.name;
                        driverContact = driverRecord.phone || driverContact;
                    }
                } catch (e) { }
            }

            // 3. Try User model directly
            if (!driverName) {
                try {
                    const userDoc = await User.findById(driverObjectId).select('fullName whatsappNumber phone');
                    if (userDoc) {
                        driverName = userDoc.fullName;
                        driverContact = userDoc.whatsappNumber || userDoc.phone || driverContact;
                    }
                } catch (e) { }
            }

            // 4. Find User account that references this driver
            if (!driverName) {
                try {
                    const driverUserAccount = await User.findOne({
                        driverId: driverObjectId
                    }).select('fullName whatsappNumber phone');
                    if (driverUserAccount) {
                        driverName = driverUserAccount.fullName;
                        driverContact = driverUserAccount.whatsappNumber || driverUserAccount.phone || driverContact;
                    }
                } catch (e) { }
            }

            // Fallback to vehicleInfo from contract
            if (!driverName) {
                driverName = vehicleInfo?.driverName || null;
                driverContact = driverContact || vehicleInfo?.driverContact || null;
            }

            return { driverName: driverName || 'Will be assigned', driverContact: driverContact || 'Not available' };
        };

        const todayTrips = await Promise.all(todayTripsRaw.map(async (trip) => {
            const driverInfo = await resolveDriverInfo(trip);

            // Find the current user's passenger record
            const myPassenger = trip.passengers?.find(p =>
                p.passengerId?.toString() === userId.toString() ||
                p.employeeId?.toString() === employee._id.toString()
            );

            // Get pickup/dropoff based on direction and passenger record
            let pickupStop, dropoffStop;
            if (myPassenger) {
                pickupStop = myPassenger.pickupStop;
                dropoffStop = myPassenger.dropoffStop;
            } else if (trip.direction === 'FORWARD') {
                pickupStop = employee.transportDetails?.outboundPickupStop;
                dropoffStop = employee.transportDetails?.outboundDropoffStop;
            } else if (trip.direction === 'RETURN') {
                pickupStop = employee.transportDetails?.returnPickupStop;
                dropoffStop = employee.transportDetails?.returnDropoffStop;
            }

            // Classify the trip's ACTUAL destination as OFFICE/SCHOOL vs HOME so the
            // passenger portal shows a truthful "To School / To Home" label instead
            // of guessing from the FORWARD/RETURN enum (wrong for one-way
            // "Campus -> Home" routes). Compare the resolved dropoff to the office
            // anchor (outbound dropoff) and the home anchor (return dropoff / home).
            const normLoc1 = (s) => String(s || "").trim().toLowerCase();
            const officeAnchor1 = normLoc1(
                employee.transportDetails?.outboundDropoffStop || trip.toLocation
            );
            const homeAnchor1 = normLoc1(
                employee.transportDetails?.returnDropoffStop ||
                employee.transportDetails?.outboundPickupStop ||
                employee.homeAddress
            );
            const actualDropoff1 = normLoc1(dropoffStop || trip.toLocation);
            let destinationKind1 = null;
            if (actualDropoff1 && officeAnchor1 && actualDropoff1 === officeAnchor1) {
                destinationKind1 = "OFFICE";
            } else if (actualDropoff1 && homeAnchor1 && actualDropoff1 === homeAnchor1) {
                destinationKind1 = "HOME";
            }

            return {
                _id: trip._id,
                date: trip.tripDate?.toISOString().split('T')[0],
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                endTime: trip.endTime,
                fromLocation: trip.fromLocation || 'Unknown',
                toLocation: trip.toLocation || 'Unknown',
                route: `${trip.fromLocation || 'Unknown'} -> ${trip.toLocation || 'Unknown'}`,
                tripType: trip.tripType,
                direction: trip.direction,
                destinationKind: destinationKind1,
                status: trip.status,
                driverId: trip.driverId?._id,
                vehicleName: trip.vehicleId?.vehicleName || trip.vehicleId?.model || vehicleInfo?.vehicleName || 'Not assigned',
                vehicleNumber: trip.vehicleId?.registrationNumber || trip.vehicleId?.licensePlate || vehicleInfo?.vehicleNumber || 'Not assigned',
                driverName: driverInfo.driverName,
                driverContact: driverInfo.driverContact,
                totalSeats: trip.totalSeats,
                availableSeats: trip.availableSeats,
                bookedSeats: trip.bookedSeats,
                stopPoints: trip.stopPoints || trip.routeId?.stopPoints || [],
                passengers: trip.passengers || [],
                // Add employee-specific pickup/dropoff for this trip
                myPickupStop: pickupStop,
                myDropoffStop: dropoffStop,
                routeId: trip.routeId ? {
                    _id: trip.routeId._id,
                    fromLocation: trip.routeId.fromLocation,
                    toLocation: trip.routeId.toLocation,
                    stopPoints: trip.routeId.stopPoints || []
                } : null
            };
        }));

        // Build route info for response
        const assignedRoute = employee.transportDetails?.assignedRoute;
        const routeInfo = assignedRoute ? {
            routeName: `${assignedRoute.fromLocation} → ${assignedRoute.toLocation}`,
            fromLocation: assignedRoute.fromLocation,
            toLocation: assignedRoute.toLocation,
            stopPoints: assignedRoute.stopPoints || []
        } : null;

        res.status(200).json({
            success: true,
            data: {
                employee: {
                    employeeId: employee.employeeId,
                    fullName: employee.fullName,
                    email: employee.personalInfo?.email,
                    phoneNumber: employee.personalInfo?.phoneNumber,
                    department: employee.personalInfo?.department,
                    designation: employee.personalInfo?.designation,
                    shiftType: employee.transportDetails?.shiftType,
                    pickupPoint: employee.transportDetails?.pickupPoint,
                    dropOffPoint: employee.transportDetails?.dropOffPoint,
                    route: routeInfo
                },
                company: {
                    companyName: employee.companyId?.companyName || employee.companyId?.fullName,
                    businessName: employee.companyId?.businessName
                },
                employeeProfile: {
                    feedback: employee.feedback || { totalRides: 0, averageRating: 0, feedbackHistory: [] }
                },
                travelHistory: historyData,
                upcomingTrips: upcomingTripsData.trips || [],
                todayTrips,
                bookings: upcomingTripsData.trips || [],
                vehicleInfo,
                summary: await getEmployeeSummary(userId, period)
            }
        });

    } catch (error) {
        console.error("Error getting employee dashboard:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving employee dashboard",
            error: error.message
        });
    }
};

// View assigned route and timings
export const getAssignedRoute = async (req, res) => {
    try {
        const userId = req.userId;

        const employee = await CorporateEmployee.findOne({ userId })
            .populate('transportDetails.assignedRoute', 'fromLocation toLocation stopPoints vehicleId assignedDriver');

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const assignedRoute = employee.transportDetails?.assignedRoute;

        // Get schedule details
        const schedule = assignedRoute?._id ? await getRouteSchedule(assignedRoute._id) : { schedule: [] };

        // Get vehicle and driver info from Contract's embedded assignedVehicles
        let vehicleInfo = null;
        let driverInfo = null;

        if (employee.companyId) {
            try {
                // Find active contract for this corporate
                const contract = await Contract.findOne({
                    corporateOwnerId: employee.companyId,
                    status: 'ACTIVE'
                });

                if (contract && contract.vehicles && contract.vehicles.length > 0) {
                    // Find the assignment that matches the employee's route
                    let foundAssignment = null;

                    for (const vehicleGroup of contract.vehicles) {
                        if (vehicleGroup.assignedVehicles && vehicleGroup.assignedVehicles.length > 0) {
                            for (const assignment of vehicleGroup.assignedVehicles) {
                                // Match by routeDetails if available, else take first active assignment
                                if (assignment.status === 'ACTIVE') {
                                    if (assignedRoute?._id && assignment.routeDetails &&
                                        assignment.routeDetails.toString() === assignedRoute._id.toString()) {
                                        foundAssignment = assignment;
                                        break;
                                    } else if (!foundAssignment) {
                                        foundAssignment = assignment;
                                    }
                                }
                            }
                            if (foundAssignment && assignedRoute?._id && foundAssignment.routeDetails &&
                                foundAssignment.routeDetails.toString() === assignedRoute._id.toString()) {
                                break;
                            }
                        }
                    }

                    if (foundAssignment) {
                        // Fetch vehicle details
                        if (foundAssignment.vehicleId) {
                            const vehicle = await Vehicle.findById(foundAssignment.vehicleId);
                            if (vehicle) {
                                vehicleInfo = {
                                    vehicleName: vehicle.vehicleName,
                                    registrationNumber: vehicle.registrationNumber,
                                    vehicleCategory: vehicle.vehicleCategory,
                                    capacity: vehicle.capacity?.seatingCapacity || 0,
                                    photos: vehicle.photos || []
                                };
                            }
                        }

                        // Fetch driver details - driver is stored in Driver model (B2B driver)
                        if (foundAssignment.driverId) {
                            const driverModel = foundAssignment.driverModel || 'Driver';
                            if (driverModel === 'Driver') {
                                const driver = await Driver.findById(foundAssignment.driverId);
                                if (driver) {
                                    driverInfo = {
                                        fullName: driver.name,
                                        email: driver.email,
                                        phone: driver.phone
                                    };
                                }
                            } else {
                                // Try User model for corporate drivers
                                const driver = await User.findById(foundAssignment.driverId);
                                if (driver) {
                                    driverInfo = {
                                        fullName: driver.fullName,
                                        email: driver.email,
                                        phone: driver.whatsappNumber || driver.contactNumber || ''
                                    };
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching vehicle/driver from contract:", err);
            }
        }

        res.status(200).json({
            success: true,
            data: {
                route: assignedRoute ? {
                    routeName: `${assignedRoute.fromLocation} → ${assignedRoute.toLocation}`,
                    fromLocation: assignedRoute.fromLocation,
                    toLocation: assignedRoute.toLocation,
                    stopPoints: assignedRoute.stopPoints || []
                } : null,
                vehicle: vehicleInfo,
                driver: driverInfo,
                schedule,
                seatNumber: employee.transportDetails?.seatNumber,
                pickupStop: employee.transportDetails?.pickupPoint,
                dropoffStop: employee.transportDetails?.dropOffPoint,
                shiftType: employee.transportDetails?.shiftType
            }
        });

    } catch (error) {
        console.error("Error getting assigned route:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving assigned route",
            error: error.message
        });
    }
};

// Book/cancel specific days
export const manageBooking = async (req, res) => {
    try {
        const userId = req.userId;
        const { action, dates, reason, tripId } = req.body;

        const employee = await CorporateEmployee.findOne({ userId });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Handle single trip cancellation (from EmployeeTripBooking cancel button)
        if (action === "cancel" && tripId && !dates) {
            const trip = await Trip.findById(tripId);
            if (!trip) {
                return res.status(404).json({
                    success: false,
                    message: "Trip not found"
                });
            }

            // Find and remove passenger
            const passengerIndex = trip.passengers.findIndex(p =>
                p.employeeId && p.employeeId.toString() === userId.toString()
            );

            if (passengerIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found for this employee"
                });
            }

            // Remove passenger and restore seat
            trip.passengers.splice(passengerIndex, 1);
            trip.availableSeats = (trip.availableSeats || 0) + 1;
            trip.bookedSeats = Math.max((trip.bookedSeats || 1) - 1, 0);
            await trip.save();

            return res.status(200).json({
                success: true,
                message: "Booking cancelled successfully",
                data: { tripId }
            });
        }

        // Validate dates is an array for bulk operations
        const datesArray = Array.isArray(dates) ? dates : (typeof dates === 'string' ? [dates] : []);

        if (datesArray.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No dates provided for bulk booking operation"
            });
        }

        if (action === "book") {
            // Book specific days
            const bookings = [];
            for (const date of datesArray) {
                const booking = await createEmployeeBooking(employee, date);
                bookings.push(booking);
            }

            res.status(201).json({
                success: true,
                message: "Days booked successfully",
                data: { bookings }
            });

        } else if (action === "cancel") {
            // Cancel specific days
            const cancellations = [];
            for (const date of datesArray) {
                const cancellation = await cancelEmployeeBooking(employee, date, reason);
                cancellations.push(cancellation);
            }

            res.status(200).json({
                success: true,
                message: "Days cancelled successfully",
                data: { cancellations }
            });

        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid action"
            });
        }

    } catch (error) {
        console.error("Error managing booking:", error);
        res.status(500).json({
            success: false,
            message: "Error managing booking",
            error: error.message
        });
    }
};

// Mark not traveling today
export const markNotTravelingToday = async (req, res) => {
    try {
        const userId = req.userId;
        const { date, reason } = req.body;

        const employee = await CorporateEmployee.findOne({ userId });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Mark not traveling for today's trips
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find today's trips for this employee's corporate and mark their passenger entry as NO_SHOW
        const todayTrips = await Trip.find({
            corporateId: employee.companyId,
            tripDate: { $gte: today, $lt: tomorrow },
            status: { $in: ["SCHEDULED", "IN_PROGRESS"] }
        });

        let cancelCount = 0;
        for (const trip of todayTrips) {
            // Check if employee is a passenger
            const passengerIdx = trip.passengers?.findIndex(p =>
                p.employeeId && p.employeeId.toString() === userId.toString()
            );

            if (passengerIdx >= 0) {
                trip.passengers[passengerIdx].bookingStatus = 'NO_SHOW';
                await trip.save();
                cancelCount++;
            }
        }

        const cancelResult = { modifiedCount: cancelCount };

        // Also record in the employee's attendance
        if (!employee.attendance) employee.attendance = {};
        if (!employee.attendance.dailyAttendance) employee.attendance.dailyAttendance = [];
        employee.attendance.dailyAttendance.push({
            date: today,
            status: "ABSENT",
            notes: reason || "Reported not traveling"
        });
        await employee.save();

        // Notify manager
        await notifyManagerOfAbsence(employee, reason);

        res.status(200).json({
            success: true,
            message: "Absence reported successfully",
            data: {
                date,
                reason,
                status: "REPORTED"
            }
        });

    } catch (error) {
        console.error("Error marking not traveling:", error);
        res.status(500).json({
            success: false,
            message: "Error reporting absence",
            error: error.message
        });
    }
};

// Rate trip and provide feedback
export const rateTrip = async (req, res) => {
    try {
        const userId = req.userId;
        const { tripId, rating, feedback, complaints, comments, suggestions,
            driverRating, punctualityRating, cleanlinessRating, safetyRating } = req.body;

        const employee = await CorporateEmployee.findOne({ userId });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Find the trip and update feedback in employee record
        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found"
            });
        }

        // Check if this trip has already been rated by this employee
        if (!employee.feedback) employee.feedback = { totalRides: 0, averageRating: 0, feedbackHistory: [] };
        if (!employee.feedback.feedbackHistory) employee.feedback.feedbackHistory = [];

        const alreadyRated = employee.feedback.feedbackHistory.find(
            f => f.tripId && f.tripId.toString() === tripId.toString()
        );

        if (alreadyRated) {
            return res.status(400).json({
                success: false,
                message: "You have already submitted feedback for this trip"
            });
        }

        // Resolve vehicle and driver info for storing in feedback
        let vehicleName = 'N/A';
        let vehicleNumber = 'N/A';
        let driverName = 'N/A';
        let seatNumber = null;

        // Get vehicle info
        if (trip.vehicleId) {
            try {
                const Vehicle = (await import("../models/Vehicle.js")).default;
                const vehicle = await Vehicle.findById(trip.vehicleId).select('vehicleName registrationNumber');
                if (vehicle) {
                    vehicleName = vehicle.vehicleName || 'N/A';
                    vehicleNumber = vehicle.registrationNumber || 'N/A';
                }
            } catch (e) { }
        }

        // Get driver info
        if (trip.driverId) {
            try {
                const Driver = (await import("../models/Driver.js")).default;
                const User = (await import("../models/User.js")).default;
                // Try Driver model
                const driverDoc = await Driver.findById(trip.driverId).select('name');
                if (driverDoc) {
                    driverName = driverDoc.name;
                } else {
                    // Try User model
                    const userDoc = await User.findById(trip.driverId).select('fullName');
                    if (userDoc) {
                        driverName = userDoc.fullName;
                    } else {
                        // Try User by driverId field
                        const driverUser = await User.findOne({ driverId: trip.driverId }).select('fullName');
                        if (driverUser) driverName = driverUser.fullName;
                    }
                }
            } catch (e) { }
        }

        // Get seat number from passenger entry
        const passengerEntry = trip.passengers?.find(p =>
            p.employeeId && p.employeeId.toString() === userId.toString()
        );
        seatNumber = passengerEntry?.seatNumber || passengerEntry?.seat || null;

        // Store feedback with all detailed fields
        const feedbackComment = comments || feedback || "";
        employee.feedback.feedbackHistory.push({
            tripId,
            rating,
            comments: feedbackComment,
            driverRating: driverRating || null,
            punctualityRating: punctualityRating || null,
            vehicleRating: cleanlinessRating || null,
            suggestions: suggestions || "",
            submittedAt: new Date(),
            route: `${trip.fromLocation || ''} → ${trip.toLocation || ''}`,
            tripDate: trip.tripDate,
            vehicleName,
            vehicleNumber,
            driverName,
            seatNumber,
            startTime: trip.startTime || null
        });

        // Recalculate average
        const allRatings = employee.feedback.feedbackHistory.filter(f => f.rating);
        employee.feedback.averageRating = allRatings.length > 0
            ? allRatings.reduce((sum, f) => sum + f.rating, 0) / allRatings.length
            : 0;
        employee.feedback.totalRides = employee.feedback.feedbackHistory.length;

        await employee.save();

        // Update driver's rating in Driver/CorporateDriver model
        if (trip.driverId && driverRating) {
            try {
                // First try Driver model (B2B Partner drivers)
                let driverDoc = await Driver.findById(trip.driverId);

                if (driverDoc) {
                    // Calculate new average rating for Driver model
                    const currentCount = driverDoc.ratings?.count || 0;
                    const currentAverage = driverDoc.ratings?.average || 0;
                    const newCount = currentCount + 1;
                    const newAverage = ((currentAverage * currentCount) + driverRating) / newCount;

                    await Driver.findByIdAndUpdate(trip.driverId, {
                        $set: {
                            'ratings.average': Math.round(newAverage * 10) / 10, // Round to 1 decimal
                            'ratings.count': newCount
                        }
                    });
                } else {
                    // Try CorporateDriver model (Corporate's own drivers)
                    const corpDriver = await CorporateDriver.findById(trip.driverId);

                    if (corpDriver) {
                        const currentCount = corpDriver.ratings?.count || 0;
                        const currentAverage = corpDriver.ratings?.average || 0;
                        const newCount = currentCount + 1;
                        const newAverage = ((currentAverage * currentCount) + driverRating) / newCount;

                        await CorporateDriver.findByIdAndUpdate(trip.driverId, {
                            $set: {
                                'ratings.average': Math.round(newAverage * 10) / 10,
                                'ratings.count': newCount
                            }
                        });
                    }
                }
            } catch (driverRatingError) {
                console.error("Error updating driver rating:", driverRatingError);
                // Don't fail the whole request if driver rating update fails
            }
        }

        res.status(201).json({
            success: true,
            message: "Trip rated successfully",
            data: {
                tripId: trip._id,
                rating,
                comments: feedbackComment,
                suggestions: suggestions || "",
                driverRating,
                punctualityRating,
                cleanlinessRating,
                safetyRating,
                ratedAt: new Date()
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

// Request route change
export const requestRouteChange = async (req, res) => {
    try {
        const userId = req.userId;
        const { currentRouteId, newRouteId, reason, effectiveDate } = req.body;

        const employee = await CorporateEmployee.findOne({ userId });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Create route change request
        const changeRequest = {
            employeeId: employee._id,
            currentRouteId,
            newRouteId,
            reason,
            effectiveDate: new Date(effectiveDate),
            status: "PENDING",
            requestedAt: new Date()
        };

        // This would integrate with a RouteChangeRequest model
        // For now, just return success

        // Notify manager
        await notifyManagerOfRouteChange(employee, changeRequest);

        res.status(201).json({
            success: true,
            message: "Route change request submitted",
            data: changeRequest
        });

    } catch (error) {
        console.error("Error requesting route change:", error);
        res.status(500).json({
            success: false,
            message: "Error requesting route change",
            error: error.message
        });
    }
};

// Helper functions

// Get employee travel history from trips collection
// const getEmployeeTravelHistoryFromTrips = async (userId, employee, period) => {
//     try {
//         if (!employee?.companyId) return [];

//         const today = new Date();
//         let startDate;

//         switch (period) {
//             case 'week':
//                 startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
//                 break;
//             case 'month':
//                 startDate = new Date(today.getFullYear(), today.getMonth(), 1);
//                 break;
//             default:
//                 startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
//         }

//         // Query trips collection for this corporate's trips
//         const trips = await Trip.find({
//             corporateId: employee.companyId,
//             tripDate: { $gte: startDate, $lte: today },
//             status: { $in: ['COMPLETED', 'CANCELLED', 'SCHEDULED', 'IN_PROGRESS'] }
//         })
//             .populate('routeId', 'fromLocation toLocation')
//             .populate('vehicleId', 'vehicleName registrationNumber vehicleCategory')
//             .populate('driverId', 'fullName whatsappNumber')
//             .sort({ tripDate: -1 });

//         // Map trips to display format - resolve driver names properly
//         const Driver = (await import("../models/Driver.js")).default;
//         const User = (await import("../models/User.js")).default;

//         return await Promise.all(trips.map(async (trip) => {
//             // Check if this employee is a passenger in the trip
//             const passengerEntry = trip.passengers?.find(p =>
//                 p.employeeId && p.employeeId.toString() === userId.toString()
//             );

//             // Resolve driver name - try multiple sources
//             let driverName = null;
//             let driverContact = null;
//             const driverDoc = trip.driverId;

//             // 1. Check if populate worked (User model)
//             if (driverDoc && typeof driverDoc === 'object' && driverDoc._id) {
//                 driverName = driverDoc.name || driverDoc.fullName || null;
//                 driverContact = driverDoc.phone || driverDoc.whatsappNumber || null;
//             }

//             // 2. Check Driver model directly
//             if (!driverName) {
//                 const driverObjectId = (driverDoc && typeof driverDoc === 'object') ? driverDoc._id : driverDoc;
//                 if (driverObjectId) {
//                     try {
//                         const driver = await Driver.findById(driverObjectId).select('name phone email');
//                         if (driver) {
//                             driverName = driver.name;
//                             driverContact = driver.phone || driverContact;
//                         }
//                     } catch (e) { }
//                 }
//             }

//             // 3. Find User account that has this driverId
//             if (!driverName) {
//                 const driverObjectId = (driverDoc && typeof driverDoc === 'object') ? driverDoc._id : driverDoc;
//                 if (driverObjectId) {
//                     try {
//                         const driverUser = await User.findOne({ driverId: driverObjectId }).select('fullName whatsappNumber phone');
//                         if (driverUser) {
//                             driverName = driverUser.fullName;
//                             driverContact = driverUser.whatsappNumber || driverUser.phone || driverContact;
//                         }
//                     } catch (e) { }
//                 }
//             }

//             // 4. Last resort: look up User directly by _id
//             if (!driverName) {
//                 const driverObjectId = (driverDoc && typeof driverDoc === 'object') ? driverDoc._id : driverDoc;
//                 if (driverObjectId) {
//                     try {
//                         const userDoc = await User.findById(driverObjectId).select('fullName whatsappNumber phone');
//                         if (userDoc) {
//                             driverName = userDoc.fullName;
//                             driverContact = userDoc.whatsappNumber || userDoc.phone || driverContact;
//                         }
//                     } catch (e) { }
//                 }
//             }

//             return {
//                 _id: trip._id,
//                 date: trip.tripDate,
//                 travelDate: trip.tripDate,
//                 tripDate: trip.tripDate,
//                 fromLocation: trip.fromLocation || trip.routeId?.fromLocation || 'Unknown',
//                 toLocation: trip.toLocation || trip.routeId?.toLocation || 'Unknown',
//                 route: `${trip.fromLocation || 'Unknown'} → ${trip.toLocation || 'Unknown'}`,
//                 status: trip.status,
//                 tripType: trip.tripType,
//                 direction: trip.direction,
//                 startTime: trip.startTime,
//                 endTime: trip.endTime,
//                 attendance: passengerEntry ?
//                     (passengerEntry.bookingStatus === 'NO_SHOW' ? 'ABSENT' : 'PRESENT') :
//                     (trip.status === 'COMPLETED' ? 'PRESENT' : 'SCHEDULED'),
//                 vehicleName: trip.vehicleId?.vehicleName || 'Not assigned',
//                 vehicleNumber: trip.vehicleId?.registrationNumber || 'Not assigned',
//                 vehicleCategory: trip.vehicleId?.vehicleCategory || '',
//                 driverName: driverName || 'Not assigned',
//                 driverContact: driverContact || 'Not available',
//                 seatNumber: passengerEntry?.seatNumber || passengerEntry?.seat || null
//             };
//         }));

//     } catch (error) {
//         console.error("Error getting employee travel history from trips:", error);
//         return [];
//     }
// };

// Get employee travel history from trips collection
const getEmployeeTravelHistoryFromTrips = async (userId, employee, period) => {
    try {
        if (!employee?.companyId) return [];

        const today = new Date();
        let startDate;

        switch (period) {
            case 'week':
                startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            default:
                startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Query trips collection for this employee's trips (where they are a passenger)
        const trips = await Trip.find({
            corporateId: employee.companyId,
            tripDate: { $gte: startDate, $lte: today },
            status: { $in: ['COMPLETED', 'CANCELLED', 'SCHEDULED', 'IN_PROGRESS'] },
            $or: [
                { 'passengers.passengerId': userId },
                { 'passengers.employeeId': employee._id }
            ]
        })
            .populate('routeId', 'fromLocation toLocation')
            .populate('vehicleId', 'vehicleName registrationNumber vehicleCategory')
            .populate('driverId', 'fullName whatsappNumber')
            .sort({ tripDate: -1 });

        // Map trips to display format - resolve driver names properly
        const Driver = (await import("../models/Driver.js")).default;
        const User = (await import("../models/User.js")).default;
        const CorporateDriverModel = (await import("../models/CorporateDriver.js")).default;

        return await Promise.all(trips.map(async (trip) => {
            // Check if this employee is a passenger in the trip
            // userId is the User._id, employee._id is the CorporateEmployee._id
            const passengerEntry = trip.passengers?.find(p =>
                (p.passengerId && p.passengerId.toString() === userId.toString()) ||
                (p.employeeId && p.employeeId.toString() === employee._id.toString())
            );

            // Resolve driver name - try multiple sources
            let driverName = null;
            let driverContact = null;
            const driverDoc = trip.driverId;

            // Get driverObjectId from either populated doc or raw ObjectId
            const driverObjectId = (driverDoc && typeof driverDoc === 'object' && driverDoc._id) ? driverDoc._id : driverDoc;

            // 1. Check if populate worked (User model)
            if (driverDoc && typeof driverDoc === 'object' && driverDoc._id) {
                driverName = driverDoc.name || driverDoc.fullName || null;
                driverContact = driverDoc.phone || driverDoc.whatsappNumber || null;
            }

            // 2. Try CorporateDriver model first (most common for corporate trips)
            if (!driverName && driverObjectId) {
                try {
                    const corpDriver = await CorporateDriverModel.findById(driverObjectId).select('name phone email');
                    if (corpDriver) {
                        driverName = corpDriver.name;
                        driverContact = corpDriver.phone || driverContact;
                    }
                } catch (e) { }
            }

            // 3. Check Driver model (B2B Partner drivers)
            if (!driverName && driverObjectId) {
                try {
                    const driver = await Driver.findById(driverObjectId).select('name phone email');
                    if (driver) {
                        driverName = driver.name;
                        driverContact = driver.phone || driverContact;
                    }
                } catch (e) { }
            }

            // 4. Find User account that has this driverId
            if (!driverName && driverObjectId) {
                try {
                    const driverUser = await User.findOne({ driverId: driverObjectId }).select('fullName whatsappNumber phone');
                    if (driverUser) {
                        driverName = driverUser.fullName;
                        driverContact = driverUser.whatsappNumber || driverUser.phone || driverContact;
                    }
                } catch (e) { }
            }

            // 5. Last resort: look up User directly by _id
            if (!driverName && driverObjectId) {
                try {
                    const userDoc = await User.findById(driverObjectId).select('fullName whatsappNumber phone');
                    if (userDoc) {
                        driverName = userDoc.fullName;
                        driverContact = userDoc.whatsappNumber || userDoc.phone || driverContact;
                    }
                } catch (e) { }
            }

            // 6. If still no driver, get from CorporateRouteSchedule (fallback for trips with null driverId)
            if (!driverName && trip.routeId) {
                try {
                    const CorporateRouteSchedule = (await import('../models/CorporateRouteSchedule.js')).default;
                    const routeId = typeof trip.routeId === 'object' ? trip.routeId._id : trip.routeId;
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
                } catch (e) { }
            }

            return {
                _id: trip._id,
                date: trip.tripDate,
                travelDate: trip.tripDate,
                tripDate: trip.tripDate,
                fromLocation: trip.fromLocation || trip.routeId?.fromLocation || 'Unknown',
                toLocation: trip.toLocation || trip.routeId?.toLocation || 'Unknown',
                route: `${trip.fromLocation || 'Unknown'} → ${trip.toLocation || 'Unknown'}`,
                status: trip.status,
                tripType: trip.tripType,
                direction: trip.direction,
                startTime: trip.startTime,
                endTime: trip.endTime,
                attendance: passengerEntry ?
                    (passengerEntry.bookingStatus === 'NO_SHOW' ? 'ABSENT' : 'PRESENT') :
                    (trip.status === 'COMPLETED' ? 'PRESENT' : 'SCHEDULED'),
                vehicleName: trip.vehicleId?.vehicleName || 'Not assigned',
                vehicleNumber: trip.vehicleId?.registrationNumber || 'Not assigned',
                vehicleCategory: trip.vehicleId?.vehicleCategory || '',
                driverName: driverName || 'Not assigned',
                driverContact: driverContact || 'Not available',
                seatNumber: passengerEntry?.seatNumber || passengerEntry?.seat || null
            };
        }));

    } catch (error) {
        console.error("Error getting employee travel history from trips:", error);
        return [];
    }
};

// Get upcoming trips from trips collection
const getUpcomingTripsFromTrips = async (userId, employee) => {
    try {
        if (!employee?.companyId) return { trips: [] };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Show every upcoming trip for the passenger's whole pass, not just the
        // next 30 days. A monthly-pass student is booked for the full pass
        // duration (1-3+ months), and capping the window at 30 days made their
        // "My Scheduled Trips" count (e.g. 21) disagree with the total the school
        // owner sees (e.g. 66). A generous 400-day horizon covers any pass length
        // while still excluding stale/past trips (handled by tripDate >= today).
        const endDate = new Date(today.getTime() + 400 * 24 * 60 * 60 * 1000);

        // Get trips where this employee is a passenger (or corporate-wide trips they're part of)
        // Don't populate driverId since it may reference CorporateDriver model, not User
        const trips = await Trip.find({
            corporateId: employee.companyId,
            tripDate: { $gte: today, $lte: endDate },
            status: { $in: ['SCHEDULED', 'IN_PROGRESS', 'Scheduled', 'Confirmed'] },
            $or: [
                { 'passengers.passengerId': userId },
                { 'passengers.employeeId': employee._id }
            ]
        })
            .populate('routeId', 'fromLocation toLocation stopPoints')
            .populate('vehicleId', 'vehicleName registrationNumber vehicleCategory model licensePlate')
            .sort({ tripDate: 1, startTime: 1 });

        const mappedTrips = await Promise.all(trips.map(async (trip) => {
            // Resolve driver name - driverId may be CorporateDriver, Driver, or User model ID
            let driverName = null;
            let driverContact = null;
            const driverObjectId = trip.driverId;

            if (driverObjectId) {
                // 1. First try CorporateDriver model (most common for corporate trips)
                try {
                    const corpDriver = await CorporateDriver.findById(driverObjectId).select('name phone email');
                    if (corpDriver) {
                        driverName = corpDriver.name;
                        driverContact = corpDriver.phone || null;
                    }
                } catch (e) { }

                // 2. If not found, try Driver model
                if (!driverName) {
                    try {
                        const driverRecord = await Driver.findById(driverObjectId).select('name phone');
                        if (driverRecord) {
                            driverName = driverRecord.name;
                            driverContact = driverRecord.phone || driverContact;
                        }
                    } catch (e) { }
                }

                // 3. Try User model directly
                if (!driverName) {
                    try {
                        const userDoc = await User.findById(driverObjectId).select('fullName whatsappNumber phone');
                        if (userDoc) {
                            driverName = userDoc.fullName;
                            driverContact = userDoc.whatsappNumber || userDoc.phone || driverContact;
                        }
                    } catch (e) { }
                }

                // 4. Find User account with this driverId
                if (!driverName) {
                    try {
                        const driverUser = await User.findOne({ driverId: driverObjectId }).select('fullName whatsappNumber phone');
                        if (driverUser) {
                            driverName = driverUser.fullName;
                            driverContact = driverUser.whatsappNumber || driverUser.phone || driverContact;
                        }
                    } catch (e) { }
                }
            }

            // Find the current user's passenger record
            const myPassenger = trip.passengers?.find(p =>
                p.passengerId?.toString() === userId.toString() ||
                p.employeeId?.toString() === employee._id.toString()
            );

            // Get pickup/dropoff based on direction and passenger record
            let pickupStop, dropoffStop;
            if (myPassenger) {
                pickupStop = myPassenger.pickupStop;
                dropoffStop = myPassenger.dropoffStop;
            } else if (trip.direction === 'FORWARD') {
                pickupStop = employee.transportDetails?.outboundPickupStop;
                dropoffStop = employee.transportDetails?.outboundDropoffStop;
            } else if (trip.direction === 'RETURN') {
                pickupStop = employee.transportDetails?.returnPickupStop;
                dropoffStop = employee.transportDetails?.returnDropoffStop;
            }

            // Classify the trip's ACTUAL destination (see path above) so the label
            // is truthful for one-way "Campus -> Home" routes too.
            const normLoc2 = (s) => String(s || "").trim().toLowerCase();
            const officeAnchor2 = normLoc2(
                employee.transportDetails?.outboundDropoffStop || trip.toLocation
            );
            const homeAnchor2 = normLoc2(
                employee.transportDetails?.returnDropoffStop ||
                employee.transportDetails?.outboundPickupStop ||
                employee.homeAddress
            );
            const actualDropoff2 = normLoc2(dropoffStop || trip.toLocation);
            let destinationKind2 = null;
            if (actualDropoff2 && officeAnchor2 && actualDropoff2 === officeAnchor2) {
                destinationKind2 = "OFFICE";
            } else if (actualDropoff2 && homeAnchor2 && actualDropoff2 === homeAnchor2) {
                destinationKind2 = "HOME";
            }

            return {
                _id: trip._id,
                date: trip.tripDate?.toISOString().split('T')[0],
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                endTime: trip.endTime,
                fromLocation: trip.fromLocation || 'Unknown',
                toLocation: trip.toLocation || 'Unknown',
                route: `${trip.fromLocation || 'Unknown'} -> ${trip.toLocation || 'Unknown'}`,
                tripType: trip.tripType,
                direction: trip.direction,
                destinationKind: destinationKind2,
                status: trip.status,
                driverId: driverObjectId,
                vehicleName: trip.vehicleId?.vehicleName || trip.vehicleId?.model || 'Not assigned',
                vehicleNumber: trip.vehicleId?.registrationNumber || trip.vehicleId?.licensePlate || 'Not assigned',
                driverName: driverName || 'Will be assigned',
                driverContact: driverContact || 'Not available',
                totalSeats: trip.totalSeats,
                availableSeats: trip.availableSeats,
                bookedSeats: trip.bookedSeats,
                pickupLocation: employee.transportDetails?.pickupPoint || trip.fromLocation,
                dropoffLocation: employee.transportDetails?.dropOffPoint || trip.toLocation,
                stopPoints: trip.stopPoints || trip.routeId?.stopPoints || [],
                passengers: trip.passengers || [],
                // Add employee-specific pickup/dropoff for this trip
                myPickupStop: pickupStop,
                myDropoffStop: dropoffStop,
                routeId: trip.routeId ? {
                    _id: trip.routeId._id,
                    fromLocation: trip.routeId.fromLocation,
                    toLocation: trip.routeId.toLocation,
                    stopPoints: trip.routeId.stopPoints || []
                } : null
            };
        }));

        return { trips: mappedTrips };

    } catch (error) {
        console.error("Error getting upcoming trips from trips:", error);
        return { trips: [] };
    }
};

// Get assigned vehicle info from contract
const getAssignedVehicleInfoFromContract = async (employee) => {
    try {
        if (!employee?.companyId) {
            return { vehicleNumber: null, vehicleType: null, capacity: null, driverName: null, driverContact: null, seatNumber: null };
        }

        const contract = await Contract.findOne({
            corporateOwnerId: employee.companyId,
            status: 'ACTIVE'
        });

        if (!contract || !contract.vehicles?.length) {
            return { vehicleNumber: null, vehicleType: null, capacity: null, driverName: null, driverContact: null, seatNumber: null };
        }

        let foundAssignment = null;
        const assignedRouteId = employee.transportDetails?.assignedRoute?.toString();

        for (const vehicleGroup of contract.vehicles) {
            if (vehicleGroup.assignedVehicles?.length > 0) {
                for (const assignment of vehicleGroup.assignedVehicles) {
                    if (assignment.status === 'ACTIVE') {
                        if (assignedRouteId && assignment.routeDetails?.toString() === assignedRouteId) {
                            foundAssignment = assignment;
                            break;
                        } else if (!foundAssignment) {
                            foundAssignment = assignment;
                        }
                    }
                }
            }
        }

        if (!foundAssignment) {
            return { vehicleNumber: null, vehicleType: null, capacity: null, driverName: null, driverContact: null, seatNumber: null };
        }

        const vehicle = foundAssignment.vehicleId ? await Vehicle.findById(foundAssignment.vehicleId) : null;
        let driver = null;
        if (foundAssignment.driverId) {
            const driverModel = foundAssignment.driverModel || 'Driver';
            if (driverModel === 'Driver') {
                driver = await Driver.findById(foundAssignment.driverId);
            } else {
                driver = await User.findById(foundAssignment.driverId);
            }
        }

        return {
            vehicleNumber: vehicle?.registrationNumber || null,
            vehicleName: vehicle?.vehicleName || null,
            vehicleType: vehicle?.vehicleCategory || null,
            capacity: vehicle?.capacity?.seatingCapacity || null,
            driverName: driver?.name || driver?.fullName || 'Not assigned',
            driverContact: driver?.phone || driver?.whatsappNumber || 'Not available',
            seatNumber: employee.transportDetails?.seatNumber || 'Not assigned'
        };

    } catch (error) {
        console.error("Error getting assigned vehicle info from contract:", error);
        return { vehicleNumber: null, vehicleType: null, capacity: null, driverName: null, driverContact: null, seatNumber: null };
    }
};

const getRouteSchedule = async (routeId) => {
    try {
        const route = await Route.findById(routeId)
            .populate('contractId', 'corporateOwnerId')
            .populate('vehicleId', 'vehicleNumber vehicleType');

        if (!route) {
            return {
                routeId,
                schedule: [],
                error: "Route not found"
            };
        }

        // Generate schedule based on route stop points
        const schedule = route.stopPoints.map(stop => ({
            day: "MONDAY", // Default to Monday - can be enhanced for different days
            pickupTime: stop.time,
            dropoffTime: stop.time, // Same time for simplicity - can be enhanced
            location: stop.location
        }));

        return {
            routeId,
            routeName: `${route.fromLocation} → ${route.toLocation}`,
            fromLocation: route.fromLocation,
            toLocation: route.toLocation,
            stopPoints: route.stopPoints,
            schedule,
            vehicleInfo: route.vehicleId ? {
                vehicleNumber: route.vehicleId.vehicleNumber,
                vehicleType: route.vehicleId.vehicleType
            } : null
        };

    } catch (error) {
        console.error("Error getting route schedule:", error);
        return {
            routeId,
            schedule: [],
            error: "Failed to get route schedule"
        };
    }
};

const createEmployeeBooking = async (employee, date) => {
    try {
        const targetDate = new Date(date);
        const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

        // Find the trip for this date
        const trip = await Trip.findOne({
            corporateId: employee.companyId,
            tripDate: { $gte: dayStart, $lt: dayEnd },
            status: 'SCHEDULED'
        });

        if (!trip) {
            return { success: false, message: "No trip found for this date" };
        }

        // Check if already booked
        const alreadyBooked = trip.passengers?.some(p =>
            p.employeeId && p.employeeId.toString() === employee.userId.toString()
        );
        if (alreadyBooked) {
            return { success: false, message: "Already booked for this date" };
        }

        // Add employee as passenger
        trip.passengers.push({
            employeeId: employee.userId,
            seatNumber: trip.bookedSeats + 1,
            pickupPoint: employee.transportDetails?.pickupPoint || trip.fromLocation,
            pickupTime: trip.startTime,
            bookingStatus: 'CONFIRMED'
        });
        trip.bookedSeats = (trip.bookedSeats || 0) + 1;
        trip.availableSeats = Math.max(0, (trip.availableSeats || trip.totalSeats) - 1);
        await trip.save();

        return {
            success: true,
            bookingId: trip._id,
            employeeId: employee._id,
            date,
            status: "CONFIRMED",
            createdAt: new Date()
        };

    } catch (error) {
        console.error("Error creating employee booking:", error);
        return { success: false, message: "Failed to create booking", error: error.message };
    }
};

const cancelEmployeeBooking = async (employee, date, reason) => {
    try {
        const targetDate = new Date(date);
        const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

        // Find trip for this date
        const trip = await Trip.findOne({
            corporateId: employee.companyId,
            tripDate: { $gte: dayStart, $lt: dayEnd },
            status: { $in: ['SCHEDULED', 'IN_PROGRESS'] }
        });

        if (!trip) {
            return { success: false, message: "No trip found for this date" };
        }

        // Find passenger entry
        const passengerIdx = trip.passengers?.findIndex(p =>
            p.employeeId && p.employeeId.toString() === employee.userId.toString()
        );

        if (passengerIdx < 0) {
            return { success: false, message: "Not booked for this trip" };
        }

        // Mark as cancelled
        trip.passengers[passengerIdx].bookingStatus = 'CANCELLED';
        trip.bookedSeats = Math.max(0, (trip.bookedSeats || 1) - 1);
        trip.availableSeats = (trip.availableSeats || 0) + 1;
        await trip.save();

        return {
            success: true,
            bookingId: trip._id,
            employeeId: employee._id,
            date,
            reason,
            status: "CANCELLED",
            cancelledAt: new Date()
        };

    } catch (error) {
        console.error("Error cancelling employee booking:", error);
        return { success: false, message: "Failed to cancel booking", error: error.message };
    }
};

const getEmployeeSummary = async (userId, period) => {
    try {
        const employee = await CorporateEmployee.findOne({ userId });

        if (!employee) {
            return { totalTravelDays: 0, presentDays: 0, absentTrips: 0, onTimePercentage: 0, averageRating: 0 };
        }

        const today = new Date();
        let startDate;

        switch (period) {
            case 'week':
                startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            default:
                startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Query trips collection for this corporate
        const trips = await Trip.find({
            corporateId: employee.companyId,
            tripDate: { $gte: startDate, $lte: today }
        });

        const totalTravelDays = trips.length;
        const presentDays = trips.filter(t => t.status === 'COMPLETED').length;
        const absentTrips = trips.filter(t => t.status === 'CANCELLED').length;
        const onTimePercentage = totalTravelDays > 0 ? (presentDays / totalTravelDays) * 100 : 0;

        // Get feedback from employee record
        const averageRating = employee.feedback?.averageRating || 0;

        return {
            totalTravelDays,
            presentDays,
            absentTrips,
            onTimePercentage: parseFloat(onTimePercentage.toFixed(1)),
            averageRating: parseFloat(averageRating.toFixed ? averageRating.toFixed(1) : '0')
        };

    } catch (error) {
        console.error("Error getting employee summary:", error);
        return { totalTravelDays: 0, presentDays: 0, absentTrips: 0, onTimePercentage: 0, averageRating: 0 };
    }
};

const sendWelcomeEmail = async (user, employee) => {
    try {
        await sendEmail({
            to: user.email,
            subject: "Welcome to Corporate Transport System - DriveMe",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to DriveMe Corporate Transport!</h2>
                    <p>Hello <strong>${employee.fullName || user.fullName}</strong>,</p>
                    <p>You have been successfully registered for the corporate transport system.</p>
                    <p>You can now login and view your assigned route, schedule, and manage your daily travel.</p>
                    <a href="${process.env.FRONTEND_URL.split(",")[0] || 'http://localhost:5173'}/login" style="background: #1a237e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Login Now</a>
                </div>
            `
        });
    } catch (error) {
        console.error("Error sending welcome email:", error);
    }
};

const notifyManagerOfAbsence = async (employee, reason) => {
    try {
        const manager = await User.findById(employee.companyId);
        if (manager) {
            await sendEmail({
                to: manager.email,
                subject: "Employee Absence Report - DriveMe",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Employee Absence Report</h2>
                        <p>Hello <strong>${manager.fullName}</strong>,</p>
                        <p>An employee has reported absence from today's transport service.</p>
                        <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <p><strong>Employee:</strong> ${employee.fullName || employee.personalInfo?.firstName + ' ' + employee.personalInfo?.lastName}</p>
                            <p><strong>Email:</strong> ${employee.personalInfo?.email || 'N/A'}</p>
                            <p><strong>Reason:</strong> ${reason || 'Not provided'}</p>
                            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                `
            });
        }
    } catch (error) {
        console.error("Error notifying manager of absence:", error);
    }
};

const notifyManagerOfRouteChange = async (employee, changeRequest) => {
    try {
        const manager = await User.findById(employee.companyId);
        if (manager) {
            await sendEmail({
                to: manager.email,
                subject: "Route Change Request - DriveMe",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Route Change Request</h2>
                        <p>Hello <strong>${manager.fullName}</strong>,</p>
                        <p>An employee has requested a route change.</p>
                        <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <p><strong>Employee:</strong> ${employee.fullName || employee.personalInfo?.firstName + ' ' + employee.personalInfo?.lastName}</p>
                            <p><strong>Reason:</strong> ${changeRequest.reason || 'Not provided'}</p>
                            <p><strong>Effective Date:</strong> ${changeRequest.effectiveDate ? new Date(changeRequest.effectiveDate).toLocaleDateString() : 'ASAP'}</p>
                        </div>
                        <p>Please review and approve/reject this request from your dashboard.</p>
                    </div>
                `
            });
        }
    } catch (error) {
        console.error("Error notifying manager of route change:", error);
    }
};

// Get employee monthly passes
export const getEmployeeMonthlyPasses = async (req, res) => {
    try {
        const userId = req.userId;

        // Find the employee record
        const employee = await CorporateEmployee.findOne({ userId });
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Get monthly passes for this employee
        const allPasses = await MonthlyPass.find({
            employeeId: userId,
            status: { $in: ['ACTIVE', 'PENDING'] }
        })
            .populate('routeId', 'fromLocation toLocation stopPoints')
            .populate('contractId', 'contractType')
            .sort({ validTo: -1 });

        // Deduplicate - keep only the most recent pass per route
        const passMap = new Map();
        for (const pass of allPasses) {
            const routeKey = pass.routeId?._id?.toString() || 'no-route';
            if (!passMap.has(routeKey)) {
                passMap.set(routeKey, pass);
            }
        }
        const passes = Array.from(passMap.values());

        // If no passes found, try to get transport info from employee record
        if (passes.length === 0 && employee.transportDetails?.assignedRoute) {
            const route = await Route.findById(employee.transportDetails.assignedRoute);
            if (route) {
                // Return a virtual pass based on route assignment
                return res.status(200).json({
                    success: true,
                    data: [{
                        _id: 'virtual-pass',
                        passType: 'CORPORATE',
                        status: 'ACTIVE',
                        fromLocation: route.fromLocation,
                        toLocation: route.toLocation,
                        preferredPickupPoint: employee.transportDetails?.outboundPickupStop || employee.transportDetails?.pickupPoint,
                        preferredDropPoint: employee.transportDetails?.outboundDropoffStop || employee.transportDetails?.dropOffPoint,
                        shiftType: employee.transportDetails?.shiftType,
                        subscriptionType: 'COMPANY_PAID'
                    }]
                });
            }
        }

        res.status(200).json({
            success: true,
            data: passes
        });
    } catch (error) {
        console.error("Error getting employee monthly passes:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving monthly passes",
            error: error.message
        });
    }
};

// Helper functions for database operations
const getActiveContractForEmployee = async (employeeId) => {
    try {
        const employee = await CorporateEmployee.findById(employeeId);
        const activeContract = await Contract.findOne({
            corporateOwnerId: employee.companyId,
            status: 'ACTIVE'
        });
        return activeContract?._id || null;
    } catch (error) {
        console.error("Error getting active contract:", error);
        return null;
    }
};

const getAssignedDriverForEmployee = async (employeeId) => {
    try {
        const employee = await CorporateEmployee.findById(employeeId);
        if (!employee?.companyId) return null;

        const contract = await Contract.findOne({
            corporateOwnerId: employee.companyId,
            status: 'ACTIVE'
        });

        if (!contract?.vehicles?.length) return null;

        for (const vg of contract.vehicles) {
            for (const av of (vg.assignedVehicles || [])) {
                if (av.status === 'ACTIVE' && av.driverId) {
                    return av.driverId;
                }
            }
        }
        return null;
    } catch (error) {
        console.error("Error getting assigned driver:", error);
        return null;
    }
};
