import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js";
import B2CMonthlyPass from "../models/B2CMonthlyPass.js";

// A monthly pass reserves ONE seat on a specific trip-leg for the ENTIRE pass
// period. Therefore the live availability of a trip-leg is NOT derived from a
// single day's generated trip row (those get regenerated/overwritten per date),
// but from how many *active* monthly passes currently occupy that leg.
//
// This service computes that authoritative availability once and is shared by:
//   • the commuter Booking Modal (per trip-leg "N seats available")
//   • the Find Routes tab (route-level seats remaining)
//   • the partner seat-availability endpoints
//
// Trip-leg keys match the frontend exactly: `${time}_${direction}` where
// direction is "outbound" or "return".

const ACTIVE_PASS_STATUSES = ["ACTIVE", "active", "Active"];

// Build the canonical list of trip-legs from a route's schedules. Mirrors how
// the Booking Modal expands schedule tripTimes into selectable trips:
//   • Round Trip  -> outbound leg (departureTime) + return leg (arrivalTime)
//   • One Way     -> single leg using the trip's own direction
const buildLegs = (schedules, capForTripTime) => {
    const legs = [];
    for (const sch of schedules) {
        for (const tt of sch.tripTimes || []) {
            const cap = capForTripTime(sch, tt);
            if (tt.tripType === "Round Trip") {
                if (tt.departureTime) {
                    legs.push({ key: `${tt.departureTime}_outbound`, time: tt.departureTime, direction: "outbound", tripType: "Round Trip", cap });
                }
                if (tt.arrivalTime) {
                    legs.push({ key: `${tt.arrivalTime}_return`, time: tt.arrivalTime, direction: "return", tripType: "Round Trip", cap });
                }
            } else if (tt.departureTime) {
                const direction = tt.direction === "return" ? "return" : "outbound";
                legs.push({ key: `${tt.departureTime}_${direction}`, time: tt.departureTime, direction, tripType: "One Way", cap });
            }
        }
    }
    return legs;
};

// Find the leg a pass time belongs to. When two legs share the same time we
// disambiguate using the preferred direction (round-trip outbound vs return).
const matchLeg = (legs, time, preferredDirection) => {
    if (!time) return null;
    const candidates = legs.filter((l) => l.time === time);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    return candidates.find((l) => l.direction === preferredDirection) || candidates[0];
};

/**
 * Compute live seat availability for a B2C route.
 * @param {string|object} routeOrId - route document or its id
 * @returns {Promise<{seatAvailability: object, routeAvailableSeats: number, routeTotalSeats: number, isFull: boolean}>}
 */
