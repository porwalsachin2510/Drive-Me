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
    },
    {
        timestamps: true,
    }
);

const SiteSettings = mongoose.model("SiteSettings", siteSettingsSchema);

export default SiteSettings;
