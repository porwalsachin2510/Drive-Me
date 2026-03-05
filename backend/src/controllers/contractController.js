import Contract from "../models/Contract.js"
import Quotation from "../models/Quotation.js"
import Route from "../models/Route.js"
import { uploadToCloudinary } from "../Config/Cloudinary.js"

// @desc    Create contract request from accepted quotation
// @route   POST /api/contracts/create-from-quotation
// @access  Private (CORPORATE only)
export const createContractFromQuotation = async (req, res) => {


    try {

        console.log("createContractFromQuotation", req.body);
        
        const corporateOwnerId = req.userId

        const { quotationId, notes, urgencyLevel, preferredDeliveryDate } = req.body

        // Find the accepted quotation
        const quotation = await Quotation.findOne({
            _id: quotationId,
            corporateOwnerId,
            status: "ACCEPTED",
        })
            .populate("fleetOwnerId")
            .populate("vehicles.vehicleId")

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Accepted quotation not found",
            })
        }

        // Check if contract already exists
        const existingContract = await Contract.findOne({ quotationId })
        if (existingContract) {
            return res.status(400).json({
                success: false,
                message: "Contract already exists for this quotation",
                data: { contract: existingContract },
            })
        }

        // Prepare notes array if notes is provided
        const notesArray = notes ? [{
            message: notes,
            createdBy: corporateOwnerId,
            createdAt: new Date(),
        }] : []

        const contractCurrency = quotation.quotedPrice?.currency || "AED"
        const totalAmount = quotation.quotedPrice.totalAmount || 0
        const advanceAmount = totalAmount * 0.5 // 50%
        const securityDepositAmount = totalAmount * 0.1 // 10%
        const finalPaymentAmount = totalAmount - advanceAmount

        // Create new contract
        const contract = new Contract({
            quotationId: quotation._id,
            corporateOwnerId: quotation.corporateOwnerId,
            fleetOwnerId: quotation.fleetOwnerId,
            vehicles: quotation.vehicles.map((v) => ({
                vehicleId: v.vehicleId._id,
                quantity: v.quantity,
                assignedVehicles: [],
            })),
            rentalPeriod: quotation.rentalPeriod,
            financials: {

                totalAmount: quotation.quotedPrice.totalAmount,
                currency: contractCurrency,
                advancePayment: {
                    amount: advanceAmount,
                },
                finalPayment: {
                    amount: finalPaymentAmount,
                },
                remainingAmount: totalAmount - advanceAmount,
                securityDeposit: {
                    amount: securityDepositAmount,
                },
            },
            notes: notesArray, // Array of note objects
            // If you need urgencyLevel and preferredDeliveryDate, add them to your schema
            status: "DRAFT",
            statusHistory: [
                {
                    status: "DRAFT",
                    changedAt: new Date(),
                    changedBy: corporateOwnerId,
                    reason: "Contract created from accepted quotation",
                },
            ],
        })

        await contract.save()
        await contract.populate([
            {
                path: "corporateOwnerId",
                select: "fullName email companyName",
            },
            {
                path: "fleetOwnerId",
                select: "fullName email companyName",
            },
            {
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber",
            },
        ])

        res.status(201).json({
            success: true,
            message: "Contract created successfully",
            data: { contract },
        })
    } catch (error) {
        console.error("Error creating contract:", error)
        res.status(500).json({
            success: false,
            message: "Failed to create contract",
            error: error.message,
        })
    }
}

// @desc    Get all contracts for corporate owner
// @route   GET /api/contracts/corporate/all
// @access  Private (CORPORATE only)
export const getCorporateContracts = async (req, res) => {
    try {
        const corporateOwnerId = req.userId

        const contracts = await Contract.find({ corporateOwnerId })
            .populate({
                path: "quotationId",
                select: "quotationNumber requirements",
            })
            .populate({
                path: "fleetOwnerId",
                select: "fullName email companyName",
            })
            .populate({
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber",
            })
            .sort({ createdAt: -1 })

        const stats = {
            total: contracts.length,
            draft: contracts.filter((c) => c.status === "DRAFT").length,
            pendingSignature: contracts.filter((c) => c.status.includes("PENDING") && c.status.includes("SIGNATURE")).length,
            active: contracts.filter((c) => c.status === "ACTIVE").length,
            completed: contracts.filter((c) => c.status === "COMPLETED").length,
        }

        res.status(200).json({
            success: true,
            data: { contracts, stats },
        })
    } catch (error) {
        console.error("Error fetching corporate contracts:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch contracts",
            error: error.message,
        })
    }
}

