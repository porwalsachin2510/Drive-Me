import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import User from "../models/User.js";
import { generateTripsForSchedule } from "../Services/tripGenerationService.js";
import { getCountryCurrency, getCurrencyDecimals, validateCountryPrice } from "../Services/countryLocalizationService.js";

// Helper function to convert time string to minutes for comparison
const timeToMinutes = (timeString) => {
    if (!timeString) return 0;

    // Handle HH:MM AM/PM format
    const match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const period = match[3]?.toUpperCase();

        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }

        return hours * 60 + minutes;
    }

    // Handle 24-hour format HH:MM
    const match24 = timeString.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
        return parseInt(match24[1]) * 60 + parseInt(match24[2]);
    }

    return 0;
};

// Helper function to check if two time ranges overlap
const doTimesOverlap = (time1, time2, bufferMinutes = 60) => {
    const time1Minutes = timeToMinutes(time1);
    const time2Minutes = timeToMinutes(time2);

    // Two trips overlap if they are within bufferMinutes of each other
    return Math.abs(time1Minutes - time2Minutes) < bufferMinutes;
};

// Helper function to check if days overlap
const doDaysOverlap = (days1, days2) => {
    if (!days1 || !days2 || days1.length === 0 || days2.length === 0) return false;
    return days1.some(day => days2.includes(day));
};

// Helper function to check for driver scheduling conflicts
const checkDriverConflict = async (driverId, b2cPartnerId, proposedSchedule, excludeRouteId = null) => {
    if (!driverId) return { hasConflict: false };

    console.log("[v0] Checking driver conflict for:", { driverId, b2cPartnerId, proposedSchedule });

    // Get all existing schedules for this driver
    const existingSchedules = await B2CPartnerSchedule.find({
        b2cPartnerId: b2cPartnerId,
        assignedDriver: driverId,
        isActive: true,
        status: "Active"
    }).populate('routeId', 'fromLocation toLocation');

    console.log("[v0] Found existing schedules for driver:", existingSchedules.length);

    for (const existingSchedule of existingSchedules) {
        // Skip if this is the same route we're updating
        if (excludeRouteId && existingSchedule.routeId?._id?.toString() === excludeRouteId.toString()) {
            continue;
        }

        // Check if days overlap
        if (!doDaysOverlap(proposedSchedule.availableDays, existingSchedule.availableDays)) {
            continue; // No conflict if days don't overlap
        }

        // Check if any trip times overlap
        for (const proposedTrip of (proposedSchedule.tripTimes || [])) {
            for (const existingTrip of (existingSchedule.tripTimes || [])) {
                // Check outbound times
                if (doTimesOverlap(proposedTrip.departureTime, existingTrip.departureTime)) {
                    const conflictInfo = {
                        hasConflict: true,
                        conflictType: "DRIVER_TIME_CONFLICT",
                        existingRoute: existingSchedule.routeId ?
                            `${existingSchedule.routeId.fromLocation} to ${existingSchedule.routeId.toLocation}` :
                            "Unknown Route",
                        conflictingTime: existingTrip.departureTime,
                        proposedTime: proposedTrip.departureTime,
                        overlappingDays: proposedSchedule.availableDays.filter(d => existingSchedule.availableDays.includes(d))
                    };
                    console.log("[v0] Driver conflict detected:", conflictInfo);
                    return conflictInfo;
                }

                // Check return times for round trips
                if (proposedTrip.tripType === "Round Trip" && existingTrip.tripType === "Round Trip") {
                    if (doTimesOverlap(proposedTrip.arrivalTime, existingTrip.arrivalTime)) {
                        const conflictInfo = {
                            hasConflict: true,
                            conflictType: "DRIVER_RETURN_TIME_CONFLICT",
                            existingRoute: existingSchedule.routeId ?
                                `${existingSchedule.routeId.fromLocation} to ${existingSchedule.routeId.toLocation}` :
                                "Unknown Route",
                            conflictingTime: existingTrip.arrivalTime,
                            proposedTime: proposedTrip.arrivalTime,
                            overlappingDays: proposedSchedule.availableDays.filter(d => existingSchedule.availableDays.includes(d))
                        };
                        console.log("[v0] Driver return time conflict detected:", conflictInfo);
                        return conflictInfo;
                    }
                }
            }
        }
    }

    return { hasConflict: false };
};

