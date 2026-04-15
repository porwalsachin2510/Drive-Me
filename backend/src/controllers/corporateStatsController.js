import Contract from "../models/Contract.js"
import CorporateEmployee from "../models/CorporateEmployee.js"
import Requirement from "../models/Requirement.js"
import VehicleAssignment from "../models/VehicleAssignment.js"
import CorporateBooking from "../models/CorporateBooking.js"
import Route from "../models/Route.js"
import CorporateRouteSchedule from "../models/CorporateRouteSchedule.js"
import Trip from "../models/Trip.js"
import Vehicle from "../models/Vehicle.js"
import Driver from "../models/Driver.js"

export const getCorporateStats = async (req, res) => {
    try {
        const corporateId = req.userId

        // Count active contracts for this corporate (Contract model uses corporateOwnerId)
        const activeContracts = await Contract.countDocuments({
            corporateOwnerId: corporateId,
            status: { $in: ["ACTIVE", "active", "Active"] }
        })

        // Count total employees (CorporateEmployee model uses companyId)
        const totalEmployees = await CorporateEmployee.countDocuments({
            companyId: corporateId
        })

        // Count active vehicle assignments via contracts
        const corporateContracts = await Contract.find(
            { corporateOwnerId: corporateId, status: { $in: ["ACTIVE", "active", "Active"] } },
            { _id: 1 }
        )
        const contractIds = corporateContracts.map(c => c._id)
        const activeRoutes = await VehicleAssignment.countDocuments({
            contractId: { $in: contractIds },
            status: { $in: ["ACTIVE", "active", "Active", "ASSIGNED", "assigned"] }
        })

        // Count monthly bookings (CorporateBooking model uses corporateOwnerId)
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const monthlyBookings = await CorporateBooking.countDocuments({
            corporateOwnerId: corporateId,
            createdAt: { $gte: startOfMonth }
        })

        // Count active requirements
        const activeRequirements = await Requirement.countDocuments({
            corporateId: corporateId,
            status: { $in: ["OPEN", "open", "ACTIVE", "active", "PENDING", "pending"] }
        })

        res.status(200).json({
            success: true,
            data: {
                activeContracts,
                totalEmployees,
                activeRoutes,
                monthlyBookings,
                activeRequirements
            }
        })
    } catch (error) {
        console.error("Error fetching corporate stats:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch corporate stats",
            data: {
                activeContracts: 0,
                totalEmployees: 0,
                activeRoutes: 0,
                monthlyBookings: 0,
                activeRequirements: 0
            }
        })
    }
}

