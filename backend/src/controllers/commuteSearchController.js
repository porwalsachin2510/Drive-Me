import User from "../models/User.js"
import Vehicle from "../models/Vehicle.js"
import Contract from "../models/Contract.js"
import Driver from "../models/Driver.js"
import Route from "../models/Route.js"
import B2CPartnerRoute from "../models/B2CPartnerRoute.js"
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js"
import B2CPartnerTrip from "../models/B2CPartnerTrip.js"
import B2CPassengerBooking from "../models/B2CPassengerBooking.js"
import B2CMonthlyPass from "../models/B2CMonthlyPass.js"
import RouteRequest from "../models/RouteRequest.js"
import B2CPartnerDriver from "../models/B2CPartnerDriver.js"
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js"
import mongoose from "mongoose"
import { createNotification } from "../Services/notificationService.js"
/* ======================================================
   UTILITY FUNCTIONS
====================================================== */

const normalize = (val) => {
    if (typeof val === "string") return val.toLowerCase().trim()
    if (val?.location && typeof val.location === "string") {
        return val.location.toLowerCase().trim()
    }
    return ""
}

// Helper function to parse time string to minutes for comparison
const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || timeStr === "N/A") return Infinity

    // Handle formats like "7:30 AM", "12:00 PM", "6:00 PM"
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
    if (!match) return Infinity

    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    const period = match[3]?.toUpperCase()

    if (period === "PM" && hours !== 12) {
        hours += 12
    } else if (period === "AM" && hours === 12) {
        hours = 0
    }

    return hours * 60 + minutes
}

// Sort stops by time (earliest first)
const sortStopsByTime = (stops) => {
    if (!stops || !Array.isArray(stops) || stops.length === 0) return []

    return [...stops].sort((a, b) => {
        const timeA = parseTimeToMinutes(typeof a === 'string' ? null : a.time)
        const timeB = parseTimeToMinutes(typeof b === 'string' ? null : b.time)
        return timeA - timeB
    })
}

// Check location match (from / to / stops including schedule stops)
const isLocationMatch = (searchLocation, from, to, stops = [], scheduleStops = []) => {
    if (!searchLocation) return true
    const search = normalize(searchLocation)

    if (from && normalize(from).includes(search)) return true
    if (to && normalize(to).includes(search)) return true

    // Check route-level stops
    const routeStopMatch = stops.some((stop) => {
        const stopLocation = typeof stop === "string" ? stop : stop.location
        return normalize(stopLocation).includes(search)
    })
    if (routeStopMatch) return true

    // Check schedule-level stops (outboundStopPoints and returnStopPoints)
    return scheduleStops.some((stop) => {
        const stopLocation = typeof stop === "string" ? stop : stop.location
        return normalize(stopLocation).includes(search)
    })
}

// Build ordered route path with times - SORTED BY TIME
const buildFullPathWithTimes = (from, stops = [], to, inboundStart) => {
    const path = []

    // Add fromLocation with inboundStart time
    path.push({
        location: from,
        time: inboundStart || "N/A",
        isFromLocation: true,
    })

    // Sort stops by time before adding to path
    const sortedStops = sortStopsByTime(stops)

    // Add stops with their times (now in correct order)
    if (sortedStops && sortedStops.length > 0) {
        sortedStops.forEach((stop) => {
            if (typeof stop === "string") {
                path.push({ location: stop, time: "N/A", isStop: true })
            } else {
                path.push({
                    location: stop.location || stop,
                    time: stop.time || "N/A",
                    isStop: true,
                })
            }
        })
    }

    // Add toLocation (usually arrival time would be calculated)
    path.push({
        location: to,
        time: "N/A", // Can be calculated if needed
        isToLocation: true,
    })

    return path
}

const buildTravelPath = (from, stops, to, startTime) => {
    const path = []

    path.push({
        location: from,
        time: startTime || "N/A",
        isFromLocation: true,
    })

    // Sort stops by time before adding to path
    const sortedStops = sortStopsByTime(stops)

    for (const s of sortedStops || []) {
        path.push({
            location: s.location,
            time: s.time || "N/A",
            isStop: true,
        })
    }

    path.push({
        location: to,
        time: "N/A",
        isToLocation: true,
    })

    return path
}


const findIndex = (path, location) => {
    if (!location) return -1
    const l = normalize(location)
    return path.findIndex((p) => normalize(p.location).includes(l))
}

const dayMatching = (selected = [], available = []) => {
    if (!selected.length) {
        return {
            allAvailable: true,
            matchedDays: available,
            notAvailableDays: [],
        }
    }

    const s = selected.map((d) => d.toUpperCase())
    const a = available.map((d) => d.toUpperCase())

    const matchedDays = s.filter((d) => a.includes(d))
    const notAvailableDays = s.filter((d) => !a.includes(d))

    return {
        allAvailable: notAvailableDays.length === 0,
        matchedDays,
        notAvailableDays,
    }
}

// Find index of searched location in path
const findLocationIndex = (path = [], location) => {
    if (!location) return -1
    const search = normalize(location)
    return path.findIndex((p) => normalize(p.location).includes(search))
}

// Get arrival time for pickup/dropoff location
const getArrivalTime = (path, locationIndex) => {
    if (locationIndex >= 0 && locationIndex < path.length) {
        return path[locationIndex].time || "N/A"
    }
    return "N/A"
}

// Match selected days with available days
const matchDays = (selectedDays = [], availableDays = []) => {
    if (!selectedDays || selectedDays.length === 0) {
        return {
            allAvailable: true,
            matchedDays: availableDays,
            notAvailableDays: [],
        }
    }

    const normalizedSelectedDays = selectedDays.map((day) => day.toUpperCase())
    const normalizedAvailableDays = availableDays.map((day) => day.toUpperCase())

    const matchedDays = normalizedSelectedDays.filter((day) => normalizedAvailableDays.includes(day))

    const notAvailableDays = normalizedSelectedDays.filter((day) => !normalizedAvailableDays.includes(day))

    return {
        allAvailable: notAvailableDays.length === 0,
        matchedDays: matchedDays,
        notAvailableDays: notAvailableDays,
    }
}

// Decide full route OR trimmed route with arrival times
const getTravelPath = ({
    from,
    to,
    stops,
    inboundStart,
    pickupLocation,
    dropoffLocation,
    selectedDays,
    availableDays,
}) => {
    const fullPath = buildFullPathWithTimes(from, stops, to, inboundStart)

    // Match days
    const dayMatching = matchDays(selectedDays, availableDays)

    // 🔹 No search → full route
    if (!pickupLocation && !dropoffLocation) {
        return {
            fromLocation: from,
            toLocation: to,
            travelPath: fullPath,
            pickupArrivalTime: fullPath[0].time,
            dropoffArrivalTime: fullPath[fullPath.length - 1].time,
            dayMatching,
        }
    }

    const pickupIndex = pickupLocation ? findLocationIndex(fullPath, pickupLocation) : 0

    const dropIndex = dropoffLocation ? findLocationIndex(fullPath, dropoffLocation) : fullPath.length - 1

    if (pickupIndex === -1 || dropIndex === -1) return null
    if (pickupIndex >= dropIndex) return null

    const slicedPath = fullPath.slice(pickupIndex, dropIndex + 1)

    return {
        fromLocation: slicedPath[0].location,
        toLocation: slicedPath[slicedPath.length - 1].location,
        travelPath: slicedPath,
        pickupArrivalTime: getArrivalTime(fullPath, pickupIndex),
        dropoffArrivalTime: getArrivalTime(fullPath, dropIndex),
        dayMatching,
    }
}

/* ======================================================
   MAIN CONTROLLER
====================================================== */

