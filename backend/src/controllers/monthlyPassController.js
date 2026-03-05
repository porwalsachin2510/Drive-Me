import MonthlyPass from "../models/MonthlyPass.js";
import Route from "../models/Route.js";
import Contract from "../models/Contract.js";
import User from "../models/User.js";
import { io } from "../index.js";

// @desc    Create monthly pass for employee
// @route   POST /api/monthly-pass/create
// @access  Private (Corporate admin only)
export const createMonthlyPass = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { 
            employeeId, 
            routeId, 
            passType, 
            validFrom, 
            validTo, 
            preferredPickupPoint, 
            preferredPickupTime,
            preferredDropPoint,
            paymentMethod
        } = req.body;

        // Validate corporate admin
        const corporate = await User.findById(corporateId);
        if (!corporate || corporate.role !== "CORPORATE") {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        // Validate employee belongs to corporate
        const employee = await User.findById(employeeId);
        if (!employee || employee.companyId?.toString() !== corporateId) {
            return res.status(400).json({
                success: false,
                message: "Employee not found or not authorized"
            });
        }

        // Validate route belongs to corporate
        const route = await Route.findOne({ 
            _id: routeId, 
            corporateId,
            status: "ACTIVE" 
        }).populate('contractId');

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found or unauthorized"
            });
        }

        // Validate pickup point
        const pickupStop = route.stopPoints.find(sp => sp.location === preferredPickupPoint);
        if (!pickupStop) {
            return res.status(400).json({
                success: false,
                message: "Invalid pickup point"
            });
        }

        // Calculate total trips based on pass type and route availability
        const startDate = new Date(validFrom);
        const endDate = new Date(validTo);
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        // Calculate total trips based on available days
        let totalTrips = 0;
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            if (route.availableDays.includes(dayOfWeek)) {
                totalTrips += 1;
            }
        }

        // Calculate pricing (based on contract terms)
        let totalAmount = 0;
        const contract = route.contractId;
        
        if (contract && contract.financials) {
            // Base price per trip from route
            const basePricePerTrip = route.pricePerSeat || 0;
            totalAmount = basePricePerTrip * totalTrips;
            
            // Apply corporate discounts if any
            if (contract.financials.corporateDiscount) {
                totalAmount *= (1 - contract.financials.corporateDiscount / 100);
            }
        }

        // Check for existing active pass
        const existingPass = await MonthlyPass.findOne({
            employeeId,
            status: "ACTIVE",
            validTo: { $gte: new Date() }
        });

        if (existingPass) {
            return res.status(400).json({
                success: false,
                message: "Employee already has an active monthly pass"
            });
        }

        // Create monthly pass
        const monthlyPass = new MonthlyPass({
            employeeId,
            corporateId,
            contractId: route.contractId._id,
            routeId,
            passType,
            validFrom: startDate,
            validTo: endDate,
            preferredPickupPoint,
            preferredPickupTime: pickupStop.time,
            preferredDropPoint,
            totalAmount,
            currency: route.currency,
            paymentMethod,
            totalTrips,
            remainingTrips: totalTrips,
            createdBy: corporateId
        });

        const savedPass = await monthlyPass.save();

        // Handle payment based on method
        if (paymentMethod === "CORPORATE_BILLED") {
            savedPass.paymentStatus = "PAID";
            savedPass.paidAt = new Date();
            await savedPass.save();
        }

        // Notify employee
        io.to(`notifications-${employeeId}`).emit('monthly-pass-created', {
            pass: savedPass,
            route: route
        });

        res.status(201).json({
            success: true,
            message: "Monthly pass created successfully",
            data: { monthlyPass: savedPass }
        });

    } catch (error) {
        console.error("Error creating monthly pass:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create monthly pass"
        });
    }
};

// @desc    Get employee monthly passes
// @route   GET /api/monthly-pass/employee/:employeeId
// @access  Private (Corporate admin or employee)
export const getEmployeeMonthlyPasses = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const requestingUserId = req.userId;

        // Get requesting user
        const requestingUser = await User.findById(requestingUserId);
        
        // Check authorization
        if (requestingUser.role === "CORPORATE") {
            // Corporate admin can see all employee passes
            if (requestingUser._id.toString() !== requestingUserId) {
                // Verify employee belongs to this corporate
                const employee = await User.findById(employeeId);
                if (!employee || employee.companyId?.toString() !== requestingUserId) {
                    return res.status(403).json({
                        success: false,
                        message: "Unauthorized access"
                    });
                }
            }
        } else if (requestingUser._id.toString() !== employeeId) {
            // Employee can only see their own passes
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        const passes = await MonthlyPass.find({ employeeId })
            .populate('routeId', 'fromLocation toLocation stopPoints')
            .populate('contractId', 'contractNumber')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: { passes }
        });

    } catch (error) {
        console.error("Error fetching monthly passes:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch monthly passes"
        });
    }
};

