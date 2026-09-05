import mongoose from "mongoose"
import Contract from "../models/Contract.js"
import Complaint from "../models/Complaint.js"
import Invoice from "../models/Invoice.js"
import User from "../models/User.js"
import Wallet from "../models/Wallet.js"
import { computeSlaPerformance } from "../Services/managedSlaService.js"
import { buildMonthlyBill, generateMonthlyOperationalInvoice } from "../Services/operationBillingService.js"
import { logManagedActivity } from "../utils/operationContext.js"
import { createNotification } from "../Services/notificationService.js"
import { isCustomerRole, isPartnerRole } from "../utils/roleFamilies.js"
import paymentGatewayService, {
    detectCountryFromCurrency,
    getPaymentGateway,
} from "../Services/paymentGatewayService.js"

// Canonicalise the payment method the client picked in the modal.
const INV_METHOD_MAP = {
    CARD: "CARD",
    "CREDIT CARD": "CARD",
    "CREDIT/DEBIT CARD": "CARD",
    WALLET: "WALLET",
    "MOBILE WALLET": "WALLET",
    BANK_TRANSFER: "BANK_TRANSFER",
    "BANK TRANSFER": "BANK_TRANSFER",
    CASH: "CASH",
}
const normalizeInvMethod = (m) => INV_METHOD_MAP[String(m || "").trim().toUpperCase()] || null
const ONLINE_INV_METHODS = ["CARD", "WALLET"]
const MANUAL_INV_METHODS = ["BANK_TRANSFER", "CASH"]

/**
 * Settle a generated operational invoice: credit the fleet partner's wallet with
 * the invoice total (the platform is the ledger of record, so this runs for
 * every payment method), mark the invoice PAID, log it and notify both sides.
 * Idempotent — no-ops if the invoice is already PAID, so the gateway callback
 * and the webhook can both call it safely without double-crediting.
 *
 * Exported so the payment callback / gateway webhooks can settle an invoice once
 * the online payment is confirmed by the gateway.
 */
export const settleOperationalInvoicePayment = async (
    invoice,
    { method, provider, transactionId } = {}
) => {
    if (!invoice) return null
    if (invoice.status === "PAID") return invoice

    const amount = Math.round((invoice.total || 0) * 100) / 100
    const currency = invoice.currency || "AED"
    const resolvedMethod = method || invoice.paymentMethod || "CARD"
    const label = `Operational invoice ${invoice.invoiceNumber}${invoice.billingPeriod?.label ? ` (${invoice.billingPeriod.label})` : ""}`

    if (amount > 0) {
        let partnerWallet = await Wallet.findOne({ userId: invoice.fleetOwnerId, currency })
        if (!partnerWallet) {
            const existing = await Wallet.findOne({ userId: invoice.fleetOwnerId })
            if (existing) {
                partnerWallet = existing
            } else {
                const partnerUser = await User.findById(invoice.fleetOwnerId).select("role")
                partnerWallet = new Wallet({
                    userId: invoice.fleetOwnerId,
                    role: partnerUser?.role || "B2B_PARTNER",
                    currency,
                    balance: 0,
                    transactions: [],
                })
            }
        }
        partnerWallet.transactions.push({
            type: "BOOKING_EARNING",
            amount,
            description: label,
            senderId: invoice.corporateOwnerId,
            senderName: invoice.corporateName,
            status: "COMPLETED",
            createdAt: new Date(),
        })
        partnerWallet.balance = Math.round(((partnerWallet.balance || 0) + amount) * 100) / 100
        await partnerWallet.save()
    }

    const txnId =
        transactionId ||
        invoice.transactionId ||
        `OPS-${invoice._id.toString().slice(-6)}-${Date.now().toString().slice(-6)}`

    invoice.status = "PAID"
    invoice.paidAt = new Date()
    invoice.transactionId = txnId
    invoice.paymentMethod = resolvedMethod
    invoice.manualPaymentPending = false
    if (provider) invoice.paymentProvider = provider
    await invoice.save()

    await logManagedActivity(invoice.contractId, {
        action: "OPERATIONAL_INVOICE_PAID",
        description: `Operational invoice ${invoice.invoiceNumber} paid (${amount} ${currency}).`,
        entityType: "INVOICE",
        entityId: invoice._id,
        performedBy: invoice.corporateOwnerId,
        performedByRole: "CORPORATE",
    }).catch(() => { })

    await createNotification({
        userId: invoice.fleetOwnerId,
        type: "PAYMENT_RECEIVED",
        title: "Operational invoice paid",
        message: `${invoice.corporateName} paid ${amount} ${currency} for invoice ${invoice.invoiceNumber}.`,
        data: {
            contractId: invoice.contractId.toString(),
            invoiceId: invoice._id.toString(),
        },
    }).catch(() => { })

    return invoice
}

