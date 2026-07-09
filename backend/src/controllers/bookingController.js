import B2CPassengerBooking from "../models/B2CPassengerBooking.js"
import CorporateBooking from "../models/CorporateBooking.js"
import Trip from "../models/Trip.js"
import User from "../models/User.js"
import Route from "../models/Route.js"
import B2CPartnerRoute from "../models/B2CPartnerRoute.js"
import B2CPartnerTrip from "../models/B2CPartnerTrip.js"
import B2CPartnerDriver from "../models/B2CPartnerDriver.js"
import Wallet from "../models/Wallet.js"
import Notification from "../models/Notification.js"
import Transaction from "../models/Transaction.js"
import CancellationSettings from "../models/CancellationSettings.js"
import { recordCashCancellationDue, deductCashCancellationFromWallet, checkBookingEligibility } from "../Services/cashCancellationService.js"
import stripe from "../Config/stripe.js"
import tapPayments from "../Config/tapPayments.js"
import { calculateCommission, calculateDriverCommission, calculateDynamicCommission } from "../Services/HelperUtilities.js"
import { sendRealTimeNotification, sendBookingUpdate } from "../Services/socketService.js"
import { createNotification } from "./notificationController.js"
import { sendAdminNotification } from "../Services/notificationService.js"
import { setBookingDeadlines } from "../cron/bookingTimeoutCron.js"
import { getOrCreateWallet } from "../Services/walletService.js"

/**
 * Resolve the fare base used for cancellation-fee / cash-due math.
 *
 * Normally this is simply the stored `paymentAmount`. But some bookings were
 * created with a wrong/zero fare (a historical pricing-field bug stored
 * paymentAmount = 0). A zero base makes the cash-cancellation due compute to 0,
 * which silently let cash cancellations through with no charge. To make the
 * policy robust regardless of stored data, when the stored fare is missing/zero
 * we reconstruct it from the route's configured pricing.
 *
 * @returns {Promise<number>} a non-negative fare base
 */
async function resolveBookingFareBase(booking, bookingType) {
    const stored = Number(booking.paymentAmount) || Number(booking.totalAmount) || 0
    if (stored > 0) return stored
    // Only B2C bookings carry a B2CPartnerRoute we can reconstruct pricing from.
    if (bookingType !== "B2C" || !booking.routeId) return stored

    try {
        const route = await B2CPartnerRoute.findById(booking.routeId).select("pricing")
        const p = route && route.pricing ? route.pricing : null
        if (!p) return stored

        const seats = Number(booking.numberOfSeats) > 0 ? Number(booking.numberOfSeats) : 1
        const months = Number(booking.passDuration) > 0 ? Number(booking.passDuration) : 1
        const isRound = booking.bookingType === "ROUND_TRIP"

        const perSeatMonthly = isRound
            ? (Number(p.monthlyRoundTripPrice) || (Number(p.monthlyOneWayPrice) ? Number(p.monthlyOneWayPrice) * 1.5 : 0))
            : Number(p.monthlyOneWayPrice) || 0
        const perSeatSingle = isRound
            ? (Number(p.roundTripPrice) || (Number(p.oneWayPrice) ? Number(p.oneWayPrice) * 1.5 : 0))
            : Number(p.oneWayPrice) || 0

        let fare = 0
        if (booking.isMonthlyPass && perSeatMonthly > 0) {
            fare = perSeatMonthly * months * seats
        } else if (perSeatMonthly > 0) {
            fare = perSeatMonthly * seats
        } else if (perSeatSingle > 0) {
            fare = perSeatSingle * seats
        }

        const resolved = Math.round((fare || 0) * 1000) / 1000
        if (resolved > 0) {
            console.log("[resolveBookingFareBase] Reconstructed fare from route pricing:", {
                bookingId: String(booking._id),
                storedPaymentAmount: stored,
                resolvedFareBase: resolved,
                isMonthlyPass: !!booking.isMonthlyPass,
                seats,
                months,
            })
        }
        return resolved
    } catch (e) {
        console.error("[resolveBookingFareBase] Failed to reconstruct fare:", e.message)
        return stored
    }
}

// Check if route is available for booking
export const checkRouteAvailability = async (req, res) => {
    try {
        const { routeId, travelDate } = req.body
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const travelDateObj = new Date(travelDate)
        travelDateObj.setHours(0, 0, 0, 0)

        if (travelDateObj < today) {
            return res.status(400).json({
                success: false,
                message: "Cannot book for past dates",
                isAvailable: false,
            })
        }

        const route = await Route.findById(routeId)
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
                isAvailable: false,
            })
        }

        const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
        const dayOfWeek = daysOfWeek[travelDateObj.getDay()]

        const routeStartDate = new Date(route.startDate)
        routeStartDate.setHours(0, 0, 0, 0)

        if (travelDateObj < routeStartDate) {
            return res.status(200).json({
                success: true,
                isAvailable: false,
                reason: "Route has not started yet",
                dayOfWeek,
                startDate: route.startDate,
            })
        }

        const isAvailableDay = route.availableDays && route.availableDays.includes(dayOfWeek)

        if (!isAvailableDay) {
            return res.status(200).json({
                success: true,
                isAvailable: false,
                reason: "Route not available on this day",
                dayOfWeek,
                availableDays: route.availableDays,
            })
        }

        const b2cBookedSeats = await B2CPassengerBooking.aggregate([
            {
                $match: {
                    routeId: route._id,
                    travelDate: {
                        $gte: new Date(new Date(travelDate).setHours(0, 0, 0, 0)),
                        $lt: new Date(new Date(travelDate).setHours(23, 59, 59, 999)),
                    },
                    bookingStatus: { $in: ["CONFIRMED", "PENDING"] },
                },
            },
            {
                $group: {
                    _id: null,
                    totalSeats: { $sum: "$numberOfSeats" },
                },
            },
        ])

        const corporateBookedSeats = await CorporateBooking.aggregate([
            {
                $match: {
                    routeId: route._id,
                    travelDate: {
                        $gte: new Date(new Date(travelDate).setHours(0, 0, 0, 0)),
                        $lt: new Date(new Date(travelDate).setHours(23, 59, 59, 999)),
                    },
                    bookingStatus: { $in: ["CONFIRMED"] },
                },
            },
            {
                $group: {
                    _id: null,
                    totalSeats: { $sum: "$numberOfSeats" },
                },
            },
        ])

        const totalBookedSeats = (b2cBookedSeats[0]?.totalSeats || 0) + (corporateBookedSeats[0]?.totalSeats || 0)
        const availableSeats = (route.totalSeats || route.availableSeats || 0) - totalBookedSeats

        return res.status(200).json({
            success: true,
            isAvailable: availableSeats > 0,
            dayOfWeek,
            availableSeats: Math.max(0, availableSeats),
            totalSeats: route.totalSeats || route.availableSeats || 0,
            bookedSeats: totalBookedSeats,
            message: availableSeats > 0 ? "Route is available for booking" : "No seats available",
        })
    } catch (error) {
        console.error("Error checking route availability:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while checking availability",
        })
    }
}

