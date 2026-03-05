import express from 'express';
import {
    createB2CMonthlyPass,
    getUserB2CMonthlyPasses,
    getB2CMonthlyPassDetails,
    updateB2CDailyUsage,
    renewB2CMonthlyPass,
    cancelB2CMonthlyPass,
    getPartnerB2CMonthlyPasses,
    downloadMonthlyPassCertificate
} from '../controllers/b2cMonthlyPassController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Create monthly pass
router.post('/create', verifyToken, createB2CMonthlyPass);

// Get user monthly passes
router.get('/user/:userId', verifyToken, getUserB2CMonthlyPasses);

// Get monthly pass details
router.get('/details/:passId', verifyToken, getB2CMonthlyPassDetails);

// Update daily usage
router.post('/usage', verifyToken, updateB2CDailyUsage);

// Renew monthly pass
router.post('/renew', verifyToken, renewB2CMonthlyPass);

// Cancel monthly pass
router.post('/cancel', verifyToken, cancelB2CMonthlyPass);

// Download pass certificate PDF
router.get('/download/:passId', verifyToken, downloadMonthlyPassCertificate);

// Get partner monthly passes
router.get('/partner/:partnerId', verifyToken, getPartnerB2CMonthlyPasses);

export default router;
