// Centralised, role-aware mapping from a notification's `type` to the in-app
// destination it should open. This is the single source of truth used by BOTH
// the full Notifications page and the navbar notification dropdown, so a given
// notification always lands on the same place no matter where it is clicked.
//
// For COMMUTERS, everything lives inside the tab-based profile shell at
// `/commuter-profile?tab=<key>` (My Rides, Wallet, Route Requests, Alerts,
// Settings, ...). Routing to standalone paths like `/commuter/mybookings`
// dropped the user onto a page without the top tab navigation, which is the
// bug this util fixes. Other roles keep their existing dedicated routes.

// Valid commuter profile tabs (see CommuterProfilePage renderContent()).
const COMMUTER_TAB = {
    MY_RIDES: "/commuter-profile?tab=my-rides",
    FIND_ROUTES: "/commuter-profile?tab=find-routes",
    WALLET: "/commuter-profile?tab=wallet",
    ALERTS: "/commuter-profile?tab=alerts",
    TRAVEL_HISTORY: "/commuter-profile?tab=travel-history",
    SUBSCRIPTIONS: "/commuter-profile?tab=subscription-settings",
    ROUTE_REQUESTS: "/commuter-profile?tab=route-requests",
    SETTINGS: "/commuter-profile?tab=settings",
};

// Type groupings shared across roles.
const TRIP_TYPES = new Set([
    "TRIP_REMINDER",
    "TRIP_STARTED",
    "TRIP_COMPLETED",
    "TRIP_DELAY",
    "LATE_TRIP_START",
    "TRIP_UPDATE",
    "TRIP_START_REMINDER",
    "TRIP_ASSIGNED",
    "BUS_NEAR_STOP",
]);

const BOOKING_TYPES = new Set([
    "NEW_BOOKING",
    "BOOKING_ACCEPTED",
    "BOOKING_CONFIRMED",
    "BOOKING_REJECTED",
    "BOOKING_UPDATE",
    "BOOKING_CANCELLED",
    "BOOKING_WARNING",
    "BOOKING_AUTO_CANCELLED",
    "BOOKING_TIMEOUT_CANCELLED",
]);

const SUBSCRIPTION_TYPES = new Set(["SUBSCRIPTION_RENEWAL"]);

const WALLET_TYPES = new Set([
    "WALLET_UPDATED",
    "WALLET_TOPUP",
    // Admin-composed wallet notifications (Send Notification modal / low-balance
    // alerts). sendWalletNotification() tags these as WALLET_ADMIN_ALERT, so they
    // must land on the Wallet tab too instead of the commuter default.
    "WALLET_ADMIN_ALERT",
    "WALLET_LOW_BALANCE",
    "WALLET_FUND_REQUIRED",
    "WALLET_ACTION_REQUIRED",
    "WALLET_USER_RESPONSE",
    "PAYMENT_COMPLETED",
    "PAYMENT_SUBMITTED",
    "PAYMENT_RECEIVED",
    "PAYMENT_VERIFIED",
    "PAYMENT_REJECTED",
    "PAYMENT_SUCCESS",
    "PAYMENT_REMINDER",
    "PAYMENT",
    "PAYOUT",
    "PAYOUT_APPROVED",
    "PAYOUT_REJECTED",
    "PAYOUT_COMPLETED",
    "REFUND",
    "TRANSFER",
    "DEPOSIT",
    "CREDIT",
    "DEBIT",
]);

const ROUTE_REQUEST_TYPES = new Set([
    "ROUTE_REQUEST",
    "NEW_ROUTE_REQUEST",
    "ROUTE_REQUEST_RESPONSE",
]);

const ACCOUNT_TYPES = new Set([
    "ACCOUNT_ACTIVATED",
    "ACCOUNT_REACTIVATED",
    "ACCOUNT_SUSPENDED",
]);

const QUOTATION_TYPES = new Set([
    "QUOTATION_REQUEST",
    "QUOTATION_RECEIVED",
    "QUOTATION_ACCEPTED",
    "QUOTATION_REJECTED",
    "NEW_QUOTATION",
]);

const CONTRACT_TYPES = new Set([
    "CONTRACT_ACTIVATED",
    "CONTRACT_UPDATE",
    "CONTRACT_CREATED",
    "CONTRACT_DOCUMENT_UPLOADED",
    "CONTRACT_SIGNED",
    "CONTRACT_FULLY_SIGNED",
    "CONTRACT_REJECTED",
    "CONTRACT_EXPIRY_WARNING",
    "ASSIGNMENT_UPDATED",
    "DRIVER_ASSIGNED",
    "VEHICLE_ASSIGNED",
    "VEHICLE_CHANGED",
    "SIGNED_DOCUMENT_UPLOADED",
    "SIGNED_DOCUMENT_VERIFIED",
    "SIGNED_DOCUMENT_REJECTED",
]);