export const searchCommuteRoutes = async (req, res) => {
    try {
        const userId = req.userId

        const {
            pickupLocation,
            dropoffLocation,
            filterType, // all | matched
            selectedDays, // User selected days
            nationality, // Added nationality parameter for location-based filtering
        } = req.query

        // Parse selectedDays if it's a string
        let parsedSelectedDays = []
        if (selectedDays) {
            try {
                parsedSelectedDays = typeof selectedDays === "string" ? JSON.parse(selectedDays) : selectedDays
            } catch (e) {
                console.log("Error parsing selectedDays:", e)
            }
        }

        const user = await User.findById(userId).select("companyId role")

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        const routes = []

        /* =====================================================
           CORPORATE EMPLOYEE FLOW
        ====================================================== */
        if (user.companyId) {
            const company = await User.findById(user.companyId).select(
                "companyName companyLogo"
            )

            const contracts = await Contract.find({
                corporateOwnerId: user.companyId,
                status: "ACTIVE",
                "vehicleAccess.isActive": true,
            })

            for (const contract of contracts) {
                for (const v of contract.vehicles || []) {
                    for (const assigned of v.assignedVehicles || []) {
                        if (assigned.status !== "ACTIVE") continue

                        const route = await Route.findOne({
                            _id: assigned.routeDetails,
                            status: "ACTIVE",
                        })

                        if (!route) continue

                        if (
                            filterType === "matched" &&
                            (pickupLocation || dropoffLocation)
                        ) {
                            const pMatch = isLocationMatch(
                                pickupLocation,
                                route.fromLocation,
                                route.toLocation,
                                route.stopPoints
                            )
                            const dMatch = isLocationMatch(
                                dropoffLocation,
                                route.fromLocation,
                                route.toLocation,
                                route.stopPoints
                            )
                            if (!pMatch || !dMatch) continue
                        }

                        const vehicle = await Vehicle.findById(assigned.vehicleId)
                        if (!vehicle || !vehicle.isActive) continue

                        let driver
                        if (assigned.driverModel === "Driver") {
                            // For B2B Partner Drivers, find User account with driverId reference
                            driver = await User.findOne({
                                driverId: assigned.driverId,
                                driverModel: "Driver",
                                role: "B2B_PARTNER_DRIVER"
                            }).populate('driverId', 'name email phone')
                        } else if (assigned.driverModel === "CorporateDriver") {
                            // For Corporate Drivers, find User account with driverId reference
                            driver = await User.findOne({
                                driverId: assigned.driverId,
                                driverModel: "CorporateDriver",
                                role: "CORPORATE_DRIVER"
                            }).populate('driverId', 'name email phone')
                        }

                        if (!driver) continue

                        const travelPath = buildTravelPath(
                            route.fromLocation,
                            route.stopPoints,
                            route.toLocation,
                            route.startTime
                        )

                        const pIndex = pickupLocation
                            ? findIndex(travelPath, pickupLocation)
                            : 0
                        const dIndex = dropoffLocation
                            ? findIndex(travelPath, dropoffLocation)
                            : travelPath.length - 1

                        if (pIndex === -1 || dIndex === -1 || pIndex >= dIndex)
                            continue

                        const slicedPath = travelPath.slice(pIndex, dIndex + 1)

                        routes.push({
                            routeId: route._id,
                            contractId: route.contractId,
                            corporateOwnerId: user.companyId,
                            driverId: driver._id,
                            driverName: driver.fullName,
                            driverImage: driver.profileImage,
                            company: company.companyName,
                            companyLogo: company.companyLogo || null,

                            fromLocation: slicedPath[0].location,
                            toLocation: slicedPath[slicedPath.length - 1].location,
                            travelPath: slicedPath,

                            pickupArrivalTime: slicedPath[0].time,
                            dropoffArrivalTime:
                                slicedPath[slicedPath.length - 1].time || "N/A",

                            departureTime: route.startTime,
                            startDate: route.routeStartDate,

                            availableSeats:
                                route.availableSeats || 0,
                            totalSeats:
                                vehicle.capacity?.seatingCapacity || 0,

                            daysOfWeek:
                                route.availableDays || [],
                            dayMatching: dayMatching(
                                parsedSelectedDays,
                                route.availableDays || []
                            ),

                            availableDays: route.availableDays || [],

                            vehicleModel: vehicle.vehicleName,
                            vehiclePlate: vehicle.registrationNumber,
                            images: vehicle.photos?.map((p) => p.url) || [],

                            type: "company",
                        })
                    }
                }
            }

            return res.status(200).json({
                success: true,
                userType: "company",
                totalRoutes: routes.length,
                routes,
            })
        }

        /* ======================================================
               NORMAL / B2C COMMUTER ROUTES
            ====================================================== */

        // Helper function to determine route country from location names
        const getRouteCountry = (fromLocation, toLocation) => {
            const allLocations = `${fromLocation || ''} ${toLocation || ''}`.toLowerCase();

            // Kuwait indicators
            const kuwaitIndicators = ['kuwait', 'salwa', 'jahra', 'salmiya', 'hawally', 'farwaniya', 'ahmadi', 'mangaf', 'fahaheel', 'fintas', 'mahboula', 'khaitan', 'jleeb', 'mubarak'];

            // UAE indicators
            const uaeIndicators = ['dubai', 'abu dhabi', 'sharjah', 'ajman', 'fujairah', 'ras al', 'umm al', 'al ain', 'deira', 'bur dubai', 'jumeirah', 'marina', 'jebel ali', 'silicon oasis', 'business bay', 'creek', 'mall of emirates', 'burjuman'];

            // Check for Kuwait locations
            for (const indicator of kuwaitIndicators) {
                if (allLocations.includes(indicator)) {
                    return 'Kuwait';
                }
            }

            // Check for UAE locations
            for (const indicator of uaeIndicators) {
                if (allLocations.includes(indicator)) {
                    return 'UAE';
                }
            }

            return null; // Unknown country
        };

        // Get B2C Partner Routes directly from B2CPartnerRoute collection
        const b2cRoutes = await B2CPartnerRoute.find({
            status: "Active",
            $or: [
                { isActive: true },
                { isActive: { $exists: false } },
                { isActive: null }
            ]
        }).populate('b2cPartnerId', 'fullName companyLogo profileImage country')
            .populate('assignedVehicle')
            .populate('assignedDriver')
            .populate('tags', 'label color textColor icon category')

        for (const route of b2cRoutes) {

            // Filter by country based on route locations
            if (nationality) {
                const countryMapping = {
                    'UAE': 'UAE',
                    'United Arab Emirates': 'UAE',
                    'Kuwait': 'Kuwait',
                    'KW': 'Kuwait',
                    'AE': 'UAE'
                };
                const userCountry = countryMapping[nationality] || nationality;
                const routeCountry = getRouteCountry(route.fromLocation, route.toLocation);

                // Only show routes that match the user's country
                // If routeCountry is null (unknown location like India), skip the route for UAE/Kuwait users
                // This ensures only verified UAE/Kuwait routes are shown to respective users
                if (userCountry === 'UAE' || userCountry === 'Kuwait') {
                    if (routeCountry !== userCountry) {
                        continue; // Skip routes that don't match OR are from unknown countries
                    }
                }
            }

            // Get ALL schedules for this route (not just one)
            const schedules = await B2CPartnerSchedule.find({
                routeId: route._id,
                isActive: true,
                status: "Active"
            }).populate('routeId')

            // Use first schedule for backward compatibility, but combine all trip times
            const schedule = schedules.length > 0 ? schedules[0] : null;

            // Combine available days from all schedules
            let combinedAvailableDays = new Set();
            for (const sch of schedules) {
                if (sch.availableDays && Array.isArray(sch.availableDays)) {
                    sch.availableDays.forEach(day => combinedAvailableDays.add(day));
                }
            }
            const routeAvailableDays = combinedAvailableDays.size > 0
                ? Array.from(combinedAvailableDays)
                : (route.availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

            if (schedules.length > 0) {
                console.log("Found", schedules.length, "schedule(s) for route:", route._id)
                schedules.forEach((sch, idx) => {
                    console.log(`  Schedule ${idx + 1}:`, sch._id, "with trip times:", sch.tripTimes?.length || 0)
                });
            } else {
                console.log("No schedule found for route:", route._id, "- using route-level data")
            }

            // Collect all driver and vehicle IDs from tripTimes for batch lookup
            const driverIds = new Set();
            const vehicleIds = new Set();
            for (const sch of schedules) {
                if (sch?.tripTimes && sch.tripTimes.length > 0) {
                    for (const tt of sch.tripTimes) {
                        if (tt.assignedDriver) driverIds.add(tt.assignedDriver.toString());
                        if (tt.assignedVehicle) vehicleIds.add(tt.assignedVehicle.toString());
                    }
                }
            }

            // Convert to ObjectIds for MongoDB query
            const driverObjectIds = Array.from(driverIds).map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch (e) { return null; }
            }).filter(Boolean);
            const vehicleObjectIds = Array.from(vehicleIds).map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch (e) { return null; }
            }).filter(Boolean);

            // Batch fetch drivers from B2CPartnerDriver collection
            const b2cDrivers = driverObjectIds.length > 0
                ? await B2CPartnerDriver.find({ _id: { $in: driverObjectIds } }).select('name phoneNumber driverImage email')
                : [];

            // Batch fetch drivers from User collection (self-driving B2C Partners)
            const userDrivers = driverObjectIds.length > 0
                ? await User.find({ _id: { $in: driverObjectIds } }).select('fullName whatsappNumber profileImage email')
                : [];

            // Batch fetch vehicles
            const vehicles = vehicleObjectIds.length > 0
                ? await B2CPartnerVehicle.find({ _id: { $in: vehicleObjectIds } }).select('model licensePlate vehicleType seatingCapacity vehicleColor images')
                : [];

            // Create lookup maps
            const driverMap = {};
            b2cDrivers.forEach(d => {
                driverMap[d._id.toString()] = {
                    _id: d._id,
                    name: d.name,
                    phoneNumber: d.phoneNumber,
                    image: d.driverImage?.url || null,
                    email: d.email
                };
            });
            userDrivers.forEach(u => {
                if (!driverMap[u._id.toString()]) {
                    driverMap[u._id.toString()] = {
                        _id: u._id,
                        name: u.fullName,
                        phoneNumber: u.whatsappNumber,
                        image: u.profileImage || null,
                        email: u.email
                    };
                }
            });

            const vehicleMap = {};
            vehicles.forEach(v => {
                vehicleMap[v._id.toString()] = {
                    _id: v._id,
                    model: v.model,
                    licensePlate: v.licensePlate,
                    vehicleType: v.vehicleType,
                    seatingCapacity: v.seatingCapacity,
                    vehicleColor: v.vehicleColor,
                    image: v.images?.[0]?.url || null
                };
            });

            // Build populated tripTimes with effectiveDriver and effectiveVehicle
            const populatedTripTimes = [];
            for (const sch of schedules) {
                if (sch?.tripTimes && sch.tripTimes.length > 0) {
                    for (const tt of sch.tripTimes) {
                        const tripTimeObj = tt.toObject ? tt.toObject() : { ...tt };
                        const tripDriverId = tt.assignedDriver?.toString();
                        const tripVehicleId = tt.assignedVehicle?.toString();

                        populatedTripTimes.push({
                            ...tripTimeObj,
                            scheduleId: sch._id,
                            scheduleName: sch.scheduleName,
                            effectiveDriver: tripDriverId && driverMap[tripDriverId] ? driverMap[tripDriverId] : null,
                            effectiveVehicle: tripVehicleId && vehicleMap[tripVehicleId] ? vehicleMap[tripVehicleId] : null
                        });
                    }
                }
            }

            // Extract UNIQUE stop points from ALL schedules' tripTimes (by location only, not time)
            const scheduleStopsMap = new Map();
            for (const sch of schedules) {
                if (sch?.tripTimes && sch.tripTimes.length > 0) {
                    for (const tripTime of sch.tripTimes) {
                        if (tripTime.outboundStopPoints && tripTime.outboundStopPoints.length > 0) {
                            for (const stop of tripTime.outboundStopPoints) {
                                const locationKey = normalize(stop.location || stop);
                                if (!scheduleStopsMap.has(locationKey)) {
                                    scheduleStopsMap.set(locationKey, stop);
                                }
                            }
                        }
                        if (tripTime.returnStopPoints && tripTime.returnStopPoints.length > 0) {
                            for (const stop of tripTime.returnStopPoints) {
                                const locationKey = normalize(stop.location || stop);
                                if (!scheduleStopsMap.has(locationKey)) {
                                    scheduleStopsMap.set(locationKey, stop);
                                }
                            }
                        }
                    }
                }
            }
            const scheduleStops = Array.from(scheduleStopsMap.values());

            // Get upcoming trips for this route
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            console.log("Finding trips from today:", today.toDateString())
            const upcomingTrips = await B2CPartnerTrip.find({
                routeId: route._id,
                tripDate: { $gte: today },
                status: "Scheduled"
            }).sort({ tripDate: 1, startTime: 1 }).limit(10)

            console.log("Found upcoming trips:", upcomingTrips.length)

            // Format trip data for commuter
            const formattedTrips = upcomingTrips.map(trip => ({
                tripId: trip._id,
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                endTime: trip.endTime,
                tripType: trip.tripType,
                fromLocation: trip.fromLocation,
                toLocation: trip.toLocation,
                stopPoints: trip.stopPoints || [],
                totalSeats: trip.totalSeats,
                availableSeats: trip.availableSeats,
                pricing: trip.pricing,
                driverInfo: trip.driverInfo,
                vehicleInfo: trip.vehicleInfo
            }))

            let shouldInclude = false

            if (filterType === "matched" && (pickupLocation || dropoffLocation)) {
                // Include schedule stops in location matching
                const allStops = [...(route.stopPoints || []), ...scheduleStops]
                const pickupMatch = isLocationMatch(pickupLocation, route.fromLocation, route.toLocation, route.stopPoints, scheduleStops)
                const dropMatch = isLocationMatch(dropoffLocation, route.fromLocation, route.toLocation, route.stopPoints, scheduleStops)
                shouldInclude = pickupMatch && dropMatch
            } else {
                shouldInclude = true
            }

            if (!shouldInclude) continue

            // Combine route-level and schedule-level stops for travel path
            const allStopsForPath = [...(route.stopPoints || []), ...scheduleStops]
            // Remove duplicate stops by location (case-insensitive)
            const uniqueStopsUnsorted = allStopsForPath.filter((stop, index, self) =>
                index === self.findIndex(s =>
                    normalize(s.location || s) === normalize(stop.location || stop)
                )
            )

            // Sort stops by time to ensure correct order
            const uniqueStops = sortStopsByTime(uniqueStopsUnsorted)

            // Create travel path with schedule data (fallback to route-level data)
            const travelData = getTravelPath({
                from: route.fromLocation,
                to: route.toLocation,
                stops: uniqueStops,
                inboundStart: route.startTime || "",
                pickupLocation,
                dropoffLocation,
                selectedDays: parsedSelectedDays,
                availableDays: routeAvailableDays,
            })

            if (!travelData) continue

            // Extract intermediate stops from travelPath (excluding from and to locations)
            // This ensures we only show stops that are actually between pickup and dropoff
            const intermediateStopsFromPath = travelData.travelPath
                .filter(stop => !stop.isFromLocation && !stop.isToLocation && stop.isStop)
                .map(stop => ({ location: stop.location, time: stop.time }))

            // Calculate dynamic available seats based on active monthly passes
            const activePassCountAuth = await B2CMonthlyPass.countDocuments({
                routeId: route._id,
                status: { $in: ['ACTIVE', 'active', 'Active'] },
                endDate: { $gte: new Date() }
            });
            const totalSeatsAuth = route.totalSeats || route.assignedVehicle?.seatingCapacity || 35;
            const dynamicAvailableSeatsAuth = Math.max(0, totalSeatsAuth - activePassCountAuth);

            routes.push({
                routeId: route._id,
                operator: route.b2cPartnerId?.fullName || "Unknown Operator",
                operatorId: route.b2cPartnerId?._id,
                companyLogo: route.b2cPartnerId?.companyLogo || route.b2cPartnerId?.profileImage || null,

                fromLocation: travelData.fromLocation,
                toLocation: travelData.toLocation,
                travelPath: travelData.travelPath,

                // Schedule-based data (with fallback)
                scheduleId: schedule?._id || null,
                scheduleName: schedule?.scheduleName || "Default Schedule",
                availableDays: routeAvailableDays,
                tripTimes: populatedTripTimes,
                upcomingTrips: formattedTrips,

                // Route data
                pickupArrivalTime: travelData.pickupArrivalTime,
                dropoffArrivalTime: travelData.dropoffArrivalTime,
                departureTime: route.startTime || "",
                startDate: route.routeStartDate,
                tripType: route.tripType || "One Way",
                pricing: {
                    oneWayPrice: route.pricing?.oneWayPrice,
                    roundTripPrice: route.pricing?.roundTripPrice,
                    monthlyOneWayPrice: route.pricing?.monthlyOneWayPrice,
                    monthlyRoundTripPrice: route.pricing?.monthlyRoundTripPrice,
                    currency: route.pricing?.currency || "KWD" // Add currency field
                },
                roundTripPrice: route.pricing?.roundTripPrice,
                oneWayPrice: route.pricing?.oneWayPrice,
                monthlyPrice: route.pricing?.monthlyOneWayPrice,
                monthlyRoundTripPrice: route.pricing?.monthlyRoundTripPrice,
                availableSeats: dynamicAvailableSeatsAuth,
                totalSeats: totalSeatsAuth,
                dayMatching: travelData.dayMatching,

                driverName: route.assignedDriver?.name,
                vehicleModel: route.assignedVehicle?.model,
                vehiclePlate: route.assignedVehicle?.licensePlate,
                images: route.assignedVehicle?.images?.map(img => img.url) || [],
                stopPoints: route.stopPoints || [],
                scheduleStops: intermediateStopsFromPath, // Only stops between pickup and dropoff
                allStops: intermediateStopsFromPath, // Only stops between pickup and dropoff
                tags: route.tags || [], // Include tags for filtering and display
                type: "b2c",
            })
        }

        return res.status(200).json({
            success: true,
            userType: "normal",
            totalRoutes: routes.length,
            routes,
        })
    } catch (error) {
        console.error("searchCommuteRoutes error:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while searching routes",
        })
    }
}

