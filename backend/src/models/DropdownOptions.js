import mongoose from "mongoose";

const dropdownOptionItemSchema = new mongoose.Schema({
    value: {
        type: String,
        required: true,
    },
    label: {
        type: String,
        required: true,
    },
    icon: {
        type: String,
        default: null,
    },
    description: {
        type: String,
        default: null,
    },
    order: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, { _id: true });

const dropdownOptionsSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: [
            // Vehicle related
            "VEHICLE_CATEGORIES_PASSENGER",
            "VEHICLE_CATEGORIES_GOODS",
            "VEHICLE_CATEGORIES_MANAGED",
            // Location
            "LOCATIONS",
            "CITIES",
            "COUNTRIES",
            // Currency
            "CURRENCIES",
            // License types
            "LICENSE_TYPES",
            // Rental duration
            "RENTAL_DURATIONS",
            // Budget ranges
            "BUDGET_RANGES_DAILY",
            "BUDGET_RANGES_WEEKLY",
            "BUDGET_RANGES_MONTHLY",
            "BUDGET_RANGES_LONGTERM",
            // Features
            "VEHICLE_FEATURES",
            // Minimum seats options
            "MIN_SEATS_PASSENGER",
            "MIN_SEATS_GOODS",
            "MIN_SEATS_MANAGED",
            // Service types
            "SERVICE_TYPES",
            // Nationalities
            "NATIONALITIES",
            // Payment methods
            "PAYMENT_METHODS",
        ],
        index: true,
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: "",
    },
    options: [dropdownOptionItemSchema],
    isSystemDefault: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
}, {
    timestamps: true,
});

// Compound index for unique category
dropdownOptionsSchema.index({ category: 1 }, { unique: true });

const DropdownOptions = mongoose.model("DropdownOptions", dropdownOptionsSchema);

export default DropdownOptions;