// Create B2C Passenger Booking
export const createB2CBooking = async (req, res) => {
    try {
        const passengerId = req.userId
        const {
            routeId,
            partnerId,
            pickupLocation,
            dropoffLocation,
            returnPickupLocation,
            returnDropoffLocation,
            travelDate,
            numberOfSeats = 1,
            paymentMethod,
            paymentAmount,
            travelPath,
            returnTravelPath,
            vehicleModel,
            vehiclePlate,
            driverName,
            driverImage,
            passengerNotes,
            bookingType,
            linkedSchedule,
            linkedTrip,
            linkedReturnTrip,
        } = req.body

        console.log("B2C Booking Request:", req.body);

        if (!passengerId || !partnerId || !pickupLocation || !dropoffLocation || !travelDate || !paymentAmount) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            })
        }

        // ===== CASH CANCELLATION ACCOUNTABILITY GUARD =====
        // A commuter who has an unpaid cash-cancellation due (or a negative wallet
        // balance, which IS the unpaid due) is blocked from creating ANY new booking
        // until the due is cleared. This is the same guard used by the trip/monthly-pass
        // booking endpoints — adding it here closes the Home page + Find Routes booking
        // path (POST /api/bookings/b2c) that previously let a commuter keep booking
        // without ever paying their cancellation charge.
        const eligibility = await checkBookingEligibility(passengerId)
        if (!eligibility.allowed) {
            return res.status(403).json({
                success: false,
                code: eligibility.code,
                outstandingDue: eligibility.outstandingDue,
                currency: eligibility.currency,
                message: eligibility.message,
            })
        }

        const passenger = await User.findById(passengerId)
        if (!passenger) {
            return res.status(404).json({
                success: false,
                message: "Passenger not found",
            })
        }

        // ===== CASH CANCELLATION ACCOUNTABILITY GUARD =====
        // Block new bookings if the commuter has an unpaid cash-cancellation due,
        // This is the enforcement that protects partners/admin from the
        // "book cash -> cancel -> repeat" abuse: an unpaid cancellation due blocks
        // ALL new bookings until it is cleared. There is no strike-based cash
        // disabling — commuters may cancel any number of times, they are simply
        // charged each time and must clear the due to book again.
        const cc = passenger.cashCancellation || {}
        if (cc.isBlocked || (cc.outstandingDue || 0) > 0) {
            return res.status(403).json({
                success: false,
                code: "OUTSTANDING_CANCELLATION_DUE",
                outstandingDue: cc.outstandingDue || 0,
                currency: cc.currency || "KWD",
                message: cc.blockedReason
                    || `You have an unpaid cancellation fee of ${cc.currency || "KWD"} ${(cc.outstandingDue || 0).toFixed(2)}. Please clear it before making a new booking.`,
            })
        }

        // Safety net: the cash-cancellation fee is deducted directly from the
        // commuter's wallet, which is allowed to go negative. A negative balance
        // IS an unpaid due, so block new bookings until the commuter tops up to >= 0.
        const passengerWallet = await Wallet.findOne({ userId: passengerId })
        if (passengerWallet && passengerWallet.balance < 0) {
            const owed = Math.abs(passengerWallet.balance)
            return res.status(403).json({
                success: false,
                code: "OUTSTANDING_CANCELLATION_DUE",
                outstandingDue: Math.round(owed * 100) / 100,
                currency: passengerWallet.currency || cc.currency || "KWD",
                message: `Your wallet balance is negative (${passengerWallet.currency || "KWD"} ${owed.toFixed(2)} due, mostly from a cancellation fee). Please add money to bring your balance back to zero before making a new booking.`,
            })
        }

        const b2cPartner = await User.findById(partnerId)
        if (!b2cPartner || b2cPartner.role !== "B2C_PARTNER") {
            return res.status(404).json({
                success: false,
                message: "B2C Partner not found",
            })
        }

        // NEW LOGIC: Find B2C Partner Route
        const b2cRoute = await B2CPartnerRoute.findById(routeId)
        if (!b2cRoute) {
            return res.status(404).json({
                success: false,
                message: "B2C Route not found",
            })
        }

        // NEW LOGIC: Find linked trip for monthly pass
        let targetTrip = null;
        let targetReturnTrip = null;
        if (linkedTrip) {
            targetTrip = await B2CPartnerTrip.findById(linkedTrip)
            if (!targetTrip) {
                return res.status(404).json({
                    success: false,
                    message: "Linked trip not found",
                })
            }
        }

        // NEW LOGIC: Find return trip for round trip
        if (linkedReturnTrip) {
            targetReturnTrip = await B2CPartnerTrip.findById(linkedReturnTrip)
            if (!targetReturnTrip) {
                return res.status(404).json({
                    success: false,
                    message: "Linked return trip not found",
                })
            }
        }

        // NEW LOGIC: Monthly pass seat validation
        if (bookingType === "ONE_WAY" || bookingType === "ROUND_TRIP") {
            // For monthly passes, check if seats are available for entire month
            if (!targetTrip) {
                return res.status(400).json({
                    success: false,
                    message: "Monthly pass requires trip selection",
                })
            }

            // For round trip, validate both trips
            if (bookingType === "ROUND_TRIP" && !targetReturnTrip) {
                return res.status(400).json({
                    success: false,
                    message: "Round trip pass requires return trip selection",
                })
            }

            if (numberOfSeats > targetTrip.availableSeats) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${targetTrip.availableSeats} seat(s) available for morning trip`,
                })
            }

            // Check return trip seats for round trip
            if (bookingType === "ROUND_TRIP" && numberOfSeats > targetReturnTrip.availableSeats) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${targetReturnTrip.availableSeats} seat(s) available for evening trip`,
                })
            }

            console.log(`Monthly pass booking: ${bookingType} for trip ${linkedTrip}, seats: ${numberOfSeats}`);
        } else {
            // Legacy single day booking logic
            console.log("Single day booking (legacy mode)");
        }

        // Use dynamic commission based on B2C Partner's settings
        const commissionData = await calculateDynamicCommission(partnerId, paymentAmount, "BOOKING")
        console.log("[v0] Dynamic Commission for B2C Partner booking:", {
            partnerId,
            paymentAmount,
            appliedRate: commissionData.appliedRate,
            adminCommission: commissionData.adminCommission,
            partnerEarnings: commissionData.partnerAmount
        })

        // NEW LOGIC: Determine driver assignment
        let assignedDriverId = null;
        let assignedDriverName = null;
        let assignedDriverImage = null;
        let assignedDriverPhone = null;
        let isSelfDriver = false;

        // For monthly pass bookings, check if route has default driver assignment
        if (bookingType === "ONE_WAY" || bookingType === "ROUND_TRIP") {
            // Check if route has assigned driver (handle both field names)
            const routeDriverId = b2cRoute.assignedDriverId || b2cRoute.assignedDriver;

            console.log("[v0] Driver Assignment Debug:", {
                routeId: b2cRoute._id,
                assignedDriverId: b2cRoute.assignedDriverId,
                assignedDriver: b2cRoute.assignedDriver,
                routeDriverId,
                partnerId
            });

            if (routeDriverId) {
                assignedDriverId = routeDriverId;

                // Check if assigned driver is the partner themselves (self-driver)
                if (routeDriverId.toString() === partnerId.toString()) {
                    isSelfDriver = true;
                    assignedDriverName = b2cPartner.name || b2cPartner.businessName || 'Self';
                    assignedDriverImage = b2cPartner.profileImage || null;
                    assignedDriverPhone = b2cPartner.phone || b2cPartner.whatsappNumber;
                    console.log("[v0] Self-driver detected:", assignedDriverName);
                } else {
                    // Get assigned driver details
                    const assignedDriver = await User.findById(routeDriverId);
                    if (assignedDriver) {
                        assignedDriverName = assignedDriver.name || assignedDriver.fullName;
                        assignedDriverImage = assignedDriver.profileImage || null;
                        assignedDriverPhone = assignedDriver.phone || assignedDriver.whatsappNumber;
                        console.log("[v0] Professional driver found (User table):", assignedDriverName);
                    } else {
                        // Try to get from B2CPartnerDriver table
                        const b2cDriver = await B2CPartnerDriver.findById(routeDriverId);
                        if (b2cDriver) {
                            assignedDriverName = b2cDriver.name;
                            assignedDriverImage = b2cDriver.driverImage?.url;
                            assignedDriverPhone = b2cDriver.phoneNumber;
                            console.log("[v0] Professional driver found (B2CPartnerDriver table):", assignedDriverName);
                        } else {
                            console.log("[v0] Driver not found in any table for ID:", routeDriverId);
                        }
                    }
                }
            } else {
                // No driver assigned to route, use partner as default
                isSelfDriver = true;
                assignedDriverId = partnerId;
                assignedDriverName = b2cPartner.name || b2cPartner.businessName || 'Self';
                assignedDriverImage = b2cPartner.profileImage || null;
                assignedDriverPhone = b2cPartner.phone || b2cPartner.whatsappNumber;
                console.log("[v0] No driver assigned, using partner as default:", assignedDriverName);
            }
        } else if (targetTrip) {
            // For single day bookings with specific trip
            // Check if driver is assigned to trip
            if (targetTrip.assignedDriverId) {
                assignedDriverId = targetTrip.assignedDriverId;

                // Check if assigned driver is the partner themselves (self-driver)
                if (targetTrip.assignedDriverId.toString() === partnerId.toString()) {
                    isSelfDriver = true;
                    assignedDriverName = b2cPartner.name || b2cPartner.businessName || 'Self';
                    assignedDriverImage = b2cPartner.profileImage || null;
                    assignedDriverPhone = b2cPartner.phone || b2cPartner.whatsappNumber;
                } else {
                    // Get assigned driver details
                    const assignedDriver = await User.findById(targetTrip.assignedDriverId);
                    if (assignedDriver) {
                        assignedDriverName = assignedDriver.name || assignedDriver.fullName;
                        assignedDriverImage = assignedDriver.profileImage || null;
                        assignedDriverPhone = assignedDriver.phone || assignedDriver.whatsappNumber;
                    }
                }
            } else {
                // No driver assigned, use partner as default
                isSelfDriver = true;
                assignedDriverId = partnerId;
                assignedDriverName = b2cPartner.name || b2cPartner.businessName || 'Self';
                assignedDriverImage = b2cPartner.profileImage || null;
                assignedDriverPhone = b2cPartner.phone || b2cPartner.whatsappNumber;
            }
        } else {
            // Legacy mode - use partner as driver
            isSelfDriver = true;
            assignedDriverId = partnerId;
            assignedDriverName = b2cPartner.name || b2cPartner.businessName || 'Self';
            assignedDriverImage = b2cPartner.profileImage || null;
            assignedDriverPhone = b2cPartner.phone || b2cPartner.whatsappNumber;
        }

        console.log("Driver Assignment:", {
            assignedDriverId,
            assignedDriverName,
            isSelfDriver,
            partnerId
        });

        // NEW LOGIC: Create monthly pass booking
        const booking = new B2CPassengerBooking({
            passengerId,
            b2cPartnerId: partnerId,
            partnerId,

            // Route reference
            routeId: b2cRoute._id,

            // NEW MONTHLY PASS FIELDS
            bookingType: bookingType || "ONE_WAY",
            linkedSchedule: linkedSchedule,
            linkedTrip: linkedTrip,
            linkedReturnTrip: linkedReturnTrip,

            // Journey details
            pickupLocation,
            dropoffLocation,
            returnPickupLocation,
            returnDropoffLocation,
            travelPath,
            returnTravelPath,
            bookingDate: new Date(),
            travelDate,
            numberOfSeats,

            // Payment details
            paymentAmount,
            currency: b2cRoute.pricing?.currency || "KWD",
            paymentMethod,
            bookingStatus: "PENDING",

            // Driver assignment details
            assignedDriverId,
            driverName: assignedDriverName,
            driverImage: assignedDriverImage,
            driverPhoneNumber: assignedDriverPhone,
            isSelfDriver, // NEW: Flag to identify self-driver bookings

            // Trip specific details
            vehicleModel: targetTrip?.vehicleInfo?.model || vehicleModel,
            vehiclePlate: targetTrip?.vehicleInfo?.licensePlate || vehiclePlate,
            passengerNotes,

            // Commission - always calculate for both CASH and STRIPE
            // For CASH: B2C Partner collects full amount from Commuter, then pays commission to Admin
            // For STRIPE: Admin receives full amount, then credits B2C Partner's earnings
            adminCommissionAmount: commissionData.adminCommission,
            appliedCommissionRate: commissionData.appliedRate, // Store dynamic rate
            driverEarnings: commissionData.partnerAmount,
        })

        // Set acceptance deadlines for booking timeout feature
        // Warning at 20 hours, auto-cancel at 24 hours
        setBookingDeadlines(booking);
        await booking.save()

        // NEW LOGIC: For monthly passes, don't reduce seats immediately
        // Seats will be managed daily when passenger boards
        if (bookingType !== "ONE_WAY" && bookingType !== "ROUND_TRIP") {
            // Legacy single day booking - reduce seats immediately
            const numberOfSeatsInt = Number.parseInt(numberOfSeats) || numberOfSeats
            await B2CPartnerRoute.findByIdAndUpdate(
                routeId,
                { $inc: { availableSeats: -numberOfSeatsInt } }
            )
        } else if (paymentMethod === "TAP") {
            const chargeData = await tapPayments.createCharge({
                amount: paymentAmount,
                currency: "AED",
                customer: {
                    firstName: passenger.fullName?.split(" ")[0] || "Customer",
                    lastName: passenger.fullName?.split(" ").slice(1).join(" ") || "",
                    email: passenger.email,
                    countryCode: "971",
                    phone: passenger.whatsappNumber || passenger.phone || "",
                },
                redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/booking/success?booking_id=${booking._id}`,
                webhookUrl: `${process.env.BACKEND_URL}/api/bookings/tap-webhook`,
                metadata: {
                    bookingId: booking._id.toString(),
                    type: "B2C_BOOKING",
                },
                description: `DriveMe Booking: ${pickupLocation} to ${dropoffLocation}`,
            })

            booking.transactionId = chargeData.id
            booking.paymentStatus = "PENDING"
            await booking.save()

            return res.status(201).json({
                success: true,
                booking,
                paymentData: {
                    provider: "TAP",
                    paymentUrl: chargeData.transaction?.url || chargeData.redirect?.url,
                    chargeId: chargeData.id,
                },
                message: "Booking created. Complete payment to confirm.",
            })
        } else {
            // CASH payment
            // Send notification to partner
            const notification = await createNotification({
                userId: partnerId,
                type: "NEW_BOOKING",
                title: "New Booking Request",
                message: `New booking from ${passenger.fullName} - Amount: AED ${paymentAmount}`,
                relatedUserId: passengerId,
                bookingId: booking._id,
            })

            // Send real-time notification
            await sendRealTimeNotification(partnerId, {
                type: "NEW_BOOKING",
                title: notification.title,
                message: notification.message,
                data: {
                    bookingId: booking._id,
                    passengerId,
                    partnerId,
                    notification
                }
            })

            return res.status(201).json({
                success: true,
                booking,
                message: "Booking created successfully. Partner will review your request.",
            })
        }
    } catch (error) {
        console.error("Error creating B2C booking:", error)
        return res.status(500).json({
            success: false,
            message: error.message || "Server error while creating booking",
        })
    }
}


// Create Corporate Booking
export const createCorporateBooking = async (req, res) => {
    try {
        const passengerId = req.userId
        const {
            routeId,
            contractId,
            corporateOwnerId,
            pickupLocation,
            dropoffLocation,
            travelDate,
            numberOfSeats = 1,
            travelPath,
            vehicleModel,
            vehiclePlate,
            driverName,
            driverImage,
            passengerNotes,
            driverId,
        } = req.body

        // Validate required fields
        if (!driverId) {
            return res.status(400).json({
                success: false,
                message: "Driver ID is required for corporate booking"
            })
        }

        if (!routeId || !corporateOwnerId || !travelDate) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            })
        }

        // ===== CASH CANCELLATION ACCOUNTABILITY GUARD =====
        // Block a passenger with an unpaid cash-cancellation due / negative wallet
        // from creating a new booking until they clear it.
        const eligibility = await checkBookingEligibility(passengerId)
        if (!eligibility.allowed) {
            return res.status(403).json({
                success: false,
                code: eligibility.code,
                outstandingDue: eligibility.outstandingDue,
                currency: eligibility.currency,
                message: eligibility.message,
            })
        }

        const passenger = await User.findById(passengerId)
        if (!passenger) {
            return res.status(404).json({
                success: false,
                message: "Passenger not found",
            })
        }

        if (!passenger.companyId || passenger.companyId.toString() !== corporateOwnerId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: Employee does not belong to this company",
            })
        }

        if (numberOfSeats > 1) {
            return res.status(400).json({
                success: false,
                message: "Corporate employees can only book 1 seat per journey",
            })
        }

        const route = await Route.findById(routeId)
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            })
        }

        // Validate driver exists and is a corporate driver
        const driver = await User.findById(driverId)
        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            })
        }

        if (driver.role !== "B2B_PARTNER_DRIVER" && driver.role !== "CORPORATE_DRIVER") {
            return res.status(400).json({
                success: false,
                message: "Assigned user is not a corporate driver",
            })
        }

        const corporateBookedSeatsResult = await CorporateBooking.aggregate([
            {
                $match: {
                    routeId: route._id,
                    travelDate: {
                        $gte: new Date(new Date(travelDate).setHours(0, 0, 0, 0)),
                        $lt: new Date(new Date(travelDate).setHours(23, 59, 59, 999)),
                    },
                    bookingStatus: "CONFIRMED",
                },
            },
            {
                $group: {
                    _id: null,
                    totalSeats: { $sum: "$numberOfSeats" },
                },
            },
        ])

        const bookedSeats = corporateBookedSeatsResult[0]?.totalSeats || 0
        const availableSeats = (route.totalSeats || route.availableSeats || 0) - bookedSeats

        if (numberOfSeats > availableSeats) {
            return res.status(400).json({
                success: false,
                message: `Only ${availableSeats} seat(s) available. You requested ${numberOfSeats}.`,
            })
        }

        const booking = new CorporateBooking({
            passengerId,
            corporateOwnerId,
            routeId,
            contractId: contractId || null,
            driverId,
            pickupLocation,
            dropoffLocation,
            travelPath,
            bookingDate: new Date(),
            travelDate,
            numberOfSeats,
            bookingStatus: "CONFIRMED",
            vehicleModel,
            vehiclePlate,
            driverName,
            driverImage,
            passengerNotes,
        })

        // Set acceptance deadlines for booking timeout feature
        setBookingDeadlines(booking);
        await booking.save()

        await Route.updateOne(
            { _id: routeId },
            {
                $inc: { availableSeats: -numberOfSeats },
            },
        )

        const corporateOwner = await User.findById(corporateOwnerId)

        // Send notification to corporate owner
        const ownerNotification = await createNotification({
            userId: corporateOwnerId,
            type: "NEW_CORPORATE_BOOKING",
            title: "Employee Booking Confirmed",
            message: `${passenger.fullName} has booked ${numberOfSeats} seat(s) for ${new Date(travelDate).toLocaleDateString()}`,
            relatedUserId: passengerId,
            bookingId: booking._id,
        })

        // Send real-time notification to corporate owner
        await sendRealTimeNotification(corporateOwnerId, {
            type: "CORPORATE_BOOKING",
            title: ownerNotification.title,
            message: ownerNotification.message,
            data: {
                bookingId: booking._id,
                passengerId,
                corporateOwnerId,
                notification: ownerNotification
            }
        })

        // Send notification to assigned driver
        const driverNotification = await createNotification({
            userId: driverId,
            type: "NEW_BOOKING",
            title: "New Corporate Booking",
            message: `New corporate booking from ${passenger.fullName} for ${new Date(travelDate).toLocaleDateString()}`,
            relatedUserId: passengerId,
            bookingId: booking._id,
        })

        // Send real-time notification to driver
        await sendRealTimeNotification(driverId, {
            type: "NEW_BOOKING",
            title: driverNotification.title,
            message: driverNotification.message,
            data: {
                bookingId: booking._id,
                passengerId,
                driverId,
                notification: driverNotification
            }
        })

        // Send real-time booking update to passenger
        await sendBookingUpdate(booking._id, 'corporate-booking-confirmed', {
            bookingId: booking._id,
            driverId: driverId,
            driverName: driverName || driver.fullName,
            driverImage: driverImage || driver.profileImage,
            message: 'Your corporate booking has been confirmed'
        })

        return res.status(201).json({
            success: true,
            booking,
            message: "Booking confirmed successfully",
        })
    } catch (error) {
        console.error("Error creating corporate booking:", error)
        return res.status(500).json({
            success: false,
            message: error.message || "Server error while creating corporate booking",
        })
    }
}

// Accept B2C Booking (B2C_PARTNER only)
export const acceptB2CBooking = async (req, res) => {
    try {
        const partnerId = req.userId
        const { bookingId } = req.params

        console.log("[acceptB2CBooking] Partner accepting booking:", { partnerId, bookingId })

        const booking = await B2CPassengerBooking.findById(bookingId)
            .populate('passengerId', 'name email phone fullName')
            .populate('b2cPartnerId', 'name fullName companyName phone')

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            })
        }

        // Verify this booking belongs to the partner
        if (booking.b2cPartnerId._id.toString() !== partnerId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: This booking does not belong to you",
            })
        }

        // A booking can only be accepted while it is awaiting the partner's review.
        // New bookings are created as PENDING; "CONFIRMED" is accepted for backward
        // compatibility with any legacy bookings created under the old convention.
        if (!["PENDING", "CONFIRMED"].includes(booking.bookingStatus)) {
            return res.status(400).json({
                success: false,
                message: "Booking cannot be accepted. Current status: " + booking.bookingStatus,
            })
        }

        // Handle wallet transactions based on payment method
        const adminCommission = booking.adminCommissionAmount || 0
        const driverEarnings = booking.driverEarnings || (booking.paymentAmount - adminCommission)

        // Get Admin user to credit commission. The admin wallet is resolved for
        // the BOOKING'S currency (not "the admin's single wallet") so a UAE
        // booking's AED commission lands in the admin's AED wallet and a Kuwait
        // booking's KWD commission lands in the KWD wallet — never mixed.
        const bookingCurrency = booking.currency || 'AED'
        const adminUser = await User.findOne({ role: 'ADMIN' })
        let adminWallet = null
        if (adminUser) {
            adminWallet = await getOrCreateWallet(adminUser._id, {
                currency: bookingCurrency,
                role: 'ADMIN',
            })
            if (adminWallet.isNew) {
                await adminWallet.save()
                console.log("[acceptB2CBooking] Created new admin wallet for admin:", adminUser._id, bookingCurrency)
            }
        } else {
            console.error("[acceptB2CBooking] No ADMIN user found in the system!")
        }

        if (booking.paymentMethod === "CASH") {
            // CASH Payment: B2C Partner will collect cash from Commuter
            // Admin commission needs to be deducted from B2C Partner's wallet and added to Admin's wallet
            const partnerWallet = await Wallet.findOne({ userId: partnerId, currency: bookingCurrency })

            console.log("[acceptB2CBooking] CASH payment - Wallet check:", {
                paymentMethod: booking.paymentMethod,
                adminCommission,
                driverEarnings,
                walletBalance: partnerWallet?.balance || 0
            })

            // Calculate required balance (commission + buffer)
            const requiredBalance = adminCommission + 50 // 50 AED buffer

            if (!partnerWallet || partnerWallet.balance < requiredBalance) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient wallet balance. You need at least ${requiredBalance} AED to accept this cash booking. Current balance: ${partnerWallet?.balance || 0} AED.`,
                    requiresWalletFunding: true,
                    currentBalance: partnerWallet?.balance || 0,
                    requiredBalance: requiredBalance,
                })
            }

            // Deduct admin commission from B2C Partner's wallet
            partnerWallet.balance -= adminCommission
            partnerWallet.transactions.push({
                type: 'WITHDRAWAL',
                amount: adminCommission,
                description: `Admin commission for booking ${booking._id} (Cash payment)`,
                paymentMethod: 'CASH',
                status: 'COMPLETED'
            })
            await partnerWallet.save()

            // Add admin commission to Admin's wallet
            if (adminWallet && adminCommission > 0) {
                const adminBalanceBefore = adminWallet.balance
                adminWallet.balance += adminCommission
                adminWallet.totalEarnings = (adminWallet.totalEarnings || 0) + adminCommission
                adminWallet.transactions.push({
                    type: 'DEPOSIT',
                    amount: adminCommission,
                    description: `Commission from B2C booking ${booking._id} (Cash payment from partner ${booking.b2cPartnerId?.fullName || partnerId})`,
                    paymentMethod: 'CASH',
                    status: 'COMPLETED'
                })
                await adminWallet.save()

                console.log("[acceptB2CBooking] Admin commission credited to Admin wallet:", {
                    adminCommission,
                    adminWalletNewBalance: adminWallet.balance
                })

                // Also create a Transaction record for better tracking
                await Transaction.create({
                    userId: adminWallet.userId,
                    walletId: adminWallet._id,
                    type: "CREDIT",
                    category: "COMMISSION_EARNED",
                    amount: adminCommission,
                    currency: booking.currency || "AED",
                    balance: adminWallet.balance,
                    balanceBefore: adminBalanceBefore,
                    balanceAfter: adminWallet.balance,
                    paymentId: booking._id,
                    description: `B2C booking commission (${booking.appliedCommissionRate || 10}%) from ${booking.b2cPartnerId?.fullName || 'partner'} - Cash payment`,
                })
            }

            console.log("[acceptB2CBooking] CASH booking - Admin commission deducted from partner:", {
                deductedAmount: adminCommission,
                partnerNewBalance: partnerWallet.balance
            })
        } else if ((booking.paymentMethod === "STRIPE" || booking.paymentMethod === "WALLET") && booking.paymentStatus === "COMPLETED") {
            // STRIPE / WALLET Payment: Payment already received/held by the platform.
            // Now credit the B2C Partner's wallet with their earnings (total - admin commission)
            //
            // NOTE: this branch handles BOTH gateway (Stripe) and in-app WALLET
            // payments, so we must NOT hardcode "Stripe" in the descriptions or the
            // payment-method badge. Derive the real method from the booking so a
            // wallet-paid ride shows "Wallet" (not "Card"/"Stripe").
            const payLabel = booking.paymentMethod === "WALLET" ? "Wallet" : "Stripe"
            let partnerWallet = await getOrCreateWallet(partnerId, {
                currency: bookingCurrency,
                role: 'B2C_PARTNER',
            })

            // Add driver earnings to B2C Partner's wallet
            if (driverEarnings > 0) {
                partnerWallet.balance += driverEarnings
                partnerWallet.totalEarnings = (partnerWallet.totalEarnings || 0) + driverEarnings
                partnerWallet.transactions.push({
                    type: 'DEPOSIT',
                    amount: driverEarnings,
                    description: `Earnings from B2C booking ${booking._id} (${payLabel} payment - after ${adminCommission} ${booking.currency || 'AED'} admin commission)`,
                    paymentMethod: booking.paymentMethod,
                    status: 'COMPLETED'
                })
                await partnerWallet.save()

                console.log("[acceptB2CBooking] STRIPE/WALLET booking - Earnings credited to partner wallet:", {
                    paymentMethod: booking.paymentMethod,
                    driverEarnings,
                    adminCommission,
                    partnerNewBalance: partnerWallet.balance
                })
            }

            // Credit commission to Admin's wallet (payment received, now record commission)
            if (adminWallet && adminCommission > 0) {
                // Add commission to admin balance (this is the admin's share from the payment)
                adminWallet.balance += adminCommission
                adminWallet.totalEarnings = (adminWallet.totalEarnings || 0) + adminCommission
                adminWallet.transactions.push({
                    type: 'DEPOSIT',
                    amount: adminCommission,
                    description: `Commission from B2C booking ${booking._id} (${payLabel} payment)`,
                    paymentMethod: booking.paymentMethod,
                    status: 'COMPLETED'
                })
                await adminWallet.save()

                console.log("[acceptB2CBooking] STRIPE/WALLET booking - Admin commission credited to wallet:", {
                    paymentMethod: booking.paymentMethod,
                    adminCommission,
                    adminWalletNewBalance: adminWallet.balance,
                    adminWalletTotalEarnings: adminWallet.totalEarnings
                })
                // Also create a Transaction record for better tracking
                await Transaction.create({
                    userId: adminWallet.userId,
                    walletId: adminWallet._id,
                    type: "CREDIT",
                    category: "COMMISSION_EARNED",
                    amount: adminCommission,
                    currency: booking.currency || "AED",
                    balance: adminWallet.balance,
                    balanceBefore: adminWallet.balance - adminCommission,
                    balanceAfter: adminWallet.balance,
                    paymentId: booking._id,
                    description: `B2C booking commission (${booking.appliedCommissionRate || 10}%) from ${booking.passengerId?.fullName || 'passenger'} - ${payLabel} payment`,
                })
            }
        } else if (booking.paymentMethod === "TAP" && booking.paymentStatus === "COMPLETED") {
            // TAP Payment: Same logic as Stripe - payment already received by Admin via Tap
            // Now credit the B2C Partner's wallet with their earnings (total - admin commission)
            let partnerWallet = await getOrCreateWallet(partnerId, {
                currency: bookingCurrency,
                role: 'B2C_PARTNER',
            })

            // Add driver earnings to B2C Partner's wallet
            if (driverEarnings > 0) {
                partnerWallet.balance += driverEarnings
                partnerWallet.totalEarnings = (partnerWallet.totalEarnings || 0) + driverEarnings
                partnerWallet.transactions.push({
                    type: 'DEPOSIT',
                    amount: driverEarnings,
                    description: `Earnings from B2C booking ${booking._id} (TAP payment - after ${adminCommission} ${booking.currency || 'AED'} admin commission)`,
                    paymentMethod: 'TAP',
                    status: 'COMPLETED'
                })
                await partnerWallet.save()

                console.log("[acceptB2CBooking] TAP booking - Earnings credited to partner wallet:", {
                    driverEarnings,
                    adminCommission,
                    partnerNewBalance: partnerWallet.balance
                })
            }

            // Credit commission to Admin's wallet (TAP payment received, now record commission)
            if (adminWallet && adminCommission > 0) {
                const adminBalanceBefore = adminWallet.balance
                adminWallet.balance += adminCommission
                adminWallet.totalEarnings = (adminWallet.totalEarnings || 0) + adminCommission
                adminWallet.transactions.push({
                    type: 'DEPOSIT',
                    amount: adminCommission,
                    description: `Commission from B2C booking ${booking._id} (TAP payment)`,
                    paymentMethod: 'TAP',
                    status: 'COMPLETED'
                })
                await adminWallet.save()

                console.log("[acceptB2CBooking] TAP booking - Admin commission credited to wallet:", {
                    adminCommission,
                    adminWalletNewBalance: adminWallet.balance,
                    adminWalletTotalEarnings: adminWallet.totalEarnings
                })

                // Also create a Transaction record for better tracking
                await Transaction.create({
                    userId: adminWallet.userId,
                    walletId: adminWallet._id,
                    type: "CREDIT",
                    category: "COMMISSION_EARNED",
                    amount: adminCommission,
                    currency: booking.currency || "AED",
                    balance: adminWallet.balance,
                    balanceBefore: adminBalanceBefore,
                    balanceAfter: adminWallet.balance,
                    paymentId: booking._id,
                    description: `B2C booking commission (${booking.appliedCommissionRate || 10}%) from ${booking.passengerId?.fullName || 'passenger'} - TAP payment`,
                })
            }
        }

        // Update booking status
        booking.bookingStatus = "ACCEPTED"
        booking.acceptedAt = new Date()
        await booking.save()

        // Send notification to passenger - use companyName or fullName (not businessName which doesn't exist)
        const partnerDisplayName = booking.b2cPartnerId.companyName || booking.b2cPartnerId.fullName || booking.b2cPartnerId.name || 'the partner';
        const bookingAcceptedNotification = await createNotification({
            userId: booking.passengerId._id,
            title: "Booking Confirmed",
            message: `Your booking from ${booking.pickupLocation || 'pickup'} to ${booking.dropoffLocation || 'destination'} has been accepted by ${partnerDisplayName} and is now confirmed.`,
            type: "BOOKING_ACCEPTED",
            bookingId: booking._id,
        })

        // Send real-time notification to passenger
        sendRealTimeNotification(booking.passengerId._id, {
            type: "BOOKING_ACCEPTED",
            data: {
                bookingId: booking._id,
                message: `Your booking has been accepted by ${partnerDisplayName} and is now confirmed.`,
                partnerInfo: {
                    name: partnerDisplayName,
                    phone: booking.b2cPartnerId.phone,
                },
                booking: {
                    pickupLocation: booking.pickupLocation,
                    dropoffLocation: booking.dropoffLocation,
                    travelDate: booking.travelDate,
                    isSelfDriver: booking.isSelfDriver,
                    driverName: booking.driverName,
                    driverPhone: booking.driverPhoneNumber
                }
            }
        })

        // Notify admins about booking acceptance
        try {
            await sendAdminNotification(
                "Booking Accepted",
                `B2C booking #${booking._id.toString().slice(-8)} from ${booking.pickupLocation || 'pickup'} to ${booking.dropoffLocation || 'destination'} accepted by ${partnerDisplayName}`,
                "BOOKING_ACCEPTED",
                { bookingId: booking._id }
            );
        } catch (adminNotifErr) {
            console.error("Admin notification error:", adminNotifErr);
        }

        console.log("[acceptB2CBooking] Booking accepted successfully:", {
            bookingId: booking._id,
            status: booking.bookingStatus,
            isSelfDriver: booking.isSelfDriver
        })

        return res.status(200).json({
            success: true,
            message: "Booking accepted successfully",
            booking
        })

    } catch (error) {
        console.error("Error accepting B2C booking:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while accepting booking",
        })
    }
}

//         // Check wallet balance for cash payment bookings
//         if (booking.paymentMethod === "CASH") {
//             const driverWallet = await Wallet.findOne({ userId: driverId })
//             const commissionData = calculateDriverCommission(booking.paymentAmount)

//             // Calculate required balance (commission + buffer)
//             const requiredBalance = commissionData.adminCommission + 50 // 50 AED buffer

//             if (!driverWallet || driverWallet.balance < requiredBalance) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Insufficient wallet balance. You need at least ${requiredBalance} AED to accept this cash booking. Current balance: ${driverWallet?.balance || 0} AED.`,
//                     requiresWalletFunding: true,
//                     currentBalance: driverWallet?.balance || 0,
//                     requiredBalance: requiredBalance,
//                 })
//             }
//         }

//         booking.bookingStatus = "CONFIRMED"
//         await booking.save()

//         const passenger = await User.findById(booking.passengerId)
//         // Send notification to passenger
//         const bookingConfirmedNotification = await createNotification({
//             userId: booking.passengerId,
//             title: "Booking Confirmed",
//             message: `Your B2C booking from ${booking.pickupLocation} to ${booking.dropoffLocation} has been confirmed by the driver.`,
//             type: "BOOKING_CONFIRMED",
//             bookingId: booking._id,
//         })

