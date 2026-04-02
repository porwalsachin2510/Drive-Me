/**
 * useCurrency Hook
 * Provides utilities for currency formatting and localization
 */

export const useCurrency = () => {
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
        "AED": "AED",
        "KWD": "KWD",
        // "AED": "د.إ",
        // "KWD": "د.ك",
        "SAR": "﷼",
        "BHD": ".د.ب",
        "OMR": "ر.ع.",
        "QAR": "ر.ق"
    };

    // Get currency decimals
    const getCurrencyDecimals = (currency) => {
        return currencyDecimals[currency] || 2;
    };

    // Get currency symbol
    const getCurrencySymbol = (currency) => {
        return currencySymbols[currency] || currency;
    };

    // Format currency for display
    const formatCurrency = (amount, currency) => {
        if (!amount && amount !== 0) {
            return `${getCurrencySymbol(currency)} 0.00`;
        }

        const decimals = getCurrencyDecimals(currency);
        const symbol = getCurrencySymbol(currency);
        const formatted = parseFloat(amount).toFixed(decimals);
        return `${symbol} ${formatted}`;
    };

    // Format amount with proper decimals (no symbol)
    const formatAmount = (amount, currency) => {
        if (!amount && amount !== 0) {
            return "0.00";
        }

        const decimals = getCurrencyDecimals(currency);
        return parseFloat(amount).toFixed(decimals);
    };

    return {
        formatCurrency,
        formatAmount,
        getCurrencyDecimals,
        getCurrencySymbol
    };
};

export default useCurrency;
