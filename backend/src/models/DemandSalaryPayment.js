import mongoose from "mongoose"

/**
 * DemandSalaryPayment
 * -------------------
 * A record of one salary disbursement to a Demand Generation staff member
 * (DemandEmployee). Created when an admin pays a month's salary into the
 * employee's staff wallet from the company treasury.
 *
 * The unique { employee, month } index guarantees the SAME month can never be
 * paid twice, so repeated clicks / retries can't double-credit a salary.
 * Amounts are stored in the platform BASE currency (AED), like every other
 * Demand Generation money field.
 */
const demandSalaryPaymentSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DemandEmployee",
            required: true,
            index: true,
        },
        // YYYY-MM the salary is paid for.
        month: { type: String, required: true, index: true },
        // Base salary + total allowances actually paid (base currency).
        amount: { type: Number, required: true, min: 0 },
        baseSalary: { type: Number, default: 0, min: 0 },
        allowancesTotal: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: "AED" },
        note: { type: String, trim: true, default: "" },
        // Admin User who triggered the payment.
        paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        // Embedded wallet transaction id created on the staff wallet.
        walletTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
        paidAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
)

demandSalaryPaymentSchema.index({ employee: 1, month: 1 }, { unique: true })

export default mongoose.model("DemandSalaryPayment", demandSalaryPaymentSchema)