/**
 * managedServiceController
 * ------------------------
 * SLA & performance tracking + operation-based billing for MANAGED contracts.
 * Both the corporate owner and the B2B partner (fleet owner) share these
 * endpoints; access is resolved per request.
 */

// Resolve the contract and the caller's role for a MANAGED contract.
const resolveAccess = async (req, res) => {
    const { contractId } = req.params
    if (!mongoose.Types.ObjectId.isValid(contractId)) {
        res.status(400).json({ success: false, message: "Invalid contract id." })
        return null
    }
    const contract = await Contract.findById(contractId)
        .populate("corporateOwnerId", "fullName companyName email")
        .populate("fleetOwnerId", "fullName companyName email")

    if (!contract) {
        res.status(404).json({ success: false, message: "Contract not found." })
        return null
    }
    if (contract.serviceMode !== "MANAGED") {
        res.status(403).json({
            success: false,
            message: "SLA & operational billing are only available for managed-service contracts.",
        })
        return null
    }

    const corpId = contract.corporateOwnerId?._id?.toString() || contract.corporateOwnerId?.toString()
    const fleetId = contract.fleetOwnerId?._id?.toString() || contract.fleetOwnerId?.toString()

    // Access is by contract ownership, not by the exact role string, so both
    // corporate (CORPORATE/SCHOOL_CUSTOMER) and partner (B2B_PARTNER/
    // SCHOOL_PARTNER) families work. We normalise to canonical side labels so
    // the rest of this controller is unaffected.
    let role = null
    if (isCustomerRole(req.userRole) && corpId === req.userId) role = "CORPORATE"
    else if (isPartnerRole(req.userRole) && fleetId === req.userId) role = "B2B_PARTNER"

    if (!role) {
        res.status(403).json({ success: false, message: "You do not have access to this contract." })
        return null
    }
    return { contract, role, corpId, fleetId }
}

// Default period = current calendar month.
const resolvePeriod = (req) => {
    const now = new Date()
    const year = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear()
    const month = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const end = new Date(year, month, 0, 23, 59, 59, 999)
    return { year, month, start, end }
}

// ---------------------------------------------------------------------------
// SLA configuration & performance
// ---------------------------------------------------------------------------

// GET /api/managed-service/:contractId/sla
export const getSlaConfig = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        res.json({
            success: true,
            data: {
                sla: access.contract.sla || {},
                viewerRole: access.role,
                currency: access.contract.financials?.currency || "AED",
            },
        })
    } catch (error) {
        console.error("[managedService] getSlaConfig error:", error)
        res.status(500).json({ success: false, message: "Failed to load SLA configuration." })
    }
}

