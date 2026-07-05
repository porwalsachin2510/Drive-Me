import Trip from "../models/Trip.js"
import Complaint from "../models/Complaint.js"

/**
 * managedSlaService
 * -----------------
 * Computes real SLA / performance metrics for a MANAGED-service contract from
 * live operational data:
 *   - On-time %            -> from Trip late-start tracking
 *   - Vehicle availability -> from the contract's assigned vehicles
 *   - Complaint resolution -> from the Complaint collection
 *
 * It also compares each metric against the contract's SLA targets to detect
 * breaches and compute a penalty amount against a given monthly bill base.
 */

const DEFAULT_SLA = {
    enabled: false,
    onTimeTargetPct: 95,
    vehicleAvailabilityTargetPct: 98,
    complaintResolutionHours: 24,
    lateThresholdMinutes: 10,
    penalty: {
        onTimePerPointPct: 1,
        availabilityPerPointPct: 1,
        perLateComplaint: 0,
        maxPenaltyPct: 25,
    },
}

const round = (n, d = 1) => {
    const f = Math.pow(10, d)
    return Math.round((Number(n) || 0) * f) / f
}

// Normalise the mixed-case status enum used across the Trip model.
const isCompleted = (s) => ["COMPLETED", "Completed"].includes(s)
const isCancelled = (s) => ["CANCELLED", "Cancelled"].includes(s)

/**
 * Compute vehicle availability from the contract's assigned vehicles. A vehicle
 * slot is "available" when its assignment status is ACTIVE (not MAINTENANCE /
 * INACTIVE). Returns { total, available, availabilityPct }.
 */
export const computeVehicleAvailability = (contract) => {
    let total = 0
    let available = 0
    for (const group of contract.vehicles || []) {
        for (const av of group.assignedVehicles || []) {
            total++
            if ((av.status || "ACTIVE") === "ACTIVE") available++
        }
    }
    const availabilityPct = total === 0 ? null : round((available / total) * 100)
    return { total, available, availabilityPct }
}

/**
 * Compute trip on-time performance for the contract within [start, end].
 * A trip is counted once it has run (COMPLETED / IN_PROGRESS with a start), and
 * is "late" when isLateStart is set or its late minutes exceed the threshold.
 */
export const computeTripPerformance = async (contract, { start, end }, sla) => {
    const lateThreshold = sla.lateThresholdMinutes ?? DEFAULT_SLA.lateThresholdMinutes

    const trips = await Trip.find({
        contractId: contract._id,
        tripDate: { $gte: start, $lte: end },
    }).select("status isLateStart lateStartMinutes tripDate")

    let totalTrips = trips.length
    let completedTrips = 0
    let cancelledTrips = 0
    let lateTrips = 0

    for (const t of trips) {
        if (isCompleted(t.status)) {
            completedTrips++
            const isLate = t.isLateStart || (t.lateStartMinutes || 0) > lateThreshold
            if (isLate) lateTrips++
        } else if (isCancelled(t.status)) {
            cancelledTrips++
        }
    }

    const onTimeTrips = Math.max(completedTrips - lateTrips, 0)
    const onTimePct = completedTrips === 0 ? null : round((onTimeTrips / completedTrips) * 100)

    return { totalTrips, completedTrips, cancelledTrips, lateTrips, onTimeTrips, onTimePct }
}

/**
 * Aggregate complaint metrics for the contract within [start, end].
 */
export const computeComplaintPerformance = async (contract, { start, end }) => {
    const complaints = await Complaint.find({
        contractId: contract._id,
        createdAt: { $gte: start, $lte: end },
    }).select("status resolutionHours breachedSla createdAt resolvedAt")

    const total = complaints.length
    let open = 0
    let resolved = 0
    let breached = 0
    let resolutionHoursSum = 0
    let resolutionCount = 0

    for (const c of complaints) {
        if (c.status === "RESOLVED" || c.status === "CLOSED") {
            resolved++
            if (typeof c.resolutionHours === "number") {
                resolutionHoursSum += c.resolutionHours
                resolutionCount++
            }
            if (c.breachedSla) breached++
        } else {
            open++
        }
    }

    const avgResolutionHours = resolutionCount === 0 ? null : round(resolutionHoursSum / resolutionCount)
    return { total, open, resolved, breached, avgResolutionHours }
}

/**
 * Full SLA performance report for a contract over a period, including breach
 * detection versus targets. Pure aggregation — no writes.
 */