//         // Send real-time notification to passenger
//         sendRealTimeNotification(booking.passengerId, {
//             type: "BOOKING_CONFIRMED",
//             data: {
//                 bookingId: booking._id,
//                 message: `Your booking has been confirmed by the driver.`,
//                 driverInfo: {
//                     name: booking.driverName,
//                     vehicle: booking.vehicleModel,
//                     plate: booking.vehiclePlate,
//                 },
//             },
//         })

//         return res.status(200).json({
//             success: true,
//             booking,
//             message: "Booking accepted successfully",
//         })
//     } catch (error) {
//         console.error("Error accepting booking:", error)
//         return res.status(500).json({
//             success: false,
//     }
// }

// Partner: Reject Booking
export const rejectB2CBooking = async (req, res) => {
    try {
        const partnerId = req.userId
        const { bookingId } = req.params
        const { rejectionReason } = req.body

        const booking = await B2CPassengerBooking.findById(bookingId)
            .populate('passengerId', 'name email phone fullName')
            .populate('b2cPartnerId', 'name fullName companyName phone')

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            })
        }

        // Handle both populated and unpopulated b2cPartnerId
        const bookingPartnerId = booking.b2cPartnerId?._id?.toString() || booking.b2cPartnerId?.toString()

        if (bookingPartnerId !== partnerId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized",
            })
        }

        // Store previous status to check if it was ACCEPTED
        const wasAccepted = booking.bookingStatus === "ACCEPTED"

        booking.bookingStatus = "REJECTED"
        booking.rejectionReason = rejectionReason || "No reason provided"
        booking.rejectedAt = new Date()

        // ===== SEAT RESTORATION LOGIC =====
        // Restore seats in linked trips
        const tripsToRestore = []
        if (booking.linkedTrip) tripsToRestore.push(booking.linkedTrip)
        if (booking.linkedReturnTrip) tripsToRestore.push(booking.linkedReturnTrip)

        for (const tripId of tripsToRestore) {
            try {
                const trip = await B2CPartnerTrip.findById(tripId)
                if (trip) {
                    const seatsToRestore = booking.numberOfSeats || 1
                    trip.bookedSeats = Math.max(0, trip.bookedSeats - seatsToRestore)
                    trip.availableSeats = trip.totalSeats - trip.bookedSeats

                    // Remove passenger from trip's passengers array
                    trip.passengers = trip.passengers.filter(
                        p => p.bookingId?.toString() !== bookingId
                    )

                    await trip.save()
                    console.log("[rejectB2CBooking] Restored seats in trip:", {
                        tripId,
                        seatsRestored: seatsToRestore,
                        newAvailableSeats: trip.availableSeats
                    })
                }
            } catch (tripError) {
                console.error("[rejectB2CBooking] Error restoring trip seats:", tripError)
            }
        }

        // ===== MONTHLY PASS TRIP CLEANUP =====
        // If this is a monthly pass booking, clean up all future trips
        if (booking.isMonthlyPass && booking.monthlyTrips && booking.monthlyTrips.length > 0) {
            console.log("[rejectB2CBooking] Cleaning up monthly pass trips:", booking.monthlyTrips.length)

            const today = new Date()
            today.setHours(0, 0, 0, 0)

            for (const tripId of booking.monthlyTrips) {
                try {
                    const trip = await B2CPartnerTrip.findById(tripId)
                    if (trip && new Date(trip.tripDate) >= today) {
                        const seatsToRestore = booking.numberOfSeats || 1
                        trip.bookedSeats = Math.max(0, trip.bookedSeats - seatsToRestore)
                        trip.availableSeats = trip.totalSeats - trip.bookedSeats

                        // Remove passenger from trip's passengers array
                        trip.passengers = trip.passengers.filter(
                            p => p.bookingId?.toString() !== bookingId
                        )

                        await trip.save()
                    }
                } catch (tripError) {
                    console.error("[rejectB2CBooking] Error cleaning up monthly trip:", tripError)
                }
            }

            // Update monthly pass status if exists
            if (booking.monthlyPassId) {
                const B2CMonthlyPass = (await import("../models/B2CMonthlyPass.js")).default
                await B2CMonthlyPass.findByIdAndUpdate(booking.monthlyPassId, {
                    status: "CANCELLED",
                    updatedAt: new Date()
                })
            }
        }

        // ===== REFUND PROCESSING =====
        // IMPORTANT: only ONLINE payments (STRIPE/TAP/WALLET) are refunded to the passenger wallet, because
        // only those amounts were ever collected/held by the platform. For CASH bookings the passenger paid
        // (or will pay) the B2C partner directly in cash, so NOTHING goes to the wallet — otherwise the
        // passenger would be wrongly credited the full fare.
        const isOnlinePayment = booking.paymentMethod === "STRIPE" || booking.paymentMethod === "TAP" || booking.paymentMethod === "WALLET"

        if (isOnlinePayment && booking.paymentStatus === "COMPLETED" && booking.transactionId) {
            // Refund goes back to the passenger's wallet IN THE BOOKING'S CURRENCY
            // (the currency they actually paid in), never a mismatched wallet.
            const passengerWallet = await getOrCreateWallet(booking.passengerId._id || booking.passengerId, {
                currency: booking.currency || "AED",
                role: "COMMUTER",
            })

            if (passengerWallet) {
                const refundAmount = booking.paymentAmount
                const balanceBefore = passengerWallet.balance

                // Add refund amount to passenger wallet
                passengerWallet.balance += refundAmount
                await passengerWallet.save()

                // Create refund transaction record
                await Transaction.create({
                    walletId: passengerWallet._id,
                    userId: booking.passengerId._id || booking.passengerId,
                    type: "CREDIT",
                    amount: refundAmount,
                    currency: booking.currency || "AED",
                    category: "REFUND",
                    description: `Refund for rejected booking ${booking._id}`,
                    referenceId: booking._id,
                    referenceModel: "B2CPassengerBooking",
                    balanceBefore: balanceBefore,
                    balanceAfter: passengerWallet.balance,
                    metadata: {
                        bookingId: booking._id,
                        originalTransactionId: booking.transactionId,
                        rejectionReason: booking.rejectionReason,
                        rejectedBy: "B2C_PARTNER"
                    }
                })

                booking.paymentStatus = "REFUNDED"
                booking.refundAmount = refundAmount
                booking.refundMethod = "WALLET"
                booking.refundProcessedAt = new Date()

                console.log("[rejectB2CBooking] Online refund processed to wallet:", {
                    refundAmount,
                    newBalance: passengerWallet.balance
                })
            } else {
                console.error("[rejectB2CBooking] Passenger wallet not found for refund:", booking.passengerId)
            }
        } else if (booking.paymentMethod === "CASH") {
            // CASH: no wallet refund. If the partner already collected cash from the passenger, the
            // partner settles it back to the passenger OFFLINE in cash. We only mark the booking so the
            // UI/records reflect that there is no platform wallet refund for cash bookings.
            booking.refundMethod = "CASH_FROM_PARTNER"
            booking.refundAmount = 0
            booking.refundProcessedAt = new Date()

            console.log("[rejectB2CBooking] CASH booking rejected - no wallet refund (offline cash settlement by partner)")
        }

        // ===== REVERSE WALLET TRANSACTIONS IF BOOKING WAS ACCEPTED =====
        // If booking was already ACCEPTED, we need to reverse the commission/earnings transactions
        if (wasAccepted) {
            console.log("[rejectB2CBooking] Reversing wallet transactions for ACCEPTED booking")

            const adminCommission = booking.adminCommissionAmount || 0
            const driverEarnings = booking.driverEarnings || 0

            // Reversal must touch the SAME per-currency wallets the original
            // credit/debit used, so scope every lookup by the booking's currency.
            const reversalCurrency = booking.currency || 'AED'
            const adminUser = await User.findOne({ role: 'ADMIN' })
            const adminWallet = adminUser ? await Wallet.findOne({ userId: adminUser._id, currency: reversalCurrency }) : null

            // Get Partner wallet
            const partnerWallet = await Wallet.findOne({ userId: partnerId, currency: reversalCurrency })

            if (booking.paymentMethod === "CASH") {
                // CASH: Partner had commission deducted, admin had commission credited
                // Reverse: Return commission to partner, deduct from admin

                if (partnerWallet && adminCommission > 0) {
                    const partnerBalanceBefore = partnerWallet.balance
                    partnerWallet.balance += adminCommission
                    partnerWallet.transactions.push({
                        type: 'DEPOSIT',
                        amount: adminCommission,
                        description: `Commission refund for rejected booking ${booking._id}`,
                        status: 'COMPLETED'
                    })
                    await partnerWallet.save()

                    // Create transaction record
                    await Transaction.create({
                        walletId: partnerWallet._id,
                        userId: partnerId,
                        type: "CREDIT",
                        amount: adminCommission,
                        currency: booking.currency || "AED",
                        category: "COMMISSION_REFUND",
                        description: `Commission refund - booking rejected after acceptance`,
                        referenceId: booking._id,
                        referenceModel: "B2CPassengerBooking",
                        balanceBefore: partnerBalanceBefore,
                        balanceAfter: partnerWallet.balance,
                        metadata: { bookingId: booking._id, reason: "booking_rejected_after_acceptance" }
                    })

                    console.log("[rejectB2CBooking] Returned commission to partner:", adminCommission)
                }

                if (adminWallet && adminCommission > 0) {
                    const adminBalanceBefore = adminWallet.balance
                    adminWallet.balance -= adminCommission
                    adminWallet.totalEarnings = Math.max(0, (adminWallet.totalEarnings || 0) - adminCommission)
                    adminWallet.transactions.push({
                        type: 'WITHDRAWAL',
                        amount: adminCommission,
                        description: `Commission reversed for rejected booking ${booking._id}`,
                        status: 'COMPLETED'
                    })
                    await adminWallet.save()

                    // Create transaction record
                    await Transaction.create({
                        walletId: adminWallet._id,
                        userId: adminUser._id,
                        type: "DEBIT",
                        amount: adminCommission,
                        currency: booking.currency || "AED",
                        category: "COMMISSION_REVERSAL",
                        description: `Commission reversed - booking rejected after acceptance`,
                        referenceId: booking._id,
                        referenceModel: "B2CPassengerBooking",
                        balanceBefore: adminBalanceBefore,
                        balanceAfter: adminWallet.balance,
                        metadata: { bookingId: booking._id, reason: "booking_rejected_after_acceptance" }
                    })

                    console.log("[rejectB2CBooking] Reversed admin commission:", adminCommission)
                }
            } else if ((booking.paymentMethod === "STRIPE" || booking.paymentMethod === "WALLET") && (booking.paymentStatus === "REFUNDED" || booking.paymentStatus === "COMPLETED")) {
                // STRIPE / WALLET: at acceptance the platform credited partner earnings + admin commission.
                // The full amount has already been refunded to the passenger above (paymentStatus is now
                // REFUNDED), so we must reverse BOTH the partner earnings and the admin commission here.

                if (partnerWallet && driverEarnings > 0) {
                    const partnerBalanceBefore = partnerWallet.balance
                    partnerWallet.balance -= driverEarnings
                    partnerWallet.totalEarnings = Math.max(0, (partnerWallet.totalEarnings || 0) - driverEarnings)
                    partnerWallet.transactions.push({
                        type: 'WITHDRAWAL',
                        amount: driverEarnings,
                        description: `Earnings reversed for rejected booking ${booking._id}`,
                        status: 'COMPLETED'
                    })
                    await partnerWallet.save()

                    // Create transaction record
                    await Transaction.create({
                        walletId: partnerWallet._id,
                        userId: partnerId,
                        type: "DEBIT",
                        amount: driverEarnings,
                        currency: booking.currency || "AED",
                        category: "EARNINGS_REVERSAL",
                        description: `Earnings reversed - booking rejected after acceptance`,
                        referenceId: booking._id,
                        referenceModel: "B2CPassengerBooking",
                        balanceBefore: partnerBalanceBefore,
                        balanceAfter: partnerWallet.balance,
                        metadata: { bookingId: booking._id, reason: "booking_rejected_after_acceptance" }
                    })

                    console.log("[rejectB2CBooking] Reversed partner earnings:", driverEarnings)
                }

                if (adminWallet && adminCommission > 0) {
                    const adminBalanceBefore = adminWallet.balance
                    adminWallet.balance -= adminCommission
                    adminWallet.totalEarnings = Math.max(0, (adminWallet.totalEarnings || 0) - adminCommission)
                    adminWallet.transactions.push({
                        type: 'WITHDRAWAL',
                        amount: adminCommission,
                        description: `Commission reversed for rejected booking ${booking._id}`,
                        status: 'COMPLETED'
                    })
                    await adminWallet.save()

                    // Create transaction record
                    await Transaction.create({
                        walletId: adminWallet._id,
                        userId: adminUser._id,
                        type: "DEBIT",
                        amount: adminCommission,
                        currency: booking.currency || "AED",
                        category: "COMMISSION_REVERSAL",
                        description: `Commission reversed - booking rejected after acceptance`,
                        referenceId: booking._id,
                        referenceModel: "B2CPassengerBooking",
                        balanceBefore: adminBalanceBefore,
                        balanceAfter: adminWallet.balance,
                        metadata: { bookingId: booking._id, reason: "booking_rejected_after_acceptance" }
                    })

                    console.log("[rejectB2CBooking] Reversed admin commission:", adminCommission)
                }
            }
        }

        await booking.save()

        // Notify passenger
        const rejectNotification = await createNotification({
            userId: booking.passengerId._id || booking.passengerId,
            type: "BOOKING_REJECTED",
            title: "Booking Rejected",
            message: `Your booking has been rejected. Reason: ${booking.rejectionReason}`,
            relatedUserId: partnerId,
            bookingId: booking._id,
        })

        // Send real-time notification to passenger
        await sendRealTimeNotification(booking.passengerId._id || booking.passengerId, {
            type: "BOOKING_REJECTED",
            title: rejectNotification.title,
            message: rejectNotification.message,
            data: {
                bookingId: booking._id,
                partnerId,
                passengerId: booking.passengerId._id || booking.passengerId,
                rejectionReason: booking.rejectionReason,
                notification: rejectNotification
            }
        })

        return res.status(200).json({
            success: true,
            booking,
            message: "Booking rejected successfully",
        })
    } catch (error) {
        console.error("[rejectB2CBooking] Error rejecting booking:", error)
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        })
    }
}

// Start B2C Trip (B2C_PARTNER or B2C_PARTNER_DRIVER)
export const startB2CTrip = async (req, res) => {
    try {
        const userId = req.userId
        const userRole = req.userRole
        const { bookingId } = req.params

        console.log("[startB2CTrip] Starting trip:", { userId, userRole, bookingId })

        const booking = await B2CPassengerBooking.findById(bookingId)
            .populate('passengerId', 'name email phone')
            .populate('b2cPartnerId', 'name businessName phone')

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            })
        }

        // Authorization check based on user role
        let isAuthorized = false

        if (userRole === "B2C_PARTNER") {
            // Partner can start trip for their own bookings
            isAuthorized = booking.b2cPartnerId._id.toString() === userId
        } else if (userRole === "B2C_PARTNER_DRIVER") {
            // Driver can start trip if they are assigned to this booking
            // Need to check driver's driverId from User table
            const driver = await User.findById(userId)
            if (driver && driver.driverId) {
                isAuthorized = booking.assignedDriverId?.toString() === driver.driverId.toString()
            } else {
                // Fallback: Check if userId matches assignedDriverId
                isAuthorized = booking.assignedDriverId?.toString() === userId
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized - You can only start your assigned trips",
            })
        }

        // Check if booking is in ACCEPTED status
        if (booking.bookingStatus !== "ACCEPTED") {
            return res.status(400).json({
                success: false,
                message: "Booking must be accepted before starting trip. Current status: " + booking.bookingStatus,
            })
        }

        // Check if trip is started late
        let isLate = false
        let lateByMinutes = 0
        let scheduledStartTime = null

        // Get scheduled time from linked trip if available
        if (booking.linkedTrip) {
            const linkedTrip = await B2CPartnerTrip.findById(booking.linkedTrip).select('startTime tripDate')
            if (linkedTrip && linkedTrip.startTime) {
                scheduledStartTime = linkedTrip.startTime
                const tripDate = linkedTrip.tripDate || booking.travelDate

                // Parse scheduled time (format: "HH:MM" or "HH:MM AM/PM")
                let scheduledHour, scheduledMinute
                const timeStr = linkedTrip.startTime.trim()

                if (timeStr.includes('AM') || timeStr.includes('PM')) {
                    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
                    if (match) {
                        scheduledHour = parseInt(match[1])
                        scheduledMinute = parseInt(match[2])
                        const isPM = match[3].toUpperCase() === 'PM'
                        if (isPM && scheduledHour !== 12) scheduledHour += 12
                        if (!isPM && scheduledHour === 12) scheduledHour = 0
                    }
                } else {
                    const [h, m] = timeStr.split(':').map(Number)
                    scheduledHour = h
                    scheduledMinute = m
                }

                if (scheduledHour !== undefined && scheduledMinute !== undefined) {
                    const scheduledDateTime = new Date(tripDate)
                    scheduledDateTime.setHours(scheduledHour, scheduledMinute, 0, 0)

                    const now = new Date()
                    const timeDiff = now - scheduledDateTime
                    lateByMinutes = Math.floor(timeDiff / (1000 * 60))

                    // Consider late if more than 5 minutes past scheduled time
                    if (lateByMinutes > 5) {
                        isLate = true
                    }
                }
            }
        }

        // Update booking status to IN_PROGRESS
        booking.bookingStatus = "IN_PROGRESS"
        booking.startedAt = new Date()
        booking.tripStartedBy = userRole
        booking.isLateStart = isLate
        booking.lateByMinutes = isLate ? lateByMinutes : 0
        await booking.save()

        console.log("[startB2CTrip] Trip started:", {
            bookingId: booking._id,
            status: booking.bookingStatus,
            startedBy: userRole,
            isSelfDriver: booking.isSelfDriver,
            isLate,
            lateByMinutes: isLate ? lateByMinutes : 0
        })

        // If trip started late, notify Admin and B2C Partner owner
        if (isLate && lateByMinutes > 5) {
            const driverName = booking.isSelfDriver
                ? (booking.b2cPartnerId.businessName || booking.b2cPartnerId.name)
                : booking.driverName || 'Driver'
            const driverType = booking.isSelfDriver ? 'B2C_PARTNER (Self-Driving)' : 'B2C_PARTNER_DRIVER'

            // Notify Admin
            await sendAdminNotification(
                "Late Trip Start Warning",
                `${driverName} (${driverType}) started B2C trip ${lateByMinutes} minutes late. Booking #${booking._id.toString().slice(-6)}. Route: ${booking.pickupLocation} to ${booking.dropoffLocation}. Scheduled: ${scheduledStartTime}.`,
                "LATE_TRIP_START",
                {
                    bookingId: booking._id,
                    driverName,
                    driverType,
                    isSelfDriver: booking.isSelfDriver,
                    lateByMinutes,
                    scheduledTime: scheduledStartTime,
                    actualStartTime: new Date().toISOString(),
                    pickupLocation: booking.pickupLocation,
                    dropoffLocation: booking.dropoffLocation,
                    b2cPartnerId: booking.b2cPartnerId._id,
                }
            )

            // If it's a driver (not self-driving), notify the B2C Partner owner
            if (!booking.isSelfDriver && booking.assignedDriverId) {
                const ownerNotification = await createNotification({
                    userId: booking.b2cPartnerId._id,
                    type: "LATE_TRIP_START",
                    title: "Your Driver Started Trip Late",
                    message: `Your driver ${driverName} started a trip ${lateByMinutes} minutes late. Booking: ${booking.pickupLocation} to ${booking.dropoffLocation}. Scheduled: ${scheduledStartTime}. Please address this with the driver.`,
                    metadata: {
                        bookingId: booking._id,
                        driverId: booking.assignedDriverId,
                        driverName,
                        lateByMinutes,
                        scheduledTime: scheduledStartTime,
                        actualStartTime: new Date().toISOString(),
                        pickupLocation: booking.pickupLocation,
                        dropoffLocation: booking.dropoffLocation,
                    },
                })
                sendRealTimeNotification(booking.b2cPartnerId._id.toString(), ownerNotification)
            }
        }

        // Create notification for passenger
        const tripStartedNotification = await createNotification({
            userId: booking.passengerId._id,
            title: "Trip Started",
            message: `Your trip from ${booking.pickupLocation} to ${booking.dropoffLocation} has started. Track your driver's location in real-time.`,
            type: "TRIP_STARTED",
            bookingId: booking._id,
        })

        // Send real-time notification to passenger with location tracking info
        sendRealTimeNotification(booking.passengerId._id, {
            type: "TRIP_STARTED",
            data: {
                bookingId: booking._id,
                message: "Your trip has started! Track your driver in real-time.",
                driverInfo: {
                    name: booking.isSelfDriver ? (booking.b2cPartnerId.businessName || booking.b2cPartnerId.name) : booking.driverName,
                    phone: booking.isSelfDriver ? booking.b2cPartnerId.phone : booking.driverPhoneNumber,
                    isSelfDriver: booking.isSelfDriver,
                    role: userRole
                },
                trip: {
                    pickupLocation: booking.pickupLocation,
                    dropoffLocation: booking.dropoffLocation,
                    startedAt: booking.startedAt,
                    status: "IN_PROGRESS"
                },
                locationTracking: {
                    enabled: true,
                    bookingId: booking._id,
                    driverId: booking.isSelfDriver ? booking.b2cPartnerId._id : booking.assignedDriverId
                }
            }
        })

        // Send booking update to trigger location tracking
        sendBookingUpdate(booking._id, "b2c-trip-started", {
            bookingId: booking._id,
            status: "IN_PROGRESS",
            driverId: booking.isSelfDriver ? booking.b2cPartnerId._id : booking.assignedDriverId,
            isSelfDriver: booking.isSelfDriver,
            passengerId: booking.passengerId._id
        })

        return res.status(200).json({
            success: true,
            message: "Trip started successfully",
            booking: {
                ...booking.toObject(),
                locationTrackingEnabled: true
            }
        })

    } catch (error) {
        console.error("Error starting B2C trip:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while starting trip",
        })
    }
}

