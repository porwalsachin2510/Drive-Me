import Contract from "../models/Contract.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Driver from "../models/Driver.js";
import VehicleAssignment from "../models/VehicleAssignment.js";
import { sendEmail } from "../Services/emailService.js";

// Create dedicated routes for corporate client
export const createDedicatedRoutes = async (req, res) => {
    try {
        const {
            contractId,
            routePlans,
            vehicleAssignments,
            driverAssignments,
            scheduleConfig,
            specialInstructions
        } = req.body;

        const b2bPartnerId = req.userId;

        // Verify contract exists and belongs to this partner
        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId: b2bPartnerId
        });

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found"
            });
        }

        // Create route plans
        const createdRoutes = [];
        for (const routePlan of routePlans) {
            // This would create route records in a Route model
            // For now, store in contract for simplicity
            createdRoutes.push({
                routeName: routePlan.routeName,
                pickupPoints: routePlan.pickupPoints,
                dropoffPoints: routePlan.dropoffPoints,
                timing: routePlan.timing,
                vehicleType: routePlan.vehicleType,
                estimatedCapacity: routePlan.estimatedCapacity
            });
        }

        // Update contract with route details
        contract.dedicatedRoutes = createdRoutes;
        contract.vehicleAssignments = vehicleAssignments;
        contract.driverAssignments = driverAssignments;
        contract.scheduleConfig = scheduleConfig;
        contract.specialInstructions = specialInstructions;
        contract.operationsSetupAt = new Date();
        contract.status = "OPERATIONAL";

        await contract.save();

        // Create vehicle assignments
        for (const assignment of vehicleAssignments) {
            const vehicleAssignment = new VehicleAssignment({
                contractId,
                vehicleId: assignment.vehicleId,
                driverId: assignment.driverId,
                routeId: assignment.routeId,
                schedule: assignment.schedule,
                status: "ASSIGNED",
                assignedAt: new Date()
            });

            await vehicleAssignment.save();

            // Update vehicle and driver status
            await Vehicle.findByIdAndUpdate(assignment.vehicleId, {
                status: "ASSIGNED",
                currentContractId: contractId
            });

            await Driver.findByIdAndUpdate(assignment.driverId, {
                status: "ASSIGNED",
                currentContractId: contractId
            });
        }

        // Notify client of operational status
        await notifyClientOperationsStart(contract);

        res.status(201).json({
            success: true,
            message: "Dedicated routes created successfully",
            data: {
                contractId: contract._id,
                routesCreated: createdRoutes.length,
                vehicleAssignments: vehicleAssignments.length
            }
        });

    } catch (error) {
        console.error("Error creating dedicated routes:", error);
        res.status(500).json({
            success: false,
            message: "Error creating dedicated routes",
            error: error.message
        });
    }
};

// Get seat map for vehicle
export const getVehicleSeatMap = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const b2bPartnerId = req.userId;

        // Verify vehicle belongs to this partner
        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            fleetOwnerId: b2bPartnerId
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        // Get seat assignments for this vehicle
        const seatAssignments = await VehicleAssignment.find({
            vehicleId,
            fleetOwnerId: b2bPartnerId
        })
        .populate('contractId', 'contractNumber')
        .populate('driverId', 'fullName contactNumber')
        .sort({ assignedAt: -1 });

        // Create seat map structure
        const seatMap = {
            vehicleId: vehicle._id,
            vehicleNumber: vehicle.vehicleNumber,
            vehicleType: vehicle.type,
            capacity: vehicle.capacity,
            currentAssignments: seatAssignments.map(assignment => ({
                assignmentId: assignment._id,
                contractId: assignment.contractId._id,
                contractNumber: assignment.contractId.contractNumber,
                driverId: assignment.driverId._id,
                driverName: assignment.driverId.fullName,
                driverContact: assignment.driverId.contactNumber,
                routeId: assignment.routeId,
                schedule: assignment.schedule,
                status: assignment.status,
                assignedAt: assignment.assignedAt
            })),
            seatConfiguration: generateSeatConfiguration(vehicle.capacity),
            standbySeats: Math.floor(vehicle.capacity * 0.1) // 10% standby
        };

        res.status(200).json({
            success: true,
            data: {
                seatMap
            }
        });

    } catch (error) {
        console.error("Error getting vehicle seat map:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving seat map",
            error: error.message
        });
    }
};

