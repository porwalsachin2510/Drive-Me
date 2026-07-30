import mongoose from "mongoose"
import { generateSequentialCode } from "../utils/generateSequentialCode.js"

/**
 * Lead
 * ----
 * Core entity of the Demand Generation module. Represents a potential
 * customer OR partner (B2B / B2C) moving through the acquisition
 * lifecycle. Every stage transition is captured as an activity with the
 * acting employee, notes, next follow-up date and attachments.
 */

export const LEAD_STAGES = [
    "NEW",
    "ASSIGNED",
    "CONTACTED",
    "FOLLOW_UP",
    "INTERESTED",
    "DOCUMENTATION_PENDING",
    "ONBOARDED",
    "ACTIVE",
    "LOST",
]

const attachmentSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true },
        url: { type: String, trim: true },
        uploadedAt: { type: Date, default: Date.now },
    },
    { _id: false }
)

const activitySchema = new mongoose.Schema(
    {
        stage: { type: String, enum: LEAD_STAGES },
        note: { type: String, trim: true, default: "" },
        employee: { type: mongoose.Schema.Types.ObjectId, ref: "DemandEmployee" },
        nextFollowUpDate: { type: Date, default: null },
        attachments: { type: [attachmentSchema], default: [] },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
)

const leadSchema = new mongoose.Schema(
    {
        leadCode: { type: String, unique: true, index: true },

        // Whether this lead is a customer or a partner acquisition
        leadCategory: {
            type: String,
            enum: ["CUSTOMER", "PARTNER"],
            required: true,
            index: true,
        },
        // Only relevant when leadCategory === "PARTNER"
        // CORPORATE is a first-class partner intent (a company signing up as a
        // Corporate account) — kept distinct from a generic B2B partner so the
        // lead onboards into the correct platform role.
        partnerType: {
            type: String,
            enum: ["B2B", "B2C", "CORPORATE", null],
            default: null,
        },
        // Finer classification (Corporate / Business / Institution for B2B,
        // Retail / Agent / Reseller / Individual for B2C)
        partnerSubType: { type: String, trim: true, default: "" },

        name: { type: String, required: true, trim: true },
        contactPerson: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, lowercase: true, default: "" },
        phone: { type: String, trim: true, default: "" },
        company: { type: String, trim: true, default: "" },

        source: { type: String, trim: true, default: "Direct" },
        campaign: { type: mongoose.Schema.Types.ObjectId, ref: "DemandCampaign", default: null },
        territory: { type: String, trim: true, default: "" },
        region: { type: String, trim: true, default: "" },

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DemandEmployee",
            default: null,
            index: true,
        },

        stage: {
            type: String,
            enum: LEAD_STAGES,
            default: "NEW",
            index: true,
        },

        estimatedValue: { type: Number, default: 0, min: 0 },

        nextFollowUpDate: { type: Date, default: null },

        activities: { type: [activitySchema], default: [] },
        documents: { type: [attachmentSchema], default: [] },

        assignedAt: { type: Date, default: null },
        contactedAt: { type: Date, default: null },
        onboardedAt: { type: Date, default: null },
        activatedAt: { type: Date, default: null },
        lostAt: { type: Date, default: null },
        lostReason: { type: String, trim: true, default: "" },

        // Guard so commission auto-generation only runs once per lead
        commissionGenerated: { type: Boolean, default: false },

        // ===== Onboarding linkage =====
        // When a field employee onboards this lead, we create (or link to) a
        // real platform User account. This is the durable proof of WHO was
        // onboarded from this lead — and, via `assignedTo`, WHICH field
        // employee earned the commission for it.
        onboardedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        // Snapshot of the employee who actually performed the onboarding
        // (normally the same as assignedTo, kept explicitly for audit).
        onboardedByEmployee: { type: mongoose.Schema.Types.ObjectId, ref: "DemandEmployee", default: null },

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
)

leadSchema.index({ createdAt: -1 })
leadSchema.index({ leadCategory: 1, stage: 1 })

leadSchema.pre("validate", async function (next) {
    if (!this.leadCode) {
        this.leadCode = await generateSequentialCode(mongoose.model("Lead"), "leadCode", "LEAD-", 5)
    }
    next()
})

// Concurrency safety net: if two leads race to the same code, the unique
// index throws E11000 — regenerate once and retry the save.
leadSchema.post("save", async function (err, doc, next) {
    if (err && err.name === "MongoServerError" && err.code === 11000 && err.keyPattern?.leadCode) {
        doc.leadCode = await generateSequentialCode(mongoose.model("Lead"), "leadCode", "LEAD-", 5)
        return doc.save().then(() => next()).catch(next)
    }
    next(err)
})

export default mongoose.model("Lead", leadSchema)