/* ======================================================
   PUBLIC SEARCH (No Authentication Required)
   - For landing page / unauthenticated users
   - Returns only B2C Partner routes (no corporate)
====================================================== */
export const publicSearchRoutes = async (req, res) => {
    try {
        const {
            pickupLocation,
            dropoffLocation,
            filterType,
            selectedDays,
            nationality, // Country filter from frontend
        } = req.query



        let parsedSelectedDays = []
        if (selectedDays) {
            try {
                parsedSelectedDays = typeof selectedDays === "string" ? JSON.parse(selectedDays) : selectedDays
            } catch (e) {
                console.log("Error parsing selectedDays:", e)
            }
        }

        const routes = []

        // Helper function to determine route country from location names
        const getRouteCountry = (fromLocation, toLocation) => {
            const allLocations = `${fromLocation || ''} ${toLocation || ''}`.toLowerCase();

            // Kuwait indicators
            const kuwaitIndicators = ['kuwait', 'salwa', 'jahra', 'salmiya', 'hawally', 'farwaniya', 'ahmadi', 'mangaf', 'fahaheel', 'fintas', 'mahboula', 'khaitan', 'jleeb', 'mubarak'];

            // UAE indicators
            const uaeIndicators = ['dubai', 'abu dhabi', 'sharjah', 'ajman', 'fujairah', 'ras al', 'umm al', 'al ain', 'deira', 'bur dubai', 'jumeirah', 'marina', 'jebel ali', 'silicon oasis', 'business bay', 'creek', 'mall of emirates', 'burjuman'];

            // Check for Kuwait locations
            for (const indicator of kuwaitIndicators) {
                if (allLocations.includes(indicator)) {
                    return 'Kuwait';
                }
            }

            // Check for UAE locations
            for (const indicator of uaeIndicators) {
                if (allLocations.includes(indicator)) {
                    return 'UAE';
                }
            }

            return null; // Unknown country
        };

        // Get all active B2C Partner Routes
        const b2cRoutes = await B2CPartnerRoute.find({
            status: "Active",
            $or: [
                { isActive: true },
                { isActive: { $exists: false } },
                { isActive: null }
            ]
        }).populate('b2cPartnerId', 'fullName companyLogo profileImage country')
            .populate('assignedVehicle')
            .populate('assignedDriver')
            .populate('tags', 'label color textColor icon category')

        for (const route of b2cRoutes) {

            // Filter by country based on route locations
            if (nationality) {
                const countryMapping = {
                    'UAE': 'UAE',
                    'United Arab Emirates': 'UAE',
                    'Kuwait': 'Kuwait',
                    'KW': 'Kuwait',
                    'AE': 'UAE'
                };
                const userCountry = countryMapping[nationality] || nationality;
                const routeCountry = getRouteCountry(route.fromLocation, route.toLocation);

                // Only show routes that match the user's country
                // If routeCountry is null (unknown location), skip the route for UAE/Kuwait users
                // This ensures only verified UAE/Kuwait routes are shown to respective users
                if (userCountry === 'UAE' || userCountry === 'Kuwait') {
                    if (routeCountry !== userCountry) {
                        continue; // Skip routes that don't match OR are from unknown countries
                    }
                }
            }

            // Get schedule for this route (optional - route might not have a schedule yet)
            const schedule = await B2CPartnerSchedule.findOne({
                routeId: route._id,
                isActive: true,
                status: "Active"
            })

            // Even without schedule, show the route based on its own data
            const routeAvailableDays = schedule?.availableDays || route.availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

            // Extract UNIQUE stop points from schedule tripTimes (by location only, not time)
            const scheduleStopsMap = new Map();
            if (schedule?.tripTimes && schedule.tripTimes.length > 0) {
                for (const tripTime of schedule.tripTimes) {
                    if (tripTime.outboundStopPoints && tripTime.outboundStopPoints.length > 0) {
                        for (const stop of tripTime.outboundStopPoints) {
                            const locationKey = normalize(stop.location || stop);
                            if (!scheduleStopsMap.has(locationKey)) {
                                scheduleStopsMap.set(locationKey, stop);
                            }
                        }
                    }
                    if (tripTime.returnStopPoints && tripTime.returnStopPoints.length > 0) {
                        for (const stop of tripTime.returnStopPoints) {
                            const locationKey = normalize(stop.location || stop);
                            if (!scheduleStopsMap.has(locationKey)) {
                                scheduleStopsMap.set(locationKey, stop);
                            }
                        }
                    }
                }
            }
            const scheduleStops = Array.from(scheduleStopsMap.values());

            // Populate driver/vehicle data for tripTimes
            let populatedTripTimes = [];
            if (schedule?.tripTimes && schedule.tripTimes.length > 0) {
                const driverIds = new Set();
                const vehicleIds = new Set();
                for (const tt of schedule.tripTimes) {
                    if (tt.assignedDriver) driverIds.add(tt.assignedDriver.toString());
                    if (tt.assignedVehicle) vehicleIds.add(tt.assignedVehicle.toString());
                }

                const driverObjectIds = Array.from(driverIds).map(id => {
                    try { return new mongoose.Types.ObjectId(id); } catch (e) { return null; }
                }).filter(Boolean);
                const vehicleObjectIds = Array.from(vehicleIds).map(id => {
                    try { return new mongoose.Types.ObjectId(id); } catch (e) { return null; }
                }).filter(Boolean);

                const b2cDrivers = driverObjectIds.length > 0
                    ? await B2CPartnerDriver.find({ _id: { $in: driverObjectIds } }).select('name phoneNumber driverImage email')
                    : [];
                const userDrivers = driverObjectIds.length > 0
                    ? await User.find({ _id: { $in: driverObjectIds } }).select('fullName whatsappNumber profileImage email')
                    : [];
                const vehicles = vehicleObjectIds.length > 0
                    ? await B2CPartnerVehicle.find({ _id: { $in: vehicleObjectIds } }).select('model licensePlate vehicleType seatingCapacity vehicleColor images')
                    : [];

                const driverMap = {};
                b2cDrivers.forEach(d => {
                    driverMap[d._id.toString()] = {
                        _id: d._id, name: d.name, phoneNumber: d.phoneNumber,
                        image: d.driverImage?.url || null, email: d.email
                    };
                });
                userDrivers.forEach(u => {
                    if (!driverMap[u._id.toString()]) {
                        driverMap[u._id.toString()] = {
                            _id: u._id, name: u.fullName, phoneNumber: u.whatsappNumber,
                            image: u.profileImage || null, email: u.email
                        };
                    }
                });

                const vehicleMap = {};
                vehicles.forEach(v => {
                    vehicleMap[v._id.toString()] = {
                        _id: v._id, model: v.model, licensePlate: v.licensePlate,
                        vehicleType: v.vehicleType, seatingCapacity: v.seatingCapacity,
                        vehicleColor: v.vehicleColor, image: v.images?.[0]?.url || null
                    };
                });

                for (const tt of schedule.tripTimes) {
                    const tripTimeObj = tt.toObject ? tt.toObject() : { ...tt };
                    const tripDriverId = tt.assignedDriver?.toString();
                    const tripVehicleId = tt.assignedVehicle?.toString();
                    populatedTripTimes.push({
                        ...tripTimeObj,
                        scheduleId: schedule._id,
                        scheduleName: schedule.scheduleName,
                        effectiveDriver: tripDriverId && driverMap[tripDriverId] ? driverMap[tripDriverId] : null,
                        effectiveVehicle: tripVehicleId && vehicleMap[tripVehicleId] ? vehicleMap[tripVehicleId] : null
                    });
                }
            }

            // Location filtering - now includes schedule stops
            let shouldInclude = true
            if (filterType === "matched" && (pickupLocation || dropoffLocation)) {
                const pickupMatch = isLocationMatch(pickupLocation, route.fromLocation, route.toLocation, route.stopPoints, scheduleStops)
                const dropMatch = isLocationMatch(dropoffLocation, route.fromLocation, route.toLocation, route.stopPoints, scheduleStops)
                shouldInclude = pickupMatch && dropMatch
            }
            if (!shouldInclude) continue

            // Combine route-level and schedule-level stops for travel path
            const allStopsForPath = [...(route.stopPoints || []), ...scheduleStops]
            // Remove duplicate stops by location (case-insensitive)
            const uniqueStopsUnsorted = allStopsForPath.filter((stop, index, self) =>
                index === self.findIndex(s =>
                    normalize(s.location || s) === normalize(stop.location || stop)
                )
            )

            // Sort stops by time to ensure correct order
            const uniqueStops = sortStopsByTime(uniqueStopsUnsorted)

            // Build travel path using route data (with or without schedule)
            const travelData = getTravelPath({
                from: route.fromLocation,
                to: route.toLocation,
                stops: uniqueStops,
                inboundStart: route.startTime || "",
                pickupLocation,
                dropoffLocation,
                selectedDays: parsedSelectedDays,
                availableDays: routeAvailableDays,
            })

            if (!travelData) continue

            // Extract intermediate stops from travelPath (excluding from and to locations)
            // This ensures we only show stops that are actually between pickup and dropoff
            const intermediateStopsFromPath = travelData.travelPath
                .filter(stop => !stop.isFromLocation && !stop.isToLocation && stop.isStop)
                .map(stop => ({ location: stop.location, time: stop.time }))

            // Get upcoming trips
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const upcomingTrips = await B2CPartnerTrip.find({
                routeId: route._id,
                tripDate: { $gte: today },
                status: "Scheduled"
            }).sort({ tripDate: 1, startTime: 1 }).limit(10)

            const formattedTrips = upcomingTrips.map(trip => ({
                tripId: trip._id,
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                endTime: trip.endTime,
                tripType: trip.tripType,
                fromLocation: trip.fromLocation,
                toLocation: trip.toLocation,
                stopPoints: trip.stopPoints || [],
                totalSeats: trip.totalSeats,
                availableSeats: trip.availableSeats,
                pricing: trip.pricing,
            }))

            // Calculate dynamic available seats based on active monthly passes
            const activePassCount = await B2CMonthlyPass.countDocuments({
                routeId: route._id,
                status: { $in: ['ACTIVE', 'active', 'Active'] },
                endDate: { $gte: new Date() }
            });
            const totalSeats = route.totalSeats || route.assignedVehicle?.seatingCapacity || 35;
            const dynamicAvailableSeats = Math.max(0, totalSeats - activePassCount);

            routes.push({
                routeId: route._id,
                operator: route.b2cPartnerId?.fullName || "Unknown Operator",
                operatorId: route.b2cPartnerId?._id,
                companyLogo: route.b2cPartnerId?.companyLogo || route.b2cPartnerId?.profileImage || null,

                fromLocation: travelData.fromLocation,
                toLocation: travelData.toLocation,
                travelPath: travelData.travelPath,

                scheduleId: schedule?._id || null,
                scheduleName: schedule?.scheduleName || "Default Schedule",
                availableDays: routeAvailableDays,
                tripTimes: populatedTripTimes,
                upcomingTrips: formattedTrips,

                pickupArrivalTime: travelData.pickupArrivalTime,
                dropoffArrivalTime: travelData.dropoffArrivalTime,
                departureTime: route.startTime || "",
                startDate: route.routeStartDate,
                tripType: route.tripType || "One Way",
                pricing: {
                    oneWayPrice: route.pricing?.oneWayPrice,
                    roundTripPrice: route.pricing?.roundTripPrice,
                    monthlyOneWayPrice: route.pricing?.monthlyOneWayPrice,
                    monthlyRoundTripPrice: route.pricing?.monthlyRoundTripPrice,
                    currency: route.pricing?.currency || "KWD" // Add currency field
                },
                roundTripPrice: route.pricing?.roundTripPrice,
                oneWayPrice: route.pricing?.oneWayPrice,
                monthlyPrice: route.pricing?.monthlyOneWayPrice,
                monthlyRoundTripPrice: route.pricing?.monthlyRoundTripPrice,
                availableSeats: dynamicAvailableSeats,
                totalSeats: totalSeats,
                dayMatching: travelData.dayMatching,
                stopPoints: route.stopPoints || [],
                scheduleStops: intermediateStopsFromPath, // Only stops between pickup and dropoff
                allStops: intermediateStopsFromPath, // Only stops between pickup and dropoff
                tags: route.tags || [], // Include tags for filtering and display
                images: (route.images || []).map(img => typeof img === 'string' ? img : img?.url).filter(Boolean),
                type: "b2c",
            })
        }

        return res.status(200).json({
            success: true,
            userType: "guest",
            totalRoutes: routes.length,
            routes,
        })
    } catch (error) {
        console.error("publicSearchRoutes error:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while searching routes",
        })
    }
}