// Helper function to check for vehicle scheduling conflicts
const checkVehicleConflict = async (vehicleId, b2cPartnerId, proposedSchedule, excludeRouteId = null) => {
    if (!vehicleId) return { hasConflict: false };

    console.log("[v0] Checking vehicle conflict for:", { vehicleId, b2cPartnerId, proposedSchedule });

    // Get all existing schedules for this vehicle
    const existingSchedules = await B2CPartnerSchedule.find({
        b2cPartnerId: b2cPartnerId,
        assignedVehicle: vehicleId,
        isActive: true,
        status: "Active"
    }).populate('routeId', 'fromLocation toLocation');

    console.log("[v0] Found existing schedules for vehicle:", existingSchedules.length);

    for (const existingSchedule of existingSchedules) {
        // Skip if this is the same route we're updating
        if (excludeRouteId && existingSchedule.routeId?._id?.toString() === excludeRouteId.toString()) {
            continue;
        }

        // Check if days overlap
        if (!doDaysOverlap(proposedSchedule.availableDays, existingSchedule.availableDays)) {
            continue; // No conflict if days don't overlap
        }

        // Check if any trip times overlap
        for (const proposedTrip of (proposedSchedule.tripTimes || [])) {
            for (const existingTrip of (existingSchedule.tripTimes || [])) {
                // Check outbound times
                if (doTimesOverlap(proposedTrip.departureTime, existingTrip.departureTime)) {
                    const conflictInfo = {
                        hasConflict: true,
                        conflictType: "VEHICLE_TIME_CONFLICT",
                        existingRoute: existingSchedule.routeId ?
                            `${existingSchedule.routeId.fromLocation} to ${existingSchedule.routeId.toLocation}` :
                            "Unknown Route",
                        conflictingTime: existingTrip.departureTime,
                        proposedTime: proposedTrip.departureTime,
                        overlappingDays: proposedSchedule.availableDays.filter(d => existingSchedule.availableDays.includes(d))
                    };
                    console.log("[v0] Vehicle conflict detected:", conflictInfo);
                    return conflictInfo;
                }
            }
        }
    }

    return { hasConflict: false };
};

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
            tags, // Tag IDs for route categorization
            isActive = true
        } = req.body;

        // Validate required fields
        if (!fromLocation || !toLocation) {
            return res.status(400).json({
                success: false,
                message: "From and To locations are required",
            });
        }

        // Fetch B2C Partner user to get their country
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        console.log("[v0] B2C Partner country:", user.country);

        // Get currency - use frontend-provided currency if available, otherwise auto-determine from user's country
        const currency = pricing?.currency || getCountryCurrency(user.country);
        const decimals = getCurrencyDecimals(currency);

        // Validate and format prices with proper decimals
        const oneWayPrice = pricing?.oneWayPrice ? parseFloat(pricing.oneWayPrice).toFixed(decimals) : "0.00";
        const roundTripPrice = pricing?.roundTripPrice ? parseFloat(pricing.roundTripPrice).toFixed(decimals) : "0.00";
        const monthlyOneWayPrice = pricing?.monthlyOneWayPrice ? parseFloat(pricing.monthlyOneWayPrice).toFixed(decimals) : "0.00";
        const monthlyRoundTripPrice = pricing?.monthlyRoundTripPrice ? parseFloat(pricing.monthlyRoundTripPrice).toFixed(decimals) : "0.00";

        console.log("[v0] Route pricing with currency:", { currency, oneWayPrice, roundTripPrice, monthlyOneWayPrice, monthlyRoundTripPrice });

        // Create route data with auto-populated currency
        const routeData = {
            b2cPartnerId: req.userId,
            fromLocation,
            toLocation,
            totalSeats: parseInt(totalSeats) || 20,
            availableSeats: parseInt(availableSeats) || parseInt(totalSeats) || 20,
            stops: stops || [],
            pricing: {
                oneWayPrice: parseFloat(oneWayPrice),
                roundTripPrice: parseFloat(roundTripPrice),
                monthlyOneWayPrice: parseFloat(monthlyOneWayPrice),
                monthlyRoundTripPrice: parseFloat(monthlyRoundTripPrice),
                currency: currency  // Auto-populated from user's country
            },
            assignedVehicle: assignedVehicle || null,
            assignedDriver: assignedDriver || null,
            routeStartDate: new Date(routeStartDate || Date.now()),
            description: description || "",
            tags: tags || [], // Tag IDs for categorization and search
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

        // Prepare proposed schedule for conflict checking
        const proposedSchedule = {
            tripTimes: tripTimes.map(time => ({
                departureTime: convertToAMPMFormat(time.departureTime),
                arrivalTime: time.arrivalTime ? convertToAMPMFormat(time.arrivalTime) : null,
                tripType: time.tripType || "One Way"
            })),
            availableDays: availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        };

        // Check for driver scheduling conflicts
        const effectiveDriverId = assignedDriver || route.assignedDriver;
        if (effectiveDriverId) {
            const driverConflict = await checkDriverConflict(
                effectiveDriverId,
                req.userId,
                proposedSchedule,
                routeId // Exclude this route from conflict check
            );

            if (driverConflict.hasConflict) {
                return res.status(400).json({
                    success: false,
                    message: `Driver scheduling conflict detected! The selected driver is already assigned to route "${driverConflict.existingRoute}" at ${driverConflict.conflictingTime} on ${driverConflict.overlappingDays.join(", ")}. Please choose a different time or driver.`,
                    conflictDetails: driverConflict
                });
            }
        }

        // Check for vehicle scheduling conflicts
        const effectiveVehicleId = assignedVehicle || route.assignedVehicle;
        if (effectiveVehicleId) {
            const vehicleConflict = await checkVehicleConflict(
                effectiveVehicleId,
                req.userId,
                proposedSchedule,
                routeId // Exclude this route from conflict check
            );

            if (vehicleConflict.hasConflict) {
                return res.status(400).json({
                    success: false,
                    message: `Vehicle scheduling conflict detected! The selected vehicle is already assigned to route "${vehicleConflict.existingRoute}" at ${vehicleConflict.conflictingTime} on ${vehicleConflict.overlappingDays.join(", ")}. Please choose a different time or vehicle.`,
                    conflictDetails: vehicleConflict
                });
            }
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

// Get B2C Routes filtered by commuter's country
export const getB2CPartnerRoutesByCountry = async (req, res) => {
    try {
        console.log("[v0] Fetching B2C Partner Routes for commuter:", req.userId);

        // Fetch commuter user to get their country
        const commuter = await User.findById(req.userId);
        if (!commuter) {
            return res.status(404).json({
                success: false,
                message: "Commuter not found",
            });
        }

        console.log("[v0] Commuter country:", commuter.country);

        // Find all B2C Partner users from the same country
        const partnersInCountry = await User.find({
            country: commuter.country,
            role: "B2C_PARTNER",
            status: "ACTIVE"
        }).select('_id');

        const partnerIds = partnersInCountry.map(p => p._id);
        console.log("[v0] Found B2C Partners in country:", partnerIds.length);

        // Fetch routes only from partners in the same country
        const routes = await B2CPartnerRoute.find({
            b2cPartnerId: { $in: partnerIds },
            isActive: true,
            status: "Active"
        })
            .populate('b2cPartnerId', 'fullName profileImage')
            .populate('assignedVehicle', 'model licensePlate vehicleType seatingCapacity')
            .populate('assignedDriver', 'fullName phoneNumber')
            .sort({ createdAt: -1 });

        console.log("[v0] Found B2C Partner Routes for commuter:", routes.length);

        res.status(200).json({
            success: true,
            count: routes.length,
            routes: routes,
            commuter_country: commuter.country
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C partner routes by country:", error);
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
        const { forceDelete } = req.query; // Allow force delete if user confirms

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

        // Check for dependencies before deletion
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check for active monthly passes on this route
        const activePasses = await B2CMonthlyPass.find({
            routeId: routeId,
            status: { $in: ["ACTIVE", "PENDING"] },
            endDate: { $gte: today }
        }).populate("passengerId", "fullName email whatsappNumber");

        // Check for upcoming trips with bookings
        const upcomingTripsWithBookings = await B2CPartnerTrip.find({
            routeId: routeId,
            tripDate: { $gte: today },
            bookedSeats: { $gt: 0 }
        });

        // Check for pending bookings
        const pendingBookings = await B2CPassengerBooking.find({
            routeId: routeId,
            bookingStatus: { $in: ["PENDING", "ACCEPTED", "CONFIRMED"] },
            $or: [
                { travelDate: { $gte: today } },
                { passEndDate: { $gte: today } }
            ]
        }).populate("passengerId", "fullName email whatsappNumber");

        // Count total affected items
        const totalSchedules = await B2CPartnerSchedule.countDocuments({ routeId: routeId });
        const totalTrips = await B2CPartnerTrip.countDocuments({ routeId: routeId });

        // If there are active dependencies and forceDelete is not set, return warning
        if (!forceDelete && (activePasses.length > 0 || upcomingTripsWithBookings.length > 0 || pendingBookings.length > 0)) {
            return res.status(400).json({
                success: false,
                message: "This route has active dependencies. Please review before deleting.",
                canDelete: false,
                dependencies: {
                    activePasses: {
                        count: activePasses.length,
                        details: activePasses.map(pass => ({
                            passId: pass._id,
                            passengerName: pass.passengerId?.fullName || 'Unknown',
                            passengerPhone: pass.passengerId?.whatsappNumber || 'N/A',
                            passType: pass.passType,
                            startDate: pass.startDate,
                            endDate: pass.endDate,
                            totalAmount: pass.totalAmount,
                            currency: pass.currency,
                            usedTrips: pass.usedTrips,
                            totalTrips: pass.totalTrips,
                            status: pass.status
                        }))
                    },
                    upcomingTripsWithBookings: {
                        count: upcomingTripsWithBookings.length,
                        details: upcomingTripsWithBookings.slice(0, 10).map(trip => ({
                            tripId: trip._id,
                            tripDate: trip.tripDate,
                            startTime: trip.startTime,
                            bookedSeats: trip.bookedSeats,
                            totalSeats: trip.totalSeats,
                            status: trip.status
                        }))
                    },
                    pendingBookings: {
                        count: pendingBookings.length,
                        details: pendingBookings.slice(0, 10).map(booking => ({
                            bookingId: booking._id,
                            passengerName: booking.passengerId?.fullName || 'Unknown',
                            passengerPhone: booking.passengerId?.whatsappNumber || 'N/A',
                            bookingType: booking.bookingType,
                            isMonthlyPass: booking.isMonthlyPass,
                            paymentAmount: booking.paymentAmount,
                            currency: booking.currency,
                            bookingStatus: booking.bookingStatus,
                            travelDate: booking.travelDate
                        }))
                    },
                    totalSchedules: totalSchedules,
                    totalTrips: totalTrips
                },
                warning: `Deleting this route will affect:
        - ${activePasses.length} active monthly pass subscription(s)
        - ${upcomingTripsWithBookings.length} upcoming trip(s) with bookings
        - ${pendingBookings.length} pending booking(s)
        - ${totalSchedules} schedule(s)
        - ${totalTrips} trip record(s)
        
        Active pass holders will lose their remaining trips and may need refunds.`
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

        // Also delete any trips directly linked to route (without schedule)
        await B2CPartnerTrip.deleteMany({ routeId: routeId });

        // Update monthly passes to mark them as CANCELLED if force deleting
        if (forceDelete === 'true' && activePasses.length > 0) {
            await B2CMonthlyPass.updateMany(
                { routeId: routeId, status: { $in: ["ACTIVE", "PENDING"] } },
                {
                    $set: {
                        status: "CANCELLED",
                        notes: `${new Date().toISOString()} - Route deleted by partner. Pass cancelled.`
                    }
                }
            );
        }

        // Update bookings to mark them as CANCELLED if force deleting
        if (forceDelete === 'true' && pendingBookings.length > 0) {
            await B2CPassengerBooking.updateMany(
                {
                    routeId: routeId,
                    bookingStatus: { $in: ["PENDING", "ACCEPTED", "CONFIRMED"] }
                },
                {
                    $set: {
                        bookingStatus: "CANCELLED",
                        autoCancelReason: "Route deleted by partner"
                    }
                }
            );
        }

        // Delete route
        await B2CPartnerRoute.findByIdAndDelete(routeId);

        res.status(200).json({
            success: true,
            message: "B2C Partner Route deleted successfully",
            deletedData: {
                schedulesDeleted: schedules.length,
                tripsDeleted: totalTrips,
                passesCancelled: forceDelete === 'true' ? activePasses.length : 0,
                bookingsCancelled: forceDelete === 'true' ? pendingBookings.length : 0
            }
        });
    } catch (error) {
        console.error("Error deleting B2C partner route:", error.message);
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

// Check route dependencies before deletion (GET endpoint for pre-check)
export const checkRouteDependencies = async (req, res) => {
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check for active monthly passes
        const activePasses = await B2CMonthlyPass.find({
            routeId: routeId,
            status: { $in: ["ACTIVE", "PENDING"] },
            endDate: { $gte: today }
        }).populate("passengerId", "fullName email whatsappNumber");

        // Check for upcoming trips with bookings
        const upcomingTripsWithBookings = await B2CPartnerTrip.find({
            routeId: routeId,
            tripDate: { $gte: today },
            bookedSeats: { $gt: 0 }
        });

        // Check for pending bookings
        const pendingBookings = await B2CPassengerBooking.find({
            routeId: routeId,
            bookingStatus: { $in: ["PENDING", "ACCEPTED", "CONFIRMED"] },
            $or: [
                { travelDate: { $gte: today } },
                { passEndDate: { $gte: today } }
            ]
        }).populate("passengerId", "fullName email whatsappNumber");

        // Count schedules and trips
        const totalSchedules = await B2CPartnerSchedule.countDocuments({ routeId: routeId });
        const totalTrips = await B2CPartnerTrip.countDocuments({ routeId: routeId });

        const hasCriticalDependencies = activePasses.length > 0 || upcomingTripsWithBookings.length > 0 || pendingBookings.length > 0;

        res.status(200).json({
            success: true,
            routeId: routeId,
            routeName: `${route.fromLocation} to ${route.toLocation}`,
            hasCriticalDependencies: hasCriticalDependencies,
            canSafelyDelete: !hasCriticalDependencies,
            dependencies: {
                activePasses: {
                    count: activePasses.length,
                    totalValue: activePasses.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
                    currency: activePasses[0]?.currency || route.pricing?.currency || "AED",
                    details: activePasses.map(pass => ({
                        passId: pass._id,
                        passengerName: pass.passengerId?.fullName || 'Unknown',
                        passengerPhone: pass.passengerId?.whatsappNumber || 'N/A',
                        passengerEmail: pass.passengerId?.email || 'N/A',
                        passType: pass.passType,
                        startDate: pass.startDate,
                        endDate: pass.endDate,
                        totalAmount: pass.totalAmount,
                        currency: pass.currency,
                        usedTrips: pass.usedTrips,
                        totalTrips: pass.totalTrips,
                        remainingTrips: (pass.totalTrips || 0) - (pass.usedTrips || 0),
                        status: pass.status
                    }))
                },
                upcomingTripsWithBookings: {
                    count: upcomingTripsWithBookings.length,
                    totalBookedSeats: upcomingTripsWithBookings.reduce((sum, t) => sum + (t.bookedSeats || 0), 0),
                    details: upcomingTripsWithBookings.slice(0, 10).map(trip => ({
                        tripId: trip._id,
                        tripDate: trip.tripDate,
                        startTime: trip.startTime,
                        bookedSeats: trip.bookedSeats,
                        totalSeats: trip.totalSeats,
                        status: trip.status
                    }))
                },
                pendingBookings: {
                    count: pendingBookings.length,
                    totalValue: pendingBookings.reduce((sum, b) => sum + (b.paymentAmount || 0), 0),
                    details: pendingBookings.slice(0, 10).map(booking => ({
                        bookingId: booking._id,
                        passengerName: booking.passengerId?.fullName || 'Unknown',
                        passengerPhone: booking.passengerId?.whatsappNumber || 'N/A',
                        bookingType: booking.bookingType,
                        isMonthlyPass: booking.isMonthlyPass,
                        paymentAmount: booking.paymentAmount,
                        currency: booking.currency,
                        bookingStatus: booking.bookingStatus,
                        travelDate: booking.travelDate
                    }))
                },
                totalSchedules: totalSchedules,
                totalTrips: totalTrips
            }
        });
    } catch (error) {
        console.error("Error checking route dependencies:", error.message);
        res.status(500).json({
            success: false,
            message: "Error checking route dependencies",
            error: error.message,
        });
    }
};

// Check for scheduling conflicts before creating a route/schedule
export const checkSchedulingConflicts = async (req, res) => {
    try {
        console.log("[v0] Checking scheduling conflicts:", JSON.stringify(req.body, null, 2));

        const {
            driverId,
            vehicleId,
            tripTimes, // Array of { departureTime, arrivalTime, tripType }
            availableDays,
            excludeRouteId // Optional: exclude this route from conflict check (for updates)
        } = req.body;

        const conflicts = [];

        // Prepare proposed schedule for conflict checking
        const proposedSchedule = {
            tripTimes: (tripTimes || []).map(time => ({
                departureTime: convertToAMPMFormat(time.departureTime),
                arrivalTime: time.arrivalTime ? convertToAMPMFormat(time.arrivalTime) : null,
                tripType: time.tripType || "One Way"
            })),
            availableDays: availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        };

        // Check for driver conflicts
        if (driverId) {
            const driverConflict = await checkDriverConflict(
                driverId,
                req.userId,
                proposedSchedule,
                excludeRouteId
            );

            if (driverConflict.hasConflict) {
                conflicts.push({
                    type: "DRIVER",
                    ...driverConflict
                });
            }
        }

        // Check for vehicle conflicts
        if (vehicleId) {
            const vehicleConflict = await checkVehicleConflict(
                vehicleId,
                req.userId,
                proposedSchedule,
                excludeRouteId
            );

            if (vehicleConflict.hasConflict) {
                conflicts.push({
                    type: "VEHICLE",
                    ...vehicleConflict
                });
            }
        }

        if (conflicts.length > 0) {
            return res.status(200).json({
                success: true,
                hasConflicts: true,
                conflicts: conflicts,
                message: `Found ${conflicts.length} scheduling conflict(s). Please review and resolve before creating the route.`
            });
        }

        res.status(200).json({
            success: true,
            hasConflicts: false,
            conflicts: [],
            message: "No scheduling conflicts detected."
        });
    } catch (error) {
        console.error("[v0] Error checking scheduling conflicts:", error.message);
        res.status(500).json({
            success: false,
            message: "Error checking scheduling conflicts",
            error: error.message,
        });
    }
};