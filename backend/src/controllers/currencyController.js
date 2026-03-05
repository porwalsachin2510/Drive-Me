import currencyConversionService from "../Services/currencyConversionService.js";

// Convert currency
export const convertCurrency = async (req, res) => {
    try {
        const { amount, fromCurrency, toCurrency } = req.body;

        if (!amount || !fromCurrency || !toCurrency) {
            return res.status(400).json({
                success: false,
                message: "Amount, fromCurrency, and toCurrency are required"
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be greater than 0"
            });
        }

        const conversion = currencyConversionService.convert(amount, fromCurrency, toCurrency);

        if (!conversion.success) {
            return res.status(400).json({
                success: false,
                message: conversion.error
            });
        }

        res.json({
            success: true,
            data: conversion
        });
    } catch (error) {
        console.error("Error converting currency:", error);
        res.status(500).json({
            success: false,
            message: "Failed to convert currency"
        });
    }
};

// Get exchange rate
export const getExchangeRate = async (req, res) => {
    try {
        const { fromCurrency, toCurrency } = req.query;

        if (!fromCurrency || !toCurrency) {
            return res.status(400).json({
                success: false,
                message: "fromCurrency and toCurrency are required"
            });
        }

        const rate = currencyConversionService.getExchangeRate(fromCurrency, toCurrency);

        if (!rate.success) {
            return res.status(400).json({
                success: false,
                message: rate.error
            });
        }

        res.json({
            success: true,
            data: rate
        });
    } catch (error) {
        console.error("Error getting exchange rate:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get exchange rate"
        });
    }
};

// Convert to multiple currencies
export const convertToMultiple = async (req, res) => {
    try {
        const { amount, fromCurrency, targetCurrencies } = req.body;

        if (!amount || !fromCurrency || !targetCurrencies) {
            return res.status(400).json({
                success: false,
                message: "Amount, fromCurrency, and targetCurrencies are required"
            });
        }

        if (!Array.isArray(targetCurrencies)) {
            return res.status(400).json({
                success: false,
                message: "targetCurrencies must be an array"
            });
        }

        const conversion = currencyConversionService.convertToMultiple(amount, fromCurrency, targetCurrencies);

        if (!conversion.success) {
            return res.status(400).json({
                success: false,
                message: conversion.error
            });
        }

        res.json({
            success: true,
            data: conversion
        });
    } catch (error) {
        console.error("Error converting to multiple currencies:", error);
        res.status(500).json({
            success: false,
            message: "Failed to convert to multiple currencies"
        });
    }
};

// Get supported currencies
export const getSupportedCurrencies = async (req, res) => {
    try {
        const currencies = currencyConversionService.getSupportedCurrencies();

        res.json({
            success: true,
            data: currencies
        });
    } catch (error) {
        console.error("Error getting supported currencies:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get supported currencies"
        });
    }
};

// Calculate transaction fee
export const calculateTransactionFee = async (req, res) => {
    try {
        const { amount, fromCurrency, toCurrency, feeType = "percentage" } = req.body;

        if (!amount || !fromCurrency || !toCurrency) {
            return res.status(400).json({
                success: false,
                message: "Amount, fromCurrency, and toCurrency are required"
            });
        }

        const feeCalculation = currencyConversionService.calculateTransactionFee(
            amount, 
            fromCurrency, 
            toCurrency, 
            feeType
        );

        if (!feeCalculation.success) {
            return res.status(400).json({
                success: false,
                message: feeCalculation.error
            });
        }

        res.json({
            success: true,
            data: feeCalculation
        });
    } catch (error) {
        console.error("Error calculating transaction fee:", error);
        res.status(500).json({
            success: false,
            message: "Failed to calculate transaction fee"
        });
    }
};

// Format currency
export const formatCurrency = async (req, res) => {
    try {
        const { amount, currency } = req.body;

        if (!amount || !currency) {
            return res.status(400).json({
                success: false,
                message: "Amount and currency are required"
            });
        }

        const formatted = currencyConversionService.formatCurrency(amount, currency);

        res.json({
            success: true,
            data: {
                formatted,
                amount,
                currency
            }
        });
    } catch (error) {
        console.error("Error formatting currency:", error);
        res.status(500).json({
            success: false,
            message: "Failed to format currency"
        });
    }
};

// Validate currency amount
export const validateCurrencyAmount = async (req, res) => {
    try {
        const { amount, currency } = req.body;

        if (!amount || !currency) {
            return res.status(400).json({
                success: false,
                message: "Amount and currency are required"
            });
        }

        const validation = currencyConversionService.validateCurrencyAmount(amount, currency);

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error("Error validating currency amount:", error);
        res.status(500).json({
            success: false,
            message: "Failed to validate currency amount"
        });
    }
};
