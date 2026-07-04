import express from "express"
import { verifyToken } from "../middleware/auth.js"
import {
    checkRouteAvailability,
    createB2CBooking,
    createCorporateBooking,
    acceptB2CBooking,
    rejectB2CBooking,
    completeB2CTrip,
    getPassengerBookings,
    getPartnerBookings,
    getCorporateOwnerBookings,
    verifyBookingPayment,
    handleTapWebhook,
    handleStripeWebhook,
    getAvailableSeats,
    getB2B_PartnerDriverBookings,
    startB2B_PartnerDriverTrip,
    completeB2B_PartnerDriverBooking,
    startB2CTrip,
    getCorporateDriverBookings,
    startCorporateTrip,
    completeCorporateBooking,
    getDailyTripsForBooking,
    cancelBooking,
    getCancellationPreview,
} from "../controllers/bookingController.js"

const router = express.Router()

// Public routes (webhooks)
router.post("/tap-webhook", handleTapWebhook)
router.post("/stripe-webhook", express.raw({ type: "application/json" }), handleStripeWebhook)

// Protected routes
router.post("/check-availability", verifyToken, checkRouteAvailability)
router.get("/available-seats", verifyToken, getAvailableSeats)

// Passenger booking routes
router.post("/b2c", verifyToken, createB2CBooking)
router.post("/corporate", verifyToken, createCorporateBooking)
router.get("/passenger", verifyToken, getPassengerBookings)
router.post("/verify-payment", verifyToken, verifyBookingPayment)

// Partner routes
router.get("/partner", verifyToken, getPartnerBookings)
router.put("/:bookingId/accept", verifyToken, acceptB2CBooking)
router.put("/:bookingId/reject", verifyToken, rejectB2CBooking)
router.put("/:bookingId/start", verifyToken, startB2CTrip)
router.put("/:bookingId/complete", verifyToken, completeB2CTrip)

// Cancel booking
router.put("/:bookingId/cancel", verifyToken, cancelBooking)

// Preview cancellation fee/refund before confirming
router.get("/:bookingId/cancellation-preview", verifyToken, getCancellationPreview)

// Daily trips for a booking
router.get("/:bookingId/daily-trips", verifyToken, getDailyTripsForBooking)

// Corporate owner routes
router.get("/corporate-owner", verifyToken, getCorporateOwnerBookings)

// B2B Partner driver routes
router.get("/b2b-partner/driver/:driverId", verifyToken, getB2B_PartnerDriverBookings)
router.put("/b2b-partner/:bookingId/start", verifyToken, startB2B_PartnerDriverTrip)
router.put("/b2b-partner/:bookingId/complete", verifyToken, completeB2B_PartnerDriverBooking)

// Corporate driver routes
router.get("/corporate/driver/:driverId", verifyToken, getCorporateDriverBookings)
router.put("/corporate/:bookingId/start", verifyToken, startCorporateTrip)
router.put("/corporate/:bookingId/complete", verifyToken, completeCorporateBooking)

export default router