// Allocate employees to seats
export const allocateEmployeesToSeats = async (req, res) => {
    try {
        const { vehicleId, contractId } = req.body;
        const { employeeAssignments } = req.body;
        const b2bPartnerId = req.userId;

        // Verify contract and vehicle
        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId: b2bPartnerId
        });

        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            fleetOwnerId: b2bPartnerId
        });

        if (!contract || !vehicle) {
            return res.status(404).json({
                success: false,
                message: "Contract or vehicle not found"
            });
        }

        // Process employee assignments
        const assignments = [];
        for (const empAssignment of employeeAssignments) {
            // Create seat assignment record
            const assignment = new VehicleAssignment({
                contractId,
                vehicleId,
                employeeId: empAssignment.employeeId,
                seatNumber: empAssignment.seatNumber,
                routeId: empAssignment.routeId,
                schedule: empAssignment.schedule,
                status: "ALLOCATED",
                assignedAt: new Date(),
                isTemporary: empAssignment.isTemporary || false,
                temporaryUntil: empAssignment.temporaryUntil || null
            });

            await assignment.save();
            assignments.push({
                assignmentId: assignment._id,
                employeeId: empAssignment.employeeId,
                seatNumber: empAssignment.seatNumber,
                status: "ALLOCATED"
            });
        }

        // Update vehicle capacity tracking
        const allocatedSeats = employeeAssignments.length;
        const availableSeats = vehicle.capacity - allocatedSeats;

        await Vehicle.findByIdAndUpdate(vehicleId, {
            allocatedSeats,
            availableSeats,
            lastAllocationAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: "Employees allocated to seats successfully",
            data: {
                assignments,
                vehicleId: vehicle._id,
                allocatedSeats,
                availableSeats,
                utilizationRate: ((allocatedSeats / vehicle.capacity) * 100).toFixed(2)
            }
        });

    } catch (error) {
        console.error("Error allocating employees to seats:", error);
        res.status(500).json({
            success: false,
            message: "Error allocating employees to seats",
            error: error.message
        });
    }
};

// Handle temporary transfers
export const handleTemporaryTransfer = async (req, res) => {
    try {
        const { employeeId, newVehicleId, newRouteId, transferReason, duration } = req.body;
        const b2bPartnerId = req.userId;

        // Get current assignment
        const currentAssignment = await VehicleAssignment.findOne({
            employeeId,
            fleetOwnerId: b2bPartnerId,
            status: "ALLOCATED"
        }).sort({ assignedAt: -1 });

        if (!currentAssignment) {
            return res.status(404).json({
                success: false,
                message: "No current assignment found for employee"
            });
        }

        // Create temporary transfer record
        const transfer = new VehicleAssignment({
            contractId: currentAssignment.contractId,
            vehicleId: newVehicleId,
            employeeId,
            routeId: newRouteId,
            transferReason,
            status: "TEMPORARY_TRANSFER",
            transferredAt: new Date(),
            temporaryUntil: new Date(Date.now() + (duration * 24 * 60 * 60 * 1000)), // duration in days
            originalAssignmentId: currentAssignment._id
        });

        await transfer.save();

        // Update original assignment
        currentAssignment.status = "TEMPORARILY_TRANSFERRED";
        currentAssignment.transferredAt = new Date();
        await currentAssignment.save();

        // Update new vehicle
        await Vehicle.findByIdAndUpdate(newVehicleId, {
            $inc: { allocatedSeats: 1, $dec: { availableSeats: 1 } }
        });

        // Update old vehicle
        await Vehicle.findByIdAndUpdate(currentAssignment.vehicleId, {
            $dec: { allocatedSeats: 1, $inc: { availableSeats: 1 } }
        });

        // Notify employee of transfer
        await notifyEmployeeTransfer(currentAssignment, transfer);

        res.status(201).json({
            success: true,
            message: "Temporary transfer processed successfully",
            data: {
                transferId: transfer._id,
                employeeId,
                newVehicleId,
                newRouteId,
                duration,
                temporaryUntil: transfer.temporaryUntil
            }
        });

    } catch (error) {
        console.error("Error handling temporary transfer:", error);
        res.status(500).json({
            success: false,
            message: "Error processing temporary transfer",
            error: error.message
        });
    }
};

