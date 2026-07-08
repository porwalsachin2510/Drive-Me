import SubscriptionSettings from "../models/SubscriptionSettings.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";
import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerTrip from "../models/B2CPartnerTrip.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import { sendEmail } from "../Services/emailService.js";
import PaymentGatewayService from "../Services/paymentGatewayService.js";
import { createNotification } from "../Services/notificationService.js";
import { resolveDisplayCurrency, convertForDisplay } from "../Services/displayCurrency.js";
import { getOrCreateWallet } from "../Services/walletService.js";
import { computePassSeatAvailability } from "../Services/seatAvailabilityService.js";

/*
 * Subscription renewal supports three commuter-chosen methods:
 *   SAME_CARD -> auto-charge a fresh payment session (Stripe/Tap) each cycle
 *   WALLET    -> auto-debit the commuter wallet each cycle
 *   CASH      -> commuter requests renewal, admin confirms cash collection
 *   MANUAL    -> auto-renewal off, commuter renews on demand
 */

// Map the values the frontend sends to the values the model stores
const normalizeRenewalMethod = (value) => {
    if (!value) return undefined;
    const map = {
        CREDIT_CARD: "SAME_CARD",
        DEBIT_CARD: "SAME_CARD",
        CARD: "SAME_CARD",
        SAME_CARD: "SAME_CARD",
        WALLET: "WALLET",
        WALLET_BALANCE: "WALLET",
        CASH: "CASH",
        BANK_TRANSFER: "MANUAL",
        MANUAL: "MANUAL",
    };
    return map[value] || "SAME_CARD";
};

// Compute the price + commission/earnings for a renewal of `renewalMonths`.
// A monthly pass stores totals for its ORIGINAL duration (durationMonths), so we
// derive a per-month rate and scale it by the number of months the commuter chose
// to renew for. This lets a commuter renew for any number of months (min 1),
// independent of how many months the original pass covered.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const computeRenewalPricing = (basePass, renewalMonths) => {
    const baseMonths = Math.max(1, Number(basePass.durationMonths) || 1);
    const months = Math.max(1, Math.floor(Number(renewalMonths) || baseMonths));

    const perMonthAmount = (basePass.totalAmount || 0) / baseMonths;
    const perMonthAdmin = (basePass.adminCommission || 0) / baseMonths;
    const perMonthPartner = (basePass.partnerEarnings || 0) / baseMonths;

    return {
        months,
        amount: round2(perMonthAmount * months),
        adminCommission: round2(perMonthAdmin * months),
        partnerEarnings: round2(perMonthPartner * months),
    };
};

// Settle a paid renewal: credit admin commission + partner earnings into their wallets.
// `overrides` lets callers pass amounts scaled to the chosen renewal duration
// instead of the pass's stored (original-duration) totals.
const settleRenewalEarnings = async (pass, overrides = {}) => {
    const currency = pass.currency || "KWD";
    const adminCommission = overrides.adminCommission ?? pass.adminCommission;
    const partnerEarnings = overrides.partnerEarnings ?? pass.partnerEarnings;

    // Credit admin commission
    const adminUserId = process.env.ADMIN_USER_ID;
    if (adminUserId && adminCommission > 0) {
        // Renewal commission settles into the admin wallet for the PASS'S
        // currency, keeping UAE (AED) and Kuwait (KWD) renewals separated.
        const adminWallet = await getOrCreateWallet(adminUserId, { currency, role: "ADMIN" });
        if (adminWallet.isNew) await adminWallet.save();
        const adminBefore = adminWallet.balance;
        adminWallet.balance += adminCommission;
        adminWallet.totalEarnings += adminCommission;
        await adminWallet.save();

        await Transaction.create({
            walletId: adminWallet._id,
            userId: adminUserId,
            type: "CREDIT",
            amount: adminCommission,
            currency,
            category: "COMMISSION_EARNED",
            description: `Commission from monthly pass renewal ${pass._id}`,
            referenceId: pass._id,
            balanceBefore: adminBefore,
            balanceAfter: adminWallet.balance,
            metadata: { monthlyPassId: pass._id, type: "RENEWAL" },
        });
    }

    // Credit partner earnings
    if (pass.partnerId && partnerEarnings > 0) {
        const partnerWallet = await getOrCreateWallet(pass.partnerId, { currency, role: "B2C_PARTNER" });
        if (partnerWallet.isNew) await partnerWallet.save();
        const partnerBefore = partnerWallet.balance;
        partnerWallet.balance += partnerEarnings;
        partnerWallet.totalEarnings += partnerEarnings;
        await partnerWallet.save();

        await Transaction.create({
            walletId: partnerWallet._id,
            userId: pass.partnerId,
            type: "CREDIT",
            amount: partnerEarnings,
            currency,
            category: "PAYMENT_RECEIVED",
            description: `Monthly pass renewal earnings ${pass._id}`,
            referenceId: pass._id,
            balanceBefore: partnerBefore,
            balanceAfter: partnerWallet.balance,
            metadata: { monthlyPassId: pass._id, type: "RENEWAL" },
        });
    }
};

// ----------------------------------------------------------------------------
// Trip generation for a renewed pass
//   Mirrors the day-by-day trip creation/seat reservation used when a monthly
//   pass is first purchased (see createB2CMonthlyPass). This guarantees the
//   commuter actually has trips to travel on for the entire renewed window.
// ----------------------------------------------------------------------------

// Resolve how many seats the original pass reserved per trip (defaults to 1)
const resolveRenewalSeatCount = async (basePass) => {
    try {
        const originalBooking = await B2CPassengerBooking.findOne({
            monthlyPassId: basePass._id,
            isMonthlyPass: true,
        }).sort({ createdAt: -1 });
        const seats = originalBooking?.numberOfSeats;
        return seats && seats > 0 ? seats : 1;
    } catch (err) {
        console.error("[v0] Could not resolve renewal seat count, defaulting to 1:", err.message);
        return 1;
    }
};

// Determine, for a ONE_WAY pass, whether the commuter travels in the return
// direction (toLocation -> fromLocation) so generated trips match their pass.
const detectReturnDirectionOneWay = (newPass, route, schedule) => {
    if (newPass.passType !== "ONE_WAY") return false;

    const tripTimeConfig = schedule?.tripTimes?.[0];
    if (tripTimeConfig) {
        if (newPass.outboundTripTime === tripTimeConfig.arrivalTime) return true;

        const returnStopLocations = (tripTimeConfig.returnStopPoints || []).map((sp) => sp.location);
        const outboundStopLocations = (tripTimeConfig.outboundStopPoints || []).map((sp) => sp.location);
        if (
            returnStopLocations.includes(newPass.pickupLocation) &&
            !outboundStopLocations.includes(newPass.pickupLocation)
        ) {
            return true;
        }

        if (newPass.returnPickupLocation && newPass.returnDropoffLocation) {
            if (
                newPass.returnPickupLocation === route.toLocation ||
                newPass.returnDropoffLocation === route.fromLocation
            ) {
                return true;
            }
        }
        return false;
    }

    // Legacy fallback when no schedule is available
    return (
        newPass.dropoffLocation === route.fromLocation ||
        newPass.returnPickupLocation === route.toLocation ||
        newPass.returnDropoffLocation === route.fromLocation
    );
};

