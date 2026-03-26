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
        const [time] = timeString.split(':');
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
        
        return `${hours}:${minutes.toString().padStart(2, '0')} ${period.toUpperCase()}`;
    }
    
    // Default fallback
    return "12:00 PM";
};

// Create Route
export const createB2CPartnerRoute = async (req, res) => {
    try {
        console.log("[v0] Creating B2C Partner Route:", JSON.stringify(req.body, null, 2));
        
        const {
            routeName,
            fromLocation,
            toLocation,
            stops,
            totalSeats,
            pricing,
            tripType,
            routeStartDate,
            availableDays,
            startTime, // Add startTime to destructuring
            assignedVehicle, // Add assignedVehicle
            assignedDriver  // Add assignedDriver
        } = req.body;

        // Validate required fields
        if (!fromLocation || !toLocation || !totalSeats || !pricing) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: fromLocation, toLocation, totalSeats, pricing"
            });
        }

        // Create stops array with order
        const stopPoints = (stops || []).map((stop, index) => ({
            location: stop.location,
            time: stop.time || "",
            order: index + 1
        }));

        const routeData = {
            b2cPartnerId: req.userId,
            fromLocation,
            toLocation,
            startTime, // Add startTime
            stopPoints,
            totalSeats: parseInt(totalSeats),
            availableSeats: parseInt(totalSeats),
            assignedVehicle, // Add assignedVehicle
            assignedDriverId: assignedDriver, // Fix: Use assignedDriverId to match model
            pricing: {
                oneWayPrice: parseFloat(pricing.oneWayPrice || 0),
                roundTripPrice: parseFloat(pricing.roundTripPrice || 0),
                monthlyOneWayPrice: parseFloat(pricing.monthlyOneWayPrice || 0),
                monthlyRoundTripPrice: parseFloat(pricing.monthlyRoundTripPrice || 0),
            },
            tripType: tripType || "One Way",
            routeStartDate: new Date(routeStartDate),
            availableDays: availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            status: "Active",
            isActive: true
        };

        const route = await B2CPartnerRoute.create(routeData);

        console.log("[v0] B2C Partner Route created successfully:", route._id);
        
        // Create schedule for the route if startTime and availableDays are provided
        if (startTime && availableDays && availableDays.length > 0) {
            console.log("[v0] Creating schedule for route:", route._id);
            
            const scheduleData = {
                b2cPartnerId: req.userId,
                routeId: route._id,
                scheduleTime: convertToAMPMFormat(startTime),
                repeatPattern: "Custom",
                availableDays: availableDays,
                assignedVehicle: assignedVehicle || null,
                assignedDriver: assignedDriver || null,
                isActive: true,
                status: "Active",
                lastTripGenerated: new Date(),
                nextTripGeneration: new Date()
            };
            
            const schedule = await B2CPartnerSchedule.create(scheduleData);
            console.log("[v0] Schedule created successfully:", schedule._id);
            
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
                    // Don't fail route creation if assignment fails
                }
            }
            
            // NOTE: DO NOT generate trips automatically when B2C_PARTNER creates route
        // Trips should only be generated when COMMUTER makes booking
        // This prevents creating empty trips that no one has booked
        console.log("[v0] Route and schedule created - trips will be generated on passenger booking");
        }
        
        res.status(201).json({
            success: true,
            message: "Route created successfully",
            route
        });

    } catch (error) {
        console.error("[v0] Error creating B2C Partner Route:", error.message);
        res.status(500).json({
            success: false,
            message: "Error creating route",
            error: error.message
        });
    }
};

