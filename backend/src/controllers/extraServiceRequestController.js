import mongoose from "mongoose"
import ExtraServiceRequest from "../models/ExtraServiceRequest.js"
import Contract from "../models/Contract.js"
import Invoice from "../models/Invoice.js"
import Trip from "../models/Trip.js"
import Vehicle from "../models/Vehicle.js"
import Wallet from "../models/Wallet.js"
import User from "../models/User.js"
import { createNotification, sendAdminNotification } from "../Services/notificationService.js"
import { isCustomerRole, isPartnerRole } from "../utils/roleFamilies.js"
import paymentGatewayService, {
    detectCountryFromCurrency,
    getPaymentGateway,
} from "../Services/paymentGatewayService.js"
import crypto from "crypto"

// Normalize the payment method the customer picked in the modal to a canonical
// code. Accepts both the UI labels and the canonical codes so the same handler
// works no matter how the front-end phrases it.
const ESD_METHOD_MAP = {
    CARD: "CARD",
    "CREDIT CARD": "CARD",
    "CREDIT/DEBIT CARD": "CARD",
    WALLET: "WALLET",
    "MOBILE WALLET": "WALLET",
    BANK_TRANSFER: "BANK_TRANSFER",
    "BANK TRANSFER": "BANK_TRANSFER",
    CASH: "CASH",
}
const normalizeEsdMethod = (m) => ESD_METHOD_MAP[String(m || "").trim().toUpperCase()] || null
const ONLINE_ESD_METHODS = ["CARD", "WALLET"]
const MANUAL_ESD_METHODS = ["BANK_TRANSFER", "CASH"]

/**
 * Settle a SEPARATE extra-service charge: credit the partner's wallet with the
 * charge (the platform is the ledger of record, so this runs for every payment
 * method), mark the request + its invoice PAID, and notify both sides. Safe to
 * call more than once — it no-ops if the request is already PAID, so the gateway
 * callback and the webhook can both call it without double-crediting.
 *
 * Exported so the payment callback / gateway webhooks can settle a request once
 * the online payment is confirmed by the gateway.
 */
export const settleExtraServiceRequestPayment = async (
    request,
    { method, provider, transactionId } = {}
) => {
    if (!request) return null
    if (request.paymentStatus === "PAID") return request

    const amount = Math.round((request.charge || 0) * 100) / 100
    const currency = request.currency || "AED"
    const resolvedMethod = method || request.paymentMethod || "CARD"
    const label = `Extra service day: ${request.purpose}`

    if (amount > 0) {
        // Partner wallet (create in the same currency if missing).
        let partnerWallet = await Wallet.findOne({ userId: request.partnerId, currency })
        if (!partnerWallet) {
            const existingPartnerWallet = await Wallet.findOne({ userId: request.partnerId })
            if (existingPartnerWallet) {
                partnerWallet = existingPartnerWallet
            } else {
                const partnerUser = await User.findById(request.partnerId).select("role")
                partnerWallet = new Wallet({
                    userId: request.partnerId,
                    role: partnerUser?.role || "B2B_PARTNER",
                    currency,
                    balance: 0,
                    transactions: [],
                })
            }
        }

        partnerWallet.transactions.push({
            type: "BOOKING_EARNING",
            amount: amount,
            description: label,
            senderId: request.customerId,
            senderName: request.customerName,
            status: "COMPLETED",
            createdAt: new Date(),
        })
        partnerWallet.balance = Math.round(((partnerWallet.balance || 0) + amount) * 100) / 100
        await partnerWallet.save()
    }

    const txnId = transactionId || request.transactionId || `ESD-${request._id.toString().slice(-6)}-${Date.now().toString().slice(-6)}`

    request.paymentStatus = "PAID"
    request.paidAt = new Date()
    request.transactionId = txnId
    request.paymentMethod = resolvedMethod
    if (provider) request.paymentProvider = provider
    await request.save()

    if (request.invoiceId) {
        await Invoice.findByIdAndUpdate(request.invoiceId, {
            status: "PAID",
            paidAt: new Date(),
            paymentMethod: resolvedMethod,
            transactionId: txnId,
        })
    }

    await createNotification({
        userId: request.partnerId,
        type: "PAYMENT_RECEIVED",
        title: "Extra service day paid",
        message: `${request.customerName} paid ${amount} ${currency} for "${request.purpose}".`,
        data: {
            extraServiceRequestId: request._id.toString(),
            contractId: request.contractId.toString(),
        },
    })

    return request
}