export const computeSlaPerformance = async (contract, { start, end }) => {
    const sla = { ...DEFAULT_SLA, ...(contract.sla?.toObject?.() || contract.sla || {}) }
    sla.penalty = { ...DEFAULT_SLA.penalty, ...(contract.sla?.penalty || {}) }

    const trip = await computeTripPerformance(contract, { start, end }, sla)
    const availability = computeVehicleAvailability(contract)
    const complaints = await computeComplaintPerformance(contract, { start, end })

    const breaches = []

    if (trip.onTimePct !== null && trip.onTimePct < sla.onTimeTargetPct) {
        breaches.push({
            metric: "ON_TIME",
            label: "On-time performance",
            target: sla.onTimeTargetPct,
            actual: trip.onTimePct,
            shortfall: round(sla.onTimeTargetPct - trip.onTimePct),
            unit: "%",
        })
    }
    if (availability.availabilityPct !== null && availability.availabilityPct < sla.vehicleAvailabilityTargetPct) {
        breaches.push({
            metric: "AVAILABILITY",
            label: "Vehicle availability",
            target: sla.vehicleAvailabilityTargetPct,
            actual: availability.availabilityPct,
            shortfall: round(sla.vehicleAvailabilityTargetPct - availability.availabilityPct),
            unit: "%",
        })
    }
    if (complaints.avgResolutionHours !== null && complaints.avgResolutionHours > sla.complaintResolutionHours) {
        breaches.push({
            metric: "COMPLAINT_RESOLUTION",
            label: "Complaint resolution time",
            target: sla.complaintResolutionHours,
            actual: complaints.avgResolutionHours,
            shortfall: round(complaints.avgResolutionHours - sla.complaintResolutionHours),
            unit: "hrs",
        })
    }
    if (complaints.breached > 0) {
        breaches.push({
            metric: "COMPLAINT_BREACH_COUNT",
            label: "Complaints resolved late",
            target: 0,
            actual: complaints.breached,
            shortfall: complaints.breached,
            unit: "count",
        })
    }

    // Overall health score: average of the ratios of actual/target for the
    // available percentage metrics, clamped to 100.
    const scoreParts = []
    if (trip.onTimePct !== null) scoreParts.push(Math.min(trip.onTimePct / (sla.onTimeTargetPct || 100), 1) * 100)
    if (availability.availabilityPct !== null)
        scoreParts.push(Math.min(availability.availabilityPct / (sla.vehicleAvailabilityTargetPct || 100), 1) * 100)
    const healthScore = scoreParts.length ? round(scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length) : null

    return {
        period: { start, end },
        sla,
        trip,
        availability,
        complaints,
        breaches,
        healthScore,
        compliant: breaches.length === 0,
    }
}

/**
 * Compute the SLA penalty amount against a monthly operational bill base.
 * - On-time / availability shortfalls: `perPointPct` % of the base per point.
 * - Late complaints: flat `perLateComplaint` each.
 * Total is capped at `maxPenaltyPct` % of the base.
 * Returns { amount, breakdown[] }.
 */
export const computeSlaPenalty = (performance, monthlyBase) => {
    const base = Number(monthlyBase) || 0
    const p = performance.sla.penalty || DEFAULT_SLA.penalty
    const breakdown = []
    let amount = 0

    for (const b of performance.breaches) {
        if (b.metric === "ON_TIME" && p.onTimePerPointPct > 0) {
            const amt = round((base * p.onTimePerPointPct * b.shortfall) / 100, 2)
            amount += amt
            breakdown.push({ reason: `On-time ${b.shortfall}% below target`, amount: amt })
        } else if (b.metric === "AVAILABILITY" && p.availabilityPerPointPct > 0) {
            const amt = round((base * p.availabilityPerPointPct * b.shortfall) / 100, 2)
            amount += amt
            breakdown.push({ reason: `Availability ${b.shortfall}% below target`, amount: amt })
        } else if (b.metric === "COMPLAINT_BREACH_COUNT" && p.perLateComplaint > 0) {
            const amt = round(p.perLateComplaint * b.actual, 2)
            amount += amt
            breakdown.push({ reason: `${b.actual} complaint(s) resolved late`, amount: amt })
        }
    }

    const cap = round((base * (p.maxPenaltyPct ?? 25)) / 100, 2)
    let capped = false
    if (amount > cap) {
        amount = cap
        capped = true
    }

    return { amount: round(amount, 2), cap, capped, breakdown }
}

export default { computeSlaPerformance, computeSlaPenalty, computeVehicleAvailability }
