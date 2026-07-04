/**
 * useCurrency Hook (locale-aware)
 *
 * Backward-compatible wrapper around useLocale. Existing callers that do
 * `formatCurrency(amount, "AED")` keep working, but when the currency argument
 * is omitted the user's ACTIVE locale currency is used automatically — so a
 * Kuwait user sees KWD and a UAE user sees AED everywhere, with no per-component
 * hardcoding.
 */
import { useLocale } from "./useLocale"

export const useCurrency = () => {
    const {
        currency,
        currencySymbol,
        currencyDecimals,
        formatCurrency,
        formatAmount,
        getCurrencySymbol,
        getCurrencyDecimals,
    } = useLocale()

    return {
        // active locale values
        currency,
        currencySymbol,
        currencyDecimals,
        // formatters (currency arg optional -> defaults to active currency)
        formatCurrency,
        formatAmount,
        getCurrencyDecimals,
        getCurrencySymbol,
    }
}

export default useCurrency
