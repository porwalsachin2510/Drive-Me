import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";
import User from "../models/User.js";
import { generateTripsForSchedule } from "../Services/tripGenerationService.js";

// Helper function to convert time to HH:MM AM/PM format
const convertToAMPMFormat = (timeString) => {
    if (!timeString) return "";
    
    // If already in correct format, return as is
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s?(AM|PM)$/i.test(timeString)) {
        return timeString.toUpperCase();
    }
    
    // Handle 24-hour format (HH:MM or HH:MM:SS)
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(timeString)) {
        const [hours, minutes] = timeString.split(':').map(Number);
        
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12; // Convert 0 to 12
        
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    
    // Handle other formats, try to extract time
    const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
        let [, hours, minutes, period] = timeMatch;
        hours = parseInt(hours);
        minutes = parseInt(minutes);
        
        if (!period) {
            period = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
        }
        
        return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    
    return timeString;
};

// Create B2C Partner Route
export const createB2CPartnerRoute = async (req, res) => {
    try {
        console.log("[v0] Creating B2C Partner Route with data:", JSON.stringify(req.body, null, 2));

        const {
            fromLocation,
            toLocation,
            totalSeats,
            availableSeats,
            stops,
            pricing,
            assignedVehicle,
            assignedDriver,
            routeStartDate,
            description,
            isActive = true
        } = req.body;

        // Validate required fields
        if (!fromLocation || !toLocation) {
            return res.status(400).json({
                success: false,
                message: "From and To locations are required",
            });
        }

        // Create route data
        const routeData = {
            b2cPartnerId: req.userId,
            fromLocation,
            toLocation,
            totalSeats: parseInt(totalSeats) || 20,
            availableSeats: parseInt(availableSeats) || parseInt(totalSeats) || 20,
            stops: stops || [],
            pricing: {
                oneWayPrice: parseFloat(pricing?.oneWayPrice || 0),
                roundTripPrice: parseFloat(pricing?.roundTripPrice || 0),
                monthlyOneWayPrice: parseFloat(pricing?.monthlyOneWayPrice || 0),
                monthlyRoundTripPrice: parseFloat(pricing?.monthlyRoundTripPrice || 0),
            },
            assignedVehicle: assignedVehicle || null,
            assignedDriver: assignedDriver || null,
            routeStartDate: new Date(routeStartDate || Date.now()),
            description: description || "",
            status: "Active",
            isActive: true
        };

        const route = await B2CPartnerRoute.create(routeData);
        console.log("[v0] B2C Partner Route created successfully:", route._id);

        res.status(201).json({
            success: true,
            message: "B2C Partner Route created successfully",
            route,
        });
    } catch (error) {
        console.error("[v0] Error creating B2C partner route:", error.message);
        res.status(500).json({
            success: false,
            message: "Error creating B2C partner route",
            error: error.message,
        });
    }
};

