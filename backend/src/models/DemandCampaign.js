import mongoose from "mongoose"
import crypto from "crypto"

/**
 * DemandCampaign
 * --------------
 * Acquisition campaigns used to group and attribute leads, track budget
 * spend and measure ROI (revenue / onboardings vs budget). Distinct from
 * the advertising `Campaign` model used by the marketing/ads module.
 *
 * Each campaign exposes a public tracking `slug` (used for the public
 * enquiry form at /enquiry/:slug) and a per-campaign `webhookSecret` used
 * to authenticate external lead sources (Meta/Google Lead Ads, Zapier).
 */

// Build a URL-safe slug from an arbitrary string.
const slugify = (str = "") =>
    String(str)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)

const demandCampaignSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: "" },

        // Public tracking slug (unique). Powers the public enquiry form and
        // the webhook intake URL. Auto-generated from the name on create.
        slug: { type: String, trim: true, unique: true, sparse: true, index: true },

        // Per-campaign secret token that external sources must present (as a
        // Bearer token or ?token= query param) to POST leads to the webhook.
        webhookSecret: { type: String, default: () => crypto.randomBytes(24).toString("hex") },

        // Optional round-robin / region-based auto-assignment. When enabled,
        // every lead captured for this campaign is auto-assigned to an active
        // DemandEmployee and moved to the ASSIGNED stage.
        autoAssign: {
            enabled: { type: Boolean, default: false },
            strategy: { type: String, enum: ["ROUND_ROBIN", "REGION"], default: "ROUND_ROBIN" },
            // Internal cursor used by the round-robin strategy.
            lastAssignedIndex: { type: Number, default: -1 },
        },
        channel: {
            type: String,
            enum: ["DIGITAL", "FIELD", "REFERRAL", "TELECALLING", "EVENT", "OTHER"],
            default: "DIGITAL",
        },
        target: {
            type: String,
            enum: ["CUSTOMER", "B2B_PARTNER", "B2C_PARTNER", "CORPORATE", "ALL"],
            default: "ALL",
        },
        budget: { type: Number, default: 0, min: 0 },
        // Incentive paid per onboarding attributed to this campaign
        incentivePerOnboarding: { type: Number, default: 0, min: 0 },
        targetOnboardings: { type: Number, default: 0, min: 0 },
        region: { type: String, trim: true, default: "" },
        startDate: { type: Date, required: true, default: Date.now },
        endDate: { type: Date, default: null },
        status: {
            type: String,
            enum: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"],
            default: "DRAFT",
            index: true,
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
)

demandCampaignSchema.index({ createdAt: -1 })

// Auto-generate a unique public slug from the campaign name before validation.
demandCampaignSchema.pre("validate", async function (next) {
    if (!this.slug && this.name) {
        const base = slugify(this.name) || "campaign"
        let candidate = base
        let attempt = 0
        // Ensure uniqueness against existing campaigns.
        // eslint-disable-next-line no-await-in-loop
        while (await mongoose.model("DemandCampaign").exists({ slug: candidate, _id: { $ne: this._id } })) {
            attempt += 1
            candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`
            if (attempt > 5) {
                candidate = `${base}-${Date.now().toString(36)}`
                break
            }
        }
        this.slug = candidate
    }
    if (!this.webhookSecret) {
        this.webhookSecret = crypto.randomBytes(24).toString("hex")
    }
    next()
})

// Concurrency safety net for the unique slug index.
demandCampaignSchema.post("save", async function (err, doc, next) {
    if (err && err.name === "MongoServerError" && err.code === 11000 && err.keyPattern?.slug) {
        doc.slug = `${slugify(doc.name) || "campaign"}-${crypto.randomBytes(3).toString("hex")}`
        return doc.save().then(() => next()).catch(next)
    }
    next(err)
})

export default mongoose.model("DemandCampaign", demandCampaignSchema)