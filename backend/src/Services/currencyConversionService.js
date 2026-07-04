// Real-time currency conversion service
//
// Rates are fetched LIVE from a free FX API (open.er-api.com, no API key
// required) and cached in-memory. All public methods stay synchronous and read
// from the cache, so existing callers don't change. A non-blocking refresh runs
// on startup and whenever the cache goes stale (TTL). If the network/API is
// unavailable, we fall back to the seeded approximate rates below so totals are
// never silently wrong by an order of magnitude.
class CurrencyConversionService {
    constructor() {
        // Seed / fallback rates. These are approximate market values used ONLY
        // until the first successful live fetch (and as a network fallback).
        // 1 KWD ~= 11.86 AED, 1 AED ~= 0.0843 KWD, etc.
        this.exchangeRates = {
            AED: {
                KWD: 0.0843,
                SAR: 1.0205,
                BHD: 0.1027,
                OMR: 0.1047,
                QAR: 0.9911,
                USD: 0.2723,
                EUR: 0.2510
            },
            KWD: {
                AED: 11.86,
                SAR: 12.10,
                BHD: 1.219,
                OMR: 1.242,
                QAR: 11.76,
                USD: 3.23,
                EUR: 2.98
            },
            SAR: {
                AED: 0.9799,
                KWD: 0.0826,
                BHD: 0.1006,
                OMR: 0.1026,
                QAR: 0.9712,
                USD: 0.2667,
                EUR: 0.2459
            },
            BHD: {
                AED: 9.737,
                KWD: 0.8203,
                SAR: 9.937,
                OMR: 1.020,
                QAR: 9.651,
                USD: 2.650,
                EUR: 2.444
            },
            OMR: {
                AED: 9.547,
                KWD: 0.8047,
                SAR: 9.743,
                BHD: 0.9806,
                QAR: 9.463,
                USD: 2.598,
                EUR: 2.396
            },
            QAR: {
                AED: 1.0090,
                KWD: 0.0850,
                SAR: 1.0297,
                BHD: 0.1036,
                OMR: 0.1057,
                USD: 0.2747,
                EUR: 0.2533
            }
        };

        this.supportedCurrencies = ["AED", "KWD", "SAR", "BHD", "OMR", "QAR", "USD", "EUR"];

        // Live-fetch bookkeeping.
        this.ratesSource = "fallback";       // "live" once a fetch succeeds
        this.lastFetchedAt = 0;              // epoch ms of last successful fetch
        this.refreshTTL = 6 * 60 * 60 * 1000; // refresh at most every 6 hours
        this.isFetching = false;             // guard against concurrent fetches
        this.apiBase = "https://open.er-api.com/v6/latest/USD";

        // Kick off an initial live fetch (non-blocking). If it fails we keep
        // the seeded fallback rates above.
        this.refreshRates().catch(() => { });
    }

    // Fetch live rates and rebuild the full cross-rate matrix. open.er-api.com
    // returns rates relative to a single base (USD); we derive every A->B pair
    // as usdRates[B] / usdRates[A].
    async refreshRates() {
        if (this.isFetching) return;
        // Skip if cache is still fresh.
        if (this.ratesSource === "live" && Date.now() - this.lastFetchedAt < this.refreshTTL) {
            return;
        }
        this.isFetching = true;
        try {
            if (typeof fetch !== "function") {
                throw new Error("global fetch not available");
            }
            const res = await fetch(this.apiBase, { method: "GET" });
            if (!res.ok) throw new Error(`FX API responded ${res.status}`);
            const data = await res.json();
            const usdRates = data?.rates;
            if (!usdRates || data?.result === "error") {
                throw new Error("FX API returned no rates");
            }

            const matrix = {};
            for (const from of this.supportedCurrencies) {
                const fromPerUsd = usdRates[from];
                if (!fromPerUsd) continue; // currency not provided by API
                matrix[from] = {};
                for (const to of this.supportedCurrencies) {
                    if (from === to) continue;
                    const toPerUsd = usdRates[to];
                    if (!toPerUsd) continue;
                    // 1 `from` = (toPerUsd / fromPerUsd) `to`
                    matrix[from][to] = Math.round((toPerUsd / fromPerUsd) * 1e6) / 1e6;
                }
            }

            // Only replace if we built a sane matrix (at least KWD->AED present).
            if (matrix.KWD?.AED && matrix.AED?.KWD) {
                this.exchangeRates = matrix;
                this.ratesSource = "live";
                this.lastFetchedAt = Date.now();
                console.log(
                    "[v0] Live FX rates updated. 1 KWD =",
                    matrix.KWD.AED,
                    "AED"
                );
            }
        } catch (err) {
            console.log("[v0] Live FX fetch failed, using fallback rates:", err.message);
        } finally {
            this.isFetching = false;
        }
    }

