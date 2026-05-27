import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// Daily trip generation service
export const generateDailyTrips = async () => {
    try {
        console.log("[v0] Starting daily trip generation...");

        let today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find all active schedules that need trips generated for tomorrow
        const schedules = await B2CPartnerSchedule.find({
            isActive: true,
            status: "Active",
            $or: [
                { nextTripGeneration: { $lte: tomorrow } },
                { nextTripGeneration: { $exists: false } }
            ]
        })
            .populate('routeId')
            .populate('assignedVehicle')
            .populate('assignedDriver');

        console.log(`[v0] Found ${schedules.length} schedules to process`);

        for (const schedule of schedules) {
            await generateTripsForSchedule(schedule._id, 7);
        }

        // After generating trips, update driver/vehicle availability for today's trips
        await updateDriverVehicleAvailabilityForToday();

        console.log("[v0] Daily trip generation completed");

    } catch (error) {
        console.error("[v0] Error in daily trip generation:", error.message);
    }
};

// Generate trips for a specific schedule
export const generateTripsForSchedule = async (scheduleId, daysAhead = 7) => {
    try {
        // First, get the raw schedule to access unpopulated ObjectIds
        const rawSchedule = await B2CPartnerSchedule.findById(scheduleId).lean();

        const schedule = await B2CPartnerSchedule.findById(scheduleId)
            .populate('routeId')
            .populate('assignedVehicle')
            .populate('assignedDriver')
            .populate('tripTimes.assignedDriver')
            .populate('tripTimes.assignedVehicle');

        if (!schedule || !schedule.isActive || schedule.status !== "Active") {
            return { success: false, message: "Schedule not active" };
        }

        // Check if ANY driver/vehicle is assigned (schedule-level or per-trip)
        const hasAnyDriver = schedule.assignedDriver || schedule.tripTimes.some(t => t.assignedDriver);
        const hasAnyVehicle = schedule.assignedVehicle || schedule.tripTimes.some(t => t.assignedVehicle);

        if (!hasAnyDriver && !hasAnyVehicle) {
            console.log(`[v0] Skipping trip generation for schedule ${scheduleId} - no driver or vehicle assigned`);
            return { success: false, message: "No driver or vehicle assigned to schedule" };
        }

        // Get route start date to avoid generating trips before route creation
        const routeStartDate = new Date(schedule.routeId.routeStartDate || schedule.startDate || Date.now());
        routeStartDate.setHours(0, 0, 0, 0);

        // Start from tomorrow for proper preparation time
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Always start from tomorrow to give preparation time
        const startDate = routeStartDate > tomorrow ? routeStartDate : tomorrow;

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + daysAhead);

        // Get available days for this schedule
        const availableDays = schedule.availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
        const dayMap = { "SUN": 0, "MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6 };

        console.log(`[v0] Starting trip generation for schedule ${scheduleId}`);
        console.log(`[v0] Route start date: ${routeStartDate.toDateString()}`);
        console.log(`[v0] Today: ${today.toDateString()}`);
        console.log(`[v0] Generation start date (tomorrow): ${startDate.toDateString()}`);
        console.log(`[v0] Generation end date: ${endDate.toDateString()}`);
        console.log(`[v0] Available days: ${availableDays.join(', ')}`);
        console.log(`[v0] Note: Trips start from tomorrow for preparation time`);
        console.log(`[v0] Schedule tripTimes:`, JSON.stringify(schedule.tripTimes, null, 2));

        let generatedTrips = [];

        // Generate trips for each day in the range (starting from tomorrow for preparation time)
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dayName = Object.keys(dayMap).find(key => dayMap[key] === date.getDay());

            // Check if this day is in available days
            if (availableDays.includes(dayName)) {
                // Generate multiple trips for this day based on tripTimes
                for (let tripIdx = 0; tripIdx < schedule.tripTimes.length; tripIdx++) {
                    const tripTime = schedule.tripTimes[tripIdx];
                    // Get the raw tripTime to access unpopulated ObjectIds (needed for "Self" driver which is a User ID)
                    const rawTripTime = rawSchedule.tripTimes[tripIdx];
                    const tripDate = new Date(date);

                    // For Round Trip, generate separate trips for outbound and return
                    if (tripTime.tripType === "Round Trip") {
                        // Use per-trip driver/vehicle if assigned, otherwise fall back to schedule-level
                        // IMPORTANT: If populate failed (driver is a User ID, not B2CPartnerDriver), use the raw ObjectId
                        let effectiveDriverId;
                        if (tripTime.assignedDriver?._id) {
                            // Populated B2CPartnerDriver
                            effectiveDriverId = tripTime.assignedDriver._id;
                        } else if (rawTripTime.assignedDriver) {
                            // Raw ObjectId (could be User ID for "Self" driver)
                            effectiveDriverId = rawTripTime.assignedDriver;
                        } else if (schedule.assignedDriver?._id) {
                            // Fallback to schedule-level populated driver
                            effectiveDriverId = schedule.assignedDriver._id;
                        } else if (rawSchedule.assignedDriver) {
                            // Fallback to schedule-level raw ObjectId
                            effectiveDriverId = rawSchedule.assignedDriver;
                        }

                        let effectiveVehicleId;
                        if (tripTime.assignedVehicle?._id) {
                            effectiveVehicleId = tripTime.assignedVehicle._id;
                        } else if (rawTripTime.assignedVehicle) {
                            effectiveVehicleId = rawTripTime.assignedVehicle;
                        } else if (schedule.assignedVehicle?._id) {
                            effectiveVehicleId = schedule.assignedVehicle._id;
                        } else if (rawSchedule.assignedVehicle) {
                            effectiveVehicleId = rawSchedule.assignedVehicle;
                        }

                        const effectiveDriver = tripTime.assignedDriver || schedule.assignedDriver;
                        const effectiveVehicle = tripTime.assignedVehicle || schedule.assignedVehicle;

                        // If driver didn't populate (Self-driver case), fetch from User model
                        let driverInfoObj = {};
                        if (effectiveDriver?.name) {
                            driverInfoObj = {
                                name: effectiveDriver.name,
                                phoneNumber: effectiveDriver.phoneNumber,
                                licenseNumber: effectiveDriver.licenseNumber
                            };
                        } else if (effectiveDriverId) {
                            // Try to fetch from User model (Self-driver)
                            const userDriver = await User.findById(effectiveDriverId).select('fullName whatsappNumber').lean();
                            if (userDriver) {
                                driverInfoObj = {
                                    name: userDriver.fullName || 'Self',
                                    phoneNumber: userDriver.whatsappNumber || '',
                                    licenseNumber: null
                                };
                            }
                        }

                        // Generate Outbound Trip
                        const outboundTripData = {
                            b2cPartnerId: schedule.b2cPartnerId,
                            routeId: schedule.routeId._id,
                            scheduleId: scheduleId,
                            tripDate: tripDate,
                            startTime: tripTime.departureTime,
                            endTime: tripTime.arrivalTime,
                            vehicleId: effectiveVehicleId,
                            driverId: effectiveDriverId,
                            tripType: "One Way",
                            fromLocation: schedule.routeId.fromLocation,
                            toLocation: schedule.routeId.toLocation,
                            totalSeats: schedule.routeId.totalSeats,
                            availableSeats: schedule.routeId.availableSeats,
                            pricing: schedule.routeId.pricing,
                            status: "Scheduled",
                            stopPoints: tripTime.outboundStopPoints ? tripTime.outboundStopPoints.map(stop => ({
                                location: stop.location,
                                scheduledTime: stop.time,
                                actualTime: ""
                            })) : [],
                            driverInfo: driverInfoObj,
                            vehicleInfo: effectiveVehicle ? {
                                model: effectiveVehicle.model,
                                licensePlate: effectiveVehicle.licensePlate,
                                seatingCapacity: effectiveVehicle.seatingCapacity
                            } : {}
                        };

                        // Check if outbound trip already exists
                        const existingOutboundTrip = await B2CPartnerTrip.findOne({
                            scheduleId: scheduleId,
                            tripDate: tripDate,
                            startTime: tripTime.departureTime,
                            b2cPartnerId: schedule.b2cPartnerId
                        });

                        if (!existingOutboundTrip) {
                            const outboundTrip = await B2CPartnerTrip.create(outboundTripData);
                            generatedTrips.push(outboundTrip);
                            console.log(`[v0] Generated OUTBOUND trip for ${tripDate.toDateString()} at ${tripTime.departureTime}`);
                        }

                        // Generate Return Trip (if return time is specified)
                        if (tripTime.arrivalTime) {
                            console.log(`[v0] Processing return trip for ${tripDate.toDateString()} at ${tripTime.arrivalTime}`);
                            console.log(`[v0] Return trip from ${schedule.routeId.toLocation} to ${schedule.routeId.fromLocation}`);

                            const returnTripData = {
                                b2cPartnerId: schedule.b2cPartnerId,
                                routeId: schedule.routeId._id,
                                scheduleId: scheduleId,
                                tripDate: tripDate,
                                startTime: tripTime.arrivalTime,
                                endTime: tripTime.departureTime,
                                vehicleId: effectiveVehicleId,
                                driverId: effectiveDriverId,
                                tripType: "One Way",
                                fromLocation: schedule.routeId.toLocation,
                                toLocation: schedule.routeId.fromLocation,
                                totalSeats: schedule.routeId.totalSeats,
                                availableSeats: schedule.routeId.availableSeats,
                                pricing: schedule.routeId.pricing,
                                status: "Scheduled",
                                stopPoints: tripTime.returnStopPoints ? tripTime.returnStopPoints.map(stop => ({
                                    location: stop.location,
                                    scheduledTime: stop.time,
                                    actualTime: ""
                                })) : [],
                                driverInfo: driverInfoObj,
                                vehicleInfo: effectiveVehicle ? {
                                    model: effectiveVehicle.model,
                                    licensePlate: effectiveVehicle.licensePlate,
                                    seatingCapacity: effectiveVehicle.seatingCapacity
                                } : {}
                            };

                            // Check if return trip already exists
                            const existingReturnTrip = await B2CPartnerTrip.findOne({
                                scheduleId: scheduleId,
                                tripDate: tripDate,
                                startTime: tripTime.arrivalTime,
                                b2cPartnerId: schedule.b2cPartnerId
                            });

                            if (!existingReturnTrip) {
                                const returnTrip = await B2CPartnerTrip.create(returnTripData);
                                generatedTrips.push(returnTrip);
                                console.log(`[v0] Generated RETURN trip for ${tripDate.toDateString()} at ${tripTime.arrivalTime}`);
                            } else {
                                console.log(`[v0] Return trip already exists for ${tripDate.toDateString()} at ${tripTime.arrivalTime}`);
                            }
                        } else {
                            console.log(`[v0] No arrival time for tripTime, skipping return trip generation`);
                        }
                    } else {
                        // For One Way, generate single trip
                        // Use per-trip driver/vehicle if assigned, otherwise fall back to schedule-level
                        // IMPORTANT: If populate failed (driver is a User ID, not B2CPartnerDriver), use the raw ObjectId
                        let effectiveDriverId;
                        if (tripTime.assignedDriver?._id) {
                            effectiveDriverId = tripTime.assignedDriver._id;
                        } else if (rawTripTime.assignedDriver) {
                            effectiveDriverId = rawTripTime.assignedDriver;
                        } else if (schedule.assignedDriver?._id) {
                            effectiveDriverId = schedule.assignedDriver._id;
                        } else if (rawSchedule.assignedDriver) {
                            effectiveDriverId = rawSchedule.assignedDriver;
                        }

                        let effectiveVehicleId;
                        if (tripTime.assignedVehicle?._id) {
                            effectiveVehicleId = tripTime.assignedVehicle._id;
                        } else if (rawTripTime.assignedVehicle) {
                            effectiveVehicleId = rawTripTime.assignedVehicle;
                        } else if (schedule.assignedVehicle?._id) {
                            effectiveVehicleId = schedule.assignedVehicle._id;
                        } else if (rawSchedule.assignedVehicle) {
                            effectiveVehicleId = rawSchedule.assignedVehicle;
                        }

                        const effectiveDriver = tripTime.assignedDriver || schedule.assignedDriver;
                        const effectiveVehicle = tripTime.assignedVehicle || schedule.assignedVehicle;

                        // If driver didn't populate (Self-driver case), fetch from User model
                        let oneWayDriverInfoObj = {};
                        if (effectiveDriver?.name) {
                            oneWayDriverInfoObj = {
                                name: effectiveDriver.name,
                                phoneNumber: effectiveDriver.phoneNumber,
                                licenseNumber: effectiveDriver.licenseNumber
                            };
                        } else if (effectiveDriverId) {
                            // Try to fetch from User model (Self-driver)
                            const userDriver = await User.findById(effectiveDriverId).select('fullName whatsappNumber').lean();
                            if (userDriver) {
                                oneWayDriverInfoObj = {
                                    name: userDriver.fullName || 'Self',
                                    phoneNumber: userDriver.whatsappNumber || '',
                                    licenseNumber: null
                                };
                            }
                        }

                        const tripData = {
                            b2cPartnerId: schedule.b2cPartnerId,
                            routeId: schedule.routeId._id,
                            scheduleId: scheduleId,
                            tripDate: tripDate,
                            startTime: tripTime.departureTime,
                            endTime: tripTime.arrivalTime,
                            vehicleId: effectiveVehicleId,
                            driverId: effectiveDriverId,
                            tripType: "One Way",
                            fromLocation: schedule.routeId.fromLocation,
                            toLocation: schedule.routeId.toLocation,
                            totalSeats: schedule.routeId.totalSeats,
                            availableSeats: schedule.routeId.availableSeats,
                            pricing: schedule.routeId.pricing,
                            status: "Scheduled",
                            stopPoints: tripTime.outboundStopPoints ? tripTime.outboundStopPoints.map(stop => ({
                                location: stop.location,
                                scheduledTime: stop.time,
                                actualTime: ""
                            })) : [],
                            driverInfo: oneWayDriverInfoObj,
                            vehicleInfo: effectiveVehicle ? {
                                model: effectiveVehicle.model,
                                licensePlate: effectiveVehicle.licensePlate,
                                seatingCapacity: effectiveVehicle.seatingCapacity
                            } : {}
                        };

                        const existingTrip = await B2CPartnerTrip.findOne({
                            scheduleId: scheduleId,
                            tripDate: tripDate,
                            startTime: tripTime.departureTime,
                            b2cPartnerId: schedule.b2cPartnerId
                        });

                        if (!existingTrip) {
                            const trip = await B2CPartnerTrip.create(tripData);
                            generatedTrips.push(trip);
                            console.log(`[v0] Generated OUTBOUND trip for ${tripDate.toDateString()} at ${tripTime.departureTime}`);
                        }
                    }
                }
            }
        }

        // Update schedule's next trip generation date
        const nextGeneration = new Date(endDate);
        nextGeneration.setDate(nextGeneration.getDate() + 1);

        await B2CPartnerSchedule.findByIdAndUpdate(scheduleId, {
            nextTripGeneration: nextGeneration
        });

        console.log(`[v0] Generated ${generatedTrips.length} trips for schedule ${scheduleId}`);
        console.log(`[v0] Next trip generation scheduled for: ${nextGeneration.toDateString()}`);

        return {
            success: true,
            message: `Generated ${generatedTrips.length} trips`,
            generatedTrips,
            nextGenerationDate: nextGeneration
        };

    } catch (error) {
        console.error(`[v0] Error generating trips for schedule ${scheduleId}:`, error);
        return { success: false, message: error.message };
    }
};

