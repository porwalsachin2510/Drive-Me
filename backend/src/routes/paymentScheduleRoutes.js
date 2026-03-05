import express from "express"
import {
    createPaymentSchedules,
    getContractPaymentSchedules,
    checkOverduePayments,
    getOverduePayments,
    markPaymentAsPaid,
    sendPaymentReminder,
} from "../controllers/paymentScheduleController.js"
import { verifyToken } from "../middleware/auth.js"

const router = express.Router()

// Create payment schedules for a contract
// @route   POST /api/payment-schedules/contracts/:contractId/schedules
// @desc    Create payment schedules after contract is signed
// @access  Private
router.post("/contracts/:contractId/schedules", verifyToken, createPaymentSchedules)

// Get payment schedules for a contract
// @route   GET /api/payment-schedules/contracts/:contractId/schedules
// @desc    Fetch all payment schedules for a contract
// @access  Private
router.get("/contracts/:contractId/schedules", verifyToken, getContractPaymentSchedules)

// Check overdue payments
// @route   POST /api/payment-schedules/check-overdue
// @desc    Check and update overdue payment statuses
// @access  Private
router.post("/check-overdue", verifyToken, checkOverduePayments)

// Get overdue payments
// @route   GET /api/payment-schedules/overdue
// @desc    Get all overdue payments (filtered by role)
// @access  Private
router.get("/overdue", verifyToken, getOverduePayments)

// Mark payment as paid
// @route   PATCH /api/payment-schedules/:scheduleId/mark-paid
// @desc    Mark a payment schedule as paid
// @access  Private
router.patch("/:scheduleId/mark-paid", verifyToken, markPaymentAsPaid)

// Send payment reminder
// @route   POST /api/payment-schedules/:scheduleId/send-reminder
// @desc    Send payment reminder for a schedule
// @access  Private
router.post("/:scheduleId/send-reminder", verifyToken, sendPaymentReminder)

export default router
