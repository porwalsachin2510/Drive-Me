import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import CommissionSettings from "../models/CommissionSettings.js";
import { generatePassCertificate } from "../Services/passCertificateService.js";
import { sendPassEmail } from "../Services/emailService.js";
import PaymentGatewayService from "../Services/paymentGatewayService.js";
import { getPaymentGateway, detectCountryFromCurrency } from "../Config/paymentGateways.js";

// Helper function to get B2C Partner commission rate
const getB2CPartnerCommissionRate = async (partnerId) => {
    try {
        const settings = await CommissionSettings.findOne({ userId: partnerId, isActive: true });
        if (settings) {
            // Check for custom BOOKING or MONTHLY_PASS rate first
            const now = new Date();
            const customRate = settings.customRates?.find(
                (r) =>
                    (r.rateType === "BOOKING" || r.rateType === "MONTHLY_PASS") &&
                    r.effectiveFrom <= now &&
                    (!r.effectiveUntil || r.effectiveUntil >= now)
            );
            if (customRate) {
                return customRate.rate / 100; // Convert percentage to decimal
            }
            return settings.defaultCommissionRate / 100; // Convert percentage to decimal
        }
        return 0.20; // Default 20% if no settings found
    } catch (error) {
        console.error("[v0] Error fetching B2C commission rate:", error);
        return 0.20; // Default 20%
    }
};