    // Non-blocking staleness check used inside synchronous conversions. Triggers
    // a background refresh when the cache is stale but never blocks the caller.
    maybeRefresh() {
        if (this.isFetching) return;
        if (this.ratesSource !== "live" || Date.now() - this.lastFetchedAt >= this.refreshTTL) {
            this.refreshRates().catch(() => { });
        }
    }

    // Convert amount from one currency to another
    convert(amount, fromCurrency, toCurrency) {
        try {
            this.maybeRefresh();
            if (fromCurrency === toCurrency) {
                return {
                    success: true,
                    amount: amount,
                    fromCurrency,
                    toCurrency,
                    rate: 1
                };
            }

            if (!this.supportedCurrencies.includes(fromCurrency)) {
                return {
                    success: false,
                    error: `Unsupported currency: ${fromCurrency}`
                };
            }

            if (!this.supportedCurrencies.includes(toCurrency)) {
                return {
                    success: false,
                    error: `Unsupported currency: ${toCurrency}`
                };
            }

            const rate = this.exchangeRates[fromCurrency]?.[toCurrency];

            if (!rate) {
                return {
                    success: false,
                    error: `Exchange rate not available for ${fromCurrency} to ${toCurrency}`
                };
            }

            const convertedAmount = amount * rate;

            return {
                success: true,
                amount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
                fromCurrency,
                toCurrency,
                rate: Math.round(rate * 10000) / 10000 // Round to 4 decimal places
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Convert and return ONLY the numeric amount (high precision, no UI rounding).
    // Safe for aggregation/summing before display formatting. Falls back to the
    // original amount if a rate is unavailable so totals never silently become 0.
    convertAmount(amount, fromCurrency, toCurrency) {
        this.maybeRefresh();
        const value = amount === null || amount === undefined || isNaN(amount) ? 0 : parseFloat(amount);
        const from = (fromCurrency || "").toUpperCase();
        const to = (toCurrency || "").toUpperCase();

        if (!from || !to || from === to) return value;

        const rate = this.exchangeRates[from]?.[to];
        if (rate === undefined || rate === null) {
            // Try to derive via inverse rate if direct one is missing.
            const inverse = this.exchangeRates[to]?.[from];
            if (inverse) return Math.round((value / inverse) * 1e6) / 1e6;
            return value; // last-resort: assume same magnitude
        }
        return Math.round(value * rate * 1e6) / 1e6;
    }

    // Get exchange rate between two currencies
    getExchangeRate(fromCurrency, toCurrency) {
        try {
            this.maybeRefresh();
            if (fromCurrency === toCurrency) {
                return {
                    success: true,
                    rate: 1,
                    fromCurrency,
                    toCurrency
                };
            }

            const rate = this.exchangeRates[fromCurrency]?.[toCurrency];

            if (!rate) {
                return {
                    success: false,
                    error: `Exchange rate not available for ${fromCurrency} to ${toCurrency}`
                };
            }

            return {
                success: true,
                rate: Math.round(rate * 10000) / 10000,
                fromCurrency,
                toCurrency
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Convert amount to multiple target currencies
    convertToMultiple(amount, fromCurrency, targetCurrencies) {
        try {
            const results = {};

            for (const toCurrency of targetCurrencies) {
                const conversion = this.convert(amount, fromCurrency, toCurrency);
                if (conversion.success) {
                    results[toCurrency] = conversion;
                } else {
                    results[toCurrency] = {
                        success: false,
                        error: conversion.error
                    };
                }
            }

            return {
                success: true,
                fromCurrency,
                amount,
                conversions: results
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get all supported currencies
    getSupportedCurrencies() {
        return {
            success: true,
            currencies: this.supportedCurrencies,
            exchangeRates: this.exchangeRates
        };
    }

    // Format currency amount for display
    formatCurrency(amount, currency) {
        try {
            const currencyFormats = {
                AED: { symbol: "AED", position: "before", decimals: 2 },
                KWD: { symbol: "KWD", position: "before", decimals: 3 },
                SAR: { symbol: "SAR", position: "before", decimals: 2 },
                BHD: { symbol: "BHD", position: "before", decimals: 3 },
                OMR: { symbol: "OMR", position: "before", decimals: 3 },
                QAR: { symbol: "QAR", position: "before", decimals: 2 },
                USD: { symbol: "$", position: "before", decimals: 2 },
                EUR: { symbol: "€", position: "before", decimals: 2 }
            };

            const format = currencyFormats[currency] || currencyFormats.USD;
            const formattedAmount = amount.toFixed(format.decimals);

            if (format.position === "before") {
                return `${format.symbol}${formattedAmount}`;
            } else {
                return `${formattedAmount}${format.symbol}`;
            }
        } catch (error) {
            return `${currency} ${amount}`;
        }
    }

    // Calculate cross-currency transaction fees
    calculateTransactionFee(amount, fromCurrency, toCurrency, feeType = "percentage") {
        try {
            const conversion = this.convert(amount, fromCurrency, toCurrency);

            if (!conversion.success) {
                return {
                    success: false,
                    error: conversion.error
                };
            }

            let fee;
            const feeRates = {
                AED: { percentage: 0.025, fixed: 5 },      // 2.5% or 5 AED minimum
                KWD: { percentage: 0.020, fixed: 1 },      // 2.0% or 1 KWD minimum
                SAR: { percentage: 0.025, fixed: 5 },      // 2.5% or 5 SAR minimum
                BHD: { percentage: 0.020, fixed: 1 },      // 2.0% or 1 BHD minimum
                OMR: { percentage: 0.020, fixed: 1 },      // 2.0% or 1 OMR minimum
                QAR: { percentage: 0.025, fixed: 5 },      // 2.5% or 5 QAR minimum
                USD: { percentage: 0.030, fixed: 2 },      // 3.0% or 2 USD minimum
                EUR: { percentage: 0.030, fixed: 2 }       // 3.0% or 2 EUR minimum
            };

            const feeConfig = feeRates[toCurrency] || feeRates.USD;

            if (feeType === "percentage") {
                fee = Math.max(conversion.amount * feeConfig.percentage, feeConfig.fixed);
            } else {
                fee = feeConfig.fixed;
            }

            return {
                success: true,
                originalAmount: amount,
                convertedAmount: conversion.amount,
                fee: Math.round(fee * 100) / 100,
                netAmount: Math.round((conversion.amount - fee) * 100) / 100,
                fromCurrency,
                toCurrency,
                feeType,
                feePercentage: feeConfig.percentage,
                minimumFee: feeConfig.fixed
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update exchange rates (would be called from external API in production)
    updateExchangeRates(newRates) {
        try {
            this.exchangeRates = { ...this.exchangeRates, ...newRates };
            return {
                success: true,
                message: "Exchange rates updated successfully"
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get currency symbol
    getCurrencySymbol(currency) {
        const symbols = {
            AED: "AED",
            KWD: "KWD",
            SAR: "SAR",
            BHD: "BHD",
            OMR: "OMR",
            QAR: "QAR",
            USD: "$",
            EUR: "€"
        };

        return symbols[currency] || currency;
    }

    // Validate currency amount
    validateCurrencyAmount(amount, currency) {
        try {
            const minAmounts = {
                AED: 1,
                KWD: 0.250,
                SAR: 1,
                BHD: 0.250,
                OMR: 0.250,
                QAR: 1,
                USD: 0.27,
                EUR: 0.25
            };

            const minAmount = minAmounts[currency] || 0.01;

            if (amount < minAmount) {
                return {
                    valid: false,
                    error: `Minimum amount for ${currency} is ${minAmount}`
                };
            }

            if (amount > 1000000) {
                return {
                    valid: false,
                    error: `Maximum amount for ${currency} is 1,000,000`
                };
            }

            return {
                valid: true
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
}

export default new CurrencyConversionService();