// @desc    Get all corporate routes with schedules and trip details
// @route   GET /api/corporate/routes
// @access  Private (CORPORATE only)
export const getCorporateRoutes = async (req, res) => {
    try {
        const corporateId = req.userId
        const { status, page = 1, limit = 20 } = req.query

        // Build filter for routes
        let routeFilter = { corporateId }
        if (status) {
            routeFilter.status = status
        }

        // Get routes with related data
        const routes = await Route.find(routeFilter)
            .populate("contractId", "contractNumber status rentalPeriod")
            .populate("vehicleId", "vehicleName registrationNumber vehicleCategory capacity photos")
            .populate("assignedDriver", "name email phone")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        const totalRoutes = await Route.countDocuments(routeFilter)

        // Get route schedules for each route
        const routeIds = routes.map(r => r._id)
        const schedules = await CorporateRouteSchedule.find({
            routeId: { $in: routeIds },
            corporateId
        })
            .populate("assignedVehicle", "vehicleName registrationNumber vehicleCategory capacity photos")
            .populate("assignedDriver", "name email phone")

        // Create a map of schedules by routeId
        const scheduleMap = {}
        schedules.forEach(schedule => {
            const routeIdStr = schedule.routeId.toString()
            if (!scheduleMap[routeIdStr]) {
                scheduleMap[routeIdStr] = []
            }
            scheduleMap[routeIdStr].push(schedule)
        })

        // Get today's trips for each route
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const todayTrips = await Trip.find({
            routeId: { $in: routeIds },
            corporateId,
            tripDate: { $gte: today, $lt: tomorrow }
        })
            .populate("vehicleId", "vehicleName registrationNumber")
            .populate("driverId", "name phone")
            .sort({ startTime: 1 })

        // Create a map of today's trips by routeId
        const tripMap = {}
        todayTrips.forEach(trip => {
            const routeIdStr = trip.routeId.toString()
            if (!tripMap[routeIdStr]) {
                tripMap[routeIdStr] = []
            }
            tripMap[routeIdStr].push(trip)
        })

        // Combine route data with schedules and trips
        const routesWithDetails = routes.map(route => {
            const routeIdStr = route._id.toString()
            const routeSchedules = scheduleMap[routeIdStr] || []
            const routeTodayTrips = tripMap[routeIdStr] || []

            // Calculate trip statistics
            const scheduledTrips = routeTodayTrips.filter(t => t.status === "SCHEDULED").length
            const inProgressTrips = routeTodayTrips.filter(t => t.status === "IN_PROGRESS").length
            const completedTrips = routeTodayTrips.filter(t => t.status === "COMPLETED").length
            const totalPassengers = routeTodayTrips.reduce((sum, t) => sum + (t.bookedSeats || 0), 0)

            return {
                _id: route._id,
                fromLocation: route.fromLocation,
                toLocation: route.toLocation,
                routeStartDate: route.routeStartDate,
                totalDistance: route.totalDistance,
                estimatedDuration: route.estimatedDuration,
                availableDays: route.availableDays,
                routeNotes: route.routeNotes,
                totalSeats: route.totalSeats,
                availableSeats: route.availableSeats,
                pricePerSeat: route.pricePerSeat,
                currency: route.currency,
                status: route.status,
                contract: route.contractId,
                vehicle: route.vehicleId,
                driver: route.assignedDriver,
                schedules: routeSchedules.map(schedule => ({
                    _id: schedule._id,
                    scheduleName: schedule.scheduleName,
                    tripTimes: schedule.tripTimes,
                    availableDays: schedule.availableDays,
                    assignedVehicle: schedule.assignedVehicle,
                    assignedDriver: schedule.assignedDriver,
                    startDate: schedule.startDate,
                    endDate: schedule.endDate,
                    isActive: schedule.isActive,
                    status: schedule.status,
                    totalSeats: schedule.totalSeats
                })),
                todayTrips: routeTodayTrips.map(trip => ({
                    _id: trip._id,
                    tripDate: trip.tripDate,
                    startTime: trip.startTime,
                    endTime: trip.endTime,
                    tripType: trip.tripType,
                    direction: trip.direction,
                    status: trip.status,
                    totalSeats: trip.totalSeats,
                    bookedSeats: trip.bookedSeats,
                    availableSeats: trip.availableSeats,
                    vehicle: trip.vehicleId,
                    driver: trip.driverId,
                    passengerCount: trip.passengers?.length || 0
                })),
                statistics: {
                    scheduledTripsToday: scheduledTrips,
                    inProgressTripsToday: inProgressTrips,
                    completedTripsToday: completedTrips,
                    totalPassengersToday: totalPassengers,
                    totalSchedules: routeSchedules.length
                },
                createdAt: route.createdAt,
                updatedAt: route.updatedAt
            }
        })

        // Calculate summary statistics
        const activeRoutes = routes.filter(r => r.status === "ACTIVE").length
        const inactiveRoutes = routes.filter(r => r.status === "INACTIVE").length

        res.status(200).json({
            success: true,
            message: `Retrieved ${routesWithDetails.length} routes`,
            data: {
                routes: routesWithDetails,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalRoutes / limit),
                    totalRoutes,
                    hasMore: page * limit < totalRoutes
                },
                summary: {
                    totalRoutes,
                    activeRoutes,
                    inactiveRoutes,
                    todayTotalTrips: todayTrips.length,
                    todayScheduledTrips: todayTrips.filter(t => t.status === "SCHEDULED").length,
                    todayInProgressTrips: todayTrips.filter(t => t.status === "IN_PROGRESS").length,
                    todayCompletedTrips: todayTrips.filter(t => t.status === "COMPLETED").length
                }
            }
        })

    } catch (error) {
        console.error("[v0] Error fetching corporate routes:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch corporate routes",
            error: error.message
        })
    }
}

