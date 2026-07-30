/**
 * displayCurrency — small shared helper that lets ANY admin endpoint render
 * money in the currency the admin has chosen to view the dashboard in.
 *
 * Records across the platform are stored in their NATIVE currency (a UAE
 * booking in AED, a Kuwait booking in KWD, ...). When a platform admin views
 * the dashboard in, say, KWD, every amount must be converted from its native
 * currency to KWD with the live conversion rate and the correct symbol/decimals.
 *
 * Usage in a controller:
 *   import { resolveDisplayCurrency, convertForDisplay, sumByCurrency } from "../Services/displayCurrency.js"
 *   const displayCurrency = resolveDisplayCurrency(req)            // "KWD"
 *   const total = sumByCurrency(bucketsArray, displayCurrency)     // converted+summed
 *   const amount = convertForDisplay(rec.amount, rec.currency, displayCurrency)
 */
import currencyConversionService from "./currencyConversionService.js";

// Currencies the dashboard can be viewed in. Mirrors localizationConfig.
export const SUPPORTED_DISPLAY_CURRENCIES = ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"];

// Map a country code/alias to its currency so endpoints can accept either a
// `displayCurrency` or a `country` query param.
const COUNTRY_TO_CURRENCY = {
    UAE: "AED", AE: "AED",
    KW: "KWD", KWT: "KWD", KUWAIT: "KWD",
    SA: "SAR", KSA: "SAR",
    BH: "BHD", BAHRAIN: "BHD",
    OM: "OMR", OMAN: "OMR",
    QA: "QAR", QATAR: "QAR",
};

export const DEFAULT_DISPLAY_CURRENCY = "AED";

/**
 * The currency every stored amount is denominated in when a record has no
 * explicit `currency` field of its own. The Demand Generation module (leads,
 * campaigns, salaries, commissions, expenses) stores plain numbers in this
 * platform base currency, so reads convert BASE -> displayCurrency and writes
 * convert the admin's entered displayCurrency -> BASE before persisting.
 */
export const BASE_CURRENCY = "AED";

/**
 * Resolve the currency the admin wants to view amounts in, from the request.
 * Accepts `displayCurrency`, `currency`, or `country` query params. Falls back
 * to AED when nothing valid is supplied.
 */
export const resolveDisplayCurrency = (req) => {
    const raw =
        req?.query?.displayCurrency ||
        req?.query?.currency ||
        req?.query?.country ||
        "";
    const key = String(raw).trim().toUpperCase();
    if (SUPPORTED_DISPLAY_CURRENCIES.includes(key)) return key;
    if (COUNTRY_TO_CURRENCY[key]) return COUNTRY_TO_CURRENCY[key];
    return DEFAULT_DISPLAY_CURRENCY;
};

/** Convert a single amount from its native currency to the display currency. */
export const convertForDisplay = (amount, fromCurrency, displayCurrency) =>
    currencyConversionService.convertAmount(
        amount,
        fromCurrency || DEFAULT_DISPLAY_CURRENCY,
        displayCurrency || DEFAULT_DISPLAY_CURRENCY
    );

/**
 * Convert a BASE-currency amount into the requested display currency, rounded
 * to that currency's decimal places. Convenience wrapper for modules (like
 * Demand Generation) whose records are all stored in BASE_CURRENCY.
 */
export const fromBase = (amount, displayCurrency) => {
    const cur = displayCurrency || BASE_CURRENCY;
    const value = currencyConversionService.convertAmount(amount, BASE_CURRENCY, cur);
    const d = decimalsFor(cur);
    const f = Math.pow(10, d);
    return Math.round((Number(value) || 0) * f) / f;
};

/**
 * Convert an amount the admin ENTERED in their display currency back into the
 * BASE currency for storage. Identity when the admin is already viewing in the
 * base currency, so single-market (AED) usage is completely unaffected.
 */
export const toBase = (amount, displayCurrency) =>
    currencyConversionService.convertAmount(amount, displayCurrency || BASE_CURRENCY, BASE_CURRENCY);

/**
 * Given aggregation buckets of the shape { _id: <currency>, total: <number> }
 * (e.g. the output of a `$group: { _id: "$currency", total: { $sum: ... } }`),
 * convert each bucket to the display currency and return the summed total.
 */
export const sumByCurrency = (buckets, displayCurrency) => {
    if (!Array.isArray(buckets)) return 0;
    const sum = buckets.reduce((acc, b) => {
        const native = b?._id || DEFAULT_DISPLAY_CURRENCY;
        const total = Number(b?.total) || 0;
        return acc + convertForDisplay(total, native, displayCurrency);
    }, 0);
    return Math.round(sum * 1e6) / 1e6;
};

/** Decimal places used by a currency (for any backend-side rounding). */
export const decimalsFor = (currency) =>
    ["KWD", "BHD", "OMR"].includes((currency || "").toUpperCase()) ? 3 : 2;