const NEGOTIATION_TYPES = new Set([
    "NEGOTIATION_REQUEST",
    "NEGOTIATION_UPDATE",
    "NEGOTIATION_OFFER",
    "NEGOTIATION_STARTED",
    "NEGOTIATION_MESSAGE",
    "NEGOTIATION_RESPONSE",
    "NEGOTIATION_ACCEPTED",
    "NEGOTIATION_REJECTED",
    "NEGOTIATION_COUNTER_OFFER",
    "NEGOTIATION_COMPLETED",
]);

// Keyword groups for content-based fallback when a notification carries a
// generic/unknown `type` (e.g. fully admin-composed messages). We inspect the
// title + message so something like "Add Balance to ... Wallet" still lands on
// the Wallet tab rather than the default.
const WALLET_KEYWORDS = /wallet|balance|fund|top.?up|recharge|credit|debit|refund|payout|payment/i;
const ROUTE_REQUEST_KEYWORDS = /route request/i;
const ACCOUNT_KEYWORDS = /account|password|profile|suspend|activat|permission/i;
const TRIP_KEYWORDS = /\btrip\b|\bride\b|booking|pass\b|monthly pass|driver|vehicle|pickup|drop.?off/i;

// Destination for a commuter. Everything routes inside the profile tab shell.
function commuterRoute(type, text) {
    if (TRIP_TYPES.has(type)) return COMMUTER_TAB.MY_RIDES;
    if (BOOKING_TYPES.has(type)) return COMMUTER_TAB.MY_RIDES;
    if (SUBSCRIPTION_TYPES.has(type)) return COMMUTER_TAB.MY_RIDES;
    if (WALLET_TYPES.has(type)) return COMMUTER_TAB.WALLET;
    if (ROUTE_REQUEST_TYPES.has(type)) return COMMUTER_TAB.ROUTE_REQUESTS;
    if (type === "EMERGENCY") return COMMUTER_TAB.ALERTS;
    if (ACCOUNT_TYPES.has(type)) return COMMUTER_TAB.SETTINGS;

    // Content-based fallback for unknown/admin-composed notification types.
    if (text) {
        if (WALLET_KEYWORDS.test(text)) return COMMUTER_TAB.WALLET;
        if (ROUTE_REQUEST_KEYWORDS.test(text)) return COMMUTER_TAB.ROUTE_REQUESTS;
        if (TRIP_KEYWORDS.test(text)) return COMMUTER_TAB.MY_RIDES;
        if (ACCOUNT_KEYWORDS.test(text)) return COMMUTER_TAB.SETTINGS;
    }

    // Last resort: keep the commuter inside their dashboard rather than dumping
    // them on a bare notifications route.
    return COMMUTER_TAB.MY_RIDES;
}

// Destination for non-commuter roles (B2B partner, corporate, B2C partner, admin).
function otherRoleRoute(type, role) {
    if (QUOTATION_TYPES.has(type)) {
        if (role === "CORPORATE") return "/corporate/quotations";
        return "/b2b/quotations";
    }
    if (CONTRACT_TYPES.has(type)) {
        if (role === "CORPORATE") return "/corporate/contracts";
        if (role === "B2B_PARTNER") return "/b2b/contracts";
        return "/contracts";
    }
    if (NEGOTIATION_TYPES.has(type)) {
        if (role === "ADMIN") return "/admin/negotiations";
        if (role === "B2B_PARTNER") return "/b2b/negotiations";
        if (role === "CORPORATE") return "/corporate/quotations";
        return "/notifications";
    }
    if (ROUTE_REQUEST_TYPES.has(type)) {
        if (role === "B2C_PARTNER") return "/b2c-partner/route-requests";
        return "/notifications";
    }
    // Fallback for anything else for these roles.
    return "/notifications";
}

/**
 * Resolve the destination path for a notification click.
 * @param {{type?: string}} notification
 * @param {{role?: string}} user
 * @returns {string} an in-app path (may include a query string)
 */
export function getNotificationRoute(notification, user) {
    const type = notification?.type || "";
    const role = user?.role || "";
    const text = `${notification?.title || ""} ${notification?.message || ""}`.trim();

    if (role === "COMMUTER") {
        return commuterRoute(type, text);
    }
    return otherRoleRoute(type, role);
}
