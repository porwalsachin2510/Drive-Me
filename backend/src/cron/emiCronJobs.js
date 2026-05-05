import cron from "node-cron"
import EMIPayment from "../models/EMIPayment.js"
import Contract from "../models/Contract.js"
import CommissionSettings from "../models/CommissionSettings.js"
import { sendEmail, sendEMIReminderEmail, sendEMIOverdueEmail, sendEMIInvoiceEmail } from "../Services/emailService.js"
import { createNotification } from "../controllers/notificationController.js"

/**
 * EMI Reminder Cron Jobs
 * - Daily reminder check for upcoming EMI payments
 * - Mark overdue installments
 * - Send warning emails for overdue payments
 */

// Check for upcoming EMI due dates and send reminders
// Runs daily at 9:00 AM
const sendEMIReminders = async () => {
    console.log("[EMI Cron] Running EMI reminder check...")

    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Find active EMI plans
        const activeEMIs = await EMIPayment.find({
            status: { $in: ["ACTIVE", "OVERDUE"] },
        }).populate([
            { path: "corporateId", select: "fullName companyName email" },
            { path: "contractId", select: "contractNumber" },
        ])

        for (const emi of activeEMIs) {
            // Find next pending installment
            const nextInstallment = emi.installments.find(
                (i) => i.status === "PENDING" || i.status === "OVERDUE"
            )

            if (!nextInstallment) continue

            const dueDate = new Date(nextInstallment.dueDate)
            dueDate.setHours(0, 0, 0, 0)

            const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

            // Send reminder 7 days before, 3 days before, and on due date
            if ([7, 3, 0].includes(daysUntilDue)) {
                const corporateName = emi.corporateId?.companyName || emi.corporateId?.fullName || "Customer"
                const contractNumber = emi.contractId?.contractNumber || "N/A"

                // Send email reminder
                if (emi.corporateId?.email) {
                    try {
                        await sendEMIReminderEmail({
                            to: emi.corporateId.email,
                            corporateName,
                            contractNumber,
                            installmentNumber: nextInstallment.installmentNumber,
                            amount: nextInstallment.emiAmount,
                            currency: emi.currency || "AED",
                            dueDate: dueDate.toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            }),
                            daysUntilDue,
                        })
                        console.log(`[EMI Cron] Sent ${daysUntilDue}-day reminder to ${emi.corporateId.email}`)
                    } catch (emailError) {
                        console.error(`[EMI Cron] Failed to send reminder email:`, emailError.message)
                    }
                }

                // Create notification
                await createNotification({
                    userId: emi.corporateId._id,
                    type: "EMI_REMINDER",
                    title: daysUntilDue === 0
                        ? "EMI Payment Due Today"
                        : `EMI Payment Due in ${daysUntilDue} Days`,
                    message: `Your EMI payment of ${emi.currency || "AED"} ${nextInstallment.emiAmount.toFixed(2)} for Contract ${contractNumber} is ${daysUntilDue === 0 ? "due today" : `due in ${daysUntilDue} days`
                        }.`,
                    data: {
                        emiPaymentId: emi._id,
                        contractId: emi.contractId._id,
                        installmentNumber: nextInstallment.installmentNumber,
                        amount: nextInstallment.emiAmount,
                        dueDate: nextInstallment.dueDate,
                    },
                })
            }
        }

        console.log("[EMI Cron] EMI reminder check completed")
    } catch (error) {
        console.error("[EMI Cron] Error in EMI reminder job:", error)
    }
}

// Mark overdue installments and apply late fees
// Runs daily at midnight
const processOverdueInstallments = async () => {
    console.log("[EMI Cron] Processing overdue installments...")

    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const activeEMIs = await EMIPayment.find({
            status: { $in: ["ACTIVE", "OVERDUE"] },
        }).populate([
            { path: "corporateId", select: "fullName companyName email" },
            { path: "fleetOwnerId", select: "fullName companyName email" },
            { path: "contractId", select: "contractNumber" },
        ])

        for (const emi of activeEMIs) {
            let hasOverdue = false
            let overdueCount = 0

            // Get commission settings for late fee
            const commissionSettings = await CommissionSettings.findOne({ userId: emi.corporateId._id })
            const lateFeePercentage = commissionSettings?.emiCommissionSettings?.lateFeePercentage ?? 2
            const gracePeriodDays = commissionSettings?.emiCommissionSettings?.gracePeriodDays ?? 0

            for (const installment of emi.installments) {
                if (installment.status !== "PENDING") continue

                const dueDate = new Date(installment.dueDate)
                dueDate.setHours(0, 0, 0, 0)

                // Add grace period
                const graceDueDate = new Date(dueDate)
                graceDueDate.setDate(graceDueDate.getDate() + gracePeriodDays)

                if (today > graceDueDate) {
                    // Mark as overdue
                    installment.status = "OVERDUE"
                    hasOverdue = true
                    overdueCount++

                    // Calculate late fee (only if not already applied)
                    if (!installment.lateFee || installment.lateFee === 0) {
                        installment.lateFee = (installment.emiAmount * lateFeePercentage) / 100
                        installment.totalAmountDue = installment.emiAmount + installment.lateFee
                    }
                }
            }

            if (hasOverdue) {
                emi.status = "OVERDUE"
                emi.overdueInstallments = emi.installments.filter((i) => i.status === "OVERDUE")

                await emi.save()

                // Update contract EMI summary
                await Contract.findByIdAndUpdate(emi.contractId._id, {
                    "financials.emiPlanSummary.installmentsOverdue": overdueCount,
                })

                console.log(`[EMI Cron] Marked ${overdueCount} installments as overdue for EMI ${emi._id}`)
            }
        }

        console.log("[EMI Cron] Overdue processing completed")
    } catch (error) {
        console.error("[EMI Cron] Error processing overdue installments:", error)
    }
}