// Get B2C partner routes
export const getB2CPartnerRoutes = async (req, res) => {
    try {
        // Fetch real B2C partner routes from database
        const routes = await B2CPartnerRoute.find({ 
            b2cPartnerId: req.userId 
        })
        .populate('assignedVehicle', 'model vehicleType seatingCapacity licensePlate year images')
            .sort({ createdAt: -1 });
        
        // Get B2C_PARTNER user info for self-driver case
        const partnerUser = await User.findById(req.userId).select('fullName whatsappNumber profileImage');

        // Add upcoming trips to each route and handle driver info
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const routesWithTrips = await Promise.all(
            routes.map(async (route) => {
                const upcomingTrips = await B2CPartnerTrip.find({
                    routeId: route._id,
                    tripDate: { $gte: today },
                    status: "Scheduled"
                }).sort({ tripDate: 1, startTime: 1 }).limit(10);

                // Handle driver info - check if self-driver or assigned driver
                let driverInfo = null;
                let isSelfDriver = false;

                if (route.assignedDriver) {
                    // Try to find driver in B2CPartnerDriver table
                    const assignedDriver = await B2CPartnerDriver.findById(route.assignedDriver)
                        .select('name phoneNumber licenseNumber driverImage');

                    if (assignedDriver) {
                        driverInfo = {
                            _id: assignedDriver._id,
                            name: assignedDriver.name,
                            phoneNumber: assignedDriver.phoneNumber,
                            image: assignedDriver.driverImage?.url
                        };
                    } else if (route.assignedDriver.toString() === req.userId.toString()) {
                        // Self-driver case - assignedDriver is the B2C_PARTNER's user ID
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

                // Get schedule info for start time
                const schedule = await B2CPartnerSchedule.findOne({ routeId: route._id })
                    .select('tripTimes availableDays');

                const routeObj = route.toObject();

                return {
                    ...routeObj,
                    upcomingTrips: upcomingTrips,
                    driverInfo: driverInfo,
                    isSelfDriver: isSelfDriver,
                    assignedDriver: driverInfo, // Override for backward compatibility
                    startTime: routeObj.startTime || schedule?.tripTimes?.[0]?.departureTime || "",
                    availableDays: routeObj.availableDays?.length > 0
                        ? routeObj.availableDays
                        : schedule?.availableDays || []
                };
            })
        );

        res.status(200).json({ 
            success: true, 
            routes: routesWithTrips || []
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C partner routes:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching B2C routes" 
        });
    }
};

// Update B2C partner route
export const updateB2CPartnerRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        const allowedFields = ['fromLocation', 'toLocation', 'startTime', 'totalSeats', 'availableSeats', 'pricing', 'tripType', 'routeStartDate', 'availableDays', 'assignedVehicle', 'assignedDriver', 'status', 'isActive'];
        
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Handle pricing as nested object
        if (updateData.pricing) {
            updateData.pricing = {
                oneWayPrice: parseFloat(updateData.pricing.oneWayPrice || 0),
                roundTripPrice: parseFloat(updateData.pricing.roundTripPrice || 0),
                monthlyOneWayPrice: parseFloat(updateData.pricing.monthlyOneWayPrice || 0),
                monthlyRoundTripPrice: parseFloat(updateData.pricing.monthlyRoundTripPrice || 0),
            };
        }

        if (updateData.totalSeats) {
            updateData.totalSeats = parseInt(updateData.totalSeats);
        }

        // Handle assignedDriver -> assignedDriverId mapping
        if (updateData.assignedDriver) {
            updateData.assignedDriverId = updateData.assignedDriver;
            delete updateData.assignedDriver;
        }

        const route = await B2CPartnerRoute.findOneAndUpdate(
            { _id: routeId, b2cPartnerId: req.userId },
            { $set: updateData },
            { new: true }
        )
        .populate('assignedVehicle', 'model vehicleType seatingCapacity licensePlate year')
        .populate('assignedDriverId', 'name phoneNumber email profileImage');

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found or you don't have permission to update it"
            });
        }

        console.log(`[v0] Successfully updated B2C route: ${route.fromLocation} to ${route.toLocation}`);

        res.status(200).json({
            success: true,
            message: "Route updated successfully",
            route
        });
    } catch (error) {
        console.error("[v0] Error updating B2C route:", error.message);
        res.status(500).json({
            success: false,
            message: "Error updating route",
            error: error.message
        });
    }
};

