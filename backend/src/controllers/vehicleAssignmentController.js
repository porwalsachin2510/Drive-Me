import VehicleAssignment from "../models/VehicleAssignment.js";
import Contract from "../models/Contract.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import { createNotification, sendRealTimeNotification, sendAdminNotification } from "../Services/notificationService.js";

// Get contract details for vehicle assignment
export const getContractForAssignment = async (req, res) => {
    try {
        const { contractId } = req.params

        const contract = await Contract.findById(contractId)
            .populate("corporateOwnerId", "name email phone company")
            .populate("vehicles.vehicleId")
            .populate("vehicles.assignedVehicles.vehicleId")
            .populate("vehicles.assignedVehicles.driverId", "name email phone")

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Check if user is the fleet owner
        if (contract.fleetOwnerId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to assign vehicles for this contract",
            })
        }

        // Get available vehicles
        const availableVehicles = await Vehicle.find({
            ownerId: req.userId,
            status: "AVAILABLE",
        })

        res.status(200).json({
            success: true,
            contract,
            availableVehicles,
        })
    } catch (error) {
        console.error("[v0] Error fetching contract for assignment:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching contract details",
            error: error.message,
        })
    }
}

// Assign vehicles to corporate owner
export const assignVehicles = async (req, res) => {
    try {
        const { contractId } = req.params
        const { assignments } = req.body // Array of assignment objects

        const contract = await Contract.findById(contractId)

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Verify fleet owner
        if (contract.fleetOwnerId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Not authorized",
            })
        }

        // Verify contract is active
        if (contract.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Contract must be active to assign vehicles",
            })
        }

        const assignmentRecords = []

        for (const assignment of assignments) {
            const {
                vehicleId,
                driverId,
                withDriver,
                withFuel,
                fuelType,
                fuelLevel,
                withInsurance,
                insuranceDetails,
                withMaintenance,
                maintenancePackage,
                odometerReading,
            } = assignment

            // Create vehicle assignment record
            const vehicleAssignment = new VehicleAssignment({
                contractId: contract._id,
                vehicleId,
                corporateOwnerId: contract.corporateOwnerId,
                fleetOwnerId: contract.fleetOwnerId,
                driverId: withDriver ? driverId : null,
                assignmentDetails: {
                    withDriver,
                    withFuel,
                    fuelType,
                    fuelLevel,
                    withInsurance,
                    insuranceDetails,
                    withMaintenance,
                    maintenancePackage,
                },
                assignmentDate: new Date(),
                status: "ASSIGNED",
                odometer: {
                    startReading: odometerReading || 0,
                },
            })

            await vehicleAssignment.save()

            // Update contract with assigned vehicle
            const vehicleIndex = contract.vehicles.findIndex((v) => v.vehicleId.toString() === vehicleId)

            if (vehicleIndex !== -1) {
                contract.vehicles[vehicleIndex].assignedVehicles.push({
                    vehicleId,
                    driverId: withDriver ? driverId : null,
                    assignedDate: new Date(),
                })
            }

            // Update vehicle status
            await Vehicle.findByIdAndUpdate(vehicleId, {
                status: "RENTED",
                currentContractId: contract._id,
            })

            assignmentRecords.push(vehicleAssignment)
        }

        await contract.save()

        res.status(200).json({
            success: true,
            message: "Vehicles assigned successfully",
            assignments: assignmentRecords,
        })
    } catch (error) {
        console.error("[v0] Error assigning vehicles:", error)
        res.status(500).json({
            success: false,
            message: "Error assigning vehicles",
            error: error.message,
        })
    }
}

// Get assigned vehicles for a contract
export const getAssignedVehicles = async (req, res) => {
    try {
        const { contractId } = req.params

        const assignments = await VehicleAssignment.find({ contractId })
            .populate("vehicleId")
            .populate("driverId", "name email phone")
            .populate("contractId", "contractNumber")
            .sort({ assignmentDate: -1 })

        res.status(200).json({
            success: true,
            assignments,
        })
    } catch (error) {
        console.error("[v0] Error fetching assigned vehicles:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching assigned vehicles",
            error: error.message,
        })
    }
}

// Get assignment by ID
export const getAssignmentById = async (req, res) => {
    try {
        const { assignmentId } = req.params

        const assignment = await VehicleAssignment.findById(assignmentId)
            .populate("vehicleId", "make model year licensePlate")
            .populate("driverId", "name email phone licenseNumber")
            .populate({
                path: "contractId",
                select: "contractNumber startDate endDate vehicleType vehicleQuantity includeDriver includeFuel status",
                populate: {
                    path: "corporateOwnerId",
                    select: "name email businessName phone",
                },
            })

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found",
            })
        }

        // Check if user is authorized to view this assignment
        const isFleetOwner = assignment.fleetOwnerId.toString() === req.userId.toString()
        const isCorporateOwner = assignment.corporateOwnerId.toString() === req.userId.toString()

        if (!isFleetOwner && !isCorporateOwner && req.userRole !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Not authorized to view this assignment",
            })
        }

        res.status(200).json({
            success: true,
            assignment,
        })
    } catch (error) {
        console.error("[v0] Error fetching assignment:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching assignment details",
            error: error.message,
        })
    }
}

