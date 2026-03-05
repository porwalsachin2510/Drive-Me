import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";

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

        console.log("[v0] Daily trip generation completed");

    } catch (error) {
        console.error("[v0] Error in daily trip generation:", error.message);
    }
};

// Generate trips for a specific schedule
export const generateTripsForSchedule = async (scheduleId, daysAhead = 7) => {
    try {
        const schedule = await B2CPartnerSchedule.findById(scheduleId)
            .populate('routeId')
            .populate('assignedVehicle')
            .populate('assignedDriver');

        if (!schedule || !schedule.isActive || schedule.status !== "Active") {
            return { success: false, message: "Schedule not active" };
        }

        // Skip trip generation if no driver or vehicle assigned
        if (!schedule.assignedDriver && !schedule.assignedVehicle) {
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
                for (const tripTime of schedule.tripTimes) {
                    const tripDate = new Date(date);
                    
                    // For Round Trip, generate separate trips for outbound and return
                    if (tripTime.tripType === "Round Trip") {
                        // Generate Outbound Trip
                        const outboundTripData = {
                            b2cPartnerId: schedule.b2cPartnerId,
                            routeId: schedule.routeId._id,
                            scheduleId: scheduleId,
                            tripDate: tripDate,
                            startTime: tripTime.departureTime,
                            endTime: tripTime.arrivalTime,
                            vehicleId: schedule.assignedVehicle?._id,
                            driverId: schedule.assignedDriver?._id,
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
                            driverInfo: schedule.assignedDriver ? {
                                name: schedule.assignedDriver.name,
                                phoneNumber: schedule.assignedDriver.phoneNumber,
                                licenseNumber: schedule.assignedDriver.licenseNumber
                            } : {},
                            vehicleInfo: schedule.assignedVehicle ? {
                                model: schedule.assignedVehicle.model,
                                licensePlate: schedule.assignedVehicle.licensePlate,
                                seatingCapacity: schedule.assignedVehicle.seatingCapacity
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
                                vehicleId: schedule.assignedVehicle?._id,
                                driverId: schedule.assignedDriver?._id,
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
                                driverInfo: schedule.assignedDriver ? {
                                    name: schedule.assignedDriver.name,
                                    phoneNumber: schedule.assignedDriver.phoneNumber,
                                    licenseNumber: schedule.assignedDriver.licenseNumber
                                } : {},
                                vehicleInfo: schedule.assignedVehicle ? {
                                    model: schedule.assignedVehicle.model,
                                    licensePlate: schedule.assignedVehicle.licensePlate,
                                    seatingCapacity: schedule.assignedVehicle.seatingCapacity
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
                        const tripData = {
                            b2cPartnerId: schedule.b2cPartnerId,
                            routeId: schedule.routeId._id,
                            scheduleId: scheduleId,
                            tripDate: tripDate,
                            startTime: tripTime.departureTime,
                            endTime: tripTime.arrivalTime,
                            vehicleId: schedule.assignedVehicle?._id,
                            driverId: schedule.assignedDriver?._id,
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
                            driverInfo: schedule.assignedDriver ? {
                                name: schedule.assignedDriver.name,
                                phoneNumber: schedule.assignedDriver.phoneNumber,
                                licenseNumber: schedule.assignedDriver.licenseNumber
                            } : {},
                            vehicleInfo: schedule.assignedVehicle ? {
                                model: schedule.assignedVehicle.model,
                                licensePlate: schedule.assignedVehicle.licensePlate,
                                seatingCapacity: schedule.assignedVehicle.seatingCapacity
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
