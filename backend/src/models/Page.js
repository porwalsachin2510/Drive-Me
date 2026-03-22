import mongoose from "mongoose";

const pageSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            enum: ["terms-and-conditions", "privacy-policy", "refund-policy", "contact-us"],
        },
        title: {
            type: String,
            required: true,
        },
        content: {
            type: String, // HTML content from rich text editor
            required: true,
            default: "",
        },
        metaDescription: {
            type: String,
            default: "",
        },
        isPublished: {
            type: Boolean,
            default: true,
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

const Page = mongoose.model("Page", pageSchema);

export default Page;
