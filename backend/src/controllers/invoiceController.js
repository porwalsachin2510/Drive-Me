import Invoice from "../models/Invoice.js"
import Contract from "../models/Contract.js"
import User from "../models/User.js"
import { syncInvoicesForContract, generateInvoicePdf } from "../Services/invoiceService.js"
import { createNotification, sendAdminNotification } from "../Services/notificationService.js"
import { sendInvoiceEmail } from "../Services/emailService.js"
import { getEffectiveCountry, getCountryCurrency } from "../Config/localizationConfig.js"

// Build a summary object from a list of invoices. `fallbackCurrency` is the
// viewer's own country currency, used when there are no invoices yet so a
// Kuwait partner sees KWD instead of a hard-coded "AED".
const buildSummary = (invoices, fallbackCurrency = "AED") => {
    const currency = invoices[0]?.currency || fallbackCurrency
    let totalInvoiced = 0
    let paid = 0
    let outstanding = 0
    let overdue = 0
    invoices.forEach((inv) => {
        const amt = inv.total || 0
        if (inv.status === "CANCELLED") return
        totalInvoiced += amt
        if (inv.status === "PAID") paid += amt
        else outstanding += amt
        if (inv.status === "OVERDUE") overdue += amt
    })
    return {
        currency,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        overdue: Math.round(overdue * 100) / 100,
        count: invoices.length,
    }
}

// Sync + fetch invoices for one side of the relationship
const loadInvoices = async (matchKey, ownerId, statusFilter) => {
    const contracts = await Contract.find({ [matchKey]: ownerId })
        .populate("corporateOwnerId", "fullName companyName email")
        .populate("fleetOwnerId", "fullName companyName email")

    for (const contract of contracts) {
        await syncInvoicesForContract(contract)
    }

    const query = { [matchKey]: ownerId }
    if (statusFilter && statusFilter !== "all") {
        query.status = statusFilter.toUpperCase()
    }

    const invoices = await Invoice.find(query).sort({ issueDate: -1, createdAt: -1 })
    return invoices
}

// @desc    Get B2B Partner invoices (issued to corporate clients)
// @route   GET /api/b2b-partner/invoices
// @access  Private (B2B_PARTNER)
export const getB2BPartnerInvoices = async (req, res) => {
    try {
        const partnerId = req.userId
        const { status } = req.query

        const invoices = await loadInvoices("fleetOwnerId", partnerId, status)
        // Summary should reflect all invoices, not just the filtered slice
        const allInvoices =
            status && status !== "all" ? await Invoice.find({ fleetOwnerId: partnerId }) : invoices

        const partner = await User.findById(partnerId).select('country countryCode role adminPermissions')
        const fallbackCurrency = getCountryCurrency(getEffectiveCountry(partner))

        res.status(200).json({
            success: true,
            data: {
                invoices,
                summary: buildSummary(allInvoices, fallbackCurrency),
                total: invoices.length,
            },
        })
    } catch (error) {
        console.error("Error fetching B2B partner invoices:", error)
        res.status(500).json({ success: false, message: "Failed to fetch invoices", error: error.message })
    }
}

// @desc    Get corporate invoices (received from fleet partners)
// @route   GET /api/corporate/invoices
// @access  Private (CORPORATE)
export const getCorporateInvoices = async (req, res) => {
    try {
        const corporateId = req.userId
        const { status } = req.query

        const invoices = await loadInvoices("corporateOwnerId", corporateId, status)
        const allInvoices =
            status && status !== "all" ? await Invoice.find({ corporateOwnerId: corporateId }) : invoices

        const corporate = await User.findById(corporateId).select('country countryCode role adminPermissions')
        const fallbackCurrency = getCountryCurrency(getEffectiveCountry(corporate))

        res.status(200).json({
            success: true,
            data: {
                invoices,
                summary: buildSummary(allInvoices, fallbackCurrency),
                total: invoices.length,
            },
        })
    } catch (error) {
        console.error("Error fetching corporate invoices:", error)
        res.status(500).json({ success: false, message: "Failed to fetch invoices", error: error.message })
    }
}

// @desc    Get a single invoice (owner-scoped)
// @route   GET /api/b2b-partner/invoices/:id  and  /api/corporate/invoices/:id
// @access  Private
export const getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.userId

        const invoice = await Invoice.findOne({
            _id: id,
            $or: [{ fleetOwnerId: userId }, { corporateOwnerId: userId }],
        })

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" })
        }

        res.status(200).json({ success: true, data: { invoice } })
    } catch (error) {
        console.error("Error fetching invoice:", error)
        res.status(500).json({ success: false, message: "Failed to fetch invoice", error: error.message })
    }
}

