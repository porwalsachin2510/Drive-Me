import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { checkDriverRole } from "../middleware/auth.js";
import {
    getActiveTrip,
    updateLocation,
    startTrip,
    completeTrip,
    reportEmergency,
    delayTrip,
    getDriverLocation
} from "../controllers/driverLocationController.js";

const router = express.Router();

// ROUTE: GET /api/driver/active-trip
// DESCRIPTION: GET ACTIVE TRIP FOR DRIVER
// ACCESS: PROTECTED - DRIVER ROLE ONLY
router.get(
    "/active-trip",
    verifyToken,
    checkDriverRole,
    getActiveTrip,
);

// ROUTE: POST /api/driver/update-location
// DESCRIPTION: UPDATE DRIVER LOCATION
// ACCESS: PROTECTED - DRIVER ROLE ONLY
router.post(
    "/update-location",
    verifyToken,
    checkDriverRole,
    updateLocation,
);

// ROUTE: POST /api/trips/:tripId/start
// DESCRIPTION: START TRIP
// ACCESS: PROTECTED - DRIVER ROLE ONLY
router.post(
    "/trips/:tripId/start",
    verifyToken,
    checkDriverRole,
    startTrip,
);

// ROUTE: POST /api/trips/:tripId/complete
// DESCRIPTION: COMPLETE TRIP
// ACCESS: PROTECTED - DRIVER ROLE ONLY
router.post(
    "/trips/:tripId/complete",
    verifyToken,
    checkDriverRole,
    completeTrip,
);

// ROUTE: POST /api/trips/:tripId/emergency
// DESCRIPTION: REPORT EMERGENCY
// ACCESS: PROTECTED - DRIVER ROLE ONLY
router.post(
    "/trips/:tripId/emergency",
    verifyToken,
    checkDriverRole,
    reportEmergency,
);

// ROUTE: POST /api/trips/:tripId/delay
// DESCRIPTION: REPORT TRIP DELAY
// ACCESS: PROTECTED - DRIVER ROLE ONLY
router.post(
    "/trips/:tripId/delay",
    verifyToken,
    checkDriverRole,
    delayTrip,
);

// ROUTE: GET /api/driver/location/:driverId
// DESCRIPTION: GET DRIVER LOCATION BY ID (for passengers/corporate tracking)
// ACCESS: PROTECTED - ANY AUTHENTICATED USER
router.get(
    "/location/:driverId",
    verifyToken,
    getDriverLocation,
);

export default router;
