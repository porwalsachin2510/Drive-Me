import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import Invoice from "../models/Invoice.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (date) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const periodLabel = (start, end) => {
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`
    if (start) return formatDate(start)
    return ""
}

// Map a contract financial sub-status to an invoice status.
// A contract that is still a draft / awaiting signature keeps its invoices in DRAFT.
const deriveStatus = (contract, financialStatus, paidAt) => {
    if (paidAt) return "PAID"
    if (financialStatus === "PAID") return "PAID"
    if (financialStatus === "OVERDUE") return "OVERDUE"

    const liveStatuses = ["ACTIVE", "PENDING_PAYMENT", "APPROVED_PENDING_PAYMENT", "COMPLETED"]
    if (liveStatuses.includes(contract.status)) return "PENDING"
    return "DRAFT"
}

// ---------------------------------------------------------------------------
// Invoice generation (idempotent)
// ---------------------------------------------------------------------------

/**
 * Build the list of invoice "specs" a contract should have, based on its
 * financial plan. Each spec carries a stable sourceKey so we never duplicate.
 */
const buildInvoiceSpecs = (contract) => {
    const specs = []
    const fin = contract.financials || {}
    const currency = fin.currency || "AED"
    const contractStart = contract.rentalPeriod?.startDate || contract.createdAt
    const contractEnd = contract.rentalPeriod?.endDate
    const baseNumber = contract.contractNumber || contract._id.toString().slice(-6)

    const push = (spec) => specs.push({ currency, ...spec })

    // EMI / installment plan -> one invoice per installment
    if (Array.isArray(fin.installments) && fin.installments.length > 0) {
        fin.installments.forEach((inst, idx) => {
            const number = inst.installmentNumber || idx + 1
            push({
                type: "INSTALLMENT",
                installmentNumber: number,
                sourceKey: `${contract._id}:INSTALLMENT:${number}`,
                invoiceNumber: `B2B-INV-${baseNumber}-EMI${number}`,
                amount: inst.amount || 0,
                dueDate: inst.dueDate || contractStart,
                financialStatus: inst.status,
                paidAt: inst.paidAt,
                transactionId: inst.transactionId,
                description: `EMI installment ${number} of ${fin.installments.length}`,
                billingPeriod: { start: contractStart, end: contractEnd, label: `Installment ${number}` },
            })
        })
        // Security deposit (if billed separately alongside EMI)
        if (fin.securityDeposit?.amount > 0) {
            push({
                type: "SECURITY_DEPOSIT",
                sourceKey: `${contract._id}:SECURITY_DEPOSIT:0`,
                invoiceNumber: `B2B-INV-${baseNumber}-SEC`,
                amount: fin.securityDeposit.amount,
                dueDate: fin.securityDeposit.dueDate || contractStart,
                financialStatus: fin.securityDeposit.status,
                paidAt: fin.securityDeposit.paidAt,
                transactionId: fin.securityDeposit.refundTransactionId,
                description: "Refundable security deposit",
                billingPeriod: { start: contractStart, end: contractEnd, label: "Security Deposit" },
            })
        }
        return specs
    }

    // Standard plan -> advance + final (+ optional security deposit)
    if (fin.advancePayment?.amount > 0) {
        push({
            type: "ADVANCE",
            sourceKey: `${contract._id}:ADVANCE:0`,
            invoiceNumber: `B2B-INV-${baseNumber}-ADV`,
            amount: fin.advancePayment.amount,
            dueDate: fin.advancePayment.dueDate || contractStart,
            financialStatus: fin.advancePayment.status,
            paidAt: fin.advancePayment.paidAt,
            transactionId: fin.advancePayment.transactionId,
            description: "Advance payment to activate contract",
            billingPeriod: { start: contractStart, end: contractEnd, label: "Advance Payment" },
        })
    }

    if (fin.finalPayment?.amount > 0 || fin.remainingAmount > 0) {
        push({
            type: "FINAL",
            sourceKey: `${contract._id}:FINAL:0`,
            invoiceNumber: `B2B-INV-${baseNumber}-FIN`,
            amount: fin.finalPayment?.amount || fin.remainingAmount || 0,
            dueDate: fin.finalPayment?.dueDate || contractEnd,
            financialStatus: fin.finalPayment?.status,
            paidAt: fin.finalPayment?.paidAt,
            transactionId: fin.finalPayment?.transactionId,
            description: "Final payment on contract completion",
            billingPeriod: { start: contractStart, end: contractEnd, label: "Final Payment" },
        })
    }

    if (fin.securityDeposit?.amount > 0) {
        push({
            type: "SECURITY_DEPOSIT",
            sourceKey: `${contract._id}:SECURITY_DEPOSIT:0`,
            invoiceNumber: `B2B-INV-${baseNumber}-SEC`,
            amount: fin.securityDeposit.amount,
            dueDate: fin.securityDeposit.dueDate || contractStart,
            financialStatus: fin.securityDeposit.status,
            paidAt: fin.securityDeposit.paidAt,
            transactionId: fin.securityDeposit.refundTransactionId,
            description: "Refundable security deposit",
            billingPeriod: { start: contractStart, end: contractEnd, label: "Security Deposit" },
        })
    }

    // Fallback: contract has a total but no structured plan -> single invoice
    if (specs.length === 0 && (fin.totalAmount || 0) > 0) {
        push({
            type: "MONTHLY",
            sourceKey: `${contract._id}:MONTHLY:0`,
            invoiceNumber: `B2B-INV-${baseNumber}-FULL`,
            amount: fin.totalAmount,
            dueDate: contractStart,
            financialStatus: fin.paymentStatus === "COMPLETED" ? "PAID" : "PENDING",
            paidAt: null,
            description: "Contract total",
            billingPeriod: { start: contractStart, end: contractEnd, label: periodLabel(contractStart, contractEnd) },
        })
    }

    return specs
}

/**
 * Ensure persisted Invoice documents exist for a contract and are in sync with
 * the contract's current financial status. Idempotent: safe to call repeatedly.
 * Returns the list of Invoice documents for the contract.
 */
export const syncInvoicesForContract = async (contract) => {
    if (!contract) return []

    const corporateName =
        contract.corporateOwnerId?.companyName ||
        contract.corporateOwnerId?.fullName ||
        "Corporate Client"
    const fleetOwnerName =
        contract.fleetOwnerId?.companyName ||
        contract.fleetOwnerId?.fullName ||
        "Fleet Partner"
    const corporateOwnerId = contract.corporateOwnerId?._id || contract.corporateOwnerId
    const fleetOwnerId = contract.fleetOwnerId?._id || contract.fleetOwnerId

    const specs = buildInvoiceSpecs(contract)
    const results = []

    for (const spec of specs) {
        const status = deriveStatus(contract, spec.financialStatus, spec.paidAt)
        const lineItems = [
            {
                description: spec.description,
                quantity: 1,
                unitPrice: spec.amount,
                amount: spec.amount,
            },
        ]

        let invoice = await Invoice.findOne({ sourceKey: spec.sourceKey })

        if (!invoice) {
            invoice = new Invoice({
                invoiceNumber: spec.invoiceNumber,
                sourceKey: spec.sourceKey,
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                fleetOwnerId,
                fleetOwnerName,
                corporateOwnerId,
                corporateName,
                type: spec.type,
                installmentNumber: spec.installmentNumber,
                billingPeriod: spec.billingPeriod,
                issueDate: contract.createdAt || new Date(),
                dueDate: spec.dueDate,
                lineItems,
                currency: spec.currency,
                status,
                paidAt: spec.paidAt || undefined,
                transactionId: spec.transactionId || undefined,
            })
        } else {
            // Keep amount / due date / names in sync, but never downgrade a paid invoice
            invoice.lineItems = lineItems
            invoice.dueDate = spec.dueDate
            invoice.corporateName = corporateName
            invoice.fleetOwnerName = fleetOwnerName
            if (invoice.status !== "PAID") {
                invoice.status = status
                if (spec.paidAt) {
                    invoice.paidAt = spec.paidAt
                    invoice.transactionId = spec.transactionId
                }
            }
        }

        // Overdue detection for unpaid invoices past their due date
        if (
            invoice.status !== "PAID" &&
            invoice.status !== "DRAFT" &&
            invoice.dueDate &&
            new Date(invoice.dueDate) < new Date()
        ) {
            invoice.status = "OVERDUE"
        }

        await invoice.save()
        results.push(invoice)
    }

    return results
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

export const generateInvoicePdf = async (invoice) => {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const brand = rgb(0.86, 0.15, 0.15)
    const dark = rgb(0.1, 0.1, 0.18)
    const gray = rgb(0.4, 0.4, 0.45)
    const lightLine = rgb(0.85, 0.85, 0.88)

    let y = height - 50

    const text = (str, x, yPos, size = 10, useFont = font, color = dark) => {
        page.drawText(String(str ?? ""), { x, y: yPos, size, font: useFont, color })
    }

    // Header
    text("DriveMeGo", 50, y, 22, fontBold, brand)
    text("INVOICE", width - 160, y, 22, fontBold, dark)
    y -= 18
    text("GOAHEAD MOBILITY SOLUTIONS PVT LTD", 50, y, 8, font, gray)
    text(invoice.invoiceNumber || "", width - 160, y, 10, font, gray)
    y -= 30

    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightLine })
    y -= 25

    // From / To
    const topY = y
    text("FROM", 50, y, 8, fontBold, gray)
    text("BILL TO", width / 2, y, 8, fontBold, gray)
    y -= 16
    text(invoice.fleetOwnerName || "Fleet Partner", 50, y, 11, fontBold)
    text(invoice.corporateName || "Corporate Client", width / 2, y, 11, fontBold)
    y -= 30

    // Meta
    text("Contract", 50, y, 8, fontBold, gray)
    text("Issue Date", 200, y, 8, fontBold, gray)
    text("Due Date", 330, y, 8, fontBold, gray)
    text("Status", 460, y, 8, fontBold, gray)
    y -= 14
    text(invoice.contractNumber || "N/A", 50, y, 10)
    text(formatDate(invoice.issueDate), 200, y, 10)
    text(formatDate(invoice.dueDate), 330, y, 10)
    text(invoice.status || "PENDING", 460, y, 10, fontBold, brand)
    y -= 12
    if (invoice.billingPeriod?.label) {
        y -= 14
        text(`Billing period: ${invoice.billingPeriod.label}`, 50, y, 9, font, gray)
    }
    y -= 25

    // Table header
    page.drawRectangle({ x: 50, y: y - 6, width: width - 100, height: 22, color: rgb(0.96, 0.96, 0.97) })
    text("DESCRIPTION", 58, y, 8, fontBold, gray)
    text("QTY", 360, y, 8, fontBold, gray)
    text("UNIT", 420, y, 8, fontBold, gray)
    text("AMOUNT", width - 110, y, 8, fontBold, gray)
    y -= 28

    const cur = invoice.currency || "AED"
    ;(invoice.lineItems || []).forEach((li) => {
        text(li.description || "", 58, y, 10)
        text(String(li.quantity ?? 1), 360, y, 10)
        text(`${(li.unitPrice || 0).toLocaleString()}`, 420, y, 10)
        text(`${(li.amount || 0).toLocaleString()} ${cur}`, width - 130, y, 10)
        y -= 20
    })

    y -= 10
    page.drawLine({ start: { x: width / 2, y }, end: { x: width - 50, y }, thickness: 1, color: lightLine })
    y -= 20

    const totalsRow = (label, value, bold = false) => {
        text(label, width / 2, y, 10, bold ? fontBold : font, bold ? dark : gray)
        text(`${value.toLocaleString()} ${cur}`, width - 130, y, 10, bold ? fontBold : font)
        y -= 18
    }
    totalsRow("Subtotal", invoice.subtotal || 0)
    if ((invoice.taxRate || 0) > 0) totalsRow(`Tax (${invoice.taxRate}%)`, invoice.taxAmount || 0)
    totalsRow("Total", invoice.total || 0, true)

    // Footer
    text("Thank you for your business.", 50, 70, 9, font, gray)
    text("Secure Payments by Stripe", 50, 56, 8, font, gray)

    const bytes = await pdfDoc.save()
    return Buffer.from(bytes)
}