// Send overdue warning emails
// Runs daily at 10:00 AM
const sendOverdueWarnings = async () => {
    console.log("[EMI Cron] Sending overdue warnings...")

    try {
        const overdueEMIs = await EMIPayment.find({
            status: "OVERDUE",
        }).populate([
            { path: "corporateId", select: "fullName companyName email" },
            { path: "fleetOwnerId", select: "fullName companyName email" },
            { path: "contractId", select: "contractNumber" },
        ])

        for (const emi of overdueEMIs) {
            const overdueCount = emi.overdueInstallments?.length || 0

            if (overdueCount === 0) continue

            // Get commission settings for thresholds
            const commissionSettings = await CommissionSettings.findOne({ userId: emi.corporateId._id })
            const warningThreshold = commissionSettings?.emiCommissionSettings?.overdueWarningThreshold ?? 2
            const suspensionThreshold = commissionSettings?.emiCommissionSettings?.suspensionThreshold ?? 3

            const corporateName = emi.corporateId?.companyName || emi.corporateId?.fullName || "Customer"
            const contractNumber = emi.contractId?.contractNumber || "N/A"

            // Calculate total overdue amount
            const totalOverdue = emi.overdueInstallments.reduce(
                (sum, i) => sum + (i.totalAmountDue || i.emiAmount + (i.lateFee || 0)),
                0
            )

            // Send warning based on overdue count
            if (overdueCount >= warningThreshold && overdueCount < suspensionThreshold) {
                // Send warning email
                if (emi.corporateId?.email) {
                    try {
                        await sendEMIOverdueEmail({
                            to: emi.corporateId.email,
                            corporateName,
                            contractNumber,
                            overdueCount,
                            totalOverdue,
                            currency: emi.currency || "AED",
                            warningLevel: "WARNING",
                            suspensionThreshold,
                        })

                        // Update warning count
                        emi.warningsSent = (emi.warningsSent || 0) + 1
                        emi.lastWarningDate = new Date()
                        await emi.save()

                        console.log(`[EMI Cron] Sent warning email to ${emi.corporateId.email}`)
                    } catch (emailError) {
                        console.error(`[EMI Cron] Failed to send warning email:`, emailError.message)
                    }
                }

                // Notify B2B Partner
                if (emi.fleetOwnerId) {
                    await createNotification({
                        userId: emi.fleetOwnerId._id,
                        type: "EMI_OVERDUE_ALERT",
                        title: "Corporate EMI Payment Overdue",
                        message: `${corporateName} has ${overdueCount} overdue EMI payment(s) for Contract ${contractNumber}. Total due: ${emi.currency || "AED"} ${totalOverdue.toFixed(2)}.`,
                        data: {
                            emiPaymentId: emi._id,
                            corporateId: emi.corporateId._id,
                            overdueCount,
                            totalOverdue,
                        },
                    })
                }
            } else if (overdueCount >= suspensionThreshold) {
                // Send critical warning - service may be suspended
                if (emi.corporateId?.email) {
                    try {
                        await sendEMIOverdueEmail({
                            to: emi.corporateId.email,
                            corporateName,
                            contractNumber,
                            overdueCount,
                            totalOverdue,
                            currency: emi.currency || "AED",
                            warningLevel: "CRITICAL",
                            suspensionThreshold,
                        })

                        emi.warningsSent = (emi.warningsSent || 0) + 1
                        emi.lastWarningDate = new Date()
                        await emi.save()

                        console.log(`[EMI Cron] Sent critical warning to ${emi.corporateId.email}`)
                    } catch (emailError) {
                        console.error(`[EMI Cron] Failed to send critical warning:`, emailError.message)
                    }
                }

                // Notify B2B Partner that they can request suspension
                if (emi.fleetOwnerId) {
                    await createNotification({
                        userId: emi.fleetOwnerId._id,
                        type: "EMI_SUSPENSION_ELIGIBLE",
                        title: "Corporate Eligible for Service Suspension",
                        message: `${corporateName} has ${overdueCount} overdue payments and is eligible for service suspension. You can request Admin to suspend their services.`,
                        data: {
                            emiPaymentId: emi._id,
                            corporateId: emi.corporateId._id,
                            overdueCount,
                            totalOverdue,
                        },
                    })
                }
            }
        }

        console.log("[EMI Cron] Overdue warnings completed")
    } catch (error) {
        console.error("[EMI Cron] Error sending overdue warnings:", error)
    }
}

// Initialize cron jobs
export const initEMICronJobs = () => {
    console.log("[EMI Cron] Initializing EMI cron jobs...")

    // Send reminders daily at 9:00 AM
    cron.schedule("0 9 * * *", sendEMIReminders, {
        timezone: "Asia/Dubai",
    })

    // Process overdue installments daily at midnight
    cron.schedule("0 0 * * *", processOverdueInstallments, {
        timezone: "Asia/Dubai",
    })

    // Send overdue warnings daily at 10:00 AM
    cron.schedule("0 10 * * *", sendOverdueWarnings, {
        timezone: "Asia/Dubai",
    })

    console.log("[EMI Cron] EMI cron jobs initialized")
}

// Export individual functions for manual triggering
export { sendEMIReminders, processOverdueInstallments, sendOverdueWarnings }
