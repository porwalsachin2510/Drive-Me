import mongoose from "mongoose"
import Contract from "../models/Contract.js"
import Complaint from "../models/Complaint.js"
import Invoice from "../models/Invoice.js"
import User from "../models/User.js"
import { computeSlaPerformance } from "../Services/managedSlaService.js"
import { buildMonthlyBill, generateMonthlyOperationalInvoice } from "../Services/operationBillingService.js"
import { logManagedActivity } from "../utils/operationContext.js"
import { createNotification } from "../Services/notificationService.js"

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

    let role = null
    if (req.userRole === "CORPORATE" && corpId === req.userId) role = "CORPORATE"
    else if (req.userRole === "B2B_PARTNER" && fleetId === req.userId) role = "B2B_PARTNER"

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