// @desc    Download invoice PDF (owner-scoped)
// @route   GET /api/b2b-partner/invoices/:id/pdf  and  /api/corporate/invoices/:id/pdf
// @access  Private
export const downloadInvoicePdf = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.userId

        const invoice = await Invoice.findOne({
            _id: id,
            $or: [{ fleetOwnerId: userId }, { corporateOwnerId: userId }],
        })

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" })
        }

        const pdfBuffer = await generateInvoicePdf(invoice)
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`)
        res.send(pdfBuffer)
    } catch (error) {
        console.error("Error generating invoice PDF:", error)
        res.status(500).json({ success: false, message: "Failed to generate PDF", error: error.message })
    }
}

// @desc    Send / re-send (remind) an invoice to the corporate client
// @route   POST /api/b2b-partner/invoices/:id/send
// @access  Private (B2B_PARTNER)
export const sendInvoice = async (req, res) => {
    try {
        const { id } = req.params
        const partnerId = req.userId
        const { isReminder } = req.body

        const invoice = await Invoice.findOne({ _id: id, fleetOwnerId: partnerId })
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" })
        }
        if (invoice.status === "PAID") {
            return res.status(400).json({ success: false, message: "Invoice is already paid" })
        }

        // First send moves DRAFT -> SENT/PENDING
        if (!invoice.sentAt) {
            invoice.sentAt = new Date()
            if (invoice.status === "DRAFT") invoice.status = "SENT"
        }
        invoice.reminders.push({ sentAt: new Date(), channel: "BOTH" })
        await invoice.save()

        // In-app notification to corporate client
        await createNotification({
            userId: invoice.corporateOwnerId,
            type: isReminder ? "INVOICE_REMINDER" : "INVOICE_SENT",
            title: isReminder ? "Payment Reminder" : "New Invoice Received",
            message: `${invoice.fleetOwnerName} ${isReminder ? "sent a reminder for" : "issued"} invoice ${invoice.invoiceNumber} for ${(invoice.total || 0).toLocaleString()} ${invoice.currency}. Due ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "soon"}.`,
            relatedEntityId: invoice._id,
            relatedEntityType: "PAYMENT",
            data: {
                invoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.total,
                currency: invoice.currency,
                contractId: invoice.contractId,
            },
        })

        // Email with PDF attachment
        try {
            const corporate = await User.findById(invoice.corporateOwnerId).select("email companyName fullName")
            if (corporate?.email) {
                const pdfBuffer = await generateInvoicePdf(invoice)
                await sendInvoiceEmail(corporate.email, invoice, { pdfBuffer, isReminder: !!isReminder })
            }
        } catch (emailErr) {
            console.error("[v0] Invoice email failed (non-fatal):", emailErr.message)
        }

        res.status(200).json({
            success: true,
            message: isReminder ? "Reminder sent successfully" : "Invoice sent successfully",
            data: { invoice },
        })
    } catch (error) {
        console.error("Error sending invoice:", error)
        res.status(500).json({ success: false, message: "Failed to send invoice", error: error.message })
    }
}

// @desc    Get redirect info for invoice payment (redirect to real contract payment)
// @route   GET /api/corporate/invoices/:id/payment-redirect
// @access  Private (CORPORATE)
export const getInvoicePaymentRedirect = async (req, res) => {
    try {
        const { id } = req.params
        const corporateId = req.userId

        const invoice = await Invoice.findOne({ _id: id, corporateOwnerId: corporateId })
            .populate("contractId", "_id status financials")

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" })
        }

        if (invoice.status === "PAID") {
            return res.status(400).json({ success: false, message: "Invoice is already paid" })
        }

        const contractId = invoice.contractId?._id || invoice.contractId
        if (!contractId) {
            return res.status(400).json({ success: false, message: "Contract not found for this invoice" })
        }

        return res.status(200).json({
            success: true,
            data: {
                contractId,
                invoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                invoiceType: invoice.type,
                amount: invoice.total,
                currency: invoice.currency,
                redirectUrl: `/corporate/contracts/${contractId}`,
            },
        })
    } catch (error) {
        console.error("Error in getInvoicePaymentRedirect:", error.message)
        return res.status(500).json({ success: false, message: error.message })
    }
}