// Complete B2C Trip (B2C_PARTNER or B2C_PARTNER_DRIVER)
export const completeB2CTrip = async (req, res) => {
    try {
        const userId = req.userId
        const userRole = req.userRole
        const { bookingId } = req.params

        console.log("[completeB2CTrip] Completing trip:", { userId, userRole, bookingId })

        const booking = await B2CPassengerBooking.findById(bookingId)
            .populate('passengerId', 'name email phone')
            .populate('b2cPartnerId', 'name businessName phone')

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            })
        }

        // Authorization check based on user role
        let isAuthorized = false

        if (userRole === "B2C_PARTNER") {
            // Partner can complete trip for their own bookings
            isAuthorized = booking.b2cPartnerId._id.toString() === userId
        } else if (userRole === "B2C_PARTNER_DRIVER") {
            // Driver can complete trip if they are assigned to this booking
            // Need to check driver's driverId from User table
            const driver = await User.findById(userId)
            if (driver && driver.driverId) {
                isAuthorized = booking.assignedDriverId?.toString() === driver.driverId.toString()
            } else {
                // Fallback: Check if userId matches assignedDriverId
                isAuthorized = booking.assignedDriverId?.toString() === userId
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized - You can only complete your assigned trips",
            })
        }

        // Check if booking is in IN_PROGRESS status
        if (booking.bookingStatus !== "IN_PROGRESS") {
            return res.status(400).json({
                success: false,
                message: "Trip must be in progress before completing. Current status: " + booking.bookingStatus,
            })
        }

        // Update booking status to COMPLETED
        booking.bookingStatus = "COMPLETED"
        booking.completedAt = new Date()
        booking.tripCompletedBy = userRole
        await booking.save()

        console.log("[completeB2CTrip] Trip completed:", {
            bookingId: booking._id,
            status: booking.bookingStatus,
            completedBy: userRole,
            isSelfDriver: booking.isSelfDriver
        })

        // NO WALLET OPERATIONS during trip completion
        // Wallet operations only happen during booking acceptance by B2C_PARTNER
        // Trip completion is only for status update and location sharing stop

        // Create notification for passenger
        const tripCompletedNotification = await createNotification({
            userId: booking.passengerId._id,
            title: "Trip Completed",
            message: `Your trip from ${booking.pickupLocation} to ${booking.dropoffLocation} has been completed. Thank you for traveling with us!`,
            type: "TRIP_COMPLETED",
            bookingId: booking._id,
        })

        // Send real-time notification to passenger
        sendRealTimeNotification(booking.passengerId._id, {
            type: "TRIP_COMPLETED",
            data: {
                bookingId: booking._id,
                message: "Your trip has been completed successfully!",
                driverInfo: {
                    name: booking.isSelfDriver ? (booking.b2cPartnerId.businessName || booking.b2cPartnerId.name) : booking.driverName,
                    isSelfDriver: booking.isSelfDriver,
                    role: userRole
                },
                trip: {
                    pickupLocation: booking.pickupLocation,
                    dropoffLocation: booking.dropoffLocation,
                    completedAt: booking.completedAt,
                    status: "COMPLETED"
                },
                locationTracking: {
                    enabled: false,
                    message: "Location tracking has been disabled as trip is completed"
                }
            }
        })

        return res.status(200).json({
            success: true,
            message: "Trip completed successfully",
            booking
        })

    } catch (error) {
        console.error("Error completing B2C trip:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while completing trip",
        })
    }
}

// Complete B2C Booking (Driver)
// export const completeB2CBooking = async (req, res) => {
//     try {
//         const driverId = req.userId
//         const { bookingId } = req.params

//         const booking = await B2CPassengerBooking.findById(bookingId)

//         if (!booking) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Booking not found",
//             })
//         }

//         if (booking.b2cPartnerId.toString() !== driverId) {
//             return res.status(403).json({
//                 success: false,
//                 message: "Unauthorized",
//             })
//         }

//         if (booking.bookingStatus !== "CONFIRMED" && booking.bookingStatus !== "IN_PROGRESS") {
//             return res.status(400).json({
//                 success: false,
//                 message: "Booking must be confirmed or in progress before completing",
//             })
//         }

//         booking.bookingStatus = "COMPLETED"
//         booking.completedAt = new Date()

//         // Update payment status to indicate cash payment received
//         if (booking.paymentMethod === "CASH") {
//             booking.paymentStatus = "COMPLETED"
//             booking.paymentReceivedAt = new Date()
//         }

//         await booking.save()

//         // Process wallet payment
//         let driverWallet = await Wallet.findOne({ userId: driverId })
//         if (!driverWallet) {
//             // Get user role
//             const driver = await User.findById(driverId)
//             driverWallet = new Wallet({
//                 userId: driverId,
//                 role: driver?.role || "B2C_PARTNER",
//                 balance: 0,
//                 totalEarnings: 0,
//                 totalWithdrawals: 0,
//             })
//         }

//         if (booking.paymentMethod === "CASH") {
//             // For cash payment, driver already has the money
//             // Deduct admin commission from wallet (but don't go negative)
//             const commissionData = calculateDriverCommission(booking.paymentAmount)

//             // Only deduct if wallet has sufficient balance
//             if (driverWallet.balance >= commissionData.adminCommission) {
//                 driverWallet.balance -= commissionData.adminCommission
//             }

//             driverWallet.totalEarnings = commissionData.driverEarnings

//             if (!driverWallet.transactions) driverWallet.transactions = []
//             driverWallet.transactions.push({
//                 type: "COMMISSION_DEDUCTION",
//                 amount: commissionData.adminCommission,
//                 description: `Admin commission for booking ${booking._id}`,
//                 date: new Date(),
//                 bookingId: booking._id,
//             })
//         } else {
//             // For card payments, add driver earnings to wallet
//             driverWallet.balance += booking.driverEarnings
//             driverWallet.totalEarnings += booking.driverEarnings

//             if (!driverWallet.transactions) driverWallet.transactions = []
//             driverWallet.transactions.push({
//                 type: "BOOKING_EARNING",
//                 amount: booking.driverEarnings,
//                 description: `Earnings from booking ${booking._id}`,
//                 date: new Date(),
//                 bookingId: booking._id,
//             })
//         }

//         await driverWallet.save()

//         // Notify passenger
//         const rideCompleteNotification = await createNotification({
//             userId: booking.passengerId,
//             type: "RIDE_COMPLETED",
//             title: "Ride Completed",
//             message: "Your ride has been completed. Please rate your experience!",
//             relatedUserId: driverId,
//             bookingId: booking._id,
//         })

//         // Send real-time notification to passenger
//         await sendRealTimeNotification(booking.passengerId, {
//             type: "RIDE_COMPLETED",
//             title: rideCompleteNotification.title,
//             message: rideCompleteNotification.message,
//             data: {
//                 bookingId: booking._id,
//                 driverId,
//                 passengerId: booking.passengerId,
//                 notification: rideCompleteNotification
//             }
//         })

//         // Send wallet update notification to driver
//         await sendRealTimeNotification(driverId, {
//             type: "WALLET_UPDATED",
//             title: "Earnings Added",
//             message: `Your earnings of ${booking.driverEarnings} KWD have been added to your wallet`,
//             data: {
//                 newBalance: driverWallet.balance,
//                 transaction: driverWallet.transactions[driverWallet.transactions.length - 1]
//             }
//         })

//         res.status(200).json({
//             success: true,
//             booking,
//             message: "Booking completed successfully",
//         })
//     } catch (error) {
//         console.error("Error completing booking:", error)
//         res.status(500).json({
//             success: false,
//             message: "Server error",
//             error: error.message,
//         })
//     }
// }

// Complete B2C Trip (B2C_PARTNER or B2C_PARTNER_DRIVER)
// This function is used for daily trip completion - NO WALLET OPERATIONS


// Get passenger bookings
export const getPassengerBookings = async (req, res) => {
    try {
        const passengerId = req.userId
        const { status } = req.query

        // Import B2CPartnerVehicle model for vehicle lookups
        const B2CPartnerVehicle = (await import("../models/B2CPartnerVehicle.js")).default

        const user = await User.findById(passengerId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            })
        }

        let bookings = []

        if (user.companyId) {
            const query = { passengerId, corporateOwnerId: user.companyId }
            if (status) query.bookingStatus = status

            const corporateBookings = await CorporateBooking.find(query)
                .populate("corporateOwnerId", "companyName companyLogo")
                .populate("routeId", "fromLocation toLocation departureTime totalSeats availableSeats")
                .sort({ createdAt: -1 })

            bookings = corporateBookings.map((b) => ({
                ...b.toObject(),
                type: "CORPORATE",
                userType: "CORPORATE_EMPLOYEE",
            }))
        } else {
            const query = { passengerId }
            if (status) query.bookingStatus = status

            // Exclude bookings whose ONLINE payment was never completed. Gateway
            // bookings (STRIPE/TAP/CARD) stay "PENDING" until the payment webhook
            // marks them "COMPLETED"; a failed/abandoned checkout (e.g. missing Tap
            // keys -> 401) must NOT show up in My Rides as a confirmed ride. CASH
            // (pay-on-board) and WALLET (debited at creation) are unaffected.
            query.$nor = [
                {
                    paymentMethod: { $in: ["STRIPE", "TAP", "CARD"] },
                    paymentStatus: { $in: ["PENDING", "FAILED"] },
                },
            ]

            const b2cBookings = await B2CPassengerBooking.find(query)
                .populate("b2cPartnerId", "fullName companyLogo whatsappNumber profileImage")
                .populate({
                    path: "routeId",
                    select: "fromLocation toLocation assignedVehicle assignedDriver pricing"
                })
                .populate("linkedSchedule", "assignedVehicle assignedDriver tripTimes")
                .sort({ createdAt: -1 })

            // Collect all route vehicle IDs and partner IDs for efficient lookup
            const routeVehicleIds = b2cBookings
                .map(b => b.routeId?.assignedVehicle)
                .filter(Boolean)

            const scheduleVehicleIds = b2cBookings
                .map(b => b.linkedSchedule?.assignedVehicle)
                .filter(Boolean)

            const allVehicleIds = [...new Set([...routeVehicleIds, ...scheduleVehicleIds].map(id => id.toString()))]

            const partnerIds = [...new Set(b2cBookings.map(b =>
                b.b2cPartnerId?._id?.toString() || b.b2cPartnerId?.toString()
            ).filter(Boolean))]

            // Fetch all vehicles from route/schedule in one query
            const routeVehicles = allVehicleIds.length > 0
                ? await B2CPartnerVehicle.find({ _id: { $in: allVehicleIds } })
                : []

            // Create vehicle map by ID
            const vehicleById = {}
            routeVehicles.forEach(v => {
                vehicleById[v._id.toString()] = v
            })

            // Fetch partner vehicles as fallback
            const partnerVehicles = partnerIds.length > 0
                ? await B2CPartnerVehicle.find({
                    b2cPartnerId: { $in: partnerIds },
                    isActive: true
                })
                : []

            // Create vehicle map by partner
            const vehicleByPartner = {}
            partnerVehicles.forEach(v => {
                const pid = v.b2cPartnerId.toString()
                if (!vehicleByPartner[pid]) {
                    vehicleByPartner[pid] = v
                }
            })

            // Enrich bookings with vehicle info AND trip status
            bookings = await Promise.all(b2cBookings.map(async (b) => {
                const bookingObj = b.toObject()
                const partnerId = bookingObj.b2cPartnerId?._id?.toString() || bookingObj.b2cPartnerId?.toString()

                // Get vehicle from schedule first (most accurate for monthly passes)
                const scheduleVehicleId = bookingObj.linkedSchedule?.assignedVehicle?.toString()
                // Then try route vehicle
                const routeVehicleId = bookingObj.routeId?.assignedVehicle?.toString()

                // Try to get vehicle info from different sources
                let vehicleInfo = null

                // Priority 1: Schedule assigned vehicle
                if (scheduleVehicleId && vehicleById[scheduleVehicleId]) {
                    vehicleInfo = vehicleById[scheduleVehicleId]
                }
                // Priority 2: Route assigned vehicle
                else if (routeVehicleId && vehicleById[routeVehicleId]) {
                    vehicleInfo = vehicleById[routeVehicleId]
                }
                // Priority 3: Partner's first active vehicle
                else if (partnerId && vehicleByPartner[partnerId]) {
                    vehicleInfo = vehicleByPartner[partnerId]
                }

                // Add vehicle info to booking if found and not already present
                if (vehicleInfo) {
                    if (!bookingObj.vehicleModel) {
                        bookingObj.vehicleModel = vehicleInfo.model
                    }
                    if (!bookingObj.vehiclePlate) {
                        bookingObj.vehiclePlate = vehicleInfo.licensePlate
                    }
                    // Add additional vehicle info
                    bookingObj.vehicleInfo = {
                        model: vehicleInfo.model,
                        licensePlate: vehicleInfo.licensePlate,
                        vehicleType: vehicleInfo.vehicleType,
                        vehicleColor: vehicleInfo.vehicleColor,
                        seatingCapacity: vehicleInfo.seatingCapacity,
                        features: vehicleInfo.features,
                        images: vehicleInfo.images
                    }
                }

                // CRITICAL: Compute hasActiveTripInProgress from the booking's monthly trips
                // This allows the Track button to show when a trip is IN_PROGRESS
                let hasActiveTripInProgress = false
                let activeTripInfo = null

                if (bookingObj.monthlyTrips && bookingObj.monthlyTrips.length > 0) {
                    try {
                        const B2CPartnerTrip = (await import("../models/B2CPartnerTrip.js")).default
                        const trips = await B2CPartnerTrip.find({
                            _id: { $in: bookingObj.monthlyTrips }
                        }).select('status fromLocation toLocation startTime actualStartTime')

                        for (const trip of trips) {
                            if (trip.status === 'In Progress' || trip.status === 'IN_PROGRESS' || trip.status === 'Started') {
                                hasActiveTripInProgress = true
                                activeTripInfo = {
                                    tripId: trip._id,
                                    fromLocation: trip.fromLocation,
                                    toLocation: trip.toLocation,
                                    status: trip.status,
                                    actualStartTime: trip.actualStartTime
                                }
                                break // Found an active trip
                            }
                        }
                    } catch (tripError) {
                        console.error("Error checking trips for booking:", bookingObj._id, tripError.message)
                    }
                }

                bookingObj.hasActiveTripInProgress = hasActiveTripInProgress
                bookingObj.activeTripInfo = activeTripInfo

                return {
                    ...bookingObj,
                    type: "B2C",
                    userType: "NORMAL_PASSENGER",
                }
            }))
        }

        return res.status(200).json({
            success: true,
            bookings,
            totalBookings: bookings.length,
            userType: user.companyId ? "CORPORATE_EMPLOYEE" : "NORMAL_PASSENGER",
        })
    } catch (error) {
        console.error("Error fetching passenger bookings:", error)
        return res.status(500).json({
            success: false,
            message: "Server error",
        })
    }
}


// Get partner bookings
export const getPartnerBookings = async (req, res) => {
    try {
        const partnerId = req.userId
        const { status } = req.query

        const query = { b2cPartnerId: partnerId }

        if (status && status !== "ALL") {
            query.bookingStatus = status
        }

        const bookings = await B2CPassengerBooking.find(query)
            .populate("passengerId", "fullName whatsappNumber email")
            .sort({ createdAt: -1 })
            .lean()

        // Get B2CPartnerDriver model for resolving driver names
        const B2CPartnerDriver = (await import("../models/B2CPartnerDriver.js")).default

        // Enhance bookings with resolved driver names for both outbound and return
        const enhancedBookings = await Promise.all(bookings.map(async (booking) => {
            let outboundDriverName = booking.driverName || null
            let returnDriverName = null

            // Resolve outbound driver name if not self-driver
            if (booking.outboundDriverId && !booking.outboundIsSelfDriver) {
                // Try B2CPartnerDriver first
                const b2cDriver = await B2CPartnerDriver.findById(booking.outboundDriverId).lean()
                if (b2cDriver) {
                    outboundDriverName = b2cDriver.name
                } else {
                    // Fallback to User table
                    const userDriver = await User.findById(booking.outboundDriverId).lean()
                    if (userDriver) {
                        outboundDriverName = userDriver.fullName || userDriver.name
                    }
                }
            } else if (booking.outboundIsSelfDriver) {
                outboundDriverName = 'Self-Driving'
            }

            // Resolve return driver name if ROUND_TRIP and different from outbound
            if (booking.bookingType === 'ROUND_TRIP' && booking.returnDriverId) {
                if (booking.returnIsSelfDriver) {
                    returnDriverName = 'Self-Driving'
                } else if (booking.returnDriverId.toString() !== booking.outboundDriverId?.toString()) {
                    // Different driver for return trip
                    const b2cDriver = await B2CPartnerDriver.findById(booking.returnDriverId).lean()
                    if (b2cDriver) {
                        returnDriverName = b2cDriver.name
                    } else {
                        const userDriver = await User.findById(booking.returnDriverId).lean()
                        if (userDriver) {
                            returnDriverName = userDriver.fullName || userDriver.name
                        }
                    }
                } else {
                    // Same driver as outbound
                    returnDriverName = outboundDriverName
                }
            }

            return {
                ...booking,
                outboundDriverName,
                returnDriverName
            }
        }))

        return res.status(200).json({
            success: true,
            bookings: enhancedBookings,
            totalBookings: enhancedBookings.length,
        })
    } catch (error) {
        console.error("Error fetching partner bookings:", error)
        return res.status(500).json({
            success: false,
            message: "Server error",
        })
    }
}

