import EMIPayment from "../models/EMIPayment.js"
import Contract from "../models/Contract.js"
import Wallet from "../models/Wallet.js"
import Transaction from "../models/Transaction.js"
import CommissionSettings from "../models/CommissionSettings.js"
import User from "../models/User.js"
import { createNotification, sendAdminNotification, sendRealTimeNotification } from "../Services/notificationService.js"
import paymentGatewayService, {
    detectCountryFromCurrency,
    getPaymentGateway,
} from "../Services/paymentGatewayService.js"
import crypto from "crypto"
import nodemailer from "nodemailer"
import stripe from "../Config/stripe.js"

// Helper to generate EMI invoice PDF HTML
const generateEMIInvoiceHTML = (emiPayment, installment, contract, corporate, fleetOwner) => {
    const invoiceNumber = `EMI-${contract.contractNumber}-${installment.installmentNumber}`
    const invoiceDate = new Date().toLocaleDateString()
    const dueDate = new Date(installment.dueDate).toLocaleDateString()
    const paidDate = installment.paidAt ? new Date(installment.paidAt).toLocaleDateString() : "N/A"

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>EMI Payment Invoice - ${invoiceNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
                .invoice-container { max-width: 800px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 40px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #667eea; }
                .invoice-title { text-align: right; }
                .invoice-title h2 { margin: 0; color: #333; font-size: 24px; }
                .invoice-title p { margin: 5px 0; color: #666; }
                .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .party { width: 45%; }
                .party h4 { color: #667eea; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
                .party p { margin: 5px 0; color: #666; }
                .details-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
                .details-table th { background: #667eea; color: white; padding: 12px; text-align: left; }
                .details-table td { padding: 12px; border-bottom: 1px solid #e0e0e0; }
                .details-table tr:hover { background: #f9f9f9; }
                .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px; }
                .summary-row { display: flex; justify-content: space-between; margin: 10px 0; }
                .summary-row.total { font-size: 18px; font-weight: bold; border-top: 2px solid #667eea; padding-top: 15px; margin-top: 15px; }
                .status-paid { color: #10b981; font-weight: bold; }
                .status-pending { color: #f59e0b; font-weight: bold; }
                .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e0e0e0; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <div class="header">
                    <div class="logo">DriveMe</div>
                    <div class="invoice-title">
                        <h2>EMI PAYMENT INVOICE</h2>
                        <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
                        <p><strong>Date:</strong> ${invoiceDate}</p>
                    </div>
                </div>

                <div class="parties">
                    <div class="party">
                        <h4>Bill To (Corporate)</h4>
                        <p><strong>${corporate.companyName || corporate.fullName}</strong></p>
                        <p>${corporate.email}</p>
                    </div>
                    <div class="party">
                        <h4>Service Provider (B2B Partner)</h4>
                        <p><strong>${fleetOwner.companyName || fleetOwner.fullName}</strong></p>
                        <p>${fleetOwner.email}</p>
                    </div>
                </div>

                <table class="details-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Contract #</th>
                            <th>Installment</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>EMI Payment - Installment ${installment.installmentNumber} of ${emiPayment.emiPlan.tenure}</td>
                            <td>${contract.contractNumber}</td>
                            <td>${installment.installmentNumber}/${emiPayment.emiPlan.tenure}</td>
                            <td>${emiPayment.emiPlan.currency} ${installment.amount.toFixed(2)}</td>
                        </tr>
                        ${installment.lateFee > 0 ? `
                        <tr>
                            <td>Late Payment Fee (${installment.lateFeePercentage}%)</td>
                            <td>-</td>
                            <td>-</td>
                            <td>${emiPayment.emiPlan.currency} ${installment.lateFee.toFixed(2)}</td>
                        </tr>
                        ` : ""}
                    </tbody>
                </table>

                <div class="summary">
                    <div class="summary-row">
                        <span>EMI Amount:</span>
                        <span>${emiPayment.emiPlan.currency} ${installment.amount.toFixed(2)}</span>
                    </div>
                    ${installment.lateFee > 0 ? `
                    <div class="summary-row">
                        <span>Late Fee:</span>
                        <span>${emiPayment.emiPlan.currency} ${installment.lateFee.toFixed(2)}</span>
                    </div>
                    ` : ""}
                    <div class="summary-row total">
                        <span>Total Paid:</span>
                        <span>${emiPayment.emiPlan.currency} ${(installment.totalAmountDue || installment.amount).toFixed(2)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Payment Status:</span>
                        <span class="${installment.status === 'PAID' ? 'status-paid' : 'status-pending'}">${installment.status}</span>
                    </div>
                    <div class="summary-row">
                        <span>Payment Date:</span>
                        <span>${paidDate}</span>
                    </div>
                    <div class="summary-row">
                        <span>Payment Method:</span>
                        <span>${installment.paymentMethod || "N/A"}</span>
                    </div>
                </div>

                <div class="summary" style="margin-top: 20px;">
                    <h4 style="margin-top: 0; color: #667eea;">EMI Plan Summary</h4>
                    <div class="summary-row">
                        <span>Total Contract Amount:</span>
                        <span>${emiPayment.emiPlan.currency} ${emiPayment.emiPlan.totalAmount.toFixed(2)}</span>
                    </div>
                    <div class="summary-row">
                        <span>EMI Tenure:</span>
                        <span>${emiPayment.emiPlan.tenure} Months</span>
                    </div>
                    <div class="summary-row">
                        <span>Monthly EMI:</span>
                        <span>${emiPayment.emiPlan.currency} ${emiPayment.emiPlan.monthlyEMI.toFixed(2)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Installments Paid:</span>
                        <span>${emiPayment.summary.installmentsPaid} of ${emiPayment.emiPlan.tenure}</span>
                    </div>
                    <div class="summary-row">
                        <span>Total Paid So Far:</span>
                        <span>${emiPayment.emiPlan.currency} ${emiPayment.summary.totalPaid.toFixed(2)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Remaining Amount:</span>
                        <span>${emiPayment.emiPlan.currency} ${emiPayment.summary.totalRemaining.toFixed(2)}</span>
                    </div>
                </div>

                <div class="footer">
                    <p>Thank you for your payment!</p>
                    <p>For any queries, contact us at support@driveme.com</p>
                    <p>This is a computer-generated invoice and does not require a signature.</p>
                </div>
            </div>
        </body>
        </html>
    `
}

// Send EMI Invoice Email
const sendEMIInvoiceEmail = async (email, invoiceHTML, installmentNumber, contractNumber) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || "smtp.gmail.com",
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_SECURE === "true",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        })

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: `EMI Payment Invoice - Installment ${installmentNumber} - Contract ${contractNumber}`,
            html: invoiceHTML,
        })

        console.log(`[v0] EMI invoice email sent to: ${email}`)
        return true
    } catch (error) {
        console.error("[v0] Error sending EMI invoice email:", error)
        return false
    }
}

// @desc    Create EMI Payment Plan for a Contract
// @route   POST /api/emi-payments/create
// @access  Private (CORPORATE only)
export const createEMIPlan = async (req, res) => {
    try {
        const { contractId, tenure } = req.body
        const corporateOwnerId = req.userId

        console.log("[v0] Create EMI plan request:", { contractId, tenure })

        // Validate tenure
        const validTenures = [3, 6, 9, 12, 18, 24]
        if (!validTenures.includes(tenure)) {
            return res.status(400).json({
                success: false,
                message: "Invalid tenure. Allowed values: 3, 6, 9, 12, 18, or 24 months",
            })
        }

        // Get contract
        const contract = await Contract.findById(contractId)
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Calculate contract duration in months
        const { durationType, duration, startDate: contractStart, endDate: contractEnd } = contract.rentalPeriod
        let contractDurationMonths = 0

        if (durationType === "DAILY") {
            contractDurationMonths = Math.ceil(duration / 30)
        } else if (durationType === "WEEKLY") {
            contractDurationMonths = Math.ceil((duration * 7) / 30)
        } else if (durationType === "MONTHLY" || durationType === "LONG_TERM") {
            contractDurationMonths = duration
        } else if (contractStart && contractEnd) {
            // Fallback: Calculate from actual dates
            const start = new Date(contractStart)
            const end = new Date(contractEnd)
            const diffTime = Math.abs(end - start)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            contractDurationMonths = Math.ceil(diffDays / 30)
        }

        console.log("[v0] Contract duration calculation:", { durationType, duration, contractDurationMonths })

        // Check if contract is eligible for EMI (minimum 3 months)
        if (contractDurationMonths < 3) {
            return res.status(400).json({
                success: false,
                message: `EMI payment is not available for contracts shorter than 3 months. Your contract duration is ${contractDurationMonths} month(s). Please use Standard Payment instead.`,
            })
        }

        // Validate tenure does not exceed contract duration
        if (tenure > contractDurationMonths) {
            return res.status(400).json({
                success: false,
                message: `EMI tenure (${tenure} months) cannot exceed contract duration (${contractDurationMonths} months). Please select a tenure of ${contractDurationMonths} months or less.`,
            })
        }

        // Verify corporate owner
        if (contract.corporateOwnerId._id.toString() !== corporateOwnerId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to create EMI plan for this contract",
            })
        }

        // Check contract status
        if (contract.status !== "PENDING_PAYMENT") {
            return res.status(400).json({
                success: false,
                message: "Contract is not ready for payment. Both parties must sign first.",
            })
        }

        // Check if EMI plan already exists
        const existingEMI = await EMIPayment.findOne({ contractId })
        if (existingEMI) {
            return res.status(400).json({
                success: false,
                message: "EMI plan already exists for this contract",
                data: { emiPayment: existingEMI },
            })
        }

        // Get commission settings for fleet owner (B2B Partner)
        const commissionSettings = await CommissionSettings.findOne({
            userId: contract.fleetOwnerId._id,
            isActive: true,
        })

        // Use dynamic commission rate with priority:
        // 1. Custom Rate Rule with rateType "EMI" (if active and within date range)
        // 2. emiCommissionSettings.emiCommissionRate
        // 3. defaultCommissionRate
        // 4. Fallback 20%
        let emiCommissionRate = 20 // Fallback

        // First check for Custom Rate Rule with rateType "EMI"
        if (commissionSettings?.customRates?.length > 0) {
            const now = new Date()
            const emiCustomRate = commissionSettings.customRates.find(
                (r) =>
                    r.rateType === "EMI" &&
                    new Date(r.effectiveFrom) <= now &&
                    (!r.effectiveUntil || new Date(r.effectiveUntil) >= now)
            )
            if (emiCustomRate) {
                emiCommissionRate = emiCustomRate.rate
                console.log("[v0] Using Custom EMI Rate Rule:", emiCommissionRate, "%")
            } else if (commissionSettings.emiCommissionSettings?.emiCommissionRate) {
                emiCommissionRate = commissionSettings.emiCommissionSettings.emiCommissionRate
                console.log("[v0] Using emiCommissionSettings.emiCommissionRate:", emiCommissionRate, "%")
            } else if (commissionSettings.defaultCommissionRate) {
                emiCommissionRate = commissionSettings.defaultCommissionRate
                console.log("[v0] Using defaultCommissionRate:", emiCommissionRate, "%")
            }
        } else if (commissionSettings?.emiCommissionSettings?.emiCommissionRate) {
            emiCommissionRate = commissionSettings.emiCommissionSettings.emiCommissionRate
            console.log("[v0] Using emiCommissionSettings.emiCommissionRate:", emiCommissionRate, "%")
        } else if (commissionSettings?.defaultCommissionRate) {
            emiCommissionRate = commissionSettings.defaultCommissionRate
            console.log("[v0] Using defaultCommissionRate:", emiCommissionRate, "%")
        }

        const lateFeePercentage = commissionSettings?.emiCommissionSettings?.lateFeePercentage || 2

        console.log("[v0] Final EMI Commission Rate for B2B Partner:", emiCommissionRate, "%")

        // Get contract amounts
        const contractAmount = contract.financials.totalAmount
        const securityDeposit = contract.financials.securityDeposit?.amount || 0
        const currency = contract.financials.currency

        // Check for negotiation commission - this MUST be included in EMI
        let negotiationCommission = 0
        if (contract.negotiationCommission && contract.negotiationCommission.commissionStatus === "PENDING") {
            negotiationCommission = contract.negotiationCommission.adminCommission || 0
        }

        // EMI Total = Contract Amount + Negotiation Commission
        // Security deposit is NOT included in EMI (waived for EMI users)
        const totalEMIAmount = contractAmount + negotiationCommission
        const monthlyEMI = Math.ceil(totalEMIAmount / tenure)

        // Calculate per-installment negotiation commission portion
        const negotiationPerInstallment = Math.ceil(negotiationCommission / tenure)
        const contractPerInstallment = Math.ceil(contractAmount / tenure)

        console.log("[v0] EMI Calculation:", {
            contractAmount,
            negotiationCommission,
            totalEMIAmount,
            monthlyEMI,
            negotiationPerInstallment,
            contractPerInstallment,
            tenure
        })

        // Create installments
        const installments = []
        const today = new Date()

        let remainingContractAmount = contractAmount
        let remainingNegotiationAmount = negotiationCommission

        for (let i = 1; i <= tenure; i++) {
            const dueDate = new Date(today)
            dueDate.setMonth(dueDate.getMonth() + i)
            // Last day of month
            const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0)

            // For last installment, use remaining amounts to avoid rounding issues
            let installmentContractPortion, installmentNegotiationPortion
            if (i === tenure) {
                installmentContractPortion = remainingContractAmount
                installmentNegotiationPortion = remainingNegotiationAmount
            } else {
                installmentContractPortion = contractPerInstallment
                installmentNegotiationPortion = negotiationPerInstallment
                remainingContractAmount -= installmentContractPortion
                remainingNegotiationAmount -= installmentNegotiationPortion
            }

            const installmentAmount = installmentContractPortion + installmentNegotiationPortion

            // Admin commission is calculated on the CONTRACT portion only (not negotiation - that's already Admin's)
            const adminCommission = Math.round((installmentContractPortion * emiCommissionRate) / 100)
            const fleetOwnerAmount = installmentContractPortion - adminCommission

            installments.push({
                installmentNumber: i,
                amount: installmentAmount,
                dueDate: lastDay,
                status: "PENDING",
                lateFee: 0,
                lateFeePercentage,
                totalAmountDue: installmentAmount,
                // Contract portion tracking
                contractAmountPortion: installmentContractPortion,
                negotiationCommissionPortion: installmentNegotiationPortion,
                negotiationCommissionCredited: false,
                adminCommission: {
                    rate: emiCommissionRate,
                    amount: adminCommission,
                    status: "PENDING",
                },
                fleetOwnerAmount,
                remindersSent: [],
            })
        }

        // Calculate end date
        const endDate = new Date(today)
        endDate.setMonth(endDate.getMonth() + tenure)

        // Create EMI Payment record
        const emiPayment = new EMIPayment({
            contractId,
            corporateOwnerId,
            fleetOwnerId: contract.fleetOwnerId._id,
            emiPlan: {
                contractAmount,
                negotiationCommission,
                securityDeposit: 0, // Security deposit waived for EMI
                totalAmount: totalEMIAmount,
                tenure,
                monthlyEMI,
                startDate: today,
                endDate,
                currency,
                status: "ACTIVE",
            },
            installments,
            summary: {
                totalPaid: 0,
                totalRemaining: totalEMIAmount,
                totalLateFees: 0,
                installmentsPaid: 0,
                installmentsRemaining: tenure,
                installmentsOverdue: 0,
                nextDueDate: installments[0].dueDate,
            },
            commissionSettings: {
                emiCommissionRate,
                lateFeeCommissionRate: commissionSettings?.emiCommissionSettings?.lateFeeCommissionRate || 0,
                totalAdminCommission: 0,
                totalNegotiationCommission: negotiationCommission,
                totalNegotiationCommissionPaid: 0,
                totalFleetOwnerAmount: 0,
            },
            statusHistory: [
                {
                    status: "ACTIVE",
                    changedAt: new Date(),
                    changedBy: corporateOwnerId,
                    reason: "EMI plan created",
                },
            ],
        })

        await emiPayment.save()

        // Update contract with EMI info
        contract.financials.paymentMode = "EMI"
        contract.financials.emiPaymentId = emiPayment._id
        contract.financials.emiPlanSummary = {
            tenure,
            monthlyEMI,
            totalPaid: 0,
            totalRemaining: totalEMIAmount,
            nextDueDate: installments[0].dueDate,
            installmentsPaid: 0,
            installmentsOverdue: 0,
            negotiationCommissionIncluded: negotiationCommission,
        }
        contract.financials.paymentStatus = "PARTIAL"

        // Mark negotiation commission as EMI-included (not PAID yet, will be paid with each EMI)
        if (negotiationCommission > 0 && contract.negotiationCommission) {
            contract.negotiationCommission.commissionStatus = "EMI_INCLUDED"
        }

        // For EMI, security deposit is waived
        contract.financials.securityDeposit.status = "WAIVED_FOR_EMI"

        // Activate contract immediately for EMI
        contract.status = "ACTIVE"
        contract.activatedAt = new Date()
        contract.statusHistory.push({
            status: "ACTIVE",
            changedAt: new Date(),
            changedBy: corporateOwnerId,
            reason: `Contract activated with ${tenure}-month EMI plan. Total EMI: ${currency} ${totalEMIAmount} (Contract: ${contractAmount} + Negotiation: ${negotiationCommission}). Security deposit waived.`,
        })

        await contract.save()

        // Get names for notifications
        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || "Corporate"
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || "Fleet Owner"

        // Notify B2B Partner about EMI plan creation
        await createNotification({
            userId: contract.fleetOwnerId._id,
            type: "EMI_PLAN_CREATED",
            title: "EMI Payment Plan Created",
            message: `${corporateName} has opted for ${tenure}-month EMI plan for contract ${contract.contractNumber}. Monthly EMI: ${currency} ${monthlyEMI}. Contract is now active.`,
            data: { contractId, emiPaymentId: emiPayment._id, tenure, monthlyEMI, currency },
        })

        // Notify Admin
        await sendAdminNotification(
            "EMI Payment Plan Created",
            `${corporateName} (CORPORATE) created ${tenure}-month EMI plan for contract with ${fleetName}. Total: ${currency} ${totalEMIAmount}, Monthly EMI: ${currency} ${monthlyEMI}`,
            "EMI_PLAN_CREATED",
            { contractId, emiPaymentId: emiPayment._id, corporateId: corporateOwnerId, fleetOwnerId: contract.fleetOwnerId._id }
        )

        res.status(201).json({
            success: true,
            message: `EMI plan created successfully! Your contract is now active. First EMI of ${currency} ${installments[0].amount} is due on ${installments[0].dueDate.toLocaleDateString()}`,
            data: { emiPayment, contract },
        })
    } catch (error) {
        console.error("[v0] Error creating EMI plan:", error)
        res.status(500).json({
            success: false,
            message: "Failed to create EMI plan",
            error: error.message,
        })
    }
}

// @desc    Get EMI Payment Plan by Contract ID
// @route   GET /api/emi-payments/contract/:contractId
// @access  Private (CORPORATE or B2B_PARTNER)
export const getEMIPlanByContract = async (req, res) => {
    try {
        const { contractId } = req.params
        const userId = req.userId

        const emiPayment = await EMIPayment.findOne({ contractId })
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber status")

        if (!emiPayment) {
            return res.status(404).json({
                success: false,
                message: "EMI payment plan not found for this contract",
            })
        }

        // Check access
        if (
            emiPayment.corporateOwnerId._id.toString() !== userId &&
            emiPayment.fleetOwnerId._id.toString() !== userId
        ) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            })
        }

        res.status(200).json({
            success: true,
            data: { emiPayment },
        })
    } catch (error) {
        console.error("[v0] Error fetching EMI plan:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch EMI plan",
            error: error.message,
        })
    }
}


// @desc    Get EMI Eligibility for a Contract
// @route   GET /api/emi-payments/eligibility/:contractId
// @access  Private (CORPORATE or B2B_PARTNER)
export const getEMIEligibility = async (req, res) => {
    try {
        const { contractId } = req.params

        console.log("[v0] Get EMI eligibility request:", { contractId })

        // Get contract
        const contract = await Contract.findById(contractId)

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Calculate contract duration in months
        const { durationType, duration, startDate, endDate } = contract.rentalPeriod
        let contractDurationMonths = 0

        if (durationType === "DAILY") {
            contractDurationMonths = Math.ceil(duration / 30)
        } else if (durationType === "WEEKLY") {
            contractDurationMonths = Math.ceil((duration * 7) / 30)
        } else if (durationType === "MONTHLY" || durationType === "LONG_TERM") {
            contractDurationMonths = duration
        } else if (startDate && endDate) {
            const start = new Date(startDate)
            const end = new Date(endDate)
            const diffTime = Math.abs(end - start)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            contractDurationMonths = Math.ceil(diffDays / 30)
        }

        // Check EMI eligibility (minimum 3 months)
        const isEligible = contractDurationMonths >= 3

        // Generate available tenure options based on contract duration
        const allTenures = [3, 6, 9, 12, 18, 24]
        const availableTenures = allTenures.filter(t => t <= contractDurationMonths)

        // Check if EMI already exists
        const existingEMI = await EMIPayment.findOne({ contractId })

        res.json({
            success: true,
            data: {
                contractId,
                contractDurationMonths,
                durationType: contract.rentalPeriod.durationType,
                duration: contract.rentalPeriod.duration,
                isEligible,
                availableTenures,
                existingEMI: existingEMI ? {
                    _id: existingEMI._id,
                    tenure: existingEMI.emiPlan.tenure,
                    status: existingEMI.emiPlan.status,
                } : null,
                message: isEligible
                    ? `EMI payment is available for this ${contractDurationMonths}-month contract.`
                    : `EMI payment is not available for contracts shorter than 3 months. Your contract duration is ${contractDurationMonths} month(s).`,
            }
        })

    } catch (error) {
        console.error("[v0] Get EMI eligibility error:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get EMI eligibility",
            error: error.message,
        })
    }
}


// @desc    Pay EMI Installment
// @route   POST /api/emi-payments/:emiPaymentId/pay-installment
// @access  Private (CORPORATE only)
export const payEMIInstallment = async (req, res) => {
    try {
        const { emiPaymentId } = req.params
        const { installmentNumber, paymentMethod } = req.body
        const corporateOwnerId = req.userId

        console.log("[v0] Pay EMI installment request:", { emiPaymentId, installmentNumber, paymentMethod })

        const emiPayment = await EMIPayment.findById(emiPaymentId)
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber")

        if (!emiPayment) {
            return res.status(404).json({
                success: false,
                message: "EMI payment plan not found",
            })
        }

        // Verify corporate owner
        if (emiPayment.corporateOwnerId._id.toString() !== corporateOwnerId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to pay this EMI",
            })
        }

        // Find the installment
        const installmentIndex = emiPayment.installments.findIndex(
            (i) => i.installmentNumber === installmentNumber
        )

        if (installmentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Installment not found",
            })
        }

        const installment = emiPayment.installments[installmentIndex]

        if (installment.status === "PAID") {
            return res.status(400).json({
                success: false,
                message: "This installment is already paid",
            })
        }

        // Check and apply late fee if overdue
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const dueDate = new Date(installment.dueDate)
        dueDate.setHours(0, 0, 0, 0)

        if (today > dueDate && installment.lateFee === 0) {
            const lateFee = Math.round((installment.amount * installment.lateFeePercentage) / 100)
            installment.lateFee = lateFee
            installment.totalAmountDue = installment.amount + lateFee
        }

        const totalAmountDue = installment.totalAmountDue || installment.amount
        const currency = emiPayment.emiPlan.currency

        const reference = `EMI-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

        // Handle different payment methods
        if (["CARD", "WALLET", "KNET", "APPLE_PAY", "GOOGLE_PAY"].includes(paymentMethod)) {
            const country = detectCountryFromCurrency(currency)
            const gateway = getPaymentGateway(country)

            try {
                const paymentSession = await paymentGatewayService.createPaymentSession({
                    gateway,
                    amount: totalAmountDue,
                    currency,
                    customer: {
                        email: emiPayment.corporateOwnerId.email,
                        name: emiPayment.corporateOwnerId.companyName || emiPayment.corporateOwnerId.fullName,
                    },
                    contractId: emiPayment.contractId._id,
                    redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/emi-payment/callback?provider=${gateway.toLowerCase()}`,
                    metadata: {
                        emiPaymentId: emiPayment._id,
                        installmentNumber,
                        paymentType: "EMI",
                    },
                })

                // Update installment with pending payment info
                installment.paymentMethod = paymentMethod
                installment.paymentProvider = gateway
                installment.gatewaySessionId = paymentSession.sessionId

                await emiPayment.save()

                return res.status(200).json({
                    success: true,
                    message: "Payment session created",
                    data: {
                        paymentSession,
                        installment: {
                            installmentNumber,
                            amount: totalAmountDue,
                            currency,
                        },
                    },
                })
            } catch (error) {
                console.error("[v0] EMI payment session error:", error)
                return res.status(500).json({
                    success: false,
                    message: "Failed to create payment session",
                    error: error.message,
                })
            }
        } else if (paymentMethod === "BANK_TRANSFER" || paymentMethod === "CASH") {
            // Manual payment - requires admin verification
            installment.paymentMethod = paymentMethod
            installment.paymentProvider = "MANUAL"
            installment.transactionId = reference
            installment.verificationStatus = "PENDING"

            await emiPayment.save()

            // Get names for notifications
            const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName

            // Notify B2B Partner
            await createNotification({
                userId: emiPayment.fleetOwnerId._id,
                type: "EMI_PAYMENT_SUBMITTED",
                title: "EMI Payment Submitted",
                message: `${corporateName} has submitted EMI installment ${installmentNumber} payment via ${paymentMethod}. Amount: ${currency} ${totalAmountDue}. Awaiting verification.`,
                data: { emiPaymentId, installmentNumber, amount: totalAmountDue, currency },
            })

            // Notify Admin
            await sendAdminNotification(
                "EMI Payment Requires Verification",
                `${corporateName} submitted ${paymentMethod} payment for EMI installment ${installmentNumber}. Amount: ${currency} ${totalAmountDue}. Contract: ${emiPayment.contractId.contractNumber}`,
                "EMI_PAYMENT_PENDING_VERIFICATION",
                { emiPaymentId, installmentNumber, corporateId: corporateOwnerId }
            )

            return res.status(200).json({
                success: true,
                message: "Payment submitted. Awaiting admin verification.",
                data: {
                    reference,
                    installment: {
                        installmentNumber,
                        amount: totalAmountDue,
                        currency,
                        status: "PENDING",
                        verificationStatus: "PENDING",
                    },
                },
            })
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method",
            })
        }
    } catch (error) {
        console.error("[v0] Error paying EMI installment:", error)
        res.status(500).json({
            success: false,
            message: "Failed to process EMI payment",
            error: error.message,
        })
    }
}

// @desc    Verify EMI Payment (by Admin)
// @route   POST /api/emi-payments/:emiPaymentId/verify-payment
// @access  Private (ADMIN only)
export const verifyEMIPayment = async (req, res) => {
    try {
        const { emiPaymentId } = req.params
        const { installmentNumber, action, notes } = req.body
        const adminId = req.userId

        console.log("[v0] Verify EMI payment:", { emiPaymentId, installmentNumber, action })

        if (!["VERIFY", "REJECT"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Invalid action. Must be 'VERIFY' or 'REJECT'",
            })
        }

        const emiPayment = await EMIPayment.findById(emiPaymentId)
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber")

        if (!emiPayment) {
            return res.status(404).json({
                success: false,
                message: "EMI payment plan not found",
            })
        }

        const installmentIndex = emiPayment.installments.findIndex(
            (i) => i.installmentNumber === installmentNumber
        )

        if (installmentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Installment not found",
            })
        }

        const installment = emiPayment.installments[installmentIndex]

        if (installment.verificationStatus !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: "This payment is not pending verification",
            })
        }

        const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName
        const fleetName = emiPayment.fleetOwnerId?.companyName || emiPayment.fleetOwnerId?.fullName
        const currency = emiPayment.emiPlan.currency

        if (action === "VERIFY") {
            installment.status = "PAID"
            installment.paidAt = new Date()
            installment.verificationStatus = "VERIFIED"
            installment.verifiedBy = adminId
            installment.verifiedAt = new Date()
            installment.notes = notes
            installment.adminCommission.status = "CREDITED"
            installment.adminCommission.creditedAt = new Date()
            installment.fleetOwnerCredited = true
            installment.fleetOwnerCreditedAt = new Date()

            // Mark negotiation commission as credited for this installment
            if (installment.negotiationCommissionPortion > 0) {
                installment.negotiationCommissionCredited = true
                installment.negotiationCommissionCreditedAt = new Date()
            }

            // Credit B2B Partner wallet (only the fleet owner's portion of contract amount)
            const fleetOwnerWallet = await Wallet.findOne({ userId: emiPayment.fleetOwnerId._id })
            if (fleetOwnerWallet) {
                fleetOwnerWallet.balance += installment.fleetOwnerAmount
                fleetOwnerWallet.totalEarnings += installment.fleetOwnerAmount
                fleetOwnerWallet.transactions.push({
                    type: "DEPOSIT",
                    amount: installment.fleetOwnerAmount,
                    description: `EMI Payment - Installment ${installmentNumber}/${emiPayment.emiPlan.tenure} - Contract ${emiPayment.contractId.contractNumber} (Contract portion: ${installment.contractAmountPortion} - Commission: ${installment.adminCommission.amount})`,
                    status: "COMPLETED",
                    senderId: emiPayment.corporateOwnerId._id,
                    senderName: corporateName,
                })
                await fleetOwnerWallet.save()
                console.log("[v0] B2B Partner wallet credited:", installment.fleetOwnerAmount)
            }

            // Credit Admin wallet - TWO parts: Contract Commission + Negotiation Commission
            const adminWallet = await Wallet.findOne({ role: "ADMIN" })
            if (adminWallet) {
                // 1. Credit contract commission (from B2B partner's share)
                if (installment.adminCommission.amount > 0) {
                    adminWallet.balance += installment.adminCommission.amount
                    adminWallet.totalEarnings += installment.adminCommission.amount
                    adminWallet.transactions.push({
                        type: "COMMISSION_DEDUCTION",
                        amount: installment.adminCommission.amount,
                        description: `EMI Commission (${installment.adminCommission.rate}%) - Installment ${installmentNumber}/${emiPayment.emiPlan.tenure} - Contract ${emiPayment.contractId.contractNumber}`,
                        status: "COMPLETED",
                        senderId: emiPayment.fleetOwnerId._id,
                        senderName: fleetName,
                    })
                    console.log("[v0] Admin wallet credited with contract commission:", installment.adminCommission.amount)
                }

                // 2. Credit negotiation commission (from Corporate's payment for negotiation service)
                if (installment.negotiationCommissionPortion > 0) {
                    adminWallet.balance += installment.negotiationCommissionPortion
                    adminWallet.totalEarnings += installment.negotiationCommissionPortion
                    adminWallet.transactions.push({
                        type: "NEGOTIATION_COMMISSION",
                        amount: installment.negotiationCommissionPortion,
                        description: `Negotiation Commission (EMI Portion) - Installment ${installmentNumber}/${emiPayment.emiPlan.tenure} - Contract ${emiPayment.contractId.contractNumber}`,
                        status: "COMPLETED",
                        senderId: emiPayment.corporateOwnerId._id,
                        senderName: corporateName,
                    })
                    console.log("[v0] Admin wallet credited with negotiation commission:", installment.negotiationCommissionPortion)
                }

                await adminWallet.save()
            }

            // Update EMI summary
            emiPayment.updateSummary()
            emiPayment.commissionSettings.totalAdminCommission += installment.adminCommission.amount
            emiPayment.commissionSettings.totalNegotiationCommissionPaid += (installment.negotiationCommissionPortion || 0)
            emiPayment.commissionSettings.totalFleetOwnerAmount += installment.fleetOwnerAmount

            // Update contract EMI summary
            const contract = await Contract.findById(emiPayment.contractId._id)
            if (contract) {
                contract.financials.emiPlanSummary = {
                    tenure: emiPayment.emiPlan.tenure,
                    monthlyEMI: emiPayment.emiPlan.monthlyEMI,
                    totalPaid: emiPayment.summary.totalPaid,
                    totalRemaining: emiPayment.summary.totalRemaining,
                    nextDueDate: emiPayment.summary.nextDueDate,
                    installmentsPaid: emiPayment.summary.installmentsPaid,
                    installmentsOverdue: emiPayment.summary.installmentsOverdue,
                }

                if (emiPayment.emiPlan.status === "COMPLETED") {
                    contract.financials.paymentStatus = "COMPLETED"
                }

                await contract.save()
            }

            // Generate and send invoice
            const invoiceHTML = generateEMIInvoiceHTML(
                emiPayment,
                installment,
                emiPayment.contractId,
                emiPayment.corporateOwnerId,
                emiPayment.fleetOwnerId
            )

            const invoiceSent = await sendEMIInvoiceEmail(
                emiPayment.corporateOwnerId.email,
                invoiceHTML,
                installmentNumber,
                emiPayment.contractId.contractNumber
            )

            if (invoiceSent) {
                installment.invoiceSent = true
                installment.invoiceSentAt = new Date()
            }

            await emiPayment.save()

            // Notify Corporate
            await createNotification({
                userId: emiPayment.corporateOwnerId._id,
                type: "EMI_PAYMENT_VERIFIED",
                title: "EMI Payment Verified",
                message: `Your EMI installment ${installmentNumber} payment of ${currency} ${installment.totalAmountDue || installment.amount} has been verified. Invoice sent to your email.`,
                data: { emiPaymentId, installmentNumber },
            })

            // Notify B2B Partner
            await createNotification({
                userId: emiPayment.fleetOwnerId._id,
                type: "EMI_PAYMENT_CREDITED",
                title: "EMI Payment Credited",
                message: `EMI payment of ${currency} ${installment.fleetOwnerAmount} has been credited to your wallet for installment ${installmentNumber}.`,
                data: { emiPaymentId, installmentNumber, amount: installment.fleetOwnerAmount },
            })

            res.status(200).json({
                success: true,
                message: "EMI payment verified and processed successfully",
                data: { emiPayment },
            })
        } else {
            // Reject
            installment.verificationStatus = "REJECTED"
            installment.verifiedBy = adminId
            installment.verifiedAt = new Date()
            installment.notes = notes
            installment.status = "PENDING" // Reset to pending

            await emiPayment.save()

            // Notify Corporate
            await createNotification({
                userId: emiPayment.corporateOwnerId._id,
                type: "EMI_PAYMENT_REJECTED",
                title: "EMI Payment Rejected",
                message: `Your EMI installment ${installmentNumber} payment was rejected. Reason: ${notes || "Please contact support."}`,
                data: { emiPaymentId, installmentNumber, reason: notes },
            })

            res.status(200).json({
                success: true,
                message: "EMI payment rejected",
                data: { emiPayment },
            })
        }
    } catch (error) {
        console.error("[v0] Error verifying EMI payment:", error)
        res.status(500).json({
            success: false,
            message: "Failed to verify EMI payment",
            error: error.message,
        })
    }
}

// @desc    Verify EMI Payment from Online Gateway (Callback)
// @route   GET/POST /api/emi-payments/verify-online
// @access  Public (callback from payment gateway)
// export const verifyEMIOnlinePayment = async (req, res) => {
//     try {
//         // Support both GET (query params) and POST (body params)
//         const session_id = req.query.session_id || req.body.sessionId || req.body.session_id
//         const provider = req.query.provider || req.body.provider

//         console.log("[v0] EMI online payment verification:", { session_id, provider, method: req.method })

//         if (!session_id) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Missing session_id"
//             })
//         }

//         // If provider is missing, try to detect from session or default to stripe
//         let paymentProvider = provider

//         // IDEMPOTENCY: Use findOneAndUpdate with atomic operation to prevent race conditions
//         // This atomically marks the installment as PROCESSING to prevent duplicate processing
//         const emiPayment = await EMIPayment.findOneAndUpdate(
//             {
//                 "installments.gatewaySessionId": session_id,
//                 "installments.verificationStatus": { $nin: ["PROCESSING", "VERIFIED"] }
//             },
//             {
//                 $set: {
//                     "installments.$.verificationStatus": "PROCESSING"
//                 }
//             },
//             { new: true }
//         )
//             .populate("corporateOwnerId", "fullName email companyName")
//             .populate("fleetOwnerId", "fullName email companyName")
//             .populate("contractId", "contractNumber")

//         if (!emiPayment) {
//             // Check if it's already processed or doesn't exist
//             const existingPayment = await EMIPayment.findOne({
//                 "installments.gatewaySessionId": session_id
//             })
//                 .populate("corporateOwnerId", "fullName email companyName")
//                 .populate("fleetOwnerId", "fullName email companyName")
//                 .populate("contractId", "contractNumber")

//             if (existingPayment) {
//                 const existingInstallment = existingPayment.installments.find(i => i.gatewaySessionId === session_id)
//                 if (existingInstallment && (existingInstallment.status === "PAID" || existingInstallment.verificationStatus === "VERIFIED")) {
//                     console.log("[v0] EMI payment already processed, returning success")
//                     return res.status(200).json({
//                         success: true,
//                         message: "Payment already processed",
//                         data: {
//                             emiPayment: existingPayment,
//                             installmentNumber: existingInstallment.installmentNumber,
//                             amount: existingInstallment.amount,
//                             contractId: existingPayment.contractId?._id,
//                             transactionId: existingInstallment.transactionId
//                         }
//                     })
//                 }
//                 if (existingInstallment && existingInstallment.verificationStatus === "PROCESSING") {
//                     console.log("[v0] EMI payment is being processed by another request")
//                     return res.status(200).json({
//                         success: true,
//                         message: "Payment is being processed",
//                         data: {
//                             emiPayment: existingPayment,
//                             installmentNumber: existingInstallment.installmentNumber,
//                             amount: existingInstallment.amount,
//                             contractId: existingPayment.contractId?._id
//                         }
//                     })
//                 }
//             }

//             return res.status(404).json({
//                 success: false,
//                 message: "EMI payment not found for this session"
//             })
//         }

//         // Find the specific installment
//         const installment = emiPayment.installments.find(i => i.gatewaySessionId === session_id)

//         if (!installment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Installment not found"
//             })
//         }

//         // Already paid check (backup)
//         if (installment.status === "PAID") {
//             return res.status(200).json({
//                 success: true,
//                 message: "Payment already processed",
//                 data: {
//                     emiPayment,
//                     installmentNumber: installment.installmentNumber,
//                     amount: installment.amount,
//                     contractId: emiPayment.contractId?._id,
//                     transactionId: installment.transactionId
//                 }
//             })
//         }

//         // Determine provider from installment record if not provided
//         if (!paymentProvider) {
//             paymentProvider = installment.paymentProvider || "STRIPE"
//         }

//         console.log("[v0] Using payment provider:", paymentProvider)

//         // Verify with payment gateway
//         const verificationResult = await paymentGatewayService.verifyPayment(paymentProvider.toUpperCase(), session_id)

//         console.log("[v0] EMI verification result:", verificationResult)

//         if (verificationResult.success && verificationResult.status === "COMPLETED") {
//             const currency = emiPayment.emiPlan.currency
//             const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName
//             const fleetName = emiPayment.fleetOwnerId?.companyName || emiPayment.fleetOwnerId?.fullName

//             // Update installment status - wallet crediting flags will be set after actual crediting
//             installment.status = "PAID"
//             installment.paidAt = new Date()
//             installment.transactionId = verificationResult.transactionId
//             installment.verificationStatus = "VERIFIED"

//             // Credit B2B Partner wallet - ONLY if not already credited
//             // This is an additional safeguard even though atomic update above should prevent duplicates
//             if (!installment.fleetOwnerCredited) {
//                 const fleetOwnerWallet = await Wallet.findOne({ userId: emiPayment.fleetOwnerId._id })
//                 if (fleetOwnerWallet) {
//                     fleetOwnerWallet.balance += installment.fleetOwnerAmount
//                     fleetOwnerWallet.totalEarnings += installment.fleetOwnerAmount
//                     fleetOwnerWallet.transactions.push({
//                         type: "DEPOSIT",
//                         amount: installment.fleetOwnerAmount,
//                         description: `EMI Payment (Online) - Installment ${installment.installmentNumber}/${emiPayment.emiPlan.tenure} - Contract ${emiPayment.contractId.contractNumber}`,
//                         status: "COMPLETED",
//                         senderId: emiPayment.corporateOwnerId._id,
//                         senderName: corporateName,
//                     })
//                     await fleetOwnerWallet.save()
//                     installment.fleetOwnerCredited = true
//                     installment.fleetOwnerCreditedAt = new Date()
//                     console.log("[v0] B2B Partner wallet credited via online EMI:", installment.fleetOwnerAmount)
//                 }
//             } else {
//                 console.log("[v0] B2B Partner wallet already credited for installment:", installment.installmentNumber)
//             }

//             // Credit Admin wallet - Contract Commission + Negotiation Commission
//             // ONLY if not already credited
//             if (installment.adminCommission?.status !== "CREDITED") {
//                 const adminWallet = await Wallet.findOne({ role: "ADMIN" })
//                 if (adminWallet) {
//                     // Contract commission
//                     if (installment.adminCommission.amount > 0) {
//                         adminWallet.balance += installment.adminCommission.amount
//                         adminWallet.totalEarnings += installment.adminCommission.amount
//                         adminWallet.transactions.push({
//                             type: "COMMISSION_DEDUCTION",
//                             amount: installment.adminCommission.amount,
//                             description: `EMI Commission (${installment.adminCommission.rate}%) - Installment ${installment.installmentNumber} - Contract ${emiPayment.contractId.contractNumber}`,
//                             status: "COMPLETED",
//                             senderId: emiPayment.fleetOwnerId._id,
//                             senderName: fleetName,
//                         })
//                         console.log("[v0] Admin wallet credited with contract commission (online):", installment.adminCommission.amount)
//                     }

//                     // Negotiation commission
//                     if (installment.negotiationCommissionPortion > 0 && !installment.negotiationCommissionCredited) {
//                         adminWallet.balance += installment.negotiationCommissionPortion
//                         adminWallet.totalEarnings += installment.negotiationCommissionPortion
//                         adminWallet.transactions.push({
//                             type: "NEGOTIATION_COMMISSION",
//                             amount: installment.negotiationCommissionPortion,
//                             description: `Negotiation Commission (EMI) - Installment ${installment.installmentNumber} - Contract ${emiPayment.contractId.contractNumber}`,
//                             status: "COMPLETED",
//                             senderId: emiPayment.corporateOwnerId._id,
//                             senderName: corporateName,
//                         })
//                         installment.negotiationCommissionCredited = true
//                         installment.negotiationCommissionCreditedAt = new Date()
//                         console.log("[v0] Admin wallet credited with negotiation commission (online):", installment.negotiationCommissionPortion)
//                     }

//                     await adminWallet.save()
//                     installment.adminCommission.status = "CREDITED"
//                     installment.adminCommission.creditedAt = new Date()
//                 }
//             } else {
//                 console.log("[v0] Admin wallet already credited for installment:", installment.installmentNumber)
//             }

//             // Update EMI summary
//             emiPayment.updateSummary()
//             emiPayment.commissionSettings.totalAdminCommission += installment.adminCommission.amount
//             emiPayment.commissionSettings.totalNegotiationCommissionPaid += (installment.negotiationCommissionPortion || 0)
//             emiPayment.commissionSettings.totalFleetOwnerAmount += installment.fleetOwnerAmount

//             // Update contract EMI summary
//             const contract = await Contract.findById(emiPayment.contractId._id)
//             if (contract) {
//                 contract.financials.emiPlanSummary = {
//                     tenure: emiPayment.emiPlan.tenure,
//                     monthlyEMI: emiPayment.emiPlan.monthlyEMI,
//                     totalPaid: emiPayment.summary.totalPaid,
//                     totalRemaining: emiPayment.summary.totalRemaining,
//                     nextDueDate: emiPayment.summary.nextDueDate,
//                     installmentsPaid: emiPayment.summary.installmentsPaid,
//                     installmentsOverdue: emiPayment.summary.installmentsOverdue,
//                 }

//                 if (emiPayment.emiPlan.status === "COMPLETED") {
//                     contract.financials.paymentStatus = "COMPLETED"
//                 }

//                 await contract.save()
//             }

//             // Generate and send invoice
//             const invoiceHTML = generateEMIInvoiceHTML(
//                 emiPayment,
//                 installment,
//                 emiPayment.contractId,
//                 emiPayment.corporateOwnerId,
//                 emiPayment.fleetOwnerId
//             )

//             await sendEMIInvoiceEmail(
//                 emiPayment.corporateOwnerId.email,
//                 invoiceHTML,
//                 installment.installmentNumber,
//                 emiPayment.contractId.contractNumber
//             )

//             await emiPayment.save()

//             // Notify Corporate
//             await createNotification({
//                 userId: emiPayment.corporateOwnerId._id,
//                 type: "EMI_PAYMENT_COMPLETED",
//                 title: "EMI Payment Completed",
//                 message: `Your EMI installment ${installment.installmentNumber} payment of ${currency} ${installment.totalAmountDue || installment.amount} has been completed. Invoice sent to your email.`,
//                 data: { emiPaymentId: emiPayment._id, installmentNumber: installment.installmentNumber },
//             })

//             // Notify B2B Partner
//             await createNotification({
//                 userId: emiPayment.fleetOwnerId._id,
//                 type: "EMI_PAYMENT_CREDITED",
//                 title: "EMI Payment Credited",
//                 message: `EMI payment of ${currency} ${installment.fleetOwnerAmount} has been credited to your wallet for installment ${installment.installmentNumber}.`,
//                 data: { emiPaymentId: emiPayment._id, installmentNumber: installment.installmentNumber, amount: installment.fleetOwnerAmount },
//             })

//             return res.status(200).json({
//                 success: true,
//                 message: "EMI payment verified and processed successfully",
//                 data: {
//                     emiPayment,
//                     installmentNumber: installment.installmentNumber,
//                     amount: installment.amount,
//                     contractId: emiPayment.contractId?._id,
//                     transactionId: installment.transactionId || verificationResult.transactionId
//                 }
//             })
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: "Payment verification failed",
//                 error: verificationResult.message
//             })
//         }
//     } catch (error) {
//         console.error("[v0] Error verifying EMI online payment:", error)
//         return res.status(500).json({
//             success: false,
//             message: "Failed to verify EMI payment",
//             error: error.message
//         })
//     }
// }

// @desc    Send EMI Payment Warning (by Admin)
// @route   POST /api/emi-payments/:emiPaymentId/send-warning
// @access  Private (ADMIN only)
// export const sendEMIWarning = async (req, res) => {
//     try {
//         const { emiPaymentId } = req.params
//         const { warningType, message } = req.body
//         const adminId = req.userId

//         const emiPayment = await EMIPayment.findById(emiPaymentId)
//             .populate("corporateOwnerId", "fullName email companyName")
//             .populate("fleetOwnerId", "fullName email companyName")
//             .populate("contractId", "contractNumber")

//         if (!emiPayment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "EMI payment plan not found",
//             })
//         }

//         const overdueInstallments = emiPayment.installments.filter((i) => i.status === "OVERDUE")
//         const overdueAmount = overdueInstallments.reduce((sum, i) => sum + (i.totalAmountDue || i.amount), 0)
//         const currency = emiPayment.emiPlan.currency

//         // Add warning record
//         emiPayment.warnings.push({
//             type: warningType,
//             sentAt: new Date(),
//             sentBy: adminId,
//             message,
//             overdueAmount,
//             overdueInstallments: overdueInstallments.length,
//         })

//         await emiPayment.save()

//         // Send email
//         const transporter = nodemailer.createTransport({
//             host: process.env.EMAIL_HOST || "smtp.gmail.com",
//             port: process.env.EMAIL_PORT || 587,
//             secure: process.env.EMAIL_SECURE === "true",
//             auth: {
//                 user: process.env.EMAIL_USER,
//                 pass: process.env.EMAIL_PASS,
//             },
//         })

//         const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName

//         await transporter.sendMail({
//             from: process.env.EMAIL_USER,
//             to: emiPayment.corporateOwnerId.email,
//             subject: `[URGENT] EMI Payment Warning - Contract ${emiPayment.contractId.contractNumber}`,
//             html: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                     <div style="background: #dc3545; color: white; padding: 20px; border-radius: 10px; text-align: center;">
//                         <h2>EMI Payment Warning</h2>
//                     </div>
//                     <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
//                         <h3>Dear ${corporateName},</h3>
//                         <p style="color: #dc3545; font-weight: bold;">${message}</p>
//                         <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
//                             <p><strong>Contract:</strong> ${emiPayment.contractId.contractNumber}</p>
//                             <p><strong>Overdue Installments:</strong> ${overdueInstallments.length}</p>
//                             <p><strong>Total Overdue Amount:</strong> ${currency} ${overdueAmount.toFixed(2)}</p>
//                         </div>
//                         <p>Please make the payment at the earliest to avoid service suspension.</p>
//                     </div>
//                 </div>
//             `,
//         })

//         // Notify Corporate
//         await createNotification({
//             userId: emiPayment.corporateOwnerId._id,
//             type: "EMI_PAYMENT_WARNING",
//             title: "EMI Payment Warning",
//             message,
//             data: { emiPaymentId, overdueAmount, overdueInstallments: overdueInstallments.length },
//         })

//         res.status(200).json({
//             success: true,
//             message: "Warning sent successfully",
//         })
//     } catch (error) {
//         console.error("[v0] Error sending EMI warning:", error)
//         res.status(500).json({
//             success: false,
//             message: "Failed to send warning",
//             error: error.message,
//         })
//     }
// }

// @desc    Request Service Suspension (by B2B Partner)
// @route   POST /api/emi-payments/:emiPaymentId/request-suspension
// @access  Private (B2B_PARTNER only)
// export const requestServiceSuspension = async (req, res) => {
//     try {
//         const { emiPaymentId } = req.params
//         const { reason } = req.body
//         const fleetOwnerId = req.userId

//         const emiPayment = await EMIPayment.findById(emiPaymentId)
//             .populate("corporateOwnerId", "fullName email companyName")
//             .populate("fleetOwnerId", "fullName email companyName")
//             .populate("contractId", "contractNumber")

//         if (!emiPayment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "EMI payment plan not found",
//             })
//         }

//         if (emiPayment.fleetOwnerId._id.toString() !== fleetOwnerId) {
//             return res.status(403).json({
//                 success: false,
//                 message: "Not authorized",
//             })
//         }

//         emiPayment.serviceSuspension.suspensionRequestedBy = fleetOwnerId
//         emiPayment.serviceSuspension.suspensionRequestedAt = new Date()
//         emiPayment.serviceSuspension.suspensionReason = reason

//         await emiPayment.save()

//         const fleetName = emiPayment.fleetOwnerId?.companyName || emiPayment.fleetOwnerId?.fullName
//         const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName

//         // Notify Admin
//         await sendAdminNotification(
//             "Service Suspension Request",
//             `${fleetName} (B2B_PARTNER) has requested suspension of services for ${corporateName} due to EMI payment defaults. Reason: ${reason}`,
//             "SERVICE_SUSPENSION_REQUEST",
//             { emiPaymentId, fleetOwnerId, corporateId: emiPayment.corporateOwnerId._id, reason }
//         )

//         res.status(200).json({
//             success: true,
//             message: "Suspension request sent to Admin",
//         })
//     } catch (error) {
//         console.error("[v0] Error requesting suspension:", error)
//         res.status(500).json({
//             success: false,
//             message: "Failed to request suspension",
//             error: error.message,
//         })
//     }
// }

// @desc    Suspend/Reactivate Service (by Admin)
// @route   POST /api/emi-payments/:emiPaymentId/toggle-service
// @access  Private (ADMIN only)
// export const toggleServiceStatus = async (req, res) => {
//     try {
//         const { emiPaymentId } = req.params
//         const { action, reason } = req.body
//         const adminId = req.userId

//         if (!["SUSPEND", "REACTIVATE"].includes(action)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid action. Must be 'SUSPEND' or 'REACTIVATE'",
//             })
//         }

//         const emiPayment = await EMIPayment.findById(emiPaymentId)
//             .populate("corporateOwnerId", "fullName email companyName")
//             .populate("fleetOwnerId", "fullName email companyName")
//             .populate("contractId", "contractNumber")

//         if (!emiPayment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "EMI payment plan not found",
//             })
//         }

//         const contract = await Contract.findById(emiPayment.contractId._id)
//         const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName
//         const fleetName = emiPayment.fleetOwnerId?.companyName || emiPayment.fleetOwnerId?.fullName

//         if (action === "SUSPEND") {
//             emiPayment.serviceSuspension.isSuspended = true
//             emiPayment.serviceSuspension.suspendedAt = new Date()
//             emiPayment.serviceSuspension.suspendedBy = adminId
//             emiPayment.serviceSuspension.suspensionReason = reason
//             emiPayment.emiPlan.status = "SUSPENDED"

//             if (contract) {
//                 contract.vehicleAccess = {
//                     isActive: false,
//                     reason: `EMI payment default: ${reason}`,
//                     blockedAt: new Date(),
//                     blockedBy: adminId,
//                 }
//                 await contract.save()
//             }

//             emiPayment.statusHistory.push({
//                 status: "SUSPENDED",
//                 changedAt: new Date(),
//                 changedBy: adminId,
//                 reason,
//             })

//             // Notify Corporate
//             await createNotification({
//                 userId: emiPayment.corporateOwnerId._id,
//                 type: "SERVICE_SUSPENDED",
//                 title: "Service Suspended",
//                 message: `Your services have been suspended due to EMI payment default. Reason: ${reason}. Please clear your dues to reactivate.`,
//                 data: { emiPaymentId, reason },
//             })

//             // Notify B2B Partner
//             await createNotification({
//                 userId: emiPayment.fleetOwnerId._id,
//                 type: "SERVICE_SUSPENDED",
//                 title: "Corporate Service Suspended",
//                 message: `Services for ${corporateName} have been suspended due to EMI payment default.`,
//                 data: { emiPaymentId },
//             })

//         } else {
//             emiPayment.serviceSuspension.isSuspended = false
//             emiPayment.serviceSuspension.reactivatedAt = new Date()
//             emiPayment.serviceSuspension.reactivatedBy = adminId
//             emiPayment.emiPlan.status = "ACTIVE"

//             if (contract) {
//                 contract.vehicleAccess = {
//                     isActive: true,
//                     reason: "Service reactivated after payment",
//                     blockedAt: null,
//                     blockedBy: null,
//                 }
//                 await contract.save()
//             }

//             emiPayment.statusHistory.push({
//                 status: "ACTIVE",
//                 changedAt: new Date(),
//                 changedBy: adminId,
//                 reason: "Service reactivated",
//             })

//             // Notify Corporate
//             await createNotification({
//                 userId: emiPayment.corporateOwnerId._id,
//                 type: "SERVICE_REACTIVATED",
//                 title: "Service Reactivated",
//                 message: `Your services have been reactivated. Thank you for clearing your dues.`,
//                 data: { emiPaymentId },
//             })

//             // Notify B2B Partner
//             await createNotification({
//                 userId: emiPayment.fleetOwnerId._id,
//                 type: "SERVICE_REACTIVATED",
//                 title: "Corporate Service Reactivated",
//                 message: `Services for ${corporateName} have been reactivated.`,
//                 data: { emiPaymentId },
//             })
//         }

//         await emiPayment.save()

//         res.status(200).json({
//             success: true,
//             message: action === "SUSPEND" ? "Service suspended" : "Service reactivated",
//             data: { emiPayment },
//         })
//     } catch (error) {
//         console.error("[v0] Error toggling service:", error)
//         res.status(500).json({
//             success: false,
//             message: "Failed to update service status",
//             error: error.message,
//         })
//     }
// }

// @desc    Get all EMI Payments for Admin
// @route   GET /api/emi-payments/admin/all
// @access  Private (ADMIN only)
// export const getAllEMIPaymentsAdmin = async (req, res) => {
//     try {
//         const { status, overdue } = req.query

//         let filter = {}
//         if (status) {
//             filter["emiPlan.status"] = status
//         }
//         if (overdue === "true") {
//             filter["summary.installmentsOverdue"] = { $gt: 0 }
//         }

//         const emiPayments = await EMIPayment.find(filter)
//             .populate("corporateOwnerId", "fullName email companyName")
//             .populate("fleetOwnerId", "fullName email companyName")
//             .populate("contractId", "contractNumber status")
//             .sort({ createdAt: -1 })

//         const stats = {
//             total: emiPayments.length,
//             active: emiPayments.filter((e) => e.emiPlan.status === "ACTIVE").length,
//             completed: emiPayments.filter((e) => e.emiPlan.status === "COMPLETED").length,
//             suspended: emiPayments.filter((e) => e.emiPlan.status === "SUSPENDED").length,
//             defaulted: emiPayments.filter((e) => e.emiPlan.status === "DEFAULTED").length,
//             totalOverdueInstallments: emiPayments.reduce((sum, e) => sum + e.summary.installmentsOverdue, 0),
//         }

//         res.status(200).json({
//             success: true,
//             data: { emiPayments, stats },
//         })
//     } catch (error) {
//         console.error("[v0] Error fetching all EMI payments:", error)
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch EMI payments",
//             error: error.message,
//         })
//     }
// }

// @desc    Get EMI Payments for Corporate
// @route   GET /api/emi-payments/corporate/all
// @access  Private (CORPORATE only)
// export const getCorporateEMIPayments = async (req, res) => {
//     try {
//         const corporateOwnerId = req.userId

//         const emiPayments = await EMIPayment.find({ corporateOwnerId })
//             .populate("fleetOwnerId", "fullName email companyName")
//             .populate("contractId", "contractNumber status")
//             .sort({ createdAt: -1 })

//         res.status(200).json({
//             success: true,
//             data: { emiPayments },
//         })
//     } catch (error) {
//         console.error("[v0] Error fetching corporate EMI payments:", error)
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch EMI payments",
//             error: error.message,
//         })
//     }
// }

// @desc    Get EMI Payments for B2B Partner
// @route   GET /api/emi-payments/b2b/all
// @access  Private (B2B_PARTNER only)
// export const getB2BPartnerEMIPayments = async (req, res) => {
//     try {
//         const fleetOwnerId = req.userId

//         const emiPayments = await EMIPayment.find({ fleetOwnerId })
//             .populate("corporateOwnerId", "fullName email companyName")
//             .populate("contractId", "contractNumber status")
//             .sort({ createdAt: -1 })

//         res.status(200).json({
//             success: true,
//             data: { emiPayments },
//         })
//     } catch (error) {
//         console.error("[v0] Error fetching B2B EMI payments:", error)
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch EMI payments",
//             error: error.message,
//         })
//     }
// }


// @desc    Handle EMI Stripe Webhook
// @route   POST /api/emi-payments/webhook/stripe
// @access  Public (Stripe webhook)
// export const handleEMIStripeWebhook = async (req, res) => {
//     const sig = req.headers["stripe-signature"]
//     let event

//     try {
//         // Use EMI-specific webhook secret or fallback to payment webhook secret
//         const webhookSecret = process.env.STRIPE_EMI_WEBHOOK_SECRET || process.env.STRIPE_PAYMENT_WEBHOOK_SECRET
//         event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
//     } catch (err) {
//         console.log("[v0] EMI Webhook signature verification failed:", err.message)
//         return res.status(400).send(`Webhook Error: ${err.message}`)
//     }

//     console.log("[v0] EMI Stripe webhook event type:", event.type)

//     if (event.type === "checkout.session.completed") {
//         const session = event.data.object
//         const metadata = session.metadata || {}

//         console.log("[v0] EMI webhook session metadata:", metadata)

//         // Only process EMI payments
//         if (metadata.paymentType !== "EMI") {
//             console.log("[v0] Not an EMI payment, skipping")
//             return res.json({ received: true })
//         }

//         const emiPaymentId = metadata.emiPaymentId
//         const installmentNumber = parseInt(metadata.installmentNumber)

//         if (!emiPaymentId || !installmentNumber) {
//             console.log("[v0] Missing EMI payment metadata")
//             return res.json({ received: true })
//         }

//         try {
//             // IDEMPOTENCY: Use atomic findOneAndUpdate to prevent duplicate processing
//             const emiPayment = await EMIPayment.findOneAndUpdate(
//                 {
//                     _id: emiPaymentId,
//                     "installments.installmentNumber": installmentNumber,
//                     "installments.status": { $ne: "PAID" },
//                     "installments.verificationStatus": { $nin: ["VERIFIED", "PROCESSING"] }
//                 },
//                 {
//                     $set: {
//                         "installments.$.verificationStatus": "WEBHOOK_PROCESSING"
//                     }
//                 },
//                 { new: true }
//             )
//                 .populate("contractId")
//                 .populate("corporateOwnerId")
//                 .populate("fleetOwnerId")

//             if (!emiPayment) {
//                 console.log("[v0] EMI payment already processed or not found:", emiPaymentId)
//                 return res.json({ received: true })
//             }

//             const installment = emiPayment.installments.find(
//                 i => i.installmentNumber === installmentNumber
//             )

//             if (!installment) {
//                 console.log("[v0] Installment not found")
//                 return res.json({ received: true })
//             }

//             // Update installment
//             installment.status = "PAID"
//             installment.paidAt = new Date()
//             installment.transactionId = session.payment_intent
//             installment.gatewaySessionId = session.id
//             installment.verificationStatus = "VERIFIED"

//             // Update EMI summary
//             emiPayment.paidInstallments = emiPayment.installments.filter(i => i.status === "PAID").length
//             emiPayment.totalPaid = emiPayment.installments
//                 .filter(i => i.status === "PAID")
//                 .reduce((sum, i) => sum + i.amount, 0)
//             emiPayment.remainingAmount = emiPayment.totalAmount - emiPayment.totalPaid

//             // Check if all installments are paid
//             if (emiPayment.paidInstallments === emiPayment.totalInstallments) {
//                 emiPayment.status = "COMPLETED"
//             }

//             // Update next due date
//             const nextPending = emiPayment.installments.find(i => i.status === "PENDING")
//             if (nextPending) {
//                 emiPayment.nextDueDate = nextPending.dueDate
//             } else {
//                 emiPayment.nextDueDate = null
//             }

//             // Credit fleet owner wallet
//             const fleetOwnerWallet = await Wallet.findOne({ userId: emiPayment.fleetOwnerId._id })
//             if (fleetOwnerWallet && installment.fleetOwnerAmount > 0) {
//                 fleetOwnerWallet.balance += installment.fleetOwnerAmount
//                 fleetOwnerWallet.totalEarnings += installment.fleetOwnerAmount
//                 fleetOwnerWallet.transactions.push({
//                     type: "DEPOSIT",
//                     amount: installment.fleetOwnerAmount,
//                     description: `EMI Payment (Webhook) - Installment ${installmentNumber}/${emiPayment.emiPlan.tenure}`,
//                     reference: `EMI-${emiPayment._id}-${installmentNumber}`,
//                     status: "COMPLETED",
//                     paymentMethod: "card",
//                     createdAt: new Date()
//                 })
//                 await fleetOwnerWallet.save()
//                 installment.fleetOwnerCredited = true
//                 installment.fleetOwnerCreditedAt = new Date()
//             }

//             // Credit admin wallet
//             const adminUserId = process.env.ADMIN_USER_ID
//             if (adminUserId && installment.adminCommission?.amount > 0) {
//                 let adminWallet = await Wallet.findOne({ userId: adminUserId })
//                 if (!adminWallet) {
//                     adminWallet = await Wallet.create({
//                         userId: adminUserId,
//                         role: "ADMIN",
//                         balance: 0,
//                         currency: emiPayment.emiPlan.currency || "AED"
//                     })
//                 }
//                 adminWallet.balance += installment.adminCommission.amount
//                 adminWallet.totalEarnings += installment.adminCommission.amount
//                 adminWallet.transactions.push({
//                     type: "COMMISSION",
//                     amount: installment.adminCommission.amount,
//                     description: `EMI Commission - Installment ${installmentNumber}/${emiPayment.emiPlan.tenure}`,
//                     reference: `EMI-COMM-${emiPayment._id}-${installmentNumber}`,
//                     status: "COMPLETED",
//                     createdAt: new Date()
//                 })
//                 await adminWallet.save()
//                 installment.adminCommission.status = "CREDITED"
//                 installment.adminCommission.creditedAt = new Date()
//             }

//             await emiPayment.save()

//             console.log("[v0] EMI payment processed via webhook:", {
//                 emiPaymentId,
//                 installmentNumber,
//                 transactionId: session.payment_intent
//             })

//             // Send notification
//             try {
//                 await createNotification({
//                     recipientId: emiPayment.corporateOwnerId._id,
//                     recipientRole: "CORPORATE",
//                     type: "PAYMENT",
//                     title: "EMI Payment Successful",
//                     message: `Your EMI installment #${installmentNumber} of AED ${installment.amount.toLocaleString()} has been processed.`,
//                     data: {
//                         emiPaymentId: emiPayment._id,
//                         contractId: emiPayment.contractId._id,
//                         installmentNumber,
//                         amount: installment.amount
//                     }
//                 })
//             } catch (notifErr) {
//                 console.error("[v0] EMI notification error:", notifErr)
//             }
//         } catch (err) {
//             console.error("[v0] EMI webhook processing error:", err)
//         }
//     }

//     return res.json({ received: true })
// }




// @desc    Verify EMI Payment from Online Gateway (Callback)
// @route   GET/POST /api/emi-payments/verify-online
// @access  Public (callback from payment gateway)
export const verifyEMIOnlinePayment = async (req, res) => {
    try {
        // Support both GET (query params) and POST (body params)
        const session_id = req.query.session_id || req.body.sessionId || req.body.session_id
        const provider = req.query.provider || req.body.provider

        console.log("[v0] EMI online payment verification:", { session_id, provider, method: req.method })

        if (!session_id) {
            return res.status(400).json({
                success: false,
                message: "Missing session_id"
            })
        }

        // If provider is missing, try to detect from session or default to stripe
        let paymentProvider = provider

        // First, find the EMI payment with the session_id to check its current state
        let emiPayment = await EMIPayment.findOne({
            "installments.gatewaySessionId": session_id
        })
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber")

        console.log("[v0] Found EMI payment:", emiPayment ? emiPayment._id : "not found")

        if (!emiPayment) {
            console.log("[v0] No EMI payment found with gatewaySessionId:", session_id)
            return res.status(404).json({
                success: false,
                message: "EMI payment not found for this session"
            })
        }

        // Find the specific installment
        const installmentIndex = emiPayment.installments.findIndex(i => i.gatewaySessionId === session_id)

        if (installmentIndex === -1) {
            console.log("[v0] No installment found with gatewaySessionId:", session_id)
            return res.status(404).json({
                success: false,
                message: "Installment not found"
            })
        }

        let installment = emiPayment.installments[installmentIndex]
        console.log("[v0] Found installment:", {
            number: installment.installmentNumber,
            status: installment.status,
            verificationStatus: installment.verificationStatus
        })

        // Check if already processed
        if (installment.status === "PAID" || installment.verificationStatus === "VERIFIED") {
            console.log("[v0] EMI payment already processed, returning success")
            return res.status(200).json({
                success: true,
                message: "Payment already processed",
                data: {
                    emiPayment,
                    installmentNumber: installment.installmentNumber,
                    amount: installment.amount,
                    contractId: emiPayment.contractId?._id,
                    transactionId: installment.transactionId
                }
            })
        }

        // Check if being processed by another request
        if (installment.verificationStatus === "PROCESSING") {
            console.log("[v0] EMI payment is being processed by another request")
            return res.status(200).json({
                success: true,
                message: "Payment is being processed",
                data: {
                    emiPayment,
                    installmentNumber: installment.installmentNumber,
                    amount: installment.amount,
                    contractId: emiPayment.contractId?._id
                }
            })
        }

        // Atomically mark as PROCESSING using array element update with index
        const updateResult = await EMIPayment.findOneAndUpdate(
            {
                _id: emiPayment._id,
                [`installments.${installmentIndex}.verificationStatus`]: { $ne: "PROCESSING" }
            },
            {
                $set: {
                    [`installments.${installmentIndex}.verificationStatus`]: "PROCESSING"
                }
            },
            { new: true }
        )
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber")

        if (!updateResult) {
            // Another request got there first
            console.log("[v0] EMI payment is being processed by another request (race condition)")
            return res.status(200).json({
                success: true,
                message: "Payment is being processed",
                data: {
                    emiPayment,
                    installmentNumber: installment.installmentNumber,
                    amount: installment.amount,
                    contractId: emiPayment.contractId?._id
                }
            })
        }

        // Use the updated document
        emiPayment = updateResult

        // Re-fetch the specific installment from updated document
        installment = emiPayment.installments.find(i => i.gatewaySessionId === session_id)

        if (!installment) {
            return res.status(404).json({
                success: false,
                message: "Installment not found"
            })
        }

        // Already paid check (backup)
        if (installment.status === "PAID") {
            return res.status(200).json({
                success: true,
                message: "Payment already processed",
                data: {
                    emiPayment,
                    installmentNumber: installment.installmentNumber,
                    amount: installment.amount,
                    contractId: emiPayment.contractId?._id,
                    transactionId: installment.transactionId
                }
            })
        }

        // Determine provider from installment record if not provided
        if (!paymentProvider) {
            paymentProvider = installment.paymentProvider || "STRIPE"
        }

        console.log("[v0] Using payment provider:", paymentProvider)

        // Verify with payment gateway
        const verificationResult = await paymentGatewayService.verifyPayment(paymentProvider.toUpperCase(), session_id)

        console.log("[v0] EMI verification result:", verificationResult)

        if (verificationResult.success && verificationResult.status === "COMPLETED") {
            const currency = emiPayment.emiPlan.currency
            const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName
            const fleetName = emiPayment.fleetOwnerId?.companyName || emiPayment.fleetOwnerId?.fullName

            // Update installment status - wallet crediting flags will be set after actual crediting
            installment.status = "PAID"
            installment.paidAt = new Date()
            installment.transactionId = verificationResult.transactionId
            installment.verificationStatus = "VERIFIED"

            // Credit B2B Partner wallet - ONLY if not already credited
            // This is an additional safeguard even though atomic update above should prevent duplicates
            if (!installment.fleetOwnerCredited) {
                const fleetOwnerWallet = await Wallet.findOne({ userId: emiPayment.fleetOwnerId._id })
                if (fleetOwnerWallet) {
                    fleetOwnerWallet.balance += installment.fleetOwnerAmount
                    fleetOwnerWallet.totalEarnings += installment.fleetOwnerAmount
                    fleetOwnerWallet.transactions.push({
                        type: "DEPOSIT",
                        amount: installment.fleetOwnerAmount,
                        description: `EMI Payment (Online) - Installment ${installment.installmentNumber}/${emiPayment.emiPlan.tenure} - Contract ${emiPayment.contractId.contractNumber}`,
                        status: "COMPLETED",
                        senderId: emiPayment.corporateOwnerId._id,
                        senderName: corporateName,
                    })
                    await fleetOwnerWallet.save()
                    installment.fleetOwnerCredited = true
                    installment.fleetOwnerCreditedAt = new Date()
                    console.log("[v0] B2B Partner wallet credited via online EMI:", installment.fleetOwnerAmount)
                }
            } else {
                console.log("[v0] B2B Partner wallet already credited for installment:", installment.installmentNumber)
            }

            // Credit Admin wallet - Contract Commission + Negotiation Commission
            // ONLY if not already credited
            if (installment.adminCommission?.status !== "CREDITED") {
                const adminWallet = await Wallet.findOne({ role: "ADMIN" })
                if (adminWallet) {
                    // Contract commission
                    if (installment.adminCommission.amount > 0) {
                        adminWallet.balance += installment.adminCommission.amount
                        adminWallet.totalEarnings += installment.adminCommission.amount
                        adminWallet.transactions.push({
                            type: "COMMISSION_DEDUCTION",
                            amount: installment.adminCommission.amount,
                            description: `EMI Commission (${installment.adminCommission.rate}%) - Installment ${installment.installmentNumber} - Contract ${emiPayment.contractId.contractNumber}`,
                            status: "COMPLETED",
                            senderId: emiPayment.fleetOwnerId._id,
                            senderName: fleetName,
                        })
                        console.log("[v0] Admin wallet credited with contract commission (online):", installment.adminCommission.amount)
                    }

                    // Negotiation commission
                    if (installment.negotiationCommissionPortion > 0 && !installment.negotiationCommissionCredited) {
                        adminWallet.balance += installment.negotiationCommissionPortion
                        adminWallet.totalEarnings += installment.negotiationCommissionPortion
                        adminWallet.transactions.push({
                            type: "NEGOTIATION_COMMISSION",
                            amount: installment.negotiationCommissionPortion,
                            description: `Negotiation Commission (EMI) - Installment ${installment.installmentNumber} - Contract ${emiPayment.contractId.contractNumber}`,
                            status: "COMPLETED",
                            senderId: emiPayment.corporateOwnerId._id,
                            senderName: corporateName,
                        })
                        installment.negotiationCommissionCredited = true
                        installment.negotiationCommissionCreditedAt = new Date()
                        console.log("[v0] Admin wallet credited with negotiation commission (online):", installment.negotiationCommissionPortion)
                    }

                    await adminWallet.save()
                    installment.adminCommission.status = "CREDITED"
                    installment.adminCommission.creditedAt = new Date()
                }
            } else {
                console.log("[v0] Admin wallet already credited for installment:", installment.installmentNumber)
            }

            // Update EMI summary
            emiPayment.updateSummary()
            emiPayment.commissionSettings.totalAdminCommission += installment.adminCommission.amount
            emiPayment.commissionSettings.totalNegotiationCommissionPaid += (installment.negotiationCommissionPortion || 0)
            emiPayment.commissionSettings.totalFleetOwnerAmount += installment.fleetOwnerAmount

            // Update contract EMI summary
            const contract = await Contract.findById(emiPayment.contractId._id)
            if (contract) {
                contract.financials.emiPlanSummary = {
                    tenure: emiPayment.emiPlan.tenure,
                    monthlyEMI: emiPayment.emiPlan.monthlyEMI,
                    totalPaid: emiPayment.summary.totalPaid,
                    totalRemaining: emiPayment.summary.totalRemaining,
                    nextDueDate: emiPayment.summary.nextDueDate,
                    installmentsPaid: emiPayment.summary.installmentsPaid,
                    installmentsOverdue: emiPayment.summary.installmentsOverdue,
                }

                if (emiPayment.emiPlan.status === "COMPLETED") {
                    contract.financials.paymentStatus = "COMPLETED"
                }

                await contract.save()
            }

            // Generate and send invoice
            const invoiceHTML = generateEMIInvoiceHTML(
                emiPayment,
                installment,
                emiPayment.contractId,
                emiPayment.corporateOwnerId,
                emiPayment.fleetOwnerId
            )

            await sendEMIInvoiceEmail(
                emiPayment.corporateOwnerId.email,
                invoiceHTML,
                installment.installmentNumber,
                emiPayment.contractId.contractNumber
            )

            await emiPayment.save()

            // Notify Corporate
            await createNotification({
                userId: emiPayment.corporateOwnerId._id,
                type: "EMI_PAYMENT_COMPLETED",
                title: "EMI Payment Completed",
                message: `Your EMI installment ${installment.installmentNumber} payment of ${currency} ${installment.totalAmountDue || installment.amount} has been completed. Invoice sent to your email.`,
                data: { emiPaymentId: emiPayment._id, installmentNumber: installment.installmentNumber },
            })

            // Notify B2B Partner
            await createNotification({
                userId: emiPayment.fleetOwnerId._id,
                type: "EMI_PAYMENT_CREDITED",
                title: "EMI Payment Credited",
                message: `EMI payment of ${currency} ${installment.fleetOwnerAmount} has been credited to your wallet for installment ${installment.installmentNumber}.`,
                data: { emiPaymentId: emiPayment._id, installmentNumber: installment.installmentNumber, amount: installment.fleetOwnerAmount },
            })

            return res.status(200).json({
                success: true,
                message: "EMI payment verified and processed successfully",
                data: {
                    emiPayment,
                    installmentNumber: installment.installmentNumber,
                    amount: installment.amount,
                    contractId: emiPayment.contractId?._id,
                    transactionId: installment.transactionId || verificationResult.transactionId
                }
            })
        } else {
            // Reset verification status to allow retry
            installment.verificationStatus = "PENDING"
            await emiPayment.save()

            return res.status(400).json({
                success: false,
                message: "Payment verification failed. Please check your payment status or try again.",
                error: verificationResult.message
            })
        }
    } catch (error) {
        console.error("[v0] Error verifying EMI online payment:", error)

        // Try to reset verification status on error
        try {
            if (session_id) {
                await EMIPayment.updateOne(
                    { "installments.gatewaySessionId": session_id },
                    { $set: { "installments.$.verificationStatus": "PENDING" } }
                )
            }
        } catch (resetErr) {
            console.error("[v0] Error resetting verification status:", resetErr)
        }

        return res.status(500).json({
            success: false,
            message: "Failed to verify EMI payment",
            error: error.message
        })
    }
}

// @desc    Send EMI Payment Warning (by Admin)
// @route   POST /api/emi-payments/:emiPaymentId/send-warning
// @access  Private (ADMIN only)
export const sendEMIWarning = async (req, res) => {
    try {
        const { emiPaymentId } = req.params
        const { warningType, message } = req.body
        const adminId = req.userId

        const emiPayment = await EMIPayment.findById(emiPaymentId)
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber")

        if (!emiPayment) {
            return res.status(404).json({
                success: false,
                message: "EMI payment plan not found",
            })
        }

        const overdueInstallments = emiPayment.installments.filter((i) => i.status === "OVERDUE")
        const overdueAmount = overdueInstallments.reduce((sum, i) => sum + (i.totalAmountDue || i.amount), 0)
        const currency = emiPayment.emiPlan.currency

        // Add warning record
        emiPayment.warnings.push({
            type: warningType,
            sentAt: new Date(),
            sentBy: adminId,
            message,
            overdueAmount,
            overdueInstallments: overdueInstallments.length,
        })

        await emiPayment.save()

        // Send email
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || "smtp.gmail.com",
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_SECURE === "true",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        })

        const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: emiPayment.corporateOwnerId.email,
            subject: `[URGENT] EMI Payment Warning - Contract ${emiPayment.contractId.contractNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #dc3545; color: white; padding: 20px; border-radius: 10px; text-align: center;">
                        <h2>EMI Payment Warning</h2>
                    </div>
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
                        <h3>Dear ${corporateName},</h3>
                        <p style="color: #dc3545; font-weight: bold;">${message}</p>
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                            <p><strong>Contract:</strong> ${emiPayment.contractId.contractNumber}</p>
                            <p><strong>Overdue Installments:</strong> ${overdueInstallments.length}</p>
                            <p><strong>Total Overdue Amount:</strong> ${currency} ${overdueAmount.toFixed(2)}</p>
                        </div>
                        <p>Please make the payment at the earliest to avoid service suspension.</p>
                    </div>
                </div>
            `,
        })

        // Notify Corporate
        await createNotification({
            userId: emiPayment.corporateOwnerId._id,
            type: "EMI_PAYMENT_WARNING",
            title: "EMI Payment Warning",
            message,
            data: { emiPaymentId, overdueAmount, overdueInstallments: overdueInstallments.length },
        })

        res.status(200).json({
            success: true,
            message: "Warning sent successfully",
        })
    } catch (error) {
        console.error("[v0] Error sending EMI warning:", error)
        res.status(500).json({
            success: false,
            message: "Failed to send warning",
            error: error.message,
        })
    }
}

// @desc    Request Service Suspension (by B2B Partner)
// @route   POST /api/emi-payments/:emiPaymentId/request-suspension
// @access  Private (B2B_PARTNER only)
export const requestServiceSuspension = async (req, res) => {
    try {
        const { emiPaymentId } = req.params
        const { reason } = req.body
        const fleetOwnerId = req.userId

        const emiPayment = await EMIPayment.findById(emiPaymentId)
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber")

        if (!emiPayment) {
            return res.status(404).json({
                success: false,
                message: "EMI payment plan not found",
            })
        }

        if (emiPayment.fleetOwnerId._id.toString() !== fleetOwnerId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized",
            })
        }

        emiPayment.serviceSuspension.suspensionRequestedBy = fleetOwnerId
        emiPayment.serviceSuspension.suspensionRequestedAt = new Date()
        emiPayment.serviceSuspension.suspensionReason = reason

        await emiPayment.save()

        const fleetName = emiPayment.fleetOwnerId?.companyName || emiPayment.fleetOwnerId?.fullName
        const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName

        // Notify Admin
        await sendAdminNotification(
            "Service Suspension Request",
            `${fleetName} (B2B_PARTNER) has requested suspension of services for ${corporateName} due to EMI payment defaults. Reason: ${reason}`,
            "SERVICE_SUSPENSION_REQUEST",
            { emiPaymentId, fleetOwnerId, corporateId: emiPayment.corporateOwnerId._id, reason }
        )

        res.status(200).json({
            success: true,
            message: "Suspension request sent to Admin",
        })
    } catch (error) {
        console.error("[v0] Error requesting suspension:", error)
        res.status(500).json({
            success: false,
            message: "Failed to request suspension",
            error: error.message,
        })
    }
}

// @desc    Suspend/Reactivate Service (by Admin)
// @route   POST /api/emi-payments/:emiPaymentId/toggle-service
// @access  Private (ADMIN only)
export const toggleServiceStatus = async (req, res) => {
    try {
        const { emiPaymentId } = req.params
        const { action, reason } = req.body
        const adminId = req.userId

        if (!["SUSPEND", "REACTIVATE"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Invalid action. Must be 'SUSPEND' or 'REACTIVATE'",
            })
        }

        const emiPayment = await EMIPayment.findById(emiPaymentId)
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber")

        if (!emiPayment) {
            return res.status(404).json({
                success: false,
                message: "EMI payment plan not found",
            })
        }

        const contract = await Contract.findById(emiPayment.contractId._id)
        const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName
        const fleetName = emiPayment.fleetOwnerId?.companyName || emiPayment.fleetOwnerId?.fullName

        if (action === "SUSPEND") {
            emiPayment.serviceSuspension.isSuspended = true
            emiPayment.serviceSuspension.suspendedAt = new Date()
            emiPayment.serviceSuspension.suspendedBy = adminId
            emiPayment.serviceSuspension.suspensionReason = reason
            emiPayment.emiPlan.status = "SUSPENDED"

            if (contract) {
                contract.vehicleAccess = {
                    isActive: false,
                    reason: `EMI payment default: ${reason}`,
                    blockedAt: new Date(),
                    blockedBy: adminId,
                }
                await contract.save()
            }

            emiPayment.statusHistory.push({
                status: "SUSPENDED",
                changedAt: new Date(),
                changedBy: adminId,
                reason,
            })

            // Notify Corporate
            await createNotification({
                userId: emiPayment.corporateOwnerId._id,
                type: "SERVICE_SUSPENDED",
                title: "Service Suspended",
                message: `Your services have been suspended due to EMI payment default. Reason: ${reason}. Please clear your dues to reactivate.`,
                data: { emiPaymentId, reason },
            })

            // Notify B2B Partner
            await createNotification({
                userId: emiPayment.fleetOwnerId._id,
                type: "SERVICE_SUSPENDED",
                title: "Corporate Service Suspended",
                message: `Services for ${corporateName} have been suspended due to EMI payment default.`,
                data: { emiPaymentId },
            })

        } else {
            emiPayment.serviceSuspension.isSuspended = false
            emiPayment.serviceSuspension.reactivatedAt = new Date()
            emiPayment.serviceSuspension.reactivatedBy = adminId
            emiPayment.emiPlan.status = "ACTIVE"

            if (contract) {
                contract.vehicleAccess = {
                    isActive: true,
                    reason: "Service reactivated after payment",
                    blockedAt: null,
                    blockedBy: null,
                }
                await contract.save()
            }

            emiPayment.statusHistory.push({
                status: "ACTIVE",
                changedAt: new Date(),
                changedBy: adminId,
                reason: "Service reactivated",
            })

            // Notify Corporate
            await createNotification({
                userId: emiPayment.corporateOwnerId._id,
                type: "SERVICE_REACTIVATED",
                title: "Service Reactivated",
                message: `Your services have been reactivated. Thank you for clearing your dues.`,
                data: { emiPaymentId },
            })

            // Notify B2B Partner
            await createNotification({
                userId: emiPayment.fleetOwnerId._id,
                type: "SERVICE_REACTIVATED",
                title: "Corporate Service Reactivated",
                message: `Services for ${corporateName} have been reactivated.`,
                data: { emiPaymentId },
            })
        }

        await emiPayment.save()

        res.status(200).json({
            success: true,
            message: action === "SUSPEND" ? "Service suspended" : "Service reactivated",
            data: { emiPayment },
        })
    } catch (error) {
        console.error("[v0] Error toggling service:", error)
        res.status(500).json({
            success: false,
            message: "Failed to update service status",
            error: error.message,
        })
    }
}

// @desc    Get all EMI Payments for Admin
// @route   GET /api/emi-payments/admin/all
// @access  Private (ADMIN only)
export const getAllEMIPaymentsAdmin = async (req, res) => {
    try {
        const { status, overdue } = req.query

        let filter = {}
        if (status) {
            filter["emiPlan.status"] = status
        }
        if (overdue === "true") {
            filter["summary.installmentsOverdue"] = { $gt: 0 }
        }

        const emiPayments = await EMIPayment.find(filter)
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber status")
            .sort({ createdAt: -1 })

        const stats = {
            total: emiPayments.length,
            active: emiPayments.filter((e) => e.emiPlan.status === "ACTIVE").length,
            completed: emiPayments.filter((e) => e.emiPlan.status === "COMPLETED").length,
            suspended: emiPayments.filter((e) => e.emiPlan.status === "SUSPENDED").length,
            defaulted: emiPayments.filter((e) => e.emiPlan.status === "DEFAULTED").length,
            totalOverdueInstallments: emiPayments.reduce((sum, e) => sum + e.summary.installmentsOverdue, 0),
        }

        res.status(200).json({
            success: true,
            data: { emiPayments, stats },
        })
    } catch (error) {
        console.error("[v0] Error fetching all EMI payments:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch EMI payments",
            error: error.message,
        })
    }
}

// @desc    Get EMI Payments for Corporate
// @route   GET /api/emi-payments/corporate/all
// @access  Private (CORPORATE only)
export const getCorporateEMIPayments = async (req, res) => {
    try {
        const corporateOwnerId = req.userId

        const emiPayments = await EMIPayment.find({ corporateOwnerId })
            .populate("fleetOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber status")
            .sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            data: { emiPayments },
        })
    } catch (error) {
        console.error("[v0] Error fetching corporate EMI payments:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch EMI payments",
            error: error.message,
        })
    }
}

// @desc    Get EMI Payments for B2B Partner
// @route   GET /api/emi-payments/b2b/all
// @access  Private (B2B_PARTNER only)
export const getB2BPartnerEMIPayments = async (req, res) => {
    try {
        const fleetOwnerId = req.userId

        const emiPayments = await EMIPayment.find({ fleetOwnerId })
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("contractId", "contractNumber status")
            .sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            data: { emiPayments },
        })
    } catch (error) {
        console.error("[v0] Error fetching B2B EMI payments:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch EMI payments",
            error: error.message,
        })
    }
}

// @desc    Handle EMI Stripe Webhook
// @route   POST /api/emi-payments/webhook/stripe
// @access  Public (Stripe webhook)
export const handleEMIStripeWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"]
    let event

    try {
        // Use EMI-specific webhook secret or fallback to payment webhook secret
        const webhookSecret = process.env.STRIPE_EMI_WEBHOOK_SECRET || process.env.STRIPE_PAYMENT_WEBHOOK_SECRET
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    } catch (err) {
        console.log("[v0] EMI Webhook signature verification failed:", err.message)
        return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    console.log("[v0] EMI Stripe webhook event type:", event.type)

    if (event.type === "checkout.session.completed") {
        const session = event.data.object
        const metadata = session.metadata || {}

        console.log("[v0] EMI webhook session metadata:", metadata)

        // Only process EMI payments
        if (metadata.paymentType !== "EMI") {
            console.log("[v0] Not an EMI payment, skipping")
            return res.json({ received: true })
        }

        const emiPaymentId = metadata.emiPaymentId
        const installmentNumber = parseInt(metadata.installmentNumber)

        if (!emiPaymentId || !installmentNumber) {
            console.log("[v0] Missing EMI payment metadata")
            return res.json({ received: true })
        }

        try {
            // First, find the EMI payment to get the installment index
            let emiPayment = await EMIPayment.findById(emiPaymentId)
                .populate("contractId", "contractNumber")
                .populate("corporateOwnerId", "fullName email companyName")
                .populate("fleetOwnerId", "fullName email companyName")

            if (!emiPayment) {
                console.log("[v0] EMI payment not found:", emiPaymentId)
                return res.json({ received: true })
            }

            // Find the installment index
            const installmentIndex = emiPayment.installments.findIndex(
                i => i.installmentNumber === installmentNumber
            )

            if (installmentIndex === -1) {
                console.log("[v0] Installment not found:", installmentNumber)
                return res.json({ received: true })
            }

            const installment = emiPayment.installments[installmentIndex]

            // Already paid check
            if (installment.status === "PAID" || installment.verificationStatus === "VERIFIED") {
                console.log("[v0] EMI payment already processed:", emiPaymentId, installmentNumber)
                return res.json({ received: true })
            }

            // Atomically mark as processing
            const updateResult = await EMIPayment.findOneAndUpdate(
                {
                    _id: emiPaymentId,
                    [`installments.${installmentIndex}.status`]: { $ne: "PAID" },
                    [`installments.${installmentIndex}.verificationStatus`]: { $nin: ["VERIFIED", "PROCESSING"] }
                },
                {
                    $set: {
                        [`installments.${installmentIndex}.verificationStatus`]: "PROCESSING"
                    }
                },
                { new: true }
            )
                .populate("contractId", "contractNumber")
                .populate("corporateOwnerId", "fullName email companyName")
                .populate("fleetOwnerId", "fullName email companyName")

            if (!updateResult) {
                console.log("[v0] EMI payment already being processed:", emiPaymentId)
                return res.json({ received: true })
            }

            emiPayment = updateResult
            const updatedInstallment = emiPayment.installments[installmentIndex]
            const currency = emiPayment.emiPlan.currency
            const corporateName = emiPayment.corporateOwnerId?.companyName || emiPayment.corporateOwnerId?.fullName
            const fleetName = emiPayment.fleetOwnerId?.companyName || emiPayment.fleetOwnerId?.fullName

            // Update installment
            updatedInstallment.status = "PAID"
            updatedInstallment.paidAt = new Date()
            updatedInstallment.transactionId = session.payment_intent
            updatedInstallment.gatewaySessionId = session.id
            updatedInstallment.verificationStatus = "VERIFIED"

            // Credit fleet owner wallet - ONLY if not already credited
            if (!updatedInstallment.fleetOwnerCredited) {
                const fleetOwnerWallet = await Wallet.findOne({ userId: emiPayment.fleetOwnerId._id })
                if (fleetOwnerWallet && updatedInstallment.fleetOwnerAmount > 0) {
                    fleetOwnerWallet.balance += updatedInstallment.fleetOwnerAmount
                    fleetOwnerWallet.totalEarnings += updatedInstallment.fleetOwnerAmount
                    fleetOwnerWallet.transactions.push({
                        type: "DEPOSIT",
                        amount: updatedInstallment.fleetOwnerAmount,
                        description: `EMI Payment (Webhook) - Installment ${installmentNumber}/${emiPayment.emiPlan.tenure} - Contract ${emiPayment.contractId.contractNumber}`,
                        status: "COMPLETED",
                        senderId: emiPayment.corporateOwnerId._id,
                        senderName: corporateName,
                    })
                    await fleetOwnerWallet.save()
                    updatedInstallment.fleetOwnerCredited = true
                    updatedInstallment.fleetOwnerCreditedAt = new Date()
                    console.log("[v0] B2B Partner wallet credited via webhook:", updatedInstallment.fleetOwnerAmount)
                }
            }

            // Credit admin wallet - ONLY if not already credited
            if (updatedInstallment.adminCommission?.status !== "CREDITED") {
                const adminWallet = await Wallet.findOne({ role: "ADMIN" })
                if (adminWallet) {
                    // Contract commission
                    if (updatedInstallment.adminCommission.amount > 0) {
                        adminWallet.balance += updatedInstallment.adminCommission.amount
                        adminWallet.totalEarnings += updatedInstallment.adminCommission.amount
                        adminWallet.transactions.push({
                            type: "COMMISSION_DEDUCTION",
                            amount: updatedInstallment.adminCommission.amount,
                            description: `EMI Commission (${updatedInstallment.adminCommission.rate}%) - Installment ${installmentNumber} - Contract ${emiPayment.contractId.contractNumber}`,
                            status: "COMPLETED",
                            senderId: emiPayment.fleetOwnerId._id,
                            senderName: fleetName,
                        })
                        console.log("[v0] Admin wallet credited with contract commission (webhook):", updatedInstallment.adminCommission.amount)
                    }

                    // Negotiation commission
                    if (updatedInstallment.negotiationCommissionPortion > 0 && !updatedInstallment.negotiationCommissionCredited) {
                        adminWallet.balance += updatedInstallment.negotiationCommissionPortion
                        adminWallet.totalEarnings += updatedInstallment.negotiationCommissionPortion
                        adminWallet.transactions.push({
                            type: "NEGOTIATION_COMMISSION",
                            amount: updatedInstallment.negotiationCommissionPortion,
                            description: `Negotiation Commission (EMI) - Installment ${installmentNumber} - Contract ${emiPayment.contractId.contractNumber}`,
                            status: "COMPLETED",
                            senderId: emiPayment.corporateOwnerId._id,
                            senderName: corporateName,
                        })
                        updatedInstallment.negotiationCommissionCredited = true
                        updatedInstallment.negotiationCommissionCreditedAt = new Date()
                        console.log("[v0] Admin wallet credited with negotiation commission (webhook):", updatedInstallment.negotiationCommissionPortion)
                    }

                    await adminWallet.save()
                    updatedInstallment.adminCommission.status = "CREDITED"
                    updatedInstallment.adminCommission.creditedAt = new Date()
                }
            }

            // Update EMI summary using the model method
            emiPayment.updateSummary()
            emiPayment.commissionSettings.totalAdminCommission += updatedInstallment.adminCommission.amount
            emiPayment.commissionSettings.totalNegotiationCommissionPaid += (updatedInstallment.negotiationCommissionPortion || 0)
            emiPayment.commissionSettings.totalFleetOwnerAmount += updatedInstallment.fleetOwnerAmount

            // Update contract EMI summary
            const contract = await Contract.findById(emiPayment.contractId._id)
            if (contract) {
                contract.financials.emiPlanSummary = {
                    tenure: emiPayment.emiPlan.tenure,
                    monthlyEMI: emiPayment.emiPlan.monthlyEMI,
                    totalPaid: emiPayment.summary.totalPaid,
                    totalRemaining: emiPayment.summary.totalRemaining,
                    nextDueDate: emiPayment.summary.nextDueDate,
                    installmentsPaid: emiPayment.summary.installmentsPaid,
                    installmentsOverdue: emiPayment.summary.installmentsOverdue,
                }

                if (emiPayment.emiPlan.status === "COMPLETED") {
                    contract.financials.paymentStatus = "COMPLETED"
                }

                await contract.save()
            }

            await emiPayment.save()

            console.log("[v0] EMI payment processed via webhook:", {
                emiPaymentId,
                installmentNumber,
                transactionId: session.payment_intent
            })

            // Send notifications
            try {
                await createNotification({
                    userId: emiPayment.corporateOwnerId._id,
                    type: "EMI_PAYMENT_COMPLETED",
                    title: "EMI Payment Successful",
                    message: `Your EMI installment #${installmentNumber} of ${currency} ${updatedInstallment.amount.toLocaleString()} has been processed.`,
                    data: {
                        emiPaymentId: emiPayment._id,
                        contractId: emiPayment.contractId._id,
                        installmentNumber,
                        amount: updatedInstallment.amount
                    }
                })

                await createNotification({
                    userId: emiPayment.fleetOwnerId._id,
                    type: "EMI_PAYMENT_CREDITED",
                    title: "EMI Payment Credited",
                    message: `EMI payment of ${currency} ${updatedInstallment.fleetOwnerAmount} has been credited to your wallet for installment ${installmentNumber}.`,
                    data: { emiPaymentId: emiPayment._id, installmentNumber, amount: updatedInstallment.fleetOwnerAmount },
                })
            } catch (notifErr) {
                console.error("[v0] EMI notification error:", notifErr)
            }
        } catch (err) {
            console.error("[v0] EMI webhook processing error:", err)

            // Try to reset verification status on error so callback can retry
            try {
                if (emiPaymentId && installmentNumber) {
                    await EMIPayment.updateOne(
                        { _id: emiPaymentId, "installments.installmentNumber": installmentNumber },
                        { $set: { "installments.$.verificationStatus": "PENDING" } }
                    )
                }
            } catch (resetErr) {
                console.error("[v0] Error resetting verification status:", resetErr)
            }
        }
    }

    return res.json({ received: true })
}