// Generate (or reuse) and seat-reserve every daily trip for the renewed window.
// Returns the list of linked trip ids so they can be stored on the mirror booking.
const generateRenewalTrips = async (newPass, numberOfSeats, windowStart, windowEnd) => {
    const route = await B2CPartnerRoute.findById(newPass.routeId);
    if (!route) {
        console.error("[v0] Renewal trip generation skipped: route not found for pass", newPass._id);
        return { tripIds: [], createdCount: 0, existingCount: 0 };
    }

    let schedule = null;
    try {
        const B2CPartnerSchedule = (await import("../models/B2CPartnerSchedule.js")).default;
        schedule = await B2CPartnerSchedule.findById(newPass.scheduleId);
    } catch (err) {
        console.error("[v0] Could not load schedule for renewal trip generation:", err.message);
    }

    const isReturnDirectionOneWay = detectReturnDirectionOneWay(newPass, route, schedule);

    // For ONE_WAY, pick the correct travel direction; ROUND_TRIP always uses both.
    let oneWayFromLocation = route.fromLocation;
    let oneWayToLocation = route.toLocation;
    if (newPass.passType === "ONE_WAY" && isReturnDirectionOneWay) {
        oneWayFromLocation = route.toLocation;
        oneWayToLocation = route.fromLocation;
    }

    const tripFromLocation = newPass.passType === "ONE_WAY" ? oneWayFromLocation : route.fromLocation;
    const tripToLocation = newPass.passType === "ONE_WAY" ? oneWayToLocation : route.toLocation;

    const createdTrips = [];
    const existingTrips = [];

    // Generate trips only for the requested window. For an in-place renewal this
    // is the *extension* window (day after the old end date -> new end date) so we
    // never regenerate trips that already exist for the original period.
    const currentDate = new Date(windowStart || newPass.startDate);
    currentDate.setHours(0, 0, 0, 0);
    const endDateObj = new Date(windowEnd || newPass.endDate);

    while (currentDate <= endDateObj) {
        const tripDateStart = new Date(currentDate);
        tripDateStart.setHours(0, 0, 0, 0);
        const tripDateEnd = new Date(currentDate);
        tripDateEnd.setHours(23, 59, 59, 999);

        // Outbound (or directional ONE_WAY) trip
        const existingOutbound = await B2CPartnerTrip.findOne({
            routeId: newPass.routeId,
            b2cPartnerId: route.b2cPartnerId,
            tripDate: { $gte: tripDateStart, $lt: tripDateEnd },
            startTime: newPass.outboundTripTime,
            fromLocation: tripFromLocation,
            toLocation: tripToLocation,
            tripType: "One Way",
        });

        if (existingOutbound) {
            if (existingOutbound.availableSeats >= numberOfSeats) {
                await B2CPartnerTrip.findByIdAndUpdate(existingOutbound._id, {
                    $inc: { bookedSeats: numberOfSeats },
                    $set: { availableSeats: existingOutbound.availableSeats - numberOfSeats },
                });
                existingTrips.push(existingOutbound);
            }
        } else {
            const outboundTrip = new B2CPartnerTrip({
                routeId: newPass.routeId,
                b2cPartnerId: route.b2cPartnerId,
                vehicleId: newPass.outboundVehicleId,
                driverId: newPass.outboundDriverId,
                tripDate: new Date(currentDate),
                startTime: newPass.outboundTripTime,
                tripType: "One Way",
                fromLocation: tripFromLocation,
                toLocation: tripToLocation,
                totalSeats: route.totalSeats || 35,
                availableSeats: (route.availableSeats || route.totalSeats || 35) - numberOfSeats,
                bookedSeats: numberOfSeats,
                status: "Scheduled",
                isActive: true,
                createdAt: new Date(),
            });
            await outboundTrip.save();
            createdTrips.push(outboundTrip);
        }

        // Return trip for ROUND_TRIP passes
        if (
            newPass.passType === "ROUND_TRIP" &&
            newPass.returnTripTime &&
            newPass.returnPickupLocation &&
            newPass.returnDropoffLocation
        ) {
            const existingReturn = await B2CPartnerTrip.findOne({
                routeId: newPass.routeId,
                b2cPartnerId: route.b2cPartnerId,
                tripDate: { $gte: tripDateStart, $lt: tripDateEnd },
                startTime: newPass.returnTripTime,
                fromLocation: route.toLocation,
                toLocation: route.fromLocation,
                tripType: "One Way",
            });

            if (existingReturn) {
                if (existingReturn.availableSeats >= numberOfSeats) {
                    await B2CPartnerTrip.findByIdAndUpdate(existingReturn._id, {
                        $inc: { bookedSeats: numberOfSeats },
                        $set: { availableSeats: existingReturn.availableSeats - numberOfSeats },
                    });
                    existingTrips.push(existingReturn);
                }
            } else {
                const returnTrip = new B2CPartnerTrip({
                    routeId: newPass.routeId,
                    b2cPartnerId: route.b2cPartnerId,
                    vehicleId: newPass.returnVehicleId,
                    driverId: newPass.returnDriverId,
                    tripDate: new Date(currentDate),
                    startTime: newPass.returnTripTime,
                    tripType: "One Way",
                    fromLocation: route.toLocation,
                    toLocation: route.fromLocation,
                    totalSeats: route.totalSeats || 35,
                    availableSeats: (route.availableSeats || route.totalSeats || 35) - numberOfSeats,
                    bookedSeats: numberOfSeats,
                    status: "Scheduled",
                    isActive: true,
                    createdAt: new Date(),
                });
                await returnTrip.save();
                createdTrips.push(returnTrip);
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    const allTrips = [...createdTrips, ...existingTrips];
    console.log(
        `[v0] Renewal trips for pass ${newPass._id}: created ${createdTrips.length}, reused ${existingTrips.length}, total ${allTrips.length}`
    );

    return {
        tripIds: allTrips.map((t) => t._id),
        createdCount: createdTrips.length,
        existingCount: existingTrips.length,
    };
};

// Extend an existing monthly pass *in place* once a renewal is paid, instead of
// creating a duplicate pass + duplicate booking. This pushes the pass end date
// forward, generates daily trips for the newly-paid extension window, and appends
// those trips to the commuter's existing booking so the My Rides card keeps showing
// the full set of future trips they are entitled to.
//
// `sessionId` (optional) is the gateway checkout session for card renewals and is
// used to guarantee the same payment is never applied twice.
const applyRenewalToPass = async (basePass, { paymentMethod, sessionId, renewalMonths } = {}) => {
    // Idempotency guard for card renewals: if this session was already applied,
    // do nothing and report the already-extended state.
    if (sessionId && Array.isArray(basePass.appliedRenewalSessions) && basePass.appliedRenewalSessions.includes(sessionId)) {
        console.log(`[v0] Renewal session ${sessionId} already applied to pass ${basePass._id}; skipping.`);
        return { alreadyApplied: true, tripResult: { tripIds: [], createdCount: 0, existingCount: 0 } };
    }

    // The commuter chooses how many months to renew for (minimum 1). When no
    // explicit value is provided (e.g. cron auto-renewal) we fall back to the
    // pass's original duration so existing behaviour is preserved.
    const pricing = computeRenewalPricing(basePass, renewalMonths);
    const extensionMonths = pricing.months;

    // The extension starts the day after the current end date (or today if the pass
    // has already lapsed) so trips never overlap with the original period.
    const previousEndDate = new Date(basePass.endDate);
    const now = new Date();
    const extensionStart = new Date(Math.max(previousEndDate.getTime(), now.getTime()));
    extensionStart.setDate(extensionStart.getDate() + 1);
    extensionStart.setHours(0, 0, 0, 0);

    const newEndDate = new Date(previousEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + extensionMonths);
    newEndDate.setHours(23, 59, 59, 999);

    const numberOfSeats = await resolveRenewalSeatCount(basePass);

    // Generate daily trips + reserve seats for the extension window only.
    let tripResult = { tripIds: [], createdCount: 0, existingCount: 0 };
    try {
        tripResult = await generateRenewalTrips(basePass, numberOfSeats, extensionStart, newEndDate);
    } catch (tripError) {
        console.error("[v0] Renewal trip generation failed:", tripError.message);
    }

    // Extend the pass in place.
    basePass.endDate = newEndDate;
    basePass.status = "ACTIVE";
    basePass.paymentStatus = "PAID";
    if (paymentMethod) basePass.paymentMethod = paymentMethod;
    basePass.renewalCount = (basePass.renewalCount || 0) + 1;
    basePass.lastRenewedAt = new Date();
    // Clear any in-flight renewal duration now that it has been applied.
    basePass.pendingRenewalMonths = null;
    // Grow the pass's trip allowance by the trips generated for the extension
    // window so usage tracking (usedTrips / totalTrips) stays accurate.
    if (tripResult.tripIds.length > 0) {
        basePass.totalTrips = (basePass.totalTrips || 0) + tripResult.tripIds.length;
    }
    if (sessionId) {
        basePass.appliedRenewalSessions = [...(basePass.appliedRenewalSessions || []), sessionId];
    }
    await basePass.save();

    // Credit admin commission + partner earnings exactly once per renewal.
    // This is intentionally placed AFTER the idempotency guard above (and after the
    // session id is recorded) so that re-entrant calls — e.g. the payment-verify
    // endpoint AND the Stripe webhook both firing for the same renewal — can never
    // double-credit the admin/partner wallets. Previously settlement ran before the
    // guard at every call site, which is what tripled the wallet balances.
    // Commission + partner earnings are scaled to the chosen renewal duration.
    await settleRenewalEarnings(basePass, {
        adminCommission: pricing.adminCommission,
        partnerEarnings: pricing.partnerEarnings,
    });

    // Append the new trips to the commuter's existing booking so My Rides shows them.
    try {
        const booking = await B2CPassengerBooking.findOne({ monthlyPassId: basePass._id }).sort({ createdAt: -1 });
        if (booking) {
            const existingTripIds = (booking.monthlyTrips || []).map((t) => String(t));
            const newTripIds = tripResult.tripIds.filter((id) => !existingTripIds.includes(String(id)));
            booking.monthlyTrips = [...(booking.monthlyTrips || []), ...newTripIds];
            booking.totalTripsCount = booking.monthlyTrips.length;
            booking.createdTripsCount = (booking.createdTripsCount || 0) + tripResult.createdCount;
            booking.existingTripsCount = (booking.existingTripsCount || 0) + tripResult.existingCount;
            booking.passEndDate = newEndDate;
            booking.paymentStatus = "COMPLETED";
            // A renewal is a continuation of the SAME booking. If the partner has
            // already accepted (or started/finished) this booking, we must NOT
            // revert it back to CONFIRMED — doing so makes the partner see the
            // Accept/Reject buttons again for a booking they already handled.
            // Only promote a not-yet-handled booking (PENDING) to CONFIRMED, and
            // revive a previously REJECTED/CANCELLED booking on a fresh renewal.
            const handledStatuses = ["ACCEPTED", "IN_PROGRESS", "COMPLETED"];
            if (!handledStatuses.includes(booking.bookingStatus)) {
                booking.bookingStatus = "CONFIRMED";
            }
            await booking.save();
            console.log(
                `[v0] Renewal extended booking ${booking._id}: +${newTripIds.length} trips (total ${booking.monthlyTrips.length}), pass valid until ${newEndDate.toISOString()}`
            );
        } else {
            console.warn(`[v0] No existing booking found for pass ${basePass._id} during renewal; trips generated but not linked.`);
        }
    } catch (bookingError) {
        console.error("[v0] Renewal booking extension failed:", bookingError.message);
    }

    return { alreadyApplied: false, tripResult, newEndDate, pricing };
};

// ----------------------------------------------------------------------------
// Settings: get / update / cancel
// ----------------------------------------------------------------------------

export const updateSubscriptionSettings = async (req, res) => {
    try {
        const userId = req.userId;
        const {
            autoRenewal,
            renewalReminderDays,
            renewalPaymentMethod,
            paymentMethod, // frontend alias
            emailNotifications,
            smsNotifications,
            pushNotifications,
        } = req.body;

        let settings = await SubscriptionSettings.findOne({ userId });
        if (!settings) {
            settings = new SubscriptionSettings({ userId });
        }

        if (autoRenewal !== undefined) settings.autoRenewal = autoRenewal;
        if (renewalReminderDays !== undefined) settings.renewalReminderDays = Number(renewalReminderDays);

        const incomingMethod = renewalPaymentMethod || paymentMethod;
        if (incomingMethod !== undefined) {
            settings.renewalPaymentMethod = normalizeRenewalMethod(incomingMethod);
        }

        // The frontend sends booleans; the model stores per-event objects.
        if (emailNotifications !== undefined) {
            if (typeof emailNotifications === "boolean") {
                settings.emailNotifications = {
                    renewalReminder: emailNotifications,
                    renewalSuccess: emailNotifications,
                    renewalFailed: emailNotifications,
                    paymentFailed: emailNotifications,
                };
            } else {
                settings.emailNotifications = { ...settings.emailNotifications, ...emailNotifications };
            }
        }
        if (smsNotifications !== undefined) {
            if (typeof smsNotifications === "boolean") {
                settings.smsNotifications = {
                    renewalReminder: smsNotifications,
                    renewalSuccess: smsNotifications,
                    renewalFailed: smsNotifications,
                };
            } else {
                settings.smsNotifications = { ...settings.smsNotifications, ...smsNotifications };
            }
        }
        if (pushNotifications && typeof pushNotifications === "object") {
            settings.pushNotifications = { ...settings.pushNotifications, ...pushNotifications };
        }

        // Link the chosen (or latest-expiring) active pass and set next renewal date.
        // The frontend can pass `selectedPassId` to target one of several passes.
        const { selectedPassId } = req.body;
        let activePass = null;
        if (selectedPassId) {
            activePass = await B2CMonthlyPass.findOne({
                _id: selectedPassId,
                passengerId: userId,
                status: "ACTIVE",
            });
        }
        if (!activePass) {
            activePass = await B2CMonthlyPass.findOne({
                passengerId: userId,
                status: "ACTIVE",
            }).sort({ endDate: -1 });
        }

        if (activePass) {
            settings.linkedPassId = activePass._id;
            settings.nextRenewalDate = settings.autoRenewal ? new Date(activePass.endDate) : null;
            // keep pass auto-renewal flag in sync for visibility
            activePass.autoRenewal = !!settings.autoRenewal;
            await activePass.save();
        } else if (!settings.autoRenewal) {
            settings.nextRenewalDate = null;
        }

        await settings.save();

        const activePasses = await loadActivePasses(userId);
        const responsePass = activePasses.find(
            (p) => activePass && String(p._id) === String(activePass._id)
        ) || activePasses[0] || null;

        res.status(200).json({
            success: true,
            message: "Subscription settings updated successfully",
            data: { settings: buildSettingsResponse(settings, responsePass, activePasses) },
        });
    } catch (error) {
        console.error("[v0] Error updating subscription settings:", error);
        res.status(500).json({
            success: false,
            message: "Error updating subscription settings",
            error: error.message,
        });
    }
};

// Serialize a monthly pass into the lightweight shape the UI needs, including
// route label (e.g. "Deira City Centre -> BurJuman") so commuters can tell
// their multiple passes apart.
const serializePass = (pass, route) => ({
    _id: pass._id,
    endDate: pass.endDate,
    startDate: pass.startDate,
    totalAmount: pass.totalAmount,
    durationMonths: pass.durationMonths || 1,
    // Per-month price so the UI can price any chosen renewal duration.
    monthlyAmount: round2((pass.totalAmount || 0) / Math.max(1, pass.durationMonths || 1)),
    currency: pass.currency,
    passType: pass.passType,
    status: pass.status,
    daysRemaining: pass.daysRemaining,
    autoRenewal: pass.autoRenewal,
    routeId: pass.routeId,
    fromLocation: route?.fromLocation || pass.pickupLocation || null,
    toLocation: route?.toLocation || pass.dropoffLocation || null,
    routeLabel: route
        ? `${route.fromLocation} -> ${route.toLocation}`
        : pass.pickupLocation && pass.dropoffLocation
            ? `${pass.pickupLocation} -> ${pass.dropoffLocation}`
            : "Monthly Pass",
});

const buildSettingsResponse = (settings, activePass, activePasses = []) => ({
    autoRenewal: settings.autoRenewal,
    renewalReminderDays: settings.renewalReminderDays,
    renewalPaymentMethod: settings.renewalPaymentMethod,
    nextRenewalDate: settings.nextRenewalDate,
    lastRenewalDate: settings.lastRenewalDate,
    emailNotifications: settings.emailNotifications,
    smsNotifications: settings.smsNotifications,
    pushNotifications: settings.pushNotifications,
    renewalHistory: settings.renewalHistory,
    cancellationReason: settings.cancellationReason,
    cancellationDate: settings.cancellationDate,
    currentRenewalAttempts: settings.currentRenewalAttempts,
    maxRenewalAttempts: settings.maxRenewalAttempts,
    pendingCashRenewal: settings.pendingCashRenewal,
    // Backwards-compatible single pass (the latest-expiring one)
    activePass: activePass || null,
    // Full list so the commuter can choose which pass to renew
    activePasses,
});

// Load every active pass for a passenger, newest expiry first, with route info.
const loadActivePasses = async (userId) => {
    const passes = await B2CMonthlyPass.find({
        passengerId: userId,
        status: "ACTIVE",
    }).sort({ endDate: -1 });

    if (!passes.length) return [];

    const routeIds = [...new Set(passes.map((p) => String(p.routeId)))];
    const routes = await B2CPartnerRoute.find({ _id: { $in: routeIds } }).select(
        "fromLocation toLocation"
    );
    const routeMap = new Map(routes.map((r) => [String(r._id), r]));

    return passes.map((p) => serializePass(p, routeMap.get(String(p.routeId))));
};

export const getSubscriptionSettings = async (req, res) => {
    try {
        const userId = req.userId;

        let settings = await SubscriptionSettings.findOne({ userId });
        if (!settings) {
            settings = new SubscriptionSettings({ userId });
            await settings.save();
        }

        const activePasses = await loadActivePasses(userId);
        const activePass = activePasses[0] || null;

        // Show the wallet balance in the ACTIVE PASS'S currency so the UI's
        // "can you afford a wallet renewal?" check compares like for like.
        const uiWalletCurrency = activePass?.currency || "AED";
        const wallet = await Wallet.findOne({ userId, currency: uiWalletCurrency });

        res.status(200).json({
            success: true,
            data: {
                settings: buildSettingsResponse(settings, activePass, activePasses),
                walletBalance: wallet?.balance || 0,
                walletCurrency: wallet?.currency || "AED",
            },
        });
    } catch (error) {
        console.error("[v0] Error getting subscription settings:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving subscription settings",
            error: error.message,
        });
    }
};

export const cancelSubscription = async (req, res) => {
    try {
        const userId = req.userId;
        const { reason, immediateEffect } = req.body;

        let settings = await SubscriptionSettings.findOne({ userId });
        if (!settings) {
            settings = new SubscriptionSettings({ userId });
        }

        settings.autoRenewal = false;
        settings.nextRenewalDate = null;
        settings.cancellationReason = reason || "Not specified";
        settings.cancellationDate = new Date();

        if (immediateEffect) {
            await B2CMonthlyPass.updateMany(
                { passengerId: userId, status: "ACTIVE" },
                { status: "CANCELLED", autoRenewal: false, updatedAt: new Date() }
            );
        } else {
            await B2CMonthlyPass.updateMany(
                { passengerId: userId, status: "ACTIVE" },
                { autoRenewal: false, updatedAt: new Date() }
            );
        }

        settings.renewalHistory.push({
            date: new Date(),
            status: "CANCELLED",
            amount: 0,
            paymentMethod: "CANCELLATION",
            failureReason: reason || null,
        });

        await settings.save();
        await sendCancellationEmail(userId, reason);

        res.status(200).json({
            success: true,
            message: "Subscription cancelled successfully",
            data: {
                cancellationDate: settings.cancellationDate,
                immediateEffect: !!immediateEffect,
                autoRenewal: false,
            },
        });
    } catch (error) {
        console.error("[v0] Error cancelling subscription:", error);
        res.status(500).json({
            success: false,
            message: "Error cancelling subscription",
            error: error.message,
        });
    }
};

// ----------------------------------------------------------------------------
// Manual / on-demand renewal (commuter clicks "Renew now")
//   WALLET -> debit immediately and activate
//   CARD   -> create a fresh payment session, activate on gateway success
//   CASH   -> create a pending cash request for admin to confirm
// ----------------------------------------------------------------------------

// Resolve which pass to renew. If the commuter selected a specific passId,
// renew that exact pass; otherwise fall back to the latest-expiring one.
const resolveBasePassForRenewal = async (userId, passId) => {
    if (passId) {
        const chosen = await B2CMonthlyPass.findOne({
            _id: passId,
            passengerId: userId,
            status: { $in: ["ACTIVE", "EXPIRED"] },
        });
        if (chosen) return chosen;
    }
    return B2CMonthlyPass.findOne({
        passengerId: userId,
        status: { $in: ["ACTIVE", "EXPIRED"] },
    }).sort({ endDate: -1 });
};

// Build a human-readable seat message for the given seat-availability report.
const buildSeatMessage = (seat) => {
    if (!seat) return "Seat availability could not be determined for this pass.";
    if (seat.holdsSeat) {
        return `Your seat on "${seat.routeLabel}" is reserved and will carry over when you renew.`;
    }
    if (seat.isFull) {
        return `The vehicle on "${seat.routeLabel}" is currently full (0 of ${seat.totalSeats} seats free). Your pass has lapsed, so renewing now will NOT secure you a seat. Please wait for a seat to free up or contact support.`;
    }
    return `${seat.availableSeats} of ${seat.totalSeats} seat(s) are available on "${seat.routeLabel}". Renew now to secure your seat.`;
};

// Commuter-facing endpoint: live seat availability for a pass they may renew.
// Lets the UI show whether the vehicle is full BEFORE the commuter pays.
export const getPassSeatAvailability = async (req, res) => {
    try {
        const userId = req.userId;
        const passId = req.query.passId || req.body?.passId;

        const basePass = await resolveBasePassForRenewal(userId, passId);
        if (!basePass) {
            return res.status(404).json({
                success: false,
                message: "No active or recently expired monthly pass found.",
            });
        }

        const seat = await computePassSeatAvailability(basePass);
        if (!seat) {
            return res.status(200).json({
                success: true,
                data: {
                    seatAvailability: null,
                    message: "Seat availability is not tracked for this route.",
                },
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                seatAvailability: seat,
                message: buildSeatMessage(seat),
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching pass seat availability:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching seat availability",
            error: error.message,
        });
    }
};

export const renewSubscription = async (req, res) => {
    try {
        const userId = req.userId;
        const method = normalizeRenewalMethod(req.body.paymentMethod || req.body.renewalPaymentMethod);

        // The commuter chooses how many months to renew for. Minimum is 1 month;
        // there is no fixed upper limit (capped at 12 to match the pass model).
        const requestedMonths = Math.floor(Number(req.body.renewalMonths));
        if (req.body.renewalMonths !== undefined && (!Number.isFinite(requestedMonths) || requestedMonths < 1)) {
            return res.status(400).json({
                success: false,
                message: "Renewal duration must be at least 1 month.",
            });
        }
        const renewalMonths = Number.isFinite(requestedMonths) && requestedMonths >= 1
            ? Math.min(requestedMonths, 12)
            : undefined;

        let settings = await SubscriptionSettings.findOne({ userId });
        if (!settings) settings = new SubscriptionSettings({ userId });

        const basePass = await resolveBasePassForRenewal(userId, req.body.passId);

        if (!basePass) {
            return res.status(404).json({
                success: false,
                message: "No active or recently expired monthly pass found to renew.",
            });
        }

        // SEAT GUARD: never take a payment for a renewal the commuter can't actually
        // use. If their pass has lapsed AND the vehicle/leg is now full, block the
        // renewal up front (before any wallet debit, card session, or cash request)
        // and tell them the vehicle is full instead of silently charging them.
        const seat = await computePassSeatAvailability(basePass);
        if (seat && !seat.canRenew) {
            return res.status(409).json({
                success: false,
                code: "SEATS_FULL",
                message: buildSeatMessage(seat),
                data: { seatAvailability: seat },
            });
        }

        if (method === "CASH") {
            return await createCashRenewalRequest(req, res, settings, basePass, renewalMonths);
        }

        if (method === "WALLET") {
            return await renewWithWallet(req, res, settings, basePass, true, renewalMonths);
        }

        // SAME_CARD / MANUAL fall through to card payment session
        return await renewWithCard(req, res, settings, basePass, renewalMonths);
    } catch (error) {
        console.error("[v0] Error renewing subscription:", error);
        res.status(500).json({
            success: false,
            message: "Error renewing subscription",
            error: error.message,
        });
    }
};

// Wallet renewal: validate balance, debit, activate, settle earnings
const renewWithWallet = async (req, res, settings, basePass, isManual, renewalMonths) => {
    const userId = basePass.passengerId;
    const pricing = computeRenewalPricing(basePass, renewalMonths);
    const amount = pricing.amount;
    const currency = basePass.currency || "AED";

    // Wallet renewal must be paid from the wallet in the pass's currency.
    const wallet = await Wallet.findOne({ userId, currency });
    if (!wallet || (wallet.balance || 0) < amount) {
        settings.renewalHistory.push({
            date: new Date(),
            status: "FAILED",
            amount,
            paymentMethod: "WALLET",
            failureReason: "Insufficient wallet balance",
        });
        settings.currentRenewalAttempts += 1;
        await settings.save();

        return res.status(400).json({
            success: false,
            message: `Insufficient wallet balance. Required: ${currency} ${amount.toFixed(2)}, Available: ${currency} ${(wallet?.balance || 0).toFixed(2)}.`,
            walletBalance: wallet?.balance || 0,
            requiredAmount: amount,
        });
    }

    // Debit commuter wallet
    const balanceBefore = wallet.balance;
    wallet.balance -= amount;
    wallet.transactions.push({
        type: "EMI_PAYMENT",
        amount,
        description: `Monthly pass renewal (wallet) - pass ${basePass._id}`,
        reference: basePass._id.toString(),
        status: "COMPLETED",
    });
    await wallet.save();

    await Transaction.create({
        walletId: wallet._id,
        userId,
        type: "DEBIT",
        category: "BOOKING_PAYMENT",
        amount,
        currency,
        balanceBefore,
        balanceAfter: wallet.balance,
        referenceId: basePass._id,
        description: `Monthly pass renewal (wallet) - pass ${basePass._id}`,
        metadata: { monthlyPassId: basePass._id, type: "RENEWAL" },
    });

    const { newEndDate } = await applyRenewalToPass(basePass, { paymentMethod: "WALLET", renewalMonths });

    settings.linkedPassId = basePass._id;
    settings.lastRenewalDate = new Date();
    settings.nextRenewalDate = settings.autoRenewal ? newEndDate : null;
    settings.currentRenewalAttempts = 0;
    settings.cancellationReason = null;
    settings.cancellationDate = null;
    settings.renewalHistory.push({
        date: new Date(),
        status: "SUCCESS",
        amount,
        paymentMethod: "WALLET",
    });
    await settings.save();

    await sendRenewalSuccessEmail(settings, basePass);

    return res.status(200).json({
        success: true,
        message: `Monthly pass renewed for ${pricing.months} month${pricing.months > 1 ? "s" : ""} using wallet balance.`,
        data: { newPass: basePass, nextRenewalDate: newEndDate, amount, renewalMonths: pricing.months, walletBalance: wallet.balance },
    });
};

// Card renewal: create a fresh payment session each cycle. The pass is extended
// in place only after the gateway confirms payment (see activateCardRenewalPass),
// so no duplicate pass is ever created.
const renewWithCard = async (req, res, settings, basePass, renewalMonths) => {
    const userId = basePass.passengerId;
    const pricing = computeRenewalPricing(basePass, renewalMonths);
    const amount = pricing.amount;
    const currency = basePass.currency || "AED";

    try {
        const passenger = await User.findById(userId);
        const session = await PaymentGatewayService.createPaymentSession({
            gateway: "STRIPE",
            amount,
            currency,
            customer: {
                email: passenger?.email,
                name: passenger?.fullName || `${passenger?.firstName || ""} ${passenger?.lastName || ""}`.trim(),
                phone: passenger?.phoneNumber || passenger?.whatsappNumber,
            },
            contractId: basePass._id.toString(),
            redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/payment-success`,
            webhookUrl: `${process.env.BACKEND_URL}/api/webhook/payment`,
            metadata: {
                passengerId: userId.toString(),
                routeId: basePass.routeId.toString(),
                passType: basePass.passType,
                renewal: "true",
                // Explicitly include the pass id in metadata as well so the verify
                // and webhook flows can resolve it even if client_reference_id is
                // unavailable for the chosen gateway.
                contractId: basePass._id.toString(),
            },
        });

        // Remember the in-flight session on the pass so activation is idempotent and
        // the verify endpoint can resolve which pass to extend. Also store the chosen
        // renewal duration so the correct number of months is applied on payment.
        basePass.gatewaySessionId = session.sessionId;
        basePass.paymentGateway = session.provider;
        basePass.pendingRenewalMonths = pricing.months;
        await basePass.save();

        settings.linkedPassId = basePass._id;
        settings.pendingRenewalSessionId = session.sessionId;
        settings.renewalHistory.push({
            date: new Date(),
            status: "PENDING_PAYMENT",
            amount,
            paymentMethod: "SAME_CARD",
            gatewaySessionId: session.sessionId,
        });
        await settings.save();

        return res.status(200).json({
            success: true,
            message: "Payment session created. Complete payment to activate your renewed pass.",
            data: {
                newPass: basePass,
                payment: {
                    paymentUrl: session.paymentUrl,
                    sessionId: session.sessionId,
                    provider: session.provider,
                    amount,
                    currency,
                },
                paymentRequired: true,
            },
        });
    } catch (paymentError) {
        settings.renewalHistory.push({
            date: new Date(),
            status: "FAILED",
            amount,
            paymentMethod: "SAME_CARD",
            failureReason: paymentError.message,
        });
        settings.currentRenewalAttempts += 1;
        await settings.save();

        return res.status(400).json({
            success: false,
            message: "Failed to create payment session for renewal.",
            error: paymentError.message,
        });
    }
};

// ----------------------------------------------------------------------------
// Activate a card renewal once the gateway confirms payment.
// Called from the payment verify flow (paymentController.verifyPayment).
// Extends the existing pass in place + appends trips to the existing booking.
// Idempotent via the gateway session id, so re-verifying never double-applies.
// ----------------------------------------------------------------------------
export const activateCardRenewalPass = async (passId, sessionId = null) => {
    const basePass = await B2CMonthlyPass.findById(passId);
    if (!basePass) {
        console.error("[v0] activateCardRenewalPass: pass not found", passId);
        return null;
    }

    const { alreadyApplied, newEndDate, pricing } = await applyRenewalToPass(basePass, {
        paymentMethod: "STRIPE",
        sessionId: sessionId || basePass.gatewaySessionId,
        // Apply the duration the commuter chose when the session was created.
        renewalMonths: basePass.pendingRenewalMonths || undefined,
    });

    // Update subscription settings bookkeeping + flip the PENDING_PAYMENT history row
    const settings = await SubscriptionSettings.findOne({ userId: basePass.passengerId });
    if (settings) {
        if (!alreadyApplied) {
            const appliedSession = sessionId || basePass.gatewaySessionId;
            // Flip the most recent matching PENDING_PAYMENT row to SUCCESS.
            const pendingRow = [...settings.renewalHistory]
                .reverse()
                .find(
                    (h) =>
                        h.status === "PENDING_PAYMENT" &&
                        (!appliedSession || !h.gatewaySessionId || h.gatewaySessionId === appliedSession)
                );
            if (pendingRow) {
                pendingRow.status = "SUCCESS";
            } else {
                settings.renewalHistory.push({
                    date: new Date(),
                    status: "SUCCESS",
                    amount: pricing?.amount ?? basePass.totalAmount,
                    paymentMethod: "SAME_CARD",
                });
            }
            settings.linkedPassId = basePass._id;
            settings.lastRenewalDate = new Date();
            settings.nextRenewalDate = settings.autoRenewal ? newEndDate : null;
            settings.currentRenewalAttempts = 0;
            settings.pendingRenewalSessionId = null;
            await settings.save();

            await sendRenewalSuccessEmail(settings, basePass);

            // Real-time notify the commuter that their pass was renewed/extended.
            createNotification({
                userId: basePass.passengerId,
                type: "PASS_ACTIVATED",
                title: "Pass Renewed!",
                message: `Your monthly pass has been renewed and is now valid until ${new Date(newEndDate).toLocaleDateString()}.`,
                data: {
                    passId: basePass._id,
                    routeId: basePass.routeId,
                    endDate: newEndDate,
                    renewal: true,
                },
            }).catch((e) =>
                console.error("[v0] Renewal activation notification failed:", e?.message)
            );
        }
    }

    return basePass;
};

// ----------------------------------------------------------------------------
// Cash renewal: commuter requests, admin confirms
// ----------------------------------------------------------------------------

const createCashRenewalRequest = async (req, res, settings, basePass, renewalMonths) => {
    if (settings.pendingCashRenewal?.requested) {
        return res.status(400).json({
            success: false,
            message: "You already have a pending cash renewal awaiting admin confirmation.",
            data: { pendingCashRenewal: settings.pendingCashRenewal },
        });
    }

    const pricing = computeRenewalPricing(basePass, renewalMonths);

    settings.pendingCashRenewal = {
        requested: true,
        passId: basePass._id,
        amount: pricing.amount,
        currency: basePass.currency || "AED",
        renewalMonths: pricing.months,
        requestedAt: new Date(),
    };
    settings.renewalHistory.push({
        date: new Date(),
        status: "PENDING",
        amount: pricing.amount,
        paymentMethod: "CASH",
        failureReason: "Awaiting admin cash confirmation",
    });
    await settings.save();

    await sendCashRequestEmail(settings, basePass);

    return res.status(200).json({
        success: true,
        message: `Cash renewal for ${pricing.months} month${pricing.months > 1 ? "s" : ""} requested. Please pay the admin; your pass activates once the admin confirms.`,
        data: { pendingCashRenewal: settings.pendingCashRenewal, pass: basePass },
    });
};

// Explicit endpoint for the commuter "Renew with cash" button
export const requestCashRenewal = async (req, res) => {
    try {
        const userId = req.userId;
        let settings = await SubscriptionSettings.findOne({ userId });
        if (!settings) settings = new SubscriptionSettings({ userId });

        const basePass = await resolveBasePassForRenewal(userId, req.body.passId);

        if (!basePass) {
            return res.status(404).json({
                success: false,
                message: "No active or recently expired monthly pass found to renew.",
            });
        }

        // SEAT GUARD: block a cash renewal request when a lapsed pass's vehicle is full.
        const seat = await computePassSeatAvailability(basePass);
        if (seat && !seat.canRenew) {
            return res.status(409).json({
                success: false,
                code: "SEATS_FULL",
                message: buildSeatMessage(seat),
                data: { seatAvailability: seat },
            });
        }

        const requestedMonths = Math.floor(Number(req.body.renewalMonths));
        const renewalMonths = Number.isFinite(requestedMonths) && requestedMonths >= 1
            ? Math.min(requestedMonths, 12)
            : undefined;

        return await createCashRenewalRequest(req, res, settings, basePass, renewalMonths);
    } catch (error) {
        console.error("[v0] Error requesting cash renewal:", error);
        res.status(500).json({
            success: false,
            message: "Error requesting cash renewal",
            error: error.message,
        });
    }
};

// Admin confirms cash was collected -> activate the pass and credit admin wallet
export const confirmCashRenewal = async (req, res) => {
    try {
        const { userId, passId } = req.body;

        const settings = await SubscriptionSettings.findOne({ userId });
        if (!settings || !settings.pendingCashRenewal?.requested) {
            return res.status(404).json({
                success: false,
                message: "No pending cash renewal found for this user.",
            });
        }

        const targetPassId = passId || settings.pendingCashRenewal.passId;
        const basePass = await B2CMonthlyPass.findById(targetPassId);
        if (!basePass) {
            return res.status(404).json({
                success: false,
                message: "Pending renewal pass not found.",
            });
        }

        // Settlement (admin commission + partner earnings) is now performed inside
        // applyRenewalToPass under the idempotency guard so it can never run twice
        // for the same renewal.
        // Extend the existing pass in place by the number of months the commuter
        // requested + append trips to the existing booking.
        const cashRenewalMonths = settings.pendingCashRenewal.renewalMonths || undefined;
        const cashAmount = settings.pendingCashRenewal.amount;
        const { newEndDate } = await applyRenewalToPass(basePass, {
            paymentMethod: "CASH",
            renewalMonths: cashRenewalMonths,
        });

        settings.linkedPassId = basePass._id;
        settings.lastRenewalDate = new Date();
        settings.nextRenewalDate = settings.autoRenewal ? newEndDate : null;
        settings.currentRenewalAttempts = 0;
        settings.pendingCashRenewal = { requested: false, passId: null, amount: 0, currency: "AED", renewalMonths: 1, requestedAt: null };
        settings.renewalHistory.push({
            date: new Date(),
            status: "SUCCESS",
            amount: cashAmount ?? basePass.totalAmount,
            paymentMethod: "CASH",
        });
        await settings.save();

        await sendRenewalSuccessEmail(settings, basePass);

        res.status(200).json({
            success: true,
            message: "Cash renewal confirmed and monthly pass activated.",
            data: { pass: basePass },
        });
    } catch (error) {
        console.error("[v0] Error confirming cash renewal:", error);
        res.status(500).json({
            success: false,
            message: "Error confirming cash renewal",
            error: error.message,
        });
    }
};

// Admin view: all pending cash renewals
export const getPendingCashRenewals = async (req, res) => {
    try {
        const pending = await SubscriptionSettings.find({
            "pendingCashRenewal.requested": true,
        })
            .populate("userId", "fullName email phoneNumber")
            .populate("pendingCashRenewal.passId", "currency");

        // The admin views cash-to-collect in ONE currency of their choosing, but
        // requests can come from different countries (UAE -> AED, Kuwait -> KWD).
        // Convert every native amount into the admin's display currency.
        const displayCurrency = resolveDisplayCurrency(req);

        const data = pending.map((s) => {
            const nativeCurrency =
                s.pendingCashRenewal.currency ||
                s.pendingCashRenewal.passId?.currency ||
                "AED";
            const nativeAmount = s.pendingCashRenewal.amount || 0;
            return {
                userId: s.userId?._id,
                userName: s.userId?.fullName,
                userEmail: s.userId?.email,
                userPhone: s.userId?.phoneNumber,
                passId: s.pendingCashRenewal.passId?._id || s.pendingCashRenewal.passId,
                amount: nativeAmount,
                currency: nativeCurrency,
                displayCurrency,
                displayAmount: convertForDisplay(nativeAmount, nativeCurrency, displayCurrency),
                renewalMonths: s.pendingCashRenewal.renewalMonths || 1,
                requestedAt: s.pendingCashRenewal.requestedAt,
            };
        });

        res.status(200).json({ success: true, data, displayCurrency });
    } catch (error) {
        console.error("[v0] Error fetching pending cash renewals:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching pending cash renewals",
            error: error.message,
        });
    }
};

// ----------------------------------------------------------------------------
// Cron jobs
// ----------------------------------------------------------------------------

export const processRenewals = async (req, res) => {
    const result = { processed: 0, succeeded: 0, failed: 0, pendingPayment: 0, skipped: 0 };
    try {
        console.log("[v0] Processing subscription renewals...");

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dueSubscriptions = await SubscriptionSettings.find({
            autoRenewal: true,
            renewalPaymentMethod: { $in: ["SAME_CARD", "WALLET"] },
            nextRenewalDate: { $gte: today, $lt: tomorrow },
        });

        for (const subscription of dueSubscriptions) {
            result.processed += 1;
            try {
                if (subscription.currentRenewalAttempts >= subscription.maxRenewalAttempts) {
                    result.skipped += 1;
                    continue;
                }

                const basePass = await B2CMonthlyPass.findOne({
                    passengerId: subscription.userId,
                    status: "ACTIVE",
                }).sort({ endDate: -1 });

                if (!basePass) {
                    result.skipped += 1;
                    continue;
                }

                // SEAT GUARD: don't auto-charge a renewal the commuter can't use.
                // (Active passes keep their seat, so canRenew stays true for them.)
                const seat = await computePassSeatAvailability(basePass);
                if (seat && !seat.canRenew) {
                    result.skipped += 1;
                    subscription.renewalHistory.push({
                        date: new Date(),
                        status: "FAILED",
                        amount: basePass.totalAmount,
                        paymentMethod: subscription.renewalPaymentMethod,
                        failureReason: "Vehicle full - no seat available for renewal",
                    });
                    await subscription.save();
                    await sendRenewalFailedEmail(
                        subscription,
                        "The vehicle on your route is currently full, so your pass could not be auto-renewed."
                    ).catch(() => { });
                    continue;
                }

                if (subscription.renewalPaymentMethod === "WALLET") {
                    const outcome = await autoRenewWallet(subscription, basePass);
                    outcome === "SUCCESS" ? result.succeeded++ : result.failed++;
                } else if (subscription.renewalPaymentMethod === "SAME_CARD") {
                    await autoRenewCard(subscription, basePass);
                    result.pendingPayment++;
                }
            } catch (err) {
                result.failed += 1;
                console.error(`[v0] Renewal failed for user ${subscription.userId}:`, err.message);
            }
        }

        console.log("[v0] Renewal run complete:", result);
        if (res) return res.status(200).json({ success: true, data: result });
        return result;
    } catch (error) {
        console.error("[v0] Error processing renewals:", error);
        if (res) return res.status(500).json({ success: false, message: error.message });
        return result;
    }
};

// Auto wallet renewal used by cron (no res object)
const autoRenewWallet = async (subscription, basePass) => {
    const userId = basePass.passengerId;
    const amount = basePass.totalAmount;
    const renewalCurrency = basePass.currency || "AED";
    const wallet = await Wallet.findOne({ userId, currency: renewalCurrency });

    if (!wallet || (wallet.balance || 0) < amount) {
        subscription.currentRenewalAttempts += 1;
        subscription.renewalHistory.push({
            date: new Date(),
            status: "FAILED",
            amount,
            paymentMethod: "WALLET",
            failureReason: "Insufficient wallet balance",
        });
        await subscription.save();
        await sendRenewalFailedEmail(subscription, "Insufficient wallet balance");
        return "FAILED";
    }

    const balanceBefore = wallet.balance;
    wallet.balance -= amount;
    wallet.transactions.push({
        type: "EMI_PAYMENT",
        amount,
        description: `Auto monthly pass renewal (wallet) - pass ${basePass._id}`,
        reference: basePass._id.toString(),
        status: "COMPLETED",
    });
    await wallet.save();

    await Transaction.create({
        walletId: wallet._id,
        userId,
        type: "DEBIT",
        category: "BOOKING_PAYMENT",
        amount,
        currency: basePass.currency || "AED",
        balanceBefore,
        balanceAfter: wallet.balance,
        referenceId: basePass._id,
        description: `Auto monthly pass renewal (wallet) - pass ${basePass._id}`,
        metadata: { monthlyPassId: basePass._id, type: "AUTO_RENEWAL" },
    });

    const { newEndDate } = await applyRenewalToPass(basePass, { paymentMethod: "WALLET" });

    subscription.linkedPassId = basePass._id;
    subscription.lastRenewalDate = new Date();
    subscription.nextRenewalDate = newEndDate;
    subscription.currentRenewalAttempts = 0;
    subscription.renewalHistory.push({
        date: new Date(),
        status: "SUCCESS",
        amount,
        paymentMethod: "WALLET",
    });
    await subscription.save();
    await sendRenewalSuccessEmail(subscription, basePass);
    return "SUCCESS";
};

// Auto card renewal used by cron -> creates a payment session + emails the link.
// The pass is extended in place only after payment is confirmed.
const autoRenewCard = async (subscription, basePass) => {
    const userId = basePass.passengerId;
    const amount = basePass.totalAmount;
    const currency = basePass.currency || "AED";

    try {
        const passenger = await User.findById(userId);
        const session = await PaymentGatewayService.createPaymentSession({
            gateway: "STRIPE",
            amount,
            currency,
            customer: {
                email: passenger?.email,
                name: passenger?.fullName || `${passenger?.firstName || ""} ${passenger?.lastName || ""}`.trim(),
                phone: passenger?.phoneNumber || passenger?.whatsappNumber,
            },
            contractId: basePass._id,
            redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/payment-success`,
            webhookUrl: `${process.env.BACKEND_URL}/api/webhook/payment`,
            metadata: {
                passengerId: userId.toString(),
                routeId: basePass.routeId.toString(),
                passType: basePass.passType,
                renewal: "true",
                auto: "true",
            },
        });

        basePass.gatewaySessionId = session.sessionId;
        basePass.paymentGateway = session.provider;
        await basePass.save();

        subscription.linkedPassId = basePass._id;
        subscription.pendingRenewalSessionId = session.sessionId;
        subscription.renewalHistory.push({
            date: new Date(),
            status: "PENDING_PAYMENT",
            amount,
            paymentMethod: "SAME_CARD",
            gatewaySessionId: session.sessionId,
        });
        await subscription.save();

        await sendCardRenewalLinkEmail(subscription, basePass, session.paymentUrl);
    } catch (paymentError) {
        subscription.currentRenewalAttempts += 1;
        subscription.renewalHistory.push({
            date: new Date(),
            status: "FAILED",
            amount,
            paymentMethod: "SAME_CARD",
            failureReason: paymentError.message,
        });
        await subscription.save();
        await sendRenewalFailedEmail(subscription, paymentError.message);
    }
};

export const sendRenewalReminders = async (req, res) => {
    let sent = 0;
    try {
        console.log("[v0] Sending renewal reminders...");

        const subscriptions = await SubscriptionSettings.find({
            autoRenewal: true,
            nextRenewalDate: { $ne: null },
        });

        const now = new Date();
        for (const subscription of subscriptions) {
            try {
                const days = Math.ceil(
                    (new Date(subscription.nextRenewalDate) - now) / (1000 * 60 * 60 * 24)
                );
                if (days === subscription.renewalReminderDays) {
                    await sendRenewalReminderEmail(subscription, days);
                    sent += 1;
                }
            } catch (err) {
                console.error(`[v0] Reminder failed for user ${subscription.userId}:`, err.message);
            }
        }

        console.log(`[v0] Sent ${sent} renewal reminders`);
        if (res) return res.status(200).json({ success: true, data: { sent } });
        return sent;
    } catch (error) {
        console.error("[v0] Error sending renewal reminders:", error);
        if (res) return res.status(500).json({ success: false, message: error.message });
        return sent;
    }
};

// ----------------------------------------------------------------------------
// Email helpers
// ----------------------------------------------------------------------------

const safeSendEmail = async (userId, allowed, subject, html) => {
    try {
        if (!allowed) return;
        const user = await User.findById(userId);
        if (user?.email) {
            await sendEmail(user.email, subject, html);
        }
    } catch (err) {
        console.error("[v0] Email send error:", err.message);
    }
};

const sendRenewalReminderEmail = async (subscription, daysLeft) => {
    const html = `<p>Your DriveMego monthly pass renews in <strong>${daysLeft} day(s)</strong> on ${new Date(
        subscription.nextRenewalDate
    ).toDateString()} via ${subscription.renewalPaymentMethod.replace("_", " ")}.</p>`;
    await safeSendEmail(
        subscription.userId,
        subscription.emailNotifications?.renewalReminder,
        "Monthly Pass Renewal Reminder",
        html
    );
};

const sendRenewalSuccessEmail = async (subscription, newPass) => {
    const html = `<p>Your monthly pass has been renewed successfully. Valid until <strong>${new Date(
        newPass.endDate
    ).toDateString()}</strong>. Amount: ${newPass.currency} ${newPass.totalAmount}.</p>`;
    await safeSendEmail(
        subscription.userId,
        subscription.emailNotifications?.renewalSuccess,
        "Monthly Pass Renewed Successfully",
        html
    );
};

const sendRenewalFailedEmail = async (subscription, reason) => {
    const html = `<p>We couldn't renew your monthly pass automatically. Reason: ${reason}. Please update your payment method or top up your wallet.</p>`;
    await safeSendEmail(
        subscription.userId,
        subscription.emailNotifications?.renewalFailed,
        "Monthly Pass Renewal Failed",
        html
    );
};

const sendCardRenewalLinkEmail = async (subscription, newPass, paymentUrl) => {
    const html = `<p>Your monthly pass is due for renewal. Please complete payment of ${newPass.currency} ${newPass.totalAmount} using the secure link below:</p><p><a href="${paymentUrl}">Pay & Renew Now</a></p>`;
    await safeSendEmail(
        subscription.userId,
        subscription.emailNotifications?.renewalReminder,
        "Action Required: Renew Your Monthly Pass",
        html
    );
};

const sendCashRequestEmail = async (subscription, newPass) => {
    const html = `<p>Your cash renewal request has been received. Please pay ${newPass.currency} ${newPass.totalAmount} to the admin. Your pass activates once the admin confirms the payment.</p>`;
    await safeSendEmail(
        subscription.userId,
        subscription.emailNotifications?.renewalReminder,
        "Cash Renewal Requested",
        html
    );
};

const sendCancellationEmail = async (userId, reason) => {
    const html = `<p>Your subscription auto-renewal has been cancelled. Reason: ${reason || "Not specified"}.</p>`;
    await safeSendEmail(userId, true, "Subscription Cancelled", html);
};
