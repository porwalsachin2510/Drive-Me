import mongoose from "mongoose";

const tagSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    color: {
        type: String,
        default: "#6b7280"
    },
    textColor: {
        type: String,
        default: "#ffffff"
    },
    icon: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    category: {
        type: String,
        enum: ["general", "route", "vehicle", "service", "promo"],
        default: "general"
    },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    }
}, {
    timestamps: true
});

const Tag = mongoose.model("Tag", tagSchema);
export default Tag;
