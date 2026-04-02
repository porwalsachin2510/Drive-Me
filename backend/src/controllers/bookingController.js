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
import stripe from "../Config/stripe.js"
import tapPayments from "../Config/tapPayments.js"
import { calculateCommission, calculateDriverCommission } from "../Services/HelperUtilities.js"
import { sendRealTimeNotification, sendBookingUpdate } from "../Services/socketService.js"
import { createNotification } from "./notificationController.js"
import { sendAdminNotification } from "../Services/notificationService.js"

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

        const passenger = await User.findById(passengerId)
        if (!passenger) {
            return res.status(404).json({
                success: false,
                message: "Passenger not found",
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

        const commissionData = calculateCommission(paymentAmount)

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

            // Commission
            adminCommissionAmount: paymentMethod === "CASH" ? 0 : commissionData.adminCommission,
            driverEarnings: paymentMethod === "CASH" ? paymentAmount : commissionData.fleetOwnerAmount,
        })

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

        // Check if booking is in CONFIRMED status
        if (booking.bookingStatus !== "CONFIRMED") {
            return res.status(400).json({
                success: false,
                message: "Booking cannot be accepted. Current status: " + booking.bookingStatus,
            })
        }

        // Check wallet balance for cash payment bookings
        if (booking.paymentMethod === "CASH") {
            const partnerWallet = await Wallet.findOne({ userId: partnerId })
            const adminCommission = booking.adminCommissionAmount || 0

            console.log("[acceptB2CBooking] Wallet check:", {
                paymentMethod: booking.paymentMethod,
                adminCommission,
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

            // Deduct admin commission from wallet (will be refunded if trip cancelled)
            partnerWallet.balance -= adminCommission
            partnerWallet.transactions.push({
                type: 'WITHDRAWAL',
                amount: adminCommission,
                description: `Admin commission for booking ${booking._id}`,
                status: 'COMPLETED'
            })
            await partnerWallet.save()

            console.log("[acceptB2CBooking] Admin commission deducted:", {
                deductedAmount: adminCommission,
                newBalance: partnerWallet.balance
            })
        }

        // Update booking status
        booking.bookingStatus = "ACCEPTED"
        booking.acceptedAt = new Date()
        await booking.save()

        // Send notification to passenger - use companyName or fullName (not businessName which doesn't exist)
        const partnerDisplayName = booking.b2cPartnerId.companyName || booking.b2cPartnerId.fullName || booking.b2cPartnerId.name || 'the partner';
        const bookingAcceptedNotification = await createNotification({
            userId: booking.passengerId._id,
            title: "Booking Accepted",
            message: `Your B2C booking from ${booking.pickupLocation || 'pickup'} to ${booking.dropoffLocation || 'destination'} has been accepted by ${partnerDisplayName}.`,
            type: "BOOKING_ACCEPTED",
            bookingId: booking._id,
        })

        // Send real-time notification to passenger
        sendRealTimeNotification(booking.passengerId._id, {
            type: "BOOKING_ACCEPTED",
            data: {
                bookingId: booking._id,
                message: `Your booking has been accepted by ${partnerDisplayName}.`,
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

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            })
        }

        if (booking.b2cPartnerId.toString() !== partnerId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized",
            })
        }

        booking.bookingStatus = "REJECTED"
        booking.rejectionReason = rejectionReason || "No reason provided"

        // if (booking.paymentStatus === "COMPLETED" && booking.transactionId) {
        //     try {
        //         if (booking.paymentMethod === "STRIPE") {
        //             // Create refund via Stripe
        //             const refund = await stripe.refunds.create({
        //                 payment_intent: booking.transactionId,
        //                 reason: "requested_by_customer",
        //             })
        //             booking.paymentStatus = "REFUNDED"
        //             booking.refundId = refund.id
        //         } else if (booking.paymentMethod === "TAP") {
        //             // TAP refund would need to be implemented
        //             booking.paymentStatus = "REFUND_PENDING"
        //         }
        //     } catch (refundError) {
        //         console.error("Refund error:", refundError)
        //         booking.paymentStatus = "REFUND_FAILED"
        //     }
        // }

        // Process refund for online payments
        if (booking.paymentStatus === "COMPLETED" && booking.transactionId) {
            const passengerWallet = await Wallet.findOne({ userId: booking.passengerId })

            if (passengerWallet) {
                const refundAmount = booking.paymentAmount
                const balanceBefore = passengerWallet.balance

                // Add refund amount to passenger wallet
                passengerWallet.balance += refundAmount
                await passengerWallet.save()

                // Create refund transaction record
                await Transaction.create({
                    walletId: passengerWallet._id,
                    userId: booking.passengerId,
                    type: "CREDIT",
                    amount: refundAmount,
                    category: "REFUND",
                    description: `Refund for rejected booking ${booking._id}`,
                    referenceId: booking._id,
                    referenceModel: "Payment",
                    balanceBefore: balanceBefore,
                    balanceAfter: passengerWallet.balance,
                    metadata: {
                        bookingId: booking._id,
                        originalTransactionId: booking.transactionId,
                        rejectionReason: booking.rejectionReason
                    }
                })

                booking.paymentStatus = "REFUNDED"
                booking.refundAmount = refundAmount
                booking.refundProcessedAt = new Date()
            } else {
                console.error("Passenger wallet not found for refund:", booking.passengerId)
            }
        }

        await booking.save()

        // Notify passenger
        const rejectNotification = await createNotification({
            userId: booking.passengerId,
            type: "BOOKING_REJECTED",
            title: "Booking Rejected",
            message: `Your booking has been rejected. Reason: ${booking.rejectionReason}`,
            relatedUserId: driverId,
            bookingId: booking._id,
        })

        // Send real-time notification to passenger
        await sendRealTimeNotification(booking.passengerId, {
            type: "BOOKING_REJECTED",
            title: rejectNotification.title,
            message: rejectNotification.message,
            data: {
                bookingId: booking._id,
                driverId,
                passengerId: booking.passengerId,
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
        console.error("Error rejecting booking:", error)
        return res.status(500).json({
            success: false,
            message: "Server error",
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

        // Update booking status to IN_PROGRESS
        booking.bookingStatus = "IN_PROGRESS"
        booking.startedAt = new Date()
        booking.tripStartedBy = userRole
        await booking.save()

        console.log("[startB2CTrip] Trip started:", {
            bookingId: booking._id,
            status: booking.bookingStatus,
            startedBy: userRole,
            isSelfDriver: booking.isSelfDriver
        })

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

            const b2cBookings = await B2CPassengerBooking.find(query)
                .populate("b2cPartnerId", "fullName companyLogo whatsappNumber driverName vehicleModel vehiclePlate")
                .sort({ createdAt: -1 })

            bookings = b2cBookings.map((b) => ({
                ...b.toObject(),
                type: "B2C",
                userType: "NORMAL_PASSENGER",
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

        if (status) {
            query.bookingStatus = status
        }

        const bookings = await B2CPassengerBooking.find(query)
            .populate("passengerId", "fullName whatsappNumber email")
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            bookings,
            totalBookings: bookings.length,
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

        console.log("[v0] Fetching corporate owner bookings from Trip model for:", corporateOwnerId)

        // Query Trip model for corporate trips
        const tripQuery = { corporateId: corporateOwnerId }

        if (status) {
            tripQuery.status = status
        }

        if (date) {
            const dateObj = new Date(date)
            const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0))
            const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999))
            tripQuery.tripDate = {
                $gte: startOfDay,
                $lt: endOfDay,
            }
        }

        // Get all trips for this corporate
        const trips = await Trip.find(tripQuery)
            .populate("driverId", "name email phone")
            .populate("vehicleId", "model licensePlate vehicleName registrationNumber")
            .populate("routeId", "fromLocation toLocation startTime endTime")
            .populate("contractId", "contractNumber status")
            .populate("passengers.employeeId", "fullName whatsappNumber email")
            .sort({ tripDate: -1, createdAt: -1 })

        console.log("[v0] Found trips:", trips.length)

        // Transform trips to bookings format for frontend
        const bookings = []

        for (const trip of trips) {
            try {
                // Resolve driver name from Driver model or User model
                let driverName = trip.driverId?.name || "Unknown"
                let driverInfo = trip.driverId

                // If driverId populated from Driver model, also try to find the user account
                if (trip.driverId && typeof trip.driverId === 'object' && !trip.driverId.fullName) {
                    const driverUserAccount = await User.findOne({
                        driverId: trip.driverId._id,
                        role: { $in: ["B2B_PARTNER_DRIVER", "CORPORATE_DRIVER"] }
                    }).select("fullName whatsappNumber email")
                    if (driverUserAccount) {
                        driverName = driverUserAccount.fullName
                        driverInfo = {
                            _id: trip.driverId._id,
                            name: driverUserAccount.fullName,
                            email: driverUserAccount.email,
                            phone: driverUserAccount.whatsappNumber,
                        }
                    }
                }

                for (const passenger of (trip.passengers || [])) {
                    // Filter by status if provided
                    if (status && passenger.bookingStatus !== status) {
                        continue
                    }

                    bookings.push({
                        _id: passenger._id,
                        tripId: trip._id,
                        passengerId: passenger.employeeId,
                        employee: passenger.employeeId,
                        employeeName: passenger.employeeId?.fullName || passenger.name || "Unknown",
                        employeeEmail: passenger.employeeId?.email,
                        employeePhone: passenger.employeeId?.whatsappNumber,
                        seatNumber: passenger.seatNumber || 1,
                        pickupPoint: passenger.pickupStop || passenger.pickupPoint || trip.fromLocation,
                        pickupStop: passenger.pickupStop || passenger.pickupPoint || trip.fromLocation,
                        dropoffStop: passenger.dropoffStop || trip.toLocation,
                        pickupTime: passenger.pickupTime || trip.startTime,
                        bookingStatus: passenger.bookingStatus,
                        bookedAt: passenger.bookedAt,
                        travelDate: trip.tripDate,
                        tripDate: trip.tripDate,
                        startTime: trip.startTime,
                        endTime: trip.endTime,
                        tripType: trip.tripType,
                        direction: trip.direction,
                        fromLocation: trip.fromLocation,
                        toLocation: trip.toLocation,
                        status: trip.status,
                        tripStatus: trip.status,
                        numberOfSeats: 1,
                        route: trip.routeId,
                        routeId: trip.routeId,
                        driver: driverInfo,
                        driverId: trip.driverId,
                        driverName: driverName,
                        vehicle: trip.vehicleId,
                        vehicleId: trip.vehicleId,
                        vehicleModel: trip.vehicleId?.model || trip.vehicleId?.vehicleName,
                        vehiclePlate: trip.vehicleId?.licensePlate || trip.vehicleId?.registrationNumber,
                        contract: trip.contractId,
                        contractId: trip.contractId,
                        currentLocation: trip.currentLocation,
                        driverLocation: trip.driverLocation,
                    })
                }
            } catch (tripError) {
                console.error("[v0] Error processing trip:", trip._id, tripError?.message)
                // Continue with next trip instead of failing entire request
            }
        }

        console.log("[v0] Found corporate owner bookings:", bookings.length)

        return res.status(200).json({
            success: true,
            bookings,
            totalBookings: bookings.length,
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
                    const tripStartNotification = await createNotification({
                        userId: passenger.employeeId._id || passenger.employeeId,
                        type: "TRIP_STARTED",
                        title: "Trip Started",
                        message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} has started`,
                        relatedUserId: driverId,
                        bookingId: trip._id,
                    })

                    await sendRealTimeNotification(passenger.employeeId._id || passenger.employeeId, {
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
                    const tripCompleteNotification = await createNotification({
                        userId: passenger.employeeId._id || passenger.employeeId,
                        type: "RIDE_COMPLETED",
                        title: "Trip Completed",
                        message: `Your trip from ${trip.fromLocation} to ${trip.toLocation} has been completed`,
                        relatedUserId: driverId,
                        bookingId: trip._id,
                    })

                    await sendRealTimeNotification(passenger.employeeId._id || passenger.employeeId, {
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
        })

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

        // Check if trip is already in progress
        if (currentStatus === "IN_PROGRESS") {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel a trip that is already in progress",
            })
        }

        // Update the correct status field
        if (bookingType === "B2C") {
            booking.bookingStatus = "CANCELLED"
        } else {
            booking.status = "CANCELLED"
        }
        booking.cancellationReason = cancellationReason || "Cancelled by user"
        booking.cancelledAt = new Date()
        booking.cancelledBy = userId

        await booking.save()

        // Process refund if payment was made
        if (booking.paymentStatus === "PAID" && booking.totalAmount > 0) {
            try {
                const wallet = await Wallet.findOne({ userId })
                if (wallet) {
                    wallet.balance += booking.totalAmount
                    wallet.transactions.push({
                        type: "REFUND",
                        amount: booking.totalAmount,
                        description: `Refund for cancelled booking #${booking.bookingNumber || bookingId}`,
                        reference: bookingId,
                        timestamp: new Date(),
                    })
                    await wallet.save()
                }
                booking.paymentStatus = "REFUNDED"
                booking.refundAmount = booking.totalAmount
                await booking.save()
            } catch (refundError) {
                console.error("Refund processing error:", refundError)
            }
        }

        // Notify the partner/driver
        const notifyUserId = booking.b2cPartnerId || booking.driverId
        if (notifyUserId) {
            try {
                await createNotification({
                    userId: notifyUserId,
                    type: "BOOKING_CANCELLED",
                    title: "Booking Cancelled",
                    message: `Booking #${booking.bookingNumber || bookingId} has been cancelled by the passenger.`,
                    bookingId: bookingId,
                    category: "BOOKING"
                })
            } catch (notifError) {
                console.error("Failed to create notification:", notifError.message)
                // Don't fail the cancellation if notification fails
            }
        }

        res.status(200).json({
            success: true,
            message: "Booking cancelled successfully",
            data: {
                booking,
                refunded: booking.paymentStatus === "REFUNDED",
            },
        })
    } catch (error) {
        console.error("Error cancelling booking:", error)
        res.status(500).json({
            success: false,
            message: "Failed to cancel booking",
            error: error.message,
        })
    }
}