// Get daily operations dashboard
export const getOperationsDashboard = async (req, res) => {
    try {
        const b2bPartnerId = req.userId;
        const { date } = req.query;

        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

        // Get all active contracts
        const activeContracts = await Contract.find({
            fleetOwnerId: b2bPartnerId,
            status: "ACTIVE"
        });

        // Get vehicle assignments for today
        const todayAssignments = await VehicleAssignment.find({
            fleetOwnerId: b2bPartnerId,
            assignedAt: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        })
        .populate('vehicleId', 'vehicleNumber capacity type')
        .populate('driverId', 'fullName contactNumber')
        .populate('contractId', 'contractNumber')
        .populate('employeeId', 'fullName email')
        .sort({ assignedAt: 1 });

        // Get vehicles and their status
        const vehicles = await Vehicle.find({
            fleetOwnerId: b2bPartnerId
        });

        const vehicleStatus = vehicles.map(vehicle => {
            const assignments = todayAssignments.filter(a => a.vehicleId.toString() === vehicle._id.toString());
            return {
                vehicleId: vehicle._id,
                vehicleNumber: vehicle.vehicleNumber,
                type: vehicle.type,
                capacity: vehicle.capacity,
                allocatedSeats: assignments.length,
                availableSeats: vehicle.capacity - assignments.length,
                utilizationRate: ((assignments.length / vehicle.capacity) * 100).toFixed(2),
                drivers: assignments.map(a => a.driverId),
                assignments: assignments.map(a => ({
                    assignmentId: a._id,
                    contractNumber: a.contractId?.contractNumber,
                    driverName: a.driverId?.fullName,
                    driverContact: a.driverId?.contactNumber,
                    employeeName: a.employeeId?.fullName,
                    employeeEmail: a.employeeId?.email,
                    seatNumber: a.seatNumber,
                    routeId: a.routeId,
                    schedule: a.schedule,
                    status: a.status
                }))
            };
        });

        // Calculate statistics
        const totalVehicles = vehicles.length;
        const totalCapacity = vehicles.reduce((sum, v) => sum + v.capacity, 0);
        const totalAllocated = todayAssignments.length;
        const totalAvailable = totalCapacity - totalAllocated;
        const overallUtilization = totalCapacity > 0 ? ((totalAllocated / totalCapacity) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                date: targetDate,
                activeContracts: activeContracts.length,
                vehicleStatus,
                summary: {
                    totalVehicles,
                    totalCapacity,
                    totalAllocated,
                    totalAvailable,
                    overallUtilization: parseFloat(overallUtilization)
                }
            }
        });

    } catch (error) {
        console.error("Error getting operations dashboard:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving operations dashboard",
            error: error.message
        });
    }
};

// Generate client reports
export const generateClientReports = async (req, res) => {
    try {
        const { contractId, reportType, startDate, endDate } = req.body;
        const b2bPartnerId = req.userId;

        // Verify contract
        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId: b2bPartnerId
        });

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found"
            });
        }

        let reportData;

        switch (reportType) {
            case "attendance":
                reportData = await generateAttendanceReport(contractId, startDate, endDate);
                break;
            case "route_efficiency":
                reportData = await generateRouteEfficiencyReport(contractId, startDate, endDate);
                break;
            case "vehicle_utilization":
                reportData = await generateVehicleUtilizationReport(contractId, startDate, endDate);
                break;
            case "employee_feedback":
                reportData = await generateEmployeeFeedbackReport(contractId, startDate, endDate);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid report type"
                });
        }

        res.status(200).json({
            success: true,
            message: "Report generated successfully",
            data: {
                reportType,
                contractId,
                generatedAt: new Date(),
                reportData
            }
        });

    } catch (error) {
        console.error("Error generating client report:", error);
        res.status(500).json({
            success: false,
            message: "Error generating report",
            error: error.message
        });
    }
};