/**
 * Resolve + settle an extra-service request from a gateway session id. Used by
 * both the browser payment callback and the gateway webhooks. Returns the
 * settled request (or null if none matches this session).
 */
export const settleExtraServicePaymentBySession = async (sessionId, { provider, transactionId } = {}) => {
    if (!sessionId) return null
    const request = await ExtraServiceRequest.findOne({ gatewaySessionId: sessionId })
    if (!request) return null
    return settleExtraServiceRequestPayment(request, {
        provider,
        transactionId,
        method: request.paymentMethod,
    })
}

/**
 * Load a MANAGED contract and confirm the requester is either its customer or
 * its partner. Returns { contract, side } where side is "CUSTOMER" | "PARTNER",
 * or null (after sending a response) when access is denied.
 */
const resolveContractAccess = async (req, res, contractId) => {
    if (!mongoose.Types.ObjectId.isValid(contractId)) {
        res.status(400).json({ success: false, message: "Invalid contract id." })
        return null
    }

    const contract = await Contract.findById(contractId)
        .populate("corporateOwnerId", "fullName companyName")
        .populate("fleetOwnerId", "fullName companyName")

    if (!contract) {
        res.status(404).json({ success: false, message: "Contract not found." })
        return null
    }
    if (contract.serviceMode !== "MANAGED") {
        res.status(403).json({
            success: false,
            message: "Extra service days are only available for managed-service contracts.",
        })
        return null
    }

    const corpId = contract.corporateOwnerId?._id?.toString() || contract.corporateOwnerId?.toString()
    const fleetId = contract.fleetOwnerId?._id?.toString() || contract.fleetOwnerId?.toString()

    let side = null
    if (isCustomerRole(req.userRole) && corpId === req.userId) side = "CUSTOMER"
    else if (isPartnerRole(req.userRole) && fleetId === req.userId) side = "PARTNER"

    if (!side) {
        res.status(403).json({ success: false, message: "You do not have access to this contract." })
        return null
    }

    return { contract, side, corpId, fleetId }
}

const nameOf = (user) => user?.companyName || user?.fullName || "N/A"

// ---------------------------------------------------------------------------
// POST /api/extra-service-requests/:contractId   (customer creates a request)
// ---------------------------------------------------------------------------
export const createExtraServiceRequest = async (req, res) => {
    try {
        const { contractId } = req.params
        const access = await resolveContractAccess(req, res, contractId)
        if (!access) return

        if (access.side !== "CUSTOMER") {
            return res.status(403).json({
                success: false,
                message: "Only the school customer can request extra service days.",
            })
        }

        const {
            purpose,
            serviceDates,
            vehiclesRequired,
            pickupLocation,
            dropoffLocation,
            departureTime,
            expectedReturnTime,
            passengerCount,
            notes,
        } = req.body

        if (!purpose || !Array.isArray(serviceDates) || serviceDates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "A purpose and at least one service date are required.",
            })
        }

        // Normalise + validate dates. Extra days must be in the future.
        const parsedDates = serviceDates
            .map((d) => new Date(d))
            .filter((d) => !isNaN(d.getTime()))
        if (parsedDates.length === 0) {
            return res.status(400).json({ success: false, message: "No valid service dates provided." })
        }
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        if (parsedDates.some((d) => d < startOfToday)) {
            return res.status(400).json({ success: false, message: "Service dates cannot be in the past." })
        }

        const { contract } = access

        const request = await ExtraServiceRequest.create({
            contractId: contract._id,
            contractNumber: contract.contractNumber,
            customerId: access.corpId,
            customerName: nameOf(contract.corporateOwnerId),
            partnerId: access.fleetId,
            partnerName: nameOf(contract.fleetOwnerId),
            purpose: purpose.trim(),
            serviceDates: parsedDates,
            vehiclesRequired: Math.max(1, parseInt(vehiclesRequired, 10) || 1),
            pickupLocation,
            dropoffLocation,
            departureTime,
            expectedReturnTime,
            passengerCount: passengerCount ? parseInt(passengerCount, 10) : undefined,
            notes,
            currency: contract.financials?.currency || "AED",
            status: "PENDING",
            createdBy: req.userId,
        })

        // Notify the partner.
        await createNotification({
            userId: access.fleetId,
            type: "EXTRA_SERVICE_REQUEST",
            title: "New extra service day request",
            message: `${request.customerName} requested ${parsedDates.length} extra service day(s) on contract ${contract.contractNumber} for: ${request.purpose}`,
            data: { contractId: contract._id.toString(), extraServiceRequestId: request._id.toString() },
        })

        return res.status(201).json({ success: true, data: request })
    } catch (error) {
        console.error("[extraService] createExtraServiceRequest error:", error)
        return res.status(500).json({ success: false, message: "Failed to create extra service request." })
    }
}