// Create Schedule for Route
export const createB2CPartnerSchedule = async (req, res) => {
    try {
        console.log("[v0] Creating B2C Partner Schedule with data:", JSON.stringify(req.body, null, 2));

        const {
            routeId,
            scheduleName,
            tripTimes, // Array of { departureTime, arrivalTime, tripType: "One Way" | "Round Trip" }
            availableDays,
            assignedVehicle,
            assignedDriver,
            startDate,
            endDate,
            isActive = true
        } = req.body;

        // Validate required fields
        if (!routeId || !tripTimes || tripTimes.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Route ID and trip times are required",
            });
        }

        // Verify route belongs to this partner
        const route = await B2CPartnerRoute.findOne({
            _id: routeId,
            b2cPartnerId: req.userId,
        });

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            });
        }

        // Create schedule data
        const scheduleData = {
            b2cPartnerId: req.userId,
            routeId: routeId,
            scheduleName: scheduleName || `${route.fromLocation} to ${route.toLocation} Schedule`,
            tripTimes: tripTimes.map(time => ({
                departureTime: convertToAMPMFormat(time.departureTime),
                arrivalTime: time.arrivalTime ? convertToAMPMFormat(time.arrivalTime) : null,
                tripType: time.tripType || "One Way",
                outboundStopPoints: time.outboundStopPoints ? time.outboundStopPoints.map(stop => ({
                    location: stop.location,
                    time: convertToAMPMFormat(stop.time)
                })) : [],
                returnStopPoints: time.returnStopPoints ? time.returnStopPoints.map(stop => ({
                    location: stop.location,
                    time: convertToAMPMFormat(stop.time)
                })) : []
            })),
            availableDays: availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            assignedVehicle: assignedVehicle || route.assignedVehicle,
            assignedDriver: assignedDriver || route.assignedDriver,
            startDate: new Date(startDate || Date.now()),
            endDate: endDate ? new Date(endDate) : null,
            isActive: isActive,
            status: "Active",
            lastTripGenerated: new Date(),
            nextTripGeneration: new Date()
        };

        const schedule = await B2CPartnerSchedule.create(scheduleData);
        console.log("[v0] B2C Partner Schedule created successfully:", schedule._id);

        // Assign vehicle to driver if both are provided
        if (assignedVehicle && assignedDriver) {
            console.log("[v0] Assigning vehicle to driver:", assignedVehicle, assignedDriver);
            try {
                await B2CPartnerDriver.findByIdAndUpdate(
                    assignedDriver,
                    { 
                        $addToSet: { assignedVehicles: assignedVehicle },
                        $set: { updatedAt: new Date() }
                    }
                );
                console.log("[v0] Vehicle assigned to driver successfully");
                
                // Also assign driver to vehicle
                await B2CPartnerVehicle.findByIdAndUpdate(
                    assignedVehicle,
                    { 
                        $addToSet: { assignedDrivers: assignedDriver },
                        $set: { updatedAt: new Date() }
                    }
                );
                console.log("[v0] Driver assigned to vehicle successfully");
            } catch (assignmentError) {
                console.error("[v0] Error assigning vehicle to driver:", assignmentError);
                // Don't fail schedule creation if assignment fails
            }
        }

        // NOTE: DO NOT generate trips automatically when B2C_PARTNER creates schedule
        // Trips should only be generated when COMMUTER makes booking
        // This prevents creating empty trips that no one has booked
        console.log("[v0] Schedule created - trips will be generated on passenger booking");

        res.status(201).json({
            success: true,
            message: "B2C Partner Schedule created successfully",
            schedule,
        });
    } catch (error) {
        console.error("[v0] Error creating B2C partner schedule:", error.message);
        res.status(500).json({
            success: false,
            message: "Error creating B2C partner schedule",
            error: error.message,
        });
    }
};