// PUT /api/managed-service/:contractId/sla   (corporate only)
export const updateSlaConfig = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        if (access.role !== "CORPORATE") {
            return res.status(403).json({
                success: false,
                message: "Only the corporate client can set SLA targets.",
            })
        }

        const { contract } = access
        const body = req.body || {}
        contract.sla = contract.sla || {}

        const numFields = [
            "onTimeTargetPct",
            "vehicleAvailabilityTargetPct",
            "complaintResolutionHours",
            "lateThresholdMinutes",
        ]
        for (const f of numFields) {
            if (body[f] !== undefined && !isNaN(Number(body[f]))) contract.sla[f] = Number(body[f])
        }
        if (body.enabled !== undefined) contract.sla.enabled = !!body.enabled
        if (body.penalty && typeof body.penalty === "object") {
            contract.sla.penalty = contract.sla.penalty || {}
            for (const f of ["onTimePerPointPct", "availabilityPerPointPct", "perLateComplaint", "maxPenaltyPct"]) {
                if (body.penalty[f] !== undefined && !isNaN(Number(body.penalty[f])))
                    contract.sla.penalty[f] = Number(body.penalty[f])
            }
        }
        contract.sla.updatedAt = new Date()
        await contract.save()

        await logManagedActivity(contract._id, {
            action: "SLA_CONFIG_UPDATED",
            description: "Corporate updated the SLA targets & penalty rules.",
            entityType: "SLA",
            entityId: contract._id,
            performedBy: req.userId,
            performedByRole: "CORPORATE",
        }).catch(() => { })

        await createNotification({
            userId: access.fleetId,
            type: "SLA_CONFIG_UPDATED",
            title: "SLA targets updated",
            message: `SLA targets were updated for contract ${contract.contractNumber}.`,
            data: { contractId: contract._id.toString() },
        }).catch(() => { })

        res.json({ success: true, message: "SLA configuration saved.", data: { sla: contract.sla } })
    } catch (error) {
        console.error("[managedService] updateSlaConfig error:", error)
        res.status(500).json({ success: false, message: "Failed to save SLA configuration." })
    }
}

// GET /api/managed-service/:contractId/sla/performance?month&year
export const getSlaPerformance = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        const { year, month, start, end } = resolvePeriod(req)
        const performance = await computeSlaPerformance(access.contract, { start, end })
        res.json({
            success: true,
            data: {
                year,
                month,
                viewerRole: access.role,
                currency: access.contract.financials?.currency || "AED",
                performance,
            },
        })
    } catch (error) {
        console.error("[managedService] getSlaPerformance error:", error)
        res.status(500).json({ success: false, message: "Failed to compute SLA performance." })
    }
}

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

// GET /api/managed-service/:contractId/complaints
export const listComplaints = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        const query = { contractId: access.contract._id }
        if (req.query.status && req.query.status !== "all") query.status = req.query.status.toUpperCase()
        const complaints = await Complaint.find(query).sort({ createdAt: -1 })
        res.json({ success: true, data: { complaints, viewerRole: access.role } })
    } catch (error) {
        console.error("[managedService] listComplaints error:", error)
        res.status(500).json({ success: false, message: "Failed to load complaints." })
    }
}

// POST /api/managed-service/:contractId/complaints
export const createComplaint = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        const { contract, role } = access
        const { subject, description, category, severity, tripId } = req.body || {}
        if (!subject || !subject.trim()) {
            return res.status(400).json({ success: false, message: "A subject is required." })
        }

        const actor = await User.findById(req.userId).select("fullName companyName").lean()
        const complaint = await Complaint.create({
            contractId: contract._id,
            contractNumber: contract.contractNumber,
            corporateOwnerId: access.corpId,
            fleetOwnerId: access.fleetId,
            raisedBy: req.userId,
            raisedByName: actor?.companyName || actor?.fullName || "User",
            raisedByRole: role,
            tripId: tripId && mongoose.Types.ObjectId.isValid(tripId) ? tripId : null,
            category: category || "OTHER",
            severity: severity || "MEDIUM",
            subject: subject.trim(),
            description: description || "",
            status: "OPEN",
        })

        await logManagedActivity(contract._id, {
            action: "COMPLAINT_RAISED",
            description: `${complaint.raisedByName} raised a complaint: "${complaint.subject}".`,
            entityType: "COMPLAINT",
            entityId: complaint._id,
            performedBy: req.userId,
            performedByRole: role,
            performedByName: complaint.raisedByName,
        }).catch(() => { })

        // Notify the other party (partner gets corporate complaints, and vice versa).
        const notifyUserId = role === "CORPORATE" ? access.fleetId : access.corpId
        await createNotification({
            userId: notifyUserId,
            type: "COMPLAINT_RAISED",
            title: "New complaint raised",
            message: `A ${complaint.severity.toLowerCase()} complaint "${complaint.subject}" was raised on contract ${contract.contractNumber}.`,
            data: { contractId: contract._id.toString(), complaintId: complaint._id.toString() },
        }).catch(() => { })

        res.status(201).json({ success: true, message: "Complaint submitted.", data: { complaint } })
    } catch (error) {
        console.error("[managedService] createComplaint error:", error)
        res.status(500).json({ success: false, message: "Failed to submit complaint." })
    }
}

