import mongoose from "mongoose"

const paymentScheduleSchema = new mongoose.Schema(
    {
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
        },
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        fleetOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        currency: {
            type: String,
            enum: ["KWD", "AED", "SAR", "QAR", "BHD", "OMR", "USD", "EUR"],
            required: true,
        },
        scheduleType: {
            type: String,
            enum: ["ADVANCE", "SECURITY_DEPOSIT", "INSTALLMENT", "FINAL"],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        dueDate: {
            type: Date,
            required: true,
        },
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
        },
        status: {
            type: String,
            enum: ["PENDING", "PAID", "OVERDUE", "WAIVED"],
            default: "PENDING",
        },
        remindersSent: [
            {
                sentAt: Date,
                type: {
                    type: String,
                    enum: ["BEFORE_DUE", "ON_DUE", "AFTER_DUE"],
                },
            },
        ],
        notes: String,
    },
    { timestamps: true },
)

const PaymentSchedule = mongoose.model("PaymentSchedule", paymentScheduleSchema)
export default PaymentSchedule