/* ======================================================
   B2C PARTNER DASHBOARD STATS
   - Real data from database
====================================================== */
export const getB2CPartnerDashboardStats = async (req, res) => {
    try {
        const partnerId = req.userId

        // Get partner's active routes
        const activeRoutes = await B2CPartnerRoute.find({
            b2cPartnerId: partnerId,
            status: "Active",
        })
        const routeIds = activeRoutes.map(r => r._id)

        // Get active monthly passes (subscribers)
        const activeSubscribers = await B2CMonthlyPass.countDocuments({
            routeId: { $in: routeIds },
            status: "ACTIVE",
        })

        // Get total subscribers (all time)
        const totalSubscribers = await B2CMonthlyPass.countDocuments({
            routeId: { $in: routeIds },
        })

        // Get monthly revenue (current month)
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const monthlyBookings = await B2CPassengerBooking.find({
            routeId: { $in: routeIds },
            status: { $in: ["CONFIRMED", "COMPLETED"] },
            createdAt: { $gte: startOfMonth },
        })
        const monthlyRevenue = monthlyBookings.reduce((sum, b) => sum + (b.totalAmount || b.amount || 0), 0)

        // Get total revenue (all time)
        const allBookings = await B2CPassengerBooking.find({
            routeId: { $in: routeIds },
            status: { $in: ["CONFIRMED", "COMPLETED"] },
        })
        const totalRevenue = allBookings.reduce((sum, b) => sum + (b.totalAmount || b.amount || 0), 0)

        // Get pending route requests (either assigned to this partner or unassigned)
        const pendingRouteRequests = await RouteRequest.countDocuments({
            $or: [
                { assignedProviderId: partnerId },
                { assignedProviderId: null, status: "PENDING" },
            ],
            status: "PENDING",
        })

        // Get total route requests assigned to this partner
        const totalRouteRequests = await RouteRequest.countDocuments({
            $or: [
                { assignedProviderId: partnerId },
                { assignedProviderId: null },
            ],
        })

        // Get upcoming trips count
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const upcomingTrips = await B2CPartnerTrip.countDocuments({
            b2cPartnerId: partnerId,
            tripDate: { $gte: today },
            status: "Scheduled",
        })

        // Get renewal stats
        const renewalsPending = await B2CMonthlyPass.countDocuments({
            routeId: { $in: routeIds },
            status: "ACTIVE",
            autoRenew: true,
            endDate: {
                $gte: new Date(),
                $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
            }
        })

        // Get subscribers per route
        const subscribersPerRoute = await Promise.all(
            activeRoutes.map(async (route) => {
                const count = await B2CMonthlyPass.countDocuments({
                    routeId: route._id,
                    status: "ACTIVE",
                })
                return {
                    routeId: route._id,
                    routeName: `${route.fromLocation} - ${route.toLocation}`,
                    activeSubscribers: count,
                    totalSeats: route.totalSeats,
                    availableSeats: route.availableSeats,
                }
            })
        )

        // Get currency from routes or default to AED
        const currency = activeRoutes[0]?.currency || "AED"

        return res.status(200).json({
            success: true,
            stats: {
                activeRoutes: activeRoutes.length,
                activeSubscribers,
                totalSubscribers,
                monthlyRevenue,
                totalRevenue,
                currency,
                pendingRouteRequests,
                totalRouteRequests,
                upcomingTrips,
                renewalsPending,
                subscribersPerRoute,
            },
        })
    } catch (error) {
        console.error("getB2CPartnerDashboardStats error:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching dashboard stats",
        })
    }
}