// PATCH /api/managed-service/:contractId/complaints/:complaintId
// Update status / add response / resolve. Partner (operator) resolves.
export const updateComplaint = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        const { contract, role } = access
        const { complaintId } = req.params
        if (!mongoose.Types.ObjectId.isValid(complaintId)) {
            return res.status(400).json({ success: false, message: "Invalid complaint id." })
        }
        const complaint = await Complaint.findOne({ _id: complaintId, contractId: contract._id })
        if (!complaint) {
            return res.status(404).json({ success: false, message: "Complaint not found." })
        }

        const actor = await User.findById(req.userId).select("fullName companyName").lean()
        const actorName = actor?.companyName || actor?.fullName || "User"
        const { status, message, resolutionNote } = req.body || {}

        if (message && message.trim()) {
            complaint.updates.push({ message: message.trim(), byId: req.userId, byName: actorName, byRole: role })
            if (!complaint.firstResponseAt && role === "B2B_PARTNER") complaint.firstResponseAt = new Date()
        }

        if (status && ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) {
            const wasUnresolved = complaint.status !== "RESOLVED" && complaint.status !== "CLOSED"
            complaint.status = status

            if ((status === "RESOLVED" || status === "CLOSED") && wasUnresolved) {
                complaint.resolvedAt = new Date()
                complaint.resolvedBy = req.userId
                complaint.resolvedByName = actorName
                if (resolutionNote) complaint.resolutionNote = resolutionNote
                if (!complaint.firstResponseAt) complaint.firstResponseAt = new Date()

                const hours = (complaint.resolvedAt - complaint.createdAt) / (1000 * 60 * 60)
                complaint.resolutionHours = Math.round(hours * 10) / 10
                const slaHours = contract.sla?.complaintResolutionHours || 24
                complaint.breachedSla = complaint.resolutionHours > slaHours
            }
        } else if (resolutionNote) {
            complaint.resolutionNote = resolutionNote
        }

        await complaint.save()

        await logManagedActivity(contract._id, {
            action: "COMPLAINT_UPDATED",
            description: `${actorName} updated complaint "${complaint.subject}" to ${complaint.status}.`,
            entityType: "COMPLAINT",
            entityId: complaint._id,
            performedBy: req.userId,
            performedByRole: role,
            performedByName: actorName,
        }).catch(() => { })

        const notifyUserId = role === "CORPORATE" ? access.fleetId : access.corpId
        await createNotification({
            userId: notifyUserId,
            type: "COMPLAINT_UPDATED",
            title: `Complaint ${complaint.status.toLowerCase()}`,
            message: `Complaint "${complaint.subject}" on contract ${contract.contractNumber} is now ${complaint.status}.`,
            data: { contractId: contract._id.toString(), complaintId: complaint._id.toString() },
        }).catch(() => { })

        res.json({ success: true, message: "Complaint updated.", data: { complaint } })
    } catch (error) {
        console.error("[managedService] updateComplaint error:", error)
        res.status(500).json({ success: false, message: "Failed to update complaint." })
    }
}

// ---------------------------------------------------------------------------
// Operation-based billing
// ---------------------------------------------------------------------------

// GET /api/managed-service/:contractId/billing/config
export const getBillingConfig = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        res.json({
            success: true,
            data: {
                operationBilling: access.contract.operationBilling || {},
                viewerRole: access.role,
                currency: access.contract.financials?.currency || "AED",
            },
        })
    } catch (error) {
        console.error("[managedService] getBillingConfig error:", error)
        res.status(500).json({ success: false, message: "Failed to load billing configuration." })
    }
}