export const computeRouteSeatAvailability = async (routeOrId) => {
    const route = routeOrId && routeOrId._id
        ? routeOrId
        : await B2CPartnerRoute.findById(routeOrId);

    if (!route) {
        return { seatAvailability: {}, routeAvailableSeats: 0, routeTotalSeats: 0, isFull: true, legs: [] };
    }

    const schedules = await B2CPartnerSchedule.find({ routeId: route._id });

    // Batch-load every vehicle referenced by a trip / schedule / route so each
    // leg can use the seating capacity of ITS OWN assigned vehicle (different
    // trips on the same route may run different vehicles).
    const vehicleIds = new Set();
    for (const sch of schedules) {
        if (sch.assignedVehicle) vehicleIds.add(sch.assignedVehicle.toString());
        for (const tt of sch.tripTimes || []) {
            if (tt.assignedVehicle) vehicleIds.add(tt.assignedVehicle.toString());
        }
    }
    if (route.assignedVehicle) vehicleIds.add(route.assignedVehicle.toString());

    const vehicles = vehicleIds.size > 0
        ? await B2CPartnerVehicle.find({ _id: { $in: Array.from(vehicleIds) } }).select("seatingCapacity")
        : [];
    const capMap = {};
    vehicles.forEach((v) => { capMap[v._id.toString()] = v.seatingCapacity; });

    const routeDefaultCap =
        (route.assignedVehicle && capMap[route.assignedVehicle.toString()]) ||
        route.totalSeats || 0;

    const capForTripTime = (sch, tt) =>
        (tt.assignedVehicle && capMap[tt.assignedVehicle.toString()]) ||
        (sch.assignedVehicle && capMap[sch.assignedVehicle.toString()]) ||
        routeDefaultCap;

    const legs = buildLegs(schedules, capForTripTime);

    // All active monthly passes currently holding a seat on this route.
    //
    // A pass only reserves a seat once it is actually paid for:
    //   • CASH   -> pay-on-board, the seat is held the moment the booking is made
    //   • WALLET -> debited immediately at creation (paymentStatus "PAID")
    //   • STRIPE/TAP/CARD -> the pass is created "ACTIVE" but "PENDING" and only
    //     becomes "PAID" via the payment webhook. An unpaid (PENDING) or FAILED
    //     online pass must NOT occupy a seat, otherwise a checkout that was never
    //     completed (e.g. missing Tap keys -> 401) permanently eats a seat and the
    //     trip shows "3 seats available" on a 5-seat vehicle.
    const activePasses = await B2CMonthlyPass.find({
        routeId: route._id,
        status: { $in: ACTIVE_PASS_STATUSES },
        endDate: { $gte: new Date() },
        $nor: [
            {
                paymentMethod: { $in: ["STRIPE", "TAP", "CARD"] },
                paymentStatus: { $ne: "PAID" },
            },
        ],
    }).select("passType outboundTripTime returnTripTime");

    // Tally how many active passes occupy each leg.
    const occupancy = {};
    const addOcc = (leg) => {
        if (!leg) return;
        occupancy[leg.key] = (occupancy[leg.key] || 0) + 1;
    };

    for (const pass of activePasses) {
        // The outbound journey: round-trip outbound uses the departure leg,
        // one-way uses whichever leg the commuter selected.
        addOcc(matchLeg(legs, pass.outboundTripTime, "outbound"));
        // The return journey only exists for round-trip passes and is keyed by
        // the trip's arrival (return-departure) time.
        if (pass.passType === "ROUND_TRIP" && pass.returnTripTime) {
            addOcc(matchLeg(legs, pass.returnTripTime, "return"));
        }
    }

    const seatAvailability = {};
    let routeAvailableSeats = 0;
    let routeTotalSeats = 0;

    for (const leg of legs) {
        const booked = occupancy[leg.key] || 0;
        const available = Math.max(0, leg.cap - booked);
        // If several tripTimes map to the same key, keep the most constrained.
        const existing = seatAvailability[leg.key];
        if (!existing || available < existing.availableSeats) {
            seatAvailability[leg.key] = {
                availableSeats: available,
                totalSeats: leg.cap,
                bookedSeats: booked,
                status: available > 0 ? "Available" : "Full",
            };
        }
        routeAvailableSeats = Math.max(routeAvailableSeats, available);
        routeTotalSeats = Math.max(routeTotalSeats, leg.cap);
    }

    // Route has schedules but no usable trip-times (or no schedules at all):
    // fall back to the route's own capacity minus all active passes.
    if (legs.length === 0) {
        routeTotalSeats = routeDefaultCap || route.totalSeats || 0;
        routeAvailableSeats = Math.max(0, routeTotalSeats - activePasses.length);
    }

    return {
        seatAvailability,
        routeAvailableSeats,
        routeTotalSeats,
        isFull: routeAvailableSeats <= 0,
        // Expose the canonical leg list so callers (e.g. subscription renewal)
        // can resolve the exact leg(s) a specific pass occupies.
        legs,
    };
};

