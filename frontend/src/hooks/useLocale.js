/**
 * useLocale — single source of truth for country, currency and payment gateway
 * on the frontend. Reads from the Redux `locale` slice (hydrated on app load by
 * the initLocale thunk) and exposes formatting helpers.
 *
 * Usage:
 *   const { currency, currencySymbol, paymentGateway, formatCurrency } = useLocale()
 *   formatCurrency(123.5)            // "AED 123.50" or "KWD 123.500"
 *   formatCurrency(123.5, "KWD")     // force a specific currency
 */
import { useSelector } from "react-redux"
import { getCurrencyDecimals, getCurrencySymbol } from "../config/localeConfig"

export const useLocale = () => {
    const locale = useSelector((state) => state.locale)

    const activeCurrency = locale?.currency || "AED"

    // Format an amount. When `currency` is omitted, the user's active locale
    // currency is used — this is what makes the whole app dynamic per country.
    const formatCurrency = (amount, currency) => {
        const cur = currency || activeCurrency
        const decimals = getCurrencyDecimals(cur)
        const symbol = getCurrencySymbol(cur)
        const value =
            amount === null || amount === undefined || isNaN(amount) ? 0 : parseFloat(amount)
        return `${symbol} ${value.toFixed(decimals)}`
    }

    // Amount only (no symbol), respecting the currency's decimal places.
    const formatAmount = (amount, currency) => {
        const cur = currency || activeCurrency
        const decimals = getCurrencyDecimals(cur)
        const value =
            amount === null || amount === undefined || isNaN(amount) ? 0 : parseFloat(amount)
        return value.toFixed(decimals)
    }

    return {
        country: locale?.country || "UAE",
        countryName: locale?.countryName,
        displayName: locale?.displayName,
        isoCode: locale?.isoCode,
        phoneCode: locale?.phoneCode,
        currency: activeCurrency,
        currencySymbol: locale?.currencySymbol || getCurrencySymbol(activeCurrency),
        currencyDecimals: locale?.currencyDecimals ?? getCurrencyDecimals(activeCurrency),
        paymentGateway: locale?.paymentGateway || "STRIPE",
        paymentMethods: locale?.paymentMethods || [],
        serviceAvailable: locale?.serviceAvailable,
        status: locale?.status,
        formatCurrency,
        formatAmount,
        getCurrencySymbol,
        getCurrencyDecimals,
    }
}

export default useLocale