// PUT /api/managed-service/:contractId/billing/config   (partner only)
export const updateBillingConfig = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        if (access.role !== "B2B_PARTNER") {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can configure operational billing.",
            })
        }
        const { contract } = access
        const body = req.body || {}
        contract.operationBilling = contract.operationBilling || {}

        if (body.enabled !== undefined) contract.operationBilling.enabled = !!body.enabled
        if (body.model && ["PER_TRIP", "PER_SEAT", "PER_KM", "FIXED_MONTHLY"].includes(body.model))
            contract.operationBilling.model = body.model
        if (body.managementFeeType && ["FLAT", "PERCENT"].includes(body.managementFeeType))
            contract.operationBilling.managementFeeType = body.managementFeeType

        for (const f of [
            "ratePerTrip",
            "ratePerSeat",
            "ratePerKm",
            "fixedMonthlyAmount",
            "managementFeeValue",
            "taxRatePct",
            "billingDay",
        ]) {
            if (body[f] !== undefined && !isNaN(Number(body[f]))) contract.operationBilling[f] = Number(body[f])
        }
        contract.operationBilling.updatedAt = new Date()
        await contract.save()

        await logManagedActivity(contract._id, {
            action: "BILLING_CONFIG_UPDATED",
            description: "Partner updated operation-based billing configuration.",
            entityType: "BILLING",
            entityId: contract._id,
            performedBy: req.userId,
            performedByRole: "B2B_PARTNER",
        }).catch(() => { })

        await createNotification({
            userId: access.corpId,
            type: "BILLING_CONFIG_UPDATED",
            title: "Billing terms updated",
            message: `Operational billing terms were updated for contract ${contract.contractNumber}.`,
            data: { contractId: contract._id.toString() },
        }).catch(() => { })

        res.json({
            success: true,
            message: "Billing configuration saved.",
            data: { operationBilling: contract.operationBilling },
        })
    } catch (error) {
        console.error("[managedService] updateBillingConfig error:", error)
        res.status(500).json({ success: false, message: "Failed to save billing configuration." })
    }
}

// GET /api/managed-service/:contractId/billing/preview?month&year
export const previewMonthlyBill = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        const { year, month } = resolvePeriod(req)
        const bill = await buildMonthlyBill(access.contract, year, month)

        // Has an invoice for this period already been generated?
        const period = `${year}-${String(month).padStart(2, "0")}`
        const sourceKey = `${access.contract._id}:OPERATIONAL:${period}`
        const existing = await Invoice.findOne({ sourceKey }).select("invoiceNumber status")

        // Normalise into the flat "preview" shape the UI consumes.
        const preview = {
            year,
            month,
            periodLabel: bill.period.label,
            currency: bill.currency,
            billingModel: bill.billingModel,
            usage: bill.usage,
            operationalAmount: bill.operationalAmount,
            managementFee: bill.managementFee,
            subtotal: bill.subtotal,
            slaPenalty: bill.penalty.amount,
            slaBreaches: bill.performance.breaches,
            tax: bill.taxAmount,
            taxRate: bill.taxRate,
            total: bill.total,
            alreadyGenerated: !!existing,
            existingInvoiceNumber: existing?.invoiceNumber || null,
            existingInvoiceStatus: existing?.status || null,
        }

        res.json({ success: true, data: { preview, bill, viewerRole: access.role } })
    } catch (error) {
        console.error("[managedService] previewMonthlyBill error:", error)
        res.status(500).json({ success: false, message: "Failed to build monthly bill." })
    }
}