// ---------------------------------------------------------------------------
// GET /api/extra-service-requests/:contractId   (both sides list requests)
// ---------------------------------------------------------------------------
export const getExtraServiceRequests = async (req, res) => {
    try {
        const { contractId } = req.params
        const access = await resolveContractAccess(req, res, contractId)
        if (!access) return

        const requests = await ExtraServiceRequest.find({ contractId: access.contract._id })
            .sort({ createdAt: -1 })
            .populate("invoiceId", "invoiceNumber status total currency")

        return res.json({ success: true, data: requests, viewerSide: access.side })
    } catch (error) {
        console.error("[extraService] getExtraServiceRequests error:", error)
        return res.status(500).json({ success: false, message: "Failed to load extra service requests." })
    }
}

// ---------------------------------------------------------------------------
// GET /api/extra-service-requests/mine/all   (list across all my contracts)
// ---------------------------------------------------------------------------
export const getMyExtraServiceRequests = async (req, res) => {
    try {
        const filter = isPartnerRole(req.userRole)
            ? { partnerId: req.userId }
            : { customerId: req.userId }

        if (req.query.status) filter.status = req.query.status

        const requests = await ExtraServiceRequest.find(filter)
            .sort({ createdAt: -1 })
            .populate("invoiceId", "invoiceNumber status total currency")

        return res.json({ success: true, data: requests })
    } catch (error) {
        console.error("[extraService] getMyExtraServiceRequests error:", error)
        return res.status(500).json({ success: false, message: "Failed to load extra service requests." })
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/extra-service-requests/item/:requestId/respond  (partner decision)
// ---------------------------------------------------------------------------
export const respondToExtraServiceRequest = async (req, res) => {
    try {
        const { requestId } = req.params
        const { decision, charge, billingMode, partnerResponseNote } = req.body

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }
        if (!["APPROVE", "REJECT"].includes(decision)) {
            return res.status(400).json({ success: false, message: "Decision must be APPROVE or REJECT." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }

        // Only the owning partner may respond.
        if (!isPartnerRole(req.userRole) || request.partnerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the school partner can respond to this request.",
            })
        }
        if (request.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `This request has already been ${request.status.toLowerCase()}.`,
            })
        }

        if (decision === "REJECT") {
            request.status = "REJECTED"
            request.partnerResponseNote = partnerResponseNote
            request.respondedAt = new Date()
            await request.save()

            await createNotification({
                userId: request.customerId,
                type: "EXTRA_SERVICE_REQUEST",
                title: "Extra service day request declined",
                message: `Your extra service request (${request.purpose}) on contract ${request.contractNumber} was declined.`,
                data: { contractId: request.contractId.toString(), extraServiceRequestId: request._id.toString() },
            })

            return res.json({ success: true, data: request })
        }

        // ---- APPROVE ----
        const chargeAmount = Number(charge)
        if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "A positive charge amount is required to approve the request.",
            })
        }
        if (!["SEPARATE", "ADD_TO_CONTRACT"].includes(billingMode)) {
            return res.status(400).json({
                success: false,
                message: "billingMode must be SEPARATE or ADD_TO_CONTRACT.",
            })
        }

        const contract = await Contract.findById(request.contractId)
            .populate("corporateOwnerId", "fullName companyName")
            .populate("fleetOwnerId", "fullName companyName")
        if (!contract) {
            return res.status(404).json({ success: false, message: "Contract not found." })
        }

        const currency = contract.financials?.currency || request.currency || "AED"
        const roundedCharge = Math.round(chargeAmount * 100) / 100

        request.status = "APPROVED"
        request.charge = roundedCharge
        request.currency = currency
        request.billingMode = billingMode
        request.partnerResponseNote = partnerResponseNote
        request.respondedAt = new Date()
        request.paymentStatus = "PENDING"
        // Approved requests now need a vehicle + driver assigned for each date
        // before the fleet actually turns up for the trip.
        request.fulfillmentStatus = "UNASSIGNED"

        const datesLabel = request.serviceDates
            .map((d) => new Date(d).toLocaleDateString("en-GB"))
            .join(", ")
        const description = `Extra service day(s) [${datesLabel}] - ${request.purpose}`

        // Create the invoice for the extra service charge (idempotent via sourceKey).
        const sourceKey = `${contract._id}:EXTRA_SERVICE:${request._id}`
        const baseNumber = contract.contractNumber || contract._id.toString().slice(-6)
        const invoice = await Invoice.create({
            invoiceNumber: `B2B-INV-${baseNumber}-EXTRA-${request._id.toString().slice(-4)}`,
            sourceKey,
            contractId: contract._id,
            contractNumber: contract.contractNumber,
            fleetOwnerId: contract.fleetOwnerId?._id || contract.fleetOwnerId,
            fleetOwnerName: nameOf(contract.fleetOwnerId),
            corporateOwnerId: contract.corporateOwnerId?._id || contract.corporateOwnerId,
            corporateName: nameOf(contract.corporateOwnerId),
            type: "OPERATIONAL",
            issueDate: new Date(),
            dueDate: request.serviceDates[0],
            lineItems: [
                {
                    description,
                    quantity: request.vehiclesRequired || 1,
                    unitPrice: Math.round((roundedCharge / (request.vehiclesRequired || 1)) * 100) / 100,
                    amount: roundedCharge,
                },
            ],
            currency,
            status: "PENDING",
            notes:
                billingMode === "ADD_TO_CONTRACT"
                    ? "Extra service day charge folded into the contract balance."
                    : "Standalone extra service day charge.",
        })

        request.invoiceId = invoice._id

        // For ADD_TO_CONTRACT, fold the charge into the contract's financials so
        // it is collected together with the contract balance.
        if (billingMode === "ADD_TO_CONTRACT") {
            contract.financials.totalAmount = Math.round(((contract.financials.totalAmount || 0) + roundedCharge) * 100) / 100
            contract.financials.remainingAmount = Math.round(((contract.financials.remainingAmount || 0) + roundedCharge) * 100) / 100
            if (contract.financials.finalPayment) {
                contract.financials.finalPayment.amount = Math.round(((contract.financials.finalPayment.amount || 0) + roundedCharge) * 100) / 100
                if (contract.financials.finalPayment.status === "PAID") {
                    // Re-open the final payment so the extra charge is collectible.
                    contract.financials.finalPayment.status = "PENDING"
                }
            }
            if (contract.financials.paymentStatus === "COMPLETED") {
                contract.financials.paymentStatus = "PARTIAL"
            }
            await contract.save()
        }

        await request.save()

        await createNotification({
            userId: request.customerId,
            type: "EXTRA_SERVICE_REQUEST",
            title: "Extra service day request approved",
            message: `Your extra service request (${request.purpose}) was approved. Charge: ${roundedCharge} ${currency} (${billingMode === "ADD_TO_CONTRACT" ? "added to contract" : "separate invoice"}).`,
            data: { contractId: contract._id.toString(), extraServiceRequestId: request._id.toString(), invoiceId: invoice._id.toString() },
        })

        return res.json({ success: true, data: request, invoice })
    } catch (error) {
        console.error("[extraService] respondToExtraServiceRequest error:", error)
        return res.status(500).json({ success: false, message: "Failed to respond to extra service request." })
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/extra-service-requests/item/:requestId/cancel  (customer cancels)
// ---------------------------------------------------------------------------
export const cancelExtraServiceRequest = async (req, res) => {
    try {
        const { requestId } = req.params
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }
        if (!isCustomerRole(req.userRole) || request.customerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the requesting school customer can cancel this request.",
            })
        }
        if (request.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: "Only pending requests can be cancelled.",
            })
        }

        request.status = "CANCELLED"
        await request.save()

        await createNotification({
            userId: request.partnerId,
            type: "EXTRA_SERVICE_REQUEST",
            title: "Extra service day request cancelled",
            message: `${request.customerName} cancelled their extra service request (${request.purpose}) on contract ${request.contractNumber}.`,
            data: { contractId: request.contractId.toString(), extraServiceRequestId: request._id.toString() },
        })

        return res.json({ success: true, data: request })
    } catch (error) {
        console.error("[extraService] cancelExtraServiceRequest error:", error)
        return res.status(500).json({ success: false, message: "Failed to cancel extra service request." })
    }
}

