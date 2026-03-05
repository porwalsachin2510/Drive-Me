import PaymentSchedule from "../models/PaymentSchedule.js"
import Contract from "../models/Contract.js"
import moment from "moment"

// Create payment schedules for a contract
export const createPaymentSchedules = async (req, res) => {
    try {
        const { contractId } = req.params
        const {
            advancePaymentDueDate,
            securityDepositDueDate,
            installmentPlan, // { enabled: boolean, numberOfInstallments: number }
        } = req.body

        console.log("[v0] Creating payment schedules for contract:", contractId)

        const contract = await Contract.findById(contractId)
        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Check if schedules already exist
        const existingSchedules = await PaymentSchedule.findOne({ contractId })
        if (existingSchedules) {
            return res.status(400).json({
                success: false,
                message: "Payment schedules already exist for this contract",
            })
        }

        const schedules = []

        // Advance Payment Schedule (50%)
        const advanceSchedule = new PaymentSchedule({
            contractId: contract._id,
            corporateOwnerId: contract.corporateOwnerId,
            fleetOwnerId: contract.fleetOwnerId,
            currency: contract.financials.currency,
            scheduleType: "ADVANCE",
            amount: contract.financials.advancePayment.amount,
            dueDate: advancePaymentDueDate || moment().add(3, "days").toDate(),
        })
        schedules.push(await advanceSchedule.save())

        // Security Deposit Schedule
        const securitySchedule = new PaymentSchedule({
            contractId: contract._id,
            corporateOwnerId: contract.corporateOwnerId,
            fleetOwnerId: contract.fleetOwnerId,
            currency: contract.financials.currency,
            scheduleType: "SECURITY_DEPOSIT",
            amount: contract.financials.securityDeposit.amount,
            dueDate: securityDepositDueDate || moment().add(7, "days").toDate(),
        })
        schedules.push(await securitySchedule.save())

        // Remaining Payment - Installments or Final
        if (installmentPlan?.enabled && installmentPlan.numberOfInstallments > 1) {
            const installmentAmount = contract.financials.remainingAmount / installmentPlan.numberOfInstallments
            const contractDuration = moment(contract.rentalPeriod.endDate).diff(
                moment(contract.rentalPeriod.startDate),
                "days",
            )
            const installmentInterval = Math.floor(contractDuration / installmentPlan.numberOfInstallments)

            for (let i = 0; i < installmentPlan.numberOfInstallments; i++) {
                const installmentSchedule = new PaymentSchedule({
                    contractId: contract._id,
                    corporateOwnerId: contract.corporateOwnerId,
                    fleetOwnerId: contract.fleetOwnerId,
                    currency: contract.financials.currency,
                    scheduleType: "INSTALLMENT",
                    amount: installmentAmount,
                    dueDate: moment(contract.rentalPeriod.startDate)
                        .add((i + 1) * installmentInterval, "days")
                        .toDate(),
                })
                schedules.push(await installmentSchedule.save())
            }
        } else {
            // Final Payment (50%)
            const finalSchedule = new PaymentSchedule({
                contractId: contract._id,
                corporateOwnerId: contract.corporateOwnerId,
                fleetOwnerId: contract.fleetOwnerId,
                currency: contract.financials.currency,
                scheduleType: "FINAL",
                amount: contract.financials.finalPayment.amount,
                dueDate: moment(contract.rentalPeriod.endDate).subtract(7, "days").toDate(),
            })
            schedules.push(await finalSchedule.save())
        }

        console.log("[v0] Created", schedules.length, "payment schedules")

        res.status(201).json({
            success: true,
            message: "Payment schedules created successfully",
            schedules,
        })
    } catch (error) {
        console.error("[v0] Error creating payment schedules:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// Get payment schedules for a contract
export const getContractPaymentSchedules = async (req, res) => {
    try {
        const { contractId } = req.params

        console.log("[v0] Fetching schedules for contract:", contractId)

        const schedules = await PaymentSchedule.find({ contractId }).populate("paymentId").sort({ dueDate: 1 })

        res.json({
            success: true,
            message: "Payment schedules retrieved successfully",
            schedules,
        })
    } catch (error) {
        console.error("[v0] Error fetching payment schedules:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// Check and update overdue payments
export const checkOverduePayments = async (req, res) => {
    try {
        console.log("[v0] Checking for overdue payments...")
        const now = new Date()

        const overdueSchedules = await PaymentSchedule.find({
            status: "PENDING",
            dueDate: { $lt: now },
        }).populate("contractId")

        const updatedSchedules = []

        for (const schedule of overdueSchedules) {
            schedule.status = "OVERDUE"
            await schedule.save()

            // Update contract vehicle access
            const contract = schedule.contractId
            if (contract) {
                contract.vehicleAccess.isActive = false
                contract.vehicleAccess.reason = `Payment overdue: ${schedule.scheduleType}`
                contract.vehicleAccess.blockedAt = now
                await contract.save()
            }

            updatedSchedules.push(schedule)
        }

        console.log("[v0] Found", updatedSchedules.length, "overdue payments")

        res.json({
            success: true,
            message: `Found ${overdueSchedules.length} overdue payments`,
            overdueSchedules: updatedSchedules,
        })
    } catch (error) {
        console.error("[v0] Error checking overdue payments:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// Get overdue payments for admin/fleet owner
export const getOverduePayments = async (req, res) => {
    try {
        const { userRole, userId } = req.query

        console.log("[v0] Fetching overdue payments for role:", userRole)

        const query = { status: "OVERDUE" }

        if (userRole === "FLEET_OWNER") {
            query.fleetOwnerId = userId
        }

        const overdueSchedules = await PaymentSchedule.find(query)
            .populate("contractId")
            .populate("corporateOwnerId", "fullName email phone")
            .populate("fleetOwnerId", "businessName email phone")
            .sort({ dueDate: 1 })

        res.json({
            success: true,
            message: "Overdue payments retrieved successfully",
            overdueSchedules,
        })
    } catch (error) {
        console.error("[v0] Error fetching overdue payments:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// Mark payment as paid
export const markPaymentAsPaid = async (req, res) => {
    try {
        const { scheduleId } = req.params
        const { paymentId, transactionId } = req.body

        console.log("[v0] Marking payment as paid:", scheduleId)

        const schedule = await PaymentSchedule.findById(scheduleId).populate("contractId")
        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: "Payment schedule not found",
            })
        }

        schedule.status = "PAID"
        schedule.paymentId = paymentId
        schedule.paidAt = new Date()
        await schedule.save()

        // Update contract financials
        const contract = schedule.contractId
        if (schedule.scheduleType === "ADVANCE") {
            contract.financials.advancePayment.paidAt = new Date()
            contract.financials.advancePayment.transactionId = transactionId
            contract.financials.advancePayment.status = "PAID"
        } else if (schedule.scheduleType === "SECURITY_DEPOSIT") {
            contract.financials.securityDeposit.paidAt = new Date()
            contract.financials.securityDeposit.status = "PAID"
        } else if (schedule.scheduleType === "FINAL") {
            contract.financials.finalPayment.paidAt = new Date()
            contract.financials.finalPayment.transactionId = transactionId
            contract.financials.finalPayment.status = "PAID"
        } else if (schedule.scheduleType === "INSTALLMENT") {
            // Find installment index and update
            const installmentIndex = contract.financials.installments.findIndex((inst) => inst._id.toString() === scheduleId)
            if (installmentIndex !== -1) {
                contract.financials.installments[installmentIndex].paidAt = new Date()
                contract.financials.installments[installmentIndex].status = "PAID"
            }
        }

        // Check if all payments are completed
        const allSchedules = await PaymentSchedule.find({ contractId: contract._id })
        const allPaid = allSchedules.every((s) => s.status === "PAID" || s.status === "WAIVED")

        if (allPaid) {
            contract.financials.paymentStatus = "COMPLETED"
            contract.vehicleAccess.isActive = true
            contract.vehicleAccess.reason = null
            contract.status = "ACTIVE"
            console.log("[v0] All payments completed. Contract activated!")
        } else {
            contract.financials.paymentStatus = "PARTIAL"
        }

        contract.markModified("financials")
        await contract.save()

        console.log("[v0] Payment marked as paid successfully")

        res.json({
            success: true,
            message: "Payment marked as paid successfully",
            schedule,
            contract,
        })
    } catch (error) {
        console.error("[v0] Error marking payment as paid:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// Send payment reminder
export const sendPaymentReminder = async (req, res) => {
    try {
        const { scheduleId } = req.params

        console.log("[v0] Sending payment reminder for:", scheduleId)

        const schedule = await PaymentSchedule.findById(scheduleId)
            .populate("contractId")
            .populate("corporateOwnerId", "fullName email")

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: "Payment schedule not found",
            })
        }

        // Determine reminder type
        const now = moment()
        const dueDate = moment(schedule.dueDate)
        let reminderType = "ON_DUE"

        if (now.isBefore(dueDate)) {
            reminderType = "BEFORE_DUE"
        } else if (now.isAfter(dueDate)) {
            reminderType = "AFTER_DUE"
        }

        schedule.remindersSent.push({
            sentAt: new Date(),
            type: reminderType,
        })
        await schedule.save()

        // TODO: Send actual email/SMS notification
        console.log(`[v0] Sending ${reminderType} payment reminder to ${schedule.corporateOwnerId.email}`)

        res.json({
            success: true,
            message: "Payment reminder sent successfully",
            schedule,
        })
    } catch (error) {
        console.error("[v0] Error sending payment reminder:", error)
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}