/* ======================================================
   B2C PARTNER ROUTE REQUESTS VIEW
   - Show passenger route requests for this partner
====================================================== */
export const getB2CPartnerRouteRequests = async (req, res) => {
    try {
        const partnerId = req.userId
        const { status, page = 1, limit = 20 } = req.query

        const query = {
            $or: [
                { assignedProviderId: partnerId },
                { assignedProviderId: null },
            ],
        }
        if (status) query.status = status.toUpperCase()

        const routeRequests = await RouteRequest.find(query)
            .populate('passengerId', 'fullName email phone profileImage')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)

        const total = await RouteRequest.countDocuments(query)

        return res.status(200).json({
            success: true,
            data: {
                routeRequests,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    total,
                    hasNext: page * limit < total,
                }
            },
        })
    } catch (error) {
        console.error("getB2CPartnerRouteRequests error:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching route requests",
        })
    }
}

/* ======================================================
   RESPOND TO ROUTE REQUEST
====================================================== */
export const respondToRouteRequest = async (req, res) => {
    try {
        const { requestId } = req.params
        const { status, response } = req.body
        const partnerId = req.userId

        const routeRequest = await RouteRequest.findOne({
            _id: requestId,
            $or: [
                { assignedProviderId: partnerId },
                { assignedProviderId: null },
            ],
        })

        if (!routeRequest) {
            return res.status(404).json({
                success: false,
                message: "Route request not found",
            })
        }

        routeRequest.status = status.toUpperCase()
        routeRequest.providerResponse = response || ""
        routeRequest.assignedProviderId = partnerId
        await routeRequest.save()

        // Get partner info for notification
        const partner = await User.findById(partnerId).select("fullName companyName")
        const partnerName = partner?.fullName || partner?.companyName || "Transport Provider"

        // Determine notification message based on status
        const statusMessages = {
            APPROVED: `Great news! ${partnerName} has approved your route request from ${routeRequest.pickupLocation} to ${routeRequest.dropoffLocation}`,
            REJECTED: `${partnerName} was unable to fulfill your route request from ${routeRequest.pickupLocation} to ${routeRequest.dropoffLocation}`,
            UNDER_REVIEW: `${partnerName} is reviewing your route request from ${routeRequest.pickupLocation} to ${routeRequest.dropoffLocation}`,
        }

        const statusTitles = {
            APPROVED: "Route Request Approved!",
            REJECTED: "Route Request Update",
            UNDER_REVIEW: "Route Request Under Review",
        }

        // Send real-time notification to commuter
        await createNotification({
            userId: routeRequest.passengerId,
            type: "ROUTE_REQUEST_RESPONSE",
            title: statusTitles[routeRequest.status] || "Route Request Update",
            message: statusMessages[routeRequest.status] || `Your route request has been updated to ${routeRequest.status}`,
            data: {
                requestId: routeRequest._id,
                pickupLocation: routeRequest.pickupLocation,
                dropoffLocation: routeRequest.dropoffLocation,
                status: routeRequest.status,
                providerResponse: routeRequest.providerResponse,
                providerId: partnerId,
                providerName: partnerName,
            },
        })

        console.log(`[v0] Route request response notification sent to commuter: ${routeRequest.passengerId}`)

        return res.status(200).json({
            success: true,
            message: `Route request ${status.toLowerCase()} successfully`,
            routeRequest,
        })
    } catch (error) {
        console.error("respondToRouteRequest error:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while responding to route request",
        })
    }
}