// Delete B2C partner route
export const deleteB2CPartnerRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        
        // Find and delete route
        const route = await B2CPartnerRoute.findOneAndDelete({
            _id: routeId,
            b2cPartnerId: req.userId
        });
        
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found or you don't have permission to delete it"
            });
        }
        
        console.log(`Successfully deleted B2C route: ${route.fromLocation} to ${route.toLocation}`);
        
        res.status(200).json({
            success: true,
            message: "B2C route deleted successfully"
        });
    } catch (error) {
        console.error("[v0] Error deleting B2C route:", error.message);
        res.status(500).json({
            success: false,
            message: "Error deleting B2C route",
            error: error.message
        });
    }
};

// Get Today's Trips
export const getTodayTrips = async (req, res) => {
    try {
        const { routeId } = req.query; // Get routeId from query params
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        
        // Get trips from today onwards (next 30 days)
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 30); // Next 30 days
        
        // Build query filter
        const queryFilter = {
            b2cPartnerId: req.userId,
            tripDate: {
                $gte: today,
                $lt: endDate
            }
        };
        
        // Add routeId filter if provided
        if (routeId) {
            queryFilter.routeId = routeId;
        }
        
        // Fetch upcoming trips for this B2C partner (and specific route if provided)
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

// Create Schedule for Route
export const createB2CPartnerSchedule = async (req, res) => {
    try {
        const { routeId, scheduleData } = req.body;
        
        const schedule = new B2CPartnerSchedule({
            routeId,
            b2cPartnerId: req.userId,
            ...scheduleData
        });
        
        await schedule.save();
        
        // Generate trips for this schedule
        await generateTripsForSchedule(schedule._id);
        
        res.status(201).json({
            success: true,
            message: "Schedule created successfully",
            schedule
        });
    } catch (error) {
        console.error("[v0] Error creating B2C Partner Schedule:", error.message);
        res.status(500).json({
            success: false,
            message: "Error creating schedule",
            error: error.message
        });
    }
};

// Get Schedules for Route
export const getB2CPartnerSchedules = async (req, res) => {
    try {
        const { routeId } = req.query;
        
        const query = {
            b2cPartnerId: req.userId,
            isActive: true,
            status: "Active"
        };
        
        if (routeId) {
            query.routeId = routeId;
        }
        
        const schedules = await B2CPartnerSchedule.find(query)
            .populate('routeId', 'fromLocation toLocation tripType')
            .populate('assignedVehicle', 'model licensePlate vehicleType')
            .populate('assignedDriver', 'name phoneNumber')
            .sort({ scheduleTime: 1 });
        
        res.status(200).json({
            success: true,
            schedules
        });
    } catch (error) {
        console.error("[v0] Error fetching schedules:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching schedules",
            error: error.message
        });
    }
};