// Update driver and vehicle availability based on today's scheduled trips
// This should be called daily to ensure drivers/vehicles with trips are marked as 'busy'
export const updateDriverVehicleAvailabilityForToday = async () => {
    try {
        console.log("[v0] Starting daily availability status update...");

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Find all trips scheduled for today with bookings (bookedSeats > 0)
        const todaysTrips = await B2CPartnerTrip.find({
            tripDate: { $gte: todayStart, $lte: todayEnd },
            bookedSeats: { $gt: 0 },
            status: { $in: ['SCHEDULED', 'Scheduled'] }
        }).lean();

        console.log(`[v0] Found ${todaysTrips.length} trips with bookings for today`);

        // Collect unique driver IDs and vehicle IDs
        const driverIds = new Set();
        const vehicleIds = new Set();
        const selfDriverPartnerIds = new Set();

        for (const trip of todaysTrips) {
            if (trip.driverId) {
                driverIds.add(trip.driverId.toString());
            }
            if (trip.vehicleId) {
                vehicleIds.add(trip.vehicleId.toString());
            }
            if (trip.b2cPartnerId) {
                // Check if this is a self-driver partner
                const driverIdStr = trip.driverId?.toString();
                const partnerIdStr = trip.b2cPartnerId?.toString();
                if (driverIdStr === partnerIdStr) {
                    selfDriverPartnerIds.add(partnerIdStr);
                }
            }
        }

        console.log(`[v0] Unique drivers with trips today: ${driverIds.size}`);
        console.log(`[v0] Unique vehicles with trips today: ${vehicleIds.size}`);
        console.log(`[v0] Self-driver partners with trips today: ${selfDriverPartnerIds.size}`);

        // Update B2CPartnerDriver status to 'busy'
        for (const driverId of driverIds) {
            // Check if this is a B2CPartnerDriver or a User (self-driver)
            const driver = await B2CPartnerDriver.findById(driverId);
            if (driver) {
                // Only update if currently available (don't override offline or other statuses)
                if (driver.availabilityStatus === 'available') {
                    driver.availabilityStatus = 'busy';
                    driver.lastAvailabilityUpdate = new Date();
                    await driver.save();
                    console.log(`[v0] Set B2CPartnerDriver ${driverId} to busy`);
                }
            }
        }

        // Update self-driver partners (Users) status to 'busy'
        for (const partnerId of selfDriverPartnerIds) {
            const user = await User.findById(partnerId);
            if (user && user.role === 'B2C_PARTNER') {
                user.selfDriverAvailability = user.selfDriverAvailability || {};
                // Only update if currently available (don't override offline or other statuses)
                if (user.selfDriverAvailability.status === 'available') {
                    user.selfDriverAvailability.status = 'busy';
                    user.selfDriverAvailability.lastUpdate = new Date();
                    await user.save();
                    console.log(`[v0] Set B2C Partner (self-driver) ${partnerId} to busy`);
                }
            }
        }

        // Update B2CPartnerVehicle status to 'busy'
        for (const vehicleId of vehicleIds) {
            const vehicle = await B2CPartnerVehicle.findById(vehicleId);
            if (vehicle) {
                // Only update if currently available (don't override maintenance or other statuses)
                if (vehicle.availabilityStatus === 'available') {
                    vehicle.availabilityStatus = 'busy';
                    vehicle.lastAvailabilityUpdate = new Date();
                    await vehicle.save();
                    console.log(`[v0] Set B2CPartnerVehicle ${vehicleId} to busy`);
                }
            }
        }

        console.log("[v0] Daily availability status update completed");

        return {
            success: true,
            message: "Availability status updated for today's trips",
            driversUpdated: driverIds.size,
            vehiclesUpdated: vehicleIds.size,
            selfDriverPartnersUpdated: selfDriverPartnerIds.size
        };

    } catch (error) {
        console.error("[v0] Error updating daily availability status:", error);
        return { success: false, message: error.message };
    }
};