// Create B2C Monthly Pass
export const createB2CMonthlyPass = async (req, res) => {
    try {
        const {
            passengerId,
            routeId,
            scheduleId,
            passType,
            outboundTripTime,
            returnTripTime,
            pickupLocation,
            dropoffLocation,
            returnPickupLocation,
            returnDropoffLocation,
            durationMonths,
            numberOfSeats,
            selectedDays,
            totalAmount,
            paymentMethod,
            notes,
            paymentDate,
            currency,
            // NEW: Custom date range from frontend
            customStartDate,
            customEndDate,
            actualTravelDays
        } = req.body;

        // Get route and schedule details FIRST
        const route = await B2CPartnerRoute.findById(routeId);
        const schedule = await B2CPartnerSchedule.findById(scheduleId);
        const passenger = await User.findById(passengerId);
        const b2cPartner = await User.findById(route.b2cPartnerId); // FETCH B2C PARTNER

        if (!route || !schedule || !passenger || !b2cPartner) {
            return res.status(404).json({
                success: false,
                message: "Route, schedule, passenger, or partner not found"
            });
        }

        console.log("[v0] Creating B2C Monthly Pass:", {
            passengerId,
            routeId,
            scheduleId,
            passType,
            outboundTripTime,
            returnTripTime,
            durationMonths,
            numberOfSeats,
            totalAmount,
            paymentMethod,
            // REAL DATA DEBUG
            routeData: {
                routeId: route._id,
                fromLocation: route.fromLocation,
                toLocation: route.toLocation,
                totalSeats: route.totalSeats,
                availableSeats: route.availableSeats,
                assignedDriverId: route.assignedDriverId,
                assignedDriver: route.assignedDriver,
                b2cPartnerId: route.b2cPartnerId
            },
            scheduleData: {
                scheduleId: schedule._id,
                tripTimes: schedule.tripTimes?.length || 0,
                isActive: schedule.isActive
            },
            passengerData: {
                passengerId: passenger._id,
                name: passenger.name,
                email: passenger.email
            },
            partnerData: {
                partnerId: b2cPartner._id,
                name: b2cPartner.name,
                businessName: b2cPartner.businessName
            }
        });

        // ==================== CRITICAL FIX ====================
        // Find the correct tripTime index from schedule based on selected outboundTripTime
        // This is essential to get the correct driver/vehicle assignment for the specific trip time
        // ======================================================

        let outboundTripTimeIndex = -1;
        let returnTripTimeIndex = -1;
        let outboundTripTimeConfig = null;
        let returnTripTimeConfig = null;

        if (schedule && schedule.tripTimes && schedule.tripTimes.length > 0) {
            // Find outbound trip time by matching departureTime FIRST
            outboundTripTimeIndex = schedule.tripTimes.findIndex(tt =>
                tt.departureTime === outboundTripTime
            );

            // CRITICAL FIX: For ONE_WAY passes, also check if outboundTripTime matches arrivalTime
            // This happens when user books a ONE_WAY pass in the RETURN direction (e.g., 2:00 PM)
            // The "2:00 PM" is actually the arrivalTime of a tripTime, not departureTime
            if (outboundTripTimeIndex === -1) {
                outboundTripTimeIndex = schedule.tripTimes.findIndex(tt =>
                    tt.arrivalTime === outboundTripTime
                );
                if (outboundTripTimeIndex !== -1) {
                    console.log("[v0] ONE_WAY return direction detected - matched by arrivalTime:", outboundTripTime);
                }
            }

            if (outboundTripTimeIndex !== -1) {
                outboundTripTimeConfig = schedule.tripTimes[outboundTripTimeIndex];
            }

            // For return trip, match returnTripTime with either arrivalTime OR departureTime of another tripTime
            if (passType === 'ROUND_TRIP' && returnTripTime) {
                // First try to find by arrivalTime (same tripTime entry as outbound)
                returnTripTimeIndex = schedule.tripTimes.findIndex(tt =>
                    tt.arrivalTime === returnTripTime
                );

                // If not found, try to find by departureTime (different tripTime entry for return)
                if (returnTripTimeIndex === -1) {
                    returnTripTimeIndex = schedule.tripTimes.findIndex(tt =>
                        tt.departureTime === returnTripTime
                    );
                }

                if (returnTripTimeIndex !== -1) {
                    returnTripTimeConfig = schedule.tripTimes[returnTripTimeIndex];
                }
            }

            console.log("[v0] Trip Time Index Resolution:", {
                outboundTripTime,
                returnTripTime,
                outboundTripTimeIndex,
                returnTripTimeIndex,
                outboundTripTimeConfig: outboundTripTimeConfig ? {
                    departureTime: outboundTripTimeConfig.departureTime,
                    arrivalTime: outboundTripTimeConfig.arrivalTime,
                    assignedDriver: outboundTripTimeConfig.assignedDriver,
                    assignedVehicle: outboundTripTimeConfig.assignedVehicle
                } : null,
                returnTripTimeConfig: returnTripTimeConfig ? {
                    departureTime: returnTripTimeConfig.departureTime,
                    arrivalTime: returnTripTimeConfig.arrivalTime,
                    assignedDriver: returnTripTimeConfig.assignedDriver,
                    assignedVehicle: returnTripTimeConfig.assignedVehicle
                } : null
            });
        }

        // Get driver/vehicle for OUTBOUND trip from tripTimes[outboundTripTimeIndex]
        // Fallback hierarchy: tripTime > schedule > route
        const outboundDriverId = outboundTripTimeConfig?.assignedDriver || schedule?.assignedDriver || route.assignedDriverId || route.assignedDriver;
        const outboundVehicleId = outboundTripTimeConfig?.assignedVehicle || schedule?.assignedVehicle || route.assignedVehicle;
        const outboundIsSelfDriver = outboundDriverId ? outboundDriverId.toString() === route.b2cPartnerId.toString() : true;

        // Get driver/vehicle for RETURN trip from tripTimes[returnTripTimeIndex]
        // Fallback hierarchy: tripTime > schedule > route
        const returnDriverId = returnTripTimeConfig?.assignedDriver || schedule?.assignedDriver || route.assignedDriverId || route.assignedDriver;
        const returnVehicleId = returnTripTimeConfig?.assignedVehicle || schedule?.assignedVehicle || route.assignedVehicle;
        const returnIsSelfDriver = returnDriverId ? returnDriverId.toString() === route.b2cPartnerId.toString() : true;

        console.log("[v0] Driver/Vehicle Assignment from TripTimes:", {
            outbound: {
                driverId: outboundDriverId,
                vehicleId: outboundVehicleId,
                isSelfDriver: outboundIsSelfDriver,
                source: outboundTripTimeConfig?.assignedDriver ? 'tripTime' : (schedule?.assignedDriver ? 'schedule' : 'route')
            },
            return: {
                driverId: returnDriverId,
                vehicleId: returnVehicleId,
                isSelfDriver: returnIsSelfDriver,
                source: returnTripTimeConfig?.assignedDriver ? 'tripTime' : (schedule?.assignedDriver ? 'schedule' : 'route')
            }
        });

        // Validate required fields
        if (!passengerId || !routeId || !scheduleId || !passType || !outboundTripTime || !pickupLocation || !dropoffLocation || !numberOfSeats) {
            console.log("[v0] Missing required fields:", {
                passengerId: !!passengerId,
                routeId: !!routeId,
                scheduleId: !!scheduleId,
                passType: !!passType,
                outboundTripTime: !!outboundTripTime,
                pickupLocation: !!pickupLocation,
                dropoffLocation: !!dropoffLocation,
                numberOfSeats: !!numberOfSeats
            });
            return res.status(400).json({
                success: false,
                message: "Missing required fields for monthly pass"
            });
        }

        // Validate numberOfSeats
        if (!numberOfSeats || numberOfSeats < 1 || numberOfSeats > 10) {
            return res.status(400).json({
                success: false,
                message: "Number of seats must be between 1 and 10"
            });
        }

        // Validate round trip requirements
        if (passType === "ROUND_TRIP" && (!returnTripTime || !returnPickupLocation || !returnDropoffLocation)) {
            return res.status(400).json({
                success: false,
                message: "Round trip pass requires return trip details"
            });
        }

        // Calculate dates - USE CUSTOM DATES FROM FRONTEND if provided
        let startDate;
        let endDate;

        // Define travelDays at the outer scope so it's available for the monthly pass creation
        const travelDays = Array.isArray(selectedDays) && selectedDays.length > 0 ? selectedDays : null;

        // PRIORITY: Use custom dates from frontend date picker
        if (customStartDate && customEndDate) {
            startDate = new Date(customStartDate);
            endDate = new Date(customEndDate);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            console.log("[v0] Using custom dates from frontend:", { startDate, endDate, actualTravelDays, travelDays });
        } else {
            // FALLBACK: Legacy calculation if custom dates not provided
            startDate = paymentDate ? new Date(paymentDate) : new Date();

            // Parse outboundTripTime to check if today's trip already passed
            if (outboundTripTime) {
                const now = new Date();
                const todayTripTime = new Date(now);

                const timeParts = outboundTripTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
                if (timeParts) {
                    let hours = parseInt(timeParts[1]);
                    const minutes = parseInt(timeParts[2]);
                    const ampm = timeParts[3].toUpperCase();

                    if (ampm === 'PM' && hours !== 12) hours += 12;
                    if (ampm === 'AM' && hours === 12) hours = 0;

                    todayTripTime.setHours(hours, minutes, 0, 0);

                    // If current time is past today's trip time, start from tomorrow
                    if (now >= todayTripTime) {
                        startDate = new Date(now);
                        startDate.setDate(startDate.getDate() + 1);
                        startDate.setHours(0, 0, 0, 0);
                        console.log("[v0] Trip time already passed today, starting from next day:", startDate);
                    }
                }
            }

            // Ensure startDate falls on one of the selected travel days (travelDays defined above)
            if (travelDays) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                let maxSkip = 7;
                while (maxSkip > 0) {
                    const dayName = dayNames[startDate.getDay()];
                    if (travelDays.map(d => d.toLowerCase()).includes(dayName.toLowerCase())) break;
                    startDate.setDate(startDate.getDate() + 1);
                    maxSkip--;
                }
                console.log("[v0] Adjusted startDate to next selected travel day:", startDate, "Selected days:", travelDays);
            }

            endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + durationMonths);
        }

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment date provided",
                error: "INVALID_DATE"
            });
        }

        // ==================== SERVER-SIDE PRICING (AUTHORITATIVE) ====================
        // A monthly pass ALWAYS bills for the route's full weekly availability,
        // regardless of how many days the commuter personally intends to travel.
        // We never trust the client-supplied totalAmount — it is recomputed here
        // from the route's operating days and per-day pricing.
        // Day values may be stored abbreviated (MON, TUE) or full (Monday), so we
        // normalize every value to a canonical full day name before counting.
        // =============================================================================
        const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const DAY_NAME_MAP = {
            mon: 'Monday', monday: 'Monday',
            tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
            wed: 'Wednesday', weds: 'Wednesday', wednesday: 'Wednesday',
            thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
            fri: 'Friday', friday: 'Friday',
            sat: 'Saturday', saturday: 'Saturday',
            sun: 'Sunday', sunday: 'Sunday'
        };
        const normalizeDay = (d) => DAY_NAME_MAP[String(d).trim().toLowerCase()] || null;

        // Route operating days come from the schedule first, then the route.
        const rawRouteDays =
            (Array.isArray(schedule?.availableDays) && schedule.availableDays.length > 0
                ? schedule.availableDays
                : route.availableDays) || [];
        const normalizedRouteDays = rawRouteDays.map(normalizeDay).filter(Boolean);
        // Keep canonical week order and de-duplicate.
        const billingDays = ALL_DAYS.filter((d) => normalizedRouteDays.includes(d));
        const routeBillingDays = billingDays.length > 0 ? billingDays : ALL_DAYS;

        // Per-day rate based on pass type (route pricing is stored as a per-day rate).
        const perDayRate = passType === 'ROUND_TRIP'
            ? (route.pricing?.roundTripPrice ?? route.roundTripPrice ?? 0)
            : (route.pricing?.oneWayPrice ?? route.oneWayPrice ?? 0);

        // Count every operating day within the pass period.
        const dayNamesIdx = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const billingDaysLower = routeBillingDays.map((d) => d.toLowerCase());
        let computedTravelDays = 0;
        const cursor = new Date(startDate);
        cursor.setHours(0, 0, 0, 0);
        const endCursor = new Date(endDate);
        endCursor.setHours(23, 59, 59, 999);
        while (cursor <= endCursor) {
            if (billingDaysLower.includes(dayNamesIdx[cursor.getDay()].toLowerCase())) {
                computedTravelDays++;
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        const safeSeats = Number(numberOfSeats) > 0 ? Number(numberOfSeats) : 1;
        const computedTotalAmount = Number(
            (perDayRate * computedTravelDays * safeSeats).toFixed(3)
        );

        // Authoritative values used for the rest of the flow.
        const finalTravelDays = computedTravelDays;
        const finalSelectedDays = routeBillingDays;
        const finalTotalAmount = computedTotalAmount > 0
            ? computedTotalAmount
            : Number(totalAmount) || 0;

        console.log("[v0] Server-side pricing recompute:", {
            rawRouteDays,
            routeBillingDays,
            daysPerWeek: routeBillingDays.length,
            perDayRate,
            computedTravelDays: finalTravelDays,
            numberOfSeats: safeSeats,
            clientTotalAmount: totalAmount,
            finalTotalAmount
        });

        // Get dynamic commission rate for B2C Partner
        const commissionRate = await getB2CPartnerCommissionRate(route.b2cPartnerId);
        console.log("[v0] Dynamic Commission Rate for B2C Partner:", commissionRate * 100, "%");

        // Calculate commission based on dynamic rate
        const adminCommission = finalTotalAmount * commissionRate;
        const partnerEarnings = finalTotalAmount * (1 - commissionRate);

        // Normalize paymentMethod for B2CMonthlyPass model (STRIPE, TAP, CARD, CASH, WALLET)
        const normalizedPaymentMethod = ["STRIPE", "TAP", "CARD", "CASH", "WALLET"].includes(paymentMethod) ? paymentMethod : "STRIPE";

        // Get currency from route pricing or user country, default to KWD
        const routeCurrency = route.pricing?.currency || currency || "KWD";

        // WALLET payment: validate the commuter has sufficient balance BEFORE creating
        // the pass / booking / trips so we never leave a half-created booking on failure.
        let commuterWallet = null;
        if (normalizedPaymentMethod === "WALLET") {
            commuterWallet = await Wallet.findOne({ userId: passengerId });

            if (!commuterWallet) {
                return res.status(400).json({
                    success: false,
                    message: "No wallet found. Please add funds to your wallet before paying with wallet balance."
                });
            }

            if ((commuterWallet.balance || 0) < finalTotalAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient wallet balance. Required: ${routeCurrency} ${finalTotalAmount.toFixed(2)}, Available: ${routeCurrency} ${(commuterWallet.balance || 0).toFixed(2)}.`,
                    walletBalance: commuterWallet.balance || 0,
                    requiredAmount: finalTotalAmount
                });
            }
        }

        // Create monthly pass
        const monthlyPass = new B2CMonthlyPass({
            passengerId,
            routeId,
            scheduleId,
            partnerId: route.b2cPartnerId,
            passType,
            outboundTripTime,
            returnTripTime,
            pickupLocation,
            dropoffLocation,
            returnPickupLocation,
            returnDropoffLocation,
            // NEW: Outbound driver/vehicle assignment from tripTimes
            outboundDriverId,
            outboundVehicleId,
            outboundIsSelfDriver,
            // NEW: Return driver/vehicle assignment from tripTimes
            returnDriverId: passType === 'ROUND_TRIP' ? returnDriverId : null,
            returnVehicleId: passType === 'ROUND_TRIP' ? returnVehicleId : null,
            returnIsSelfDriver: passType === 'ROUND_TRIP' ? returnIsSelfDriver : false,
            startDate,
            endDate,
            durationMonths,
            totalAmount: finalTotalAmount,
            currency: routeCurrency,
            selectedDays: finalSelectedDays || [],
            travelDaysCount: finalTravelDays,
            paymentMethod: normalizedPaymentMethod,
            paymentStatus: ["CASH", "WALLET"].includes(normalizedPaymentMethod) ? "PAID" : "PENDING",
            adminCommission,
            partnerEarnings,
            notes
        });

        await monthlyPass.save();

        // Update trip seats for the duration
        await updateTripSeats(monthlyPass);

        // Fetch driver names for outbound and return (for display purposes)
        let outboundDriverName = null;
        let outboundDriverImage = null;
        let outboundDriverPhone = null;
        let returnDriverName = null;
        let returnDriverImage = null;
        let returnDriverPhone = null;

        // Get outbound driver info
        if (outboundDriverId) {
            if (outboundIsSelfDriver) {
                outboundDriverName = b2cPartner.fullName || b2cPartner.name || b2cPartner.businessName || 'Self Driver';
                outboundDriverImage = b2cPartner.profileImage || null;
                outboundDriverPhone = b2cPartner.whatsappNumber || b2cPartner.phone;
            } else {
                const b2cDriver = await B2CPartnerDriver.findById(outboundDriverId);
                if (b2cDriver) {
                    outboundDriverName = b2cDriver.name;
                    outboundDriverImage = b2cDriver.driverImage?.url;
                    outboundDriverPhone = b2cDriver.phoneNumber;
                } else {
                    const userDriver = await User.findById(outboundDriverId);
                    if (userDriver) {
                        outboundDriverName = userDriver.fullName || userDriver.name;
                        outboundDriverImage = userDriver.profileImage;
                        outboundDriverPhone = userDriver.whatsappNumber || userDriver.phone;
                    }
                }
            }
        }

        // Get return driver info
        if (returnDriverId && passType === 'ROUND_TRIP') {
            if (returnIsSelfDriver) {
                returnDriverName = b2cPartner.fullName || b2cPartner.name || b2cPartner.businessName || 'Self Driver';
                returnDriverImage = b2cPartner.profileImage || null;
                returnDriverPhone = b2cPartner.whatsappNumber || b2cPartner.phone;
            } else {
                const b2cDriver = await B2CPartnerDriver.findById(returnDriverId);
                if (b2cDriver) {
                    returnDriverName = b2cDriver.name;
                    returnDriverImage = b2cDriver.driverImage?.url;
                    returnDriverPhone = b2cDriver.phoneNumber;
                } else {
                    const userDriver = await User.findById(returnDriverId);
                    if (userDriver) {
                        returnDriverName = userDriver.fullName || userDriver.name;
                        returnDriverImage = userDriver.profileImage;
                        returnDriverPhone = userDriver.whatsappNumber || userDriver.phone;
                    }
                }
            }
        }

        console.log("[v0] Driver Info Resolved:", {
            outbound: { driverId: outboundDriverId, name: outboundDriverName, isSelfDriver: outboundIsSelfDriver },
            return: { driverId: returnDriverId, name: returnDriverName, isSelfDriver: returnIsSelfDriver }
        });

        // Create corresponding B2CPassengerBooking for monthly pass
        const passengerBooking = new B2CPassengerBooking({
            passengerId,
            b2cPartnerId: route.b2cPartnerId,
            routeId,
            partnerId: route.b2cPartnerId,
            bookingType: passType,
            linkedSchedule: scheduleId,
            linkedTrip: null, // Will be updated when trips are used
            linkedReturnTrip: null,
            pickupLocation,
            dropoffLocation,
            returnPickupLocation,
            returnDropoffLocation,
            // NEW: Outbound driver/vehicle assignment from tripTimes
            outboundDriverId,
            outboundVehicleId,
            outboundIsSelfDriver,
            outboundTripTime,
            // NEW: Return driver/vehicle assignment from tripTimes
            returnDriverId: passType === 'ROUND_TRIP' ? returnDriverId : null,
            returnVehicleId: passType === 'ROUND_TRIP' ? returnVehicleId : null,
            returnIsSelfDriver: passType === 'ROUND_TRIP' ? returnIsSelfDriver : false,
            returnTripTime: passType === 'ROUND_TRIP' ? returnTripTime : null,
            bookingDate: new Date(), // Required field - when booking was made
            travelDate: new Date(), // Required field - date of travel
            numberOfSeats: 1,
            paymentAmount: totalAmount,
            currency: routeCurrency,
            paymentMethod: normalizedPaymentMethod,
            paymentStatus: ["CASH", "WALLET"].includes(normalizedPaymentMethod) ? "COMPLETED" : "PENDING",
            transactionId: monthlyPass._id.toString(),
            bookingStatus: "CONFIRMED",
            adminCommissionAmount: adminCommission,
            driverEarnings: partnerEarnings,
            // Legacy driver fields - use outbound driver as primary
            assignedDriverId: outboundDriverId,
            driverName: outboundDriverName,
            driverImage: outboundDriverImage,
            driverPhoneNumber: outboundDriverPhone,
            isSelfDriver: outboundIsSelfDriver,
            // Monthly Pass Specific Fields
            isMonthlyPass: true,
            monthlyPassId: monthlyPass._id,
            passDuration: durationMonths,
            passStartDate: startDate,
            passEndDate: endDate,
            createdAt: new Date()
        });

        await passengerBooking.save();

        // CHECK AND CREATE MONTHLY TRIPS FOR ALL DAYS IN THE PASS DURATION
        console.log("[v0] Checking/Creating monthly trips for pass duration:", {
            startDate,
            endDate,
            durationMonths,
            passType
        });

        const createdTrips = [];
        const existingTrips = [];
        const currentDate = new Date(startDate);
        const endDateObj = new Date(endDate);

        // Get schedule details to determine trip times
        // Note: schedule variable already declared at line 70, reusing it
        if (!schedule) {
            console.log("[v0] Schedule not found, using default times");
        }

        // CRITICAL FIX: Determine if this is a return-direction ONE_WAY pass
        // For ONE_WAY passes, we need to check if the user selected the return direction
        // 
        // The most reliable way to detect return direction:
        // 1. Compare outboundTripTime with schedule's arrivalTime (return trip time)
        // 2. Check if pickup/dropoff are in returnStopPoints (not outboundStopPoints)
        // 3. Check if returnPickupLocation/returnDropoffLocation match route's toLocation/fromLocation
        //
        // Route: fromLocation (ISBT Sector 43) → toLocation (ISBT Sector 17)
        // Schedule: 
        //   - departureTime (5:00 AM) = outbound direction (fromLocation → toLocation)
        //   - arrivalTime (2:00 PM) = return direction (toLocation → fromLocation)
        //   - outboundStopPoints: stops along outbound (Sector 42 → Sector 36)
        //   - returnStopPoints: stops along return (Sector 36 → Sector 42)

        let isReturnDirectionOneWay = false;

        if (passType === 'ONE_WAY' && schedule) {
            // Get the schedule's trip time configuration
            const tripTimeConfig = schedule.tripTimes?.[0];

            if (tripTimeConfig) {
                // Method 1: Check if selected time matches return trip time (arrivalTime)
                // If outboundTripTime === schedule's arrivalTime, it's return direction
                const scheduleReturnTime = tripTimeConfig.arrivalTime;
                const scheduleOutboundTime = tripTimeConfig.departureTime;

                if (outboundTripTime === scheduleReturnTime) {
                    isReturnDirectionOneWay = true;
                    console.log("[v0] ONE_WAY direction detection: outboundTripTime matches schedule arrivalTime (return time)");
                }

                // Method 2: Check if pickup is in returnStopPoints (not outboundStopPoints)
                if (!isReturnDirectionOneWay) {
                    const returnStopLocations = (tripTimeConfig.returnStopPoints || []).map(sp => sp.location);
                    const outboundStopLocations = (tripTimeConfig.outboundStopPoints || []).map(sp => sp.location);

                    const pickupInReturn = returnStopLocations.includes(pickupLocation);
                    const pickupInOutbound = outboundStopLocations.includes(pickupLocation);

                    if (pickupInReturn && !pickupInOutbound) {
                        isReturnDirectionOneWay = true;
                        console.log("[v0] ONE_WAY direction detection: pickup location found in returnStopPoints");
                    }
                }

                // Method 3: Check returnPickupLocation/returnDropoffLocation pattern
                // If returnPickupLocation matches route.toLocation, this indicates return direction
                if (!isReturnDirectionOneWay && returnPickupLocation && returnDropoffLocation) {
                    if (returnPickupLocation === route.toLocation || returnDropoffLocation === route.fromLocation) {
                        isReturnDirectionOneWay = true;
                        console.log("[v0] ONE_WAY direction detection: returnPickup/returnDropoff match route's reversed locations");
                    }
                }

                console.log("[v0] ONE_WAY direction detection result:", {
                    isReturnDirectionOneWay,
                    outboundTripTime,
                    scheduleOutboundTime,
                    scheduleReturnTime,
                    pickupLocation,
                    dropoffLocation,
                    returnPickupLocation,
                    returnDropoffLocation,
                    routeFromLocation: route.fromLocation,
                    routeToLocation: route.toLocation
                });
            }
        }

        // Legacy fallback if schedule is not available
        if (passType === 'ONE_WAY' && !schedule) {
            isReturnDirectionOneWay = dropoffLocation === route.fromLocation ||
                (returnPickupLocation === route.toLocation) ||
                (returnDropoffLocation === route.fromLocation);
            console.log("[v0] ONE_WAY direction detection (legacy fallback):", isReturnDirectionOneWay);
        }

        // For ONE_WAY passes, determine the correct from/to locations based on direction
        let oneWayFromLocation, oneWayToLocation;
        if (passType === 'ONE_WAY') {
            if (isReturnDirectionOneWay) {
                // Return direction: use reversed route locations
                oneWayFromLocation = route.toLocation;
                oneWayToLocation = route.fromLocation;
                console.log("[v0] ONE_WAY pass in RETURN direction - using reversed route:", {
                    oneWayFromLocation,
                    oneWayToLocation,
                    userPickup: pickupLocation,
                    userDropoff: dropoffLocation
                });
            } else {
                // Outbound direction: use normal route locations
                oneWayFromLocation = route.fromLocation;
                oneWayToLocation = route.toLocation;
                console.log("[v0] ONE_WAY pass in OUTBOUND direction - using normal route:", {
                    oneWayFromLocation,
                    oneWayToLocation,
                    userPickup: pickupLocation,
                    userDropoff: dropoffLocation
                });
            }
        }

        while (currentDate <= endDateObj) {
            // Skip weekends if not weekend pass
            const dayOfWeek = currentDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6

            if (passType === 'WEEKDAY' && isWeekend) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }

            if (passType === 'WEEKEND' && !isWeekend) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }

            // CHECK IF TRIP ALREADY EXISTS FOR THIS DATE
            const tripDateStart = new Date(currentDate);
            tripDateStart.setHours(0, 0, 0, 0);
            const tripDateEnd = new Date(currentDate);
            tripDateEnd.setHours(23, 59, 59, 999);

            // Determine trip from/to locations based on pass type
            // For ROUND_TRIP: outbound uses route.fromLocation → route.toLocation
            // For ONE_WAY: use the determined direction (could be outbound OR return)
            const tripFromLocation = passType === 'ONE_WAY' ? oneWayFromLocation : route.fromLocation;
            const tripToLocation = passType === 'ONE_WAY' ? oneWayToLocation : route.toLocation;

            // Check for existing outbound trip (or ONE_WAY trip in the correct direction)
            // IMPORTANT: Must include startTime in the query to distinguish between outbound and return trips
            // on the same day (e.g., 4:00 AM outbound vs 1:00 PM return)
            const existingOutboundTrip = await B2CPartnerTrip.findOne({
                routeId: routeId,
                b2cPartnerId: route.b2cPartnerId,
                tripDate: {
                    $gte: tripDateStart,
                    $lt: tripDateEnd
                },
                startTime: outboundTripTime,  // Filter by exact time to find the correct trip
                fromLocation: tripFromLocation,
                toLocation: tripToLocation,
                tripType: "One Way"
            });

            if (existingOutboundTrip) {
                console.log(`[v0] Found existing trip for ${currentDate.toDateString()} at ${outboundTripTime}:`, existingOutboundTrip._id);

                // CHECK SEAT AVAILABILITY FOR EXISTING TRIP
                if (existingOutboundTrip.availableSeats >= numberOfSeats) {
                    console.log(`[v0] Trip seats available: ${existingOutboundTrip.availableSeats}, Required: ${numberOfSeats}`);
                    existingTrips.push(existingOutboundTrip);
                } else {
                    console.log(`[v0] Trip - Not enough seats available: ${existingOutboundTrip.availableSeats}, Required: ${numberOfSeats}`);
                    // Skip this trip - not enough seats
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }
            } else {
                // CREATE NEW TRIP (outbound for ROUND_TRIP, or directional for ONE_WAY)
                console.log(`[v0] No existing trip at ${outboundTripTime}, creating new trip for ${currentDate.toDateString()}:`, {
                    routeId,
                    b2cPartnerId: route.b2cPartnerId,
                    vehicleId: outboundVehicleId,  // Using tripTime-specific vehicle
                    driverId: outboundDriverId,    // Using tripTime-specific driver
                    tripDate: new Date(currentDate),
                    startTime: outboundTripTime,
                    fromLocation: tripFromLocation,
                    toLocation: tripToLocation,
                    totalSeats: route.totalSeats,
                    availableSeats: (route.availableSeats || route.totalSeats || 35) - numberOfSeats,
                    bookedSeats: numberOfSeats,
                    isReturnDirectionOneWay: isReturnDirectionOneWay
                });

                const outboundTrip = new B2CPartnerTrip({
                    routeId,
                    b2cPartnerId: route.b2cPartnerId,
                    vehicleId: outboundVehicleId,  // Using tripTime-specific vehicle
                    driverId: outboundDriverId,    // Using tripTime-specific driver
                    tripDate: new Date(currentDate),
                    startTime: outboundTripTime,
                    tripType: "One Way",
                    fromLocation: tripFromLocation,
                    toLocation: tripToLocation,
                    totalSeats: route.totalSeats || 35, // Use route.totalSeats, fallback to 35
                    availableSeats: (route.availableSeats || route.totalSeats || 35) - numberOfSeats, // Reserve seats for this booking
                    bookedSeats: numberOfSeats, // Book seats immediately
                    status: "Scheduled",
                    isActive: true,
                    createdAt: new Date()
                });

                await outboundTrip.save();
                createdTrips.push(outboundTrip);
                console.log(`[v0] Created new trip for ${currentDate.toDateString()} with ${numberOfSeats} seats booked:`, outboundTrip._id);
            }

            // Create return trip if round trip
            if (passType === 'ROUND_TRIP' && returnTripTime && returnPickupLocation && returnDropoffLocation) {
                // Check for existing return trip
                // IMPORTANT: Must include startTime in the query to find the correct return trip
                // that matches the returnTripTime (e.g., 1:00 PM) and not the outbound trip (4:00 AM)
                const existingReturnTrip = await B2CPartnerTrip.findOne({
                    routeId: routeId,
                    b2cPartnerId: route.b2cPartnerId,
                    tripDate: {
                        $gte: tripDateStart,
                        $lt: tripDateEnd
                    },
                    startTime: returnTripTime,  // Filter by exact time to find the correct return trip
                    fromLocation: route.toLocation,
                    toLocation: route.fromLocation,
                    tripType: "One Way"
                });

                if (existingReturnTrip) {
                    console.log(`[v0] Found existing return trip for ${currentDate.toDateString()}:`, existingReturnTrip._id);

                    // CHECK SEAT AVAILABILITY FOR EXISTING RETURN TRIP
                    if (existingReturnTrip.availableSeats >= numberOfSeats) {
                        console.log(`[v0] Return trip seats available: ${existingReturnTrip.availableSeats}, Required: ${numberOfSeats}`);
                        existingTrips.push(existingReturnTrip);
                    } else {
                        console.log(`[v0] Not enough seats available on return trip: ${existingReturnTrip.availableSeats}, Required: ${numberOfSeats}`);
                        // Skip this return trip - not enough seats
                    }
                } else {
                    // CREATE NEW RETURN TRIP
                    const returnTrip = new B2CPartnerTrip({
                        routeId,
                        b2cPartnerId: route.b2cPartnerId,
                        vehicleId: returnVehicleId,  // Using tripTime-specific vehicle for return
                        driverId: returnDriverId,    // Using tripTime-specific driver for return
                        tripDate: new Date(currentDate),
                        startTime: returnTripTime,
                        tripType: "One Way",
                        fromLocation: route.toLocation,
                        toLocation: route.fromLocation,
                        totalSeats: route.totalSeats || 35, // Use route.totalSeats, fallback to 35
                        availableSeats: (route.availableSeats || route.totalSeats || 35) - numberOfSeats, // Reserve seats for this booking
                        bookedSeats: numberOfSeats, // Book seats immediately
                        status: "Scheduled",
                        isActive: true,
                        createdAt: new Date()
                    });

                    await returnTrip.save();
                    createdTrips.push(returnTrip);
                    console.log(`[v0] Created new return trip for ${currentDate.toDateString()} with ${numberOfSeats} seats booked:`, returnTrip._id);
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Log detailed trip summary for debugging
        const outboundTripsCreated = createdTrips.filter(t => t.fromLocation === route.fromLocation).length;
        const returnTripsCreated = createdTrips.filter(t => t.fromLocation === route.toLocation).length;
        const outboundTripsExisting = existingTrips.filter(t => t.fromLocation === route.fromLocation).length;
        const returnTripsExisting = existingTrips.filter(t => t.fromLocation === route.toLocation).length;

        console.log(`[v0] Trip Summary - Created: ${createdTrips.length}, Found Existing: ${existingTrips.length}`);
        console.log(`[v0] Detailed Trip Summary:`, {
            passType,
            isReturnDirectionOneWay: passType === 'ONE_WAY' ? isReturnDirectionOneWay : 'N/A',
            tripDirection: passType === 'ONE_WAY' ? (isReturnDirectionOneWay ? 'RETURN' : 'OUTBOUND') : 'BOTH',
            outboundTripTime,
            returnTripTime: returnTripTime || 'N/A',
            createdTrips: {
                total: createdTrips.length,
                outbound: outboundTripsCreated,
                return: returnTripsCreated
            },
            existingTrips: {
                total: existingTrips.length,
                outbound: outboundTripsExisting,
                return: returnTripsExisting
            },
            tripLocations: passType === 'ONE_WAY' ? {
                from: oneWayFromLocation,
                to: oneWayToLocation
            } : {
                outboundFrom: route.fromLocation,
                outboundTo: route.toLocation,
                returnFrom: route.toLocation,
                returnTo: route.fromLocation
            }
        });

        // COMBINE ALL TRIPS FOR VALIDATION
        const allTrips = [...createdTrips, ...existingTrips];

        // VALIDATE THAT WE HAVE ENOUGH TRIPS FOR BOOKING
        if (allTrips.length === 0) {
            console.log("[v0] No trips available for booking due to seat constraints");
            return res.status(400).json({
                success: false,
                message: "No trips available for booking. Not enough seats available on any trips.",
                error: "SEAT_UNAVAILABLE"
            });
        }

        // Check if we have enough trips for the requested duration
        const expectedTrips = passType === 'ROUND_TRIP' ? durationMonths * 2 : durationMonths;
        if (allTrips.length < expectedTrips * 20) { // Assuming ~20 working days per month
            console.log(`[v0] Not enough trips available. Expected: ~${expectedTrips * 20}, Available: ${allTrips.length}`);
            return res.status(400).json({
                success: false,
                message: `Not enough trips available for ${durationMonths} month${durationMonths > 1 ? 's' : ''}. Only ${allTrips.length} trips have available seats.`,
                error: "INSUFFICIENT_TRIPS",
                availableTrips: allTrips.length,
                expectedTrips: expectedTrips * 20
            });
        }

        // UPDATE SEATS FOR EXISTING TRIPS AND CREATE MAIN MONTHLY PASS BOOKING

        // Update existing trips with new bookings
        for (const existingTrip of existingTrips) {
            await B2CPartnerTrip.findByIdAndUpdate(existingTrip._id, {
                $inc: { bookedSeats: numberOfSeats },
                $set: { availableSeats: existingTrip.availableSeats - numberOfSeats }
            });
            console.log(`[v0] Updated existing trip ${existingTrip._id}: bookedSeats += ${numberOfSeats}, availableSeats = ${existingTrip.availableSeats - numberOfSeats}`);
        }

        // Update main monthly pass booking with all trip references
        passengerBooking.monthlyTrips = allTrips.map(trip => trip._id);
        passengerBooking.totalTripsCount = allTrips.length;
        passengerBooking.createdTripsCount = createdTrips.length;
        passengerBooking.existingTripsCount = existingTrips.length;
        passengerBooking.numberOfSeats = numberOfSeats; // Store number of seats booked
        await passengerBooking.save();

        console.log(`[v0] Monthly pass booking updated with ${allTrips.length} trip references`);
        console.log(`[v0] Main booking ID: ${passengerBooking._id}`);
        console.log(`[v0] B2C_PARTNER will accept this ONE booking and manage all ${allTrips.length} trips`);
        console.log(`[v0] Total seats booked across all trips: ${allTrips.length * numberOfSeats}`);

        // Send confirmation email
        try {
            await sendPassEmail(passenger.email, monthlyPass, 'ACTIVATION');
            console.log("[v0] Activation email sent to:", passenger.email);
        } catch (emailError) {
            console.error("[v0] Error sending activation email:", emailError);
        }

        // Generate pass certificate
        try {
            await generatePassCertificate(monthlyPass);
            console.log("[v0] Pass certificate generated for:", monthlyPass._id);
        } catch (certError) {
            console.error("[v0] Error generating pass certificate:", certError);
        }

        // WALLET payment: debit the commuter's wallet immediately. Balance was already
        // validated above, but we re-check defensively in case it changed concurrently.
        if (normalizedPaymentMethod === "WALLET" && finalTotalAmount > 0) {
            try {
                // Re-fetch to avoid acting on a stale balance
                commuterWallet = await Wallet.findOne({ userId: passengerId });

                if (!commuterWallet || (commuterWallet.balance || 0) < finalTotalAmount) {
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient wallet balance to complete this booking.",
                        walletBalance: commuterWallet?.balance || 0,
                        requiredAmount: finalTotalAmount
                    });
                }

                const balanceBefore = commuterWallet.balance;
                commuterWallet.balance -= finalTotalAmount;
                commuterWallet.transactions.push({
                    type: "EMI_PAYMENT",
                    amount: finalTotalAmount,
                    description: `Monthly pass payment for booking ${passengerBooking._id} (wallet)`,
                    reference: passengerBooking._id.toString(),
                    status: "COMPLETED",
                    timestamp: new Date()
                });
                await commuterWallet.save();

                await Transaction.create({
                    walletId: commuterWallet._id,
                    userId: passengerId,
                    type: "DEBIT",
                    category: "BOOKING_PAYMENT",
                    amount: finalTotalAmount,
                    currency: routeCurrency,
                    balanceBefore,
                    balanceAfter: commuterWallet.balance,
                    referenceId: passengerBooking._id,
                    referenceModel: "B2CPassengerBooking",
                    description: `Monthly pass payment (wallet) for booking ${passengerBooking._id}`,
                    metadata: {
                        bookingId: passengerBooking._id,
                        monthlyPassId: monthlyPass._id,
                        routeId: routeId,
                        passType: passType
                    }
                });

                console.log("[v0] WALLET payment debited from commuter:", {
                    passengerId,
                    amount: finalTotalAmount,
                    newBalance: commuterWallet.balance
                });
            } catch (walletError) {
                console.error("[v0] WALLET payment processing failed:", walletError.message);
                return res.status(400).json({
                    success: false,
                    message: "Failed to process wallet payment",
                    error: walletError.message
                });
            }
        }

        // Handle payment gateway if needed
        let paymentSessionData = null;
        if (["STRIPE", "TAP", "CARD"].includes(normalizedPaymentMethod) && finalTotalAmount > 0) {
            try {
                const country = detectCountryFromCurrency(currency || "AED");
                const passenger = await User.findById(passengerId);

                // Create payment session using PaymentGatewayService
                paymentSessionData = await PaymentGatewayService.createPaymentSession({
                    gateway: normalizedPaymentMethod === "CARD" ? "STRIPE" : normalizedPaymentMethod,
                    amount: finalTotalAmount,
                    currency: currency || "AED",
                    customer: {
                        email: passenger?.email,
                        name: passenger?.firstName + " " + passenger?.lastName,
                        phone: passenger?.phoneNumber
                    },
                    contractId: monthlyPass._id,
                    redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/payment-success`,
                    webhookUrl: `${process.env.BACKEND_URL}/api/webhook/payment`,
                    metadata: {
                        passengerId: passengerId.toString(),
                        routeId: routeId.toString(),
                        passType: passType,
                        bookingId: passengerBooking._id.toString()
                    }
                });

                console.log("[v0] Payment session created:", {
                    gateway: paymentSessionData.provider,
                    sessionId: paymentSessionData.sessionId,
                    amount: finalTotalAmount,
                    passenger: passengerId
                });

                // Update pass with payment pending status
                monthlyPass.paymentStatus = 'PENDING';
                monthlyPass.gatewaySessionId = paymentSessionData.sessionId;
                monthlyPass.paymentGateway = paymentSessionData.provider;
                await monthlyPass.save();

                passengerBooking.paymentStatus = 'PENDING';
                passengerBooking.gatewaySessionId = paymentSessionData.sessionId;
                await passengerBooking.save();
            } catch (paymentError) {
                console.error("[v0] Payment session creation failed:", paymentError.message);
                monthlyPass.paymentStatus = 'FAILED';
                await monthlyPass.save();

                return res.status(400).json({
                    success: false,
                    message: "Failed to initialize payment",
                    error: paymentError.message
                });
            }
        }

        res.status(201).json({
            success: true,
            message: paymentSessionData ?
                "Payment session initiated. Proceed to payment." :
                "Monthly pass created successfully",
            monthlyPass: {
                ...monthlyPass.toObject(),
                daysRemaining: monthlyPass.daysRemaining,
                isActive: monthlyPass.isActive,
                usagePercentage: monthlyPass.usagePercentage
            },
            monthlyPassBooking: {
                bookingId: passengerBooking._id,
                totalTripsCount: [...createdTrips, ...existingTrips].length,
                createdTripsCount: createdTrips.length,
                existingTripsCount: existingTrips.length,
                numberOfSeats: numberOfSeats,
                totalSeatsBooked: [...createdTrips, ...existingTrips].length * numberOfSeats,
                monthlyTrips: [...createdTrips, ...existingTrips].map(trip => trip._id)
            },
            trips: {
                totalCreated: createdTrips.length,
                totalExisting: existingTrips.length,
                totalTrips: [...createdTrips, ...existingTrips].length,
                outboundTrips: [...createdTrips, ...existingTrips].filter(trip => trip.fromLocation === route.fromLocation).length,
                returnTrips: [...createdTrips, ...existingTrips].filter(trip => trip.fromLocation === route.toLocation).length,
                newTripIds: createdTrips.map(trip => trip._id),
                existingTripIds: existingTrips.map(trip => trip._id),
                seatInfo: {
                    seatsPerTrip: numberOfSeats,
                    totalSeatsBooked: [...createdTrips, ...existingTrips].length * numberOfSeats,
                    tripsWithAvailableSeats: [...createdTrips, ...existingTrips].length
                }
            },
            payment: paymentSessionData ? {
                paymentUrl: paymentSessionData.paymentUrl,
                sessionId: paymentSessionData.sessionId,
                provider: paymentSessionData.provider,
                amount: finalTotalAmount,
                currency: currency || "AED"
            } : null,
            paymentRequired: !!paymentSessionData,
            paymentMethod: normalizedPaymentMethod
        });

    } catch (error) {
        console.error("[v0] Error creating B2C monthly pass:", error);
        res.status(500).json({
            success: false,
            message: "Error creating monthly pass",
            error: error.message
        });
    }
};