export const getCorporateOwnerBookings = async (req, res) => {
    try {
        const corporateOwnerId = req.userId
        const { status, date } = req.query

        console.log("[v0] Fetching corporate owner bookings from CorporateBooking model for:", corporateOwnerId)

        // Import CorporateBooking model
        const CorporateBooking = (await import("../models/CorporateBooking.js")).default
        const CorporateEmployee = (await import("../models/CorporateEmployee.js")).default

        // Query CorporateBooking model for bookings
        const bookingQuery = { corporateOwnerId: corporateOwnerId }

        if (status && status !== "all") {
            bookingQuery.bookingStatus = status
        }

        if (date) {
            const dateObj = new Date(date)
            const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0))
            const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999))
            bookingQuery.travelDate = {
                $gte: startOfDay,
                $lt: endOfDay,
            }
        }

        // Get all bookings for this corporate with populated data
        const corporateBookings = await CorporateBooking.find(bookingQuery)
            .populate("passengerId", "fullName email whatsappNumber")
            .populate("routeId", "fromLocation toLocation startTime endTime totalDistance")
            .populate("contractId", "contractNumber status")
            .populate("driverId", "name email phone")
            .populate("linkedSchedule", "scheduleName pickupTime dropTime")
            .sort({ createdAt: -1 })

        console.log("[v0] Found corporate bookings:", corporateBookings.length)

        // Transform bookings with employee details and trips
        const bookings = []

        for (const booking of corporateBookings) {
            try {
                // Get employee details from CorporateEmployee
                let employeeDetails = null
                if (booking.passengerId) {
                    employeeDetails = await CorporateEmployee.findOne({
                        userId: booking.passengerId._id
                    }).select("personalInfo employeeId transportDetails")
                }

                // Get trips for this booking
                let bookingTrips = []
                if (booking.monthlyTrips && booking.monthlyTrips.length > 0) {
                    bookingTrips = await Trip.find({
                        _id: { $in: booking.monthlyTrips }
                    })
                        .populate("driverId", "name email phone")
                        .populate("vehicleId", "model vehicleName licensePlate registrationNumber")
                        .sort({ tripDate: 1 })
                        .limit(50) // Limit to prevent huge responses
                }

                // Resolve driver info
                let driverName = booking.driverName || "Not Assigned"
                let driverInfo = booking.driverId

                if (booking.driverId && typeof booking.driverId === 'object') {
                    driverName = booking.driverId.name || "Not Assigned"
                }

                // Also try to get driver info from first trip if not in booking
                if (driverName === "Not Assigned" && bookingTrips.length > 0 && bookingTrips[0].driverId) {
                    const tripDriver = bookingTrips[0].driverId
                    if (typeof tripDriver === 'object' && tripDriver.name) {
                        driverName = tripDriver.name
                        driverInfo = tripDriver
                    }
                }

                // Get employee name from multiple sources
                const employeeName =
                    employeeDetails?.personalInfo?.firstName && employeeDetails?.personalInfo?.lastName
                        ? `${employeeDetails.personalInfo.firstName} ${employeeDetails.personalInfo.lastName}`
                        : booking.passengerId?.fullName || "Unknown Employee"

                const employeeEmail = employeeDetails?.personalInfo?.email || booking.passengerId?.email || ""
                const employeePhone = employeeDetails?.personalInfo?.phoneNumber || booking.passengerId?.whatsappNumber || ""
                const employeeIdNumber = employeeDetails?.employeeId || ""
                const department = employeeDetails?.personalInfo?.department || ""

                // Format trips for frontend
                const formattedTrips = bookingTrips.map(trip => ({
                    _id: trip._id,
                    tripDate: trip.tripDate,
                    fromLocation: trip.fromLocation,
                    toLocation: trip.toLocation,
                    startTime: trip.startTime,
                    endTime: trip.endTime,
                    status: trip.status,
                    tripType: trip.tripType,
                    direction: trip.direction,
                    driverName: trip.driverId?.name || driverName,
                    vehicleModel: trip.vehicleId?.model || trip.vehicleId?.vehicleName || booking.vehicleModel,
                    vehiclePlate: trip.vehicleId?.licensePlate || trip.vehicleId?.registrationNumber || booking.vehiclePlate,
                }))

                bookings.push({
                    _id: booking._id,
                    bookingId: booking._id,
                    // Employee Info
                    passengerId: booking.passengerId,
                    employeeName: employeeName,
                    employeeEmail: employeeEmail,
                    employeePhone: employeePhone,
                    employeeIdNumber: employeeIdNumber,
                    department: department,
                    // Booking Details
                    pickupLocation: booking.pickupLocation,
                    dropoffLocation: booking.dropoffLocation,
                    returnPickupLocation: booking.returnPickupLocation,
                    returnDropoffLocation: booking.returnDropoffLocation,
                    travelDate: booking.travelDate,
                    bookingDate: booking.bookingDate,
                    numberOfSeats: booking.numberOfSeats || 1,
                    bookingType: booking.bookingType,
                    bookingStatus: booking.bookingStatus,
                    // Pass Info
                    isMonthlyPass: booking.isMonthlyPass,
                    passDuration: booking.passDuration,
                    passStartDate: booking.passStartDate,
                    passEndDate: booking.passEndDate,
                    createdTripsCount: booking.createdTripsCount || formattedTrips.length,
                    totalTripsCount: booking.totalTripsCount || formattedTrips.length,
                    // Route/Schedule Info
                    routeId: booking.routeId,
                    routeName: booking.routeId ? `${booking.routeId.fromLocation} to ${booking.routeId.toLocation}` : "",
                    linkedSchedule: booking.linkedSchedule,
                    // Driver/Vehicle Info
                    driverId: driverInfo,
                    driverName: driverName,
                    vehicleModel: booking.vehicleModel,
                    vehiclePlate: booking.vehiclePlate,
                    // Contract Info
                    contractId: booking.contractId,
                    // Trips
                    trips: formattedTrips,
                    // Metadata
                    createdAt: booking.createdAt,
                    updatedAt: booking.updatedAt,
                })
            } catch (bookingError) {
                console.error("[v0] Error processing booking:", booking._id, bookingError?.message)
            }
        }

        // Count unique employees
        const uniqueEmployees = new Set(bookings.map(b => b.passengerId?._id?.toString()).filter(Boolean))

        console.log("[v0] Processed corporate bookings:", bookings.length, "Unique employees:", uniqueEmployees.size)

        return res.status(200).json({
            success: true,
            bookings,
            totalBookings: bookings.length,
            totalEmployees: uniqueEmployees.size,
        })
    } catch (error) {
        console.error("[v0] Error fetching corporate owner bookings:", error?.message, error?.stack)
        return res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error?.message || "Unknown error"
        })
    }
}

// Verify booking payment (Stripe)
export const verifyBookingPayment = async (req, res) => {
    try {
        const { sessionId, bookingId } = req.body

        const session = await stripe.checkout.sessions.retrieve(sessionId)

        if (session.payment_status === "paid") {
            const booking = await B2CPassengerBooking.findById(bookingId || session.metadata?.bookingId)

            if (booking) {
                booking.paymentStatus = "COMPLETED"
                booking.transactionId = session.payment_intent
                await booking.save()

                // Notify partner about confirmed booking
                await Notification.create({
                    recipientId: booking.b2cPartnerId,
                    userId: booking.b2cPartnerId,
                    type: "NEW_BOOKING",
                    title: "New Paid Booking",
                    message: `Payment received for booking. Amount: AED ${booking.paymentAmount}`,
                    data: {
                        bookingId: booking._id,
                        paymentAmount: booking.paymentAmount,
                    },
                    status: "UNREAD",
                })

                return res.status(200).json({
                    success: true,
                    booking,
                    message: "Payment verified successfully",
                })
            }
        }

        return res.status(400).json({
            success: false,
            message: "Payment not completed",
        })
    } catch (error) {
        console.error("Error verifying booking payment:", error)
        return res.status(500).json({
            success: false,
            message: "Server error",
        })
    }
}

export const handleTapWebhook = async (req, res) => {
    try {
        const { id, status, metadata } = req.body

        if (!metadata?.bookingId) {
            return res.status(400).json({ success: false, message: "Invalid webhook data" })
        }

        const booking = await B2CPassengerBooking.findById(metadata.bookingId)
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" })
        }

        if (status === "CAPTURED") {
            booking.paymentStatus = "COMPLETED"
            booking.transactionId = id
            await booking.save()

            await Notification.create({
                recipientId: booking.b2cPartnerId,
                userId: booking.b2cPartnerId,
                type: "NEW_BOOKING",
                title: "New Paid Booking",
                message: `Payment received via Tap. Amount: AED ${booking.paymentAmount}`,
                data: {
                    bookingId: booking._id,
                    paymentAmount: booking.paymentAmount,
                },
                status: "UNREAD",
            })
        } else if (status === "FAILED" || status === "DECLINED") {
            booking.paymentStatus = "FAILED"
            booking.bookingStatus = "CANCELLED"
            await booking.save()
        }

        return res.status(200).json({ success: true })
    } catch (error) {
        console.error("TAP webhook error:", error)
        return res.status(500).json({ success: false, message: "Webhook processing failed" })
    }
}

export const handleStripeWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"]
    let event

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_BOOKING_WEBHOOK_SECRET)
    } catch (err) {
        console.error("Stripe webhook signature verification failed:", err.message)
        return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object

        if (session.metadata?.type === "B2C_BOOKING") {
            const booking = await B2CPassengerBooking.findById(session.metadata.bookingId)
            if (booking) {
                booking.paymentStatus = "COMPLETED"
                booking.transactionId = session.payment_intent
                await booking.save()

                await Notification.create({
                    recipientId: booking.b2cPartnerId,
                    userId: booking.b2cPartnerId,
                    type: "NEW_BOOKING",
                    title: "New Paid Booking",
                    message: `Payment received via Stripe. Amount: AED ${booking.paymentAmount}`,
                    data: {
                        bookingId: booking._id,
                        paymentAmount: booking.paymentAmount,
                    },
                    status: "UNREAD",
                })

                // Send real-time notification to B2C partner
                sendRealTimeNotification(booking.b2cPartnerId, {
                    type: "NEW_BOOKING",
                    title: "New Paid Booking",
                    message: `Payment received via Stripe. Amount: AED ${booking.paymentAmount}`,
                    data: {
                        bookingId: booking._id,
                        paymentAmount: booking.paymentAmount,
                    },
                })

                // Send real-time notification to B2C partner
                sendRealTimeNotification(booking.b2cPartnerId, {
                    type: "NEW_BOOKING",
                    title: "New Paid Booking",
                    message: `Payment received via Tap Payment. Amount: AED ${booking.paymentAmount}`,
                    data: {
                        bookingId: booking._id,
                        paymentAmount: booking.paymentAmount,
                    },
                })
            }
        }
    }

    res.json({ received: true })
}

export const getAvailableSeats = async (req, res) => {
    try {
        const { routeId, date } = req.query

        if (!routeId || !date) {
            return res.status(400).json({
                success: false,
                message: "Route ID and date are required",
            })
        }

        const route = await Route.findById(routeId)
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            })
        }

        const dateObj = new Date(date)
        const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0))
        const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999))

        const b2cBookedSeats = await B2CPassengerBooking.aggregate([
            {
                $match: {
                    routeId: route._id,
                    travelDate: { $gte: startOfDay, $lt: endOfDay },
                    bookingStatus: { $in: ["CONFIRMED", "PENDING"] },
                },
            },
            { $group: { _id: null, totalSeats: { $sum: "$numberOfSeats" } } },
        ])

        const corporateBookedSeats = await CorporateBooking.aggregate([
            {
                $match: {
                    routeId: route._id,
                    travelDate: { $gte: startOfDay, $lt: endOfDay },
                    bookingStatus: "CONFIRMED",
                },
            },
            { $group: { _id: null, totalSeats: { $sum: "$numberOfSeats" } } },
        ])

        const totalBooked = (b2cBookedSeats[0]?.totalSeats || 0) + (corporateBookedSeats[0]?.totalSeats || 0)
        const totalSeats = route.totalSeats || route.availableSeats || 0
        const availableSeats = Math.max(0, totalSeats - totalBooked)

        return res.status(200).json({
            success: true,
            totalSeats,
            bookedSeats: totalBooked,
            availableSeats,
            date,
        })
    } catch (error) {
        console.error("Error getting available seats:", error)
        return res.status(500).json({
            success: false,
            message: "Server error",
        })
    }
}

// Get B2B_Partner driver bookings from Trip model
export const getB2B_PartnerDriverBookings = async (req, res) => {
    try {
        const paramDriverId = req.params.driverId || req.userId
        const { status } = req.query

        // Resolve the actual driver model ID from user's driverId field
        // Because Trip.driverId references drivers collection, not users collection
        let actualDriverId = paramDriverId
        const driverUser = await User.findById(paramDriverId)
        if (driverUser && driverUser.driverId) {
            actualDriverId = driverUser.driverId.toString()
        }

        console.log("[v0] Fetching B2B driver trips for userId:", paramDriverId, "actualDriverId:", actualDriverId)

        // Query Trip model where driver is assigned - check both user ID and driver model ID
        const driverIdFilter = actualDriverId !== paramDriverId
            ? { $or: [{ driverId: actualDriverId }, { driverId: paramDriverId }] }
            : { driverId: paramDriverId }

        const query = { ...driverIdFilter }
        if (status) {
            query.status = status
        }

        // Only show today's trips for daily driver view
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date(todayStart)
        todayEnd.setDate(todayEnd.getDate() + 1)

        // Build the final query - today's trips + any IN_PROGRESS
        const dateFilter = {
            $or: [
                { tripDate: { $gte: todayStart, $lt: todayEnd } },
                { status: 'IN_PROGRESS' }
            ]
        }
        const finalQuery = { $and: [driverIdFilter, dateFilter] }
        if (status) {
            finalQuery.$and.push({ status })
        }

        // Get today's trips assigned to this driver
        const trips = await Trip.find(finalQuery)
            .populate("routeId")
            .populate("vehicleId")
            .populate("corporateId", "companyName fullName")
            .populate("b2bPartnerId", "companyName fullName")
            .populate("passengers.employeeId", "fullName email whatsappNumber")
            .populate("passengers.passengerId", "fullName email whatsappNumber")
            .sort({ tripDate: 1 })
            .lean() // Use lean for better performance and simpler objects

        console.log("[v0] Found trips:", (trips || []).length)

        // Transform trips into booking format for frontend compatibility
        const bookings = (trips || []).map(trip => {
            // Get passengers with CONFIRMED status - safely handle undefined passengers
            const confirmedPassengers = (trip.passengers || []).filter(p =>
                status ? p.bookingStatus === status : true
            )

            return {
                _id: trip._id,
                tripId: trip._id,
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                endTime: trip.endTime,
                tripType: trip.tripType,
                direction: trip.direction,
                fromLocation: trip.fromLocation,
                toLocation: trip.toLocation,
                totalDistance: trip.totalDistance,
                estimatedDuration: trip.estimatedDuration,
                totalSeats: trip.totalSeats,
                availableSeats: trip.availableSeats,
                bookedSeats: trip.bookedSeats,
                status: trip.status,
                bookingStatus: trip.status, // Map trip status to bookingStatus for frontend
                passengers: confirmedPassengers,
                passengerCount: confirmedPassengers.length,
                route: trip.routeId,
                vehicle: trip.vehicleId,
                corporate: trip.corporateId,
                b2bPartner: trip.b2bPartnerId,
                currentLocation: trip.currentLocation,
                driverLocation: trip.driverLocation,
                events: trip.events,
                createdAt: trip.createdAt,
                updatedAt: trip.updatedAt,
            }
        })

        // Filter out trips with no passengers if status filter is applied
        const filteredBookings = status
            ? (bookings || []).filter(b => b && b.passengerCount > 0)
            : (bookings || [])

        console.log("[v0] Returning bookings:", (filteredBookings || []).length)

        res.status(200).json({
            success: true,
            bookings: filteredBookings,
            count: filteredBookings.length,
        })
    } catch (error) {
        console.error("[v0] Error fetching B2B driver bookings:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message,
        })
    }
}

// Start B2B_Partner Driver Trip - Works with Trip model
export const startB2B_PartnerDriverTrip = async (req, res) => {
    try {
        const driverId = req.userId
        const { bookingId } = req.params

        // Resolve actual driver model ID from user's driverId field
        let actualDriverId = driverId
        const driverUser = await User.findById(driverId)
        if (driverUser && driverUser.driverId) {
            actualDriverId = driverUser.driverId.toString()
        }

        console.log("[v0] Starting trip:", bookingId, "by driver userId:", driverId, "actualDriverId:", actualDriverId)

        // Try to find in Trip model first (corporate trips)
        let trip = await Trip.findById(bookingId)
            .populate("passengers.employeeId", "fullName email whatsappNumber")

        if (trip) {
            // It's a Trip model record - check against both user ID and driver model ID
            const tripDriverId = trip.driverId?.toString()
            if (tripDriverId !== driverId && tripDriverId !== actualDriverId) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized: This trip does not belong to you",
                })
            }

            trip.status = "IN_PROGRESS"
            trip.events.push({
                eventType: "TRIP_STARTED",
                timestamp: new Date(),
                description: "Trip started by driver",
            })
            await trip.save()

            // Notify all passengers
            for (const passenger of trip.passengers) {
                if (passenger.bookingStatus === "CONFIRMED") {
                    // Use passengerId (which is the userId) for notifications, not employeeId (which is CorporateEmployee record ID)
                    const passengerUserId = passenger.passengerId?._id || passenger.passengerId

                    if (passengerUserId) {
                        const tripStartNotification = await createNotification({
                            userId: passengerUserId,
                            type: "TRIP_STARTED",
                            title: "Trip Started",
                            message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} has started`,
                            relatedUserId: driverId,
                            bookingId: trip._id,
                        })

                        await sendRealTimeNotification(passengerUserId, {
                            type: "TRIP_STARTED",
                            title: tripStartNotification.title,
                            message: tripStartNotification.message,
                            data: {
                                tripId: trip._id,
                                driverId,
                                status: "IN_PROGRESS",
                                notification: tripStartNotification
                            }
                        })
                    }
                }
            }

            return res.status(200).json({
                success: true,
                booking: {
                    _id: trip._id,
                    status: trip.status,
                    bookingStatus: trip.status,
                    startedAt: new Date(),
                },
                message: "Trip started successfully",
            })
        }

        // Fallback to CorporateBooking model
        const booking = await CorporateBooking.findById(bookingId)

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Trip/Booking not found",
            })
        }

        if (booking.driverId?.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: This booking does not belong to you",
            })
        }

        booking.bookingStatus = "IN_PROGRESS"
        booking.startedAt = new Date()
        await booking.save()

        // Notify employee
        const tripStartNotification = await createNotification({
            userId: booking.passengerId,
            type: "TRIP_STARTED",
            title: "Trip Started",
            message: "Your corporate trip has started",
            relatedUserId: driverId,
            bookingId: booking._id,
        })

        await sendRealTimeNotification(booking.passengerId, {
            type: "TRIP_STARTED",
            title: tripStartNotification.title,
            message: tripStartNotification.message,
            data: {
                bookingId: booking._id,
                driverId,
                passengerId: booking.passengerId,
                notification: tripStartNotification
            }
        })

        res.status(200).json({
            success: true,
            booking,
            message: "Trip started successfully",
        })
    } catch (error) {
        console.error("[v0] Error starting trip:", error)
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        })
    }
}

// Complete Corporate Booking - Works with Trip model
export const completeB2B_PartnerDriverBooking = async (req, res) => {
    try {
        const driverId = req.userId
        const { bookingId } = req.params

        // Resolve actual driver model ID from user's driverId field
        let actualDriverId = driverId
        const driverUser = await User.findById(driverId)
        if (driverUser && driverUser.driverId) {
            actualDriverId = driverUser.driverId.toString()
        }

        console.log("[v0] Completing trip:", bookingId, "by driver userId:", driverId, "actualDriverId:", actualDriverId)

        // Try to find in Trip model first (corporate trips)
        let trip = await Trip.findById(bookingId)
            .populate("passengers.employeeId", "fullName email whatsappNumber")

        if (trip) {
            // It's a Trip model record - check against both user ID and driver model ID
            const tripDriverId = trip.driverId?.toString()
            if (tripDriverId !== driverId && tripDriverId !== actualDriverId) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized: This trip does not belong to you",
                })
            }

            trip.status = "COMPLETED"
            trip.events.push({
                eventType: "TRIP_COMPLETED",
                timestamp: new Date(),
                description: "Trip completed by driver",
            })
            await trip.save()

            // Notify all passengers
            for (const passenger of trip.passengers) {
                if (passenger.bookingStatus === "CONFIRMED") {
                    // Use passengerId (which is the userId) for notifications, not employeeId (which is CorporateEmployee record ID)
                    const passengerUserId = passenger.passengerId?._id || passenger.passengerId

                    if (passengerUserId) {
                        const tripCompleteNotification = await createNotification({
                            userId: passengerUserId,
                            type: "RIDE_COMPLETED",
                            title: "Trip Completed",
                            message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} has been completed`,
                            relatedUserId: driverId,
                            bookingId: trip._id,
                        })

                        await sendRealTimeNotification(passengerUserId, {
                            type: "RIDE_COMPLETED",
                            title: tripCompleteNotification.title,
                            message: tripCompleteNotification.message,
                            data: {
                                tripId: trip._id,
                                driverId,
                                status: "COMPLETED",
                                notification: tripCompleteNotification
                            }
                        })
                    }
                }
            }

            return res.status(200).json({
                success: true,
                booking: {
                    _id: trip._id,
                    status: trip.status,
                    bookingStatus: trip.status,
                    completedAt: new Date(),
                },
                message: "Trip completed successfully",
            })
        }

        // Fallback to CorporateBooking model
        const booking = await CorporateBooking.findById(bookingId)

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Trip/Booking not found",
            })
        }

        if (booking.driverId?.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: This booking does not belong to you",
            })
        }

        booking.bookingStatus = "COMPLETED"
        booking.completedAt = new Date()
        await booking.save()

        // Notify employee
        const corporateTripCompleteNotification = await createNotification({
            userId: booking.passengerId,
            type: "RIDE_COMPLETED",
            title: "Trip Completed",
            message: "Your corporate trip has been completed",
            relatedUserId: driverId,
            bookingId: booking._id,
        })

        await sendRealTimeNotification(booking.passengerId, {
            type: "RIDE_COMPLETED",
            title: corporateTripCompleteNotification.title,
            message: corporateTripCompleteNotification.message,
            data: {
                bookingId: booking._id,
                driverId,
                passengerId: booking.passengerId,
                notification: corporateTripCompleteNotification
            }
        })

        res.status(200).json({
            success: true,
            booking,
            message: "Trip completed successfully",
        })
    } catch (error) {
        console.error("[v0] Error completing trip:", error)
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        })
    }
}


