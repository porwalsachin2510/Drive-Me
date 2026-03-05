import mongoose from "mongoose"

const campaignSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        provider: {
            type: String,
            trim: true,
            default: "",
        },
        placement: {
            type: String,
            enum: ["top", "sidebar", "footer", "popup", "banner", "interstitial"],
            default: "banner",
        },
        size: {
            type: String,
            default: "728x90",
        },
        imageUrl: {
            type: String,
            default: "",
        },
        targetUrl: {
            type: String,
            default: "",
        },
        description: {
            type: String,
            default: "",
        },
        budget: {
            type: Number,
            default: 0,
        },
        dailyBudget: {
            type: Number,
            default: 0,
        },
        costPerClick: {
            type: Number,
            default: 0,
        },
        costPerView: {
            type: Number,
            default: 0,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ["active", "paused", "expired", "draft", "completed"],
            default: "draft",
        },
        views: {
            type: Number,
            default: 0,
        },
        clicks: {
            type: Number,
            default: 0,
        },
        revenue: {
            type: Number,
            default: 0,
        },
        targetAudience: {
            type: String,
            default: "all",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
)

campaignSchema.index({ status: 1 })
campaignSchema.index({ createdAt: -1 })
campaignSchema.index({ startDate: 1, endDate: 1 })

export default mongoose.model("Campaign", campaignSchema)