// Update Trip Seats for Monthly Pass
const updateTripSeats = async (monthlyPass) => {
    try {
        const { routeId, scheduleId, startDate, endDate, outboundTripTime, returnTripTime } = monthlyPass;

        // Get all trips in the pass duration
        const trips = await B2CPartnerTrip.find({
            routeId,
            scheduleId,
            tripDate: { $gte: startDate, $lte: endDate },
            status: "Scheduled"
        });

        // Update seats for matching trips
        for (const trip of trips) {
            if (trip.startTime === outboundTripTime || trip.startTime === returnTripTime) {
                // Reserve one seat for the monthly pass holder
                trip.bookedSeats = (trip.bookedSeats || 0) + 1;
                trip.availableSeats = Math.max(0, trip.availableSeats - 1);
                await trip.save();
            }
        }

        console.log(`[v0] Updated seats for ${trips.length} trips for monthly pass`);
    } catch (error) {
        console.error("[v0] Error updating trip seats:", error);
    }
};

// Get User Monthly Passes
export const getUserB2CMonthlyPasses = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        const query = { passengerId: userId };
        if (status) {
            query.status = status;
        }

        const passes = await B2CMonthlyPass.find(query)
            .populate('routeId', 'fromLocation toLocation')
            .populate('scheduleId', 'scheduleName')
            .populate('partnerId', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await B2CMonthlyPass.countDocuments(query);

        res.status(200).json({
            success: true,
            passes: passes.map(pass => ({
                ...pass.toObject(),
                daysRemaining: pass.daysRemaining,
                isActive: pass.isActive,
                usagePercentage: pass.usagePercentage
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("[v0] Error fetching user B2C monthly passes:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching monthly passes",
            error: error.message
        });
    }
};

// Get Monthly Pass Details
export const getB2CMonthlyPassDetails = async (req, res) => {
    try {
        const { passId } = req.params;

        const monthlyPass = await B2CMonthlyPass.findById(passId)
            .populate('routeId', 'fromLocation toLocation')
            .populate('scheduleId', 'scheduleName')
            .populate('partnerId', 'name email phone')
            .populate('passengerId', 'name email phone');

        if (!monthlyPass) {
            return res.status(404).json({
                success: false,
                message: "Monthly pass not found"
            });
        }

        res.status(200).json({
            success: true,
            monthlyPass: {
                ...monthlyPass.toObject(),
                daysRemaining: monthlyPass.daysRemaining,
                isActive: monthlyPass.isActive,
                usagePercentage: monthlyPass.usagePercentage
            }
        });

    } catch (error) {
        console.error("[v0] Error fetching B2C monthly pass details:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching monthly pass details",
            error: error.message
        });
    }
};

// Update Daily Usage
export const updateB2CDailyUsage = async (req, res) => {
    try {
        const { passId, tripType, tripDate } = req.body;

        const monthlyPass = await B2CMonthlyPass.findById(passId);
        if (!monthlyPass) {
            return res.status(404).json({
                success: false,
                message: "Monthly pass not found"
            });
        }

        // Check if usage already recorded for today
        const today = new Date(tripDate).setHours(0, 0, 0, 0);
        const existingUsage = monthlyPass.dailyUsage.find(
            usage => new Date(usage.date).setHours(0, 0, 0, 0) === today
        );

        if (existingUsage) {
            // Update existing usage
            if (tripType === 'OUTBOUND') {
                existingUsage.outboundTripUsed = true;
            } else if (tripType === 'RETURN') {
                existingUsage.returnTripUsed = true;
            }
        } else {
            // Add new usage record
            monthlyPass.dailyUsage.push({
                date: new Date(tripDate),
                outboundTripUsed: tripType === 'OUTBOUND',
                returnTripUsed: tripType === 'RETURN'
            });
        }

        // Update used trips count
        let usedTrips = 0;
        monthlyPass.dailyUsage.forEach(usage => {
            if (usage.outboundTripUsed) usedTrips++;
            if (usage.returnTripUsed) usedTrips++;
        });
        monthlyPass.usedTrips = usedTrips;

        await monthlyPass.save();

        res.status(200).json({
            success: true,
            message: "Daily usage updated successfully"
        });

    } catch (error) {
        console.error("[v0] Error updating daily usage:", error);
        res.status(500).json({
            success: false,
            message: "Error updating daily usage",
            error: error.message
        });
    }
};

// Renew Monthly Pass
export const renewB2CMonthlyPass = async (req, res) => {
    try {
        const { passId, durationMonths, paymentMethod } = req.body;

        const monthlyPass = await B2CMonthlyPass.findById(passId);
        if (!monthlyPass) {
            return res.status(404).json({
                success: false,
                message: "Monthly pass not found"
            });
        }

        // Calculate new dates
        const newEndDate = new Date(monthlyPass.endDate);
        newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

        // Calculate new amount
        const route = await B2CPartnerRoute.findById(monthlyPass.routeId);
        const pricePerMonth = monthlyPass.passType === "ROUND_TRIP"
            ? route.pricing.monthlyRoundTripPrice
            : route.pricing.monthlyOneWayPrice;
        const newTotalAmount = pricePerMonth * durationMonths;

        // Get dynamic commission rate for B2C Partner
        const renewalCommissionRate = await getB2CPartnerCommissionRate(monthlyPass.partnerId);
        console.log("[v0] Dynamic Commission Rate for B2C Partner (renewal):", renewalCommissionRate * 100, "%");

        // Calculate commission based on dynamic rate
        const newAdminCommission = newTotalAmount * renewalCommissionRate;
        const newPartnerEarnings = newTotalAmount * (1 - renewalCommissionRate);

        // Normalize payment method for renewal
        const renewalPaymentMethod = ["STRIPE", "TAP", "CARD", "CASH"].includes(paymentMethod) ? paymentMethod : "STRIPE";

        // Update pass
        monthlyPass.endDate = newEndDate;
        monthlyPass.durationMonths += durationMonths;
        monthlyPass.totalAmount += newTotalAmount;
        monthlyPass.adminCommission += newAdminCommission;
        monthlyPass.partnerEarnings += newPartnerEarnings;
        monthlyPass.paymentMethod = renewalPaymentMethod;
        monthlyPass.paymentStatus = renewalPaymentMethod === "CASH" ? "PAID" : "PENDING";
        monthlyPass.renewalReminderSent = false;

        await monthlyPass.save();

        res.status(200).json({
            success: true,
            message: "Monthly pass renewed successfully",
            monthlyPass: {
                ...monthlyPass.toObject(),
                daysRemaining: monthlyPass.daysRemaining,
                isActive: monthlyPass.isActive
            }
        });

    } catch (error) {
        console.error("[v0] Error renewing B2C monthly pass:", error);
        res.status(500).json({
            success: false,
            message: "Error renewing monthly pass",
            error: error.message
        });
    }
};

// Cancel Monthly Pass
export const cancelB2CMonthlyPass = async (req, res) => {
    try {
        const { passId, reason } = req.body;

        const monthlyPass = await B2CMonthlyPass.findById(passId);
        if (!monthlyPass) {
            return res.status(404).json({
                success: false,
                message: "Monthly pass not found"
            });
        }

        // Update status
        monthlyPass.status = "CANCELLED";
        if (reason) {
            monthlyPass.notes += `\n\nCancellation Reason: ${reason}`;
        }
        await monthlyPass.save();

        // Release reserved seats
        await releaseReservedSeats(monthlyPass);

        res.status(200).json({
            success: true,
            message: "Monthly pass cancelled successfully"
        });

    } catch (error) {
        console.error("[v0] Error cancelling B2C monthly pass:", error);
        res.status(500).json({
            success: false,
            message: "Error cancelling monthly pass",
            error: error.message
        });
    }
};

// Release Reserved Seats
const releaseReservedSeats = async (monthlyPass) => {
    try {
        const { routeId, scheduleId, startDate, endDate, outboundTripTime, returnTripTime } = monthlyPass;

        const trips = await B2CPartnerTrip.find({
            routeId,
            scheduleId,
            tripDate: { $gte: startDate, $lte: endDate },
            status: "Scheduled"
        });

        for (const trip of trips) {
            if (trip.startTime === outboundTripTime || trip.startTime === returnTripTime) {
                trip.bookedSeats = Math.max(0, trip.bookedSeats - 1);
                trip.availableSeats = Math.min(trip.totalSeats, trip.availableSeats + 1);
                await trip.save();
            }
        }

        console.log(`[v0] Released seats for ${trips.length} trips`);
    } catch (error) {
        console.error("[v0] Error releasing seats:", error);
    }
};

// Download Monthly Pass Certificate PDF
export const downloadMonthlyPassCertificate = async (req, res) => {
    try {
        const { passId } = req.params;

        const monthlyPass = await B2CMonthlyPass.findById(passId)
            .populate('routeId', 'fromLocation toLocation')
            .populate('passengerId', 'name email');

        if (!monthlyPass) {
            return res.status(404).json({
                success: false,
                message: "Monthly pass not found"
            });
        }

        // Generate PDF on-the-fly
        const filePath = await generatePassCertificate(monthlyPass);

        // Send file as download
        const fs = await import('fs');
        const path = await import('path');

        if (!fs.default.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: "Certificate file not found. Regenerating..."
            });
        }

        const fileName = `monthly-pass-${passId}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const fileStream = fs.default.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error("[v0] Error downloading pass certificate:", error);
        res.status(500).json({
            success: false,
            message: "Error downloading pass certificate",
            error: error.message
        });
    }
};

// Get Partner Monthly Passes
export const getPartnerB2CMonthlyPasses = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        const query = { partnerId };
        if (status) {
            query.status = status;
        }

        const passes = await B2CMonthlyPass.find(query)
            .populate('routeId', 'fromLocation toLocation')
            .populate('passengerId', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await B2CMonthlyPass.countDocuments(query);

        res.status(200).json({
            success: true,
            passes: passes.map(pass => ({
                ...pass.toObject(),
                daysRemaining: pass.daysRemaining,
                isActive: pass.isActive,
                usagePercentage: pass.usagePercentage
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("[v0] Error fetching partner B2C monthly passes:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching monthly passes",
            error: error.message
        });
    }
};