// Get B2C Partner Subscription Renewal Status
export const getB2CPartnerSubscriptionRenewals = async (req, res) => {
    try {
        const partnerId = req.userId

        // Get all active monthly passes for this partner
        const passes = await B2CMonthlyPass.find({
            partnerId,
            status: { $in: ["ACTIVE", "EXPIRED"] }
        })
            .populate("passengerId", "name email phone")
            .populate("routeId", "fromLocation toLocation routeName")
            .sort({ endDate: 1 })

        const now = new Date()
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        const renewalData = passes.map(pass => {
            const endDate = new Date(pass.endDate)
            const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))

            let renewalStatus = "active"
            if (daysRemaining <= 0) renewalStatus = "expired"
            else if (daysRemaining <= 7) renewalStatus = "expiring_soon"
            else if (daysRemaining <= 30) renewalStatus = "renewal_upcoming"

            return {
                passId: pass._id,
                passenger: pass.passengerId,
                route: pass.routeId,
                passType: pass.passType,
                startDate: pass.startDate,
                endDate: pass.endDate,
                daysRemaining: Math.max(0, daysRemaining),
                totalAmount: pass.totalAmount,
                autoRenewal: pass.autoRenewal,
                renewalStatus,
                renewalReminderSent: pass.renewalReminderSent
            }
        })

        // Summary counts
        const summary = {
            total: renewalData.length,
            active: renewalData.filter(r => r.renewalStatus === "active").length,
            expiringSoon: renewalData.filter(r => r.renewalStatus === "expiring_soon").length,
            renewalUpcoming: renewalData.filter(r => r.renewalStatus === "renewal_upcoming").length,
            expired: renewalData.filter(r => r.renewalStatus === "expired").length,
            autoRenewalEnabled: renewalData.filter(r => r.autoRenewal).length
        }

        res.status(200).json({
            success: true,
            data: {
                renewals: renewalData,
                summary
            }
        })

    } catch (error) {
        console.error("Error fetching subscription renewals:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching subscription renewals",
        })
    }
}

