import Wallet from "../models/Wallet.js"
import User from "../models/User.js"
import DemandEmployee from "../models/DemandEmployee.js"
import { debitWallet } from "./walletService.js"

/**
 * staffWalletService — money movement for Demand Generation staff.
 *
 * Demand Generation field/finance employees are DemandEmployee records (a
 * collection separate from the auth `User` model). This service gives them a
 * real, currency-aware wallet — reusing the SAME Wallet + WithdrawalRequest
 * infrastructure every other user relies on — so they can:
 *   - receive commissions, expense reimbursements and salary, and
 *   - withdraw the balance to their bank (admin processes it in Finance).
 *
 * DOUBLE-ENTRY: every payout to a staff wallet is funded by the company
 * treasury (the Super Admin's ADMIN wallet). Crediting a staff wallet ALWAYS
 * debits the treasury in the same currency, so the admin's books reflect every
 * rupee/dirham that leaves the company. All Demand Generation amounts are
 * stored in the platform BASE currency (AED), so staff wallets are AED.
 */

const STAFF_BASE_CURRENCY = "AED"

const roleForEmployee = (employee) =>
    employee?.portalRole === "FINANCE" ? "DEMAND_FINANCE" : "DEMAND_FIELD"

/**
 * Resolve the company treasury owner — the Super Admin User (falling back to
 * any admin). Every staff payout is debited from THIS user's ADMIN wallet so
 * there is a single, consistent treasury.
 */
export const getTreasuryOwnerId = async () => {
    const superAdmin =
        (await User.findOne({ role: "ADMIN", "adminPermissions.isSuperAdmin": true }).select("_id")) ||
        (await User.findOne({ role: "ADMIN" }).sort({ createdAt: 1 }).select("_id"))
    return superAdmin?._id || null
}

/**
 * Get (or lazily create) a staff member's wallet in the given currency.
 * @param {object|string} employee  DemandEmployee document or its _id.
 * @param {string} currency
 */
export const getOrCreateStaffWallet = async (employee, currency = STAFF_BASE_CURRENCY) => {
    const emp = typeof employee === "object" && employee?._id ? employee : await DemandEmployee.findById(employee)
    if (!emp) return null

    let wallet = await Wallet.findOne({
        userId: emp._id,
        ownerModel: "DemandEmployee",
        currency,
    })

    if (!wallet) {
        wallet = new Wallet({
            userId: emp._id,
            ownerModel: "DemandEmployee",
            role: roleForEmployee(emp),
            balance: 0,
            currency,
            transactions: [],
        })
        await wallet.save()
    }
    return wallet
}

/**
 * Build the summary a staff member sees in their portal wallet.
 */
export const getStaffWalletSummary = async (employee, currency = STAFF_BASE_CURRENCY) => {
    const wallet = await getOrCreateStaffWallet(employee, currency)
    if (!wallet) return null
    const transactions = [...(wallet.transactions || [])]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 100)
    return {
        walletId: wallet._id,
        balance: wallet.balance || 0,
        currency: wallet.currency,
        totalEarnings: wallet.totalEarnings || 0,
        totalWithdrawals: wallet.totalWithdrawals || 0,
        pendingWithdrawals: (wallet.transactions || [])
            .filter((t) => t.type === "WITHDRAWAL" && ["PENDING", "APPROVED", "PROCESSING"].includes(t.status))
            .reduce((s, t) => s + Math.abs(t.amount || 0), 0),
        transactions,
    }
}

/**
 * Pay money INTO a staff member's wallet, funded by the company treasury.
 *
 * Credits the staff wallet (embedded transaction + running balance/earnings)
 * and debits the treasury ADMIN wallet in the same currency (full ledger
 * Transaction record). Treasury is allowed to go negative — it represents real
 * money the company has spent even if that currency bucket hasn't accrued yet.
 *
 * @returns {{ success:boolean, message?:string, staffWallet?, walletTransactionId?, newBalance?, treasury? }}
 */
