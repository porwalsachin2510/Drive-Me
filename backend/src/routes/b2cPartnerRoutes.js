import express from "express"
const router = express.Router()
import {
    getB2CPartnerEarnings,
    getB2CPartnerFleet,
    createB2CPartnerVehicle,
    updateB2CPartnerVehicle,
    deleteB2CPartnerVehicle,
    createB2CPartnerTrip,
    getB2CPartnerProfile,
    updateB2CPartnerProfile,
    assignDriverToB2CVehicle,
    assignDriverToB2CRoute,
} from "../controllers/adminController.js"
import {
    createB2CPartnerDriver,
    getB2CPartnerDrivers,
    updateB2CPartnerDriver,
    deleteB2CPartnerDriver,
} from "../controllers/driverController.js"
import {
    createB2CPartnerRoute,
    getB2CPartnerRoutes,
    updateB2CPartnerRoute,
    deleteB2CPartnerRoute,
    getRouteTripSeatAvailability,
    getPublicRouteTripSeatAvailability,
    getSchedulesForRoute
} from "../controllers/b2cTripController.js"
import {
    getB2CPartnerDashboardStats,
    getB2CPartnerRouteRequests,
    respondToRouteRequest,
    getB2CPartnerSubscriptionRenewals
} from "../controllers/commuteSearchController.js"
import { verifyToken, checkB2CPartnerRole } from "../middleware/auth.js"
import { upload } from "../Config/multerConfig.js"

// B2C Partner Earnings
router.get("/earnings", verifyToken, checkB2CPartnerRole, getB2CPartnerEarnings)

// B2C Partner Fleet Management
router.get("/fleet", verifyToken, checkB2CPartnerRole, getB2CPartnerFleet)
router.post(
    "/vehicles", 
    verifyToken, 
    checkB2CPartnerRole, 
    upload.fields([
        { name: "images", maxCount: 10 }
    ]), 
    createB2CPartnerVehicle
)
router.put(
    "/vehicles/:vehicleId", 
    verifyToken, 
    checkB2CPartnerRole, 
    upload.fields([
        { name: "images", maxCount: 10 }
    ]), 
    updateB2CPartnerVehicle
)
router.delete("/vehicles/:vehicleId", verifyToken, checkB2CPartnerRole, deleteB2CPartnerVehicle)

// B2C Partner Drivers Management
router.get("/drivers", verifyToken, checkB2CPartnerRole, getB2CPartnerDrivers)
router.post(
    "/drivers", 
    verifyToken, 
    checkB2CPartnerRole, 
    upload.fields([
        { name: "driverImage", maxCount: 1 },
        { name: "license", maxCount: 1 },
        { name: "passport", maxCount: 1 },
        { name: "visa", maxCount: 1 },
        { name: "medicalCertificate", maxCount: 1 }
    ]), 
    createB2CPartnerDriver
)
router.put(
    "/drivers/:driverId",
    verifyToken,
    checkB2CPartnerRole,
    upload.fields([
        { name: "driverImage", maxCount: 1 }
    ]),
    updateB2CPartnerDriver
)
router.delete("/drivers/:driverId", verifyToken, checkB2CPartnerRole, deleteB2CPartnerDriver)

// B2C Partner Routes
router.get("/routes", verifyToken, checkB2CPartnerRole, getB2CPartnerRoutes)
router.post("/routes", verifyToken, checkB2CPartnerRole, createB2CPartnerRoute)
router.put("/routes/:routeId", verifyToken, checkB2CPartnerRole, updateB2CPartnerRoute)
router.delete("/routes/:routeId", verifyToken, checkB2CPartnerRole, deleteB2CPartnerRoute)
router.get("/routes/:routeId/trips/seat-availability", verifyToken, checkB2CPartnerRole, getRouteTripSeatAvailability)
router.get("/public/routes/:routeId/trips/seat-availability", getPublicRouteTripSeatAvailability)

// Get all schedules for a route (for commuter booking - returns ALL schedules)
router.get("/routes/:routeId/schedules", getSchedulesForRoute)

// B2C Partner Assign Driver to Vehicle
router.post("/vehicles/:vehicleId/assign-driver", verifyToken, checkB2CPartnerRole, assignDriverToB2CVehicle)

// B2C Partner Assign Driver to Route
router.post("/assign-driver-route", verifyToken, checkB2CPartnerRole, assignDriverToB2CRoute)

// B2C Partner Trips
router.post("/trips", verifyToken, checkB2CPartnerRole, createB2CPartnerTrip)

// B2C Partner Dashboard Stats
router.get("/dashboard-stats", verifyToken, checkB2CPartnerRole, getB2CPartnerDashboardStats)

// B2C Partner Route Requests (from passengers)
router.get("/route-requests", verifyToken, checkB2CPartnerRole, getB2CPartnerRouteRequests)
router.put("/route-requests/:requestId/respond", verifyToken, checkB2CPartnerRole, respondToRouteRequest)

// B2C Partner Profile
router.get("/profile", verifyToken, checkB2CPartnerRole, getB2CPartnerProfile)
router.put("/profile", verifyToken, checkB2CPartnerRole, updateB2CPartnerProfile)
router.put("/profile/image", verifyToken, checkB2CPartnerRole, upload.single('profileImage'), updateB2CPartnerProfile)

// B2C Partner Subscription Renewals
router.get("/subscription-renewals", verifyToken, checkB2CPartnerRole, getB2CPartnerSubscriptionRenewals)

export default router