// Get B2C Partner Routes with Schedules
export const getB2CPartnerRoutes = async (req, res) => {
    try {
        console.log("[v0] Fetching B2C Partner Routes for partner:", req.userId);

        const routes = await B2CPartnerRoute.find({
            b2cPartnerId: req.userId,
        })
        .populate('assignedVehicle', 'model licensePlate vehicleType seatingCapacity images')
        .sort({ createdAt: -1 });
        
        // Get the B2C_PARTNER user info for self-driver case
        const partnerUser = await User.findById(req.userId).select('fullName whatsappNumber profileImage');

        // Get schedules for each route and handle driver info
        const routesWithSchedules = await Promise.all(
            routes.map(async (route) => {
                const routeObj = route.toObject();

                // Get schedules for this route
                const schedules = await B2CPartnerSchedule.find({
                    routeId: route._id,
                    b2cPartnerId: req.userId,
                })
                .populate('assignedVehicle', 'model licensePlate vehicleType seatingCapacity')
                    .sort({ createdAt: -1 });
                
                // Handle driver info - check if it's self-driver or assigned driver
                let driverInfo = null;
                let isSelfDriver = false;

                // First, try to get assignedDriver from B2CPartnerDriver table
                if (route.assignedDriver) {
                    const assignedDriver = await B2CPartnerDriver.findById(route.assignedDriver)
                        .select('name phoneNumber licenseNumber driverImage');

                    if (assignedDriver) {
                        // It's an assigned driver from b2cpartnerdrivers table
                        driverInfo = {
                            _id: assignedDriver._id,
                            name: assignedDriver.name,
                            phoneNumber: assignedDriver.phoneNumber,
                            licenseNumber: assignedDriver.licenseNumber,
                            image: assignedDriver.driverImage?.url
                        };
                        isSelfDriver = false;
                    } else {
                        // The ID might be a User ID (self-driver case)
                        // Check if assignedDriver matches the partner's user ID
                        if (route.assignedDriver.toString() === req.userId.toString()) {
                            driverInfo = {
                                _id: partnerUser._id,
                                name: partnerUser.fullName || "Self",
                                phoneNumber: partnerUser.whatsappNumber,
                                image: partnerUser.profileImage,
                                isSelfDriver: true
                            };
                            isSelfDriver = true;
                        }
                    }
                }

                // Get start time from schedule if route doesn't have it
                let startTime = routeObj.startTime;
                if (!startTime && schedules.length > 0 && schedules[0].tripTimes?.length > 0) {
                    startTime = schedules[0].tripTimes[0].departureTime;
                }

                // Get available days from schedule if route doesn't have it
                let availableDays = routeObj.availableDays;
                if ((!availableDays || availableDays.length === 0) && schedules.length > 0) {
                    availableDays = schedules[0].availableDays;
                }

                // Process schedules to include driver info
                const processedSchedules = await Promise.all(schedules.map(async (schedule) => {
                    const scheduleObj = schedule.toObject();
                    let scheduleDriverInfo = null;
                    let scheduleIsSelfDriver = false;

                    if (schedule.assignedDriver) {
                        const scheduleDriver = await B2CPartnerDriver.findById(schedule.assignedDriver)
                            .select('name phoneNumber licenseNumber driverImage');

                        if (scheduleDriver) {
                            scheduleDriverInfo = {
                                _id: scheduleDriver._id,
                                name: scheduleDriver.name,
                                phoneNumber: scheduleDriver.phoneNumber,
                                licenseNumber: scheduleDriver.licenseNumber,
                                image: scheduleDriver.driverImage?.url
                            };
                        } else if (schedule.assignedDriver.toString() === req.userId.toString()) {
                            scheduleDriverInfo = {
                                _id: partnerUser._id,
                                name: partnerUser.fullName || "Self",
                                phoneNumber: partnerUser.whatsappNumber,
                                image: partnerUser.profileImage,
                                isSelfDriver: true
                            };
                            scheduleIsSelfDriver = true;
                        }
                    }

                    return {
                        ...scheduleObj,
                        driverInfo: scheduleDriverInfo,
                        isSelfDriver: scheduleIsSelfDriver
                    };
                }));

                return {
                    ...routeObj,
                    startTime: startTime || "",
                    availableDays: availableDays || [],
                    schedules: processedSchedules,
                    driverInfo: driverInfo,
                    isSelfDriver: isSelfDriver,
                    assignedDriver: driverInfo // Override with processed info for backward compatibility
                };
            })
        );

        console.log("[v0] Found B2C Partner Routes:", routesWithSchedules.length);

        res.status(200).json({
            success: true,
            count: routesWithSchedules.length,
            routes: routesWithSchedules,
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C partner routes:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C partner routes",
            error: error.message,
        });
    }
};

// Get B2C Partner Schedules
export const getB2CPartnerSchedules = async (req, res) => {
    try {
        console.log("[v0] Fetching B2C Partner Schedules for partner:", req.userId);

        const schedules = await B2CPartnerSchedule.find({
            b2cPartnerId: req.userId,
        })
        .populate('routeId', 'fromLocation toLocation tripType')
        .populate('assignedVehicle', 'model licensePlate vehicleType seatingCapacity')
        .sort({ createdAt: -1 });

        // Get the B2C_PARTNER user info for self-driver case
        const partnerUser = await User.findById(req.userId).select('fullName whatsappNumber profileImage');

        // Process schedules to include proper driver info
        const processedSchedules = await Promise.all(schedules.map(async (schedule) => {
            const scheduleObj = schedule.toObject();
            let driverInfo = null;
            let isSelfDriver = false;

            if (schedule.assignedDriver) {
                // Try to find driver in B2CPartnerDriver table
                const assignedDriver = await B2CPartnerDriver.findById(schedule.assignedDriver)
                    .select('name phoneNumber licenseNumber driverImage');

                if (assignedDriver) {
                    driverInfo = {
                        _id: assignedDriver._id,
                        name: assignedDriver.name,
                        phoneNumber: assignedDriver.phoneNumber,
                        licenseNumber: assignedDriver.licenseNumber,
                        image: assignedDriver.driverImage?.url
                    };
                } else if (schedule.assignedDriver.toString() === req.userId.toString()) {
                    // Self-driver case
                    driverInfo = {
                        _id: partnerUser._id,
                        name: partnerUser.fullName || "Self",
                        phoneNumber: partnerUser.whatsappNumber,
                        image: partnerUser.profileImage,
                        isSelfDriver: true
                    };
                    isSelfDriver = true;
                }
            }

            return {
                ...scheduleObj,
                driverInfo: driverInfo,
                isSelfDriver: isSelfDriver,
                assignedDriver: driverInfo // Override for backward compatibility
            };
        }));

        console.log("[v0] Found B2C Partner Schedules:", processedSchedules.length);

        res.status(200).json({
            success: true,
            count: processedSchedules.length,
            schedules: processedSchedules,
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C partner schedules:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching B2C partner schedules",
            error: error.message,
        });
    }
};

