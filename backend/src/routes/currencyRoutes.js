import express from 'express';
import {
    convertCurrency,
    getExchangeRate,
    convertToMultiple,
    getSupportedCurrencies,
    calculateTransactionFee,
    formatCurrency,
    validateCurrencyAmount
} from '../controllers/currencyController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Convert currency
router.post('/convert', convertCurrency);

// Get exchange rate
router.get('/rate', getExchangeRate);

// Convert to multiple currencies
router.post('/convert-multiple', convertToMultiple);

// Get supported currencies
router.get('/supported', getSupportedCurrencies);

// Calculate transaction fee
router.post('/fee', calculateTransactionFee);

// Format currency
router.post('/format', formatCurrency);

// Validate currency amount
router.post('/validate', validateCurrencyAmount);

export default router;
