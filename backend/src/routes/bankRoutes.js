import express from 'express';
import {
    getSupportedBanks,
    validateIBAN,
    validateBankAccount,
    getWithdrawalLimits,
    getProcessingTimes
} from '../controllers/bankController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get supported banks for a country
router.get('/supported', getSupportedBanks);

// Validate IBAN
router.post('/validate/iban', validateIBAN);

// Validate bank account
router.post('/validate/account', validateBankAccount);

// Get withdrawal limits
router.get('/limits', getWithdrawalLimits);

// Get processing times
router.get('/processing-times', getProcessingTimes);

export default router;