// @desc    Get contract by ID
// @route   GET /api/contracts/:contractId
// @access  Private (CORPORATE or B2B_PARTNER)
export const getContractById = async (req, res) => {
    try {
        const { contractId } = req.params
        const userId = req.userId

        const contract = await Contract.findById(contractId)
            .populate({
                path: "quotationId",
                select: "quotationNumber requirements quotedPrice",
            })
            .populate({
                path: "corporateOwnerId",
                select: "fullName email companyName whatsappNumber",
            })
            .populate({
                path: "fleetOwnerId",
                select: "fullName email companyName whatsappNumber acceptedPaymentMethods",
            })
            .populate({
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber photos",
            })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Check if user has access to this contract
        if (contract.corporateOwnerId._id.toString() !== userId && contract.fleetOwnerId._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            })
        }

        res.status(200).json({
            success: true,
            data: { contract },
        })
    } catch (error) {
        console.error("Error fetching contract:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch contract",
            error: error.message,
        })
    }
}

// @desc    Fleet owner uploads contract document
// @route   POST /api/contracts/:contractId/upload-document
// @access  Private (B2B_PARTNER only)
export const uploadContractDocument = async (req, res) => {
    try {
        const { contractId } = req.params
        const fleetOwnerId = req.userId

        console.log("[v0] Upload contract document request received")
        console.log("[v0] Contract ID:", contractId)
        console.log("[v0] Fleet Owner ID:", fleetOwnerId)
        console.log("[v0] File received:", req.file ? req.file.originalname : "No file")

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No document file provided. Please upload a PDF file.",
            })
        }

        if (req.file.mimetype !== "application/pdf") {
            return res.status(400).json({
                success: false,
                message: "Only PDF files are allowed for contract documents.",
            })
        }

        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId,
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or you don't have access to this contract",
            })
        }

        console.log("[v0] Uploading PDF to Cloudinary...")
        const uploadResult = await uploadToCloudinary(req.file, "driveme/contracts")

        console.log("[v0] Cloudinary upload successful:", uploadResult.secure_url)

        contract.contractDocument = {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            uploadedAt: new Date(),
            uploadedBy: fleetOwnerId,
            fileName: req.file.originalname,
            fileSize: req.file.size,
        }
        contract.status = "PENDING_CORPORATE_SIGNATURE"
        contract.statusHistory.push({
            status: "PENDING_CORPORATE_SIGNATURE",
            changedBy: fleetOwnerId,
            reason: "Contract document uploaded",
        })

        await contract.save()

        await contract.populate([
            {
                path: "corporateOwnerId",
                select: "fullName email companyName",
            },
            {
                path: "fleetOwnerId",
                select: "fullName email companyName",
            },
        ])

        res.status(200).json({
            success: true,
            message: "Contract document uploaded successfully",
            data: { contract },
        })
    } catch (error) {
        console.error("[v0] Error uploading contract document:", error)
        res.status(500).json({
            success: false,
            message: "Failed to upload contract document",
            error: error.message,
        })
    }
}

// @desc    Sign contract digitally
// @route   POST /api/contracts/:contractId/sign
// @access  Private (CORPORATE or B2B_PARTNER)
// export const signContract = async (req, res) => {
//     try {
//         const { contractId } = req.params
//         const userId = req.userId
//         const userRole = req.userRole
//         const { signature, ipAddress } = req.body

//         console.log(contractId, userId, userRole, signature, ipAddress);
        
//         const contract = await Contract.findById(contractId).populate({
//             path: "quotationId",
//             select: "quotationNumber requirements quotedPrice",
//         })
//             .populate({
//                 path: "corporateOwnerId",
//                 select: "fullName email companyName whatsappNumber",
//             })
//             .populate({
//                 path: "fleetOwnerId",
//                 select: "fullName email companyName whatsappNumber",
//             })
//             .populate({
//                 path: "vehicles.vehicleId",
//                 select: "vehicleName vehicleCategory registrationNumber photos",
//             })
        
//         console.log("contract", contract);

//         if (!contract) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Contract not found",
//             })
//         }

//         // Corporate owner signs first
//         if (userRole === "CORPORATE" && contract.corporateOwnerId.toString() === userId) {
//             if (contract.digitalSignatures.corporateOwner.signed) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "You have already signed this contract",
//                 })
//             }

