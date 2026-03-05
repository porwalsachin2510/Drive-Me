import express from 'express';
import {
    getCorporateEmployees,
    addEmployee,
    bulkUploadEmployees,
    updateEmployeeTransport,
    getEmployeeDetails,
    deleteEmployee,
    getAvailableRoutes
} from '../controllers/employeeController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get all employees for the corporate
router.get('/corporate', getCorporateEmployees);

// Get available routes for employee assignment
router.get('/routes/available', getAvailableRoutes);

// Add single employee
router.post('/add', addEmployee);

// Bulk upload employees
router.post('/bulk-upload', bulkUploadEmployees);

// Get specific employee details
router.get('/:employeeId', getEmployeeDetails);

// Update employee transport details
router.put('/:employeeId/transport', updateEmployeeTransport);

// Delete employee
router.delete('/:employeeId', deleteEmployee);

export default router;
