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

// Check location match (from / to / stops)
const isLocationMatch = (searchLocation, from, to, stops = []) => {
    if (!searchLocation) return true
    const search = normalize(searchLocation)

    if (from && normalize(from).includes(search)) return true
    if (to && normalize(to).includes(search)) return true

    return stops.some((stop) => {
        const stopLocation = typeof stop === "string" ? stop : stop.location
        return normalize(stopLocation).includes(search)
    })
}

// Build ordered route path with times
const buildFullPathWithTimes = (from, stops = [], to, inboundStart) => {
    const path = []

    // Add fromLocation with inboundStart time
    path.push({
        location: from,
        time: inboundStart || "N/A",
        isFromLocation: true,
    })

    // Add stops with their times
    if (stops && stops.length > 0) {
        stops.forEach((stop) => {
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

    for (const s of stops || []) {
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

        
        // Get B2C Partner Routes directly from B2CPartnerRoute collection
        // Relaxed query to match publicSearchRoutes behavior
        const b2cRoutes = await B2CPartnerRoute.find({
            status: "Active",
            $or: [
                { isActive: true },
                { isActive: { $exists: false } },
                { isActive: null }
            ]
        }).populate('b2cPartnerId', 'fullName companyLogo profileImage')
            .populate('assignedVehicle')
            .populate('assignedDriver')

        for (const route of b2cRoutes) {

            // Get schedule for this route
            console.log("Finding schedule for route:", route._id)
            const schedule = await B2CPartnerSchedule.findOne({
                routeId: route._id,
                isActive: true,
                status: "Active"
            }).populate('routeId')

            // Allow routes without schedule - use route-level data as fallback
            const routeAvailableDays = schedule?.availableDays || route.availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

            if (schedule) {
                console.log("Found schedule:", schedule._id, "with trip times:", schedule.tripTimes?.length || 0)
            } else {
                console.log("No schedule found for route:", route._id, "- using route-level data")
            }

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
                const pickupMatch = isLocationMatch(pickupLocation, route.fromLocation, route.toLocation, route.stopPoints)
                const dropMatch = isLocationMatch(dropoffLocation, route.fromLocation, route.toLocation, route.stopPoints)
                shouldInclude = pickupMatch && dropMatch
            } else {
                shouldInclude = true
            }

            if (!shouldInclude) continue

            // Create travel path with schedule data (fallback to route-level data)
            const travelData = getTravelPath({
                from: route.fromLocation,
                to: route.toLocation,
                stops: route.stopPoints || [],
                inboundStart: route.startTime || "",
                pickupLocation,
                dropoffLocation,
                selectedDays: parsedSelectedDays,
                availableDays: routeAvailableDays,
            })

            if (!travelData) continue

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
                tripTimes: schedule?.tripTimes || [],
                upcomingTrips: formattedTrips,

                // Route data
                pickupArrivalTime: travelData.pickupArrivalTime,
                dropoffArrivalTime: travelData.dropoffArrivalTime,
                departureTime: route.startTime || "",
                startDate: route.routeStartDate,
                tripType: route.tripType || "One Way",
                roundTripPrice: route.pricing?.roundTripPrice,
                oneWayPrice: route.pricing?.oneWayPrice,
                monthlyPrice: route.pricing?.monthlyOneWayPrice,
                monthlyRoundTripPrice: route.pricing?.monthlyRoundTripPrice,
                availableSeats: route.availableSeats,
                totalSeats: route.totalSeats,
                dayMatching: travelData.dayMatching,

                driverName: route.assignedDriver?.name,
                vehicleModel: route.assignedVehicle?.model,
                vehiclePlate: route.assignedVehicle?.licensePlate,
                images: route.assignedVehicle?.images?.map(img => img.url) || [],
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

        // Get all active B2C Partner Routes - relaxed query to include routes with Active status
        // isActive field may not be set on older routes, so we don't require it
        const b2cRoutes = await B2CPartnerRoute.find({
            status: "Active",
            $or: [
                { isActive: true },
                { isActive: { $exists: false } },
                { isActive: null }
            ]
        }).populate('b2cPartnerId', 'fullName companyLogo profileImage')
          .populate('assignedVehicle')
          .populate('assignedDriver')

        for (const route of b2cRoutes) {

            // Get schedule for this route (optional - route might not have a schedule yet)
            const schedule = await B2CPartnerSchedule.findOne({
                routeId: route._id,
                isActive: true,
                status: "Active"
            })

            // Even without schedule, show the route based on its own data
            const routeAvailableDays = schedule?.availableDays || route.availableDays || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

            // Location filtering
            let shouldInclude = true
            if (filterType === "matched" && (pickupLocation || dropoffLocation)) {
                const pickupMatch = isLocationMatch(pickupLocation, route.fromLocation, route.toLocation, route.stopPoints)
                const dropMatch = isLocationMatch(dropoffLocation, route.fromLocation, route.toLocation, route.stopPoints)
                shouldInclude = pickupMatch && dropMatch
            }
            if (!shouldInclude) continue

            // Build travel path using route data (with or without schedule)
            const travelData = getTravelPath({
                from: route.fromLocation,
                to: route.toLocation,
                stops: route.stopPoints || [],
                inboundStart: route.startTime || "",
                pickupLocation,
                dropoffLocation,
                selectedDays: parsedSelectedDays,
                availableDays: routeAvailableDays,
            })

            if (!travelData) continue

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
                tripTimes: schedule?.tripTimes || [],
                upcomingTrips: formattedTrips,

                pickupArrivalTime: travelData.pickupArrivalTime,
                dropoffArrivalTime: travelData.dropoffArrivalTime,
                departureTime: route.startTime || "",
                startDate: route.routeStartDate,
                tripType: route.tripType || "One Way",
                roundTripPrice: route.pricing?.roundTripPrice,
                oneWayPrice: route.pricing?.oneWayPrice,
                monthlyPrice: route.pricing?.monthlyOneWayPrice,
                monthlyRoundTripPrice: route.pricing?.monthlyRoundTripPrice,
                availableSeats: route.availableSeats,
                totalSeats: route.totalSeats,
                dayMatching: travelData.dayMatching,
                stopPoints: route.stopPoints || [],

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

        return res.status(200).json({
            success: true,
            stats: {
                activeRoutes: activeRoutes.length,
                activeSubscribers,
                totalSubscribers,
                monthlyRevenue,
                totalRevenue,
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
