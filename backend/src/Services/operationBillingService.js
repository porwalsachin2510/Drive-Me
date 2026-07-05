import Trip from "../models/Trip.js"
import Invoice from "../models/Invoice.js"
import Contract from "../models/Contract.js"
import User from "../models/User.js"
import { computeSlaPerformance, computeSlaPenalty } from "./managedSlaService.js"

/**
 * operationBillingService
 * -----------------------
 * Operation-based billing for MANAGED-service contracts. Instead of a single
 * fixed serviceCharge, the monthly bill is derived from REAL operations for the
 * month (per-trip / per-seat / per-km / fixed) + a management fee, minus any
 * SLA penalty. A monthly Invoice (type OPERATIONAL) is generated idempotently.
 */

const round = (n, d = 2) => {
    const f = Math.pow(10, d)
    return Math.round((Number(n) || 0) * f) / f
}

const isCompleted = (s) => ["COMPLETED", "Completed"].includes(s)
const isConfirmed = (s) => ["CONFIRMED", "Confirmed"].includes(s)

// Month boundaries. month is 1-12.
export const monthRange = (year, month) => {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const end = new Date(year, month, 0, 23, 59, 59, 999)
    return { start, end }
}

const monthLabel = (year, month) => {
    const d = new Date(year, month - 1, 1)
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

/**
 * Aggregate billable operational usage for a contract in a month:
 *   - trips     : number of completed trips
 *   - seats     : total occupied seats across completed trips
 *   - distanceKm: total distance across completed trips
 */
export const aggregateUsage = async (contract, { start, end }) => {
    const trips = await Trip.find({
        contractId: contract._id,
        tripDate: { $gte: start, $lte: end },
    }).select("status bookedSeats totalDistance passengers")

    let tripCount = 0
    let seats = 0
    let distanceKm = 0

    for (const t of trips) {
        if (!isCompleted(t.status)) continue
        tripCount++
        // Prefer bookedSeats; fall back to counting confirmed passengers.
        let tripSeats = t.bookedSeats || 0
        if (!tripSeats && Array.isArray(t.passengers)) {
            tripSeats = t.passengers.filter(
                (p) => isConfirmed(p.status) || isConfirmed(p.bookingStatus)
            ).length
        }
        seats += tripSeats
        distanceKm += t.totalDistance || 0
    }

    return { trips: tripCount, seats, distanceKm: round(distanceKm, 1) }
}

/**
 * Compute the operational cost (before management fee / tax / penalty) for the
 * given usage and billing configuration. Returns { operationalAmount, unitLabel }.
 */
export const computeOperationalAmount = (billing, usage) => {
    switch (billing.model) {
        case "PER_SEAT":
            return {
                operationalAmount: round(usage.seats * (billing.ratePerSeat || 0)),
                unitLabel: `${usage.seats} seat-trips \u00d7 ${billing.ratePerSeat || 0}`,
                description: "Seat-based operations",
            }
        case "PER_KM":
            return {
                operationalAmount: round(usage.distanceKm * (billing.ratePerKm || 0)),
                unitLabel: `${usage.distanceKm} km \u00d7 ${billing.ratePerKm || 0}`,
                description: "Distance-based operations",
            }
        case "FIXED_MONTHLY":
            return {
                operationalAmount: round(billing.fixedMonthlyAmount || 0),
                unitLabel: "Fixed monthly operations",
                description: "Fixed monthly operations",
            }
        case "PER_TRIP":
        default:
            return {
                operationalAmount: round(usage.trips * (billing.ratePerTrip || 0)),
                unitLabel: `${usage.trips} trips \u00d7 ${billing.ratePerTrip || 0}`,
                description: "Trip-based operations",
            }
    }
}

/**
 * Build a full monthly operational bill breakdown (no DB writes). Used both for
 * the live preview and as the source of truth for invoice generation.
 */
export const buildMonthlyBill = async (contract, year, month) => {
    const billing = contract.operationBilling?.toObject?.() || contract.operationBilling || {}
    const currency = contract.financials?.currency || "AED"
    const { start, end } = monthRange(year, month)

    const usage = await aggregateUsage(contract, { start, end })
    const { operationalAmount, unitLabel, description } = computeOperationalAmount(billing, usage)

    // Management fee
    let managementFee = 0
    if (billing.managementFeeType === "FLAT") {
        managementFee = round(billing.managementFeeValue || 0)
    } else {
        managementFee = round((operationalAmount * (billing.managementFeeValue || 0)) / 100)
    }

    const preTaxBeforePenalty = round(operationalAmount + managementFee)

    // SLA penalty against the operational bill base (operational + mgmt fee).
    const performance = await computeSlaPerformance(contract, { start, end })
    const penalty = computeSlaPenalty(performance, preTaxBeforePenalty)

    const subtotal = round(Math.max(preTaxBeforePenalty - penalty.amount, 0))
    const taxRate = billing.taxRatePct || 0
    const taxAmount = round((subtotal * taxRate) / 100)
    const total = round(subtotal + taxAmount)

    const lineItems = [
        {
            description: `${description} (${monthLabel(year, month)}) - ${unitLabel}`,
            quantity: 1,
            unitPrice: operationalAmount,
            amount: operationalAmount,
        },
    ]
    if (managementFee > 0) {
        lineItems.push({
            description:
                billing.managementFeeType === "FLAT"
                    ? "Management fee"
                    : `Management fee (${billing.managementFeeValue || 0}%)`,
            quantity: 1,
            unitPrice: managementFee,
            amount: managementFee,
        })
    }
    if (penalty.amount > 0) {
        lineItems.push({
            description: `SLA penalty${penalty.capped ? " (capped)" : ""}`,
            quantity: 1,
            unitPrice: -penalty.amount,
            amount: -penalty.amount,
        })
    }

    return {
        year,
        month,
        period: { start, end, label: monthLabel(year, month) },
        currency,
        billingModel: billing.model || "PER_TRIP",
        usage,
        operationalAmount,
        managementFee,
        penalty,
        performance,
        lineItems,
        subtotal,
        taxRate,
        taxAmount,
        total,
    }
}

/**
 * Generate (or refresh, if not yet paid) the OPERATIONAL invoice for a contract
 * and month. Idempotent via a stable sourceKey. Returns the Invoice document.
 */
export const generateMonthlyOperationalInvoice = async (contract, year, month) => {
    // Ensure related party names are available.
    let corporate = contract.corporateOwnerId
    let fleet = contract.fleetOwnerId
    if (!corporate?.companyName && !corporate?.fullName) {
        corporate = await User.findById(corporate?._id || corporate).select("fullName companyName")
    }
    if (!fleet?.companyName && !fleet?.fullName) {
        fleet = await User.findById(fleet?._id || fleet).select("fullName companyName")
    }

    const bill = await buildMonthlyBill(contract, year, month)
    const baseNumber = contract.contractNumber || contract._id.toString().slice(-6)
    const period = `${year}-${String(month).padStart(2, "0")}`
    const sourceKey = `${contract._id}:OPERATIONAL:${period}`

    const dueDay = contract.operationBilling?.billingDay || 7
    const dueDate = new Date(year, month, dueDay, 23, 59, 59)

    let invoice = await Invoice.findOne({ sourceKey })
    const corporateOwnerId = corporate?._id || contract.corporateOwnerId
    const fleetOwnerId = fleet?._id || contract.fleetOwnerId

    if (!invoice) {
        invoice = new Invoice({
            invoiceNumber: `B2B-INV-${baseNumber}-OPS-${period}`,
            sourceKey,
            contractId: contract._id,
            contractNumber: contract.contractNumber,
            fleetOwnerId,
            fleetOwnerName: fleet?.companyName || fleet?.fullName || "Fleet Partner",
            corporateOwnerId,
            corporateName: corporate?.companyName || corporate?.fullName || "Corporate Client",
            type: "OPERATIONAL",
            billingModel: bill.billingModel,
            billingPeriod: { start: bill.period.start, end: bill.period.end, label: bill.period.label },
            issueDate: new Date(),
            dueDate,
            lineItems: bill.lineItems,
            taxRate: bill.taxRate,
            currency: bill.currency,
            status: "PENDING",
            usage: {
                trips: bill.usage.trips,
                seats: bill.usage.seats,
                distanceKm: bill.usage.distanceKm,
                operationalAmount: bill.operationalAmount,
                managementFee: bill.managementFee,
                slaPenalty: bill.penalty.amount,
            },
        })
    } else if (invoice.status !== "PAID") {
        // Refresh unpaid invoices with the latest operational data.
        invoice.lineItems = bill.lineItems
        invoice.taxRate = bill.taxRate
        invoice.dueDate = dueDate
        invoice.billingModel = bill.billingModel
        invoice.usage = {
            trips: bill.usage.trips,
            seats: bill.usage.seats,
            distanceKm: bill.usage.distanceKm,
            operationalAmount: bill.operationalAmount,
            managementFee: bill.managementFee,
            slaPenalty: bill.penalty.amount,
        }
        if (invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== "DRAFT") {
            invoice.status = "OVERDUE"
        }
    }

    await invoice.save()
    return invoice
}

export default { buildMonthlyBill, generateMonthlyOperationalInvoice, aggregateUsage }