// Helper functions
const generateSeatConfiguration = (capacity) => {
    const configuration = [];
    const rows = Math.ceil(capacity / 4); // 4 seats per row
    
    for (let row = 0; row < rows; row++) {
        const rowSeats = [];
        for (let seat = 0; seat < 4; seat++) {
            const seatNumber = (row * 4) + seat + 1;
            if (seatNumber <= capacity) {
                rowSeats.push({
                    seatNumber,
                    row: row + 1,
                    position: seat + 1,
                    isAvailable: true,
                    type: "regular"
                });
            }
        }
        configuration.push({
            row: row + 1,
            seats: rowSeats
        });
    }
    
    return configuration;
};

const notifyClientOperationsStart = async (contract) => {
    try {
        const client = await User.findById(contract.corporateOwnerId);
        if (client) {
            await sendEmail({
                to: client.email,
                subject: "Transport Services Started",
                template: "operationsStarted",
                data: {
                    clientName: client.fullName,
                    companyName: client.companyName,
                    contractNumber: contract.contractNumber,
                    startDate: contract.startDate
                }
            });
        }
    } catch (error) {
        console.error("Error notifying client of operations start:", error);
    }
};

const notifyEmployeeTransfer = async (assignment, transfer) => {
    try {
        const employee = await User.findById(assignment.employeeId);
        if (employee) {
            await sendEmail({
                to: employee.email,
                subject: "Temporary Transfer Notification",
                template: "employeeTransfer",
                data: {
                    employeeName: employee.fullName,
                    transferReason: transfer.transferReason,
                    duration: transfer.temporaryUntil,
                    newVehicleInfo: transfer.newVehicleId
                }
            });
        }
    } catch (error) {
        console.error("Error notifying employee of transfer:", error);
    }
};

const generateAttendanceReport = async (contractId, startDate, endDate) => {
    try {
        const CorporateBooking = (await import("../models/CorporateBooking.js")).default;
        const bookings = await CorporateBooking.find({
            contractId,
            travelDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }).populate("passengerId", "fullName email");

        const totalTrips = bookings.length;
        const completedTrips = bookings.filter(b => b.status === "COMPLETED").length;
        const noShowTrips = bookings.filter(b => b.status === "NO_SHOW").length;
        const cancelledTrips = bookings.filter(b => b.status === "CANCELLED").length;
        const attendanceRate = totalTrips > 0 ? ((completedTrips / totalTrips) * 100).toFixed(2) : 0;

        return {
            totalTrips,
            completedTrips,
            noShowTrips,
            cancelledTrips,
            attendanceRate: parseFloat(attendanceRate),
            details: bookings.slice(0, 50).map(b => ({
                employee: b.passengerId?.fullName || "Unknown",
                date: b.travelDate,
                status: b.status
            }))
        };
    } catch (err) {
        console.error("Error generating attendance report:", err);
        return { totalTrips: 0, completedTrips: 0, noShowTrips: 0, cancelledTrips: 0, attendanceRate: 0, details: [] };
    }
};

const generateRouteEfficiencyReport = async (contractId, startDate, endDate) => {
    try {
        const Route = (await import("../models/Route.js")).default;
        const CorporateBooking = (await import("../models/CorporateBooking.js")).default;

        const bookings = await CorporateBooking.find({
            contractId,
            travelDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }).populate("routeId", "fromLocation toLocation");

        const routeMap = {};
        bookings.forEach(b => {
            const key = b.routeId?._id?.toString() || "unknown";
            if (!routeMap[key]) {
                routeMap[key] = {
                    routeName: b.routeId ? `${b.routeId.fromLocation} -> ${b.routeId.toLocation}` : "Unknown",
                    totalTrips: 0,
                    onTime: 0,
                    delayed: 0
                };
            }
            routeMap[key].totalTrips++;
            if (b.status === "COMPLETED") routeMap[key].onTime++;
            else routeMap[key].delayed++;
        });

        const details = Object.values(routeMap);
        const totalRoutes = details.length;
        const totalOnTime = details.reduce((s, r) => s + r.onTime, 0);
        const totalTrips = details.reduce((s, r) => s + r.totalTrips, 0);

        return {
            totalRoutes,
            onTimeRate: totalTrips > 0 ? ((totalOnTime / totalTrips) * 100).toFixed(2) : 0,
            details
        };
    } catch (err) {
        console.error("Error generating route efficiency report:", err);
        return { totalRoutes: 0, onTimeRate: 0, details: [] };
    }
};