/* ======================================================
   GET PUBLIC ROUTE DETAILS
   - For mobile app and unauthenticated users
  - Returns B2C Partner route details by ID with ALL schedules
====================================================== */
export const getPublicRouteDetails = async (req, res) => {
    try {
        const { routeId } = req.params

        if (!routeId) {
            return res.status(400).json({
                success: false,
                message: "Route ID is required",
            })
        }

        // Find the route
        const route = await B2CPartnerRoute.findById(routeId)
            .populate('b2cPartnerId', 'fullName companyName email phone profileImage companyLogo')
            .populate('assignedVehicle')
            .populate('assignedDriver')

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            })
        }

        // Get ALL active schedules for this route (supports multiple schedules per route)
        const schedules = await B2CPartnerSchedule.find({
            routeId: route._id,
            isActive: true,
            status: "Active"
        }).populate('assignedVehicle', 'model licensePlate vehicleType seatingCapacity')
            .populate('assignedDriver', 'name phoneNumber')
            .sort({ createdAt: 1 })

        // For backward compatibility, use first schedule where needed
        const schedule = schedules.length > 0 ? schedules[0] : null

        // Collect all driver and vehicle IDs from tripTimes for batch lookup
        const driverIds = new Set();
        const vehicleIds = new Set();
        for (const sch of schedules) {
            if (sch?.tripTimes && sch.tripTimes.length > 0) {
                for (const tt of sch.tripTimes) {
                    if (tt.assignedDriver) driverIds.add(tt.assignedDriver.toString());
                    if (tt.assignedVehicle) vehicleIds.add(tt.assignedVehicle.toString());
                }
            }
        }

        // Convert to ObjectIds for MongoDB query
        const driverObjectIds = Array.from(driverIds).map(id => {
            try { return new mongoose.Types.ObjectId(id); } catch (e) { return null; }
        }).filter(Boolean);
        const vehicleObjectIds = Array.from(vehicleIds).map(id => {
            try { return new mongoose.Types.ObjectId(id); } catch (e) { return null; }
        }).filter(Boolean);

        // Batch fetch drivers
        const b2cDrivers = driverObjectIds.length > 0
            ? await B2CPartnerDriver.find({ _id: { $in: driverObjectIds } }).select('name phoneNumber driverImage email')
            : [];
        const userDrivers = driverObjectIds.length > 0
            ? await User.find({ _id: { $in: driverObjectIds } }).select('fullName whatsappNumber profileImage email')
            : [];
        const vehiclesData = vehicleObjectIds.length > 0
            ? await B2CPartnerVehicle.find({ _id: { $in: vehicleObjectIds } }).select('model licensePlate vehicleType seatingCapacity vehicleColor images')
            : [];

        // Create lookup maps
        const driverMap = {};
        b2cDrivers.forEach(d => {
            driverMap[d._id.toString()] = {
                _id: d._id, name: d.name, phoneNumber: d.phoneNumber,
                image: d.driverImage?.url || null, email: d.email
            };
        });
        userDrivers.forEach(u => {
            if (!driverMap[u._id.toString()]) {
                driverMap[u._id.toString()] = {
                    _id: u._id, name: u.fullName, phoneNumber: u.whatsappNumber,
                    image: u.profileImage || null, email: u.email
                };
            }
        });

        const vehicleMap = {};
        vehiclesData.forEach(v => {
            vehicleMap[v._id.toString()] = {
                _id: v._id, model: v.model, licensePlate: v.licensePlate,
                vehicleType: v.vehicleType, seatingCapacity: v.seatingCapacity,
                vehicleColor: v.vehicleColor, image: v.images?.[0]?.url || null
            };
        });

        // Combine all trip times from all schedules into a unified list with populated driver/vehicle
        const allTripTimes = []
        schedules.forEach(sch => {
            if (sch.tripTimes && sch.tripTimes.length > 0) {
                sch.tripTimes.forEach(tt => {
                    const tripTimeObj = tt.toObject ? tt.toObject() : { ...tt }
                    allTripTimes.push({
                        ...tripTimeObj,
                        scheduleId: sch._id,
                        scheduleName: sch.scheduleName,
                        availableDays: sch.availableDays,
                        scheduleVehicle: sch.assignedVehicle,
                        scheduleDriver: sch.assignedDriver,
                        effectiveDriver: tripDriverId && driverMap[tripDriverId] ? driverMap[tripDriverId] : null,
                        effectiveVehicle: tripVehicleId && vehicleMap[tripVehicleId] ? vehicleMap[tripVehicleId] : null
                    })
                })
            }
        })

        // Get upcoming trips
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const upcomingTrips = await B2CPartnerTrip.find({
            routeId: route._id,
            tripDate: { $gte: today },
            status: "Scheduled"
        }).sort({ tripDate: 1, startTime: 1 }).limit(30)

        const formattedTrips = upcomingTrips.map(trip => ({
            tripId: trip._id,
            tripDate: trip.tripDate,
            startTime: trip.startTime,
            endTime: trip.endTime,
            tripType: trip.tripType,
            fromLocation: trip.fromLocation,
            toLocation: trip.toLocation,
            stopPoints: trip.stopPoints || [],
            totalSeats: trip.totalSeats,
            availableSeats: trip.availableSeats,
            pricing: trip.pricing,
        }))

        // Build response data
        const routeData = {
            _id: route._id,
            routeId: route._id,
            name: route.routeName || `${route.fromLocation} to ${route.toLocation}`,
            routeName: route.routeName,
            fromLocation: route.fromLocation,
            toLocation: route.toLocation,
            pickup: { name: route.fromLocation },
            dropoff: { name: route.toLocation },
            stopPoints: route.stopPoints || [],
            stops: route.stopPoints || [],

            // Partner info
            partner: {
                _id: route.b2cPartnerId?._id,
                companyName: route.b2cPartnerId?.companyName || route.b2cPartnerId?.fullName,
                firstName: route.b2cPartnerId?.fullName,
                profileImage: route.b2cPartnerId?.profileImage,
                companyLogo: route.b2cPartnerId?.companyLogo,
            },
            operator: route.b2cPartnerId?.fullName || route.b2cPartnerId?.companyName || "Unknown",
            operatorId: route.b2cPartnerId?._id,

            // Timing
            departureTime: route.startTime || schedule?.tripTimes?.[0]?.departureTime || "",
            arrivalTime: route.endTime || schedule?.tripTimes?.[0]?.arrivalTime || "",
            startTime: route.startTime,
            endTime: route.endTime,

            // Schedule (backward compatible - first schedule only)
            schedule: schedule?.tripTimes?.map(tt => ({
                day: tt.day || "Daily",
                days: tt.days || schedule?.availableDays || [],
                time: tt.departureTime || tt.startTime,
                departureTime: tt.departureTime || tt.startTime,
            })) || [],
            availableDays: schedule?.availableDays || route.availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            tripTimes: schedule?.tripTimes || [],

            // NEW: All schedules and combined trip times for multi-schedule support
            schedules: schedules.map(sch => ({
                _id: sch._id,
                scheduleName: sch.scheduleName,
                availableDays: sch.availableDays,
                tripTimes: sch.tripTimes,
                isActive: sch.isActive,
                status: sch.status,
                assignedVehicle: sch.assignedVehicle,
                assignedDriver: sch.assignedDriver,
                startDate: sch.startDate,
                endDate: sch.endDate
            })),
            allTripTimes: allTripTimes, // Combined trip times from ALL schedules
            totalSchedules: schedules.length,

            upcomingTrips: formattedTrips,

            // Pricing
            pricing: route.pricing || {},
            fare: route.pricing?.oneWayPrice || 0,
            price: route.pricing?.oneWayPrice || 0,
            oneWayPrice: route.pricing?.oneWayPrice || 0,
            roundTripPrice: route.pricing?.roundTripPrice || 0,
            monthlyPassPrice: route.pricing?.monthlyOneWayPrice || route.pricing?.monthlyRoundTripPrice || 0,
            currency: route.pricing?.currency || "KWD",

            // Seats
            totalSeats: route.totalSeats || 0,
            availableSeats: route.availableSeats || 0,
            capacity: route.totalSeats || 0,
            seatsAvailable: route.availableSeats || 0,

            // Vehicle info
            vehicleType: route.assignedVehicle?.vehicleType || route.vehicleType || "Bus",
            vehicleInfo: route.assignedVehicle ? {
                model: route.assignedVehicle.model,
                licensePlate: route.assignedVehicle.licensePlate,
                vehicleType: route.assignedVehicle.vehicleType,
                seatingCapacity: route.assignedVehicle.seatingCapacity,
                images: route.assignedVehicle.images?.map(img => img?.url || img) || [],
            } : null,

            // Driver info
            driverInfo: route.assignedDriver ? {
                name: route.assignedDriver.name,
                phone: route.assignedDriver.phoneNumber,
                profileImage: route.assignedDriver.driverImage?.url,
            } : null,

            // Additional info
            tripType: route.tripType || "One Way",
            amenities: route.amenities || [],
            images: route.images?.map(img => typeof img === 'string' ? img : img?.url) || [],
            rating: route.rating || null,
            totalRatings: route.totalRatings || 0,
            status: route.status,
            type: "b2c",
        }

        return res.status(200).json({
            success: true,
            data: routeData,
            route: routeData,
        })
    } catch (error) {
        console.error("getPublicRouteDetails error:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching route details",
        })
    }
}