// POST /api/managed-service/:contractId/billing/generate   (partner only)
export const generateMonthlyInvoice = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        if (access.role !== "B2B_PARTNER") {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can generate operational invoices.",
            })
        }
        const now = new Date()
        const year = req.body.year ? parseInt(req.body.year, 10) : now.getFullYear()
        const month = req.body.month ? parseInt(req.body.month, 10) : now.getMonth() + 1

        const invoice = await generateMonthlyOperationalInvoice(access.contract, year, month)

        await logManagedActivity(access.contract._id, {
            action: "OPERATIONAL_INVOICE_GENERATED",
            description: `Partner generated operational invoice ${invoice.invoiceNumber} (${invoice.billingPeriod?.label}).`,
            entityType: "INVOICE",
            entityId: invoice._id,
            performedBy: req.userId,
            performedByRole: "B2B_PARTNER",
        }).catch(() => { })

        await createNotification({
            userId: access.corpId,
            type: "OPERATIONAL_INVOICE_GENERATED",
            title: "New operational invoice",
            message: `Invoice ${invoice.invoiceNumber} for ${(invoice.total || 0).toLocaleString()} ${invoice.currency} is ready for ${invoice.billingPeriod?.label}.`,
            data: { contractId: access.contract._id.toString(), invoiceId: invoice._id.toString() },
        }).catch(() => { })

        res.status(201).json({ success: true, message: "Operational invoice generated.", data: { invoice } })
    } catch (error) {
        console.error("[managedService] generateMonthlyInvoice error:", error)
        res.status(500).json({ success: false, message: "Failed to generate operational invoice." })
    }
}

// GET /api/managed-service/:contractId/billing/invoices
export const listOperationalInvoices = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        const docs = await Invoice.find({
            contractId: access.contract._id,
            type: "OPERATIONAL",
        })
            .sort({ "billingPeriod.start": -1, createdAt: -1 })
            .lean()

        // Add convenience fields the UI reads (amount, periodLabel).
        const invoices = docs.map((inv) => ({
            ...inv,
            amount: inv.total,
            periodLabel: inv.billingPeriod?.label || null,
        }))

        res.json({
            success: true,
            data: { invoices, viewerRole: access.role, currency: access.contract.financials?.currency || "AED" },
        })
    } catch (error) {
        console.error("[managedService] listOperationalInvoices error:", error)
        res.status(500).json({ success: false, message: "Failed to load operational invoices." })
    }
}

// POST /api/managed-service/:contractId/billing/invoices/:invoiceId/pay  (corporate)
// Starts payment for a generated operational invoice with the method the client
// picked in the modal, exactly like a contract payment:
//   - CARD / WALLET      -> create a real gateway checkout (Stripe/AED, Tap/KWD)
//                           and return its paymentUrl. The browser redirects and
//                           the callback + webhook settle the invoice.
//   - BANK_TRANSFER/CASH -> record a manual submission and notify the partner to
//                           confirm they received the money.
export const payOperationalInvoice = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        if (access.role !== "CORPORATE") {
            return res.status(403).json({
                success: false,
                message: "Only the corporate client can pay operational invoices.",
            })
        }

        const { invoiceId } = req.params
        const { paymentMethod } = req.body || {}
        if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
            return res.status(400).json({ success: false, message: "Invalid invoice id." })
        }

        const method = normalizeInvMethod(paymentMethod)
        if (!method) {
            return res.status(400).json({ success: false, message: "Please choose a valid payment method." })
        }

        const invoice = await Invoice.findOne({
            _id: invoiceId,
            contractId: access.contract._id,
            type: "OPERATIONAL",
        })
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found." })
        }
        if (invoice.status === "PAID") {
            return res.status(400).json({ success: false, message: "This invoice is already paid." })
        }
        if (invoice.manualPaymentPending && MANUAL_INV_METHODS.includes(invoice.paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Your payment is already submitted and awaiting your partner's confirmation.",
            })
        }

        const amount = Math.round((invoice.total || 0) * 100) / 100
        if (!(amount > 0)) {
            return res.status(400).json({ success: false, message: "This invoice has nothing to pay." })
        }
        const currency = invoice.currency || "AED"

        // Online (card / wallet) -> secure gateway checkout.
        if (ONLINE_INV_METHODS.includes(method)) {
            const country = detectCountryFromCurrency(currency)
            const gateway = getPaymentGateway(country)
            const customer = await User.findById(invoice.corporateOwnerId).select(
                "email fullName companyName phone"
            )
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
                    contractId: invoice.contractId,
                    redirectUrl: `${redirectBase}/payment/callback`,
                    metadata: {
                        type: "OPERATIONAL_INVOICE",
                        invoiceId: invoice._id.toString(),
                        contractId: invoice.contractId.toString(),
                        method,
                    },
                })

                invoice.paymentMethod = method
                invoice.paymentProvider = gateway
                invoice.gatewaySessionId = paymentSession.sessionId
                invoice.manualPaymentPending = false
                invoice.paymentReference = `OPS-${invoice._id.toString().slice(-6)}-${Date.now().toString().slice(-6)}`
                invoice.paymentSubmittedAt = new Date()
                await invoice.save()

                return res.json({
                    success: true,
                    message: "Payment session created successfully",
                    data: { paymentSession },
                })
            } catch (gwError) {
                console.error("[managedService] gateway session error:", gwError.message)
                return res.status(500).json({
                    success: false,
                    message: "Failed to start the online payment. Please try again.",
                })
            }
        }

        // Manual (cash / bank transfer) -> partner confirms receipt.
        const reference = `OPS-${invoice._id.toString().slice(-6)}-${Date.now().toString().slice(-6)}`
        invoice.paymentMethod = method
        invoice.paymentProvider = "MANUAL"
        invoice.gatewaySessionId = null
        invoice.manualPaymentPending = true
        invoice.paymentReference = reference
        invoice.paymentSubmittedAt = new Date()
        await invoice.save()

        await createNotification({
            userId: invoice.fleetOwnerId,
            type: "PAYMENT_SUBMITTED",
            title: "Operational invoice payment submitted",
            message: `${invoice.corporateName} submitted a ${method === "CASH" ? "cash" : "bank transfer"} payment of ${amount} ${currency} for invoice ${invoice.invoiceNumber}. Confirm once received.`,
            data: {
                contractId: invoice.contractId.toString(),
                invoiceId: invoice._id.toString(),
                reference,
            },
        }).catch(() => { })

        return res.json({
            success: true,
            message:
                method === "CASH"
                    ? "Cash payment recorded. Your partner will confirm once collected."
                    : "Bank transfer recorded. Your partner will confirm once received.",
            data: { invoice, reference, manual: true },
        })
    } catch (error) {
        console.error("[managedService] payOperationalInvoice error:", error)
        res.status(500).json({ success: false, message: "Failed to start payment for this invoice." })
    }
}