// Update B2C Partner Schedule
export const updateB2CPartnerSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const updateData = req.body;

        // Verify schedule belongs to this partner
        const schedule = await B2CPartnerSchedule.findOne({
            _id: scheduleId,
            b2cPartnerId: req.userId,
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: "Schedule not found",
            });
        }

        // Update trip times if provided
        if (updateData.tripTimes) {
            updateData.tripTimes = updateData.tripTimes.map(time => ({
                departureTime: convertToAMPMFormat(time.departureTime),
                arrivalTime: time.arrivalTime ? convertToAMPMFormat(time.arrivalTime) : null,
                tripType: time.tripType || "One Way",
                outboundStopPoints: time.outboundStopPoints ? time.outboundStopPoints.map(stop => ({
                    location: stop.location,
                    time: convertToAMPMFormat(stop.time)
                })) : [],
                returnStopPoints: time.returnStopPoints ? time.returnStopPoints.map(stop => ({
                    location: stop.location,
                    time: convertToAMPMFormat(stop.time)
                })) : []
            }));
        }

        const updatedSchedule = await B2CPartnerSchedule.findByIdAndUpdate(
            scheduleId,
            updateData,
            { new: true }
        )
        .populate('routeId', 'fromLocation toLocation tripType')
        .populate('assignedVehicle', 'model licensePlate vehicleType seatingCapacity')
        .populate('assignedDriver', 'name phoneNumber licenseNumber');

        console.log("[v0] B2C Partner Schedule updated successfully:", scheduleId);

        res.status(200).json({
            success: true,
            message: "B2C Partner Schedule updated successfully",
            schedule: updatedSchedule,
        });
    } catch (error) {
        console.error("[v0] Error updating B2C partner schedule:", error.message);
        res.status(500).json({
            success: false,
            message: "Error updating B2C partner schedule",
            error: error.message,
        });
    }
};

// Delete B2C Partner Schedule
export const deleteB2CPartnerSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;

        // Verify schedule belongs to this partner
        const schedule = await B2CPartnerSchedule.findOne({
            _id: scheduleId,
            b2cPartnerId: req.userId,
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: "Schedule not found",
            });
        }

        // Delete associated trips
        await B2CPartnerTrip.deleteMany({
            scheduleId: scheduleId,
        });

        // Delete schedule
        await B2CPartnerSchedule.findByIdAndDelete(scheduleId);

        console.log("[v0] B2C Partner Schedule deleted successfully:", scheduleId);

        res.status(200).json({
            success: true,
            message: "B2C Partner Schedule deleted successfully",
        });
    } catch (error) {
        console.error("[v0] Error deleting B2C partner schedule:", error.message);
        res.status(500).json({
            success: false,
            message: "Error deleting B2C partner schedule",
            error: error.message,
        });
    }
};