//             contract.digitalSignatures.corporateOwner = {
//                 signed: true,
//                 signedAt: new Date(),
//                 signature,
//                 ipAddress,
//             }
//             contract.status = "PENDING_FLEET_SIGNATURE"
//             contract.statusHistory.push({
//                 status: "PENDING_FLEET_SIGNATURE",
//                 changedBy: userId,
//                 reason: "Corporate owner signed the contract",
//             })
//         }

//         // Fleet owner signs second
//         if (userRole === "B2B_PARTNER" && contract.fleetOwnerId.toString() === userId) {
//             if (!contract.digitalSignatures.corporateOwner.signed) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Corporate owner must sign first",
//                 })
//             }

//             if (contract.digitalSignatures.fleetOwner.signed) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "You have already signed this contract",
//                 })
//             }

//             contract.digitalSignatures.fleetOwner = {
//                 signed: true,
//                 signedAt: new Date(),
//                 signature,
//                 ipAddress,
//             }
//             contract.status = "PENDING_PAYMENT"
//             contract.statusHistory.push({
//                 status: "PENDING_PAYMENT",
//                 changedBy: userId,
//                 reason: "Fleet owner signed the contract",
//             })
//         }

//         await contract.save()

//         res.status(200).json({
//             success: true,
//             message: "Contract signed successfully",
//             data: { contract },
//         })
//     } catch (error) {
//         console.error("Error signing contract:", error)
//         res.status(500).json({
//             success: false,
//             message: "Failed to sign contract",
//             error: error.message,
//         })
//     }
// }

export const signContract = async (req, res) => {
    try {
        const { contractId } = req.params
        const userId = req.userId
        const userRole = req.userRole
        const { signature, ipAddress } = req.body

        const contract = await Contract.findById(contractId)
            .populate("quotationId", "quotationNumber requirements quotedPrice")
            .populate("corporateOwnerId", "fullName email companyName whatsappNumber")
            .populate("fleetOwnerId", "fullName email companyName whatsappNumber")
            .populate("vehicles.vehicleId", "vehicleName vehicleCategory registrationNumber photos")

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // ✅ Ensure structure exists
        if (!contract.digitalSignatures) {
            contract.digitalSignatures = {
                corporateOwner: {},
                fleetOwner: {},
            }
        }

        /* ================= CORPORATE SIGN ================= */
        if (
            userRole === "CORPORATE" &&
            contract.corporateOwnerId._id.toString() === userId
        ) {
            if (contract.digitalSignatures.corporateOwner?.signed) {
                return res.status(400).json({
                    success: false,
                    message: "You have already signed this contract",
                })
            }

            contract.digitalSignatures.corporateOwner = {
                signed: true,
                signedAt: new Date(),
                signature,
                ipAddress,
            }

            contract.status = "PENDING_FLEET_SIGNATURE"

            contract.statusHistory.push({
                status: "PENDING_FLEET_SIGNATURE",
                changedBy: userId,
                reason: "Corporate owner signed the contract",
            })
        }

        /* ================= FLEET SIGN ================= */
        else if (
            userRole === "B2B_PARTNER" &&
            contract.fleetOwnerId._id.toString() === userId
        ) {
            if (!contract.digitalSignatures.corporateOwner?.signed) {
                return res.status(400).json({
                    success: false,
                    message: "Corporate owner must sign first",
                })
            }

            if (contract.digitalSignatures.fleetOwner?.signed) {
                return res.status(400).json({
                    success: false,
                    message: "You have already signed this contract",
                })
            }

            contract.digitalSignatures.fleetOwner = {
                signed: true,
                signedAt: new Date(),
                signature,
                ipAddress,
            }

            contract.status = "PENDING_PAYMENT"

            contract.statusHistory.push({
                status: "PENDING_PAYMENT",
                changedBy: userId,
                reason: "Fleet owner signed the contract",
            })

        } else {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to sign this contract",
            })
        }

        // ✅ FORCE mongoose to track nested change
        contract.markModified("digitalSignatures")
        contract.markModified("statusHistory")

        await contract.save()

        return res.status(200).json({
            success: true,
            message: "Contract signed successfully",
            data: contract,
        })
    } catch (error) {
        console.error("Error signing contract:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to sign contract",
            error: error.message,
        })
    }
}


