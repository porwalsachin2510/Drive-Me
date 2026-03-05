// Real-time currency conversion service
class CurrencyConversionService {
    constructor() {
        this.exchangeRates = {
            AED: {
                KWD: 0.082,
                SAR: 1.02,
                BHD: 0.102,
                OMR: 0.105,
                QAR: 0.99,
                USD: 0.27,
                EUR: 0.25
            },
            KWD: {
                AED: 12.20,
                SAR: 12.44,
                BHD: 1.24,
                OMR: 1.28,
                QAR: 12.07,
                USD: 3.30,
                EUR: 3.05
            },
            SAR: {
                AED: 0.98,
                KWD: 0.080,
                BHD: 0.100,
                OMR: 0.103,
                QAR: 0.97,
                USD: 0.27,
                EUR: 0.25
            },
            BHD: {
                AED: 9.80,
                KWD: 0.081,
                SAR: 10.00,
                OMR: 1.03,
                QAR: 9.70,
                USD: 2.65,
                EUR: 2.45
            },
            OMR: {
                AED: 9.52,
                KWD: 0.078,
                SAR: 9.71,
                BHD: 0.97,
                QAR: 9.42,
                USD: 2.58,
                EUR: 2.38
            },
            QAR: {
                AED: 1.01,
                KWD: 0.083,
                SAR: 1.03,
                BHD: 0.103,
                OMR: 0.106,
                USD: 0.27,
                EUR: 0.25
            }
        };

        this.supportedCurrencies = ["AED", "KWD", "SAR", "BHD", "OMR", "QAR", "USD", "EUR"];
    }

    // Convert amount from one currency to another
    convert(amount, fromCurrency, toCurrency) {
        try {
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

    // Get exchange rate between two currencies
    getExchangeRate(fromCurrency, toCurrency) {
        try {
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
