/**
 * Centralized error translation for API responses.
 *
 * Turns low-level database / Mongoose errors (which are meaningless and even
 * scary to end users, e.g. "E11000 duplicate key error ... index: email_1")
 * into clear, human-friendly messages that the frontend can show directly in a
 * toast. This keeps user experience consistent across the whole application.
 */

// Friendly labels for known unique-index field names so duplicate-key errors
// read naturally (e.g. "An account with this email address already exists.").
const FIELD_LABELS = {
    email: "email address",
    phone: "phone number",
    phoneNumber: "phone number",
    mobile: "mobile number",
    licenseNumber: "license number",
    licensePlate: "license plate",
    plateNumber: "plate number",
    registrationNumber: "registration number",
    username: "username",
    vehicleNumber: "vehicle number",
    nationalId: "national ID",
    civilId: "civil ID",
};

const humanizeField = (rawField) => {
    if (!rawField) return "value";
    if (FIELD_LABELS[rawField]) return FIELD_LABELS[rawField];
    // Fall back to a spaced, lowercased version of the raw key
    // (e.g. "someFieldName" -> "some field name").
    return rawField
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]+/g, " ")
        .trim()
        .toLowerCase();
};

/**
 * Extract the offending field name from a Mongo duplicate-key (E11000) error.
 * Prefers the structured `keyPattern` / `keyValue`, then falls back to parsing
 * the index name out of the raw error message.
 */
const getDuplicateField = (error) => {
    if (error?.keyPattern && typeof error.keyPattern === "object") {
        const keys = Object.keys(error.keyPattern);
        if (keys.length > 0) return keys[0];
    }
    if (error?.keyValue && typeof error.keyValue === "object") {
        const keys = Object.keys(error.keyValue);
        if (keys.length > 0) return keys[0];
    }
    // Parse patterns like "index: email_1 dup key" from the message.
    const match = /index:\s*([A-Za-z0-9]+)_\d+/.exec(error?.message || "");
    if (match) return match[1];
    return null;
};

/**
 * Convert any thrown error into a { statusCode, message } pair with a
 * user-friendly message. Never leaks raw stack traces or driver internals.
 */
export const translateError = (error) => {
    // Mongo duplicate key
    if (error?.code === 11000) {
        const field = getDuplicateField(error);
        const label = humanizeField(field);
        return {
            statusCode: 409,
            message: `An account with this ${label} already exists. Please use a different ${label}.`,
        };
    }

    // Mongoose validation error - surface the first field message
    if (error?.name === "ValidationError" && error?.errors) {
        const firstKey = Object.keys(error.errors)[0];
        const detail = error.errors[firstKey]?.message;
        return {
            statusCode: 400,
            message: detail || "Some of the information you entered is invalid. Please review the form and try again.",
        };
    }

    // Mongoose cast error (bad ObjectId, etc.)
    if (error?.name === "CastError") {
        return {
            statusCode: 400,
            message: `Invalid value provided for "${humanizeField(error.path)}".`,
        };
    }

    // Fallback - keep the app's own explicit messages if they were thrown
    // intentionally, otherwise a safe generic message.
    return {
        statusCode: error?.statusCode || 500,
        message:
            error?.expose && error?.message
                ? error.message
                : "Something went wrong. Please try again in a moment.",
    };
};

/**
 * Express helper: translate an error and send a JSON response in the app's
 * standard shape ({ success:false, message }).
 */
export const sendErrorResponse = (res, error, fallbackMessage) => {
    const { statusCode, message } = translateError(error);
    return res.status(statusCode).json({
        success: false,
        message: fallbackMessage && statusCode === 500 ? fallbackMessage : message,
    });
};