// @desc    Process payment for contract
// @route   POST /api/contracts/:contractId/payment
// @access  Private (CORPORATE only)
export const processContractPayment = async (req, res) => {
    try {
        const { contractId } = req.params
        const corporateOwnerId = req.userId
        const { paymentType, amount, transactionId } = req.body // paymentType: 'advance' or 'final'

        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        if (paymentType === "advance") {
            contract.financials.advancePayment.paidAt = new Date()
            contract.financials.advancePayment.transactionId = transactionId
            contract.status = "ACTIVE"
            contract.activatedAt = new Date()
            contract.statusHistory.push({
                status: "ACTIVE",
                changedBy: corporateOwnerId,
                reason: "Advance payment completed",
            })
        } else if (paymentType === "final") {
            contract.financials.finalPayment = {
                amount,
                paidAt: new Date(),
                transactionId,
            }
            contract.status = "COMPLETED"
            contract.completedAt = new Date()
            contract.statusHistory.push({
                status: "COMPLETED",
                changedBy: corporateOwnerId,
                reason: "Final payment completed",
            })
        }

        await contract.save()

        res.status(200).json({
            success: true,
            message: "Payment processed successfully",
            data: { contract },
        })
    } catch (error) {
        console.error("Error processing payment:", error)
        res.status(500).json({
            success: false,
            message: "Failed to process payment",
            error: error.message,
        })
    }
}

// @desc    Get all contracts for fleet owner
// @route   GET /api/contracts/fleet/all
// @access  Private (B2B_PARTNER only)
export const getFleetOwnerContracts = async (req, res) => {
    try {
        const fleetOwnerId = req.userId

        const contracts = await Contract.find({ fleetOwnerId })
            .populate({
                path: "quotationId",
                select: "quotationNumber requirements",
            })
            .populate({
                path: "corporateOwnerId",
                select: "fullName email companyName",
            })
            .populate({
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber",
            })
            .sort({ createdAt: -1 })

        const stats = {
            total: contracts.length,
            draft: contracts.filter((c) => c.status === "DRAFT").length,
            pendingDocument: contracts.filter((c) => c.status === "DRAFT" && !c.contractDocument?.url).length,
            pendingSignature: contracts.filter((c) => c.status.includes("PENDING") && c.status.includes("SIGNATURE")).length,
            active: contracts.filter((c) => c.status === "ACTIVE").length,
            completed: contracts.filter((c) => c.status === "COMPLETED").length,
        }

        res.status(200).json({
            success: true,
            data: { contracts, stats },
        })
    } catch (error) {
        console.error("Error fetching fleet owner contracts:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch contracts",
            error: error.message,
        })
    }
}

// @desc    Fleet owner approves the signed contract
// @route   POST /api/contracts/:contractId/approve
// @access  Private (B2B_PARTNER only)
export const approveContract = async (req, res) => {
    try {
        const { contractId } = req.params
        const fleetOwnerId = req.userId
        const { approvalNotes } = req.body

        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId,
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Check if both parties have signed
        if (!contract.digitalSignatures.corporateOwner.signed || !contract.digitalSignatures.fleetOwner.signed) {
            return res.status(400).json({
                success: false,
                message: "Both parties must sign the contract before approval",
            })
        }

        // Check if already approved
        if (contract.status === "ACTIVE" || contract.status === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "Contract is already approved",
            })
        }

        contract.status = "APPROVED_PENDING_PAYMENT"
        contract.approvedAt = new Date()
        contract.approvedBy = fleetOwnerId
        contract.statusHistory.push({
            status: "APPROVED_PENDING_PAYMENT",
            changedBy: fleetOwnerId,
            reason: approvalNotes || "Fleet owner approved the signed contract",
        })

        await contract.save()

        await contract.populate([
            {
                path: "corporateOwnerId",
                select: "fullName email companyName",
            },
            {
                path: "fleetOwnerId",
                select: "fullName email companyName",
            },
            {
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber",
            },
        ])

        res.status(200).json({
            success: true,
            message: "Contract approved successfully. Awaiting payment from corporate owner.",
            data: { contract },
        })
    } catch (error) {
        console.error("Error approving contract:", error)
        res.status(500).json({
            success: false,
            message: "Failed to approve contract",
            error: error.message,
        })
    }
}