// PATCH /api/managed-service/:contractId/billing/invoices/:invoiceId/confirm-payment  (partner)
// The fleet partner confirms they received a cash/bank-transfer payment the
// client submitted, which settles the invoice. Online (card/wallet) payments
// settle automatically via the gateway and cannot be confirmed manually here.
export const confirmOperationalInvoicePayment = async (req, res) => {
    try {
        const access = await resolveAccess(req, res)
        if (!access) return
        if (access.role !== "B2B_PARTNER") {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can confirm this payment.",
            })
        }

        const { invoiceId } = req.params
        if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
            return res.status(400).json({ success: false, message: "Invalid invoice id." })
        }

        const invoice = await Invoice.findOne({
            _id: invoiceId,
            contractId: access.contract._id,
            type: "OPERATIONAL",
        })
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found." })
        }
        if (invoice.status === "PAID") {
            return res.status(400).json({ success: false, message: "This invoice is already paid." })
        }
        if (!invoice.manualPaymentPending || !MANUAL_INV_METHODS.includes(invoice.paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "There is no cash/bank payment awaiting your confirmation for this invoice.",
            })
        }

        const settled = await settleOperationalInvoicePayment(invoice, {
            method: invoice.paymentMethod,
            provider: "MANUAL",
            transactionId: invoice.paymentReference,
        })

        await createNotification({
            userId: invoice.corporateOwnerId,
            type: "PAYMENT_RECEIVED",
            title: "Operational invoice payment confirmed",
            message: `Your partner confirmed the ${invoice.paymentMethod === "CASH" ? "cash" : "bank transfer"} payment for invoice ${invoice.invoiceNumber}.`,
            data: {
                contractId: invoice.contractId.toString(),
                invoiceId: invoice._id.toString(),
            },
        }).catch(() => { })

        res.json({ success: true, data: { invoice: settled } })
    } catch (error) {
        console.error("[managedService] confirmOperationalInvoicePayment error:", error)
        res.status(500).json({ success: false, message: "Failed to confirm the payment." })
    }
}
