import Trip from "../models/Trip.js";
import Route from "../models/Route.js";
import Contract from "../models/Contract.js";
import VehicleAssignment from "../models/VehicleAssignment.js";

// Generate daily trips for corporate routes
export const generateCorporateDailyTrips = async () => {
    try {
        console.log("[v0] Starting corporate daily trip generation...");
        
        // Get tomorrow's date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find all active contracts with vehicle assignments
        const activeVehicleAssignments = await VehicleAssignment.find({
            status: "Active",
            endDate: { $gte: tomorrow }
        })
            .populate('contractId')
            .populate('routeId')
            .populate('vehicleId')
            .populate('assignedDriverId');

        console.log(`[v0] Found ${activeVehicleAssignments.length} active vehicle assignments`);

        for (const assignment of activeVehicleAssignments) {
            if (!assignment.routeId || !assignment.contractId) continue;

            // Get route schedules
            const route = assignment.routeId;
            const schedules = route.schedules || [];

            // Generate trips for each schedule
            for (const schedule of schedules) {
                await generateTripsForCorporateSchedule(assignment, schedule, tomorrow);
            }
        }

        console.log("[v0] Corporate daily trip generation completed");

    } catch (error) {
        console.error("[v0] Error in corporate trip generation:", error.message);
    }
};

// Generate trips for a specific corporate schedule
async function generateTripsForCorporateSchedule(assignment, schedule, targetDate) {
    try {
        const route = assignment.routeId;
        const contract = assignment.contractId;
        const vehicle = assignment.vehicleId;
        const driver = assignment.assignedDriverId;

        if (!schedule.daysOfWeek || !schedule.daysOfWeek.length) {
            console.log(`[v0] No days configured for route ${route._id}`);
            return;
        }

        // Check if trip already exists for this date
        const existingTrip = await Trip.findOne({
            contractId: contract._id,
            routeId: route._id,
            vehicleId: vehicle._id,
            tripDate: targetDate,
            scheduleIndex: schedule.scheduleIndex || 0
        });

        if (existingTrip) {
            console.log(`[v0] Trip already exists for ${targetDate.toDateString()}`);
            return;
        }

        // Check if target date matches schedule days
        const dayIndex = targetDate.getDay();
        const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayIndex];

        if (!schedule.daysOfWeek.includes(dayName)) {
            console.log(`[v0] ${dayName} not in schedule for route ${route._id}`);
            return;
        }

        // Create trip
        const tripData = {
            contractId: contract._id,
            routeId: route._id,
            vehicleId: vehicle._id,
            driverId: driver ? driver._id : null,
            corporateId: contract.clientId,
            b2bPartnerId: contract.partnerId,
            tripDate: targetDate,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            tripType: schedule.tripType || "ONE_WAY",
            direction: "FORWARD",
            scheduleIndex: schedule.scheduleIndex || 0,
            fromLocation: route.fromLocation,
            toLocation: route.toLocation,
            totalDistance: route.distance || 0,
            estimatedDuration: route.estimatedDuration || "30 mins",
            totalSeats: vehicle.seatingCapacity,
            availableSeats: vehicle.seatingCapacity,
            bookedSeats: 0,
            pricePerSeat: schedule.pricePerSeat || 0,
            status: "Scheduled",
            stopPoints: route.stops ? route.stops.map(stop => ({
                location: stop.location,
                sequence: stop.sequence,
                scheduledTime: calculateStopTime(schedule.startTime, stop.sequence),
                actualTime: null
            })) : [],
            driverInfo: driver ? {
                name: driver.name,
                phoneNumber: driver.phoneNumber,
                licenseNumber: driver.licenseNumber,
                image: driver.profileImage
            } : {},
            vehicleInfo: vehicle ? {
                model: vehicle.model,
                licensePlate: vehicle.licensePlate,
                seatingCapacity: vehicle.seatingCapacity,
                type: vehicle.vehicleType,
                image: vehicle.image
            } : {}
        };

        const trip = await Trip.create(tripData);
        console.log(`[v0] Generated corporate trip for ${targetDate.toDateString()} at ${schedule.startTime}`);

        // Generate return trip if round trip
        if (schedule.tripType === "ROUND_TRIP" && schedule.returnStartTime) {
            const returnTripData = {
                ...tripData,
                tripDate: targetDate,
                startTime: schedule.returnStartTime,
                endTime: schedule.returnEndTime,
                direction: "RETURN",
                fromLocation: route.toLocation,
                toLocation: route.fromLocation,
                stopPoints: (route.stops ? [...route.stops].reverse() : []).map(stop => ({
                    location: stop.location,
                    sequence: stop.sequence,
                    scheduledTime: calculateStopTime(schedule.returnStartTime, stop.sequence),
                    actualTime: null
                }))
            };

            await Trip.create(returnTripData);
            console.log(`[v0] Generated corporate return trip for ${targetDate.toDateString()} at ${schedule.returnStartTime}`);
        }

    } catch (error) {
        console.error("[v0] Error generating corporate schedule trips:", error.message);
    }
}

// Helper function to calculate stop time based on stop sequence
function calculateStopTime(startTime, sequence) {
    try {
        const [hours, minutes] = startTime.split(':').map(Number);
        const baseDate = new Date();
        baseDate.setHours(hours, minutes, 0);
        
        // Add 5 minutes per stop
        baseDate.setMinutes(baseDate.getMinutes() + (sequence * 5));
        
        return baseDate.toTimeString().slice(0, 5);
    } catch (error) {
        return startTime;
    }
}

// Generate trips for next 7 days
export const generateCorporateTripsForDays = async (days = 7) => {
    try {
        console.log(`[v0] Generating corporate trips for next ${days} days`);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 1; i <= days; i++) {
            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + i);
            
            const activeAssignments = await VehicleAssignment.find({
                status: "Active",
                endDate: { $gte: targetDate }
            })
                .populate('contractId')
                .populate('routeId')
                .populate('vehicleId')
                .populate('assignedDriverId');

            for (const assignment of activeAssignments) {
                if (!assignment.routeId) continue;
                
                const route = assignment.routeId;
                const schedules = route.schedules || [];

                for (const schedule of schedules) {
                    await generateTripsForCorporateSchedule(assignment, schedule, targetDate);
                }
            }
        }

        console.log("[v0] Corporate trip generation for multiple days completed");
    } catch (error) {
        console.error("[v0] Error generating corporate trips for days:", error.message);
    }
};