// @desc    Fleet owner rejects the signed contract
// @route   POST /api/contracts/:contractId/reject
// @access  Private (B2B_PARTNER only)
export const rejectContract = async (req, res) => {
    try {
        const { contractId } = req.params
        const fleetOwnerId = req.userId
        const { rejectionReason } = req.body

        if (!rejectionReason) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required",
            })
        }

        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId,
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        contract.status = "REJECTED"
        contract.rejectedAt = new Date()
        contract.rejectedBy = fleetOwnerId
        contract.rejectionReason = rejectionReason
        contract.statusHistory.push({
            status: "REJECTED",
            changedBy: fleetOwnerId,
            reason: rejectionReason,
        })

        await contract.save()

        res.status(200).json({
            success: true,
            message: "Contract rejected successfully",
            data: { contract },
        })
    } catch (error) {
        console.error("Error rejecting contract:", error)
        res.status(500).json({
            success: false,
            message: "Failed to reject contract",
            error: error.message,
        })
    }
}

// @desc    Corporate owner accepts the contract
// @route   POST /api/contracts/:contractId/corporate-accept
// @access  Private (CORPORATE only)
export const corporateAcceptContract = async (req, res) => {
    try {
        const { contractId } = req.params
        const corporateOwnerId = req.userId
        const { acceptanceNotes } = req.body

        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        if (!["PENDING", "DRAFT", "PENDING_SIGNATURES"].includes(contract.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot accept contract with status: ${contract.status}`,
            })
        }

        contract.status = "PENDING_SIGNATURES"
        contract.corporateAcceptedAt = new Date()
        contract.statusHistory.push({
            status: "PENDING_SIGNATURES",
            changedBy: corporateOwnerId,
            reason: acceptanceNotes || "Corporate owner accepted the contract",
        })

        await contract.save()

        await contract.populate([
            { path: "corporateOwnerId", select: "fullName email companyName" },
            { path: "fleetOwnerId", select: "fullName email companyName" },
            { path: "vehicles.vehicleId", select: "vehicleName vehicleCategory registrationNumber" },
        ])

        res.status(200).json({
            success: true,
            message: "Contract accepted successfully. Ready for signatures.",
            data: { contract },
        })
    } catch (error) {
        console.error("Error accepting contract:", error)
        res.status(500).json({
            success: false,
            message: "Failed to accept contract",
            error: error.message,
        })
    }
}

// @desc    Corporate owner rejects the contract
// @route   POST /api/contracts/:contractId/corporate-reject
// @access  Private (CORPORATE only)
export const corporateRejectContract = async (req, res) => {
    try {
        const { contractId } = req.params
        const corporateOwnerId = req.userId
        const { rejectionReason } = req.body

        if (!rejectionReason) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required",
            })
        }

        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        contract.status = "REJECTED"
        contract.rejectedAt = new Date()
        contract.rejectedBy = corporateOwnerId
        contract.rejectionReason = rejectionReason
        contract.statusHistory.push({
            status: "REJECTED",
            changedBy: corporateOwnerId,
            reason: rejectionReason,
        })

        await contract.save()

        res.status(200).json({
            success: true,
            message: "Contract rejected successfully",
            data: { contract },
        })
    } catch (error) {
        console.error("Error rejecting contract:", error)
        res.status(500).json({
            success: false,
            message: "Failed to reject contract",
            error: error.message,
        })
    }
}

// @desc    Fleet owner assigns specific vehicles to contract
// @route   POST /api/contracts/:contractId/assign-vehicles
// @access  Private (B2B_PARTNER only)

export const assignVehicles = async (req, res) => {
    try {
        const { contractId } = req.params
        const userId = req.userId
        const userRole = req.userRole // Use req.userRole to determine who is assigning
        const { vehicleAssignments } = req.body

        if (!vehicleAssignments || !Array.isArray(vehicleAssignments)) {
            return res.status(400).json({
                success: false,
                message: "Invalid vehicle assignments data. Expected an array of assignments.",
            })
        }

        const query = { _id: contractId }
        if (userRole === "B2B_PARTNER") {
            query.fleetOwnerId = userId
        } else if (userRole === "CORPORATE") {
            query.corporateOwnerId = userId
        }

        const contract = await Contract.findOne(query)
            .populate("vehicles.vehicleId")
            .populate("corporateOwnerId")
            .populate("vehicles.assignedVehicles.driverId")

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or you don't have permission to assign vehicles",
            })
        }

        if (contract.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: `Cannot assign vehicles. Contract status is ${contract.status}. Advance payment must be completed first.`,
            })
        }

        if (!contract.financials?.advancePayment?.paidAt) {
            return res.status(400).json({
                success: false,
                message: "Advance payment must be completed before vehicle assignment",
            })
        }

        for (const assignment of vehicleAssignments) {
            const vehicleIndex = contract.vehicles.findIndex(
                (v) => v.vehicleId._id.toString() === assignment.vehicleId.toString(),
            )

            if (vehicleIndex === -1) {
                return res.status(400).json({
                    success: false,
                    message: `Vehicle ${assignment.vehicleId} not found in contract`,
                })
            }

            const vehicleAssignment = {
                vehicleId: assignment.vehicleId,
                assignedDate: new Date(),
                status: "ACTIVE",
                settings: assignment.settings || { mode: "active" },
                route: assignment.route || "",
            }

            if (assignment.driverId) {
                vehicleAssignment.driverId = assignment.driverId
                vehicleAssignment.driverAssignedBy = userRole // Auto-set from authenticated user role

                vehicleAssignment.driverModel =
                    userRole === "CORPORATE" ? "CorporateDriver" : "Driver"
            }

            if (assignment.fuelCardNumber) {
                vehicleAssignment.fuelCardNumber = assignment.fuelCardNumber
                vehicleAssignment.fuelAssignedBy = userRole // Auto-set from authenticated user role
            }

            if (assignment.settings?.fuelType) {
                vehicleAssignment.fuelType = assignment.settings.fuelType
            }

            if (!contract.vehicles[vehicleIndex].assignedVehicles) {
                contract.vehicles[vehicleIndex].assignedVehicles = []
            }
            contract.vehicles[vehicleIndex].assignedVehicles.push(vehicleAssignment)
        }

        contract.statusHistory.push({
            status: "ACTIVE",
            changedBy: userId,
            changedByRole: userRole,
            reason: `Vehicles assigned to contract by ${userRole === "B2B_PARTNER" ? "B2B Partner" : "Corporate"}`,
        })

        await contract.save()

        await contract.populate([
            {
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber photos",
            },
            {
                path: "vehicles.assignedVehicles.driverId",
                select: "name licenseNumber phone email",
            },
        ])

        res.status(200).json({
            success: true,
            message: "Vehicles assigned successfully",
            data: {
                contract,
                assignedBy: userRole,
                timestamp: new Date(),
            },
        })
    } catch (error) {
        console.error("Error assigning vehicles:", error.message)
        res.status(500).json({
            success: false,
            message: "Failed to assign vehicles",
            error: error.message,
        })
    }
}

// @desc    Get all assigned vehicles for a contract
// @route   GET /api/corporate/assigned-vehicles/:contractId
// @access  Private (CORPORATE only)
export const getAssignedVehiclesForContract = async (req, res) => {
    try {
        const { contractId } = req.params
        const corporateOwnerId = req.userId

        // Get contract and verify ownership
        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        })
            .populate({
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber photos",
            })
            .populate({
                path: "vehicles.assignedVehicles.driverId",
                select: "name licenseNumber",
            })
            .populate({
                path: "vehicles.assignedVehicles.routeDetails",
                select:
                    "fromLocation toLocation routeStartDate startTime endTime stopPoints totalDistance estimatedDuration routeNotes status",
            })
            .populate({
                path: "fleetOwnerId",
                select: "fullName companyName",
            })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or access denied",
            })
        }

        // Extract assigned vehicles
        const assignedVehicles = []
        contract.vehicles.forEach((vehicleGroup) => {
            if (vehicleGroup.assignedVehicles && vehicleGroup.assignedVehicles.length > 0) {
                vehicleGroup.assignedVehicles.forEach((assigned) => {
                    assignedVehicles.push({
                        ...assigned.toObject(),
                        vehicleDetails: vehicleGroup.vehicleId,
                    })
                })
            }
        })

        res.status(200).json({
            success: true,
            data: {
                contract,
                assignedVehicles,
            },
        })
    } catch (error) {
        console.error("[v0] Error fetching assigned vehicles:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch assigned vehicles",
            error: error.message,
        })
    }
}

// @desc    Assign driver or fuel to a vehicle
// @route   POST /api/corporate/assign-driver-fuel/:contractId/:assignedVehicleId
// @access  Private (CORPORATE only)
export const assignDriverOrFuelToVehicle = async (req, res) => {
    try {
        const { contractId, assignedVehicleId } = req.params
        const corporateOwnerId = req.userId
        const { driverId, fuelCardNumber } = req.body

        console.log("first my driverId", driverId)


        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Find and update the assigned vehicle
        let updated = false
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find((v) => v._id.toString() === assignedVehicleId)

            if (assignedVehicle) {
                if (driverId) {
                    assignedVehicle.driverId = driverId
                    assignedVehicle.driverAssignedBy = "CORPORATE"
                    assignedVehicle.driverModel = "CorporateDriver"
                }
                if (fuelCardNumber) {
                    assignedVehicle.fuelCardNumber = fuelCardNumber
                    assignedVehicle.fuelAssignedBy = "CORPORATE"
                }
                updated = true
                break
            }
        }

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Assigned vehicle not found",
            })
        }

        contract.markModified("vehicles")
        await contract.save()

        await contract.populate([
            {
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber photos",
            },
            {
                path: "vehicles.assignedVehicles.driverId",
                select: "name licenseNumber",
            },
            {
                path: "vehicles.assignedVehicles.routeDetails",
                select:
                    "fromLocation toLocation routeStartDate startTime endTime stopPoints totalDistance estimatedDuration routeNotes status",
            },
        ])

        res.status(200).json({
            success: true,
            message: "Vehicle assignment updated successfully",
            data: { contract },
        })
    } catch (error) {
        console.error("[v0] Error assigning driver/fuel:", error)
        res.status(500).json({
            success: false,
            message: "Failed to assign driver or fuel",
            error: error.message,
        })
    }
}

// @desc    Assign route to a vehicle
// @route   POST /api/corporate/assign-route/:contractId/:assignedVehicleId
// @access  Private (CORPORATE only)
export const assignRouteToVehicle = async (req, res) => {
    try {
        const { contractId, assignedVehicleId } = req.params
        const corporateOwnerId = req.userId
        const {
            fromLocation,
            toLocation,
            routeStartDate,
            startTime,
            endTime,
            stopPoints,
            totalDistance,
            estimatedDuration,
            availableDays,
            routeNotes,
        } = req.body

        if (!availableDays || !availableDays.length) {
            return res.status(400).json({
                success: false,
                message: "Available days are required",
            })
        }

        // Verify contract ownership
        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        }).populate({
            path: "vehicles.vehicleId",
            select: "capacity vehicleName registrationNumber",
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        let assignedVehicleData = null
        let vehicleDetails = null
        for (const vehicleGroup of contract.vehicles) {
            
            const found = vehicleGroup.assignedVehicles.find((v) => v._id.toString() === assignedVehicleId)
           
            if (found) {
                assignedVehicleData = found
                vehicleDetails = vehicleGroup.vehicleId
                break
            }
        }

        if (!assignedVehicleData) {
            return res.status(404).json({
                success: false,
                message: "Assigned vehicle not found in contract",
            })
        }

        const seatingCapacity = vehicleDetails?.capacity?.seatingCapacity || 0

        if (seatingCapacity === 0) {
            console.log("[v0] Warning: Vehicle has no seating capacity defined, defaulting to 0")
        }

        // Create new route
        const route = new Route({
            contractId,
            assignedVehicleId,
            vehicleId: vehicleDetails?._id || null,
            fromLocation,
            toLocation,
            routeStartDate,
            startTime,
            endTime,
            stopPoints,
            totalDistance,
            estimatedDuration,
            availableDays,
            routeNotes,
            assignedBy: corporateOwnerId,
            totalSeats: seatingCapacity,
            availableSeats: seatingCapacity,
            routeType: "CORPORATE",
            corporateId: corporateOwnerId,
        })

        await route.save()

        let updated = false
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find((v) => v._id.toString() === assignedVehicleId)

            if (assignedVehicle) {
                assignedVehicle.routeDetails = route._id
                updated = true
                break
            }
        }

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Assigned vehicle not found",
            })
        }

        contract.markModified("vehicles")
        await contract.save()

        const updatedRoute = await Route.findById(route._id)
        await contract.populate([
            {
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber photos",
            },
            {
                path: "vehicles.assignedVehicles.driverId",
                select: "name licenseNumber",
            },
            {
                path: "vehicles.assignedVehicles.routeDetails",
                select:
                    "fromLocation toLocation routeStartDate startTime endTime stopPoints totalDistance estimatedDuration routeNotes totalSeats availableSeats status",
            },
        ])

        res.status(201).json({
            success: true,
            message: "Route assigned successfully",
            data: {
                route: updatedRoute,
                contract,
                seatingInfo: {
                    totalSeats: seatingCapacity,
                    availableSeats: seatingCapacity,
                },
            },
        })
    } catch (error) {
        console.error("[v0] Error assigning route:", error)
        res.status(500).json({
            success: false,
            message: "Failed to assign route",
            error: error.message,
        })
    }
}

// @desc    Get routes for a contract
// @route   GET /api/corporate/routes/:contractId
// @access  Private (CORPORATE only)
export const getContractRoutes = async (req, res) => {
    try {
        const { contractId } = req.params
        const corporateOwnerId = req.userId

        // Verify contract ownership
        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        const routes = await Route.find({ contractId }).populate("assignedBy", "fullName")

        res.status(200).json({
            success: true,
            data: { routes },
        })
    } catch (error) {
        console.error("[v0] Error fetching routes:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch routes",
            error: error.message,
        })
    }
}


// // @desc    Update driver/fuel for assigned vehicles
// // @route   POST /api/contracts/:contractId/vehicles/:vehicleId/update
// // @access  Private (CORPORATE only)
// export const updateVehicleAssignment = async (req, res) => {
//     try {
//         const { contractId, vehicleId } = req.params
//         const userId = req.userId
//         const userRole = req.userRole
//         const { driverId, fuelCardNumber } = req.body

//         // Only CORPORATE can update vehicle assignments
//         if (userRole !== "CORPORATE") {
//             return res.status(403).json({
//                 success: false,
//                 message: "Only Corporate users can update vehicle assignments",
//             })
//         }

//         const contract = await Contract.findOne({
//             _id: contractId,
//             corporateOwnerId: userId,
//         })
//             .populate("vehicles.vehicleId")
//             .populate("vehicles.assignedVehicles.driverId")

//         if (!contract) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Contract not found or you don't have permission to update",
//             })
//         }

//         if (contract.status !== "ACTIVE") {
//             return res.status(400).json({
//                 success: false,
//                 message: `Cannot update vehicle assignment. Contract status is ${contract.status}`,
//             })
//         }

//         // Find the vehicle in the contract
//         const vehicleIndex = contract.vehicles.findIndex((v) => v.vehicleId._id.toString() === vehicleId.toString())

//         if (vehicleIndex === -1) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Vehicle ${vehicleId} not found in contract`,
//             })
//         }

//         // Find the assigned vehicle (latest assignment)
//         if (
//             !contract.vehicles[vehicleIndex].assignedVehicles ||
//             contract.vehicles[vehicleIndex].assignedVehicles.length === 0
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No assigned vehicles found for this vehicle",
//             })
//         }

//         const assignedVehicle =
//             contract.vehicles[vehicleIndex].assignedVehicles[contract.vehicles[vehicleIndex].assignedVehicles.length - 1]

//         // Update driver if provided
//         if (driverId) {
//             assignedVehicle.driverId = driverId
//             assignedVehicle.driverAssignedBy = "CORPORATE"
//         }

//         // Update fuel card if provided
//         if (fuelCardNumber) {
//             assignedVehicle.fuelCardNumber = fuelCardNumber
//             assignedVehicle.fuelAssignedBy = "CORPORATE"
//             fuelType = "Included"
//         }

//         // Add status history for update
//         contract.statusHistory.push({
//             status: "ACTIVE",
//             changedBy: userId,
//             changedByRole: "CORPORATE",
//             reason: `Vehicle assignment updated by Corporate${driverId ? " - Driver assigned" : ""}${fuelCardNumber ? " - Fuel card assigned" : ""}`,
//         })

//         await contract.save()

//         await contract.populate([
//             {
//                 path: "vehicles.vehicleId",
//                 select: "vehicleName vehicleCategory registrationNumber photos",
//             },
//             {
//                 path: "vehicles.assignedVehicles.driverId",
//                 select: "name licenseNumber phone email",
//             },
//         ])

//         res.status(200).json({
//             success: true,
//             message: "Vehicle assignment updated successfully",
//             data: {
//                 contract,
//                 updatedAssignment: assignedVehicle,
//                 timestamp: new Date(),
//             },
//         })
//     } catch (error) {
//         console.error("Error updating vehicle assignment:", error.message)
//         res.status(500).json({
//             success: false,
//             message: "Failed to update vehicle assignment",
//             error: error.message,
//         })
//     }
// }