// Create Trip from Schedule
// Public route trip seat availability (for commuters)
export const getPublicRouteTripSeatAvailability = async (req, res) => {
    try {
        const { routeId } = req.params;

        console.log("[v0] Getting PUBLIC seat availability for route:", routeId);

        // Get route details
        const route = await B2CPartnerRoute.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        console.log("[v0] Route found for public access:", {
            routeId: route._id,
            fromLocation: route.fromLocation,
            toLocation: route.toLocation,
            b2cPartnerId: route.b2cPartnerId
        });

        // Get all trips for this route (public access - no auth check)
        console.log("[v0] DEBUG: Querying trips for routeId:", routeId);
        
        // First try without any filters to see what exists
        const allTrips = await B2CPartnerTrip.find({ routeId: routeId });
        console.log(`[v0] DEBUG: Found ${allTrips.length} total trips for route (no filters)`);
        
        allTrips.forEach(trip => {
            console.log(`[v0] DEBUG: Trip ${trip._id}: isActive=${trip.isActive}, tripDate=${trip.tripDate}, startTime=${trip.startTime}`);
        });
        
        // Fix timezone issue - use local date comparison
        const today = new Date();
        const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // Start of day in local timezone
        
        console.log("[v0] Today's date (local start of day):", todayLocal);
        console.log("[v0] Today's date (UTC):", today);
        
        // Remove isActive filter since it's undefined, and fix date filter
        const trips = await B2CPartnerTrip.find({
            routeId: routeId,
            tripDate: { $gte: todayLocal.toISOString() } // Use local date
        }).sort({ tripDate: 1, startTime: 1 });

        console.log(`[v0] Found ${trips.length} trips for public seat availability (with fixed filters)`);
        
        // Debug: Log found trips
        trips.forEach(trip => {
            console.log(`[v0] Found trip: ${trip._id}, date: ${trip.tripDate}, time: ${trip.startTime}, seats: ${trip.availableSeats}/${trip.totalSeats}`);
        });

        // Group trips by time and direction for seat availability
        const seatAvailability = {};
        
        trips.forEach(trip => {
            // Create trip keys matching frontend format
            const direction = trip.fromLocation === route.fromLocation ? 'outbound' : 'return';
            const tripKey = `${trip.startTime}_${direction}`;
            
            seatAvailability[tripKey] = {
                tripId: trip._id,
                availableSeats: trip.availableSeats,
                totalSeats: trip.totalSeats,
                bookedSeats: trip.bookedSeats,
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                fromLocation: trip.fromLocation,
                toLocation: trip.toLocation,
                status: trip.status
            };
            
            console.log(`[v0] PUBLIC Seat availability for ${tripKey}: ${trip.availableSeats}/${trip.totalSeats} seats`);
        });

        console.log("[v0] Final PUBLIC seat availability keys:", Object.keys(seatAvailability));

        // If no trips exist, provide default availability from route
        if (Object.keys(seatAvailability).length === 0) {
            const defaultAvailable = route.availableSeats || route.totalSeats || 35;
            
            // Add default entries for common trip times
            const commonTimes = ['8:00 AM', '9:00 AM', '10:00 AM', '5:00 PM', '6:00 PM', '7:00 PM'];
            
            commonTimes.forEach(time => {
                seatAvailability[`${time}_outbound`] = {
                    availableSeats: defaultAvailable,
                    totalSeats: route.totalSeats || 35,
                    bookedSeats: 0,
                    status: "Available"
                };
                
                seatAvailability[`${time}_return`] = {
                    availableSeats: defaultAvailable,
                    totalSeats: route.totalSeats || 35,
                    bookedSeats: 0,
                    status: "Available"
                };
            });
            
            console.log("[v0] Created default availability for common times (PUBLIC)");
        }

        res.status(200).json({
            success: true,
            message: "Seat availability retrieved successfully (PUBLIC)",
            routeId: routeId,
            routeName: `${route.fromLocation} → ${route.toLocation}`,
            totalTrips: trips.length,
            seatAvailability: seatAvailability
        });

    } catch (error) {
        console.error("[v0] Error getting PUBLIC seat availability:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving seat availability",
            error: error.message
        });
    }
};

