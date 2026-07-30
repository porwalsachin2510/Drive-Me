import toast from "react-hot-toast";

/**
 * Centralized toast helpers so the whole app shows consistent, friendly
 * notifications instead of raw browser alert() dialogs or unparsed errors.
 */

const BASE_STYLE = {
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 500,
    maxWidth: "420px",
};

/**
 * Extract a clean, human-readable message from any error shape:
 * axios errors, fetch Response bodies, plain Error objects, or strings.
 * Falls back to a sensible default so users never see "[object Object]"
 * or a raw Mongo "E11000 duplicate key" string.
 */
export const getErrorMessage = (
    error,
    fallback = "Something went wrong. Please try again."
) => {
    if (!error) return fallback;

    // Plain string error
    if (typeof error === "string") return error;

    // Axios-style error: error.response.data.message
    const data = error?.response?.data;
    if (data) {
        if (typeof data === "string") return data;
        if (data.message && typeof data.message === "string") return data.message;
        if (data.error && typeof data.error === "string") return data.error;
        // Mongoose validation errors: { errors: { field: { message } } }
        if (data.errors && typeof data.errors === "object") {
            const first = Object.values(data.errors)[0];
            if (first?.message) return first.message;
        }
    }

    // Direct message on the error object
    if (error.message && typeof error.message === "string") {
        // Never surface a raw duplicate-key error to the user
        if (error.message.includes("E11000") || error.message.includes("duplicate key")) {
            return "This record already exists. Please check for duplicate values.";
        }
        return error.message;
    }

    return fallback;
};

export const showSuccess = (message) =>
    toast.success(message, {
        style: { ...BASE_STYLE, background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" },
        iconTheme: { primary: "#059669", secondary: "#ecfdf5" },
        duration: 3500,
    });

export const showError = (error, fallback) =>
    toast.error(getErrorMessage(error, fallback), {
        style: { ...BASE_STYLE, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
        iconTheme: { primary: "#dc2626", secondary: "#fef2f2" },
        duration: 5000,
    });

export const showInfo = (message) =>
    toast(message, {
        style: { ...BASE_STYLE, background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe" },
        duration: 4000,
    });

export const showLoading = (message = "Please wait...") =>
    toast.loading(message, { style: BASE_STYLE });

export const dismissToast = (id) => toast.dismiss(id);

// Patterns that indicate a failure / validation problem. Checked first so a
// message like "Failed to update driver" is treated as an error even though it
// also contains the positive word "update".
const NEGATIVE_PATTERN =
    /(fail|error|invalid|not found|not support|unsupport|unable|cannot|can't|can not|must |is required|are required|please |already exist|no active|not available|denied|wrong|unauthor|expired|insufficient|missing|select |enter |provide |fill in|fill the|at least|valid )/i;

// Patterns that indicate a successful action.
const POSITIVE_PATTERN =
    /(success|initiat|sent|added|create|updat|delete|removed|saved|complete|approv|submitt|assign|activat|deactivat|uploaded|downloaded|verif|accept|reject|schedul|register|booked|confirm|renew|copied|generat|enabled|disabled|resolved|marked)/i;

/**
 * Smart notification used across the app in place of the native `alert()`.
 * Automatically picks a success (green), error (red) or info (blue) toast based
 * on the message content, and cleanly parses axios / Error objects. This lets
 * every legacy `alert(...)` call become a consistent, on-brand toast.
 */
export const notify = (message, fallback) => {
    // Non-string values (Error, axios error, object) are always failures.
    if (message && typeof message !== "string") {
        return showError(message, fallback);
    }

    const text = (message || fallback || "").toString();
    if (!text) return showInfo("Done.");

    if (NEGATIVE_PATTERN.test(text)) return showError(text);
    if (POSITIVE_PATTERN.test(text)) return showSuccess(text);
    return showInfo(text);
};

export default toast;