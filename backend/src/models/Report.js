import mongoose from "mongoose"

/**
 * Report model
 * Stores admin-generated custom reports so they can be listed, viewed in
 * detail and exported (CSV) at any later time. Each report keeps a snapshot
 * of the data rows that matched the chosen filters at generation time.
 */
const reportSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            default: "",
        },
        reportType: {
            type: String,
            enum: ["general", "revenue", "users", "bookings", "commission", "settlements"],
            required: true,
        },
        // Filters applied while generating the report
        filters: {
            dateFrom: { type: Date, default: null },
            dateTo: { type: Date, default: null },
        },
        // Number of records the report covers
        recordCount: {
            type: Number,
            default: 0,
        },
        // High level aggregated numbers (varies per report type)
        summary: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        // Column keys used to render / export the row data
        columns: {
            type: [String],
            default: [],
        },
        // Snapshot of the data rows that matched the filters
        rows: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },
        // Total monetary value when the report deals with money (AED)
        totalAmount: {
            type: Number,
            default: 0,
        },
        currency: {
            type: String,
            default: "AED",
        },
        generatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        generatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true },
)

export default mongoose.model("Report", reportSchema)