// A paid online pass (STRIPE/TAP/CARD) only occupies a seat once its payment
// status flips to PAID; wallet/cash passes hold their seat immediately.
const passIsPaidAndHoldingSeat = (pass) => {
    const onlineUnpaid =
        ["STRIPE", "TAP", "CARD"].includes(pass.paymentMethod) &&
        pass.paymentStatus !== "PAID";
    if (onlineUnpaid) return false;
    const activeStatus = ACTIVE_PASS_STATUSES.includes(pass.status);
    const notExpired = new Date(pass.endDate) >= new Date();
    return activeStatus && notExpired;
};

/**
 * Compute seat availability for the specific trip-leg(s) a monthly pass occupies.
 *
 * This is the authoritative check used by the subscription renewal flow to tell a
 * commuter — BEFORE they pay — whether they will actually get a seat when they
 * renew. Key nuance: a pass that is still ACTIVE (not yet expired) already holds
 * its seat, so its renewal simply extends that seat in place and can never be
 * blocked by a full vehicle. Only a pass that has LAPSED (expired / cancelled)
 * must re-acquire a seat, and therefore can be blocked when the leg is full.
 *
 * @param {string|object} passOrId - a B2CMonthlyPass document or its id
 * @returns {Promise<null|{
 *   passId: string, routeLabel: string, holdsSeat: boolean, canRenew: boolean,
 *   legs: Array<{direction:string,time:string,availableSeats:number,totalSeats:number,bookedSeats:number,isFull:boolean}>,
 *   availableSeats: number, totalSeats: number, isFull: boolean
 * }>}
 */
export const computePassSeatAvailability = async (passOrId) => {
    const pass = passOrId && passOrId._id
        ? passOrId
        : await B2CMonthlyPass.findById(passOrId);
    if (!pass) return null;

    const route = await B2CPartnerRoute.findById(pass.routeId);
    if (!route) return null;

    const { seatAvailability, legs } = await computeRouteSeatAvailability(route);

    const holdsSeat = passIsPaidAndHoldingSeat(pass);

    // Resolve the leg(s) this pass travels on. Same matching rules as the booking
    // modal: match by time, disambiguating shared times by preferred direction.
    const findLeg = (time, preferredDirection) => {
        if (!time) return null;
        const candidates = legs.filter((l) => l.time === time);
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];
        return candidates.find((l) => l.direction === preferredDirection) || candidates[0];
    };

    const neededLegs = [];
    const outboundLeg = findLeg(pass.outboundTripTime, "outbound");
    if (outboundLeg) neededLegs.push(outboundLeg);
    if (pass.passType === "ROUND_TRIP" && pass.returnTripTime) {
        const returnLeg = findLeg(pass.returnTripTime, "return");
        if (returnLeg) neededLegs.push(returnLeg);
    }

    // Build a per-leg availability report. When a leg cannot be resolved from the
    // schedule we fall back to route-level capacity so we never falsely block.
    const legReports = neededLegs.map((leg) => {
        const info = seatAvailability[leg.key] || {
            availableSeats: leg.cap,
            totalSeats: leg.cap,
            bookedSeats: 0,
        };
        return {
            direction: leg.direction,
            time: leg.time,
            availableSeats: info.availableSeats,
            totalSeats: info.totalSeats,
            bookedSeats: info.bookedSeats,
            isFull: info.availableSeats <= 0,
        };
    });

    // The most constrained leg determines whether the commuter can travel.
    const minAvailable = legReports.length
        ? Math.min(...legReports.map((l) => l.availableSeats))
        : 0;
    const maxTotal = legReports.length
        ? Math.max(...legReports.map((l) => l.totalSeats))
        : (route.totalSeats || 0);

    const anyLegFull = legReports.some((l) => l.isFull);

    // A commuter can renew when they already hold their seat (active pass) OR when
    // every leg they need still has at least one free seat.
    const canRenew = holdsSeat || (legReports.length > 0 ? !anyLegFull : true);

    return {
        passId: String(pass._id),
        routeLabel: `${route.fromLocation} -> ${route.toLocation}`,
        holdsSeat,
        canRenew,
        legs: legReports,
        availableSeats: minAvailable,
        totalSeats: maxTotal,
        isFull: anyLegFull,
    };
};