// ---------------------------------------------------------------------------
// GET /api/extra-service-requests/:contractId/fleet  (partner: assignable fleet)
// ---------------------------------------------------------------------------
// Returns the vehicles + drivers that are attached to this managed contract, so
// the partner can pick which of the fleet they've committed to the customer
// goes out on the extra day.
export const getAssignableFleet = async (req, res) => {
    try {
        const { contractId } = req.params
        const access = await resolveContractAccess(req, res, contractId)
        if (!access) return

        if (access.side !== "PARTNER") {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can view the assignable fleet.",
            })
        }

        const contract = await Contract.findById(access.contract._id)
            .populate("vehicles.assignedVehicles.vehicleId", "vehicleName registrationNumber capacity make model")
            .populate("vehicles.assignedVehicles.driverId", "name phone fullName")

        const fleet = []
        const seen = new Set()
        for (const group of contract.vehicles || []) {
            for (const av of group.assignedVehicles || []) {
                const vId = av.vehicleId?._id?.toString() || av.vehicleId?.toString()
                if (!vId || seen.has(vId)) continue
                seen.add(vId)
                const v = av.vehicleId
                const d = av.driverId
                fleet.push({
                    vehicleId: vId,
                    vehicleLabel: v?.vehicleName
                        ? `${v.vehicleName}${v.registrationNumber ? ` (${v.registrationNumber})` : ""}`
                        : v?.registrationNumber || "Vehicle",
                    seatingCapacity: v?.capacity?.seatingCapacity || null,
                    driverId: d?._id?.toString() || (av.driverId ? av.driverId.toString() : null),
                    driverModel: av.driverModel || "Driver",
                    driverName: d?.name || d?.fullName || null,
                    driverPhone: d?.phone || null,
                })
            }
        }

        return res.json({ success: true, data: fleet })
    } catch (error) {
        console.error("[extraService] getAssignableFleet error:", error)
        return res.status(500).json({ success: false, message: "Failed to load assignable fleet." })
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/extra-service-requests/item/:requestId/assign  (partner assigns)
// ---------------------------------------------------------------------------
// The partner assigns a vehicle + driver for each requested date. Each date
// becomes a real Trip the assigned driver sees on that day, so the fleet turns
// up for the picnic/event. Re-running replaces the previous assignment (any
// prior scheduled extra-day trips are removed and recreated).
export const assignExtraServiceResources = async (req, res) => {
    try {
        const { requestId } = req.params
        const { assignments } = req.body // [{ serviceDate, vehicleId, driverId }]

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }
        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ success: false, message: "At least one assignment is required." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }
        if (!isPartnerRole(req.userRole) || request.partnerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can assign the fleet for this request.",
            })
        }
        if (request.status !== "APPROVED") {
            return res.status(400).json({
                success: false,
                message: "Only approved requests can be assigned a vehicle and driver.",
            })
        }
        if (["IN_PROGRESS", "COMPLETED"].includes(request.fulfillmentStatus)) {
            return res.status(400).json({
                success: false,
                message: "This request is already being fulfilled and can no longer be reassigned.",
            })
        }

        const contract = await Contract.findById(request.contractId)
            .populate("vehicles.assignedVehicles.vehicleId", "vehicleName registrationNumber capacity")
            .populate("vehicles.assignedVehicles.driverId", "name phone fullName")
        if (!contract) {
            return res.status(404).json({ success: false, message: "Contract not found." })
        }

        // Build a lookup of the contract's assigned vehicles so we only allow
        // assigning fleet that actually belongs to this contract.
        const fleetMap = new Map()
        for (const group of contract.vehicles || []) {
            for (const av of group.assignedVehicles || []) {
                const vId = av.vehicleId?._id?.toString() || av.vehicleId?.toString()
                if (vId) fleetMap.set(vId, av)
            }
        }

        // The set of valid service dates on this request (compare by day).
        const dayKey = (d) => new Date(d).toISOString().slice(0, 10)
        const validDates = new Set((request.serviceDates || []).map(dayKey))

        // Remove any previously created (still-scheduled) extra-day trips so a
        // re-assignment doesn't leave orphan trips behind.
        const oldTripIds = (request.assignments || []).map((a) => a.tripId).filter(Boolean)
        if (oldTripIds.length) {
            await Trip.deleteMany({ _id: { $in: oldTripIds }, status: "SCHEDULED" })
        }

        const newAssignments = []
        const driverNotifyIds = new Set()

        for (const a of assignments) {
            if (!a?.serviceDate || !a?.vehicleId) continue
            if (!validDates.has(dayKey(a.serviceDate))) {
                return res.status(400).json({
                    success: false,
                    message: "One of the assignment dates is not part of this request.",
                })
            }
            const av = fleetMap.get(a.vehicleId.toString())
            if (!av) {
                return res.status(400).json({
                    success: false,
                    message: "Selected vehicle is not assigned to this contract.",
                })
            }

            // Driver: default to the vehicle's contract driver, or an override
            // that must still be one of the contract's assigned drivers.
            let driverId = a.driverId || av.driverId?._id || av.driverId
            let driverModel = av.driverModel || "Driver"
            let driverDoc = av.driverId
            if (a.driverId && a.driverId.toString() !== (av.driverId?._id?.toString() || av.driverId?.toString())) {
                // override: find the driver among the contract fleet
                let matched = null
                for (const [, other] of fleetMap) {
                    const oId = other.driverId?._id?.toString() || other.driverId?.toString()
                    if (oId === a.driverId.toString()) {
                        matched = other
                        break
                    }
                }
                if (matched) {
                    driverId = matched.driverId?._id || matched.driverId
                    driverModel = matched.driverModel || "Driver"
                    driverDoc = matched.driverId
                }
            }

            const vehicle = av.vehicleId
            const seats =
                request.passengerCount ||
                vehicle?.capacity?.seatingCapacity ||
                30
            const vehicleLabel = vehicle?.vehicleName
                ? `${vehicle.vehicleName}${vehicle.registrationNumber ? ` (${vehicle.registrationNumber})` : ""}`
                : vehicle?.registrationNumber || "Vehicle"
            const driverName = driverDoc?.name || driverDoc?.fullName || null
            const driverPhone = driverDoc?.phone || null

            // Create the operational trip for this extra day.
            const trip = await Trip.create({
                contractId: contract._id,
                extraServiceRequestId: request._id,
                routeId: undefined,
                vehicleId: a.vehicleId,
                driverId: driverId || undefined,
                corporateId: request.customerId,
                b2bPartnerId: request.partnerId,
                tripDate: new Date(a.serviceDate),
                startTime: request.departureTime || "08:00",
                endTime: request.expectedReturnTime || "",
                tripType: "ROUND_TRIP",
                fromLocation: request.pickupLocation || "School",
                toLocation: request.dropoffLocation || request.purpose,
                totalSeats: seats,
                availableSeats: seats,
                currency: request.currency || "AED",
                status: "SCHEDULED",
                createdBy: req.userId,
                events: [
                    {
                        eventType: driverId ? "DRIVER_ASSIGNED" : "VEHICLE_ASSIGNED",
                        description: `Extra service day: ${request.purpose}`,
                    },
                ],
            })

            newAssignments.push({
                serviceDate: new Date(a.serviceDate),
                vehicleId: a.vehicleId,
                vehicleLabel,
                driverId: driverId || undefined,
                driverModel,
                driverName,
                driverPhone,
                tripId: trip._id,
                status: "SCHEDULED",
                assignedAt: new Date(),
            })

            if (driverId) driverNotifyIds.add(driverId.toString())
        }

        if (newAssignments.length === 0) {
            return res.status(400).json({ success: false, message: "No valid assignments were provided." })
        }

        request.assignments = newAssignments
        request.fulfillmentStatus = "ASSIGNED"
        await request.save()

        // Notify each assigned driver (resolve driver-model id -> user account).
        for (const drvId of driverNotifyIds) {
            try {
                const driverUser = await User.findOne({ driverId: drvId }).select("_id")
                const notifyUserId = driverUser?._id || drvId
                await createNotification({
                    userId: notifyUserId,
                    type: "TRIP_ASSIGNED",
                    title: "Extra service day assigned",
                    message: `You have an extra service trip for ${request.customerName}: ${request.purpose}. Check your trips on the service date.`,
                    data: { extraServiceRequestId: request._id.toString(), contractId: contract._id.toString() },
                })
            } catch (e) {
                console.error("[extraService] driver notify failed:", e.message)
            }
        }

        // Notify the customer that the fleet is confirmed.
        await createNotification({
            userId: request.customerId,
            type: "EXTRA_SERVICE_REQUEST",
            title: "Extra service day — fleet assigned",
            message: `Your partner assigned ${newAssignments.length} vehicle(s)/driver(s) for "${request.purpose}". You're all set for the trip.`,
            data: { contractId: contract._id.toString(), extraServiceRequestId: request._id.toString() },
        })

        return res.json({ success: true, data: request })
    } catch (error) {
        console.error("[extraService] assignExtraServiceResources error:", error)
        return res.status(500).json({ success: false, message: "Failed to assign the fleet for this request." })
    }
}