// Get route trip seat availability for real-time display
export const getRouteTripSeatAvailability = async (req, res) => {
    try {
        const { routeId } = req.params;
        const b2cPartnerId = req.userId;

        console.log("[v0] Getting seat availability for route:", routeId);
        console.log("[v0] Requested by user:", b2cPartnerId);

        // Get route details
        const route = await B2CPartnerRoute.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        console.log("[v0] Route found:", {
            routeId: route._id,
            fromLocation: route.fromLocation,
            toLocation: route.toLocation,
            b2cPartnerId: route.b2cPartnerId
        });

        // Check authorization
        if (route.b2cPartnerId.toString() !== b2cPartnerId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to access this route"
            });
        }

        // Get all trips for this route
        const trips = await B2CPartnerTrip.find({
            routeId: routeId,
            isActive: true,
            tripDate: { $gte: new Date() }
        }).sort({ tripDate: 1, startTime: 1 });

        console.log(`[v0] Found ${trips.length} trips for seat availability`);

        // Group trips by time and direction for seat availability
        const seatAvailability = {};
        
        trips.forEach(trip => {
            // Create trip keys matching frontend format
            const direction = trip.fromLocation === route.fromLocation ? 'outbound' : 'return';
            const tripKey = `${trip.startTime}_${direction}`;
            
            seatAvailability[tripKey] = {
                tripId: trip._id,
                availableSeats: trip.availableSeats,
                totalSeats: trip.totalSeats,
                bookedSeats: trip.bookedSeats,
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                fromLocation: trip.fromLocation,
                toLocation: trip.toLocation,
                status: trip.status
            };
            
            console.log(`[v0] Seat availability for ${tripKey}: ${trip.availableSeats}/${trip.totalSeats} seats`);
        });

        console.log("[v0] Final seat availability keys:", Object.keys(seatAvailability));

        // If no trips exist, provide default availability from route
        if (Object.keys(seatAvailability).length === 0) {
            const defaultAvailable = route.availableSeats || route.totalSeats || 35;
            
            // Add default entries for common trip times
            const commonTimes = ['8:00 AM', '9:00 AM', '10:00 AM', '5:00 PM', '6:00 PM', '7:00 PM'];
            
            commonTimes.forEach(time => {
                seatAvailability[`${time}_outbound`] = {
                    availableSeats: defaultAvailable,
                    totalSeats: route.totalSeats || 35,
                    bookedSeats: 0,
                    status: "Available"
                };
                
                seatAvailability[`${time}_return`] = {
                    availableSeats: defaultAvailable,
                    totalSeats: route.totalSeats || 35,
                    bookedSeats: 0,
                    status: "Available"
                };
            });
            
            console.log("[v0] Created default availability for common times");
        }

        res.status(200).json({
            success: true,
            message: "Seat availability retrieved successfully",
            routeId: routeId,
            routeName: `${route.fromLocation} → ${route.toLocation}`,
            totalTrips: trips.length,
            seatAvailability: seatAvailability
        });

    } catch (error) {
        console.error("[v0] Error getting seat availability:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving seat availability",
            error: error.message
        });
    }
};

// Create Trip from Schedule
export const createB2CPartnerTrip = async (req, res) => {
    try {
        const tripData = req.body;
        
        const trip = new B2CPartnerTrip({
            ...tripData,
            b2cPartnerId: req.userId
        });
        
        await trip.save();
        
        res.status(201).json({
            success: true,
            message: "Trip created successfully",
            trip
        });
    } catch (error) {
        console.error("[v0] Error creating B2C Partner Trip:", error.message);
        res.status(500).json({
            success: false,
            message: "Error creating trip",
            error: error.message
        });
    }
};

// Get Trips for Route
export const getB2CPartnerTrips = async (req, res) => {
    try {
        const { routeId } = req.query;
        const { startDate } = req.query;
        
        const query = {
            b2cPartnerId: req.userId
        };
        
        if (routeId) {
            query.routeId = routeId;
        }
        
        if (startDate) {
            query.tripDate = {
                $gte: new Date(startDate)
            };
        }
        
        const trips = await B2CPartnerTrip.find(query)
            .populate('routeId', 'fromLocation toLocation tripType')
            .populate('vehicleId', 'model licensePlate vehicleType')
            .populate('driverId', 'fullName phoneNumber')
            .sort({ tripDate: 1 });
        
        res.status(200).json({
            success: true,
            trips
        });
    } catch (error) {
        console.error("[v0] Error fetching trips:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching trips",
            error: error.message
        });
    }
};
