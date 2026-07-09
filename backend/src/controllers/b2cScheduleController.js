import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import RouteRequest from "../models/RouteRequest.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import { generateTripsForSchedule } from "../Services/tripGenerationService.js";
import { getCountryCurrency, getCurrencyDecimals, validateCountryPrice } from "../Services/countryLocalizationService.js";
import { broadcastVehicleAvailabilityChange, broadcastDriverAvailabilityChange, broadcastSelfDriverAvailabilityChange, sendRealTimeNotification } from "../Services/socketService.js";
import { createNotification } from "../Services/notificationService.js";
import { sendEmail } from "../Services/emailService.js";

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
// When a B2C partner publishes a route for a corridor, close out the matching
// passenger demand (RouteRequest): upgrade the partner's interest to
// ROUTE_PUBLISHED, record the published route under fulfilledByRoutes, mark the
// demand FULFILLED, and notify the waiting commuters that the route is now live.
const fulfillMatchingRouteRequests = async (route, partnerId) => {
    const escapeRegex = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const from = (route.fromLocation || "").trim();
    const to = (route.toLocation || "").trim();
    if (!from || !to) return;

    // Match the same corridor (case-insensitive, exact string) in either direction
    // for demand that is still open (not already rejected/completed/fulfilled).
    const matchingRequests = await RouteRequest.find({
        status: { $nin: ["REJECTED", "COMPLETED", "FULFILLED"] },
        $or: [
            {
                pickupLocation: { $regex: `^${escapeRegex(from)}$`, $options: "i" },
                dropoffLocation: { $regex: `^${escapeRegex(to)}$`, $options: "i" },
            },
            {
                pickupLocation: { $regex: `^${escapeRegex(to)}$`, $options: "i" },
                dropoffLocation: { $regex: `^${escapeRegex(from)}$`, $options: "i" },
            },
        ],
    });

    if (!matchingRequests.length) {
        console.log("[v0] No open demand matched route corridor:", from, "->", to);
        return;
    }

    for (const request of matchingRequests) {
        // Upgrade this partner's interest entry to ROUTE_PUBLISHED (or add one).
        const existing = (request.interestedPartners || []).find(
            (p) => String(p.partnerId) === String(partnerId)
        );
        if (existing) {
            existing.status = "ROUTE_PUBLISHED";
            existing.publishedRouteId = route._id;
            existing.respondedAt = new Date();
        } else {
            request.interestedPartners.push({
                partnerId,
                status: "ROUTE_PUBLISHED",
                publishedRouteId: route._id,
                respondedAt: new Date(),
            });
        }

        // Record the published route on the demand (avoid duplicates).
        const alreadyRecorded = (request.fulfilledByRoutes || []).some(
            (f) => String(f.routeId) === String(route._id)
        );
        if (!alreadyRecorded) {
            request.fulfilledByRoutes.push({
                routeId: route._id,
                partnerId,
                publishedAt: new Date(),
            });
        }

        // Demand is now served; commuters can book it directly.
        request.status = "FULFILLED";
        request.convertedRouteId = request.convertedRouteId || route._id;
        await request.save();

        // Notify the commuter that a bookable route now exists.
        try {
            await createNotification({
                userId: request.passengerId,
                type: "ROUTE_REQUEST_RESPONSE",
                title: "Your Requested Route is Now Available!",
                message: `A route from ${request.pickupLocation} to ${request.dropoffLocation} is now available to book.`,
                data: {
                    requestId: request._id,
                    routeId: route._id,
                    pickupLocation: request.pickupLocation,
                    dropoffLocation: request.dropoffLocation,
                    status: "FULFILLED",
                },
            });
        } catch (notifyError) {
            console.error("[v0] Error notifying commuter of fulfilled demand:", notifyError.message);
        }
    }

    console.log(`[v0] Marked ${matchingRequests.length} route request(s) as FULFILLED by route ${route._id}`);
};

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

        // Block allocation of a Maintenance / Inactive vehicle at route creation.
        if (assignedVehicle) {
            const routeVehicleGuard = await assertVehiclesAllocatable(assignedVehicle, req.userId);
            if (!routeVehicleGuard.ok) {
                return res.status(400).json({ success: false, message: routeVehicleGuard.message });
            }
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

        // Once a partner publishes a route for a corridor, mark any matching open
        // demand as FULFILLED so partners can no longer express/withdraw interest,
        // and record which partner/route now serves those riders.
        try {
            await fulfillMatchingRouteRequests(route, req.userId);
        } catch (linkError) {
            console.error("[v0] Error linking route to demand:", linkError.message);
        }

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

// Create Schedule for Route (or ADD trip times to existing schedule)
export const createB2CPartnerSchedule = async (req, res) => {
    try {
        console.log("[v0] Creating/Updating B2C Partner Schedule with data:", JSON.stringify(req.body, null, 2));

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

        // Format the new trip times - include per-trip driver/vehicle assignments
        const formattedTripTimes = tripTimes.map(time => ({
            departureTime: convertToAMPMFormat(time.departureTime),
            arrivalTime: time.arrivalTime ? convertToAMPMFormat(time.arrivalTime) : null,
            // Time the bus reaches the destination of the forward/outbound journey
            destinationArrivalTime: time.destinationArrivalTime ? convertToAMPMFormat(time.destinationArrivalTime) : null,
            // Round Trip only: time the bus reaches back the origin after the return leg
            returnArrivalTime: time.returnArrivalTime ? convertToAMPMFormat(time.returnArrivalTime) : null,
            tripType: time.tripType || "One Way",
            // Direction for One Way trips ("outbound" From->To or "return" To->From). Defaults to outbound.
            direction: time.direction === "return" ? "return" : "outbound",
            // Per-trip driver/vehicle assignment (optional - falls back to schedule/route default)
            // For Round Trip this is the OUTBOUND (From->To / "jaane") leg assignment.
            assignedDriver: time.assignedDriver || null,
            assignedVehicle: time.assignedVehicle || null,

            // Round Trip only: dedicated RETURN (To->From / "aane") leg assignment (optional, falls back to outbound).
            returnDriver: time.returnDriver || null,
            returnVehicle: time.returnVehicle || null,
            outboundIsSelfDriver: time.outboundIsSelfDriver === true,
            returnIsSelfDriver: time.returnIsSelfDriver === true,

            outboundStopPoints: time.outboundStopPoints ? time.outboundStopPoints.map(stop => ({
                location: stop.location,
                time: convertToAMPMFormat(stop.time)
            })) : [],
            returnStopPoints: time.returnStopPoints ? time.returnStopPoints.map(stop => ({
                location: stop.location,
                time: convertToAMPMFormat(stop.time)
            })) : []
        }));

        // Prepare proposed schedule for conflict checking
        const proposedSchedule = {
            tripTimes: formattedTripTimes,
            availableDays: availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        };

        // Block allocation of vehicles that are Under Maintenance / Inactive.
        // Gather the schedule-default vehicle, the route's default vehicle and
        // every per-trip (outbound + return) vehicle reference.
        const vehicleIdsToValidate = [
            assignedVehicle,
            route.assignedVehicle,
            ...formattedTripTimes.flatMap((t) => [t.assignedVehicle, t.returnVehicle]),
        ];
        const vehicleAllocGuard = await assertVehiclesAllocatable(vehicleIdsToValidate, req.userId);
        if (!vehicleAllocGuard.ok) {
            return res.status(400).json({ success: false, message: vehicleAllocGuard.message });
        }

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

        // Check if schedule already exists for this route - UPDATE instead of CREATE
        const existingSchedule = await B2CPartnerSchedule.findOne({
            routeId: routeId,
            b2cPartnerId: req.userId,
            isActive: true,
            status: "Active"
        });

        let schedule;
        let isUpdate = false;

        if (existingSchedule) {
            // UPDATE existing schedule - append new trip times to existing tripTimes array
            console.log("[v0] Found existing schedule for route:", existingSchedule._id, "- Appending new trip times");

            // Merge new trip times with existing ones (avoid duplicates based on departureTime + direction).
            // Direction is included so an outbound and a reverse-direction trip can share a departure time.
            const tripKey = (t) => `${t.departureTime}__${t.direction || "outbound"}`;
            const existingTripKeys = existingSchedule.tripTimes.map(tripKey);
            const uniqueNewTripTimes = formattedTripTimes.filter(newTrip =>
                !existingTripKeys.includes(tripKey(newTrip))
            );

            if (uniqueNewTripTimes.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "All provided trip times already exist in the schedule. Please add different departure times.",
                });
            }

            // Append new trip times to existing schedule
            const updatedTripTimes = [...existingSchedule.tripTimes, ...uniqueNewTripTimes];

            // Merge available days (union of both)
            const effectiveAvailableDays = availableDays || existingSchedule.availableDays;
            const mergedAvailableDays = [...new Set([...existingSchedule.availableDays, ...effectiveAvailableDays])];

            // Update the existing schedule
            schedule = await B2CPartnerSchedule.findByIdAndUpdate(
                existingSchedule._id,
                {
                    $set: {
                        tripTimes: updatedTripTimes,
                        availableDays: mergedAvailableDays,
                        assignedVehicle: assignedVehicle || existingSchedule.assignedVehicle,
                        assignedDriver: assignedDriver || existingSchedule.assignedDriver,
                        updatedAt: new Date()
                    }
                },
                { new: true }
            );

            isUpdate = true;
            console.log("[v0] Schedule updated successfully. Total trip times now:", schedule.tripTimes.length);
        } else {
            // CREATE new schedule (first schedule for this route)
            console.log("[v0] No existing schedule found - Creating new schedule for route:", routeId);

            const scheduleData = {
                b2cPartnerId: req.userId,
                routeId: routeId,
                scheduleName: scheduleName || `${route.fromLocation} to ${route.toLocation} Schedule`,
                tripTimes: formattedTripTimes,
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

            schedule = await B2CPartnerSchedule.create(scheduleData);
            console.log("[v0] B2C Partner Schedule created successfully:", schedule._id);
        }

        // Assign vehicle to driver if both are provided
        const finalVehicle = assignedVehicle || schedule.assignedVehicle;
        const finalDriver = assignedDriver || schedule.assignedDriver;

        if (finalVehicle && finalDriver) {
            console.log("[v0] Assigning vehicle to driver:", finalVehicle, finalDriver);
            try {
                await B2CPartnerDriver.findByIdAndUpdate(
                    finalDriver,
                    {
                        $addToSet: { assignedVehicles: finalVehicle },
                        $set: { updatedAt: new Date() }
                    }
                );
                console.log("[v0] Vehicle assigned to driver successfully");

                // Also assign driver to vehicle
                await B2CPartnerVehicle.findByIdAndUpdate(
                    finalVehicle,
                    {
                        $addToSet: { assignedDrivers: finalDriver },
                        $set: { updatedAt: new Date() }
                    }
                );
                console.log("[v0] Driver assigned to vehicle successfully");
            } catch (assignmentError) {
                console.error("[v0] Error assigning vehicle to driver:", assignmentError);
                // Don't fail schedule creation if assignment fails
            }
        }

        // Update driver availability - track which schedules/trips they're assigned to
        // This helps B2C Partners see which drivers are available for new assignments
        try {
            // Track all drivers assigned to this schedule (both schedule-level and per-trip)
            const driversToUpdate = new Set();

            // Add schedule-level driver
            if (finalDriver) {
                driversToUpdate.add(finalDriver.toString());
            }

            // Add per-trip drivers
            for (let i = 0; i < formattedTripTimes.length; i++) {
                const tripTime = formattedTripTimes[i];
                if (tripTime.assignedDriver) {
                    driversToUpdate.add(tripTime.assignedDriver.toString());
                }
            }

            // Update each driver's assignedSchedules and set status to busy
            for (const driverId of driversToUpdate) {
                // Check if this is the B2C Partner (self-driver)
                if (driverId === req.userId.toString()) {
                    // Update User model for self-driver
                    const tripIndices = formattedTripTimes
                        .map((tt, idx) => tt.assignedDriver === driverId ? idx : -1)
                        .filter(idx => idx >= 0);

                    await User.findByIdAndUpdate(
                        req.userId,
                        {
                            $addToSet: {
                                'selfDriverAvailability.assignedSchedules': {
                                    scheduleId: schedule._id,
                                    tripTimeIndex: tripIndices.length > 0 ? tripIndices[0] : null,
                                    assignedAt: new Date()
                                }
                            },
                            $set: {
                                'selfDriverAvailability.lastUpdate': new Date(),
                                'selfDriverAvailability.status': 'busy' // Set status to busy when assigned
                            }
                        }
                    );
                    console.log("[v0] Updated self-driver availability to BUSY for partner:", req.userId);
                } else {
                    // Update B2CPartnerDriver model
                    const tripIndices = formattedTripTimes
                        .map((tt, idx) => tt.assignedDriver === driverId ? idx : -1)
                        .filter(idx => idx >= 0);

                    await B2CPartnerDriver.findByIdAndUpdate(
                        driverId,
                        {
                            $addToSet: {
                                assignedSchedules: {
                                    scheduleId: schedule._id,
                                    tripTimeIndex: tripIndices.length > 0 ? tripIndices[0] : null,
                                    assignedAt: new Date()
                                }
                            },
                            $set: {
                                lastAvailabilityUpdate: new Date(),
                                availabilityStatus: 'busy' // Set status to busy when assigned
                            }
                        }
                    );
                    console.log("[v0] Updated driver availability to BUSY for:", driverId);
                }
            }
        } catch (availabilityError) {
            console.error("[v0] Error updating driver availability:", availabilityError);
            // Don't fail schedule creation if availability update fails
        }

        // Update vehicle availability - mark as busy when assigned to schedule
        try {
            const vehiclesToUpdate = new Set();

            // Add schedule-level vehicle
            if (finalVehicle) {
                vehiclesToUpdate.add(finalVehicle.toString());
            }

            // Add per-trip vehicles
            for (let i = 0; i < formattedTripTimes.length; i++) {
                const tripTime = formattedTripTimes[i];
                if (tripTime.assignedVehicle) {
                    vehiclesToUpdate.add(tripTime.assignedVehicle.toString());
                }
            }

            // Update each vehicle's assignedSchedules and set status to busy
            for (const vehicleId of vehiclesToUpdate) {
                const tripIndices = formattedTripTimes
                    .map((tt, idx) => tt.assignedVehicle === vehicleId ? idx : -1)
                    .filter(idx => idx >= 0);

                const updatedVehicle = await B2CPartnerVehicle.findByIdAndUpdate(
                    vehicleId,
                    {
                        $addToSet: {
                            assignedSchedules: {
                                scheduleId: schedule._id,
                                tripTimeIndex: tripIndices.length > 0 ? tripIndices[0] : null,
                                assignedAt: new Date()
                            }
                        },
                        $set: {
                            lastAvailabilityUpdate: new Date(),
                            availabilityStatus: 'busy' // Set vehicle status to busy when assigned
                        }
                    },
                    { new: true }
                );

                if (updatedVehicle) {
                    console.log("[v0] Updated vehicle availability to BUSY for:", vehicleId);

                    // Broadcast vehicle availability change via socket
                    broadcastVehicleAvailabilityChange(req.userId.toString(), {
                        vehicleId: updatedVehicle._id.toString(),
                        vehicleModel: updatedVehicle.model,
                        licensePlate: updatedVehicle.licensePlate,
                        availabilityStatus: 'busy',
                        status: updatedVehicle.status
                    });
                }
            }
        } catch (vehicleAvailabilityError) {
            console.error("[v0] Error updating vehicle availability:", vehicleAvailabilityError);
            // Don't fail schedule creation if vehicle availability update fails
        }

        // PROPAGATE DRIVER ASSIGNMENT: Sync route's assignedDriverId and update existing bookings
        if (finalDriver) {
            console.log(`[v0] Propagating driver ${finalDriver} to route and existing bookings for schedule ${schedule._id}`);

            // Update route's assignedDriverId to match schedule's driver
            await B2CPartnerRoute.findByIdAndUpdate(
                routeId,
                { $set: { assignedDriverId: finalDriver } }
            );
            console.log(`[v0] Updated route ${routeId} with driver ${finalDriver}`);

            // Get driver details for booking updates
            let driverName = null;
            let driverImage = null;
            let driverPhone = null;
            let isSelfDriver = false;

            // Check if driver is the partner (self-driver)
            if (finalDriver.toString() === req.userId.toString()) {
                isSelfDriver = true;
                const partner = await User.findById(req.userId);
                if (partner) {
                    driverName = partner.fullName || partner.name || 'Self';
                    driverImage = partner.profileImage;
                    driverPhone = partner.whatsappNumber || partner.phone;
                }
            } else {
                // Get driver details from B2CPartnerDriver
                const driver = await B2CPartnerDriver.findById(finalDriver);
                if (driver) {
                    driverName = driver.name;
                    driverImage = driver.driverImage?.url;
                    driverPhone = driver.phoneNumber;
                    isSelfDriver = false;
                }
            }

            // Update all active/pending bookings linked to this schedule
            if (driverName) {
                const bookingUpdateResult = await B2CPassengerBooking.updateMany(
                    {
                        linkedSchedule: schedule._id,
                        bookingStatus: { $in: ['PENDING', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'] }
                    },
                    {
                        $set: {
                            assignedDriverId: finalDriver,
                            driverName: driverName,
                            driverImage: driverImage,
                            driverPhoneNumber: driverPhone,
                            isSelfDriver: isSelfDriver
                        }
                    }
                );
                console.log(`[v0] Updated ${bookingUpdateResult.modifiedCount} existing bookings with new driver`);
            }

            // Update future trips for this schedule
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tripUpdateResult = await B2CPartnerTrip.updateMany(
                { scheduleId: schedule._id, tripDate: { $gte: today } },
                {
                    $set: {
                        driverId: finalDriver,
                        'driverInfo.name': driverName,
                        'driverInfo.phoneNumber': driverPhone
                    }
                }
            );
            console.log(`[v0] Updated ${tripUpdateResult.modifiedCount} future trips with new driver`);
        }

        // NOTE: DO NOT generate trips automatically when B2C_PARTNER creates schedule
        // Trips should only be generated when COMMUTER makes booking
        // This prevents creating empty trips that no one has booked
        console.log("[v0] Schedule", isUpdate ? "updated" : "created", "- trips will be generated on passenger booking");

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: isUpdate
                ? "New trip times added to existing schedule successfully"
                : "B2C Partner Schedule created successfully",
            schedule,
            isUpdate: isUpdate
        });
    } catch (error) {
        console.error("[v0] Error creating/updating B2C partner schedule:", error.message);
        res.status(500).json({
            success: false,
            message: "Error creating/updating B2C partner schedule",
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

        // Support filtering by routeId
        const { routeId } = req.query;

        // Build query - always filter by partner, optionally by route
        const query = {
            b2cPartnerId: req.userId,
        };

        if (routeId) {
            query.routeId = routeId;
            console.log("[v0] Filtering schedules by routeId:", routeId);
        }

        const schedules = await B2CPartnerSchedule.find(query)
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

            // Process per-trip driver/vehicle assignments
            const processedTripTimes = await Promise.all((scheduleObj.tripTimes || []).map(async (tripTime, index) => {
                let tripDriverInfo = null;
                let tripVehicleInfo = null;

                // Get per-trip driver info
                if (tripTime.assignedDriver) {
                    // Try B2CPartnerDriver first
                    const tripDriver = await B2CPartnerDriver.findById(tripTime.assignedDriver)
                        .select('name phoneNumber driverImage');

                    if (tripDriver) {
                        tripDriverInfo = {
                            _id: tripDriver._id,
                            name: tripDriver.name,
                            phoneNumber: tripDriver.phoneNumber,
                            image: tripDriver.driverImage?.url
                        };
                    } else if (tripTime.assignedDriver.toString() === req.userId.toString()) {
                        // Self-driver for this trip
                        tripDriverInfo = {
                            _id: partnerUser._id,
                            name: partnerUser.fullName || "Self",
                            phoneNumber: partnerUser.whatsappNumber,
                            image: partnerUser.profileImage,
                            isSelfDriver: true
                        };
                    }
                }

                // Get per-trip vehicle info
                if (tripTime.assignedVehicle) {
                    const tripVehicle = await B2CPartnerVehicle.findById(tripTime.assignedVehicle)
                        .select('model licensePlate seatingCapacity vehicleType vehicleImage');

                    if (tripVehicle) {
                        tripVehicleInfo = {
                            _id: tripVehicle._id,
                            model: tripVehicle.model,
                            licensePlate: tripVehicle.licensePlate,
                            seatingCapacity: tripVehicle.seatingCapacity,
                            vehicleType: tripVehicle.vehicleType,
                            image: tripVehicle.vehicleImage?.url
                        };
                    }
                }

                // Round Trip only: resolve the dedicated RETURN (To->From / "aane") leg driver/vehicle.
                let returnDriverInfo = null;
                let returnVehicleInfo = null;

                if (tripTime.returnDriver) {
                    const rtDriver = await B2CPartnerDriver.findById(tripTime.returnDriver)
                        .select('name phoneNumber driverImage');
                    if (rtDriver) {
                        returnDriverInfo = {
                            _id: rtDriver._id,
                            name: rtDriver.name,
                            phoneNumber: rtDriver.phoneNumber,
                            image: rtDriver.driverImage?.url
                        };
                    } else if (tripTime.returnDriver.toString() === req.userId.toString()) {
                        returnDriverInfo = {
                            _id: partnerUser._id,
                            name: partnerUser.fullName || "Self",
                            phoneNumber: partnerUser.whatsappNumber,
                            image: partnerUser.profileImage,
                            isSelfDriver: true
                        };
                    }
                }

                if (tripTime.returnVehicle) {
                    const rtVehicle = await B2CPartnerVehicle.findById(tripTime.returnVehicle)
                        .select('model licensePlate seatingCapacity vehicleType vehicleImage');
                    if (rtVehicle) {
                        returnVehicleInfo = {
                            _id: rtVehicle._id,
                            model: rtVehicle.model,
                            licensePlate: rtVehicle.licensePlate,
                            seatingCapacity: rtVehicle.seatingCapacity,
                            vehicleType: rtVehicle.vehicleType,
                            image: rtVehicle.vehicleImage?.url
                        };
                    }
                }

                const isRoundTrip = (tripTime.tripType === "Round Trip");

                return {
                    ...tripTime,
                    // Per-trip OUTBOUND driver/vehicle info (populated)
                    effectiveDriver: tripDriverInfo || driverInfo, // Fall back to schedule-level driver
                    effectiveVehicle: tripVehicleInfo || scheduleObj.assignedVehicle, // Fall back to schedule-level vehicle
                    tripDriverInfo: tripDriverInfo,
                    tripVehicleInfo: tripVehicleInfo,
                    // Round Trip RETURN leg info (falls back to outbound when not set)
                    returnDriverInfo: returnDriverInfo,
                    returnVehicleInfo: returnVehicleInfo,
                    effectiveReturnDriver: isRoundTrip ? (returnDriverInfo || tripDriverInfo || driverInfo) : null,
                    effectiveReturnVehicle: isRoundTrip ? (returnVehicleInfo || tripVehicleInfo || scheduleObj.assignedVehicle) : null
                };
            }));

            return {
                ...scheduleObj,
                tripTimes: processedTripTimes,
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
                destinationArrivalTime: time.destinationArrivalTime ? convertToAMPMFormat(time.destinationArrivalTime) : null,
                returnArrivalTime: time.returnArrivalTime ? convertToAMPMFormat(time.returnArrivalTime) : null,
                tripType: time.tripType || "One Way",
                direction: time.direction === "return" ? "return" : "outbound",
                assignedDriver: time.assignedDriver || null,
                assignedVehicle: time.assignedVehicle || null,
                returnDriver: time.returnDriver || null,
                returnVehicle: time.returnVehicle || null,
                outboundIsSelfDriver: time.outboundIsSelfDriver === true,
                returnIsSelfDriver: time.returnIsSelfDriver === true,
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

        // PROPAGATE DRIVER ASSIGNMENT to trips and bookings if driver changed
        const newDriverId = updateData.assignedDriver;
        if (newDriverId) {
            console.log(`[v0] Propagating driver assignment from schedule ${scheduleId} to trips and bookings`);

            // Get driver details for booking updates
            let driverName = null;
            let driverImage = null;
            let driverPhone = null;
            let isSelfDriver = false;

            // Check if driver is the partner (self-driver)
            if (newDriverId.toString() === req.userId.toString()) {
                isSelfDriver = true;
                const partner = await User.findById(req.userId);
                if (partner) {
                    driverName = partner.fullName || partner.name || 'Self';
                    driverImage = partner.profileImage;
                    driverPhone = partner.whatsappNumber || partner.phone;
                }
            } else {
                // Get driver details from B2CPartnerDriver
                const driver = await B2CPartnerDriver.findById(newDriverId);
                if (driver) {
                    driverName = driver.name;
                    driverImage = driver.driverImage?.url;
                    driverPhone = driver.phoneNumber;
                    isSelfDriver = false;
                }
            }

            // Update all future trips for this schedule
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tripUpdateResult = await B2CPartnerTrip.updateMany(
                { scheduleId: scheduleId, tripDate: { $gte: today } },
                {
                    $set: {
                        driverId: newDriverId,
                        'driverInfo.name': driverName,
                        'driverInfo.phoneNumber': driverPhone
                    }
                }
            );
            console.log(`[v0] Updated ${tripUpdateResult.modifiedCount} future trips with new driver`);

            // Update all active/pending bookings for this schedule
            if (driverName) {
                const bookingUpdateResult = await B2CPassengerBooking.updateMany(
                    {
                        linkedSchedule: scheduleId,
                        bookingStatus: { $in: ['PENDING', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'] }
                    },
                    {
                        $set: {
                            assignedDriverId: newDriverId,
                            driverName: driverName,
                            driverImage: driverImage,
                            driverPhoneNumber: driverPhone,
                            isSelfDriver: isSelfDriver
                        }
                    }
                );
                console.log(`[v0] Updated ${bookingUpdateResult.modifiedCount} active bookings with new driver`);
            }

            // Also update the route with the new driver
            await B2CPartnerRoute.findByIdAndUpdate(
                schedule.routeId,
                { $set: { assignedDriverId: newDriverId } }
            );
            console.log(`[v0] Updated route ${schedule.routeId} with new driver`);

            // Update driver's availability status to "busy"
            if (isSelfDriver) {
                await User.findByIdAndUpdate(
                    req.userId,
                    {
                        $set: {
                            'selfDriverAvailability.status': 'busy',
                            'selfDriverAvailability.lastUpdate': new Date()
                        }
                    }
                );
                console.log(`[v0] Updated self-driver status to BUSY for partner: ${req.userId}`);
            } else {
                await B2CPartnerDriver.findByIdAndUpdate(
                    newDriverId,
                    {
                        $set: {
                            availabilityStatus: 'busy',
                            lastAvailabilityUpdate: new Date()
                        }
                    }
                );
                console.log(`[v0] Updated driver status to BUSY for: ${newDriverId}`);
            }
        }

        // Also update per-trip driver/vehicle assignments status to busy.
        // IMPORTANT: for Round Trips the OUTBOUND (assignedDriver/assignedVehicle)
        // and the RETURN (returnDriver/returnVehicle) legs can use DIFFERENT
        // drivers/vehicles, so every distinct asset used by any leg must be
        // marked busy — otherwise a return-leg driver/vehicle would wrongly stay
        // "available" after being assigned.
        if (updateData.tripTimes && updateData.tripTimes.length > 0) {
            const driversToMarkBusy = new Set();
            const vehiclesToMarkBusy = new Set();

            for (const trip of updateData.tripTimes) {
                if (trip.assignedDriver) {
                    driversToMarkBusy.add(trip.assignedDriver.toString());
                }
                if (trip.returnDriver) {
                    driversToMarkBusy.add(trip.returnDriver.toString());
                }
                if (trip.assignedVehicle) {
                    vehiclesToMarkBusy.add(trip.assignedVehicle.toString());
                }
                if (trip.returnVehicle) {
                    vehiclesToMarkBusy.add(trip.returnVehicle.toString());
                }
            }

            for (const driverId of driversToMarkBusy) {
                if (driverId === req.userId.toString()) {
                    await User.findByIdAndUpdate(
                        req.userId,
                        {
                            $set: {
                                'selfDriverAvailability.status': 'busy',
                                'selfDriverAvailability.lastUpdate': new Date()
                            }
                        }
                    );
                    console.log(`[v0] Updated self-driver status to BUSY for partner (trip level): ${req.userId}`);
                } else {
                    await B2CPartnerDriver.findByIdAndUpdate(
                        driverId,
                        {
                            $set: {
                                availabilityStatus: 'busy',
                                lastAvailabilityUpdate: new Date()
                            }
                        }
                    );
                    console.log(`[v0] Updated driver status to BUSY (trip level) for: ${driverId}`);
                }
            }

            for (const vehicleId of vehiclesToMarkBusy) {
                await B2CPartnerVehicle.findByIdAndUpdate(
                    vehicleId,
                    {
                        $set: {
                            availabilityStatus: 'busy',
                            lastAvailabilityUpdate: new Date()
                        }
                    }
                );
                console.log(`[v0] Updated vehicle status to BUSY (trip level) for: ${vehicleId}`);
            }
        }

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

// Round currency value to 2 decimals to avoid floating point drift in wallets
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Refund a commuter for the UNUSED portion of their monthly pass when a B2C
 * Partner DELETES the route. This is NOT a normal cancellation:
 *   - It is the partner's fault, so NO cancellation fee is charged.
 *   - The commuter is refunded ONLY for unused trips (pro-rata of remaining trips).
 *   - The partner keeps earnings ONLY for the trips the commuter actually used;
 *     the unused-trip earnings are clawed back (DEBIT) from the partner wallet.
 *   - The admin keeps commission ONLY for the trips the commuter actually used;
 *     the unused-trip commission is clawed back (DEBIT) from the admin wallet.
 *
 * Money conservation (ONLINE): commuter credit == partner debit + admin debit,
 * because paymentAmount == partnerEarnings + adminCommission.
 *
 * Returns a summary object describing what was settled (or null if nothing to do).
 */
export const processRouteDeletionRefundForPass = async (pass, route, adminUserCache) => {
    try {
        // `passengerId` is populated on the pass (a User doc), so normalize to the raw
        // ObjectId for wallet/notification lookups. `partnerId` is not populated.
        const passengerId = pass.passengerId?._id || pass.passengerId;

        // Locate the originating booking so we can read accurate trip usage + the
        // exact partner/admin split that was applied at acceptance time.
        let booking = await B2CPassengerBooking.findOne({
            monthlyPassId: pass._id,
            isMonthlyPass: true,
        });

        // Fallback for legacy passes without a linked booking
        if (!booking) {
            booking = await B2CPassengerBooking.findOne({
                routeId: pass.routeId,
                passengerId: passengerId,
                isMonthlyPass: true,
            });
        }

        const currency = (booking?.currency) || pass.currency || route?.pricing?.currency || "AED";
        const paymentMethod = (booking?.paymentMethod) || pass.paymentMethod || "WALLET";

        // Was money actually collected by the platform/partner?
        //
        // IMPORTANT (CASH): for cash monthly passes the commuter pays the partner
        // OFFLINE, so the originating booking's `paymentStatus` stays "PENDING"
        // even though money genuinely changed hands (the commuter paid cash and,
        // at acceptance, the partner pre-paid the admin commission from their
        // wallet). The pass document, however, is marked "PAID" once activated.
        // Previously this gate only inspected the booking's paymentStatus, so cash
        // passes were treated as "unpaid" and the whole settlement (commission
        // reversal from admin -> partner, cash-refund-due to commuter) was skipped.
        // We now also honour the PASS payment status so cash passes settle correctly.
        const bookingPaidOnline = booking
            ? ["COMPLETED", "PAID"].includes(booking.paymentStatus)
            : false;
        const passMarkedPaid = ["PAID", "COMPLETED"].includes(pass.paymentStatus);
        const bookingPaid = bookingPaidOnline || passMarkedPaid;

        // The full amount the commuter paid, and the split that was credited out.
        const paymentAmount = round2(booking?.paymentAmount || pass.totalAmount || 0);
        const fullPartnerEarnings = round2(
            (booking?.driverEarnings != null ? booking.driverEarnings : pass.partnerEarnings) || 0
        );
        const fullAdminCommission = round2(
            (booking?.adminCommissionAmount != null ? booking.adminCommissionAmount : pass.adminCommission) || 0
        );

        // ===== USED vs REMAINING (UNUSED) TRIPS =====
        // Prefer counting the real trip documents (past/in-progress/completed = used).
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        let usedTripsCount = 0;
        let remainingTripsCount = 0;

        if (booking && Array.isArray(booking.monthlyTrips) && booking.monthlyTrips.length > 0) {
            const passTrips = await B2CPartnerTrip.find({
                _id: { $in: booking.monthlyTrips },
            }).select("tripDate status");

            for (const t of passTrips) {
                const isPast = new Date(t.tripDate) < todayStart;
                const isDone = ["Completed", "In Progress"].includes(t.status);
                if (isPast || isDone) usedTripsCount++;
                else remainingTripsCount++;
            }
        } else {
            // Fallback to the pass counters
            const total = pass.totalTrips || 0;
            usedTripsCount = Math.min(pass.usedTrips || 0, total);
            remainingTripsCount = Math.max(0, total - usedTripsCount);
        }

        const totalTrips = usedTripsCount + remainingTripsCount;
        // Fraction of the pass that is UNUSED and therefore refundable.
        const unusedFraction = totalTrips > 0 ? remainingTripsCount / totalTrips : 1;

        // Pro-rata amounts for the unused portion.
        const refundToCommuter = round2(unusedFraction * paymentAmount);
        let earningsToReverse = round2(unusedFraction * fullPartnerEarnings);
        // Force the admin debit so that (partner debit + admin debit) === commuter refund.
        let commissionToReverse = round2(refundToCommuter - earningsToReverse);
        if (commissionToReverse < 0) {
            commissionToReverse = 0;
            earningsToReverse = refundToCommuter;
        }

        const summary = {
            passId: pass._id,
            bookingId: booking?._id || null,
            passengerId: passengerId,
            partnerId: pass.partnerId || route?.b2cPartnerId,
            currency,
            paymentMethod,
            usedTripsCount,
            remainingTripsCount,
            totalTrips,
            refundToCommuter,
            earningsReversed: 0,
            commissionReversed: 0,
            refundMethod: "NONE",
        };

        // Nothing to refund (no payment, or commuter used everything already)
        if (!bookingPaid || refundToCommuter <= 0) {
            // Still mark records cancelled by the caller; just no money movement.
            if (booking) {
                booking.refundMethod = "NONE";
                booking.refundAmount = 0;
                booking.cancellationFee = 0;
                booking.usedTripsCount = usedTripsCount;
                booking.remainingTripsCount = remainingTripsCount;
                await booking.save();
            }
            return summary;
        }

        const isCash = paymentMethod === "CASH";
        const partnerId = pass.partnerId || route?.b2cPartnerId;

        // Resolve admin user/wallet once (cached across passes)
        let adminUser = adminUserCache.user;
        if (adminUser === undefined) {
            adminUser = await User.findOne({ role: "ADMIN" });
            adminUserCache.user = adminUser;
        }

        // ===== 1. REFUND THE COMMUTER TO THEIR IN-APP WALLET (no cancellation fee) =====
        // The commuter is ALWAYS refunded into their wallet — for BOTH online and
        // CASH passes — so they can withdraw the money from the app and never have
        // to chase the partner for cash offline.
        //
        // Funding of this wallet credit (kept fully money-conserved) happens in the
        // sections below:
        //   - ONLINE: platform held the money, so the partner earnings portion is
        //     debited from the partner wallet and the commission portion from admin.
        //   - CASH:   the partner physically holds the commuter's cash, so the
        //     earnings portion is debited from the partner wallet (the partner keeps
        //     the equivalent physical cash to cover it) and the commission portion —
        //     which the partner pre-paid to admin at acceptance — is debited from the
        //     admin wallet. Net effect: commuter is made whole digitally.
        //
        // Ensure the commuter has a wallet in the pass currency (create if missing so
        // a cash commuter who never used the wallet can still receive & withdraw it).
        let commuterWallet = await Wallet.findOne({ userId: passengerId, currency });
        if (!commuterWallet) {
            const passengerUser = await User.findById(passengerId).select("role");
            commuterWallet = await Wallet.create({
                userId: passengerId,
                role: passengerUser?.role || "COMMUTER",
                currency,
                balance: 0,
            });
        }
        {
            const balanceBefore = commuterWallet.balance;
            commuterWallet.balance = round2(commuterWallet.balance + refundToCommuter);
            const description = `Refund for ${remainingTripsCount} unused trip(s) - route "${route.fromLocation} to ${route.toLocation}" deleted by operator (no cancellation fee)`;
            commuterWallet.transactions.push({
                type: "REFUND",
                amount: refundToCommuter,
                description,
                reference: String(booking?._id || pass._id),
                status: "COMPLETED",
                createdAt: new Date(),
            });
            await commuterWallet.save();

            await Transaction.create({
                walletId: commuterWallet._id,
                userId: passengerId,
                type: "CREDIT",
                amount: refundToCommuter,
                currency,
                category: "REFUND",
                description,
                referenceId: booking?._id,
                referenceModel: booking ? "B2CPassengerBooking" : undefined,
                balanceBefore,
                balanceAfter: commuterWallet.balance,
                metadata: {
                    passId: pass._id,
                    bookingId: booking?._id,
                    reason: isCash ? "route_deleted_by_partner_cash" : "route_deleted_by_partner",
                    paymentMethod,
                    usedTripsCount,
                    remainingTripsCount,
                    cancellationFee: 0,
                },
            });
            summary.refundMethod = "WALLET";
        }

        // ===== 2. CLAW BACK PARTNER EARNINGS FOR UNUSED TRIPS =====
        // The partner keeps earnings ONLY for trips actually used, so the unused-trip
        // earnings portion is DEBITED from the partner wallet in BOTH cases:
        //   - ONLINE/WALLET: partner was credited earnings at acceptance -> reverse it.
        //   - CASH: the partner physically holds the commuter's cash. We debit the
        //     wallet by the earnings portion (the partner keeps the equivalent cash),
        //     which funds the commuter's in-app wallet refund done in section 1.
        // The wallet balance is intentionally allowed to go negative (see Wallet model)
        // — a partner holding cash must top up to settle what they owe.
        const partnerWallet = await Wallet.findOne({ userId: partnerId, currency });
        if (partnerWallet && earningsToReverse > 0) {
            const partnerBalanceBefore = partnerWallet.balance;
            partnerWallet.balance = round2(partnerWallet.balance - earningsToReverse);
            // Only reduce lifetime earnings for online passes, where the earnings were
            // actually credited to the wallet's totalEarnings at acceptance. For cash,
            // earnings were never added to the wallet (held as physical cash).
            if (!isCash) {
                partnerWallet.totalEarnings = Math.max(0, round2((partnerWallet.totalEarnings || 0) - earningsToReverse));
            }
            const description = isCash
                ? `Cash refund funded for ${remainingTripsCount} unused trip(s) - you deleted route "${route.fromLocation} to ${route.toLocation}". You keep the passenger's cash for these trips; the amount was refunded to their wallet on your behalf.`
                : `Earnings reversed for ${remainingTripsCount} unused trip(s) - you deleted route "${route.fromLocation} to ${route.toLocation}"`;
            partnerWallet.transactions.push({
                type: "EARNINGS_REVERSAL",
                amount: earningsToReverse,
                description,
                status: "COMPLETED",
                createdAt: new Date(),
            });
            await partnerWallet.save();

            await Transaction.create({
                walletId: partnerWallet._id,
                userId: partnerId,
                type: "DEBIT",
                amount: earningsToReverse,
                currency,
                category: "EARNINGS_REVERSAL",
                description,
                referenceId: booking?._id,
                referenceModel: booking ? "B2CPassengerBooking" : undefined,
                balanceBefore: partnerBalanceBefore,
                balanceAfter: partnerWallet.balance,
                metadata: {
                    passId: pass._id,
                    bookingId: booking?._id,
                    reason: isCash ? "route_deleted_by_partner_cash" : "route_deleted_by_partner",
                    paymentMethod,
                    usedTripsCount,
                    remainingTripsCount,
                    fullPartnerEarnings,
                },
            });
            summary.earningsReversed = earningsToReverse;
        }

        // ===== 3. CLAW BACK ADMIN COMMISSION FOR UNUSED TRIPS =====
        // The admin keeps commission ONLY for trips actually used, so the unused-trip
        // commission portion is DEBITED from the admin wallet in BOTH cases:
        //   - ONLINE/WALLET: admin was credited commission at acceptance.
        //   - CASH: the partner pre-paid this commission to admin at acceptance.
        // In both cases this commission portion helps fund the commuter's in-app
        // wallet refund done in section 1.
        if (adminUser && commissionToReverse > 0) {
            const adminWallet = await Wallet.findOne({ userId: adminUser._id, currency });
            if (adminWallet) {
                const adminBalanceBefore = adminWallet.balance;
                adminWallet.balance = round2(adminWallet.balance - commissionToReverse);
                adminWallet.totalEarnings = Math.max(0, round2((adminWallet.totalEarnings || 0) - commissionToReverse));
                const description = `Commission reversed for ${remainingTripsCount} unused trip(s) - route "${route.fromLocation} to ${route.toLocation}" deleted by operator`;
                adminWallet.transactions.push({
                    type: "COMMISSION_REVERSAL",
                    amount: commissionToReverse,
                    description,
                    status: "COMPLETED",
                    createdAt: new Date(),
                });
                await adminWallet.save();

                await Transaction.create({
                    walletId: adminWallet._id,
                    userId: adminUser._id,
                    type: "DEBIT",
                    amount: commissionToReverse,
                    currency,
                    category: "COMMISSION_REVERSAL",
                    description,
                    referenceId: booking?._id,
                    referenceModel: booking ? "B2CPassengerBooking" : undefined,
                    balanceBefore: adminBalanceBefore,
                    balanceAfter: adminWallet.balance,
                    metadata: {
                        passId: pass._id,
                        bookingId: booking?._id,
                        reason: isCash ? "route_deleted_by_partner_cash" : "route_deleted_by_partner",
                        paymentMethod,
                        usedTripsCount,
                        remainingTripsCount,
                        fullAdminCommission,
                    },
                });
                summary.commissionReversed = commissionToReverse;
            }
        }

        // ===== 4. PERSIST REFUND STATE ON THE BOOKING =====
        // The commuter is now refunded into their in-app wallet for BOTH online and
        // cash passes, so the refund is COMPLETED (not a pending cash IOU) in all cases.
        if (booking) {
            booking.usedTripsCount = usedTripsCount;
            booking.remainingTripsCount = remainingTripsCount;
            booking.refundAmount = refundToCommuter;
            booking.cancellationFee = 0;
            booking.refundStatus = "COMPLETED";
            booking.paymentStatus = "REFUNDED";
            booking.refundMethod = "WALLET";
            // No offline cash owed to the commuter anymore.
            booking.cashRefundDueFromPartner = 0;
            booking.cashRefundSettled = true;
            booking.bookingStatus = "CANCELLED";
            booking.cancellationReason = "Route deleted by operator";
            booking.cancelledAt = new Date();
            await booking.save();
        }

        // ===== 5. NOTIFY THE COMMUTER =====
        try {
            const msg = `The route "${route.fromLocation} to ${route.toLocation}" was cancelled by the operator. ${currency} ${refundToCommuter.toFixed(2)} for your ${remainingTripsCount} unused trip(s) has been refunded to your in-app wallet — you can withdraw it anytime. No cancellation fee was charged.`;

            await createNotification({
                userId: passengerId,
                type: "REFUND_PROCESSED",
                title: "Route Cancelled - Refund Processed",
                message: msg,
                category: "PAYMENT",
            });
            sendRealTimeNotification(passengerId, {
                type: "REFUND_PROCESSED",
                title: "Route Cancelled - Refund Processed",
                message: msg,
                data: { passId: pass._id, refundAmount: refundToCommuter, remainingTripsCount, refundMethod: summary.refundMethod },
            });
        } catch (notifErr) {
            console.error("[deleteB2CPartnerRoute] Refund notification failed:", notifErr.message);
        }

        console.log("[deleteB2CPartnerRoute] Pass refund settled:", summary);
        return summary;
    } catch (err) {
        console.error("[deleteB2CPartnerRoute] Error refunding pass:", pass?._id, err.message);
        return null;
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
        }).populate("passengerId", "fullName email contactPhone");

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
        }).populate("passengerId", "fullName email contactPhone");

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
                            passengerPhone: pass.passengerId?.contactPhone || 'N/A',
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
                            passengerPhone: booking.passengerId?.contactPhone || 'N/A',
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

        // ===== PROCESS REFUNDS BEFORE DELETING ANYTHING =====
        // CRITICAL: refunds must run BEFORE trips are deleted, because the refund math
        // counts used vs unused trips from the actual trip documents. The commuter is
        // refunded for unused trips, the partner's unused-trip earnings are clawed back,
        // and the admin's unused-trip commission is clawed back. NO cancellation fee is
        // charged because the operator (not the commuter) cancelled the route.
        const refundSummaries = [];
        let totalRefundedToCommuters = 0;
        const adminUserCache = {}; // resolve the ADMIN user only once across all passes

        if (forceDelete === 'true' && activePasses.length > 0) {
            for (const pass of activePasses) {
                const summary = await processRouteDeletionRefundForPass(pass, route, adminUserCache);
                if (summary) {
                    refundSummaries.push(summary);
                    totalRefundedToCommuters += summary.refundToCommuter || 0;
                }
            }
        }

        // Notify the operator (partner) of the wallet impact of the deletion.
        // The unused-trip earnings portion is DEBITED from the partner wallet in BOTH
        // cases (commuter is refunded to their in-app wallet):
        //  - ONLINE (WALLET/STRIPE): the earnings held in the wallet are clawed back.
        //  - CASH: the partner keeps the passenger's physical cash for the unused
        //    trips, and the wallet is debited by that same amount because the refund
        //    was paid to the commuter's wallet on the partner's behalf.
        const totalEarningsReversed = round2(
            refundSummaries.reduce((s, r) => s + (r.earningsReversed || 0), 0)
        );
        if (totalEarningsReversed > 0) {
            try {
                const partnerCurrency = refundSummaries[0]?.currency || route.pricing?.currency || "AED";
                const partnerMsg = `You deleted the route "${route.fromLocation} to ${route.toLocation}". ${partnerCurrency} ${totalEarningsReversed.toFixed(2)} for commuters' unused trips was debited from your wallet and refunded to their in-app wallets (you keep earnings only for trips actually used). For cash passes you keep the passenger's cash for those unused trips, so this simply settles what you owed them digitally.`;
                await createNotification({
                    userId: route.b2cPartnerId,
                    type: "WALLET_UPDATED",
                    title: "Wallet Updated - Route Deleted",
                    message: partnerMsg,
                    category: "WALLET",
                });
                sendRealTimeNotification(route.b2cPartnerId, {
                    type: "WALLET_UPDATED",
                    title: "Wallet Updated - Route Deleted",
                    message: partnerMsg,
                    data: { totalEarningsReversed },
                });
            } catch (notifErr) {
                console.error("[deleteB2CPartnerRoute] Partner notification failed:", notifErr.message);
            }
        }

        // Delete associated schedules and trips (AFTER refunds have been calculated)
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

        // Mark monthly passes as REFUNDED/CANCELLED after the wallet settlements above.
        if (forceDelete === 'true' && activePasses.length > 0) {
            await B2CMonthlyPass.updateMany(
                { routeId: routeId, status: { $in: ["ACTIVE", "PENDING"] } },
                {
                    $set: {
                        status: "CANCELLED",
                        paymentStatus: "REFUNDED",
                        notes: `${new Date().toISOString()} - Route deleted by operator. Unused trips refunded to commuter; partner earnings and admin commission for unused trips reversed. No cancellation fee charged.`
                    }
                }
            );
        }

        // Update any remaining bookings (e.g. non-pass bookings) to CANCELLED. Pass-linked
        // bookings already had their refund state persisted inside the refund helper.
        if (forceDelete === 'true' && pendingBookings.length > 0) {
            await B2CPassengerBooking.updateMany(
                {
                    routeId: routeId,
                    bookingStatus: { $in: ["PENDING", "ACCEPTED", "CONFIRMED"] }
                },
                {
                    $set: {
                        bookingStatus: "CANCELLED",
                        autoCancelReason: "Route deleted by operator"
                    }
                }
            );
        }

        // Delete route
        await B2CPartnerRoute.findByIdAndDelete(routeId);

        res.status(200).json({
            success: true,
            message: totalRefundedToCommuters > 0
                ? `Route deleted. Commuters were refunded for their unused trips (no cancellation fee). Earnings and commission for unused trips were reversed from the operator and admin wallets.`
                : "B2C Partner Route deleted successfully",
            deletedData: {
                schedulesDeleted: schedules.length,
                tripsDeleted: totalTrips,
                passesCancelled: forceDelete === 'true' ? activePasses.length : 0,
                bookingsCancelled: forceDelete === 'true' ? pendingBookings.length : 0
            },
            refunds: {
                passesRefunded: refundSummaries.length,
                totalRefundedToCommuters: round2(totalRefundedToCommuters),
                totalEarningsReversed,
                totalAdminCommissionReversed: round2(
                    refundSummaries.reduce((s, r) => s + (r.commissionReversed || 0), 0)
                ),
                details: refundSummaries
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
        }).populate("passengerId", "fullName email contactPhone");

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
        }).populate("passengerId", "fullName email contactPhone");

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
                    totalValue: round2(activePasses.reduce((sum, p) => sum + (p.totalAmount || 0), 0)),
                    // Estimated total the commuters will be refunded for their UNUSED trips.
                    totalEstimatedRefund: round2(activePasses.reduce((sum, p) => {
                        const total = p.totalTrips || 0;
                        const remaining = Math.max(0, total - (p.usedTrips || 0));
                        const fraction = total > 0 ? remaining / total : 1;
                        return sum + fraction * (p.totalAmount || 0);
                    }, 0)),
                    currency: activePasses[0]?.currency || route.pricing?.currency || "AED",
                    details: activePasses.map(pass => {
                        const totalTrips = pass.totalTrips || 0;
                        const remainingTrips = Math.max(0, totalTrips - (pass.usedTrips || 0));
                        const fraction = totalTrips > 0 ? remainingTrips / totalTrips : 1;
                        return {
                            passId: pass._id,
                            passengerName: pass.passengerId?.fullName || 'Unknown',
                            passengerPhone: pass.passengerId?.contactPhone || 'N/A',
                            passengerEmail: pass.passengerId?.email || 'N/A',
                            passType: pass.passType,
                            startDate: pass.startDate,
                            endDate: pass.endDate,
                            totalAmount: pass.totalAmount,
                            currency: pass.currency,
                            usedTrips: pass.usedTrips,
                            totalTrips: pass.totalTrips,
                            remainingTrips,
                            // Estimated refund for this commuter's unused trips (no cancellation fee).
                            estimatedRefund: round2(fraction * (pass.totalAmount || 0)),
                            status: pass.status
                        };
                    })
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
                        passengerPhone: booking.passengerId?.contactPhone || 'N/A',
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
            driverId, // Default driver for all trips
            vehicleId, // Default vehicle for all trips
            tripTimes, // Array of { departureTime, arrivalTime, tripType, assignedDriver?, assignedVehicle? }
            availableDays,
            excludeRouteId // Optional: exclude this route from conflict check (for updates)
        } = req.body;

        const conflicts = [];
        const effectiveAvailableDays = availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

        // Prepare proposed schedule for conflict checking
        const formattedTripTimes = (tripTimes || []).map(time => ({
            departureTime: convertToAMPMFormat(time.departureTime),
            arrivalTime: time.arrivalTime ? convertToAMPMFormat(time.arrivalTime) : null,
            tripType: time.tripType || "One Way",
            assignedDriver: time.assignedDriver || null,
            assignedVehicle: time.assignedVehicle || null
        }));

        // Check conflicts for each trip individually (supporting per-trip driver/vehicle)
        for (let i = 0; i < formattedTripTimes.length; i++) {
            const tripTime = formattedTripTimes[i];

            // Use per-trip driver if assigned, otherwise fall back to default
            const effectiveDriverId = tripTime.assignedDriver || driverId;
            const effectiveVehicleId = tripTime.assignedVehicle || vehicleId;

            // Create a single-trip schedule for conflict checking
            const singleTripSchedule = {
                tripTimes: [tripTime],
                availableDays: effectiveAvailableDays
            };

            // Check for driver conflicts for this trip
            if (effectiveDriverId) {
                const driverConflict = await checkDriverConflict(
                    effectiveDriverId,
                    req.userId,
                    singleTripSchedule,
                    excludeRouteId
                );

                if (driverConflict.hasConflict) {
                    conflicts.push({
                        type: "DRIVER",
                        tripIndex: i + 1,
                        tripTime: tripTime.departureTime,
                        ...driverConflict
                    });
                }
            }

            // Check for vehicle conflicts for this trip
            if (effectiveVehicleId) {
                const vehicleConflict = await checkVehicleConflict(
                    effectiveVehicleId,
                    req.userId,
                    singleTripSchedule,
                    excludeRouteId
                );

                if (vehicleConflict.hasConflict) {
                    conflicts.push({
                        type: "VEHICLE",
                        tripIndex: i + 1,
                        tripTime: tripTime.departureTime,
                        ...vehicleConflict
                    });
                }
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

// Merge duplicate schedules for a specific route (utility function)
export const mergeRouteSchedules = async (req, res) => {
    try {
        const { routeId } = req.params;

        console.log("[v0] Merging schedules for route:", routeId);

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

        // Find all schedules for this route
        const schedules = await B2CPartnerSchedule.find({
            routeId: routeId,
            b2cPartnerId: req.userId,
            isActive: true,
            status: "Active"
        }).sort({ createdAt: 1 }); // Sort by creation date, oldest first

        if (schedules.length <= 1) {
            return res.status(200).json({
                success: true,
                message: "No duplicate schedules found for this route",
                scheduleCount: schedules.length
            });
        }

        console.log(`[v0] Found ${schedules.length} schedules for route. Merging...`);

        // Primary schedule is the oldest one
        const primarySchedule = schedules[0];
        const duplicateSchedules = schedules.slice(1);

        // Collect all trip times
        const allTripTimes = [...primarySchedule.tripTimes];
        const existingDepartureTimes = new Set(allTripTimes.map(t => t.departureTime));

        // Collect all available days
        let allAvailableDays = new Set(primarySchedule.availableDays || []);

        for (const dupSchedule of duplicateSchedules) {
            // Add unique trip times
            for (const tripTime of (dupSchedule.tripTimes || [])) {
                if (!existingDepartureTimes.has(tripTime.departureTime)) {
                    allTripTimes.push(tripTime);
                    existingDepartureTimes.add(tripTime.departureTime);
                    console.log(`[v0] Adding trip time: ${tripTime.departureTime}`);
                }
            }

            // Merge available days
            for (const day of (dupSchedule.availableDays || [])) {
                allAvailableDays.add(day);
            }
        }

        // Update primary schedule with merged data
        const updatedSchedule = await B2CPartnerSchedule.findByIdAndUpdate(
            primarySchedule._id,
            {
                $set: {
                    tripTimes: allTripTimes,
                    availableDays: Array.from(allAvailableDays),
                    updatedAt: new Date()
                }
            },
            { new: true }
        );

        console.log(`[v0] Updated primary schedule with ${allTripTimes.length} total trip times`);

        // Delete duplicate schedules
        const deletedIds = [];
        for (const dupSchedule of duplicateSchedules) {
            await B2CPartnerSchedule.findByIdAndDelete(dupSchedule._id);
            deletedIds.push(dupSchedule._id);
            console.log(`[v0] Deleted duplicate schedule: ${dupSchedule._id}`);
        }

        res.status(200).json({
            success: true,
            message: `Successfully merged ${schedules.length} schedules into 1`,
            primaryScheduleId: primarySchedule._id,
            deletedScheduleIds: deletedIds,
            totalTripTimes: allTripTimes.length,
            schedule: updatedSchedule
        });
    } catch (error) {
        console.error("[v0] Error merging route schedules:", error.message);
        res.status(500).json({
            success: false,
            message: "Error merging route schedules",
            error: error.message,
        });
    }
};

// Merge all duplicate schedules for all routes belonging to a partner
export const mergeAllPartnerSchedules = async (req, res) => {
    try {
        console.log("[v0] Merging all duplicate schedules for partner:", req.userId);

        // Find all routes that have multiple active schedules
        const duplicates = await B2CPartnerSchedule.aggregate([
            {
                $match: {
                    b2cPartnerId: req.userId,
                    isActive: true,
                    status: "Active"
                }
            },
            {
                $group: {
                    _id: '$routeId',
                    count: { $sum: 1 },
                    scheduleIds: { $push: '$_id' }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        if (duplicates.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No routes with duplicate schedules found",
                routesProcessed: 0
            });
        }

        console.log(`[v0] Found ${duplicates.length} routes with duplicate schedules`);

        let totalMerged = 0;
        let totalDeleted = 0;
        const processedRoutes = [];

        for (const duplicate of duplicates) {
            const routeId = duplicate._id;

            // Find all schedules for this route
            const schedules = await B2CPartnerSchedule.find({
                routeId: routeId,
                b2cPartnerId: req.userId,
                isActive: true,
                status: "Active"
            }).sort({ createdAt: 1 });

            if (schedules.length <= 1) continue;

            const primarySchedule = schedules[0];
            const duplicateSchedules = schedules.slice(1);

            // Collect all trip times
            const allTripTimes = [...primarySchedule.tripTimes];
            const existingDepartureTimes = new Set(allTripTimes.map(t => t.departureTime));

            // Collect all available days
            let allAvailableDays = new Set(primarySchedule.availableDays || []);

            for (const dupSchedule of duplicateSchedules) {
                for (const tripTime of (dupSchedule.tripTimes || [])) {
                    if (!existingDepartureTimes.has(tripTime.departureTime)) {
                        allTripTimes.push(tripTime);
                        existingDepartureTimes.add(tripTime.departureTime);
                    }
                }
                for (const day of (dupSchedule.availableDays || [])) {
                    allAvailableDays.add(day);
                }
            }

            // Update primary schedule
            await B2CPartnerSchedule.findByIdAndUpdate(
                primarySchedule._id,
                {
                    $set: {
                        tripTimes: allTripTimes,
                        availableDays: Array.from(allAvailableDays),
                        updatedAt: new Date()
                    }
                }
            );

            // Delete duplicate schedules
            for (const dupSchedule of duplicateSchedules) {
                await B2CPartnerSchedule.findByIdAndDelete(dupSchedule._id);
                totalDeleted++;
            }

            totalMerged++;
            processedRoutes.push({
                routeId: routeId,
                originalScheduleCount: schedules.length,
                tripTimesAfterMerge: allTripTimes.length,
                deletedSchedules: duplicateSchedules.length
            });
        }

        console.log(`[v0] Merged ${totalMerged} routes, deleted ${totalDeleted} duplicate schedules`);

        res.status(200).json({
            success: true,
            message: `Successfully merged schedules for ${totalMerged} routes`,
            routesProcessed: totalMerged,
            schedulesDeleted: totalDeleted,
            details: processedRoutes
        });
    } catch (error) {
        console.error("[v0] Error merging all partner schedules:", error.message);
        res.status(500).json({
            success: false,
            message: "Error merging schedules",
            error: error.message,
        });
    }
};

// ---------------------------------------------------------------------------
// Change Driver / Vehicle for an ENTIRE B2C route.
// When a driver becomes sick or a vehicle breaks down, the B2C Partner can swap
// the assignment. The change cascades to EVERY place the old driver/vehicle was
// used on this route: schedule trip-times, the route record, future generated
// daily trips, and active commuter bookings (so the new driver starts/completes
// those booked trips). Completed / in-progress / cancelled trips are left alone.
// ---------------------------------------------------------------------------

// Active booking statuses whose driver/vehicle should be re-pointed.
const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "ACCEPTED", "IN_PROGRESS"];
// Daily-trip statuses that are still re-assignable (not yet started/finished).
const REASSIGNABLE_TRIP_STATUSES = ["Scheduled", "Delayed"];

// Resolve a driver (B2CPartnerDriver OR the partner acting as Self) into a
// normalized info object used for snapshots & notifications.
const resolveDriverInfo = async (driverId, partnerId) => {
    if (!driverId) return null;
    const driverIdStr = driverId.toString();
    const partnerIdStr = partnerId.toString();

    if (driverIdStr === partnerIdStr) {
        const partner = await User.findById(partnerId).select("fullName name whatsappNumber phone profileImage");
        if (!partner) return null;
        return {
            _id: partner._id,
            name: partner.fullName || partner.name || "Self",
            phoneNumber: partner.whatsappNumber || partner.phone || "",
            licenseNumber: null,
            image: partner.profileImage || null,
            isSelfDriver: true,
        };
    }

    const driver = await B2CPartnerDriver.findOne({ _id: driverId, b2cPartnerId: partnerId })
        .select("name phoneNumber licenseNumber driverImage");
    if (!driver) return null;
    return {
        _id: driver._id,
        name: driver.name,
        phoneNumber: driver.phoneNumber || "",
        licenseNumber: driver.licenseNumber || null,
        image: driver.driverImage?.url || null,
        isSelfDriver: false,
    };
};

const setDriverBusy = async (driverId, partnerId) => {
    if (!driverId) return;
    if (driverId.toString() === partnerId.toString()) {
        await User.findByIdAndUpdate(partnerId, {
            $set: { "selfDriverAvailability.status": "busy", "selfDriverAvailability.lastUpdate": new Date() },
        });
    } else {
        await B2CPartnerDriver.findByIdAndUpdate(driverId, {
            $set: { availabilityStatus: "busy", lastAvailabilityUpdate: new Date() },
        });
    }
};

// Mark a driver available ONLY if they no longer have any re-assignable trip
// today or in the future across this partner's fleet.
const refreshDriverAvailability = async (driverId, partnerId) => {
    if (!driverId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const remaining = await B2CPartnerTrip.countDocuments({
        driverId,
        status: { $in: REASSIGNABLE_TRIP_STATUSES },
        tripDate: { $gte: today },
    });
    if (remaining > 0) return; // still busy elsewhere
    if (driverId.toString() === partnerId.toString()) {
        await User.findByIdAndUpdate(partnerId, {
            $set: { "selfDriverAvailability.status": "available", "selfDriverAvailability.lastUpdate": new Date() },
        });
    } else {
        await B2CPartnerDriver.findByIdAndUpdate(driverId, {
            $set: { availabilityStatus: "available", lastAvailabilityUpdate: new Date() },
        });
    }
};

const refreshVehicleAvailability = async (vehicleId) => {
    if (!vehicleId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const remaining = await B2CPartnerTrip.countDocuments({
        vehicleId,
        status: { $in: REASSIGNABLE_TRIP_STATUSES },
        tripDate: { $gte: today },
    });
    if (remaining > 0) return;
    await B2CPartnerVehicle.findByIdAndUpdate(vehicleId, {
        $set: { availabilityStatus: "available", lastAvailabilityUpdate: new Date() },
    });
};

// ---------------------------------------------------------------------------
// Allocation guard: only "Active" vehicles may be assigned to routes, schedules
// or trips. Vehicles that are "Maintenance" or "Inactive" must be rejected.
//
// Accepts one or many vehicle ids (schedule default + per-trip outbound/return
// assignments), de-dupes them, and returns { ok:false, message } naming the
// first offending vehicle so the partner gets a clear reason.
// ---------------------------------------------------------------------------
const assertVehiclesAllocatable = async (vehicleIds, partnerId) => {
    const ids = [...new Set((Array.isArray(vehicleIds) ? vehicleIds : [vehicleIds])
        .filter(Boolean)
        .map((v) => v.toString()))];
    if (ids.length === 0) return { ok: true };

    const vehicles = await B2CPartnerVehicle.find({
        _id: { $in: ids },
        b2cPartnerId: partnerId,
    }).select("model licensePlate status");

    for (const v of vehicles) {
        if (v.status !== "Active") {
            const label = v.model
                ? `${v.model}${v.licensePlate ? ` (${v.licensePlate})` : ""}`
                : "The selected vehicle";
            const stateWord = v.status === "Maintenance" ? "under maintenance" : "inactive";
            return {
                ok: false,
                message: `${label} is ${stateWord} and cannot be assigned to trips. Please select an active vehicle.`,
            };
        }
    }
    return { ok: true };
};

// ---------------------------------------------------------------------------
// Remove a vehicle from EVERY assignment across a partner's routes, schedules,
// future daily trips and active bookings. Used when a vehicle becomes
// unavailable — i.e. its status is changed to "Maintenance" or "Inactive". An
// unavailable vehicle must not remain allocated anywhere.
//
// Steps (all real DB writes):
//   1. Clear it from schedule.assignedVehicle + tripTimes.assignedVehicle /
//      tripTimes.returnVehicle across all of the partner's schedules.
//   2. Clear it from route.assignedVehicle on all of the partner's routes.
//   3. Clear vehicleId + vehicleInfo snapshot from future / re-assignable
//      daily trips.
//   4. Clear the outbound/return vehicle refs from active commuter bookings.
//   5. Notify every affected commuter (real-time + email) that their trip
//      vehicle was removed and a new one will be assigned — their booking
//      remains confirmed.
//
// Returns a summary of the counts touched.
// ---------------------------------------------------------------------------
export const deallocateVehicleFromAllAssignments = async (vehicleId, partnerId, { reason = "Inactive" } = {}) => {
    const summary = {
        schedulesUpdated: 0,
        routesUpdated: 0,
        tripsUpdated: 0,
        bookingsUpdated: 0,
        commutersNotified: 0,
    };
    if (!vehicleId || !partnerId) return summary;

    const vId = vehicleId.toString();
    const matches = (id) => id && id.toString() === vId;

    // 1) Schedules + their trip-time (outbound & return) assignments.
    const schedules = await B2CPartnerSchedule.find({ b2cPartnerId: partnerId });
    for (const schedule of schedules) {
        let changed = false;
        if (matches(schedule.assignedVehicle)) {
            schedule.assignedVehicle = null;
            changed = true;
        }
        (schedule.tripTimes || []).forEach((tt) => {
            if (matches(tt.assignedVehicle)) { tt.assignedVehicle = null; changed = true; }
            if (matches(tt.returnVehicle)) { tt.returnVehicle = null; changed = true; }
        });
        if (changed) {
            schedule.markModified("tripTimes");
            await schedule.save();
            summary.schedulesUpdated += 1;
        }
    }

    // 2) Route records.
    const routeUpdate = await B2CPartnerRoute.updateMany(
        { b2cPartnerId: partnerId, assignedVehicle: vehicleId },
        { $set: { assignedVehicle: null } },
    );
    summary.routesUpdated = routeUpdate.modifiedCount || 0;

    // 3) Future / not-yet-started daily trips (clear ref + snapshot).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tripUpdate = await B2CPartnerTrip.updateMany(
        {
            b2cPartnerId: partnerId,
            vehicleId,
            status: { $in: REASSIGNABLE_TRIP_STATUSES },
            tripDate: { $gte: today },
        },
        {
            $set: {
                vehicleId: null,
                "vehicleInfo.model": "",
                "vehicleInfo.licensePlate": "",
                "vehicleInfo.seatingCapacity": null,
            },
        },
    );
    summary.tripsUpdated = tripUpdate.modifiedCount || 0;

    // 4) Active commuter bookings — capture affected commuters, then clear refs.
    const affectedBookings = await B2CPassengerBooking.find({
        bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
        $or: [{ outboundVehicleId: vehicleId }, { returnVehicleId: vehicleId }],
    }).select("userId").lean();

    await B2CPassengerBooking.updateMany(
        { bookingStatus: { $in: ACTIVE_BOOKING_STATUSES }, outboundVehicleId: vehicleId },
        { $set: { outboundVehicleId: null } },
    );
    await B2CPassengerBooking.updateMany(
        { bookingStatus: { $in: ACTIVE_BOOKING_STATUSES }, returnVehicleId: vehicleId },
        { $set: { returnVehicleId: null } },
    );
    summary.bookingsUpdated = affectedBookings.length;

    // 5) Notify affected commuters (real-time + best-effort email).
    const commuterIds = [...new Set(affectedBookings.map((b) => b.userId?.toString()).filter(Boolean))];
    const title = "Vehicle Update for Your Trip";
    const message =
        "The vehicle assigned to one of your upcoming trips is no longer available and will be reassigned shortly. Your booking is still confirmed.";
    for (const uid of commuterIds) {
        try {
            const notification = await createNotification({
                userId: uid,
                type: "ASSIGNMENT_UPDATED",
                title,
                message,
                metadata: { changeType: "VEHICLE_REMOVED", vehicleId: vId, reason },
            });
            sendRealTimeNotification(uid, notification);

            const commuter = await User.findById(uid).select("fullName name email");
            if (commuter?.email) {
                const html = buildAssignmentEmailHtml({
                    heading: title,
                    greetingName: commuter.fullName || commuter.name,
                    bodyLines: [
                        "The vehicle assigned to one of your upcoming DriveMe trips has become unavailable and has been removed.",
                        "Don't worry — your booking is still confirmed and a new vehicle will be assigned before your trip.",
                        "You can view the latest details anytime in the DriveMe app under your bookings.",
                    ],
                });
                await sendEmail(commuter.email, title, html);
            }
        } catch (notifyErr) {
            console.error("[v0] Vehicle removal commuter notification failed:", notifyErr.message);
        }
    }
    summary.commutersNotified = commuterIds.length;

    // Reset the vehicle's own scheduling-availability bookkeeping.
    await B2CPartnerVehicle.findByIdAndUpdate(vehicleId, {
        $set: {
            availabilityStatus: "available",
            availableUntil: null,
            nextScheduledTripTime: null,
            lastAvailabilityUpdate: new Date(),
        },
    });

    console.log(`[v0] Deallocated vehicle ${vId} (reason: ${reason}):`, summary);
    return summary;
};

export const changeRouteDriver = async (req, res) => {
    try {
        const partnerId = req.userId;
        const { routeId } = req.params;
        const { oldDriverId, newDriverId } = req.body;

        if (!newDriverId) {
            return res.status(400).json({ success: false, message: "newDriverId is required" });
        }

        const route = await B2CPartnerRoute.findOne({ _id: routeId, b2cPartnerId: partnerId });
        if (!route) {
            return res.status(404).json({ success: false, message: "Route not found or access denied" });
        }

        // Validate the new driver belongs to this partner (or is the partner themselves).
        const newDriverInfo = await resolveDriverInfo(newDriverId, partnerId);
        if (!newDriverInfo) {
            return res.status(404).json({ success: false, message: "New driver not found or doesn't belong to you" });
        }

        const newDriverIdStr = newDriverId.toString();
        const oldDriverIdStr = oldDriverId ? oldDriverId.toString() : null;
        // Match helper: a slot is affected if it matches the old driver, OR (when
        // no old driver is specified) we replace every driver on the route.
        const matchesOld = (id) => {
            if (!id) return !oldDriverIdStr; // empty slot only replaced in "replace all" mode
            if (!oldDriverIdStr) return true;
            return id.toString() === oldDriverIdStr;
        };

        // 1) Cascade across all schedules + their trip-times for this route.
        const schedules = await B2CPartnerSchedule.find({ routeId, b2cPartnerId: partnerId });
        const scheduleIds = [];
        for (const schedule of schedules) {
            scheduleIds.push(schedule._id);
            let changed = false;

            if (schedule.assignedDriver && matchesOld(schedule.assignedDriver)) {
                schedule.assignedDriver = newDriverId;
                changed = true;
            }
            (schedule.tripTimes || []).forEach((tt) => {
                if (matchesOld(tt.assignedDriver)) {
                    tt.assignedDriver = newDriverId;
                    changed = true;
                }
            });

            if (changed) {
                schedule.markModified("tripTimes");
                await schedule.save();
            }
        }

        // 2) Cascade on the route record itself.
        let routeChanged = false;
        if (route.assignedDriver && matchesOld(route.assignedDriver)) {
            route.assignedDriver = newDriverId;
            routeChanged = true;
        }
        if (route.assignedDriverId && matchesOld(route.assignedDriverId)) {
            route.assignedDriverId = newDriverId;
            routeChanged = true;
        }
        if (routeChanged) await route.save();

        // 3) Cascade to future / not-yet-started generated daily trips.
        const tripFilter = {
            routeId,
            b2cPartnerId: partnerId,
            status: { $in: REASSIGNABLE_TRIP_STATUSES },
        };
        if (oldDriverIdStr) tripFilter.driverId = oldDriverId;
        const tripUpdate = await B2CPartnerTrip.updateMany(tripFilter, {
            $set: {
                driverId: newDriverId,
                "driverInfo.name": newDriverInfo.name,
                "driverInfo.phoneNumber": newDriverInfo.phoneNumber,
                "driverInfo.licenseNumber": newDriverInfo.licenseNumber,
            },
        });

        // 4) Cascade to active commuter bookings on this route's schedules.
        //    Outbound and return legs are updated independently so each booked
        //    trip is served by the freshly-assigned driver.
        const bookingBase = {
            linkedSchedule: { $in: scheduleIds },
            bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
        };
        const driverSnapshot = {
            driverName: newDriverInfo.name,
            driverImage: newDriverInfo.image,
            driverPhoneNumber: newDriverInfo.phoneNumber,
            isSelfDriver: newDriverInfo.isSelfDriver,
        };

        const outboundFilter = { ...bookingBase, outboundTripStatus: { $ne: "COMPLETED" } };
        if (oldDriverIdStr) outboundFilter.outboundDriverId = oldDriverId;
        await B2CPassengerBooking.updateMany(outboundFilter, {
            $set: {
                outboundDriverId: newDriverId,
                outboundIsSelfDriver: newDriverInfo.isSelfDriver,
                assignedDriverId: newDriverId,
                ...driverSnapshot,
            },
        });

        const returnFilter = { ...bookingBase, returnTripStatus: { $ne: "COMPLETED" } };
        if (oldDriverIdStr) returnFilter.returnDriverId = oldDriverId;
        await B2CPassengerBooking.updateMany(returnFilter, {
            $set: {
                returnDriverId: newDriverId,
                returnIsSelfDriver: newDriverInfo.isSelfDriver,
            },
        });

        // 5) Availability bookkeeping + notifications.
        await setDriverBusy(newDriverId, partnerId);
        if (oldDriverIdStr && oldDriverIdStr !== newDriverIdStr) {
            await refreshDriverAvailability(oldDriverId, partnerId);
        }

        // Notify commuters with active bookings about the driver change (real-time + email).
        const affectedBookings = await B2CPassengerBooking.find({
            ...bookingBase,
        }).select("userId").lean();
        const commuterIds = [...new Set(affectedBookings.map((b) => b.userId?.toString()).filter(Boolean))];
        await notifyCommutersOfAssignmentChange({
            userIds: commuterIds,
            route,
            tripLabel: null,
            changeType: "DRIVER_CHANGED",
            newLabel: newDriverInfo.name,
            metadata: { newDriverId },
        });

        // Notify the newly-assigned driver (and the outgoing driver) — real-time + email.
        await notifyDriversOfAssignmentChange({
            partnerId,
            newDriverId,
            oldDriverId,
            route,
            tripLabel: null,
        });

        return res.status(200).json({
            success: true,
            message: "Driver updated successfully across all schedules, trips and bookings",
            tripsUpdated: tripUpdate.modifiedCount,
            newDriver: newDriverInfo,
        });
    } catch (error) {
        console.error("[v0] Error changing route driver:", error.message);
        return res.status(500).json({ success: false, message: "Failed to change driver", error: error.message });
    }
};

export const changeRouteVehicle = async (req, res) => {
    try {
        const partnerId = req.userId;
        const { routeId } = req.params;
        const { oldVehicleId, newVehicleId } = req.body;

        if (!newVehicleId) {
            return res.status(400).json({ success: false, message: "newVehicleId is required" });
        }

        const route = await B2CPartnerRoute.findOne({ _id: routeId, b2cPartnerId: partnerId });
        if (!route) {
            return res.status(404).json({ success: false, message: "Route not found or access denied" });
        }

        const newVehicle = await B2CPartnerVehicle.findOne({ _id: newVehicleId, b2cPartnerId: partnerId })
            .select("model licensePlate seatingCapacity vehicleType status");
        if (!newVehicle) {
            return res.status(404).json({ success: false, message: "New vehicle not found or doesn't belong to you" });
        }

        // Only Active vehicles can be assigned — reject Maintenance / Inactive.
        if (newVehicle.status !== "Active") {
            const stateWord = newVehicle.status === "Maintenance" ? "under maintenance" : "inactive";
            return res.status(400).json({
                success: false,
                message: `${newVehicle.model || "The selected vehicle"}${newVehicle.licensePlate ? ` (${newVehicle.licensePlate})` : ""} is ${stateWord} and cannot be assigned to trips. Please select an active vehicle.`,
            });
        }

        const newVehicleIdStr = newVehicleId.toString();
        const oldVehicleIdStr = oldVehicleId ? oldVehicleId.toString() : null;
        const matchesOld = (id) => {
            if (!id) return !oldVehicleIdStr;
            if (!oldVehicleIdStr) return true;
            return id.toString() === oldVehicleIdStr;
        };

        // 1) Schedules + trip-times.
        const schedules = await B2CPartnerSchedule.find({ routeId, b2cPartnerId: partnerId });
        const scheduleIds = [];
        for (const schedule of schedules) {
            scheduleIds.push(schedule._id);
            let changed = false;
            if (schedule.assignedVehicle && matchesOld(schedule.assignedVehicle)) {
                schedule.assignedVehicle = newVehicleId;
                changed = true;
            }
            (schedule.tripTimes || []).forEach((tt) => {
                if (matchesOld(tt.assignedVehicle)) {
                    tt.assignedVehicle = newVehicleId;
                    changed = true;
                }
            });
            if (changed) {
                schedule.markModified("tripTimes");
                await schedule.save();
            }
        }

        // 2) Route record.
        if (route.assignedVehicle && matchesOld(route.assignedVehicle)) {
            route.assignedVehicle = newVehicleId;
            await route.save();
        }

        // 3) Future / not-yet-started daily trips (+ snapshot).
        const tripFilter = {
            routeId,
            b2cPartnerId: partnerId,
            status: { $in: REASSIGNABLE_TRIP_STATUSES },
        };
        if (oldVehicleIdStr) tripFilter.vehicleId = oldVehicleId;
        const tripUpdate = await B2CPartnerTrip.updateMany(tripFilter, {
            $set: {
                vehicleId: newVehicleId,
                "vehicleInfo.model": newVehicle.model,
                "vehicleInfo.licensePlate": newVehicle.licensePlate,
                "vehicleInfo.seatingCapacity": newVehicle.seatingCapacity,
            },
        });

        // 4) Active commuter bookings (outbound + return legs).
        const bookingBase = {
            linkedSchedule: { $in: scheduleIds },
            bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
        };
        const vehicleSnapshot = {
            vehicleModel: newVehicle.model,
            vehiclePlate: newVehicle.licensePlate,
        };

        const outboundFilter = { ...bookingBase, outboundTripStatus: { $ne: "COMPLETED" } };
        if (oldVehicleIdStr) outboundFilter.outboundVehicleId = oldVehicleId;
        await B2CPassengerBooking.updateMany(outboundFilter, {
            $set: { outboundVehicleId: newVehicleId, ...vehicleSnapshot },
        });

        const returnFilter = { ...bookingBase, returnTripStatus: { $ne: "COMPLETED" } };
        if (oldVehicleIdStr) returnFilter.returnVehicleId = oldVehicleId;
        await B2CPassengerBooking.updateMany(returnFilter, {
            $set: { returnVehicleId: newVehicleId },
        });

        // 5) Availability bookkeeping + notifications.
        await B2CPartnerVehicle.findByIdAndUpdate(newVehicleId, {
            $set: { availabilityStatus: "busy", lastAvailabilityUpdate: new Date() },
        });
        if (oldVehicleIdStr && oldVehicleIdStr !== newVehicleIdStr) {
            await refreshVehicleAvailability(oldVehicleId);
        }

        const affectedBookings = await B2CPassengerBooking.find({ ...bookingBase }).select("userId").lean();
        const newVehicleLabel = `${newVehicle.model} (${newVehicle.licensePlate})`;
        const commuterIds = [...new Set(affectedBookings.map((b) => b.userId?.toString()).filter(Boolean))];
        await notifyCommutersOfAssignmentChange({
            userIds: commuterIds,
            route,
            tripLabel: null,
            changeType: "VEHICLE_CHANGED",
            newLabel: newVehicleLabel,
            metadata: { newVehicleId },
        });

        // Notify every driver currently serving this route about their new vehicle.
        const servingDriverIds = new Set();
        if (route.assignedDriver) servingDriverIds.add(route.assignedDriver.toString());
        if (route.assignedDriverId) servingDriverIds.add(route.assignedDriverId.toString());
        for (const schedule of schedules) {
            if (schedule.assignedDriver) servingDriverIds.add(schedule.assignedDriver.toString());
            (schedule.tripTimes || []).forEach((tt) => {
                if (tt.assignedDriver) servingDriverIds.add(tt.assignedDriver.toString());
            });
        }
        for (const drvId of servingDriverIds) {
            await notifyDriversOfAssignmentChange({
                partnerId,
                newDriverId: drvId,
                oldDriverId: null,
                route,
                tripLabel: null,
                vehicleLabel: newVehicleLabel,
                vehicleOnly: true,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Vehicle updated successfully across all schedules, trips and bookings",
            tripsUpdated: tripUpdate.modifiedCount,
            newVehicle: {
                _id: newVehicle._id,
                model: newVehicle.model,
                licensePlate: newVehicle.licensePlate,
                seatingCapacity: newVehicle.seatingCapacity,
                vehicleType: newVehicle.vehicleType,
            },
        });
    } catch (error) {
        console.error("[v0] Error changing route vehicle:", error.message);
        return res.status(500).json({ success: false, message: "Failed to change vehicle", error: error.message });
    }
};

// ---------------------------------------------------------------------------
// PER-SCHEDULE-TRIP driver / vehicle change.
//
// Unlike changeRouteDriver / changeRouteVehicle (which cascade across the WHOLE
// route), these target ONE specific trip-time inside ONE schedule. This lets a
// partner re-assign, say, only the 11:00 AM One-Way trip without touching the
// 7:00 AM Round Trip that happens to share the same driver/vehicle.
//
// Scoping rule: the daily trips & active bookings that belong to a trip-time are
// matched by that trip-time's start time(s):
//   • One Way    -> [departureTime]
//   • Round Trip -> [departureTime (outbound), arrivalTime (return departure)]
// ---------------------------------------------------------------------------

// Build the list of generated-trip start times that belong to a trip-time.
// ---------------------------------------------------------------------------
// Assignment-change notification helpers (shared by the route-level and
// per-trip change handlers).
//
// When a B2C Partner swaps the DRIVER or VEHICLE on a route/trip, three parties
// must be kept in sync in real time AND by email:
//   1. Every COMMUTER with an active booking/monthly-pass on the affected leg(s)
//      — so they know who/what they'll be travelling with.
//   2. The NEWLY-assigned driver (a B2C_PARTNER_DRIVER user, or the partner if
//      self-driving) — so they know they now serve this route.
//   3. The OUTGOING driver — so they know they were removed from this route.
// ---------------------------------------------------------------------------

// Lightweight inline HTML email wrapper so every assignment email looks
// consistent without pulling in a templating dependency.
const buildAssignmentEmailHtml = ({ heading, greetingName, bodyLines }) => {
    const safe = (v) => (v == null ? "" : String(v));
    const lines = (bodyLines || [])
        .map((l) => `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">${safe(l)}</p>`)
        .join("");
    return `
    <div style="background:#f3f4f6;padding:24px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#0f766e;padding:20px 24px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;">DriveMe</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">${safe(heading)}</h2>
          <p style="margin:0 0 12px;color:#374151;font-size:15px;">Hi ${safe(greetingName) || "there"},</p>
          ${lines}
          <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">This is an automated message from DriveMe. Please do not reply.</p>
        </div>
      </div>
    </div>`;
};

// Resolve the User account + email for a driver so we can notify them in real
// time and by email. For a self-driving partner the driverId IS the partner's
// user id; for a fleet driver we look up the linked B2C_PARTNER_DRIVER user.
const resolveDriverUserAccount = async (driverId, partnerId) => {
    if (!driverId) return null;
    try {
        if (driverId.toString() === partnerId.toString()) {
            const partner = await User.findById(partnerId).select("fullName name email");
            if (!partner) return null;
            return { userId: partner._id, email: partner.email, name: partner.fullName || partner.name || "Driver" };
        }
        // Fleet driver -> linked user account (role B2C_PARTNER_DRIVER).
        const driverUser = await User.findOne({ driverId, role: "B2C_PARTNER_DRIVER" }).select("fullName name email");
        // Fall back to the driver record's own email for the email channel.
        const driverDoc = await B2CPartnerDriver.findById(driverId).select("name email");
        const email = driverUser?.email || driverDoc?.email || null;
        const name = driverUser?.fullName || driverUser?.name || driverDoc?.name || "Driver";
        return { userId: driverUser?._id || null, email, name };
    } catch (err) {
        console.error("[v0] resolveDriverUserAccount failed:", err.message);
        return null;
    }
};

// Notify all affected commuters (real-time + email) about a driver/vehicle change.
const notifyCommutersOfAssignmentChange = async ({ userIds, route, tripLabel, changeType, newLabel, metadata }) => {
    const isDriver = changeType === "DRIVER_CHANGED";
    const legPart = tripLabel ? ` (${tripLabel})` : "";
    const routePart = `${route.fromLocation} → ${route.toLocation}${legPart}`;
    const title = isDriver ? "Driver Updated for Your Trip" : "Vehicle Updated for Your Trip";
    const message = isDriver
        ? `The driver for your ${routePart} trip has been updated to ${newLabel}.`
        : `The vehicle for your ${routePart} trip has been updated to ${newLabel}.`;

    for (const uid of userIds) {
        if (!uid) continue;
        const notification = await createNotification({
            userId: uid,
            type: "ASSIGNMENT_UPDATED",
            title,
            message,
            metadata: { routeId: route._id, changeType, ...(metadata || {}) },
        });
        sendRealTimeNotification(uid, notification);

        // Email (best-effort, never blocks the response).
        try {
            const commuter = await User.findById(uid).select("fullName name email");
            if (commuter?.email) {
                const html = buildAssignmentEmailHtml({
                    heading: title,
                    greetingName: commuter.fullName || commuter.name,
                    bodyLines: [
                        `There has been an update to your monthly pass trip on the <strong>${route.fromLocation} → ${route.toLocation}</strong> route${legPart ? ` for the <strong>${tripLabel}</strong> trip` : ""}.`,
                        isDriver
                            ? `Your new driver is <strong>${newLabel}</strong>.`
                            : `Your new vehicle is <strong>${newLabel}</strong>.`,
                        "You can view the full updated details anytime in the DriveMe app under your bookings.",
                    ],
                });
                await sendEmail(commuter.email, title, html);
            }
        } catch (emailErr) {
            console.error("[v0] Commuter assignment email failed:", emailErr.message);
        }
    }
};

// Notify the newly-assigned driver and (optionally) the outgoing driver.
const notifyDriversOfAssignmentChange = async ({ partnerId, newDriverId, oldDriverId, route, tripLabel, vehicleLabel, vehicleOnly = false }) => {
    const legPart = tripLabel ? ` (${tripLabel})` : "";
    const routePart = `${route.fromLocation} → ${route.toLocation}${legPart}`;

    // --- Newly assigned driver (or the serving driver, for a vehicle-only change) ---
    try {
        const newAcct = await resolveDriverUserAccount(newDriverId, partnerId);
        if (newAcct) {
            const title = vehicleOnly ? "Vehicle Updated for Your Route" : "New Route Assignment";
            const message = vehicleOnly
                ? `The vehicle for your ${routePart} trip has been updated${vehicleLabel ? ` to ${vehicleLabel}` : ""}.`
                : `You have been assigned to the ${routePart} trip.${vehicleLabel ? ` Vehicle: ${vehicleLabel}.` : ""}`;
            if (newAcct.userId) {
                const notification = await createNotification({
                    userId: newAcct.userId,
                    type: "ASSIGNMENT_UPDATED",
                    title,
                    message,
                    metadata: { routeId: route._id, changeType: vehicleOnly ? "VEHICLE_CHANGED" : "DRIVER_ASSIGNED" },
                });
                sendRealTimeNotification(newAcct.userId.toString(), notification);
            }
            if (newAcct.email) {
                const html = buildAssignmentEmailHtml({
                    heading: title,
                    greetingName: newAcct.name,
                    bodyLines: vehicleOnly
                        ? [
                            `The vehicle for the <strong>${route.fromLocation} → ${route.toLocation}</strong> route${legPart ? ` (<strong>${tripLabel}</strong> trip)` : ""} you operate has been updated${vehicleLabel ? ` to <strong>${vehicleLabel}</strong>` : ""}.`,
                            "Please check the DriveMe app for the full schedule and passenger details.",
                        ]
                        : [
                            `You have been assigned to operate the <strong>${route.fromLocation} → ${route.toLocation}</strong> route${legPart ? ` for the <strong>${tripLabel}</strong> trip` : ""}.`,
                            vehicleLabel ? `Assigned vehicle: <strong>${vehicleLabel}</strong>.` : "",
                            "Please check the DriveMe app for the full schedule and passenger details.",
                        ].filter(Boolean),
                });
                await sendEmail(newAcct.email, title, html);
            }
        }
    } catch (err) {
        console.error("[v0] New driver assignment notification failed:", err.message);
    }

    // --- Outgoing driver (only if it actually changed) ---
    try {
        if (oldDriverId && oldDriverId.toString() !== newDriverId.toString()) {
            const oldAcct = await resolveDriverUserAccount(oldDriverId, partnerId);
            if (oldAcct) {
                const title = "Route Assignment Removed";
                const message = `You have been unassigned from the ${routePart} trip.`;
                if (oldAcct.userId) {
                    const notification = await createNotification({
                        userId: oldAcct.userId,
                        type: "ASSIGNMENT_UPDATED",
                        title,
                        message,
                        metadata: { routeId: route._id, changeType: "DRIVER_UNASSIGNED" },
                    });
                    sendRealTimeNotification(oldAcct.userId.toString(), notification);
                }
                if (oldAcct.email) {
                    const html = buildAssignmentEmailHtml({
                        heading: title,
                        greetingName: oldAcct.name,
                        bodyLines: [
                            `You have been unassigned from the <strong>${route.fromLocation} → ${route.toLocation}</strong> route${legPart ? ` for the <strong>${tripLabel}</strong> trip` : ""}.`,
                            "No further action is needed. Check the DriveMe app for your current assignments.",
                        ],
                    });
                    await sendEmail(oldAcct.email, title, html);
                }
            }
        }
    } catch (err) {
        console.error("[v0] Outgoing driver notification failed:", err.message);
    }
};

export const changeTripDriver = async (req, res) => {
    try {
        const partnerId = req.userId;
        const { routeId } = req.params;
        const { scheduleId, tripTimeId, newDriverId } = req.body;
        // Which leg of a Round Trip is being changed: "outbound" (jaane / From→To)
        // or "return" (aane / To→From). One-Way trips only have an outbound leg.
        const legRaw = (req.body.leg || "outbound").toString().toLowerCase();

        if (!scheduleId || !tripTimeId || !newDriverId) {
            return res.status(400).json({ success: false, message: "scheduleId, tripTimeId and newDriverId are required" });
        }

        const route = await B2CPartnerRoute.findOne({ _id: routeId, b2cPartnerId: partnerId });
        if (!route) {
            return res.status(404).json({ success: false, message: "Route not found or access denied" });
        }

        const newDriverInfo = await resolveDriverInfo(newDriverId, partnerId);
        if (!newDriverInfo) {
            return res.status(404).json({ success: false, message: "New driver not found or doesn't belong to you" });
        }

        const schedule = await B2CPartnerSchedule.findOne({ _id: scheduleId, routeId, b2cPartnerId: partnerId });
        if (!schedule) {
            return res.status(404).json({ success: false, message: "Schedule not found or access denied" });
        }

        const tripTime = schedule.tripTimes.id(tripTimeId);
        if (!tripTime) {
            return res.status(404).json({ success: false, message: "Trip time not found in this schedule" });
        }

        const isRoundTrip = tripTime.tripType === "Round Trip" && !!tripTime.arrivalTime;
        const isReturnLeg = isRoundTrip && legRaw === "return";

        // The driver currently serving this specific leg (leg-level → outbound →
        // schedule-level fallback). Freeing the right old driver matters for
        // availability bookkeeping.
        const oldDriverId = isReturnLeg
            ? (tripTime.returnDriver || tripTime.assignedDriver || schedule.assignedDriver || null)
            : (tripTime.assignedDriver || schedule.assignedDriver || null);
        const oldDriverIdStr = oldDriverId ? oldDriverId.toString() : null;
        const newDriverIdStr = newDriverId.toString();

        // 1) Update ONLY the selected leg of this trip-time. The other leg (and
        //    every other trip-time on the route) is left untouched.
        if (isReturnLeg) {
            tripTime.returnDriver = newDriverId;
        } else {
            // Round Trip: before overwriting the OUTBOUND driver, "freeze" the
            // RETURN leg to whatever driver it is currently serving with. The
            // return leg's driver defaults to null and is displayed by falling
            // back to the outbound (assignedDriver) value — so without this
            // freeze, changing the onward driver would make the return leg
            // appear to inherit the new driver too. Freezing keeps each leg
            // fully independent.
            if (isRoundTrip && !tripTime.returnDriver) {
                const currentReturnDriver = tripTime.assignedDriver || schedule.assignedDriver || null;
                if (currentReturnDriver) {
                    tripTime.returnDriver = currentReturnDriver;
                }
            }
            tripTime.assignedDriver = newDriverId;
        }
        schedule.markModified("tripTimes");
        await schedule.save();

        // 2) Cascade to future / not-yet-started generated daily trips for THIS leg only.
        //    Round Trips generate two trips: outbound (startTime = departureTime,
        //    direction "outbound") and return (startTime = arrivalTime, direction
        //    "return"). Scope the update so changing one leg doesn't hit the other.
        const tripFilter = {
            routeId,
            b2cPartnerId: partnerId,
            status: { $in: REASSIGNABLE_TRIP_STATUSES },
        };
        if (isRoundTrip) {
            tripFilter.startTime = isReturnLeg ? tripTime.arrivalTime : tripTime.departureTime;
            tripFilter.direction = isReturnLeg ? "return" : "outbound";
        } else {
            tripFilter.startTime = tripTime.departureTime;
        }
        const tripUpdate = await B2CPartnerTrip.updateMany(tripFilter, {
            $set: {
                driverId: newDriverId,
                "driverInfo.name": newDriverInfo.name,
                "driverInfo.phoneNumber": newDriverInfo.phoneNumber,
                "driverInfo.licenseNumber": newDriverInfo.licenseNumber,
            },
        });

        // 3) Cascade to active commuter bookings linked to THIS schedule's matching leg only.
        const bookingBase = {
            linkedSchedule: scheduleId,
            bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
        };
        const driverSnapshot = {
            driverName: newDriverInfo.name,
            driverImage: newDriverInfo.image,
            driverPhoneNumber: newDriverInfo.phoneNumber,
            isSelfDriver: newDriverInfo.isSelfDriver,
        };

        if (isReturnLeg) {
            // Return leg matches the return departure (arrivalTime).
            await B2CPassengerBooking.updateMany(
                { ...bookingBase, returnTripTime: tripTime.arrivalTime, returnTripStatus: { $ne: "COMPLETED" } },
                {
                    $set: {
                        returnDriverId: newDriverId,
                        returnIsSelfDriver: newDriverInfo.isSelfDriver,
                    },
                },
            );
        } else {
            // Outbound leg matches the trip-time's departure time.
            await B2CPassengerBooking.updateMany(
                { ...bookingBase, outboundTripTime: tripTime.departureTime, outboundTripStatus: { $ne: "COMPLETED" } },
                {
                    $set: {
                        outboundDriverId: newDriverId,
                        outboundIsSelfDriver: newDriverInfo.isSelfDriver,
                        assignedDriverId: newDriverId,
                        ...driverSnapshot,
                    },
                },
            );
        }

        // 4) Availability bookkeeping. Old driver only freed if no other re-assignable trip remains.
        await setDriverBusy(newDriverId, partnerId);
        if (oldDriverIdStr && oldDriverIdStr !== newDriverIdStr) {
            await refreshDriverAvailability(oldDriverId, partnerId);
        }

        // 5) Notify commuters on the affected leg — real-time + email.
        const legBookingMatch = isReturnLeg
            ? { returnTripTime: tripTime.arrivalTime }
            : { outboundTripTime: tripTime.departureTime };
        const affectedBookings = await B2CPassengerBooking.find({ ...bookingBase, ...legBookingMatch })
            .select("userId")
            .lean();
        const legWord = isReturnLeg ? " (Return)" : (isRoundTrip ? " (Onward)" : "");
        const tripLabel =
            (isRoundTrip
                ? `${tripTime.departureTime} → ${tripTime.arrivalTime}`
                : tripTime.departureTime) + legWord;
        const commuterIds = [...new Set(affectedBookings.map((b) => b.userId?.toString()).filter(Boolean))];
        await notifyCommutersOfAssignmentChange({
            userIds: commuterIds,
            route,
            tripLabel,
            changeType: "DRIVER_CHANGED",
            newLabel: newDriverInfo.name,
            metadata: { scheduleId, tripTimeId, newDriverId, leg: isReturnLeg ? "return" : "outbound" },
        });

        // 6) Notify the newly-assigned driver (and the outgoing driver) — real-time + email.
        await notifyDriversOfAssignmentChange({
            partnerId,
            newDriverId,
            oldDriverId,
            route,
            tripLabel,
        });

        return res.status(200).json({
            success: true,
            message: `Driver updated for the ${isReturnLeg ? "return" : "onward"} leg of this schedule trip.`,
            tripsUpdated: tripUpdate.modifiedCount,
            newDriver: newDriverInfo,
        });
    } catch (error) {
        console.error("[v0] Error changing trip driver:", error.message);
        return res.status(500).json({ success: false, message: "Failed to change driver", error: error.message });
    }
};

export const changeTripVehicle = async (req, res) => {
    try {
        const partnerId = req.userId;
        const { routeId } = req.params;
        const { scheduleId, tripTimeId, newVehicleId } = req.body;
        // Which leg of a Round Trip is being changed: "outbound" or "return".
        const legRaw = (req.body.leg || "outbound").toString().toLowerCase();

        if (!scheduleId || !tripTimeId || !newVehicleId) {
            return res.status(400).json({ success: false, message: "scheduleId, tripTimeId and newVehicleId are required" });
        }

        const route = await B2CPartnerRoute.findOne({ _id: routeId, b2cPartnerId: partnerId });
        if (!route) {
            return res.status(404).json({ success: false, message: "Route not found or access denied" });
        }

        const newVehicle = await B2CPartnerVehicle.findOne({ _id: newVehicleId, b2cPartnerId: partnerId })
            .select("model licensePlate seatingCapacity vehicleType status");
        if (!newVehicle) {
            return res.status(404).json({ success: false, message: "New vehicle not found or doesn't belong to you" });
        }

        // Only Active vehicles can be assigned — reject Maintenance / Inactive.
        if (newVehicle.status !== "Active") {
            const stateWord = newVehicle.status === "Maintenance" ? "under maintenance" : "inactive";
            return res.status(400).json({
                success: false,
                message: `${newVehicle.model || "The selected vehicle"}${newVehicle.licensePlate ? ` (${newVehicle.licensePlate})` : ""} is ${stateWord} and cannot be assigned to trips. Please select an active vehicle.`,
            });
        }

        const schedule = await B2CPartnerSchedule.findOne({ _id: scheduleId, routeId, b2cPartnerId: partnerId });
        if (!schedule) {
            return res.status(404).json({ success: false, message: "Schedule not found or access denied" });
        }

        const tripTime = schedule.tripTimes.id(tripTimeId);
        if (!tripTime) {
            return res.status(404).json({ success: false, message: "Trip time not found in this schedule" });
        }

        const isRoundTrip = tripTime.tripType === "Round Trip" && !!tripTime.arrivalTime;
        const isReturnLeg = isRoundTrip && legRaw === "return";

        const oldVehicleId = isReturnLeg
            ? (tripTime.returnVehicle || tripTime.assignedVehicle || schedule.assignedVehicle || null)
            : (tripTime.assignedVehicle || schedule.assignedVehicle || null);
        const oldVehicleIdStr = oldVehicleId ? oldVehicleId.toString() : null;
        const newVehicleIdStr = newVehicleId.toString();

        // 1) Update ONLY the selected leg of this trip-time.
        if (isReturnLeg) {
            tripTime.returnVehicle = newVehicleId;
        } else {
            // Round Trip: freeze the RETURN leg's current vehicle before
            // overwriting the OUTBOUND one, so the return leg does not appear to
            // inherit the new outbound vehicle via its null → outbound fallback.
            // This keeps each leg's vehicle assignment independent.
            if (isRoundTrip && !tripTime.returnVehicle) {
                const currentReturnVehicle = tripTime.assignedVehicle || schedule.assignedVehicle || null;
                if (currentReturnVehicle) {
                    tripTime.returnVehicle = currentReturnVehicle;
                }
            }
            tripTime.assignedVehicle = newVehicleId;
        }
        schedule.markModified("tripTimes");
        await schedule.save();

        // 2) Cascade to future / not-yet-started generated daily trips for THIS leg only.
        const tripFilter = {
            routeId,
            b2cPartnerId: partnerId,
            status: { $in: REASSIGNABLE_TRIP_STATUSES },
        };
        if (isRoundTrip) {
            tripFilter.startTime = isReturnLeg ? tripTime.arrivalTime : tripTime.departureTime;
            tripFilter.direction = isReturnLeg ? "return" : "outbound";
        } else {
            tripFilter.startTime = tripTime.departureTime;
        }
        const tripUpdate = await B2CPartnerTrip.updateMany(tripFilter, {
            $set: {
                vehicleId: newVehicleId,
                "vehicleInfo.model": newVehicle.model,
                "vehicleInfo.licensePlate": newVehicle.licensePlate,
                "vehicleInfo.seatingCapacity": newVehicle.seatingCapacity,
            },
        });

        // 3) Cascade to active commuter bookings linked to THIS schedule's matching leg only.
        const bookingBase = {
            linkedSchedule: scheduleId,
            bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
        };
        const vehicleSnapshot = {
            vehicleModel: newVehicle.model,
            vehiclePlate: newVehicle.licensePlate,
        };

        if (isReturnLeg) {
            await B2CPassengerBooking.updateMany(
                { ...bookingBase, returnTripTime: tripTime.arrivalTime, returnTripStatus: { $ne: "COMPLETED" } },
                { $set: { returnVehicleId: newVehicleId } },
            );
        } else {
            await B2CPassengerBooking.updateMany(
                { ...bookingBase, outboundTripTime: tripTime.departureTime, outboundTripStatus: { $ne: "COMPLETED" } },
                { $set: { outboundVehicleId: newVehicleId, ...vehicleSnapshot } },
            );
        }

        // 4) Availability bookkeeping.
        await B2CPartnerVehicle.findByIdAndUpdate(newVehicleId, {
            $set: { availabilityStatus: "busy", lastAvailabilityUpdate: new Date() },
        });
        if (oldVehicleIdStr && oldVehicleIdStr !== newVehicleIdStr) {
            await refreshVehicleAvailability(oldVehicleId);
        }

        // 5) Notify commuters on the affected leg �� real-time + email.
        const legBookingMatch = isReturnLeg
            ? { returnTripTime: tripTime.arrivalTime }
            : { outboundTripTime: tripTime.departureTime };
        const affectedBookings = await B2CPassengerBooking.find({ ...bookingBase, ...legBookingMatch })
            .select("userId")
            .lean();
        const legWord = isReturnLeg ? " (Return)" : (isRoundTrip ? " (Onward)" : "");
        const tripLabel =
            (isRoundTrip
                ? `${tripTime.departureTime} → ${tripTime.arrivalTime}`
                : tripTime.departureTime) + legWord;
        const newVehicleLabel = `${newVehicle.model} (${newVehicle.licensePlate})`;
        const commuterIds = [...new Set(affectedBookings.map((b) => b.userId?.toString()).filter(Boolean))];
        await notifyCommutersOfAssignmentChange({
            userIds: commuterIds,
            route,
            tripLabel,
            changeType: "VEHICLE_CHANGED",
            newLabel: newVehicleLabel,
            metadata: { scheduleId, tripTimeId, newVehicleId, leg: isReturnLeg ? "return" : "outbound" },
        });

        // 6) Notify the driver currently serving this leg about their new vehicle.
        const servingDriverId = isReturnLeg
            ? (tripTime.returnDriver || tripTime.assignedDriver || schedule.assignedDriver || null)
            : (tripTime.assignedDriver || schedule.assignedDriver || null);
        if (servingDriverId) {
            await notifyDriversOfAssignmentChange({
                partnerId,
                newDriverId: servingDriverId,
                oldDriverId: null,
                route,
                tripLabel,
                vehicleLabel: newVehicleLabel,
                vehicleOnly: true,
            });
        }

        return res.status(200).json({
            success: true,
            message: `Vehicle updated for the ${isReturnLeg ? "return" : "onward"} leg of this schedule trip.`,
            tripsUpdated: tripUpdate.modifiedCount,
            newVehicle: {
                _id: newVehicle._id,
                model: newVehicle.model,
                licensePlate: newVehicle.licensePlate,
                seatingCapacity: newVehicle.seatingCapacity,
                vehicleType: newVehicle.vehicleType,
            },
        });
    } catch (error) {
        console.error("[v0] Error changing trip vehicle:", error.message);
        return res.status(500).json({ success: false, message: "Failed to change vehicle", error: error.message });
    }
};
