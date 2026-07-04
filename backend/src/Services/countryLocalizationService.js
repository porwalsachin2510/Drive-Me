/**
 * Country Localization Service
 *
 * Thin compatibility layer over the single source of truth in
 * `../Config/localizationConfig.js`. All lookups normalize the incoming country
 * (so "KW", "Kuwait", "KUWAIT", "AE", "UAE" all resolve correctly) and delegate
 * to the central config. Existing function signatures are preserved.
 */
import {
    normalizeCountry,
    getCountryConfig,
    getCountryCurrency as configGetCurrency,
    getCurrencyDecimals as configGetDecimals,
    getCurrencySymbol as configGetSymbol,
    getCountryPaymentMethods as configGetMethods,
    getCountryPaymentGateway as configGetGateway,
    getCountryFromCurrency,
    getEffectiveCountry as configGetEffectiveCountry,
} from "../Config/localizationConfig.js";

// Effective country for a user (honors the DEV_COUNTRY testing override).
export const getEffectiveCountry = (user) => configGetEffectiveCountry(user);

// Currency for a country. Normalizes any variant ("Kuwait" -> KW -> KWD).
export const getCountryCurrency = (userCountry) => configGetCurrency(userCountry);

// Decimal places for a currency (KWD/BHD/OMR -> 3, others -> 2).
export const getCurrencyDecimals = (currency) => configGetDecimals(currency);

// Display symbol for a currency.
export const getCurrencySymbol = (currency) => configGetSymbol(currency);

// Payment gateway config for a country (object shape kept for compatibility).
// Resolves the primary gateway from the central config.
export const getCountryPaymentGateway = (userCountry) => {
    const config = getCountryConfig(userCountry);
    return {
        primary: config.paymentGateway,
        fallback: config.fallbackGateway || null,
        supportedMethods: config.paymentMethods.filter((m) => m.enabled).map((m) => m.id),
    };
};

// Enabled payment methods for a country (normalized).
export const getCountryPaymentMethods = (userCountry) => configGetMethods(userCountry);

// Export function to format currency for display
export const formatCurrencyForDisplay = (amount, currency) => {
    const decimals = getCurrencyDecimals(currency);
    const symbol = getCurrencySymbol(currency);
    return `${symbol} ${parseFloat(amount).toFixed(decimals)}`;
};

// Export function to validate price based on country currency
export const validateCountryPrice = (price, userCountry) => {
    const currency = getCountryCurrency(userCountry);
    const decimals = getCurrencyDecimals(currency);

    // Ensure price has proper decimal places
    const validatedPrice = parseFloat(price).toFixed(decimals);
    return {
        price: parseFloat(validatedPrice),
        currency,
        decimals
    };
};

// Canonical country code from a currency (e.g. "KWD" -> "KW").
export const getCurrencyCountry = (currency) => getCountryFromCurrency(currency);

export default {
    getEffectiveCountry,
    getCountryCurrency,
    getCurrencyDecimals,
    getCurrencySymbol,
    getCountryPaymentGateway,
    getCountryPaymentMethods,
    formatCurrencyForDisplay,
    validateCountryPrice,
    getCurrencyCountry
};