// ---------------------------------------------------------------------------
// POST /api/extra-service-requests/item/:requestId/pay  (customer pays)
// ---------------------------------------------------------------------------
// Starts payment for a SEPARATE extra-service charge using the method the
// customer picked in the modal, exactly like a contract payment:
//   - CARD / WALLET      -> create a real gateway checkout (Stripe for AED,
//                           TAP for KWD) and return its paymentUrl. The browser
//                           redirects, and the payment callback + gateway
//                           webhook settle the request once the gateway confirms.
//   - BANK_TRANSFER/CASH -> record a manual submission (PROCESSING) and notify
//                           the partner to confirm they received the money.
// ADD_TO_CONTRACT charges are collected with the contract and are not payable here.
export const payExtraServiceRequest = async (req, res) => {
    try {
        const { requestId } = req.params
        const { paymentMethod } = req.body || {}

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }

        const method = normalizeEsdMethod(paymentMethod)
        if (!method) {
            return res.status(400).json({ success: false, message: "Please choose a valid payment method." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }
        if (!isCustomerRole(req.userRole) || request.customerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the requesting school customer can pay for this request.",
            })
        }
        if (request.status !== "APPROVED") {
            return res.status(400).json({ success: false, message: "Only approved requests can be paid." })
        }
        if (request.billingMode !== "SEPARATE") {
            return res.status(400).json({
                success: false,
                message: "This charge is collected with your contract, not as a separate payment.",
            })
        }
        if (request.paymentStatus === "PAID") {
            return res.status(400).json({ success: false, message: "This request is already paid." })
        }
        // A manual (cash/bank) submission is already awaiting the partner's
        // confirmation — don't let the customer double-submit it.
        if (request.paymentStatus === "PROCESSING" && MANUAL_ESD_METHODS.includes(request.paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Your payment is already submitted and awaiting your partner's confirmation.",
            })
        }

        const amount = Math.round((request.charge || 0) * 100) / 100
        if (!(amount > 0)) {
            return res.status(400).json({ success: false, message: "Nothing to pay for this request." })
        }

        const currency = request.currency || "AED"

        // Respect the platform switch that turns off online payments.
        if (ONLINE_ESD_METHODS.includes(method)) {
            const country = detectCountryFromCurrency(currency)
            const gateway = getPaymentGateway(country)

            const customer = await User.findById(request.customerId).select("email fullName companyName phone")
            const redirectBase = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim()

            try {
                const paymentSession = await paymentGatewayService.createPaymentSession({
                    gateway,
                    amount,
                    currency,
                    customer: {
                        email: customer?.email,
                        name: customer?.companyName || customer?.fullName || "Customer",
                        phone: customer?.phone,
                    },
                    contractId: request.contractId,
                    redirectUrl: `${redirectBase}/payment/callback`,
                    metadata: {
                        type: "EXTRA_SERVICE",
                        extraServiceRequestId: request._id.toString(),
                        contractId: request.contractId.toString(),
                        method,
                    },
                })

                request.paymentStatus = "PROCESSING"
                request.paymentMethod = method
                request.paymentProvider = gateway
                request.gatewaySessionId = paymentSession.sessionId
                request.paymentReference = `ESD-${request._id.toString().slice(-6)}-${Date.now().toString().slice(-6)}`
                request.paymentSubmittedAt = new Date()
                await request.save()

                return res.json({
                    success: true,
                    message: "Payment session created successfully",
                    data: { paymentSession },
                })
            } catch (gwError) {
                console.error("[extraService] gateway session error:", gwError.message)
                return res.status(500).json({
                    success: false,
                    message: "Failed to start the online payment. Please try again.",
                })
            }
        }

        // Manual methods — record the submission and ask the partner to confirm.
        const reference = `ESD-${request._id.toString().slice(-6)}-${Date.now().toString().slice(-6)}`
        request.paymentStatus = "PROCESSING"
        request.paymentMethod = method
        request.paymentProvider = "MANUAL"
        request.gatewaySessionId = null
        request.paymentReference = reference
        request.paymentSubmittedAt = new Date()
        await request.save()

        await createNotification({
            userId: request.partnerId,
            type: "PAYMENT_SUBMITTED",
            title: "Extra service payment submitted",
            message: `${request.customerName} submitted a ${method === "CASH" ? "cash" : "bank transfer"} payment of ${amount} ${currency} for "${request.purpose}". Confirm once you receive it.`,
            data: {
                extraServiceRequestId: request._id.toString(),
                contractId: request.contractId.toString(),
                reference,
            },
        })

        return res.json({
            success: true,
            message:
                method === "CASH"
                    ? "Cash payment recorded. Your partner will confirm once collected."
                    : "Bank transfer recorded. Your partner will confirm once received.",
            data: { request, reference, manual: true },
        })
    } catch (error) {
        console.error("[extraService] payExtraServiceRequest error:", error)
        return res.status(500).json({ success: false, message: "Failed to start payment for this request." })
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/extra-service-requests/item/:requestId/confirm-payment  (partner)
// ---------------------------------------------------------------------------
// The partner confirms they received a cash/bank-transfer payment the customer
// submitted, which settles the request (credits the partner + marks the invoice
// PAID). Online (CARD/WALLET) payments settle automatically via the gateway and
// cannot be confirmed manually here.
export const confirmExtraServiceRequestPayment = async (req, res) => {
    try {
        const { requestId } = req.params
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }
        if (!isPartnerRole(req.userRole) || request.partnerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can confirm this payment.",
            })
        }
        if (request.paymentStatus === "PAID") {
            return res.status(400).json({ success: false, message: "This request is already paid." })
        }
        if (request.paymentStatus !== "PROCESSING" || !MANUAL_ESD_METHODS.includes(request.paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "There is no cash/bank payment awaiting your confirmation for this request.",
            })
        }

        const settled = await settleExtraServiceRequestPayment(request, {
            method: request.paymentMethod,
            provider: "MANUAL",
            transactionId: request.paymentReference,
        })

        await createNotification({
            userId: request.customerId,
            type: "PAYMENT_RECEIVED",
            title: "Extra service payment confirmed",
            message: `Your partner confirmed the ${request.paymentMethod === "CASH" ? "cash" : "bank transfer"} payment for "${request.purpose}".`,
            data: {
                extraServiceRequestId: request._id.toString(),
                contractId: request.contractId.toString(),
            },
        })

        return res.json({ success: true, data: settled })
    } catch (error) {
        console.error("[extraService] confirmExtraServiceRequestPayment error:", error)
        return res.status(500).json({ success: false, message: "Failed to confirm the payment." })
    }
}