// @desc    Get corporate monthly passes
// @route   GET /api/monthly-pass/corporate
// @access  Private (Corporate admin only)
export const getCorporateMonthlyPasses = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { status, passType, month } = req.query;

        // Build query
        const query = { corporateId };

        if (status) {
            query.status = status;
        }

        if (passType) {
            query.passType = passType;
        }

        if (month) {
            const targetMonth = new Date(month);
            query.validFrom = { $lte: new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0) };
            query.validTo = { $gte: new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1) };
        }

        const passes = await MonthlyPass.find(query)
            .populate('employeeId', 'fullName email phone')
            .populate('routeId', 'fromLocation toLocation')
            .populate('contractId', 'contractNumber')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: { passes }
        });

    } catch (error) {
        console.error("Error fetching corporate monthly passes:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch monthly passes"
        });
    }
};

// @desc    Renew monthly pass
// @route   POST /api/monthly-pass/:passId/renew
// @access  Private (Corporate admin only)
export const renewMonthlyPass = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { passId } = req.params;
        const { newValidTo } = req.body;

        // Get existing pass
        const existingPass = await MonthlyPass.findById(passId)
            .populate('routeId');

        if (!existingPass) {
            return res.status(404).json({
                success: false,
                message: "Monthly pass not found"
            });
        }

        // Verify ownership
        if (existingPass.corporateId.toString() !== corporateId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        // Calculate new pricing
        const oldEndDate = new Date(existingPass.validTo);
        const newEndDate = new Date(newValidTo);
        const extensionDays = Math.ceil((newEndDate - oldEndDate) / (1000 * 60 * 60 * 24));
        
        // Calculate additional trips
        let additionalTrips = 0;
        for (let date = new Date(oldEndDate); date <= newEndDate; date.setDate(date.getDate() + 1)) {
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            if (existingPass.routeId.availableDays.includes(dayOfWeek)) {
                additionalTrips += 1;
            }
        }

        // Calculate additional amount
        const basePricePerTrip = existingPass.routeId.pricePerSeat || 0;
        const additionalAmount = basePricePerTrip * additionalTrips;

        // Update pass
        existingPass.validTo = newEndDate;
        existingPass.totalTrips += additionalTrips;
        existingPass.remainingTrips += additionalTrips;
        existingPass.totalAmount += additionalAmount;

        // Add to renewal history
        existingPass.renewalHistory.push({
            renewedFrom: oldEndDate,
            renewedTo: newEndDate,
            amount: additionalAmount,
            renewedAt: new Date()
        });

        const renewedPass = await existingPass.save();

        // Notify employee
        io.to(`notifications-${existingPass.employeeId}`).emit('monthly-pass-renewed', {
            pass: renewedPass
        });

        res.json({
            success: true,
            message: "Monthly pass renewed successfully",
            data: { monthlyPass: renewedPass }
        });

    } catch (error) {
        console.error("Error renewing monthly pass:", error);
        res.status(500).json({
            success: false,
            message: "Failed to renew monthly pass"
        });
    }
};

// @desc    Cancel monthly pass
// @route   DELETE /api/monthly-pass/:passId/cancel
// @access  Private (Corporate admin only)
export const cancelMonthlyPass = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { passId } = req.params;

        const monthlyPass = await MonthlyPass.findById(passId);
        if (!monthlyPass) {
            return res.status(404).json({
                success: false,
                message: "Monthly pass not found"
            });
        }

        // Verify ownership
        if (monthlyPass.corporateId.toString() !== corporateId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        // Update status
        monthlyPass.status = "CANCELLED";
        await monthlyPass.save();

        // Notify employee
        io.to(`notifications-${monthlyPass.employeeId}`).emit('monthly-pass-cancelled', {
            pass: monthlyPass
        });

        res.json({
            success: true,
            message: "Monthly pass cancelled successfully"
        });

    } catch (error) {
        console.error("Error cancelling monthly pass:", error);
        res.status(500).json({
            success: false,
            message: "Failed to cancel monthly pass"
        });
    }
};

// @desc    Get monthly pass statistics
// @route   GET /api/monthly-pass/statistics
// @access  Private (Corporate admin only)
export const getMonthlyPassStatistics = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { month, year } = req.query;

        // Build date range
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const targetYear = parseInt(year) || new Date().getFullYear();
        
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0);

        // Get statistics
        const stats = await MonthlyPass.aggregate([
            {
                $match: {
                    corporateId: new mongoose.Types.ObjectId(corporateId),
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        status: "$status",
                        passType: "$passType"
                    },
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    totalTrips: { $sum: "$totalTrips" },
                    usedTrips: { $sum: "$usedTrips" }
                }
            }
        ]);

        // Get active passes count
        const activePasses = await MonthlyPass.countDocuments({
            corporateId,
            status: "ACTIVE",
            validTo: { $gte: new Date() }
        });

        // Get expiring soon passes
        const expiringSoon = await MonthlyPass.find({
            corporateId,
            status: "ACTIVE",
            validTo: {
                $gte: new Date(),
                $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
            }
        }).populate('employeeId', 'fullName email');

        res.json({
            success: true,
            data: {
                stats,
                activePasses,
                expiringSoon,
                period: {
                    month: targetMonth,
                    year: targetYear
                }
            }
        });

    } catch (error) {
        console.error("Error fetching monthly pass statistics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch statistics"
        });
    }
};