// Check and update availability for a specific driver based on their trips
export const updateDriverAvailabilityForTrips = async (driverId, isSelfDriver = false) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Check if driver has any scheduled or in-progress trips today
        const tripCount = await B2CPartnerTrip.countDocuments({
            driverId: driverId,
            tripDate: { $gte: todayStart, $lte: todayEnd },
            bookedSeats: { $gt: 0 },
            status: { $in: ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress'] }
        });

        if (tripCount > 0) {
            if (isSelfDriver) {
                // Update User (self-driver partner)
                await User.findByIdAndUpdate(driverId, {
                    'selfDriverAvailability.status': 'busy',
                    'selfDriverAvailability.lastUpdate': new Date()
                });
            } else {
                // Update B2CPartnerDriver
                await B2CPartnerDriver.findByIdAndUpdate(driverId, {
                    availabilityStatus: 'busy',
                    lastAvailabilityUpdate: new Date()
                });
            }
            console.log(`[v0] Driver ${driverId} set to busy (has ${tripCount} trips today)`);
            return { status: 'busy', tripCount };
        }

        return { status: 'no_change', tripCount: 0 };

    } catch (error) {
        console.error(`[v0] Error updating driver availability for ${driverId}:`, error);
        return { status: 'error', message: error.message };
    }
};