// @desc    Get available vehicles for assignment
// @route   GET /api/b2b-operations/vehicles/available
// @access  Private (B2B_PARTNER)
export const getAvailableVehicles = async (req, res) => {
    try {
        const partnerId = req.userId;
        const { vehicleType } = req.query;
        
        const Vehicle = (await import("../models/Vehicle.js")).default;
        
        const query = {
            ownerId: partnerId,
            status: { $in: ["ACTIVE", "AVAILABLE"] }
        };
        
        if (vehicleType) {
            query.type = vehicleType;
        }
        
        const vehicles = await Vehicle.find(query)
            .select("vehicleNumber type capacity make model year status features")
            .lean();
        
        // Filter out vehicles that are already assigned to active contracts
        const assignedVehicleIds = await VehicleAssignment.distinct("vehicleId", {
            partnerId,
            status: { $in: ["ASSIGNED", "IN_USE"] }
        });
        
        const availableVehicles = vehicles.filter(
            v => !assignedVehicleIds.some(id => id.toString() === v._id.toString())
        );
        
        res.json({
            success: true,
            data: { vehicles: availableVehicles }
        });
    } catch (error) {
        console.error("Error fetching available vehicles:", error);
        res.status(500).json({ success: false, message: "Failed to fetch available vehicles" });
    }
};

// @desc    Get available drivers for assignment
// @route   GET /api/b2b-operations/drivers/available
// @access  Private (B2B_PARTNER)
export const getAvailableDrivers = async (req, res) => {
    try {
        const partnerId = req.userId;
        
        const Driver = (await import("../models/Driver.js")).default;
        const User = (await import("../models/User.js")).default;
        
        // Find drivers associated with this partner
        const drivers = await User.find({
            $or: [
                { parentId: partnerId, role: "B2B_PARTNER_DRIVER" },
                { _id: partnerId, role: "B2B_PARTNER" }
            ],
            isActive: true
        })
            .select("fullName email whatsappNumber role")
            .lean();
        
        res.json({
            success: true,
            data: { drivers }
        });
    } catch (error) {
        console.error("Error fetching available drivers:", error);
        res.status(500).json({ success: false, message: "Failed to fetch available drivers" });
    }
};

const generateVehicleUtilizationReport = async (contractId, startDate, endDate) => {
    try {
        const assignments = await VehicleAssignment.find({ contractId })
            .populate("vehicleId", "vehicleNumber capacity type");

        const totalVehicles = assignments.length;
        const activeVehicles = assignments.filter(a => a.status === "ACTIVE" || a.status === "ASSIGNED").length;

        return {
            totalVehicles,
            activeVehicles,
            averageUtilization: totalVehicles > 0 ? ((activeVehicles / totalVehicles) * 100).toFixed(2) : 0,
            details: assignments.map(a => ({
                vehicleNumber: a.vehicleId?.vehicleNumber,
                type: a.vehicleId?.type,
                capacity: a.vehicleId?.capacity,
                status: a.status
            }))
        };
    } catch (err) {
        console.error("Error generating vehicle utilization report:", err);
        return { totalVehicles: 0, activeVehicles: 0, averageUtilization: 0, details: [] };
    }
};

const generateEmployeeFeedbackReport = async (contractId, startDate, endDate) => {
    try {
        const CorporateBooking = (await import("../models/CorporateBooking.js")).default;
        const bookings = await CorporateBooking.find({
            contractId,
            travelDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
            "feedback.rating": { $exists: true, $gt: 0 }
        }).populate("passengerId", "fullName");

        const totalFeedback = bookings.length;
        const avgRating = totalFeedback > 0
            ? (bookings.reduce((s, b) => s + (b.feedback?.rating || 0), 0) / totalFeedback).toFixed(1)
            : 0;

        return {
            totalFeedback,
            averageRating: parseFloat(avgRating),
            details: bookings.slice(0, 50).map(b => ({
                employee: b.passengerId?.fullName,
                rating: b.feedback?.rating,
                comment: b.feedback?.comment,
                date: b.travelDate
            }))
        };
    } catch (err) {
        console.error("Error generating feedback report:", err);
        return { totalFeedback: 0, averageRating: 0, details: [] };
    }
};
