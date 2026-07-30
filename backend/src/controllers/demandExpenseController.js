import DemandExpense from "../models/DemandExpense.js"
import { resolveDisplayCurrency, fromBase, toBase } from "../Services/displayCurrency.js"
import { settleExpensePayment } from "../Services/staffWalletService.js"

const monthKey = (d = new Date()) => {
    const dt = new Date(d)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
}

// @route GET /api/demand/expenses
export const getExpenses = async (req, res) => {
    try {
        const { employee, category, approvalStatus, paymentStatus, month } = req.query
        const query = {}
        if (employee) query.employee = employee
        if (category) query.category = category
        if (approvalStatus) query.approvalStatus = approvalStatus
        if (paymentStatus) query.paymentStatus = paymentStatus
        if (month) query.month = month

        const displayCurrency = resolveDisplayCurrency(req)
        const expensesRaw = await DemandExpense.find(query)
            .populate("employee", "fullName employeeCode")
            .sort({ date: -1 })
            .lean()

        const expenses = expensesRaw.map((e) => ({ ...e, amount: fromBase(e.amount || 0, displayCurrency), currency: displayCurrency }))
        const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0)
        const approvedAmount = expenses
            .filter((e) => e.approvalStatus === "APPROVED")
            .reduce((s, e) => s + (e.amount || 0), 0)

        res.json({ success: true, currency: displayCurrency, data: expenses, totalAmount, approvedAmount })
    } catch (error) {
        console.error("[demand] getExpenses error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch expenses" })
    }
}

// @route POST /api/demand/expenses
export const createExpense = async (req, res) => {
    try {
        const { employee, category, amount } = req.body
        if (!employee || !category || amount === undefined) {
            return res.status(400).json({ success: false, message: "Employee, category and amount are required" })
        }
        const displayCurrency = resolveDisplayCurrency(req)
        const expense = await DemandExpense.create({
            ...req.body,
            // Amount is entered in the display currency; store in base.
            amount: toBase(Number(amount), displayCurrency),
            date: req.body.date || Date.now(),
            month: monthKey(req.body.date),
            createdBy: req.userId,
        })
        const data = { ...expense.toObject(), amount: fromBase(expense.amount || 0, displayCurrency), currency: displayCurrency }
        res.status(201).json({ success: true, message: "Expense recorded", currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] createExpense error:", error)
        res.status(500).json({ success: false, message: "Failed to record expense" })
    }
}

// @route PUT /api/demand/expenses/:id
export const updateExpense = async (req, res) => {
    try {
        const expense = await DemandExpense.findById(req.params.id)
        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" })

        const displayCurrency = resolveDisplayCurrency(req)
        const editable = ["employee", "category", "date", "description", "receiptUrl"]
        editable.forEach((f) => {
            if (req.body[f] !== undefined) expense[f] = req.body[f]
        })
        // Amount is entered in the display currency; persist in base.
        if (req.body.amount !== undefined) expense.amount = toBase(Number(req.body.amount) || 0, displayCurrency)
        if (req.body.date) expense.month = monthKey(req.body.date)

        await expense.save()
        const data = { ...expense.toObject(), amount: fromBase(expense.amount || 0, displayCurrency), currency: displayCurrency }
        res.json({ success: true, message: "Expense updated", currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] updateExpense error:", error)
        res.status(500).json({ success: false, message: "Failed to update expense" })
    }
}

// @route PATCH /api/demand/expenses/:id/approval
export const updateApproval = async (req, res) => {
    try {
        const { approvalStatus, rejectionReason } = req.body
        if (!["PENDING", "APPROVED", "REJECTED"].includes(approvalStatus)) {
            return res.status(400).json({ success: false, message: "Invalid approval status" })
        }
        const expense = await DemandExpense.findById(req.params.id)
        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" })

        expense.approvalStatus = approvalStatus
        expense.approvedBy = req.userId
        expense.approvedAt = new Date()
        if (approvalStatus === "REJECTED") expense.rejectionReason = rejectionReason || ""

        await expense.save()
        const displayCurrency = resolveDisplayCurrency(req)
        const data = { ...expense.toObject(), amount: fromBase(expense.amount || 0, displayCurrency), currency: displayCurrency }
        res.json({ success: true, message: `Expense ${approvalStatus.toLowerCase()}`, currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] updateApproval error:", error)
        res.status(500).json({ success: false, message: "Failed to update approval" })
    }
}

// @route PATCH /api/demand/expenses/:id/payment
export const updatePayment = async (req, res) => {
    try {
        const { paymentStatus } = req.body
        if (!["UNPAID", "PAID"].includes(paymentStatus)) {
            return res.status(400).json({ success: false, message: "Invalid payment status" })
        }
        const expense = await DemandExpense.findById(req.params.id)
        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" })
        if (paymentStatus === "PAID" && expense.approvalStatus !== "APPROVED") {
            return res.status(400).json({ success: false, message: "Only approved expenses can be paid" })
        }

        const isNewlyPaid = paymentStatus === "PAID" && expense.paymentStatus !== "PAID"

        expense.paymentStatus = paymentStatus
        expense.paidAt = paymentStatus === "PAID" ? new Date() : null
        await expense.save()

        if (isNewlyPaid) {
            const result = await settleExpensePayment(expense, { actingUserId: req.userId })
            if (!result.success) {
                expense.paymentStatus = "UNPAID"
                expense.paidAt = null
                await expense.save()
                return res.status(400).json({ success: false, message: result.message || "Failed to reimburse expense into wallet" })
            }
        }

        const displayCurrency = resolveDisplayCurrency(req)
        const data = { ...expense.toObject(), amount: fromBase(expense.amount || 0, displayCurrency), currency: displayCurrency }
        res.json({ success: true, message: `Expense marked ${paymentStatus.toLowerCase()}`, currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] updatePayment error:", error)
        res.status(500).json({ success: false, message: "Failed to update payment" })
    }
}

// @route DELETE /api/demand/expenses/:id
export const deleteExpense = async (req, res) => {
    try {
        const expense = await DemandExpense.findByIdAndDelete(req.params.id)
        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" })
        res.json({ success: true, message: "Expense deleted" })
    } catch (error) {
        console.error("[demand] deleteExpense error:", error)
        res.status(500).json({ success: false, message: "Failed to delete expense" })
    }
}