// Get corporate driver bookings from Trip model
export const getCorporateDriverBookings = async (req, res) => {
    try {
        const paramDriverId = req.params.driverId || req.userId
        const { status } = req.query

        // Resolve the actual driver model ID from user's driverId field
        const driverUser = await User.findById(paramDriverId)
        const actualDriverModelId = driverUser?.driverId?.toString()
        const corporateOwnerId = driverUser?.employedBy?.toString()

        console.log("[v0] Fetching corporate driver trips for userId:", paramDriverId,
            "driverModelId:", actualDriverModelId,
            "corporateOwnerId:", corporateOwnerId)

        // Build driver ID filter - Trip.driverId can be User._id or CorporateDriver._id
        const driverIdConditions = [{ driverId: paramDriverId }]
        if (actualDriverModelId) {
            driverIdConditions.push({ driverId: actualDriverModelId })
        }

        // Also add corporateId filter to ensure driver only sees trips from their corporate
        const baseFilter = {
            $or: driverIdConditions,
        }

        // Add corporate filter if we know the employer
        if (corporateOwnerId) {
            baseFilter.corporateId = corporateOwnerId
        }

        const query = { ...baseFilter }
        if (status) {
            query.status = status
        }

        // Show trips from today onwards (not just today - driver may want to see upcoming trips too)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        // Include trips from today onwards or any in progress
        const dateFilter = {
            $or: [
                { tripDate: { $gte: todayStart } }, // Today and future trips
                { status: 'IN_PROGRESS' },
                { status: 'SCHEDULED' }
            ]
        }
        const finalQuery = { $and: [baseFilter, dateFilter] }
        if (status) {
            finalQuery.$and.push({ status })
        }

        // Get today's trips assigned to this driver for their corporate employer
        const trips = await Trip.find(finalQuery)
            .populate("routeId")
            .populate("vehicleId")
            .populate("corporateId", "companyName fullName")
            .populate("b2bPartnerId", "companyName fullName")
            .populate("passengers.employeeId", "fullName email whatsappNumber")
            .populate("passengers.passengerId", "fullName email whatsappNumber")
            .sort({ tripDate: 1 })

        console.log("[v0] Found corporate driver trips for today:", trips.length)

        // Transform trips into booking format for frontend compatibility
        const bookings = trips.map(trip => {
            const confirmedPassengers = trip.passengers.filter(p =>
                status ? p.bookingStatus === status : true
            )

            return {
                _id: trip._id,
                tripId: trip._id,
                tripDate: trip.tripDate,
                startTime: trip.startTime,
                endTime: trip.endTime,
                tripType: trip.tripType,
                direction: trip.direction,
                fromLocation: trip.fromLocation,
                toLocation: trip.toLocation,
                totalDistance: trip.totalDistance,
                estimatedDuration: trip.estimatedDuration,
                totalSeats: trip.totalSeats,
                availableSeats: trip.availableSeats,
                bookedSeats: trip.bookedSeats,
                status: trip.status,
                bookingStatus: trip.status,
                passengers: confirmedPassengers,
                passengerCount: confirmedPassengers.length,
                route: trip.routeId,
                vehicle: trip.vehicleId,
                corporate: trip.corporateId,
                corporateOwnerId: trip.corporateId,
                currentLocation: trip.currentLocation,
                driverLocation: trip.driverLocation,
                events: trip.events,
                createdAt: trip.createdAt,
                updatedAt: trip.updatedAt,
            }
        })

        const filteredBookings = status
            ? bookings.filter(b => b.passengerCount > 0)
            : bookings

        console.log("[v0] Returning corporate driver bookings:", filteredBookings.length)

        res.status(200).json({
            success: true,
            bookings: filteredBookings,
            count: filteredBookings.length,
        })
    } catch (error) {
        console.error("[v0] Error fetching corporate driver bookings:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message,
        })
    }
}

// Start Corporate Trip - Works with Trip model
export const startCorporateTrip = async (req, res) => {
    try {
        const driverId = req.userId
        const { bookingId } = req.params

        // Resolve actual driver model ID from user's driverId field
        let actualDriverId = driverId
        const driverUser = await User.findById(driverId)
        if (driverUser && driverUser.driverId) {
            actualDriverId = driverUser.driverId.toString()
        }

        // Try to find in Trip model first
        let trip = await Trip.findById(bookingId)
            .populate("passengers.employeeId", "fullName email whatsappNumber")

        if (trip) {
            const tripDriverId = trip.driverId?.toString()
            // Allow if no driver assigned yet, or if driver matches
            if (tripDriverId && tripDriverId !== driverId && tripDriverId !== actualDriverId) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized: This trip does not belong to you",
                })
            }

            trip.status = "IN_PROGRESS"
            trip.events.push({
                eventType: "TRIP_STARTED",
                timestamp: new Date(),
                description: "Trip started by driver",
            })
            // Assign driver if not yet assigned
            if (!trip.driverId) {
                trip.driverId = driverId;
            }
            await trip.save()

            // Notify all passengers
            for (const passenger of trip.passengers) {
                if (passenger.bookingStatus === "CONFIRMED" || passenger.status === "Confirmed") {
                    // Get the correct user ID - could be passengerId or employeeId
                    const passengerUserId = passenger.passengerId?._id || passenger.passengerId || passenger.employeeId?._id || passenger.employeeId;

                    if (passengerUserId) {
                        const tripStartNotification = await createNotification({
                            userId: passengerUserId,
                            type: "TRIP_STARTED",
                            title: "Trip Started",
                            message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} has started. Driver is on the way.`,
                            relatedUserId: driverId,
                            bookingId: trip._id,
                        })

                        await sendRealTimeNotification(passengerUserId, {
                            type: "TRIP_STARTED",
                            title: tripStartNotification.title,
                            message: tripStartNotification.message,
                            data: {
                                tripId: trip._id,
                                driverId,
                                status: "IN_PROGRESS",
                                notification: tripStartNotification
                            }
                        })
                    }
                }
            }

            return res.status(200).json({
                success: true,
                booking: {
                    _id: trip._id,
                    status: trip.status,
                    bookingStatus: trip.status,
                    startedAt: new Date(),
                },
                message: "Trip started successfully",
            })
        }

        // Fallback to CorporateBooking model
        const booking = await CorporateBooking.findById(bookingId)

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Trip/Booking not found",
            })
        }

        if (booking.driverId?.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: This booking does not belong to you",
            })
        }

        booking.bookingStatus = "IN_PROGRESS"
        booking.startedAt = new Date()
        await booking.save()

        // Notify employee
        const tripStartNotification = await createNotification({
            userId: booking.passengerId,
            type: "TRIP_STARTED",
            title: "Trip Started",
            message: "Your corporate trip has started",
            relatedUserId: driverId,
            bookingId: booking._id,
        })

        await sendRealTimeNotification(booking.passengerId, {
            type: "TRIP_STARTED",
            title: tripStartNotification.title,
            message: tripStartNotification.message,
            data: {
                bookingId: booking._id,
                driverId,
                passengerId: booking.passengerId,
                notification: tripStartNotification
            }
        })

        res.status(200).json({
            success: true,
            booking,
            message: "Trip started successfully",
        })
    } catch (error) {
        console.error("Error starting corporate trip:", error)
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        })
    }
}

// Complete Corporate Booking - Works with Trip model
export const completeCorporateBooking = async (req, res) => {
    try {
        const driverId = req.userId
        const { bookingId } = req.params

        // Resolve actual driver model ID from user's driverId field
        let actualDriverId = driverId
        const driverUser = await User.findById(driverId)
        if (driverUser && driverUser.driverId) {
            actualDriverId = driverUser.driverId.toString()
        }

        // Try to find in Trip model first
        let trip = await Trip.findById(bookingId)
            .populate("passengers.employeeId", "fullName email whatsappNumber")
            .populate("passengers.passengerId", "fullName email whatsappNumber")

        if (trip) {
            const tripDriverId = trip.driverId?.toString()
            // Allow if no driver assigned, or if driver matches
            if (tripDriverId && tripDriverId !== driverId && tripDriverId !== actualDriverId) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized: This trip does not belong to you",
                })
            }

            trip.status = "COMPLETED"
            trip.events.push({
                eventType: "TRIP_COMPLETED",
                timestamp: new Date(),
                description: "Trip completed by driver",
            })
            await trip.save()

            // Notify all passengers
            for (const passenger of trip.passengers) {
                if (passenger.bookingStatus === "CONFIRMED" || passenger.status === "Confirmed") {
                    // Get the correct user ID - could be passengerId or employeeId
                    const passengerUserId = passenger.passengerId?._id || passenger.passengerId || passenger.employeeId?._id || passenger.employeeId;

                    if (passengerUserId) {
                        const tripCompleteNotification = await createNotification({
                            userId: passengerUserId,
                            type: "RIDE_COMPLETED",
                            title: "Trip Completed",
                            message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} has been completed. Thank you for traveling with us!`,
                            relatedUserId: driverId,
                            bookingId: trip._id,
                        })

                        await sendRealTimeNotification(passengerUserId, {
                            type: "RIDE_COMPLETED",
                            title: tripCompleteNotification.title,
                            message: tripCompleteNotification.message,
                            data: {
                                tripId: trip._id,
                                driverId,
                                status: "COMPLETED",
                                notification: tripCompleteNotification
                            }
                        })
                    }
                }
            }

            return res.status(200).json({
                success: true,
                booking: {
                    _id: trip._id,
                    status: trip.status,
                    bookingStatus: trip.status,
                    completedAt: new Date(),
                },
                message: "Trip completed successfully",
            })
        }

        // Fallback to CorporateBooking model
        const booking = await CorporateBooking.findById(bookingId)

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Trip/Booking not found",
            })
        }

        if (booking.driverId?.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: This booking does not belong to you",
            })
        }

        booking.bookingStatus = "COMPLETED"
        booking.completedAt = new Date()
        await booking.save()

        // Notify employee
        const corporateTripCompleteNotification = await createNotification({
            userId: booking.passengerId,
            type: "RIDE_COMPLETED",
            title: "Trip Completed",
            message: "Your corporate trip has been completed",
            relatedUserId: driverId,
            bookingId: booking._id,
        })

        await sendRealTimeNotification(booking.passengerId, {
            type: "RIDE_COMPLETED",
            title: corporateTripCompleteNotification.title,
            message: corporateTripCompleteNotification.message,
            data: {
                bookingId: booking._id,
                driverId,
                passengerId: booking.passengerId,
                notification: corporateTripCompleteNotification
            }
        })

        res.status(200).json({
            success: true,
            booking,
            message: "Trip completed successfully",
        })
    } catch (error) {
        console.error("Error completing corporate trip:", error)
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        })
    }
}

// Get Daily Trips for a specific booking
export const getDailyTripsForBooking = async (req, res) => {
    try {
        const { bookingId } = req.params
        const userId = req.userId
        const userRole = req.userRole

        // Find the booking
        const booking = await B2CPassengerBooking.findById(bookingId).lean()

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
                data: []
            })
        }

        // Verify user has access to this booking
        const isPassenger = booking.passengerId?.toString() === userId
        const isPartner = booking.b2cPartnerId?.toString() === userId || booking.partnerId?.toString() === userId
        const isDriver = booking.driverId?.toString() === userId || booking.assignedDriverId?.toString() === userId

        // For B2C_PARTNER_DRIVER role, check via user.driverId matching booking.assignedDriverId
        let isPartnerDriver = false
        if (!isPassenger && !isPartner && !isDriver && userRole === "B2C_PARTNER_DRIVER") {
            // The User model has driverId that maps to B2CPartnerDriver._id
            // The booking has assignedDriverId that also maps to B2CPartnerDriver._id
            const driverUser = await User.findById(userId).lean()
            if (driverUser?.driverId) {
                const driverIdStr = driverUser.driverId.toString()
                if (driverIdStr === booking.assignedDriverId?.toString()) {
                    isPartnerDriver = true
                }
            }
            // Also check by B2CPartnerDriver record under the partner
            if (!isPartnerDriver) {
                const driverRecord = await B2CPartnerDriver.findOne({
                    _id: driverUser?.driverId,
                    b2cPartnerId: booking.b2cPartnerId || booking.partnerId
                }).lean()
                if (driverRecord) {
                    isPartnerDriver = true
                }
            }
        }

        if (!isPassenger && !isPartner && !isDriver && !isPartnerDriver) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to this booking",
                data: []
            })
        }

        // Get trips using the booking's monthlyTrips array (primary source)
        let dailyTrips = []

        if (booking.monthlyTrips && booking.monthlyTrips.length > 0) {
            // Use monthlyTrips array - these are B2CPartnerTrip IDs
            dailyTrips = await B2CPartnerTrip.find({
                _id: { $in: booking.monthlyTrips }
            })
                .populate('routeId', 'fromLocation toLocation')
                .populate('driverId', 'name phoneNumber')
                .sort({ tripDate: 1, startTime: 1 })
                .lean()
        } else if (booking.linkedTrip || booking.linkedReturnTrip) {
            // Fallback to linkedTrip references
            const tripIds = []
            if (booking.linkedTrip) tripIds.push(booking.linkedTrip)
            if (booking.linkedReturnTrip) tripIds.push(booking.linkedReturnTrip)
            dailyTrips = await B2CPartnerTrip.find({
                _id: { $in: tripIds }
            })
                .populate('routeId', 'fromLocation toLocation')
                .populate('driverId', 'name phoneNumber')
                .sort({ tripDate: 1, startTime: 1 })
                .lean()
        } else if (booking.routeId) {
            // Last fallback: find trips by route within booking date range
            const tripQuery = { routeId: booking.routeId }
            if (booking.passStartDate && booking.passEndDate) {
                tripQuery.tripDate = { $gte: new Date(booking.passStartDate), $lte: new Date(booking.passEndDate) }
            } else if (booking.travelDate) {
                const travelDate = new Date(booking.travelDate)
                const startOfDay = new Date(travelDate.getFullYear(), travelDate.getMonth(), travelDate.getDate())
                const endOfDay = new Date(travelDate.getFullYear(), travelDate.getMonth(), travelDate.getDate() + 1)
                tripQuery.tripDate = { $gte: startOfDay, $lt: endOfDay }
            }
            dailyTrips = await B2CPartnerTrip.find(tripQuery)
                .populate('routeId', 'fromLocation toLocation')
                .populate('driverId', 'name phoneNumber')
                .sort({ tripDate: 1, startTime: 1 })
                .lean()
        }

        // Filter to show only today's and future trips (not all 58 trips at once)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // For trips where driverId didn't populate (Self-driving case where driverId is User ID)
        // We need to fetch the User info
        const tripsNeedingUserLookup = dailyTrips.filter(trip => trip.driverId && !trip.driverId.name)
        if (tripsNeedingUserLookup.length > 0) {
            const userIds = [...new Set(tripsNeedingUserLookup.map(t => t.driverId.toString()))]
            const users = await User.find({ _id: { $in: userIds } })
                .select('fullName whatsappNumber profileImage')
                .lean()
            const userMap = {}
            users.forEach(u => {
                userMap[u._id.toString()] = {
                    name: u.fullName || 'Self',
                    phoneNumber: u.whatsappNumber || ''
                }
            })
            // Update trips with user info
            dailyTrips = dailyTrips.map(trip => {
                if (trip.driverId && !trip.driverId.name) {
                    const userInfo = userMap[trip.driverId.toString()]
                    if (userInfo) {
                        trip.driverId = userInfo
                    }
                }
                return trip
            })
        }

        // Enrich trips with booking-relevant data
        const enrichedTrips = dailyTrips.map(trip => ({
            ...trip,
            tripStatus: trip.status || "Scheduled",
            fromLocation: trip.fromLocation || trip.routeId?.fromLocation || booking.pickupLocation,
            toLocation: trip.toLocation || trip.routeId?.toLocation || booking.dropoffLocation,
            pickupTime: trip.startTime,
            driverName: trip.driverId?.name || booking.driverName,
            driverPhone: trip.driverId?.phoneNumber || booking.driverPhoneNumber,
            tripType: trip.tripType || booking.bookingType,
        }))

        res.status(200).json({
            success: true,
            data: enrichedTrips || [],
            message: "Daily trips retrieved successfully",
            count: (enrichedTrips || []).length
        })
    } catch (error) {
        console.error("Error fetching daily trips:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch daily trips",
            data: [],
            error: error.message
        })
    }
}