// Update vehicle assignment status
export const updateAssignmentStatus = async (req, res) => {
    try {
        const { assignmentId } = req.params
        const { status, notes, odometerReading } = req.body

        const assignment = await VehicleAssignment.findById(assignmentId)

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found",
            })
        }

        assignment.status = status

        if (status === "RETURNED") {
            assignment.returnDate = new Date()
            assignment.odometer.endReading = odometerReading
            assignment.odometer.totalDistance = odometerReading - assignment.odometer.startReading

            // Update vehicle status back to available
            await Vehicle.findByIdAndUpdate(assignment.vehicleId, {
                status: "AVAILABLE",
                currentContractId: null,
            })
        }

        if (notes) {
            assignment.notes.push({
                message: notes,
                createdBy: req.userId,
                createdAt: new Date(),
            })
        }

        await assignment.save()

        res.status(200).json({
            success: true,
            message: "Assignment status updated successfully",
            assignment,
        })
    } catch (error) {
        console.error("[v0] Error updating assignment status:", error)
        res.status(500).json({
            success: false,
            message: "Error updating assignment status",
            error: error.message,
        })
    }
}

// Report damage
export const reportDamage = async (req, res) => {
    try {
        const { assignmentId } = req.params
        const { description, severity, photos, repairCost } = req.body

        const assignment = await VehicleAssignment.findById(assignmentId)

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found",
            })
        }

        assignment.damageReport.push({
            reportedAt: new Date(),
            reportedBy: req.userId,
            description,
            severity,
            photos,
            repairCost,
            repairStatus: "PENDING",
        })

        assignment.status = "DAMAGED"

        await assignment.save()

        res.status(200).json({
            success: true,
            message: "Damage reported successfully",
            assignment,
        })
    } catch (error) {
        console.error("[v0] Error reporting damage:", error)
        res.status(500).json({
            success: false,
            message: "Error reporting damage",
            error: error.message,
        })
    }
}

// Update assignment
export const updateAssignment = async (req, res) => {
    try {
        const { assignmentId } = req.params
        const { assignedVehicles } = req.body

        const assignment = await VehicleAssignment.findById(assignmentId)

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found",
            })
        }

        // Verify fleet owner
        if (assignment.fleetOwnerId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Not authorized",
            })
        }

        // Update the vehicles in contract
        const contract = await Contract.findById(assignment.contractId)

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Update contract with assigned vehicles
        for (const vehicle of assignedVehicles) {
            const { vehicleId, driverId, fuelCardNumber, assignmentDate } = vehicle

            // Update vehicle status
            await Vehicle.findByIdAndUpdate(vehicleId, {
                status: "RENTED",
                currentContractId: contract._id,
            })

            // Create or update vehicle assignment
            await VehicleAssignment.findOneAndUpdate(
                { contractId: contract._id, vehicleId },
                {
                    vehicleId,
                    contractId: contract._id,
                    fleetOwnerId: req.userId,
                    corporateOwnerId: contract.corporateOwnerId,
                    driverId: driverId || null,
                    assignmentDetails: {
                        fuelCardNumber: fuelCardNumber || null,
                    },
                    assignmentDate: assignmentDate || new Date(),
                    status: "ASSIGNED",
                },
                { upsert: true, new: true },
            )
        }

        // Get assignment with populated data for notifications
        const updatedAssignment = await VehicleAssignment.findById(assignmentId)
            .populate("vehicleId")
            .populate("driverId", "fullName")
            .populate("contractId")

        // Get user names for notifications
        const b2bPartner = await User.findById(req.userId).select('fullName companyName')
        const b2bName = b2bPartner?.companyName || b2bPartner?.fullName || 'B2B Partner'

        // Send notification to Corporate about vehicle/driver assignment change
        const corporateNotif = await createNotification({
            userId: contract.corporateOwnerId,
            type: "ASSIGNMENT_UPDATED",
            title: "Vehicle Assignment Updated",
            message: `${b2bName} has updated the vehicle/driver assignment for contract ${contract.contractNumber}. New vehicle: ${updatedAssignment.vehicleId?.vehicleName || 'N/A'}, Driver: ${updatedAssignment.driverId?.fullName || 'N/A'}`,
            metadata: {
                assignmentId: assignmentId,
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                vehicleId: updatedAssignment.vehicleId?._id,
                vehicleName: updatedAssignment.vehicleId?.vehicleName,
                driverId: updatedAssignment.driverId?._id,
                driverName: updatedAssignment.driverId?.fullName,
            },
        })
        sendRealTimeNotification(contract.corporateOwnerId.toString(), corporateNotif)

        // Notify admin about assignment change
        await sendAdminNotification(
            "Vehicle Assignment Updated",
            `${b2bName} updated assignment for contract ${contract.contractNumber}`,
            "ASSIGNMENT_UPDATED",
            { assignmentId, contractId: contract._id, contractNumber: contract.contractNumber }
        )

        res.status(200).json({
            success: true,
            message: "Vehicles assigned successfully",
            assignment: updatedAssignment,
        })
    } catch (error) {
        console.error("[v0] Error updating assignment:", error)
        res.status(500).json({
            success: false,
            message: "Error updating assignment",
            error: error.message,
        })
    }
}

export const getAllAssignments = async (req, res) => {
    try {
        const fleetOwnerId = req.userId;

        const assignments = await VehicleAssignment.find({ fleetOwnerId })
            .populate("vehicleId", "make model year licensePlate")
            .populate("driverId", "name email phone")
            .populate("contractId", "contractNumber startDate endDate vehicleType vehicleQuantity includeDriver includeFuel")
            .populate("corporateOwnerId", "name email businessName")
            .sort({ assignmentDate: -1 })

        res.status(200).json({
            success: true,
            assignments,
        })
    } catch (error) {
        console.error("[v0] Error fetching all assignments:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching assignments",
            error: error.message,
        })
    }
}

