import express from 'express';
import {
    createRequirement,
    getCorporateRequirements,
    getOpenRequirements,
    getRequirementById,
    updateRequirement,
    publishRequirement,
    closeRequirement,
    deleteRequirement,
    getRequirementStatistics,
    submitQuotationForRequirement,
    selectQuotationForRequirement,
    getRequirementQuotations
} from '../controllers/requirementController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Create new requirement
router.post('/', createRequirement);

// Get requirement statistics
router.get('/statistics', getRequirementStatistics);

// Get requirements for corporate user
router.get('/corporate', getCorporateRequirements);

// Get open requirements for B2B partners
router.get('/open', getOpenRequirements);

// Get specific requirement by ID
router.get('/:id', getRequirementById);

// Update requirement
router.put('/:id', updateRequirement);

// Publish requirement
router.post('/:id/publish', publishRequirement);

// Close requirement
router.post('/:id/close', closeRequirement);

// Delete requirement (soft delete)
router.delete('/:id', deleteRequirement);

// B2B Partner submits quotation against a requirement
router.post('/:id/submit-quotation', submitQuotationForRequirement);

// Corporate selects/awards a quotation for a requirement
router.post('/:id/select-quotation', selectQuotationForRequirement);

// Get all quotations for a specific requirement (Corporate view)
router.get('/:id/quotations', getRequirementQuotations);

export default router;