// Cancel a booking
export const cancelBooking = async (req, res) => {
    try {
        const { bookingId } = req.params
        const userId = req.userId
        const { cancellationReason } = req.body

        // Try B2C booking first
        let booking = await B2CPassengerBooking.findOne({
            _id: bookingId,
            passengerId: userId,
        }).populate('b2cPartnerId', 'name fullName companyName')

        let bookingType = "B2C"

        // If not B2C, try Corporate booking
        if (!booking) {
            booking = await CorporateBooking.findOne({
                _id: bookingId,
                $or: [
                    { passengerId: userId },
                    { corporateOwnerId: userId },
                ],
            })
            bookingType = "CORPORATE"
        }

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found or you don't have permission to cancel it",
            })
        }

        // Check booking status - B2C uses bookingStatus, Corporate uses status
        const currentStatus = booking.bookingStatus || booking.status

        if (["CANCELLED", "COMPLETED"].includes(currentStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel booking with status: ${currentStatus}`,
            })
        }

        // ===== BLOCK CANCELLATION ONCE ANY TRIP HAS EVER STARTED =====
        // A commuter may cancel their booking ONLY before ANY trip/service starts.
        // Once the driver — whether a self-driving B2C_PARTNER or an assigned B2C_PARTNER_DRIVER —
        // has STARTED (or COMPLETED) ANY trip, the entire booking can no longer be cancelled.
        // This is a permanent lock: even if the first trip completes and the next trip hasn't started,
        // the booking remains locked.
        //
        // For monthly passes / ROUND_TRIP bookings the top-level bookingStatus stays ACCEPTED
        // while individual daily trips run, so we must also inspect the trip-level statuses and
        // the actual B2CPartnerTrip documents to detect if any trip has ever started.
        let hasAnyTripEverStarted =
            currentStatus === "IN_PROGRESS" ||
            currentStatus === "COMPLETED" ||
            booking.outboundTripStatus === "IN_PROGRESS" ||
            booking.outboundTripStatus === "COMPLETED" ||
            booking.returnTripStatus === "IN_PROGRESS" ||
            booking.returnTripStatus === "COMPLETED"

        if (bookingType === "B2C" && !hasAnyTripEverStarted) {
            const activeTripIds = []
            if (Array.isArray(booking.monthlyTrips)) activeTripIds.push(...booking.monthlyTrips)
            if (booking.linkedTrip) activeTripIds.push(booking.linkedTrip)
            if (booking.linkedReturnTrip) activeTripIds.push(booking.linkedReturnTrip)

            if (activeTripIds.length > 0) {
                // Check for any trip that has EVER been started (IN_PROGRESS or COMPLETED)
                const anyStartedTrip = await B2CPartnerTrip.findOne({
                    _id: { $in: activeTripIds },
                    $or: [
                        { status: "In Progress" },
                        { status: "Completed" },
                        { tripStarted: true }, // Even if tripCompleted is also true, it started
                    ],
                }).select("_id")
                if (anyStartedTrip) hasAnyTripEverStarted = true
            }
        }

        if (hasAnyTripEverStarted) {
            return res.status(400).json({
                success: false,
                message: "Your trip has already started, so this booking can no longer be cancelled. Cancellations are only allowed before the driver starts any trip.",
            })
        }

        // Store previous status to check if it was ACCEPTED
        const wasAccepted = currentStatus === "ACCEPTED"
        const wasConfirmed = currentStatus === "CONFIRMED"

        // ===== CALCULATE CANCELLATION FEE (PRO-RATA AWARE) =====
        let cancellationFee = 0
        let refundAmount = 0
        let usedTripsCount = 0
        let remainingTripsCount = 0
        let refundableBase = 0 // money tied to unused/remaining trips
        const bookingCreatedAt = new Date(booking.createdAt)
        const now = new Date()
        const hoursSinceBooking = (now - bookingCreatedAt) / (1000 * 60 * 60)

        const travelDate = new Date(booking.travelDate)
        let hoursUntilTravel = (travelDate - now) / (1000 * 60 * 60)

        // Resolve the fare base defensively: fall back to the route's configured
        // pricing if the booking was stored with a missing/zero paymentAmount, so
        // the cancellation fee / cash due is never silently zero.
        const paymentAmount = await resolveBookingFareBase(booking, bookingType)
        const isPaid = booking.paymentStatus === "COMPLETED" || booking.paymentStatus === "PAID"

        // ===== REFUNDABLE BASE: FULL PASS AMOUNT =====
        // Cancellation is only allowed BEFORE the driver starts a trip, so the entire pass is
        // treated as refundable. The commuter is refunded the FULL amount they paid; the only
        // thing that ever reduces the refund is the time-based cancellation fee below.
        // We still compute used/remaining trip counts purely for informational notifications.
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        // CRITICAL: For CASH bookings, check if cash was actually collected yet.
        // Cash is only collected during the first trip. If cancellation happens BEFORE
        // the first trip date has arrived, no cash was exchanged, so refund = 0.
        // ===== HAS ANY CASH ACTUALLY BEEN COLLECTED? =====
        // For CASH bookings the operator collects the fare ONLY when a driver STARTS a
        // trip (trip status becomes "In Progress"/"Completed", or tripStarted=true).
        // Cancellation is already blocked once any trip has started (guard above), so by
        // the time we get here a cash booking has almost never had cash collected.
        //
        // IMPORTANT: collection is decided by trip *status*, NOT by the trip *date*. A
        // scheduled trip whose date is in the past was simply never run, so no cash was
        // exchanged. The previous date-based heuristic wrongly treated a past-but-never-
        // started trip as "collected", which let cash cancellations slip through with no
        // fee. We now treat a cash booking as uncollected unless a trip truly started or
        // the booking is explicitly marked paid.
        let isCashCollected = true // online payments are always "collected"
        if (booking.paymentMethod === "CASH") {
            // Start from the explicit payment flag (covers any pre-paid/settled cash flow).
            isCashCollected = booking.paymentStatus === "COMPLETED" || booking.paymentStatus === "PAID"

            if (!isCashCollected && booking.isMonthlyPass && Array.isArray(booking.monthlyTrips) && booking.monthlyTrips.length > 0) {
                // Monthly pass: cash is collected on the first trip the driver actually runs.
                try {
                    const startedTrip = await B2CPartnerTrip.findOne({
                        _id: { $in: booking.monthlyTrips },
                        $or: [
                            { status: "In Progress" },
                            { status: "Completed" },
                            { tripStarted: true },
                        ],
                    }).select("_id")
                    isCashCollected = !!startedTrip
                } catch (cashCheckErr) {
                    console.error("[cancelBooking] Failed to check if cash collected:", cashCheckErr)
                    isCashCollected = false // Assume not collected on error (safer for commuter)
                }
            }

            console.log("[cancelBooking] Cash collection check:", {
                isMonthlyPass: booking.isMonthlyPass,
                paymentStatus: booking.paymentStatus,
                isCashCollected,
            })
        }

        if (bookingType === "B2C" && booking.isMonthlyPass && Array.isArray(booking.monthlyTrips) && booking.monthlyTrips.length > 0) {
            try {
                const passTrips = await B2CPartnerTrip.find({ _id: { $in: booking.monthlyTrips } }).select("tripDate status")

                let earliestUpcomingTrip = null
                for (const t of passTrips) {
                    const tDate = new Date(t.tripDate)
                    const isPast = tDate < todayStart
                    const isDone = ["Completed", "In Progress"].includes(t.status)
                    if (isPast || isDone) {
                        usedTripsCount++
                    } else {
                        remainingTripsCount++
                        if (!earliestUpcomingTrip || tDate < earliestUpcomingTrip) {
                            earliestUpcomingTrip = tDate
                        }
                    }
                }

                // For monthly passes the booking-level `travelDate` is unreliable: bookings
                // are created with `travelDate = new Date()` (the creation moment), which makes
                // `hoursUntilTravel` collapse to ~0 and forces the most aggressive last-minute
                // tier on every cancellation. Re-anchor the timing to the EARLIEST upcoming
                // (not-yet-started) trip so the admin's time-based tiers are applied accurately.
                if (earliestUpcomingTrip) {
                    hoursUntilTravel = (earliestUpcomingTrip - now) / (1000 * 60 * 60)
                    console.log("[cancelBooking] Re-anchored hoursUntilTravel to earliest upcoming trip:", {
                        earliestUpcomingTrip,
                        hoursUntilTravel,
                    })
                }
            } catch (countErr) {
                console.error("[cancelBooking] Trip count (informational) failed:", countErr)
            }
        } else {
            remainingTripsCount = 1
        }

        // Full pass amount is refundable (minus the timing fee) — BUT ONLY IF PAYMENT WAS MADE.
        // For CASH bookings, payment is made during the first trip. If cancelled before first trip,
        // no refund is due (cash was never collected).
        refundableBase = (booking.paymentMethod === "CASH" && !isCashCollected) ? 0 : paymentAmount

        console.log("[cancelBooking] Full-refund monthly pass calc:", {
            paymentAmount,
            paymentMethod: booking.paymentMethod,
            isCashCollected,
            refundableBase,
            usedTripsCount,
            remainingTripsCount
        })

        // ===== DYNAMIC, ADMIN-CONFIGURED CANCELLATION FEE =====
        // The cancellation fee is no longer hardcoded. The admin defines a free
        // cancellation window (hours after booking) plus a set of time-based tiers
        // (charge % based on how many hours remain until travel) in the
        // CancellationSettings singleton. We evaluate those rules here so any change
        // the admin makes in their panel is immediately reflected in real refunds.
        let cancellationTierLabel = "No charge"
        if (isPaid && refundableBase > 0) {
            try {
                const cancellationSettings = await CancellationSettings.getSettings()
                const feeResult = CancellationSettings.computeFee(cancellationSettings, {
                    refundableBase,
                    hoursSinceBooking,
                    hoursUntilTravel,
                })
                cancellationFee = feeResult.cancellationFee
                cancellationTierLabel = feeResult.appliedTierLabel
                refundAmount = Math.max(0, refundableBase - cancellationFee)

                console.log("[cancelBooking] Applied dynamic cancellation policy:", {
                    freeWindowHoursAfterBooking: cancellationSettings.freeWindowHoursAfterBooking,
                    isActive: cancellationSettings.isActive,
                    hoursSinceBooking,
                    hoursUntilTravel,
                    chargePercentage: feeResult.chargePercentage,
                    appliedTierLabel: feeResult.appliedTierLabel,
                    cancellationFee,
                    refundAmount,
                })
            } catch (settingsErr) {
                // Fail safe: if settings can't be read, do not charge a fee (full refund).
                console.error("[cancelBooking] Failed to load cancellation settings, defaulting to no fee:", settingsErr.message)
                cancellationFee = 0
                refundAmount = refundableBase
            }
        }

        // ===== CASH CANCELLATION DUE (commuter paid nothing yet) =====
        // For a CASH booking cancelled BEFORE the first trip, no money was ever
        // collected, so there is nothing to deduct a fee from. Instead of letting
        // the cancellation be free (the old bug), we compute the policy fee on the
        // FULL fare and record it as an OUTSTANDING DUE anchored to the commuter's
        // registration identity. The free window + tiers still apply, so an early
        // cancel can be free.
        let cashCancellationDue = 0
        let cashCancellationTierLabel = "No charge"
        let cashAccountability = null
        const isUncollectedCashBooking = booking.paymentMethod === "CASH" && !isCashCollected
        // Admin policy applies to EVERY cancellation outside the free window, regardless of
        // whether the partner had already accepted/confirmed the booking. The free window and
        // time-based tiers still protect genuinely early cancellations (an early cancel can be free).
        if (isUncollectedCashBooking) {
            try {
                const cashSettings = await CancellationSettings.getSettings()
                const dueResult = CancellationSettings.computeCashDue(cashSettings, {
                    fareBase: paymentAmount,
                    hoursSinceBooking,
                    hoursUntilTravel,
                })
                cashCancellationDue = dueResult.dueAmount
                cashCancellationTierLabel = dueResult.appliedTierLabel

                console.log("[cancelBooking] Cash cancellation due computed:", {
                    fareBase: paymentAmount,
                    hoursSinceBooking,
                    hoursUntilTravel,
                    chargePercentage: dueResult.chargePercentage,
                    appliedTierLabel: dueResult.appliedTierLabel,
                    cashCancellationDue,
                })
            } catch (cashDueErr) {
                console.error("[cancelBooking] Failed to compute cash cancellation due:", cashDueErr.message)
                cashCancellationDue = 0
            }
        }

        // Persist usage snapshot for transparency
        booking.usedTripsCount = usedTripsCount
        booking.remainingTripsCount = remainingTripsCount

        console.log("[cancelBooking] Cancellation calculation:", {
            bookingId,
            paymentMethod: booking.paymentMethod,
            wasAccepted,
            hoursSinceBooking,
            hoursUntilTravel,
            paymentAmount,
            usedTripsCount,
            remainingTripsCount,
            refundableBase,
            cancellationFee,
            refundAmount
        })

        // Update the correct status field
        if (bookingType === "B2C") {
            booking.bookingStatus = "CANCELLED"
        } else {
            booking.status = "CANCELLED"
        }
        booking.cancellationReason = cancellationReason || "Cancelled by user"
        booking.cancelledAt = new Date()
        booking.cancelledBy = userId

        // ===== SEAT RESTORATION LOGIC =====
        if (bookingType === "B2C") {
            const tripsToRestore = []
            if (booking.linkedTrip) tripsToRestore.push(booking.linkedTrip)
            if (booking.linkedReturnTrip) tripsToRestore.push(booking.linkedReturnTrip)

            for (const tripId of tripsToRestore) {
                try {
                    const trip = await B2CPartnerTrip.findById(tripId)
                    if (trip) {
                        const seatsToRestore = booking.numberOfSeats || 1
                        trip.bookedSeats = Math.max(0, trip.bookedSeats - seatsToRestore)
                        trip.availableSeats = trip.totalSeats - trip.bookedSeats

                        // Remove passenger from trip's passengers array
                        trip.passengers = trip.passengers.filter(
                            p => p.bookingId?.toString() !== bookingId
                        )

                        await trip.save()
                        console.log("[cancelBooking] Restored seats in trip:", {
                            tripId,
                            seatsRestored: seatsToRestore,
                            newAvailableSeats: trip.availableSeats
                        })
                    }
                } catch (tripError) {
                    console.error("[cancelBooking] Error restoring trip seats:", tripError)
                }
            }

            // ===== MONTHLY PASS TRIP CLEANUP =====
            if (booking.isMonthlyPass && booking.monthlyTrips && booking.monthlyTrips.length > 0) {
                console.log("[cancelBooking] Cleaning up monthly pass trips:", booking.monthlyTrips.length)

                const today = new Date()
                today.setHours(0, 0, 0, 0)

                for (const tripId of booking.monthlyTrips) {
                    try {
                        const trip = await B2CPartnerTrip.findById(tripId)
                        if (trip && new Date(trip.tripDate) >= today) {
                            const seatsToRestore = booking.numberOfSeats || 1
                            trip.bookedSeats = Math.max(0, trip.bookedSeats - seatsToRestore)
                            trip.availableSeats = trip.totalSeats - trip.bookedSeats

                            // Remove passenger from trip's passengers array
                            trip.passengers = trip.passengers.filter(
                                p => p.bookingId?.toString() !== bookingId
                            )

                            await trip.save()
                        }
                    } catch (tripError) {
                        console.error("[cancelBooking] Error cleaning up monthly trip:", tripError)
                    }
                }

                // Update monthly pass status if exists
                if (booking.monthlyPassId) {
                    const B2CMonthlyPass = (await import("../models/B2CMonthlyPass.js")).default
                    await B2CMonthlyPass.findByIdAndUpdate(booking.monthlyPassId, {
                        status: "CANCELLED",
                        updatedAt: new Date()
                    })
                }
            }
        }

        // ===== REFUND PROCESSING =====
        // Online (STRIPE/TAP/CARD): platform held the money -> credit commuter wallet.
        // CASH: commuter paid the partner directly, platform never held money -> partner must
        // return the cash offline. We only record the amount due, never credit the app wallet.
        const isCashBooking = booking.paymentMethod === "CASH"

        if (isPaid && refundAmount > 0 && !isCashBooking) {
            try {
                const wallet = await Wallet.findOne({ userId })
                if (wallet) {
                    const balanceBefore = wallet.balance
                    wallet.balance += refundAmount

                    let description = `Refund for cancelled booking #${booking.bookingNumber || bookingId}`
                    if (booking.isMonthlyPass) {
                        description += ` (full pass refund)`
                    }
                    if (cancellationFee > 0) {
                        description += ` (${booking.currency || 'AED'} ${cancellationFee.toFixed(2)} cancellation fee deducted)`
                    }

                    wallet.transactions.push({
                        type: "REFUND",
                        amount: refundAmount,
                        description,
                        reference: bookingId,
                        timestamp: new Date(),
                    })
                    await wallet.save()

                    await Transaction.create({
                        walletId: wallet._id,
                        userId: userId,
                        type: "CREDIT",
                        amount: refundAmount,
                        currency: booking.currency || "AED",
                        category: "REFUND",
                        description,
                        referenceId: booking._id,
                        referenceModel: "B2CPassengerBooking",
                        balanceBefore: balanceBefore,
                        balanceAfter: wallet.balance,
                        metadata: {
                            bookingId: booking._id,
                            originalAmount: booking.paymentAmount || booking.totalAmount,
                            usedTripsCount,
                            remainingTripsCount,
                            cancellationFee,
                            refundAmount,
                            cancelledBy: "COMMUTER",
                            cancellationReason
                        }
                    })
                }

                booking.paymentStatus = "REFUNDED"
                booking.refundStatus = "COMPLETED"
                booking.refundMethod = "WALLET"
                booking.refundAmount = refundAmount
                booking.cancellationFee = cancellationFee
            } catch (refundError) {
                console.error("[cancelBooking] Refund processing error:", refundError)
            }
        } else if (isCashBooking && refundAmount > 0) {
            // CASH: partner owes the unused-trip amount back to the commuter (settled offline)
            booking.refundMethod = "CASH_FROM_PARTNER"
            booking.cashRefundDueFromPartner = refundAmount
            booking.cashRefundSettled = false
            booking.refundStatus = "PENDING"
            booking.refundAmount = refundAmount
            booking.cancellationFee = cancellationFee
            console.log("[cancelBooking] CASH booking - partner owes commuter:", {
                cashRefundDueFromPartner: refundAmount,
                usedTripsCount,
                remainingTripsCount
            })
        } else {
            booking.refundMethod = "NONE"
            booking.refundAmount = 0
            booking.cancellationFee = cancellationFee
        }

        // ===== SETTLE CANCELLATION FEE TO ADMIN =====
        // ONLINE (STRIPE/TAP): the platform already holds the full fare, so the fee is simply
        //   credited to the admin wallet (no counter-party debit needed).
        // CASH: the partner collected the full fare in cash and returns only the unused value
        //   MINUS the cancellation fee to the commuter — so the partner is physically holding the
        //   cancellation fee. That fee belongs to the admin, so we settle it via wallet here:
        //   partner wallet (DEBIT) -> admin wallet (CREDIT). This only applies when the booking was
        //   accepted (partner actually collected the cash).
        if (cancellationFee > 0) {
            try {
                const adminUser = await User.findOne({ role: 'ADMIN' })
                if (adminUser) {
                    // Cancellation fee settles into the admin wallet for the
                    // booking's currency (AED for UAE, KWD for Kuwait, ...).
                    let adminWallet = await getOrCreateWallet(adminUser._id, {
                        currency: booking.currency || 'AED',
                        role: 'ADMIN',
                    })

                    if (!isCashBooking) {
                        // ----- ONLINE: credit fee to admin (platform held the money) -----
                        const adminBalanceBefore = adminWallet.balance
                        adminWallet.balance += cancellationFee
                        adminWallet.totalEarnings = (adminWallet.totalEarnings || 0) + cancellationFee
                        adminWallet.transactions.push({
                            type: 'DEPOSIT',
                            amount: cancellationFee,
                            description: `Cancellation fee from booking ${booking._id}`,
                            status: 'COMPLETED'
                        })
                        await adminWallet.save()

                        await Transaction.create({
                            walletId: adminWallet._id,
                            userId: adminUser._id,
                            type: "CREDIT",
                            amount: cancellationFee,
                            currency: booking.currency || "AED",
                            category: "CANCELLATION_FEE",
                            description: `Cancellation fee from booking ${booking._id}`,
                            referenceId: booking._id,
                            referenceModel: "B2CPassengerBooking",
                            balanceBefore: adminBalanceBefore,
                            balanceAfter: adminWallet.balance,
                            metadata: {
                                bookingId: booking._id,
                                cancelledBy: userId,
                                cancellationReason
                            }
                        })

                        console.log("[cancelBooking] Cancellation fee credited to admin (online):", cancellationFee)
                    } else if (wasAccepted) {
                        // ----- CASH: partner holds the fee in cash -> transfer to admin via wallet -----
                        const feePartnerId = booking.b2cPartnerId._id || booking.b2cPartnerId
                        const feePartnerWallet = await Wallet.findOne({ userId: feePartnerId })

                        if (feePartnerWallet) {
                            const partnerBalanceBefore = feePartnerWallet.balance
                            // The partner physically collected the commuter's cash cancellation fee, so they
                            // owe the FULL fee to the admin. Deduct the full fee from their wallet. If their
                            // balance is less than the fee, the balance goes NEGATIVE on purpose — the partner
                            // must add money (top up) to bring the wallet back to >= 0 before they can withdraw.
                            feePartnerWallet.balance = Math.round((feePartnerWallet.balance - cancellationFee) * 100) / 100
                            feePartnerWallet.transactions.push({
                                type: 'CANCELLATION_FEE',
                                amount: cancellationFee,
                                description: `Cancellation fee paid to admin - cash booking cancelled by passenger (Booking #${booking.bookingNumber || booking._id})`,
                                status: 'COMPLETED',
                                createdAt: new Date()
                            })
                            await feePartnerWallet.save()

                            await Transaction.create({
                                walletId: feePartnerWallet._id,
                                userId: feePartnerId,
                                type: "DEBIT",
                                amount: cancellationFee,
                                currency: booking.currency || "AED",
                                category: "CANCELLATION_FEE",
                                description: `Cancellation fee paid to admin - cash booking cancelled by passenger`,
                                referenceId: booking._id,
                                referenceModel: "B2CPassengerBooking",
                                balanceBefore: partnerBalanceBefore,
                                balanceAfter: feePartnerWallet.balance,
                                metadata: {
                                    bookingId: booking._id,
                                    cancelledBy: userId,
                                    cancellationReason,
                                    reason: "cash_cancellation_fee_collected_by_partner"
                                }
                            })

                            console.log("[cancelBooking] Cancellation fee debited from partner (cash):", {
                                cancellationFee,
                                balanceBefore: partnerBalanceBefore,
                                balanceAfter: feePartnerWallet.balance
                            })
                        }

                        // Credit the same fee to the admin wallet
                        const adminBalanceBefore = adminWallet.balance
                        adminWallet.balance += cancellationFee
                        adminWallet.totalEarnings = (adminWallet.totalEarnings || 0) + cancellationFee
                        adminWallet.transactions.push({
                            type: 'DEPOSIT',
                            amount: cancellationFee,
                            description: `Cancellation fee from cash booking ${booking._id} (collected by partner from passenger)`,
                            status: 'COMPLETED',
                            createdAt: new Date()
                        })
                        await adminWallet.save()

                        await Transaction.create({
                            walletId: adminWallet._id,
                            userId: adminUser._id,
                            type: "CREDIT",
                            amount: cancellationFee,
                            currency: booking.currency || "AED",
                            category: "CANCELLATION_FEE",
                            description: `Cancellation fee from cash booking ${booking._id} (paid by partner)`,
                            referenceId: booking._id,
                            referenceModel: "B2CPassengerBooking",
                            balanceBefore: adminBalanceBefore,
                            balanceAfter: adminWallet.balance,
                            metadata: {
                                bookingId: booking._id,
                                cancelledBy: userId,
                                cancellationReason,
                                reason: "cash_cancellation_fee_paid_by_partner",
                                paidByPartner: feePartnerId
                            }
                        })

                        // Track on the booking that the partner has settled the fee with admin
                        booking.cashCancellationFeePaidByPartner = true
                        booking.cashCancellationFeeAmount = cancellationFee

                        console.log("[cancelBooking] Cancellation fee credited to admin (cash, paid by partner):", cancellationFee)
                    }
                }
            } catch (feeError) {
                console.error("[cancelBooking] Error settling cancellation fee:", feeError)
            }
        }

        // ===== REVERSE WALLET TRANSACTIONS IF BOOKING WAS ACCEPTED =====
        // If booking was ACCEPTED, admin commission was already processed
        // Decision: Commission is NOT returned if booking was accepted (penalty for late cancellation)
        // But we should still handle the partner's earnings properly
        if (wasAccepted && bookingType === "B2C") {
            const adminCommission = booking.adminCommissionAmount || 0
            const driverEarnings = booking.driverEarnings || 0
            const partnerId = booking.b2cPartnerId._id || booking.b2cPartnerId

            console.log("[cancelBooking] Handling ACCEPTED booking cancellation:", {
                adminCommission,
                driverEarnings,
                paymentMethod: booking.paymentMethod
            })

            // Get Partner wallet (scoped to the booking's currency)
            const partnerWallet = await Wallet.findOne({ userId: partnerId, currency: booking.currency || 'AED' })

            // NOTE: use `isPaid` (captured BEFORE the refund block mutates paymentStatus to
            // "REFUNDED"). Using booking.paymentStatus here would always be false after refund,
            // which previously prevented partner/admin reversals from ever running.
            if ((booking.paymentMethod === "STRIPE" || booking.paymentMethod === "TAP" || booking.paymentMethod === "WALLET") && isPaid) {
                // ONLINE (STRIPE/TAP/WALLET): during acceptance the platform split the commuter's payment
                // into partner earnings + admin commission. Because the commuter is refunded the FULL
                // pass amount, we must reverse BOTH the full partner earnings and the full admin
                // commission so the platform books stay balanced.
                const earningsToReverse = driverEarnings
                const commissionToReverse = adminCommission

                console.log("[cancelBooking] ONLINE booking - full reversal:", {
                    paymentMethod: booking.paymentMethod,
                    earningsToReverse,
                    commissionToReverse,
                    usedTripsCount,
                    remainingTripsCount
                })

                // 1. Reverse partner earnings (full - commuter is refunded the full pass amount)
                if (partnerWallet && earningsToReverse > 0) {
                    const partnerBalanceBefore = partnerWallet.balance
                    partnerWallet.balance = Math.max(0, partnerWallet.balance - earningsToReverse)
                    partnerWallet.totalEarnings = Math.max(0, (partnerWallet.totalEarnings || 0) - earningsToReverse)
                    partnerWallet.transactions.push({
                        type: 'EARNINGS_REVERSAL',
                        amount: earningsToReverse,
                        description: `Earnings reversed (full) - booking cancelled by passenger (Booking #${booking.bookingNumber || booking._id})`,
                        status: 'COMPLETED',
                        createdAt: new Date()
                    })
                    await partnerWallet.save()

                    await Transaction.create({
                        walletId: partnerWallet._id,
                        userId: partnerId,
                        type: "DEBIT",
                        amount: earningsToReverse,
                        currency: booking.currency || "AED",
                        category: "EARNINGS_REVERSAL",
                        description: `Earnings reversed (full) - booking cancelled by passenger`,
                        referenceId: booking._id,
                        referenceModel: "B2CPassengerBooking",
                        balanceBefore: partnerBalanceBefore,
                        balanceAfter: partnerWallet.balance,
                        metadata: {
                            bookingId: booking._id,
                            reason: "booking_cancelled_by_passenger",
                            cancelledBy: userId,
                            usedTripsCount,
                            remainingTripsCount,
                            fullDriverEarnings: driverEarnings
                        }
                    })

                    console.log("[cancelBooking] Reversed partner earnings (pro-rata):", earningsToReverse)
                }

                // 2. Reverse admin commission (full) so the commuter gets the full pass amount back.
                if (commissionToReverse > 0) {
                    const adminUser = await User.findOne({ role: 'ADMIN' })
                    if (adminUser) {
                        const adminWallet = await Wallet.findOne({ userId: adminUser._id, currency: booking.currency || 'AED' })
                        if (adminWallet) {
                            const adminBalanceBefore = adminWallet.balance
                            adminWallet.balance = Math.max(0, adminWallet.balance - commissionToReverse)
                            adminWallet.totalEarnings = Math.max(0, (adminWallet.totalEarnings || 0) - commissionToReverse)
                            adminWallet.transactions.push({
                                type: 'COMMISSION_REVERSAL',
                                amount: commissionToReverse,
                                description: `Commission reversed (full) - online booking cancelled by passenger (Booking #${booking.bookingNumber || booking._id})`,
                                status: 'COMPLETED',
                                createdAt: new Date()
                            })
                            await adminWallet.save()

                            await Transaction.create({
                                walletId: adminWallet._id,
                                userId: adminUser._id,
                                type: "DEBIT",
                                amount: commissionToReverse,
                                currency: booking.currency || "AED",
                                category: "COMMISSION_REVERSAL",
                                description: `Commission reversed (full) - online booking cancelled by passenger`,
                                referenceId: booking._id,
                                referenceModel: "B2CPassengerBooking",
                                balanceBefore: adminBalanceBefore,
                                balanceAfter: adminWallet.balance,
                                metadata: {
                                    bookingId: booking._id,
                                    reason: "online_booking_cancelled_by_commuter",
                                    cancelledBy: userId,
                                    usedTripsCount,
                                    remainingTripsCount,
                                    fullAdminCommission: adminCommission
                                }
                            })

                            console.log("[cancelBooking] Reversed admin commission (pro-rata):", commissionToReverse)
                        }
                    }
                }
            } else if (booking.paymentMethod === "CASH") {
                // CASH Payment: B2C Partner already paid commission to admin during acceptance.
                // Because the commuter is refunded the FULL pass amount, the partner gets the FULL
                // commission refunded back from the admin.
                const commissionToRefund = adminCommission

                if (commissionToRefund > 0) {
                    const adminCommission = commissionToRefund // shadow so existing logic reuses full value
                    console.log("[cancelBooking] CASH booking cancelled - Refunding full commission to B2C Partner:", {
                        fullCommission: booking.adminCommissionAmount,
                        commissionToRefund,
                        usedTripsCount,
                        remainingTripsCount,
                        partnerId
                    })

                    // 1. Refund the full commission to B2C Partner's wallet.
                    if (partnerWallet) {
                        const partnerBalanceBefore = partnerWallet.balance
                        partnerWallet.balance = Math.round((partnerWallet.balance + adminCommission) * 100) / 100
                        partnerWallet.transactions.push({
                            type: 'DEPOSIT',
                            amount: adminCommission,
                            description: `Commission refund - booking cancelled by passenger (Booking #${booking.bookingNumber || booking._id})`,
                            status: 'COMPLETED',
                            createdAt: new Date()
                        })
                        await partnerWallet.save()

                        // Create transaction record for partner
                        await Transaction.create({
                            walletId: partnerWallet._id,
                            userId: partnerId,
                            type: "CREDIT",
                            amount: adminCommission,
                            currency: booking.currency || "AED",
                            category: "COMMISSION_REFUND",
                            description: `Commission refund - cash booking cancelled by passenger`,
                            referenceId: booking._id,
                            referenceModel: "B2CPassengerBooking",
                            balanceBefore: partnerBalanceBefore,
                            balanceAfter: partnerWallet.balance,
                            metadata: {
                                bookingId: booking._id,
                                reason: "cash_booking_cancelled_by_commuter",
                                cancelledBy: userId,
                                refundedAmount: adminCommission
                            }
                        })

                        console.log("[cancelBooking] Commission refunded to B2C Partner:", {
                            amount: adminCommission,
                            newBalance: partnerWallet.balance
                        })
                    }

                    // 2. Deduct commission from Admin's wallet
                    const adminUser = await User.findOne({ role: 'ADMIN' })
                    if (adminUser) {
                        const adminWallet = await Wallet.findOne({ userId: adminUser._id, currency: booking.currency || 'AED' })
                        if (adminWallet) {
                            const adminBalanceBefore = adminWallet.balance
                            adminWallet.balance -= adminCommission
                            adminWallet.totalEarnings = Math.max(0, (adminWallet.totalEarnings || 0) - adminCommission)
                            adminWallet.transactions.push({
                                type: 'WITHDRAWAL',
                                amount: adminCommission,
                                description: `Commission reversed - cash booking cancelled by passenger (Booking #${booking.bookingNumber || booking._id})`,
                                status: 'COMPLETED',
                                createdAt: new Date()
                            })
                            await adminWallet.save()

                            // Create transaction record for admin
                            await Transaction.create({
                                walletId: adminWallet._id,
                                userId: adminUser._id,
                                type: "DEBIT",
                                amount: adminCommission,
                                currency: booking.currency || "AED",
                                category: "COMMISSION_REVERSAL",
                                description: `Commission reversed - cash booking cancelled by passenger`,
                                referenceId: booking._id,
                                referenceModel: "B2CPassengerBooking",
                                balanceBefore: adminBalanceBefore,
                                balanceAfter: adminWallet.balance,
                                metadata: {
                                    bookingId: booking._id,
                                    reason: "cash_booking_cancelled_by_commuter",
                                    cancelledBy: userId,
                                    refundedToPartner: partnerId
                                }
                            })

                            console.log("[cancelBooking] Commission deducted from Admin wallet:", {
                                amount: adminCommission,
                                newAdminBalance: adminWallet.balance
                            })
                        }
                    }

                    // Store refund info in booking
                    booking.commissionRefunded = true
                    booking.commissionRefundAmount = adminCommission
                    booking.commissionRefundedAt = new Date()
                }
            }
        }

        await booking.save()

        // Notify the partner/driver
        const notifyUserId = booking.b2cPartnerId?._id || booking.b2cPartnerId || booking.driverId
        if (notifyUserId) {
            try {
                // Build notification message with commission refund info if applicable
                let notifMessage = `Booking #${booking.bookingNumber || bookingId} has been cancelled by the passenger.`
                if (booking.commissionRefunded && booking.commissionRefundAmount > 0) {
                    notifMessage += ` Your commission of ${booking.currency || 'AED'} ${booking.commissionRefundAmount.toFixed(2)} has been refunded to your wallet.`
                }
                if (booking.refundMethod === "CASH_FROM_PARTNER" && booking.cashRefundDueFromPartner > 0) {
                    notifMessage += ` Please return ${booking.currency || 'AED'} ${booking.cashRefundDueFromPartner.toFixed(2)} in cash to the passenger (full pass refund).`
                }
                if (cancellationFee > 0) {
                    notifMessage += ` Cancellation fee: ${booking.currency || 'AED'} ${cancellationFee.toFixed(2)}`
                }

                await createNotification({
                    userId: notifyUserId,
                    type: "BOOKING_CANCELLED",
                    title: booking.commissionRefunded ? "Booking Cancelled - Commission Refunded" : "Booking Cancelled",
                    message: notifMessage,
                    bookingId: bookingId,
                    category: "BOOKING"
                })

                // Send real-time notification
                await sendRealTimeNotification(notifyUserId, {
                    type: "BOOKING_CANCELLED",
                    title: booking.commissionRefunded ? "Booking Cancelled - Commission Refunded" : "Booking Cancelled",
                    message: notifMessage,
                    data: {
                        bookingId: booking._id,
                        cancellationReason,
                        cancellationFee,
                        refundAmount,
                        refundMethod: booking.refundMethod,
                        cashRefundDueFromPartner: booking.cashRefundDueFromPartner || 0,
                        usedTripsCount,
                        remainingTripsCount,
                        commissionRefunded: booking.commissionRefunded || false,
                        commissionRefundAmount: booking.commissionRefundAmount || 0
                    }
                })
            } catch (notifError) {
                console.error("[cancelBooking] Failed to create notification:", notifError.message)
                // Don't fail the cancellation if notification fails
            }
        }

        // ===== RECORD THE CASH CANCELLATION DUE (identity-anchored) =====
        // The commuter owes this fee but paid nothing into the platform, so we do
        // NOT credit any wallet now. We record an outstanding due against their
        // registration identity (durable across account deletion) which blocks new
        // bookings until cleared. There is no strike limit — every cancellation is
        // simply charged. The partner already had their commission refunded above,
        // so the partner is made whole.
        if (cashCancellationDue > 0) {
            try {
                const cashSettings = await CancellationSettings.getSettings()
                const commuter = await User.findById(userId)
                cashAccountability = await recordCashCancellationDue({
                    user: commuter,
                    dueAmount: cashCancellationDue,
                    currency: booking.currency || "KWD",
                    bookingId: booking._id,
                    bookingNumber: booking.bookingNumber || String(booking._id),
                    settings: cashSettings,
                })

                // ===== DEDUCT THE FEE FROM THE COMMUTER'S WALLET =====
                // The commuter paid nothing into the platform for this cash booking,
                // so we charge the policy fee by debiting their wallet. The balance is
                // allowed to go NEGATIVE — that negative balance is the unpaid due and
                // blocks new bookings until the commuter tops up. The admin is paid this
                // fee later (in settleCashDuesOnTopUp) once the wallet returns to >= 0.
                let walletDeduction = null
                try {
                    walletDeduction = await deductCashCancellationFromWallet({
                        user: commuter,
                        amount: cashCancellationDue,
                        currency: booking.currency || "KWD",
                        booking,
                    })
                    console.log("[cancelBooking] Cancellation fee deducted from commuter wallet:", walletDeduction)
                } catch (walletErr) {
                    console.error("[cancelBooking] Failed to deduct cancellation fee from commuter wallet:", walletErr.message)
                }

                booking.cashCancellationDueAmount = cashCancellationDue
                booking.cashCancellationDueStatus = "OUTSTANDING"
                booking.cashCancellationAdminSettled = false
                booking.cancellationFee = cashCancellationDue
                booking.cancellationTierLabel = cashCancellationTierLabel

                // CRITICAL: the booking was already persisted (booking.save() above) BEFORE the
                // cash due was computed/recorded. Without re-saving here, the booking document
                // keeps cashCancellationDueAmount = 0 / cancellationFee = 0 forever, so the
                // commuter & partner booking screens show "no charge" even though a fee was
                // charged and recorded in the ledger. Persist the cash-due fields now.
                await booking.save()

                // Surface the charged amount in the cancel response too. For an uncollected
                // cash booking the refund-path `cancellationFee` is 0 (nothing was paid to
                // deduct from), so without this the API response would report a 0 fee even
                // though the commuter now owes `cashCancellationDue`.
                cancellationFee = cashCancellationDue
                cancellationTierLabel = cashCancellationTierLabel

                console.log("[cancelBooking] Cash cancellation due recorded against identity:", cashAccountability)

                // Inform the commuter and (separately) the admin for visibility.
                try {
                    await createNotification({
                        userId,
                        type: "CANCELLATION_DUE",
                        title: "Cancellation Fee Charged",
                        message: `You cancelled cash booking #${booking.bookingNumber || bookingId} after the free window. A cancellation fee of ${booking.currency || 'KWD'} ${cashCancellationDue.toFixed(2)} has been deducted from your wallet. If your wallet is now negative, add money to clear it — you won't be able to make a new booking until your balance is back to zero.`,
                        bookingId,
                        category: "BOOKING",
                    })
                } catch (n1) {
                    console.error("[cancelBooking] commuter due notification failed:", n1.message)
                }
                try {
                    await sendAdminNotification(
                        "Cash Cancellation Due Recorded",
                        `${commuter?.fullName || commuter?.email || "A commuter"} cancelled cash booking #${booking.bookingNumber || bookingId}. Outstanding due: ${booking.currency || 'KWD'} ${cashAccountability?.totalOutstanding ?? cashCancellationDue}. Strikes: ${cashAccountability?.strikeCount ?? 1}.`,
                        "CASH_CANCELLATION_DUE",
                        {
                            bookingId: booking._id,
                            commuterId: userId,
                            dueAmount: cashCancellationDue,
                            totalOutstanding: cashAccountability?.totalOutstanding ?? cashCancellationDue,
                            strikeCount: cashAccountability?.strikeCount ?? 1,
                        }
                    )
                } catch (n2) {
                    console.error("[cancelBooking] admin due notification failed:", n2.message)
                }
            } catch (dueErr) {
                console.error("[cancelBooking] Failed to record cash cancellation due:", dueErr)
            }
        }

        // Build the commuter-facing message based on how the refund is settled
        let responseMessage = "Booking cancelled successfully"
        if (booking.paymentMethod === "CASH" && !isCashCollected && cashCancellationDue > 0) {
            responseMessage = `Booking cancelled. A cancellation fee of ${booking.currency || 'KWD'} ${cashCancellationDue.toFixed(2)} has been deducted from your wallet. If your balance is now negative, please add money to clear it before you can book again.`
        } else if (booking.paymentMethod === "CASH" && !isCashCollected && refundAmount === 0) {
            responseMessage = `Booking cancelled. Since you cancelled within the free window before your first trip, no payment was collected and no fee is due.`
        } else if (booking.refundMethod === "WALLET" && refundAmount > 0) {
            responseMessage = `Booking cancelled. ${booking.currency || 'AED'} ${refundAmount.toFixed(2)} has been refunded to your wallet${cancellationFee > 0 ? ` (after a ${booking.currency || 'AED'} ${cancellationFee.toFixed(2)} cancellation fee)` : ''}.`
        } else if (booking.refundMethod === "CASH_FROM_PARTNER" && refundAmount > 0) {
            responseMessage = `Booking cancelled. Since you paid by cash, the operator will return ${booking.currency || 'AED'} ${refundAmount.toFixed(2)} to you${cancellationFee > 0 ? ` (after a ${booking.currency || 'AED'} ${cancellationFee.toFixed(2)} cancellation fee)` : ''}.`
        }

        res.status(200).json({
            success: true,
            message: responseMessage,
            data: {
                booking,
                refunded: booking.paymentStatus === "REFUNDED",
                refundMethod: booking.refundMethod,
                refundAmount,
                cashRefundDueFromPartner: booking.cashRefundDueFromPartner || 0,
                usedTripsCount,
                remainingTripsCount,
                cancellationFee,
                cancellationTierLabel,
                commissionRefunded: booking.commissionRefunded || false,
                commissionRefundAmount: booking.commissionRefundAmount || 0,
                cancellationFeeApplied: cancellationFee > 0,
                // Cash cancellation accountability
                cashCancellationDue,
                cashCancellationTierLabel,
                outstandingDue: cashAccountability?.totalOutstanding || 0,
                bookingBlocked: cashAccountability?.isBlocked || false,
            },
        })
    } catch (error) {
        console.error("[cancelBooking] Error cancelling booking:", error)
        res.status(500).json({
            success: false,
            message: "Failed to cancel booking",
            error: error.message,
        })
    }
}