// Delete B2C Partner Route
export const deleteB2CPartnerRoute = async (req, res) => {
    try {
        const { routeId } = req.params;

        // Verify route belongs to this partner
        const route = await B2CPartnerRoute.findOne({
            _id: routeId,
            b2cPartnerId: req.userId,
        });

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            });
        }

        // Delete associated schedules and trips
        const schedules = await B2CPartnerSchedule.find({
            routeId: routeId,
        });

        for (const schedule of schedules) {
            await B2CPartnerTrip.deleteMany({
                scheduleId: schedule._id,
            });
            await B2CPartnerSchedule.findByIdAndDelete(schedule._id);
        }

        // Delete route
        await B2CPartnerRoute.findByIdAndDelete(routeId);

        console.log("[v0] B2C Partner Route deleted successfully:", routeId);

        res.status(200).json({
            success: true,
            message: "B2C Partner Route deleted successfully",
        });
    } catch (error) {
        console.error("[v0] Error deleting B2C partner route:", error.message);
        res.status(500).json({
            success: false,
            message: "Error deleting B2C partner route",
            error: error.message,
        });
    }
};

// Get Today's Trips for B2C Partner
export const getTodayTrips = async (req, res) => {
    try {
        const { routeId, scheduleId } = req.query;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 30);
        
        const queryFilter = {
            b2cPartnerId: req.userId,
            tripDate: {
                $gte: today,
                $lt: endDate
            }
        };
        
        if (routeId) {
            queryFilter.routeId = routeId;
        }
        
        if (scheduleId) {
            queryFilter.scheduleId = scheduleId;
        }
        
        const trips = await B2CPartnerTrip.find(queryFilter)
        .populate('vehicleId', 'model licensePlate vehicleType')
        .populate('driverId', 'name phoneNumber')
        .populate('routeId', 'fromLocation toLocation startTime')
        .populate('scheduleId', 'scheduleName tripTimes')
        .sort({ tripDate: 1, startTime: 1 });

        res.status(200).json({
            success: true,
            trips: trips || []
        });
    } catch (error) {
        console.error("[v0] Error fetching today's trips:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching today's trips",
            error: error.message
        });
    }
};

// Create B2C Partner Trip (Manual)
export const createB2CPartnerTrip = async (req, res) => {
    try {
        console.log("[v0] Creating B2C Partner Trip with data:", JSON.stringify(req.body, null, 2));

        const {
            routeId,
            scheduleId,
            tripDate,
            startTime,
            endTime,
            vehicleId,
            driverId,
            tripType,
            fromLocation,
            toLocation,
            totalSeats,
            availableSeats,
            pricing
        } = req.body;

        // Validate required fields
        if (!routeId || !scheduleId || !tripDate || !startTime) {
            return res.status(400).json({
                success: false,
                message: "Route ID, Schedule ID, Trip Date, and Start Time are required",
            });
        }

        // Verify route and schedule belong to this partner
        const [route, schedule] = await Promise.all([
            B2CPartnerRoute.findOne({ _id: routeId, b2cPartnerId: req.userId }),
            B2CPartnerSchedule.findOne({ _id: scheduleId, b2cPartnerId: req.userId })
        ]);

        if (!route || !schedule) {
            return res.status(404).json({
                success: false,
                message: "Route or Schedule not found",
            });
        }

        // Create trip data
        const tripData = {
            b2cPartnerId: req.userId,
            routeId,
            scheduleId,
            tripDate: new Date(tripDate),
            startTime: convertToAMPMFormat(startTime),
            endTime: endTime ? convertToAMPMFormat(endTime) : null,
            vehicleId: vehicleId || schedule.assignedVehicle,
            driverId: driverId || schedule.assignedDriver,
            tripType: tripType || route.tripType,
            fromLocation: fromLocation || route.fromLocation,
            toLocation: toLocation || route.toLocation,
            totalSeats: parseInt(totalSeats) || route.totalSeats,
            availableSeats: parseInt(availableSeats) || route.availableSeats,
            pricing: pricing || route.pricing,
            status: "Scheduled"
        };

        const trip = await B2CPartnerTrip.create(tripData);
        console.log("[v0] B2C Partner Trip created successfully:", trip._id);

        res.status(201).json({
            success: true,
            message: "B2C Partner Trip created successfully",
            trip,
        });
    } catch (error) {
        console.error("[v0] Error creating B2C partner trip:", error.message);
        res.status(500).json({
            success: false,
            message: "Error creating B2C partner trip",
            error: error.message,
        });
    }
};
