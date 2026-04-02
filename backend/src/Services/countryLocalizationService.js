/**
 * Country Localization Service
 * Provides utilities for country-specific configurations including currency, payment gateways, and formatting
 */

// Country to Currency Mapping
const countryToCurrency = {
    "UAE": "AED",
    "KW": "KWD",
    "SA": "SAR",
    "BH": "BHD",
    "OM": "OMR",
    "QA": "QAR"
};

// Currency to Decimal Places Mapping
const currencyDecimals = {
    "AED": 2,
    "KWD": 3,
    "SAR": 2,
    "BHD": 3,
    "OMR": 3,
    "QAR": 2
};

// Currency Symbols
const currencySymbols = {
    "AED": "د.إ",
    "KWD": "د.ك",
    "SAR": "﷼",
    "BHD": ".د.ب",
    "OMR": "ر.ع.",
    "QAR": "ر.ق"
};

// Country to Payment Gateway Mapping
const countryToPaymentGateway = {
    "UAE": {
        primary: "STRIPE",
        fallback: "TAP",
        supportedMethods: ["card", "apple_pay", "google_pay", "knet"]
    },
    "KW": {
        primary: "TAP",
        fallback: null,
        supportedMethods: ["card", "knet", "benefit", "zain_cash", "stc_pay"]
    }
};

// Export function to get currency for a country
export const getCountryCurrency = (userCountry) => {
    const currency = countryToCurrency[userCountry];
    if (!currency) {
        console.warn(`[countryLocalizationService] Unknown country: ${userCountry}, defaulting to AED`);
        return "AED";
    }
    return currency;
};

// Export function to get currency decimals
export const getCurrencyDecimals = (currency) => {
    const decimals = currencyDecimals[currency];
    if (decimals === undefined) {
        console.warn(`[countryLocalizationService] Unknown currency: ${currency}, defaulting to 2 decimals`);
        return 2;
    }
    return decimals;
};

// Export function to get currency symbol
export const getCurrencySymbol = (currency) => {
    const symbol = currencySymbols[currency];
    if (!symbol) {
        console.warn(`[countryLocalizationService] Unknown currency: ${currency}, defaulting to currency code`);
        return currency;
    }
    return symbol;
};

// Export function to get payment gateway config for a country
export const getCountryPaymentGateway = (userCountry) => {
    const gateway = countryToPaymentGateway[userCountry];
    if (!gateway) {
        console.warn(`[countryLocalizationService] No payment gateway configured for country: ${userCountry}`);
        return {
            primary: "TAP",
            fallback: null,
            supportedMethods: ["card"]
        };
    }
    return gateway;
};

// Export function to get payment methods for a country
export const getCountryPaymentMethods = (userCountry) => {
    const methods = {
        "UAE": [
            { id: "card", name: "Credit/Debit Card", gateway: "STRIPE", enabled: true },
            { id: "apple_pay", name: "Apple Pay", gateway: "STRIPE", enabled: true },
            { id: "google_pay", name: "Google Pay", gateway: "STRIPE", enabled: true },
            { id: "knet", name: "KNET", gateway: "TAP", enabled: true }
        ],
        "KW": [
            { id: "card", name: "Credit/Debit Card", gateway: "TAP", enabled: true },
            { id: "knet", name: "KNET", gateway: "TAP", enabled: true },
            { id: "benefit", name: "Benefit", gateway: "TAP", enabled: true },
            { id: "zain_cash", name: "Zain Cash", gateway: "TAP", enabled: true },
            { id: "stc_pay", name: "STC Pay", gateway: "TAP", enabled: true }
        ]
    };

    return methods[userCountry] || methods["UAE"];
};

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

// Export function to get country code from currency
export const getCurrencyCountry = (currency) => {
    for (const [country, curr] of Object.entries(countryToCurrency)) {
        if (curr === currency) {
            return country;
        }
    }
    return null;
};

export default {
    getCountryCurrency,
    getCurrencyDecimals,
    getCurrencySymbol,
    getCountryPaymentGateway,
    getCountryPaymentMethods,
    formatCurrencyForDisplay,
    validateCountryPrice,
    getCurrencyCountry
};
