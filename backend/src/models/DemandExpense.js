import mongoose from "mongoose"

/**
 * DemandExpense
 * -------------
 * Operational expenses incurred by acquisition employees (travel, fuel,
 * meals, accommodation, marketing, etc.) with an approval + payment
 * workflow. Feeds employee cost and the financial dashboard.
 */

export const EXPENSE_CATEGORIES = [
    "TRAVEL",
    "FUEL",
    "MEALS",
    "ACCOMMODATION",
    "MARKETING",
    "OTHER",
]

const demandExpenseSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DemandEmployee",
            required: true,
            index: true,
        },
        category: {
            type: String,
            enum: EXPENSE_CATEGORIES,
            required: true,
            index: true,
        },
        amount: { type: Number, required: true, min: 0 },
        date: { type: Date, required: true, default: Date.now },
        description: { type: String, trim: true, default: "" },
        receiptUrl: { type: String, trim: true, default: "" },

        approvalStatus: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING",
            index: true,
        },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        approvedAt: { type: Date, default: null },
        rejectionReason: { type: String, trim: true, default: "" },

        paymentStatus: {
            type: String,
            enum: ["UNPAID", "PAID"],
            default: "UNPAID",
            index: true,
        },
        paidAt: { type: Date, default: null },
        // Finance-portal officer (DemandEmployee) who paid this expense.
        paidByEmployee: { type: mongoose.Schema.Types.ObjectId, ref: "DemandEmployee", default: null },

        // YYYY-MM for monthly aggregation
        month: { type: String, index: true },

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
)

demandExpenseSchema.index({ createdAt: -1 })

export default mongoose.model("DemandExpense", demandExpenseSchema)