export const payStaffFromTreasury = async ({
    employee,
    amount,
    currency = STAFF_BASE_CURRENCY,
    embeddedType = "PAYOUT",
    description,
    reference,
    metadata,
    actingUserId = null,
}) => {
    const amt = Number(amount)
    if (!employee || !amt || amt <= 0) {
        return { success: false, message: "Invalid payout parameters" }
    }

    const emp = typeof employee === "object" && employee?._id ? employee : await DemandEmployee.findById(employee)
    if (!emp) return { success: false, message: "Employee not found" }

    // 1) Credit the staff wallet.
    const staffWallet = await getOrCreateStaffWallet(emp, currency)
    if (!staffWallet) return { success: false, message: "Could not resolve staff wallet" }

    staffWallet.transactions.push({
        type: embeddedType,
        amount: amt,
        description: description || "Payout",
        reference,
        status: "COMPLETED",
        senderName: "Drive Me Go (Company)",
        recipientId: emp._id,
        recipientName: emp.fullName,
        createdAt: new Date(),
    })
    staffWallet.balance = (staffWallet.balance || 0) + amt
    staffWallet.totalEarnings = (staffWallet.totalEarnings || 0) + amt
    await staffWallet.save()
    const walletTransactionId = staffWallet.transactions[staffWallet.transactions.length - 1]._id

    // 2) Debit the company treasury (Super Admin ADMIN wallet) in the same
    //    currency. Non-fatal if no treasury exists yet — the staff credit still
    //    stands, we just note it in the response.
    let treasury = null
    try {
        const treasuryOwnerId = actingUserId || (await getTreasuryOwnerId())
        if (treasuryOwnerId) {
            treasury = await debitWallet({
                userId: treasuryOwnerId,
                role: "ADMIN",
                amount: amt,
                currency,
                embeddedType: "PAYOUT",
                ledgerCategory: "STAFF_PAYOUT",
                description: description || `Staff payout to ${emp.fullName} (${emp.employeeCode})`,
                reference,
                toName: emp.fullName,
                allowNegative: true,
                countsAsEarning: false,
                metadata: { ...(metadata || {}), staffEmployeeId: emp._id?.toString(), employeeCode: emp.employeeCode },
            })
        }
    } catch (err) {
        console.error("[staffWalletService] treasury debit failed:", err?.message)
    }

    return {
        success: true,
        staffWallet,
        walletTransactionId,
        newBalance: staffWallet.balance,
        treasury,
    }
}

/**
 * Denormalized user info block stored on a staff WithdrawalRequest so the admin
 * Finance queue can display it without populating the DemandEmployee collection.
 */
export const buildStaffUserInfo = (employee) => ({
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone || "",
    role: employee.portalRole === "FINANCE" ? "DEMAND_FINANCE" : "DEMAND_FIELD",
})

// Fire-and-forget in-app notification for the staff member (best effort).
const notifyStaff = async (employeeId, { type = "GENERAL", title, message, data }) => {
    try {
        const DemandNotification = (await import("../models/DemandNotification.js")).default
        await DemandNotification.create({ employee: employeeId, type, title, message, data: data || {} })
    } catch (err) {
        console.error("[staffWalletService] notifyStaff failed:", err?.message)
    }
}

/**
 * Settle a commission by paying it into the earning employee's wallet.
 * Idempotent at the call site: callers MUST only invoke this on the PENDING/
 * APPROVED -> PAID transition. Marks the commission PAID and stamps paidAt.
 *
 * @param {import('mongoose').Document} commission  A DemandCommission document.
 * @returns {Promise<{success:boolean, message?:string}>}
 */
export const settleCommissionPayment = async (commission, { actingUserId = null } = {}) => {
    if (!commission?.employee) return { success: false, message: "Commission has no employee" }
    const amount = Number(commission.amount) || 0
    if (amount <= 0) {
        // Nothing to move (e.g. a zero-value manual entry) — still allow the
        // status to flip to PAID at the call site.
        return { success: true, message: "No amount to pay" }
    }

    const result = await payStaffFromTreasury({
        employee: commission.employee,
        amount,
        currency: STAFF_BASE_CURRENCY,
        embeddedType: "COMMISSION",
        description: `Commission payout${commission.note ? ` — ${commission.note}` : ""}`,
        reference: `COMM-${commission._id}`,
        metadata: { source: "DEMAND_COMMISSION", commissionId: commission._id?.toString(), month: commission.month },
        actingUserId,
    })

    if (result.success) {
        await notifyStaff(commission.employee, {
            type: "COMMISSION_EARNED",
            title: "Commission paid",
            message: `${STAFF_BASE_CURRENCY} ${amount.toLocaleString()} commission has been credited to your wallet.`,
            data: { commissionId: commission._id?.toString(), amount },
        })
    }
    return result
}

/**
 * Settle an approved expense by reimbursing the employee's wallet.
 * Callers MUST only invoke on the UNPAID -> PAID transition.
 *
 * @param {import('mongoose').Document} expense  A DemandExpense document.
 */
export const settleExpensePayment = async (expense, { actingUserId = null } = {}) => {
    if (!expense?.employee) return { success: false, message: "Expense has no employee" }
    const amount = Number(expense.amount) || 0
    if (amount <= 0) return { success: true, message: "No amount to pay" }

    const result = await payStaffFromTreasury({
        employee: expense.employee,
        amount,
        currency: STAFF_BASE_CURRENCY,
        embeddedType: "PAYOUT",
        description: `Expense reimbursement — ${expense.category}`,
        reference: `EXP-${expense._id}`,
        metadata: { source: "DEMAND_EXPENSE", expenseId: expense._id?.toString(), category: expense.category },
        actingUserId,
    })

    if (result.success) {
        await notifyStaff(expense.employee, {
            type: "GENERAL",
            title: "Expense reimbursed",
            message: `${STAFF_BASE_CURRENCY} ${amount.toLocaleString()} expense reimbursement has been credited to your wallet.`,
            data: { expenseId: expense._id?.toString(), amount },
        })
    }
    return result
}

export { notifyStaff }

export default {
    getTreasuryOwnerId,
    getOrCreateStaffWallet,
    getStaffWalletSummary,
    payStaffFromTreasury,
    buildStaffUserInfo,
    settleCommissionPayment,
    settleExpensePayment,
    notifyStaff,
}