// Preview the cancellation fee/refund for a booking WITHOUT cancelling it.
// Lets the commuter see the exact charge (based on the admin's dynamic policy)
// before confirming the cancellation.
// GET /api/bookings/:bookingId/cancellation-preview
export const getCancellationPreview = async (req, res) => {
    try {
        const { bookingId } = req.params
        const userId = req.userId

        let booking = await B2CPassengerBooking.findOne({ _id: bookingId, passengerId: userId })
        let bookingType = "B2C"
        if (!booking) {
            booking = await CorporateBooking.findOne({
                _id: bookingId,
                $or: [{ passengerId: userId }, { corporateOwnerId: userId }],
            })
            bookingType = "CORPORATE"
        }

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" })
        }

        const currency = booking.currency || "AED"
        // Resolve the fare base defensively (see resolveBookingFareBase) so the
        // preview matches the real charge even when paymentAmount was stored as 0.
        const paymentAmount = await resolveBookingFareBase(booking, bookingType)
        const isPaid = booking.paymentStatus === "COMPLETED" || booking.paymentStatus === "PAID"

        const now = new Date()
        const hoursSinceBooking = (now - new Date(booking.createdAt)) / (1000 * 60 * 60)
        let hoursUntilTravel = (new Date(booking.travelDate) - now) / (1000 * 60 * 60)

        // Mirror cancelBooking: for monthly passes the booking-level travelDate is unreliable
        // (stored as the creation moment), so anchor the timing to the earliest upcoming trip
        // to keep the preview's tier consistent with the real charge applied on cancellation.
        if (bookingType === "B2C" && booking.isMonthlyPass && Array.isArray(booking.monthlyTrips) && booking.monthlyTrips.length > 0) {
            try {
                const todayStart = new Date()
                todayStart.setHours(0, 0, 0, 0)
                const passTrips = await B2CPartnerTrip.find({ _id: { $in: booking.monthlyTrips } }).select("tripDate status")
                let earliestUpcomingTrip = null
                for (const t of passTrips) {
                    const tDate = new Date(t.tripDate)
                    const isPast = tDate < todayStart
                    const isDone = ["Completed", "In Progress"].includes(t.status)
                    if (!isPast && !isDone && (!earliestUpcomingTrip || tDate < earliestUpcomingTrip)) {
                        earliestUpcomingTrip = tDate
                    }
                }
                if (earliestUpcomingTrip) {
                    hoursUntilTravel = (earliestUpcomingTrip - now) / (1000 * 60 * 60)
                }
            } catch (previewTripErr) {
                console.error("[getCancellationPreview] Failed to anchor to earliest trip:", previewTripErr.message)
            }
        }

        // Mirror the refundableBase rule used in cancelBooking: for CASH bookings,
        // money is only refundable once cash has actually been collected. For a
        // lightweight preview we treat a paid (online) booking's full amount as
        // refundable, and a not-yet-collected cash booking as 0.
        const isCashUncollected = booking.paymentMethod === "CASH" && !isPaid
        const refundableBase = isCashUncollected ? 0 : (isPaid ? paymentAmount : 0)

        const settings = await CancellationSettings.getSettings()
        const feeResult = CancellationSettings.computeFee(settings, {
            refundableBase,
            hoursSinceBooking,
            hoursUntilTravel,
        })

        const refundAmount = Math.max(0, refundableBase - feeResult.cancellationFee)

        // For an uncollected CASH booking, the commuter pays nothing now but
        // OWES a cancellation due (computed on the full fare). Surface it so the
        // commuter sees exactly what they will owe before confirming.
        //
        // This mirrors the actual charge condition in cancelBooking: the policy applies to
        // EVERY cancellation outside the free window, regardless of accept/confirm state.
        // The free window and time-based tiers still make genuinely early cancels free.
        let cashCancellationDue = 0
        let cashDueTierLabel = "No charge"
        if (isCashUncollected) {
            const dueResult = CancellationSettings.computeCashDue(settings, {
                fareBase: paymentAmount,
                hoursSinceBooking,
                hoursUntilTravel,
            })
            cashCancellationDue = dueResult.dueAmount
            cashDueTierLabel = dueResult.appliedTierLabel
        }

        res.status(200).json({
            success: true,
            preview: {
                currency,
                paymentAmount,
                refundableBase,
                isPaid,
                paymentMethod: booking.paymentMethod || null,
                chargePercentage: feeResult.chargePercentage,
                cancellationFee: feeResult.cancellationFee,
                refundAmount,
                appliedTierLabel: feeResult.appliedTierLabel,
                isFree: isCashUncollected ? cashCancellationDue <= 0 : feeResult.isFree,
                policyActive: settings.isActive,
                freeWindowHoursAfterBooking: settings.freeWindowHoursAfterBooking,
                hoursSinceBooking: Math.round(hoursSinceBooking * 10) / 10,
                hoursUntilTravel: Math.round(hoursUntilTravel * 10) / 10,
                // Cash-specific: what the commuter will OWE (not a refund deduction)
                isCashUncollected,
                cashCancellationDue,
                cashDueTierLabel,
                cashPenaltyActive: settings.cashPenaltyActive !== false,
            },
        })
    } catch (error) {
        console.error("[getCancellationPreview] Error:", error)
        res.status(500).json({
            success: false,
            message: "Failed to compute cancellation preview",
            error: error.message,
        })
    }
}