// @desc    Get single route details with full schedule and trip history
// @route   GET /api/corporate/routes/:routeId
// @access  Private (CORPORATE only)
export const getCorporateRouteDetails = async (req, res) => {
    try {
        const corporateId = req.userId
        const { routeId } = req.params

        // Get route
        const route = await Route.findOne({
            _id: routeId,
            corporateId
        })
            .populate("contractId", "contractNumber status rentalPeriod financials")
            .populate("vehicleId", "vehicleName registrationNumber vehicleCategory capacity photos pricing")
            .populate("assignedDriver", "name email phone licenseNumber experience")

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            })
        }

        // Get all schedules for this route
        const schedules = await CorporateRouteSchedule.find({
            routeId: route._id,
            corporateId
        })
            .populate("assignedVehicle", "vehicleName registrationNumber vehicleCategory capacity photos")
            .populate("assignedDriver", "name email phone")

        // Get upcoming trips (next 7 days)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const nextWeek = new Date(today)
        nextWeek.setDate(nextWeek.getDate() + 7)

        const upcomingTrips = await Trip.find({
            routeId: route._id,
            corporateId,
            tripDate: { $gte: today, $lt: nextWeek }
        })
            .populate("vehicleId", "vehicleName registrationNumber")
            .populate("driverId", "name phone")
            .populate("passengers.employeeId", "fullName email")
            .sort({ tripDate: 1, startTime: 1 })

        // Get past trips (last 30 days)
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const pastTrips = await Trip.find({
            routeId: route._id,
            corporateId,
            tripDate: { $gte: thirtyDaysAgo, $lt: today }
        })
            .populate("vehicleId", "vehicleName registrationNumber")
            .populate("driverId", "name phone")
            .sort({ tripDate: -1, startTime: -1 })
            .limit(20)

        // Calculate statistics
        const totalTripsThisMonth = await Trip.countDocuments({
            routeId: route._id,
            corporateId,
            tripDate: { $gte: thirtyDaysAgo }
        })

        const completedTripsThisMonth = await Trip.countDocuments({
            routeId: route._id,
            corporateId,
            tripDate: { $gte: thirtyDaysAgo },
            status: "COMPLETED"
        })

        res.status(200).json({
            success: true,
            message: "Route details retrieved successfully",
            data: {
                route: {
                    _id: route._id,
                    fromLocation: route.fromLocation,
                    toLocation: route.toLocation,
                    routeStartDate: route.routeStartDate,
                    totalDistance: route.totalDistance,
                    estimatedDuration: route.estimatedDuration,
                    availableDays: route.availableDays,
                    routeNotes: route.routeNotes,
                    totalSeats: route.totalSeats,
                    availableSeats: route.availableSeats,
                    pricePerSeat: route.pricePerSeat,
                    currency: route.currency,
                    status: route.status,
                    contract: route.contractId,
                    vehicle: route.vehicleId,
                    driver: route.assignedDriver,
                    createdAt: route.createdAt,
                    updatedAt: route.updatedAt
                },
                schedules: schedules.map(schedule => ({
                    _id: schedule._id,
                    scheduleName: schedule.scheduleName,
                    tripTimes: schedule.tripTimes,
                    availableDays: schedule.availableDays,
                    assignedVehicle: schedule.assignedVehicle,
                    assignedDriver: schedule.assignedDriver,
                    startDate: schedule.startDate,
                    endDate: schedule.endDate,
                    isActive: schedule.isActive,
                    status: schedule.status,
                    totalSeats: schedule.totalSeats
                })),
                upcomingTrips: upcomingTrips.map(trip => ({
                    _id: trip._id,
                    tripDate: trip.tripDate,
                    startTime: trip.startTime,
                    endTime: trip.endTime,
                    tripType: trip.tripType,
                    direction: trip.direction,
                    status: trip.status,
                    totalSeats: trip.totalSeats,
                    bookedSeats: trip.bookedSeats,
                    availableSeats: trip.availableSeats,
                    vehicle: trip.vehicleId,
                    driver: trip.driverId,
                    passengers: trip.passengers
                })),
                pastTrips: pastTrips.map(trip => ({
                    _id: trip._id,
                    tripDate: trip.tripDate,
                    startTime: trip.startTime,
                    endTime: trip.endTime,
                    tripType: trip.tripType,
                    direction: trip.direction,
                    status: trip.status,
                    totalSeats: trip.totalSeats,
                    bookedSeats: trip.bookedSeats,
                    passengerCount: trip.passengers?.length || 0
                })),
                statistics: {
                    totalTripsThisMonth,
                    completedTripsThisMonth,
                    completionRate: totalTripsThisMonth > 0
                        ? Math.round((completedTripsThisMonth / totalTripsThisMonth) * 100)
                        : 0,
                    totalSchedules: schedules.length,
                    activeSchedules: schedules.filter(s => s.isActive).length,
                    upcomingTripsCount: upcomingTrips.length
                }
            }
        })

    } catch (error) {
        console.error("[v0] Error fetching route details:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch route details",
            error: error.message
        })
    }
}

