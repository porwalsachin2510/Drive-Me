import crypto from "crypto"
import QRCode from "qrcode"
import DemandCampaign from "../models/DemandCampaign.js"
import Lead from "../models/Lead.js"
import DemandCommission from "../models/DemandCommission.js"
import { resolveDisplayCurrency, fromBase, toBase } from "../Services/displayCurrency.js"

// Resolve the public-facing base URL for tracking links. FRONTEND_URL may be a
// comma-separated list (see index.js CORS setup) — use the first origin.
const getPublicBaseUrl = () => {
    const raw = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173"
    return raw.split(",")[0].trim().replace(/\/$/, "")
}

const buildPublicUrl = (slug) => `${getPublicBaseUrl()}/enquiry/${slug}`

const buildWebhookUrl = (slug) => {
    const backend = (process.env.BACKEND_URL || "").split(",")[0].trim().replace(/\/$/, "")
    const base = backend || ""
    return `${base}/api/demand/webhooks/leads/${slug}`
}

// Generate a QR-code data URL for the public tracking link. Non-fatal on error.
const buildQrCode = async (url) => {
    try {
        return await QRCode.toDataURL(url, { width: 240, margin: 1 })
    } catch (e) {
        console.error("[demand] QR generation failed:", e.message)
        return null
    }
}

// @route GET /api/demand/campaigns
export const getCampaigns = async (req, res) => {
    try {
        const { status } = req.query
        const displayCurrency = resolveDisplayCurrency(req)
        const query = {}
        if (status) query.status = status

        const campaigns = await DemandCampaign.find(query).sort({ createdAt: -1 }).lean()

        // Enrich each campaign with live performance metrics (ROI)
        const enriched = await Promise.all(
            campaigns.map(async (c) => {
                const totalLeads = await Lead.countDocuments({ campaign: c._id })
                const onboarded = await Lead.countDocuments({
                    campaign: c._id,
                    stage: { $in: ["ONBOARDED", "ACTIVE"] },
                })
                const commAgg = await DemandCommission.aggregate([
                    { $match: { campaign: c._id } },
                    { $group: { _id: null, total: { $sum: "$amount" } } },
                ])
                const commissionSpend = commAgg[0]?.total || 0
                const totalSpend = (c.budget || 0) + commissionSpend
                const conversionRate = totalLeads > 0 ? (onboarded / totalLeads) * 100 : 0

                // Tracking assets for the public form + webhook intake.
                const publicUrl = c.slug ? buildPublicUrl(c.slug) : null
                const qrCode = publicUrl ? await buildQrCode(publicUrl) : null

                return {
                    ...c,
                    budget: fromBase(c.budget || 0, displayCurrency),
                    incentivePerOnboarding: fromBase(c.incentivePerOnboarding || 0, displayCurrency),
                    totalLeads,
                    onboarded,
                    commissionSpend: fromBase(commissionSpend, displayCurrency),
                    totalSpend: fromBase(totalSpend, displayCurrency),
                    conversionRate: Math.round(conversionRate * 10) / 10,
                    costPerOnboarding: onboarded > 0 ? fromBase(totalSpend / onboarded, displayCurrency) : 0,
                    currency: displayCurrency,
                    publicUrl,
                    qrCode,
                    webhookUrl: c.slug ? buildWebhookUrl(c.slug) : null,
                }
            })
        )

        res.json({ success: true, currency: displayCurrency, data: enriched })
    } catch (error) {
        console.error("[demand] getCampaigns error:", error)
        res.status(500).json({ success: false, message: "Failed to fetch campaigns" })
    }
}

// @route POST /api/demand/campaigns
export const createCampaign = async (req, res) => {
    try {
        const { name } = req.body
        if (!name) return res.status(400).json({ success: false, message: "Campaign name is required" })
        const displayCurrency = resolveDisplayCurrency(req)
        const campaign = await DemandCampaign.create({
            ...req.body,
            // Budget & incentive are entered in the admin's display currency; store in base.
            budget: toBase(Number(req.body.budget) || 0, displayCurrency),
            incentivePerOnboarding: toBase(Number(req.body.incentivePerOnboarding) || 0, displayCurrency),
            targetOnboardings: Number(req.body.targetOnboardings) || 0,
            createdBy: req.userId,
        })
        const publicUrl = buildPublicUrl(campaign.slug)
        const data = {
            ...campaign.toObject(),
            budget: fromBase(campaign.budget || 0, displayCurrency),
            incentivePerOnboarding: fromBase(campaign.incentivePerOnboarding || 0, displayCurrency),
            currency: displayCurrency,
            publicUrl,
            qrCode: await buildQrCode(publicUrl),
            webhookUrl: buildWebhookUrl(campaign.slug),
        }
        res.status(201).json({ success: true, message: "Campaign created", currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] createCampaign error:", error)
        res.status(500).json({ success: false, message: "Failed to create campaign" })
    }
}

// @route PUT /api/demand/campaigns/:id
export const updateCampaign = async (req, res) => {
    try {
        const displayCurrency = resolveDisplayCurrency(req)
        const update = { ...req.body }
        // Money fields arrive in the display currency; persist in base.
        if (update.budget !== undefined) update.budget = toBase(Number(update.budget) || 0, displayCurrency)
        if (update.incentivePerOnboarding !== undefined) {
            update.incentivePerOnboarding = toBase(Number(update.incentivePerOnboarding) || 0, displayCurrency)
        }
        const campaign = await DemandCampaign.findByIdAndUpdate(req.params.id, update, {
            new: true,
            runValidators: true,
        })
        if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" })
        const data = {
            ...campaign.toObject(),
            budget: fromBase(campaign.budget || 0, displayCurrency),
            incentivePerOnboarding: fromBase(campaign.incentivePerOnboarding || 0, displayCurrency),
            currency: displayCurrency,
        }
        res.json({ success: true, message: "Campaign updated", currency: displayCurrency, data })
    } catch (error) {
        console.error("[demand] updateCampaign error:", error)
        res.status(500).json({ success: false, message: "Failed to update campaign" })
    }
}

// @route POST /api/demand/campaigns/:id/rotate-secret
// Rotate the per-campaign webhook secret (invalidates the old token).
export const rotateWebhookSecret = async (req, res) => {
    try {
        const campaign = await DemandCampaign.findById(req.params.id)
        if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" })
        campaign.webhookSecret = crypto.randomBytes(24).toString("hex")
        await campaign.save()
        res.json({
            success: true,
            message: "Webhook secret rotated",
            data: { webhookSecret: campaign.webhookSecret, webhookUrl: buildWebhookUrl(campaign.slug) },
        })
    } catch (error) {
        console.error("[demand] rotateWebhookSecret error:", error)
        res.status(500).json({ success: false, message: "Failed to rotate secret" })
    }
}

// @route DELETE /api/demand/campaigns/:id
export const deleteCampaign = async (req, res) => {
    try {
        const campaign = await DemandCampaign.findByIdAndDelete(req.params.id)
        if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" })
        await Lead.updateMany({ campaign: campaign._id }, { $set: { campaign: null } })
        res.json({ success: true, message: "Campaign deleted" })
    } catch (error) {
        console.error("[demand] deleteCampaign error:", error)
        res.status(500).json({ success: false, message: "Failed to delete campaign" })
    }
}
