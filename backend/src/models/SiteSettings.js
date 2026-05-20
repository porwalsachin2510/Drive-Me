import mongoose from "mongoose";

const siteSettingsSchema = new mongoose.Schema(
    {
        socialLinks: {
            facebook: {
                type: String,
                default: "",
            },
            instagram: {
                type: String,
                default: "",
            },
            tiktok: {
                type: String,
                default: "",
            },
            linkedin: {
                type: String,
                default: "",
            },
            twitter: {
                type: String,
                default: "",
            },
        },
        contactEmail: {
            type: String,
            default: "hello@drivemekw.com",
        },
        contactPhone: {
            type: String,
            default: "",
        },
        address: {
            type: String,
            default: "",
        },
        // Payment Control Settings
        paymentControl: {
            onlinePaymentsEnabled: {
                type: Boolean,
                default: true,
            },
            lastToggled: {
                type: Date,
                default: null,
            },
            toggledBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            toggledByName: {
                type: String,
                default: null,
            },
        },
    },
    {
        timestamps: true,
    }
);

const SiteSettings = mongoose.model("SiteSettings", siteSettingsSchema);

export default SiteSettings;