/* ======================================================
   GET ROUTE DETAILS (Authenticated)
   - For authenticated users - includes membership info
====================================================== */
export const getRouteDetails = async (req, res) => {
    try {
        const { routeId } = req.params
        const userId = req.userId

        if (!routeId) {
            return res.status(400).json({
                success: false,
                message: "Route ID is required",
            })
        }

        // Find the route
        const route = await B2CPartnerRoute.findById(routeId)
            .populate('b2cPartnerId', 'fullName companyName email phone profileImage companyLogo')
            .populate('assignedVehicle')
            .populate('assignedDriver')

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            })
        }

        // Get ALL active schedules for this route
        const schedules = await B2CPartnerSchedule.find({
            routeId: route._id,
            isActive: true,
            status: "Active"
        }).populate('assignedVehicle', 'model licensePlate vehicleType seatingCapacity')
            .populate('assignedDriver', 'name phoneNumber')
            .sort({ createdAt: 1 })

        // For backward compatibility, use first schedule where needed
        const schedule = schedules.length > 0 ? schedules[0] : null

        // Collect all driver and vehicle IDs from tripTimes for batch lookup
        const driverIds = new Set();
        const vehicleIds = new Set();
        for (const sch of schedules) {
            if (sch?.tripTimes && sch.tripTimes.length > 0) {
                for (const tt of sch.tripTimes) {
                    if (tt.assignedDriver) driverIds.add(tt.assignedDriver.toString());
                    if (tt.assignedVehicle) vehicleIds.add(tt.assignedVehicle.toString());
                }
            }
        }

        // Convert to ObjectIds for MongoDB query
        const driverObjectIds = Array.from(driverIds).map(id => {
            try { return new mongoose.Types.ObjectId(id); } catch (e) { return null; }
        }).filter(Boolean);
        const vehicleObjectIds = Array.from(vehicleIds).map(id => {
            try { return new mongoose.Types.ObjectId(id); } catch (e) { return null; }
        }).filter(Boolean);

        // Batch fetch drivers
        const b2cDrivers = driverObjectIds.length > 0
            ? await B2CPartnerDriver.find({ _id: { $in: driverObjectIds } }).select('name phoneNumber driverImage email')
            : [];
        const userDrivers = driverObjectIds.length > 0
            ? await User.find({ _id: { $in: driverObjectIds } }).select('fullName whatsappNumber profileImage email')
            : [];
        const vehiclesData = vehicleObjectIds.length > 0
            ? await B2CPartnerVehicle.find({ _id: { $in: vehicleObjectIds } }).select('model licensePlate vehicleType seatingCapacity vehicleColor images')
            : [];

        // Create lookup maps
        const driverMap = {};
        b2cDrivers.forEach(d => {
            driverMap[d._id.toString()] = {
                _id: d._id, name: d.name, phoneNumber: d.phoneNumber,
                image: d.driverImage?.url || null, email: d.email
            };
        });
        userDrivers.forEach(u => {
            if (!driverMap[u._id.toString()]) {
                driverMap[u._id.toString()] = {
                    _id: u._id, name: u.fullName, phoneNumber: u.whatsappNumber,
                    image: u.profileImage || null, email: u.email
                };
            }
        });

        const vehicleMap = {};
        vehiclesData.forEach(v => {
            vehicleMap[v._id.toString()] = {
                _id: v._id, model: v.model, licensePlate: v.licensePlate,
                vehicleType: v.vehicleType, seatingCapacity: v.seatingCapacity,
                vehicleColor: v.vehicleColor, image: v.images?.[0]?.url || null
            };
        });

        // Combine all trip times from all schedules with populated driver/vehicle
        const allTripTimes = []
        schedules.forEach(sch => {
            if (sch.tripTimes && sch.tripTimes.length > 0) {
                sch.tripTimes.forEach(tt => {
                    const tripTimeObj = tt.toObject ? tt.toObject() : { ...tt }
                    const tripDriverId = tt.assignedDriver?.toString();
                    const tripVehicleId = tt.assignedVehicle?.toString();
                    allTripTimes.push({
                        ...tripTimeObj,
                        scheduleId: sch._id,
                        scheduleName: sch.scheduleName,
                        availableDays: sch.availableDays,
                        scheduleVehicle: sch.assignedVehicle,
                        scheduleDriver: sch.assignedDriver,
                        effectiveDriver: tripDriverId && driverMap[tripDriverId] ? driverMap[tripDriverId] : null,
                        effectiveVehicle: tripVehicleId && vehicleMap[tripVehicleId] ? vehicleMap[tripVehicleId] : null
                    })
                })
            }
        })

        // Get upcoming trips
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const upcomingTrips = await B2CPartnerTrip.find({
            routeId: route._id,
            tripDate: { $gte: today },
            status: "Scheduled"
        }).sort({ tripDate: 1, startTime: 1 }).limit(30)

        const formattedTrips = upcomingTrips.map(trip => ({
            tripId: trip._id,
            tripDate: trip.tripDate,
            startTime: trip.startTime,
            endTime: trip.endTime,
            tripType: trip.tripType,
            fromLocation: trip.fromLocation,
            toLocation: trip.toLocation,
            stopPoints: trip.stopPoints || [],
            totalSeats: trip.totalSeats,
            availableSeats: trip.availableSeats,
            pricing: trip.pricing,
        }))

        // Check if user is a member
        const isMember = (route.members || []).some(
            m => m.userId && m.userId.toString() === userId.toString() && m.status === 'ACTIVE'
        )

        // Build response data
        const routeData = {
            _id: route._id,
            routeId: route._id,
            name: route.routeName || `${route.fromLocation} to ${route.toLocation}`,
            routeName: route.routeName,
            fromLocation: route.fromLocation,
            toLocation: route.toLocation,
            pickup: { name: route.fromLocation },
            dropoff: { name: route.toLocation },
            stopPoints: route.stopPoints || [],
            stops: route.stopPoints || [],

            // Partner info
            partner: {
                _id: route.b2cPartnerId?._id,
                companyName: route.b2cPartnerId?.companyName || route.b2cPartnerId?.fullName,
                firstName: route.b2cPartnerId?.fullName,
                profileImage: route.b2cPartnerId?.profileImage,
                companyLogo: route.b2cPartnerId?.companyLogo,
            },
            operator: route.b2cPartnerId?.fullName || route.b2cPartnerId?.companyName || "Unknown",
            operatorId: route.b2cPartnerId?._id,

            // Timing
            departureTime: route.startTime || schedule?.tripTimes?.[0]?.departureTime || "",
            arrivalTime: route.endTime || schedule?.tripTimes?.[0]?.arrivalTime || "",
            startTime: route.startTime,
            endTime: route.endTime,

            // Schedule (backward compatible - first schedule only)
            schedule: schedule?.tripTimes?.map(tt => ({
                day: tt.day || "Daily",
                days: tt.days || schedule?.availableDays || [],
                time: tt.departureTime || tt.startTime,
                departureTime: tt.departureTime || tt.startTime,
            })) || [],
            availableDays: schedule?.availableDays || route.availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            tripTimes: schedule?.tripTimes || [],

            // All schedules and combined trip times for multi-schedule support
            schedules: schedules.map(sch => ({
                _id: sch._id,
                scheduleName: sch.scheduleName,
                availableDays: sch.availableDays,
                tripTimes: sch.tripTimes,
                isActive: sch.isActive,
                status: sch.status,
                assignedVehicle: sch.assignedVehicle,
                assignedDriver: sch.assignedDriver,
                startDate: sch.startDate,
                endDate: sch.endDate
            })),
            allTripTimes: allTripTimes, // Combined trip times from ALL schedules
            totalSchedules: schedules.length,
            upcomingTrips: formattedTrips,

            // Pricing
            pricing: route.pricing || {},
            fare: route.pricing?.oneWayPrice || 0,
            price: route.pricing?.oneWayPrice || 0,
            oneWayPrice: route.pricing?.oneWayPrice || 0,
            roundTripPrice: route.pricing?.roundTripPrice || 0,
            monthlyPassPrice: route.pricing?.monthlyOneWayPrice || route.pricing?.monthlyRoundTripPrice || 0,
            currency: route.pricing?.currency || "KWD",

            // Seats
            totalSeats: route.totalSeats || 0,
            availableSeats: route.availableSeats || 0,
            capacity: route.totalSeats || 0,
            seatsAvailable: route.availableSeats || 0,

            // Vehicle info
            vehicleType: route.assignedVehicle?.vehicleType || route.vehicleType || "Bus",
            vehicleInfo: route.assignedVehicle ? {
                model: route.assignedVehicle.model,
                licensePlate: route.assignedVehicle.licensePlate,
                vehicleType: route.assignedVehicle.vehicleType,
                seatingCapacity: route.assignedVehicle.seatingCapacity,
                images: route.assignedVehicle.images?.map(img => img?.url || img) || [],
            } : null,

            // Driver info
            driverInfo: route.assignedDriver ? {
                name: route.assignedDriver.name,
                phone: route.assignedDriver.phoneNumber,
                profileImage: route.assignedDriver.driverImage?.url,
            } : null,

            // Membership info
            isMember,
            isSaved: isMember,

            // Additional info
            tripType: route.tripType || "One Way",
            amenities: route.amenities || [],
            images: route.images?.map(img => typeof img === 'string' ? img : img?.url) || [],
            rating: route.rating || null,
            totalRatings: route.totalRatings || 0,
            status: route.status,
            type: "b2c",
        }

        return res.status(200).json({
            success: true,
            data: routeData,
            route: routeData,
        })
    } catch (error) {
        console.error("getRouteDetails error:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching route details",
        })
    }
}
