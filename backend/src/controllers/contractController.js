import Contract from "../models/Contract.js"
import Quotation from "../models/Quotation.js"
import AdminNegotiation from "../models/AdminNegotiation.js"
import Route from "../models/Route.js"
import CorporateRouteSchedule from "../models/CorporateRouteSchedule.js"
import { uploadToCloudinary } from "../Config/Cloudinary.js"
import { createNotification, sendAdminNotification, sendRealTimeNotification } from "../Services/notificationService.js"
import { syncInvoicesForContract } from "../Services/invoiceService.js"
import User from "../models/User.js"
import ManagedServiceBrief from "../models/ManagedServiceBrief.js"
import { logRequestActivity } from "../utils/operationContext.js"
import { autoFulfillBriefItem } from "./managedServiceBriefController.js"

// Helper to get user name
const getUserName = async (userId) => {
    try {
        const user = await User.findById(userId).select('fullName companyName');
        return user?.companyName || user?.fullName || 'User';
    } catch {
        return 'User';
    }
}

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

        // Check if there's a completed negotiation for this quotation
        let negotiationCommission = null
        console.log("[v0] Checking quotation.adminNegotiation:", JSON.stringify(quotation.adminNegotiation))

        // Check if quotation has negotiation data - either from negotiationId or from saved adminCommission
        const hasNegotiationId = quotation.adminNegotiation?.negotiationId
        const hasCompletedNegotiation = quotation.adminNegotiation?.status === "COMPLETED"
        const hasAdminCommission = quotation.adminNegotiation?.adminCommission > 0

        console.log("[v0] hasNegotiationId:", hasNegotiationId, "hasCompletedNegotiation:", hasCompletedNegotiation, "hasAdminCommission:", hasAdminCommission)

        if (hasNegotiationId || (hasCompletedNegotiation && hasAdminCommission)) {
            // Try to fetch negotiation details if we have an ID
            let negotiation = null
            if (hasNegotiationId) {
                negotiation = await AdminNegotiation.findById(quotation.adminNegotiation.negotiationId)
                console.log("[v0] Found negotiation:", negotiation ? negotiation._id : "NOT FOUND")
            }

            // Create negotiationCommission from negotiation OR from quotation.adminNegotiation data
            if (negotiation && negotiation.status === "COMPLETED") {
                negotiationCommission = {
                    negotiationId: negotiation._id,
                    adminCommission: negotiation.adminCommissionFromCorporate?.amount || 0,
                    adminCommissionRate: negotiation.adminCommissionFromCorporate?.rate || 25,
                    commissionStatus: "PENDING",
                    priceSavings: negotiation.priceSaved || 0,
                    originalPrice: negotiation.originalPrice || 0,
                }
                console.log("[v0] Created negotiationCommission from negotiation:", JSON.stringify(negotiationCommission))
            } else if (hasCompletedNegotiation && hasAdminCommission) {
                // Fallback: use data from quotation.adminNegotiation
                negotiationCommission = {
                    negotiationId: quotation.adminNegotiation.negotiationId || null,
                    adminCommission: quotation.adminNegotiation.adminCommission || 0,
                    adminCommissionRate: quotation.adminNegotiation.adminCommissionRate || 25,
                    commissionStatus: "PENDING",
                    priceSavings: quotation.adminNegotiation.savingsAmount || 0,
                    originalPrice: quotation.adminNegotiation.originalPrice || 0,
                }
                console.log("[v0] Created negotiationCommission from quotation data:", JSON.stringify(negotiationCommission))
            }
        }

        // Create new contract
        const contract = new Contract({
            quotationId: quotation._id,
            corporateOwnerId: quotation.corporateOwnerId,
            fleetOwnerId: quotation.fleetOwnerId,
            serviceMode: quotation.serviceMode || "STANDARD",
            vehicles: quotation.vehicles.map((v) => ({
                vehicleId: v.vehicleId._id,
                quantity: v.quantity,
                assignedVehicles: [],
            })),
            rentalPeriod: quotation.rentalPeriod,
            financials: {

                totalAmount: quotation.quotedPrice.totalAmount,
                serviceCharge: quotation.quotedPrice?.serviceCharge || 0,
                currency: contractCurrency,
                advancePayment: {
                    amount: advanceAmount,
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days from contract creation
                },
                finalPayment: {
                    amount: finalPaymentAmount,
                    dueDate: new Date(quotation.rentalPeriod?.endDate || Date.now() + 30 * 24 * 60 * 60 * 1000), // Due at end of rental period
                },
                remainingAmount: totalAmount - advanceAmount,
                securityDeposit: {
                    amount: securityDepositAmount,
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days from contract creation
                    status: "PENDING",
                },
            },
            ...(negotiationCommission && { negotiationCommission }),
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

        // For MANAGED contracts, carry the operational brief the corporate
        // authored at quotation stage onto this contract so the same document
        // drives the contract-stage fulfilment/approval loop. We stamp
        // contractId (and ensure ownership fields) on the existing
        // quotation-stage brief; if none exists yet we lazily create one.
        if ((quotation.serviceMode || "STANDARD") === "MANAGED") {
            try {
                let brief = await ManagedServiceBrief.findOne({ quotationId: quotation._id })
                if (brief) {
                    brief.contractId = contract._id
                    brief.corporateOwnerId = quotation.corporateOwnerId
                    brief.b2bPartnerId = quotation.fleetOwnerId
                    await brief.save()
                } else {
                    await ManagedServiceBrief.create({
                        quotationId: quotation._id,
                        contractId: contract._id,
                        corporateOwnerId: quotation.corporateOwnerId,
                        b2bPartnerId: quotation.fleetOwnerId,
                        status: "DRAFT",
                    })
                }
            } catch (briefError) {
                // Never fail contract creation if brief linking fails.
                console.error("[v0] Failed to link managed-service brief to contract:", briefError.message)
            }
        }

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

        // Get names for notifications
        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || 'Fleet Owner';

        // Notify B2B_PARTNER about new contract
        await createNotification({
            userId: contract.fleetOwnerId._id,
            type: "CONTRACT_CREATED",
            title: "New Contract Created",
            message: `${corporateName} has created a new contract based on your accepted quotation. Total: ${totalAmount} ${contractCurrency}`,
            data: { contractId: contract._id, quotationId: quotation._id, totalAmount, currency: contractCurrency }
        });

        // Notify ADMIN
        await sendAdminNotification(
            "New Contract Created",
            `${corporateName} (CORPORATE) created contract with ${fleetName} (B2B_PARTNER). Total: ${totalAmount} ${contractCurrency}`,
            "CONTRACT_CREATED",
            { contractId: contract._id, corporateId: corporateOwnerId, fleetOwnerId: quotation.fleetOwnerId, totalAmount }
        );

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

// @desc    Get contract by quotation ID
// @route   GET /api/contracts/by-quotation/:quotationId
// @access  Private (CORPORATE or B2B_PARTNER)
export const getContractByQuotation = async (req, res) => {
    try {
        const { quotationId } = req.params
        const userId = req.userId

        const contract = await Contract.findOne({ quotationId })
            .populate({
                path: "quotationId",
                select: "quotationNumber requirements quotedPrice",
            })
            .populate({
                path: "corporateOwnerId",
                select: "fullName email companyName",
            })
            .populate({
                path: "fleetOwnerId",
                select: "fullName email companyName",
            })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "No contract found for this quotation",
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
            contract,
        })
    } catch (error) {
        console.error("Error fetching contract by quotation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch contract",
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

        // Validate contractId before querying
        if (!contractId || contractId === "undefined" || contractId === "null") {
            return res.status(400).json({
                success: false,
                message: "Invalid contract ID provided",
            })
        }

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

        // Get names for notifications
        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || 'Fleet Owner';

        // Notify CORPORATE about document upload
        await createNotification({
            userId: contract.corporateOwnerId._id,
            type: "CONTRACT_DOCUMENT_UPLOADED",
            title: "Contract Document Uploaded",
            message: `${fleetName} has uploaded the contract document. Please review and sign.`,
            data: { contractId: contract._id, documentUrl: uploadResult.secure_url }
        });

        // Notify ADMIN
        await sendAdminNotification(
            "Contract Document Uploaded",
            `${fleetName} (B2B_PARTNER) uploaded contract document for ${corporateName} (CORPORATE). Contract #${contract._id}`,
            "CONTRACT_DOCUMENT_UPLOADED",
            { contractId: contract._id, fleetOwnerId, corporateId: contract.corporateOwnerId._id }
        );

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

        // Get names for notifications
        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || 'Fleet Owner';

        // Send notifications based on who signed
        if (userRole === "CORPORATE") {
            // Notify B2B_PARTNER that corporate signed
            await createNotification({
                userId: contract.fleetOwnerId._id,
                type: "CONTRACT_SIGNED",
                title: "Contract Signed by Corporate",
                message: `${corporateName} has signed the contract. Please review and sign to finalize.`,
                data: { contractId: contract._id }
            });

            // Notify ADMIN
            await sendAdminNotification(
                "Contract Signed by Corporate",
                `${corporateName} (CORPORATE) signed contract with ${fleetName} (B2B_PARTNER). Awaiting fleet owner signature.`,
                "CONTRACT_SIGNED",
                { contractId: contract._id, signedBy: "CORPORATE", corporateId: contract.corporateOwnerId._id, fleetOwnerId: contract.fleetOwnerId._id }
            );
        } else if (userRole === "B2B_PARTNER") {
            // Notify CORPORATE that fleet owner signed - contract is now ready for payment
            await createNotification({
                userId: contract.corporateOwnerId._id,
                type: "CONTRACT_FULLY_SIGNED",
                title: "Contract Fully Signed!",
                message: `${fleetName} has signed the contract. The contract is now active. Please proceed with advance payment.`,
                data: { contractId: contract._id }
            });

            // Notify ADMIN
            await sendAdminNotification(
                "Contract Fully Signed",
                `${fleetName} (B2B_PARTNER) signed contract. Contract between ${corporateName} and ${fleetName} is now fully signed. Awaiting payment.`,
                "CONTRACT_FULLY_SIGNED",
                { contractId: contract._id, signedBy: "B2B_PARTNER", corporateId: contract.corporateOwnerId._id, fleetOwnerId: contract.fleetOwnerId._id }
            );
        }

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
            contract.financials.advancePayment.status = "PAID"
            contract.status = "ACTIVE"
            contract.activatedAt = new Date()
            contract.statusHistory.push({
                status: "ACTIVE",
                changedBy: corporateOwnerId,
                reason: "Advance payment completed",
            })
        } else if (paymentType === "final") {
            contract.financials.finalPayment = {
                ...(contract.financials.finalPayment?.toObject?.() || contract.financials.finalPayment || {}),
                amount,
                paidAt: new Date(),
                transactionId,
                status: "PAID",
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

        // Keep persisted invoices in sync with the new payment status
        try {
            const populatedContract = await Contract.findById(contract._id)
                .populate("corporateOwnerId", "fullName companyName email")
                .populate("fleetOwnerId", "fullName companyName email")
            await syncInvoicesForContract(populatedContract)
        } catch (syncErr) {
            console.error("[v0] Invoice sync after payment failed (non-fatal):", syncErr.message)
        }

        // Get names for notifications
        const corporateName = await getUserName(corporateOwnerId);
        const fleetName = await getUserName(contract.fleetOwnerId);

        // Notify B2B_PARTNER about payment
        if (paymentType === "advance") {
            await createNotification({
                userId: contract.fleetOwnerId,
                type: "PAYMENT_RECEIVED",
                title: "Advance Payment Received",
                message: `${corporateName} has made the advance payment. Contract is now active. Please assign vehicles.`,
                data: { contractId: contract._id, paymentType: "advance", amount: contract.financials.advancePayment.amount }
            });

            // Notify ADMIN
            await sendAdminNotification(
                "Advance Payment Received",
                `${corporateName} (CORPORATE) paid advance payment for contract with ${fleetName} (B2B_PARTNER). Contract is now ACTIVE.`,
                "PAYMENT_RECEIVED",
                { contractId: contract._id, paymentType: "advance", corporateId: corporateOwnerId, fleetOwnerId: contract.fleetOwnerId }
            );
        } else if (paymentType === "final") {
            await createNotification({
                userId: contract.fleetOwnerId,
                type: "PAYMENT_RECEIVED",
                title: "Final Payment Received",
                message: `${corporateName} has made the final payment. Contract is now completed.`,
                data: { contractId: contract._id, paymentType: "final", amount }
            });

            // Notify ADMIN
            await sendAdminNotification(
                "Final Payment Received - Contract Completed",
                `${corporateName} (CORPORATE) paid final payment. Contract with ${fleetName} (B2B_PARTNER) is now COMPLETED.`,
                "CONTRACT_COMPLETED",
                { contractId: contract._id, paymentType: "final", corporateId: corporateOwnerId, fleetOwnerId: contract.fleetOwnerId }
            );
        }

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

        // Get names for notifications
        const corporateName = await getUserName(corporateOwnerId);
        const fleetName = await getUserName(contract.fleetOwnerId);

        // Notify B2B_PARTNER about contract rejection
        await createNotification({
            userId: contract.fleetOwnerId,
            type: "CONTRACT_REJECTED",
            title: "Contract Rejected",
            message: `${corporateName} has rejected the contract. Reason: ${rejectionReason}`,
            data: { contractId: contract._id, reason: rejectionReason }
        });

        // Notify ADMIN
        await sendAdminNotification(
            "Contract Rejected",
            `${corporateName} (CORPORATE) rejected contract with ${fleetName} (B2B_PARTNER). Reason: ${rejectionReason}`,
            "CONTRACT_REJECTED",
            { contractId: contract._id, corporateId: corporateOwnerId, fleetOwnerId: contract.fleetOwnerId, reason: rejectionReason }
        );

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
                message: `Cannot assign vehicles. Contract status is ${contract.status}. Contract must be active first.`,
            })
        }

        // For EMI payment mode, advance payment is not required - contract is activated when EMI plan is created
        // For STANDARD payment mode, advance payment must be completed before vehicle assignment
        const isEMIPaymentMode = contract.financials?.paymentMode === "EMI"
        const isAdvancePaid = !!contract.financials?.advancePayment?.paidAt

        if (!isEMIPaymentMode && !isAdvancePaid) {
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

        // Get names for notifications
        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || await getUserName(contract.corporateOwnerId);
        const fleetName = await getUserName(userId);
        const vehicleCount = vehicleAssignments.length;

        // Notify CORPORATE about vehicle assignment
        await createNotification({
            userId: contract.corporateOwnerId._id || contract.corporateOwnerId,
            type: "VEHICLE_ASSIGNED",
            title: "Vehicles Assigned to Contract",
            message: `${fleetName} has assigned ${vehicleCount} vehicle(s) to your contract. Service is ready to begin.`,
            data: { contractId: contract._id, vehicleCount, assignedBy: userRole }
        });

        // Notify ADMIN
        await sendAdminNotification(
            "Vehicles Assigned to Contract",
            `${fleetName} (B2B_PARTNER) assigned ${vehicleCount} vehicle(s) to contract with ${corporateName} (CORPORATE). Contract #${contract._id}`,
            "VEHICLE_ASSIGNED",
            { contractId: contract._id, vehicleCount, fleetOwnerId: userId, corporateId: contract.corporateOwnerId._id || contract.corporateOwnerId }
        );

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
                    "fromLocation toLocation routeStartDate startTime endTime stopPoints totalDistance estimatedDuration routeNotes status tripTimes availableDays",
            })
            .populate({
                path: "fleetOwnerId",
                select: "fullName companyName",
            })
            .populate({
                path: "corporateOwnerId",
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
        // Who is actually performing this action. When a B2B partner operates on
        // behalf of the corporate (MANAGED contracts), resolveCorporateContext sets
        // req.actingRole = "B2B_PARTNER" and req.actorId = the partner's user id,
        // while req.userId is the impersonated corporate owner.
        const actingRole = req.actingRole || "CORPORATE"
        const actorId = req.actorId || req.userId
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
                    assignedVehicle.driverAssignedBy = actingRole
                    assignedVehicle.driverModel = "CorporateDriver"
                }
                if (fuelCardNumber) {
                    assignedVehicle.fuelCardNumber = fuelCardNumber
                    assignedVehicle.fuelAssignedBy = actingRole
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
                select: "name fullName licenseNumber",
            },
            {
                path: "vehicles.assignedVehicles.routeDetails",
                select:
                    "fromLocation toLocation routeStartDate startTime endTime stopPoints totalDistance estimatedDuration routeNotes status tripTimes availableDays",
            },
        ])

        // Find the vehicle details for notification
        let vehicleName = "Vehicle"
        let driverName = "Driver"
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find((v) => v._id.toString() === assignedVehicleId)
            if (assignedVehicle) {
                vehicleName = vehicleGroup.vehicleId?.vehicleName || "Vehicle"
                driverName = assignedVehicle.driverId?.fullName || assignedVehicle.driverId?.name || "New Driver"
                break
            }
        }

        // Get user names for notifications
        const corporateUser = await User.findById(corporateOwnerId).select('fullName companyName')
        const corporateName = corporateUser?.companyName || corporateUser?.fullName || 'Corporate'

        const partnerUser = await User.findById(contract.fleetOwnerId).select('fullName companyName')
        const partnerName = partnerUser?.companyName || partnerUser?.fullName || 'Fleet Partner'

        const changeLabel = driverId ? 'assigned a new driver' : 'updated fuel card'
        const detailLabel = driverId ? `Driver: ${driverName}` : `Fuel Card: ${fuelCardNumber}`
        const notifMetadata = {
            contractId: contract._id,
            contractNumber: contract.contractNumber,
            assignedVehicleId,
            vehicleName,
            changeType: driverId ? 'DRIVER_ASSIGNED' : 'FUEL_CARD_UPDATED',
            driverId: driverId || null,
            driverName: driverId ? driverName : null,
            fuelCardNumber: fuelCardNumber || null,
            performedByRole: actingRole,
        }

        if (actingRole === "B2B_PARTNER") {
            // Partner acted on behalf of the corporate under a managed contract.
            // Notify the corporate owner so they retain full visibility.
            const corpNotif = await createNotification({
                userId: corporateOwnerId,
                type: "ASSIGNMENT_UPDATED",
                title: "Vehicle Assignment Updated",
                message: `${partnerName} has ${changeLabel} for ${vehicleName} in contract ${contract.contractNumber}. ${detailLabel}`,
                metadata: notifMetadata,
            })
            sendRealTimeNotification(corporateOwnerId.toString(), corpNotif)
        } else {
            // Corporate performed the action directly. Notify the B2B partner.
            const b2bNotif = await createNotification({
                userId: contract.fleetOwnerId,
                type: "ASSIGNMENT_UPDATED",
                title: "Vehicle Assignment Updated",
                message: `${corporateName} has ${changeLabel} for ${vehicleName} in contract ${contract.contractNumber}. ${detailLabel}`,
                metadata: notifMetadata,
            })
            sendRealTimeNotification(contract.fleetOwnerId.toString(), b2bNotif)
        }

        // Notify admin about assignment change
        const actorName = actingRole === "B2B_PARTNER" ? partnerName : corporateName
        await sendAdminNotification(
            "Vehicle Assignment Changed",
            `${actorName} ${driverId ? 'assigned new driver' : 'updated fuel card'} for ${vehicleName} in contract ${contract.contractNumber}`,
            "ASSIGNMENT_UPDATED",
            {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                corporateId: corporateOwnerId,
                b2bPartnerId: contract.fleetOwnerId,
                performedByRole: actingRole,
            }
        )

        // Record on the managed contract activity log (who did what on behalf of corporate)
        await logRequestActivity(req, {
            contractId: contract._id,
            action: driverId ? "DRIVER_ASSIGNED" : "FUEL_ASSIGNED",
            entityType: "VEHICLE",
            entityId: assignedVehicleId,
            description: driverId
                ? `Assigned driver ${driverName} to ${vehicleName}`
                : `Updated fuel card for ${vehicleName}`,
            meta: { vehicleName, driverId: driverId || null, fuelCardNumber: fuelCardNumber || null },
        })

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

// @desc    Assign route to a vehicle with trip schedules
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
            routeEndDate,
            startTime,
            endTime,
            stopPoints,
            totalDistance,
            estimatedDuration,
            availableDays,
            routeNotes,
            tripTimes, // New: Array of trip times with stop points
            // Managed-service auto-link: when a B2B partner creates this route on
            // behalf of the corporate to fulfil a specific brief route request,
            // the frontend passes that brief item's id here.
            briefItemId,
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

        // Format trip times for Route model (handles both One Way and Round Trip)
        const formattedTripTimesForRoute = (tripTimes || []).map((trip, index) => {
            const isRoundTrip = trip.tripType === "Round Trip";
            return {
                tripNumber: index + 1,
                tripType: trip.tripType || "One Way",
                // For One Way: use departureTime, For Round Trip: use pickupStartTime as departureTime
                departureTime: isRoundTrip ? (trip.pickupStartTime || '') : (trip.departureTime || ''),
                pickupStartTime: trip.pickupStartTime || null,
                pickupEndTime: trip.pickupEndTime || null,
                returnStartTime: trip.returnStartTime || null,
                returnEndTime: trip.returnEndTime || null,
                outboundStopPoints: (trip.outboundStopPoints || []).filter(stop => stop.location && stop.location.trim() !== ''),
                returnStopPoints: (trip.returnStopPoints || []).filter(stop => stop.location && stop.location.trim() !== '')
            };
        });

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
            // Store trip times with all time fields (supports both one-way and round-trip)
            tripTimes: formattedTripTimesForRoute,
            assignedBy: corporateOwnerId,
            totalSeats: seatingCapacity,
            availableSeats: seatingCapacity,
            routeType: "CORPORATE",
            corporateId: corporateOwnerId,
        })

        await route.save()

        // Create CorporateRouteSchedule with trip times (similar to B2C Partner)
        let routeSchedule = null
        if (tripTimes && tripTimes.length > 0) {
            // Format trip times with properly validated stop points
            const formattedTripTimes = tripTimes.map((trip, index) => {
                // Filter out empty stop points
                const validOutboundStops = (trip.outboundStopPoints || [])
                    .filter(stop => stop.location && stop.location.trim() !== '')
                    .map(stop => ({
                        location: stop.location.trim(),
                        time: stop.time || ''
                    }));

                const validReturnStops = (trip.returnStopPoints || [])
                    .filter(stop => stop.location && stop.location.trim() !== '')
                    .map(stop => ({
                        location: stop.location.trim(),
                        time: stop.time || ''
                    }));

                // Handle both One Way and Round Trip scenarios
                // For Round Trip: use pickupStartTime as departureTime if departureTime is not set
                const isRoundTrip = trip.tripType === "Round Trip";
                const effectiveDepartureTime = isRoundTrip
                    ? (trip.pickupStartTime || trip.departureTime || '')
                    : (trip.departureTime || '');

                return {
                    tripNumber: index + 1,
                    // For One Way: use departureTime directly
                    // For Round Trip: use pickupStartTime as departureTime
                    departureTime: effectiveDepartureTime,
                    arrivalTime: isRoundTrip ? (trip.pickupEndTime || trip.arrivalTime || null) : (trip.arrivalTime || null),
                    // Round Trip specific times
                    pickupStartTime: trip.pickupStartTime || null,
                    pickupEndTime: trip.pickupEndTime || null,
                    returnStartTime: trip.returnStartTime || null,
                    returnEndTime: trip.returnEndTime || null,
                    // Legacy field mapping for backward compatibility
                    returnDepartureTime: trip.returnStartTime || trip.returnTime || null,
                    returnArrivalTime: trip.returnEndTime || trip.returnArrivalTime || null,
                    tripType: trip.tripType || "One Way",
                    outboundStopPoints: validOutboundStops,
                    returnStopPoints: validReturnStops
                };
            });

            routeSchedule = new CorporateRouteSchedule({
                corporateId: corporateOwnerId,
                routeId: route._id,
                contractId: contractId,
                scheduleName: `${fromLocation} to ${toLocation} Schedule`,
                tripTimes: formattedTripTimes,
                availableDays: availableDays,
                assignedVehicleId: assignedVehicleId,
                assignedVehicle: vehicleDetails?._id || null,
                assignedDriver: assignedVehicleData.driverId || null,
                startDate: routeStartDate ? new Date(routeStartDate) : new Date(),
                endDate: routeEndDate ? new Date(routeEndDate) : null,
                totalSeats: seatingCapacity,
                isActive: true,
                status: "Active"
            });

            await routeSchedule.save();
            console.log("[v0] Created CorporateRouteSchedule:", routeSchedule._id);
        }

        let updated = false
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find((v) => v._id.toString() === assignedVehicleId)

            if (assignedVehicle) {
                // Changed: Push to array instead of replacing single value
                // This allows multiple routes per vehicle
                if (!assignedVehicle.routeDetails || !Array.isArray(assignedVehicle.routeDetails)) {
                    assignedVehicle.routeDetails = []
                }
                assignedVehicle.routeDetails.push(route._id)
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
                    "fromLocation toLocation routeStartDate startTime endTime stopPoints totalDistance estimatedDuration routeNotes totalSeats availableSeats status tripTimes availableDays",
            },
        ])

        // Record route + schedule creation on the managed contract activity log
        await logRequestActivity(req, {
            contractId,
            action: "ROUTE_CREATED",
            entityType: "ROUTE",
            entityId: route._id,
            description: `Created route ${fromLocation} → ${toLocation}${routeSchedule ? " with schedule" : ""}`,
            meta: {
                fromLocation,
                toLocation,
                assignedVehicleId,
                scheduleId: routeSchedule?._id || null,
                tripCount: (tripTimes || []).length,
            },
        })

        // Managed-service auto-link: if the partner indicated which brief route
        // request this route satisfies, mark that brief item FULFILLED and link
        // it to the created route (defensive — never breaks route creation).
        let briefAutoFulfilled = false
        if (briefItemId && req.onBehalfContractId) {
            briefAutoFulfilled = await autoFulfillBriefItem({
                contractId: req.onBehalfContractId,
                section: "routeRequests",
                briefItemId,
                entityId: route._id,
                entityType: "ROUTE",
                actorId: req.actorId || req.userId,
                actorRole: req.actingRole || "B2B_PARTNER",
            })
        }

        res.status(201).json({
            success: true,
            message: "Route assigned successfully",
            briefAutoFulfilled,
            data: {
                route: updatedRoute,
                routeSchedule: routeSchedule,
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

// @desc    Get all routes for a specific vehicle in a contract
// @route   GET /api/contracts/:contractId/vehicles/:assignedVehicleId/routes
// @access  Private (CORPORATE only)
export const getVehicleRoutes = async (req, res) => {
    try {
        const { contractId, assignedVehicleId } = req.params
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

        // Get all routes for this specific vehicle
        const routes = await Route.find({
            contractId,
            assignedVehicleId
        })
            .populate("assignedBy", "fullName")
            .sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            data: {
                routes,
                count: routes.length
            },
        })
    } catch (error) {
        console.error("[v0] Error fetching vehicle routes:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch vehicle routes",
            error: error.message,
        })
    }
}

// @desc    Delete a route from a vehicle
// @route   DELETE /api/contracts/:contractId/vehicles/:assignedVehicleId/routes/:routeId
// @access  Private (CORPORATE only)
export const deleteVehicleRoute = async (req, res) => {
    try {
        const { contractId, assignedVehicleId, routeId } = req.params
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

        // Find and verify the route exists
        const route = await Route.findOne({
            _id: routeId,
            contractId,
            assignedVehicleId,
        })

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            })
        }

        // Remove route reference from the contract's assigned vehicle
        let updated = false
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find(
                (v) => v._id.toString() === assignedVehicleId
            )

            if (assignedVehicle && assignedVehicle.routeDetails) {
                // Remove the route from the array
                assignedVehicle.routeDetails = assignedVehicle.routeDetails.filter(
                    (r) => r.toString() !== routeId
                )
                updated = true
                break
            }
        }

        if (updated) {
            contract.markModified("vehicles")
            await contract.save()
        }

        // Delete associated CorporateRouteSchedule
        await CorporateRouteSchedule.deleteMany({ routeId })

        // Delete the route
        await Route.findByIdAndDelete(routeId)

        res.status(200).json({
            success: true,
            message: "Route deleted successfully",
        })
    } catch (error) {
        console.error("[v0] Error deleting route:", error)
        res.status(500).json({
            success: false,
            message: "Failed to delete route",
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

// @desc    Corporate requests due date extension for final payment
// @desc    Get managed-service contract operations activity log
// @route   GET /api/contracts/:contractId/managed-activity
// @access  Private (CORPORATE owner or B2B managing partner)
export const getManagedContractActivity = async (req, res) => {
    try {
        const { contractId } = req.params
        const userId = req.userId

        const contract = await Contract.findById(contractId)
            .select("corporateOwnerId fleetOwnerId serviceMode managedOperations financials contractNumber")
            .populate({
                path: "managedOperations.activityLog.performedBy",
                select: "fullName companyName",
            })

        if (!contract) {
            return res.status(404).json({ success: false, message: "Contract not found" })
        }

        const isCorporate = contract.corporateOwnerId.toString() === userId
        const isPartner = contract.fleetOwnerId.toString() === userId
        if (!isCorporate && !isPartner) {
            return res.status(403).json({ success: false, message: "Access denied" })
        }

        const activityLog = [...(contract.managedOperations?.activityLog || [])].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        )

        res.status(200).json({
            success: true,
            data: {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                serviceMode: contract.serviceMode,
                serviceCharge: contract.financials?.serviceCharge || 0,
                currency: contract.financials?.currency,
                activityLog,
            },
        })
    } catch (error) {
        console.error("[v0] Error fetching managed activity:", error)
        res.status(500).json({ success: false, message: "Failed to fetch managed activity", error: error.message })
    }
}

// @desc    Corporate requests due date extension for final payment
// @route   POST /api/contracts/:contractId/request-due-date-extension
// @access  Private (CORPORATE only)
export const requestDueDateExtension = async (req, res) => {
    try {
        const { contractId } = req.params
        const corporateOwnerId = req.userId
        const { newProposedDate, reason } = req.body

        if (!newProposedDate || !reason) {
            return res.status(400).json({
                success: false,
                message: "New proposed date and reason are required",
            })
        }

        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
            status: "ACTIVE",
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Active contract not found or you don't have access",
            })
        }

        // Check if there's already a pending request
        if (contract.dueDateExtensionRequest?.isRequested &&
            contract.dueDateExtensionRequest?.status === "PENDING") {
            return res.status(400).json({
                success: false,
                message: "There's already a pending due date extension request",
            })
        }

        // Validate new date is after current due date
        const currentDueDate = contract.financials?.finalPayment?.dueDate
        if (currentDueDate && new Date(newProposedDate) <= new Date(currentDueDate)) {
            return res.status(400).json({
                success: false,
                message: "New proposed date must be after the current due date",
            })
        }

        // Initialize history array if not exists
        const historyEntry = {
            action: "REQUESTED",
            date: new Date(),
            by: corporateOwnerId,
            notes: reason,
            proposedDate: new Date(newProposedDate),
        }

        contract.dueDateExtensionRequest = {
            isRequested: true,
            requestedBy: corporateOwnerId,
            requestedDate: new Date(),
            newProposedDate: new Date(newProposedDate),
            reason,
            status: "PENDING",
            history: contract.dueDateExtensionRequest?.history
                ? [...contract.dueDateExtensionRequest.history, historyEntry]
                : [historyEntry],
        }

        contract.markModified("dueDateExtensionRequest")
        await contract.save()

        await contract.populate([
            { path: "corporateOwnerId", select: "fullName email companyName" },
            { path: "fleetOwnerId", select: "fullName email companyName" },
        ])

        res.status(200).json({
            success: true,
            message: "Due date extension request submitted successfully",
            data: { contract },
        })
    } catch (error) {
        console.error("Error requesting due date extension:", error)
        res.status(500).json({
            success: false,
            message: "Failed to submit due date extension request",
            error: error.message,
        })
    }
}

// @desc    B2B Partner responds to due date extension request
// @route   POST /api/contracts/:contractId/respond-due-date-extension
// @access  Private (B2B_PARTNER only)
export const respondToDueDateExtension = async (req, res) => {
    try {
        const { contractId } = req.params
        const fleetOwnerId = req.userId
        const { action, responseNotes, counterOfferedDate } = req.body

        if (!action || !["APPROVED", "REJECTED", "COUNTER_OFFERED"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Valid action is required: APPROVED, REJECTED, or COUNTER_OFFERED",
            })
        }

        if (action === "COUNTER_OFFERED" && !counterOfferedDate) {
            return res.status(400).json({
                success: false,
                message: "Counter offered date is required when counter offering",
            })
        }

        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId,
            status: "ACTIVE",
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Active contract not found or you don't have access",
            })
        }

        if (!contract.dueDateExtensionRequest?.isRequested ||
            contract.dueDateExtensionRequest?.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: "No pending due date extension request found",
            })
        }

        const historyEntry = {
            action,
            date: new Date(),
            by: fleetOwnerId,
            notes: responseNotes || "",
            proposedDate: action === "COUNTER_OFFERED"
                ? new Date(counterOfferedDate)
                : contract.dueDateExtensionRequest.newProposedDate,
        }

        contract.dueDateExtensionRequest.status = action
        contract.dueDateExtensionRequest.respondedBy = fleetOwnerId
        contract.dueDateExtensionRequest.respondedDate = new Date()
        contract.dueDateExtensionRequest.responseNotes = responseNotes || ""

        if (action === "COUNTER_OFFERED") {
            contract.dueDateExtensionRequest.counterOfferedDate = new Date(counterOfferedDate)
        }

        contract.dueDateExtensionRequest.history.push(historyEntry)

        // If approved, update the actual final payment due date
        if (action === "APPROVED") {
            const newDueDate = contract.dueDateExtensionRequest.newProposedDate
            contract.financials.finalPayment.dueDate = newDueDate
            contract.dueDateExtensionRequest.isRequested = false

            // Also update PaymentSchedule table
            const PaymentSchedule = (await import("../models/PaymentSchedule.js")).default;
            await PaymentSchedule.updateMany(
                { contractId: contract._id, scheduleType: "FINAL" },
                { $set: { dueDate: newDueDate } }
            );
            console.log("[v0] Updated PaymentSchedule dueDate for contract:", contract._id);
        } else if (action === "COUNTER_OFFERED") {
            // Update to counter offered date
            const newDueDate = new Date(counterOfferedDate)
            contract.financials.finalPayment.dueDate = newDueDate
            contract.dueDateExtensionRequest.isRequested = false

            // Also update PaymentSchedule table
            const PaymentSchedule = (await import("../models/PaymentSchedule.js")).default;
            await PaymentSchedule.updateMany(
                { contractId: contract._id, scheduleType: "FINAL" },
                { $set: { dueDate: newDueDate } }
            );
            console.log("[v0] Updated PaymentSchedule dueDate (counter) for contract:", contract._id);
        } else {
            // Rejected - don't change due date
            contract.dueDateExtensionRequest.isRequested = false
        }

        contract.markModified("dueDateExtensionRequest")
        contract.markModified("financials")
        await contract.save()

        await contract.populate([
            { path: "corporateOwnerId", select: "fullName email companyName" },
            { path: "fleetOwnerId", select: "fullName email companyName" },
        ])

        res.status(200).json({
            success: true,
            message: `Due date extension request ${action.toLowerCase()} successfully`,
            data: { contract },
        })
    } catch (error) {
        console.error("Error responding to due date extension:", error)
        res.status(500).json({
            success: false,
            message: "Failed to respond to due date extension request",
            error: error.message,
        })
    }
}

// @desc    Update/Change driver assigned by Corporate on contract vehicle
// @route   PUT /api/contracts/update-corporate-driver/:contractId/:assignedVehicleId
// @access  Private (CORPORATE only)
export const updateCorporateDriver = async (req, res) => {
    try {
        const corporateId = req.userId
        const { contractId, assignedVehicleId } = req.params
        const { newDriverId } = req.body

        if (!newDriverId) {
            return res.status(400).json({
                success: false,
                message: "New driver ID is required"
            })
        }

        // Verify contract belongs to corporate
        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId: corporateId
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or access denied"
            })
        }

        // Verify new driver belongs to corporate
        const CorporateDriver = (await import("../models/CorporateDriver.js")).default
        const newDriver = await CorporateDriver.findOne({
            _id: newDriverId,
            corporateOwnerId: corporateId
        })

        if (!newDriver) {
            return res.status(404).json({
                success: false,
                message: "New driver not found or doesn't belong to your organization"
            })
        }

        // Find the assigned vehicle and verify driver was assigned by CORPORATE
        let oldDriverId = null
        let foundVehicle = false
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find(
                v => v._id.toString() === assignedVehicleId
            )
            if (assignedVehicle) {
                if (assignedVehicle.driverAssignedBy !== "CORPORATE") {
                    return res.status(400).json({
                        success: false,
                        message: "You can only change drivers that were assigned by your organization"
                    })
                }
                oldDriverId = assignedVehicle.driverId
                assignedVehicle.driverId = newDriverId
                assignedVehicle.driverModel = "CorporateDriver"
                foundVehicle = true
                break
            }
        }

        if (!foundVehicle) {
            return res.status(404).json({
                success: false,
                message: "Assigned vehicle not found"
            })
        }

        contract.markModified("vehicles")
        await contract.save()

        // Update CorporateRouteSchedule - change assigned driver
        const CorporateRouteSchedule = (await import("../models/CorporateRouteSchedule.js")).default
        const scheduleUpdateResult = await CorporateRouteSchedule.updateMany(
            {
                contractId: contractId,
                assignedVehicleId: assignedVehicleId,
                assignedDriver: oldDriverId
            },
            { $set: { assignedDriver: newDriverId } }
        )

        // Update Trips - change driver on scheduled trips
        const Trip = (await import("../models/Trip.js")).default
        const tripUpdateResult = await Trip.updateMany(
            {
                contractId: contractId,
                driverId: oldDriverId,
                status: { $in: ['SCHEDULED', 'PENDING'] }
            },
            { $set: { driverId: newDriverId } }
        )

        // Update driver statuses
        // Set old driver back to available
        if (oldDriverId) {
            await CorporateDriver.findByIdAndUpdate(oldDriverId, {
                status: "AVAILABLE"
            })
        }

        // Set new driver to assigned
        await CorporateDriver.findByIdAndUpdate(newDriverId, {
            status: "ASSIGNED"
        })

        res.status(200).json({
            success: true,
            message: "Driver updated successfully across all records",
            data: {
                schedulesUpdated: scheduleUpdateResult.modifiedCount,
                tripsUpdated: tripUpdateResult.modifiedCount
            }
        })
    } catch (error) {
        console.error("Error updating corporate driver:", error)
        res.status(500).json({
            success: false,
            message: "Failed to update driver",
            error: error.message
        })
    }
}

// @desc    Get contracts with pending due date extension requests for B2B Partner
// @route   GET /api/contracts/fleet/due-date-requests
// @access  Private (B2B_PARTNER only)
export const getDueDateExtensionRequests = async (req, res) => {
    try {
        const fleetOwnerId = req.userId

        const contracts = await Contract.find({
            fleetOwnerId,
            status: "ACTIVE",
            "dueDateExtensionRequest.isRequested": true,
            "dueDateExtensionRequest.status": "PENDING",
        })
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("quotationId", "quotationNumber")
            .sort({ "dueDateExtensionRequest.requestedDate": -1 })

        res.status(200).json({
            success: true,
            data: {
                requests: contracts,
                count: contracts.length
            },
        })
    } catch (error) {
        console.error("Error fetching due date extension requests:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch due date extension requests",
            error: error.message,
        })
    }
}

// @desc    Sync negotiation commission to existing contract from quotation
// @route   POST /api/contracts/:contractId/sync-negotiation-commission
// @access  Private (CORPORATE or B2B_PARTNER)
export const syncNegotiationCommission = async (req, res) => {
    try {
        const { contractId } = req.params
        const userId = req.userId

        const contract = await Contract.findById(contractId).populate("quotationId")

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Check if user has access to this contract
        if (contract.corporateOwnerId.toString() !== userId &&
            contract.fleetOwnerId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this contract",
            })
        }

        // Check if contract already has negotiationCommission
        if (contract.negotiationCommission && contract.negotiationCommission.adminCommission > 0) {
            return res.status(200).json({
                success: true,
                message: "Contract already has negotiation commission",
                data: { contract },
            })
        }

        const quotation = contract.quotationId

        if (!quotation) {
            return res.status(400).json({
                success: false,
                message: "Quotation not found for this contract",
            })
        }

        // Check if quotation has completed negotiation - check multiple conditions
        const hasNegotiationId = quotation.adminNegotiation?.negotiationId
        const hasCompletedStatus = quotation.adminNegotiation?.status === "COMPLETED"
        const hasAdminCommission = quotation.adminNegotiation?.adminCommission > 0

        console.log("[v0] syncNegotiationCommission - hasNegotiationId:", hasNegotiationId,
            "hasCompletedStatus:", hasCompletedStatus,
            "hasAdminCommission:", hasAdminCommission)

        if (!hasNegotiationId && !(hasCompletedStatus && hasAdminCommission)) {
            return res.status(400).json({
                success: false,
                message: "No completed negotiation found for this quotation",
            })
        }

        // Find the negotiation if ID exists
        let negotiation = null
        if (hasNegotiationId) {
            negotiation = await AdminNegotiation.findById(quotation.adminNegotiation.negotiationId)
            console.log("[v0] syncNegotiationCommission - Found negotiation:", negotiation ? negotiation._id : "NOT FOUND")
        }

        // If negotiation not found or not completed, use quotation data as fallback
        if (!negotiation || negotiation.status !== "COMPLETED") {
            if (!(hasCompletedStatus && hasAdminCommission)) {
                return res.status(400).json({
                    success: false,
                    message: "Negotiation not found or not completed",
                })
            }
            console.log("[v0] syncNegotiationCommission - Using quotation.adminNegotiation data as fallback")
        }

        // Create negotiationCommission object - prefer negotiation data, fallback to quotation
        const negotiationCommission = {
            negotiationId: negotiation?._id || quotation.adminNegotiation?.negotiationId || null,
            adminCommission: negotiation?.adminCommissionFromCorporate?.amount || quotation.adminNegotiation?.adminCommission || 0,
            adminCommissionRate: negotiation?.adminCommissionFromCorporate?.rate || quotation.adminNegotiation?.adminCommissionRate || 25,
            commissionStatus: negotiation?.adminCommissionFromCorporate?.status || "PENDING",
            priceSavings: negotiation?.priceSaved || quotation.adminNegotiation?.savingsAmount || 0,
            originalPrice: negotiation?.originalPrice || quotation.adminNegotiation?.originalPrice || 0,
        }

        console.log("[v0] syncNegotiationCommission - Created:", JSON.stringify(negotiationCommission))

        // Update the contract
        contract.negotiationCommission = negotiationCommission
        await contract.save()

        // Re-populate the contract
        await contract.populate([
            { path: "corporateOwnerId", select: "fullName email companyName" },
            { path: "fleetOwnerId", select: "fullName email companyName" },
            { path: "quotationId" },
        ])

        console.log("[v0] Synced negotiation commission to contract:", contract.contractNumber, negotiationCommission)

        res.status(200).json({
            success: true,
            message: "Negotiation commission synced successfully",
            data: { contract, negotiationCommission },
        })
    } catch (error) {
        console.error("[v0] Error syncing negotiation commission:", error)
        res.status(500).json({
            success: false,
            message: "Failed to sync negotiation commission",
            error: error.message,
        })
    }
}

// @desc    Corporate uploads signed contract document
// @route   POST /api/contracts/:contractId/upload-signed-document
// @access  Private (CORPORATE only)
export const uploadSignedContractDocument = async (req, res) => {
    try {
        const { contractId } = req.params
        const corporateOwnerId = req.userId

        console.log("[v0] Upload signed contract document request received")
        console.log("[v0] Contract ID:", contractId)
        console.log("[v0] Corporate Owner ID:", corporateOwnerId)
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
                message: "Only PDF files are allowed for signed contract documents.",
            })
        }

        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or you don't have access to this contract",
            })
        }

        // Check if contract is in correct status
        if (!["PENDING_CORPORATE_SIGNATURE", "PENDING_SIGNED_DOCUMENT_UPLOAD"].includes(contract.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot upload signed document in current status: ${contract.status}. Contract must be pending corporate signature.`,
            })
        }

        // Check if original contract document exists
        if (!contract.contractDocument?.url) {
            return res.status(400).json({
                success: false,
                message: "Original contract document not found. B2B Partner must upload contract first.",
            })
        }

        console.log("[v0] Uploading signed PDF to Cloudinary...")
        const uploadResult = await uploadToCloudinary(req.file, "driveme/contracts/signed")

        console.log("[v0] Cloudinary upload successful:", uploadResult.secure_url)

        contract.signedContractDocument = {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            uploadedAt: new Date(),
            uploadedBy: corporateOwnerId,
            fileName: req.file.originalname,
            fileSize: req.file.size,
        }

        // Update digital signature status
        contract.digitalSignatures.corporateOwner = {
            signed: true,
            signedAt: new Date(),
            signature: "Document Signed Externally",
            ipAddress: req.ip || "Unknown",
        }

        contract.status = "PENDING_B2B_VERIFICATION"
        contract.statusHistory.push({
            status: "PENDING_B2B_VERIFICATION",
            changedBy: corporateOwnerId,
            reason: "Corporate uploaded signed contract document for B2B verification",
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

        // Get names for notifications
        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || 'Fleet Owner';

        // Notify B2B_PARTNER about signed document upload
        await createNotification({
            userId: contract.fleetOwnerId._id,
            type: "SIGNED_DOCUMENT_UPLOADED",
            title: "Signed Contract Uploaded",
            message: `${corporateName} has uploaded the signed contract document. Please review and verify.`,
            data: { contractId: contract._id, signedDocumentUrl: uploadResult.secure_url }
        });

        // Notify ADMIN
        await sendAdminNotification(
            "Signed Contract Document Uploaded",
            `${corporateName} (CORPORATE) uploaded signed contract document for ${fleetName} (B2B_PARTNER). Pending verification.`,
            "SIGNED_DOCUMENT_UPLOADED",
            { contractId: contract._id, corporateId: corporateOwnerId, fleetOwnerId: contract.fleetOwnerId._id }
        );

        res.status(200).json({
            success: true,
            message: "Signed contract document uploaded successfully. Waiting for B2B Partner verification.",
            data: { contract },
        })
    } catch (error) {
        console.error("[v0] Error uploading signed contract document:", error)
        res.status(500).json({
            success: false,
            message: "Failed to upload signed contract document",
            error: error.message,
        })
    }
}

// @desc    B2B Partner verifies signed contract document
// @route   POST /api/contracts/:contractId/verify-signed-document
// @access  Private (B2B_PARTNER only)
export const verifySignedContractDocument = async (req, res) => {
    try {
        const { contractId } = req.params
        const fleetOwnerId = req.userId
        const { action, verificationNotes, rejectionReason } = req.body

        if (!action || !["APPROVE", "REJECT"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Invalid action. Must be 'APPROVE' or 'REJECT'.",
            })
        }

        if (action === "REJECT" && !rejectionReason) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required when rejecting signed document.",
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

        // Check if contract is in correct status
        if (contract.status !== "PENDING_B2B_VERIFICATION") {
            return res.status(400).json({
                success: false,
                message: `Cannot verify signed document in current status: ${contract.status}. Contract must be pending B2B verification.`,
            })
        }

        // Check if signed document exists
        if (!contract.signedContractDocument?.url) {
            return res.status(400).json({
                success: false,
                message: "Signed contract document not found. Corporate must upload signed document first.",
            })
        }

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

        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || 'Fleet Owner';

        if (action === "APPROVE") {
            contract.signedDocumentVerification = {
                isVerified: true,
                verifiedAt: new Date(),
                verifiedBy: fleetOwnerId,
                verificationNotes: verificationNotes || "Signed document verified successfully",
            }

            contract.status = "PENDING_FLEET_SIGNATURE"
            contract.statusHistory.push({
                status: "PENDING_FLEET_SIGNATURE",
                changedBy: fleetOwnerId,
                reason: verificationNotes || "B2B Partner verified signed contract document. Ready for B2B signature.",
            })

            // Notify CORPORATE that document is verified
            await createNotification({
                userId: contract.corporateOwnerId._id,
                type: "SIGNED_DOCUMENT_VERIFIED",
                title: "Signed Document Verified",
                message: `${fleetName} has verified your signed contract document. Waiting for their signature.`,
                data: { contractId: contract._id }
            });

            // Notify ADMIN
            await sendAdminNotification(
                "Signed Document Verified",
                `${fleetName} (B2B_PARTNER) verified signed contract from ${corporateName} (CORPORATE). Ready for B2B signature.`,
                "SIGNED_DOCUMENT_VERIFIED",
                { contractId: contract._id, fleetOwnerId, corporateId: contract.corporateOwnerId._id }
            );

        } else if (action === "REJECT") {
            contract.signedDocumentVerification = {
                isVerified: false,
                verifiedAt: new Date(),
                verifiedBy: fleetOwnerId,
                rejectionReason: rejectionReason,
            }

            contract.status = "PENDING_CORPORATE_SIGNATURE"
            contract.statusHistory.push({
                status: "PENDING_CORPORATE_SIGNATURE",
                changedBy: fleetOwnerId,
                reason: `Signed document rejected: ${rejectionReason}`,
            })

            // Clear the signed document so corporate can re-upload
            contract.signedContractDocument = undefined
            contract.digitalSignatures.corporateOwner = {
                signed: false,
                signedAt: null,
                signature: null,
                ipAddress: null,
            }

            // Notify CORPORATE that document is rejected
            await createNotification({
                userId: contract.corporateOwnerId._id,
                type: "SIGNED_DOCUMENT_REJECTED",
                title: "Signed Document Rejected",
                message: `${fleetName} has rejected your signed contract document. Reason: ${rejectionReason}. Please re-upload a correctly signed document.`,
                data: { contractId: contract._id, rejectionReason }
            });

            // Notify ADMIN
            await sendAdminNotification(
                "Signed Document Rejected",
                `${fleetName} (B2B_PARTNER) rejected signed contract from ${corporateName} (CORPORATE). Reason: ${rejectionReason}`,
                "SIGNED_DOCUMENT_REJECTED",
                { contractId: contract._id, fleetOwnerId, corporateId: contract.corporateOwnerId._id, rejectionReason }
            );
        }

        await contract.save()

        res.status(200).json({
            success: true,
            message: action === "APPROVE"
                ? "Signed document verified successfully. Please sign the contract to finalize."
                : "Signed document rejected. Corporate will be notified to re-upload.",
            data: { contract },
        })
    } catch (error) {
        console.error("[v0] Error verifying signed contract document:", error)
        res.status(500).json({
            success: false,
            message: "Failed to verify signed contract document",
            error: error.message,
        })
    }
}

// @desc    Download contract document
// @route   GET /api/contracts/:contractId/download-document
// @access  Private (CORPORATE or B2B_PARTNER)
export const downloadContractDocument = async (req, res) => {
    try {
        const { contractId } = req.params
        const { type } = req.query // 'original' or 'signed'
        const userId = req.userId

        const contract = await Contract.findById(contractId)

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found",
            })
        }

        // Check if user has access to this contract
        if (contract.corporateOwnerId.toString() !== userId &&
            contract.fleetOwnerId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this contract",
            })
        }

        let documentUrl, fileName

        if (type === "signed") {
            if (!contract.signedContractDocument?.url) {
                return res.status(404).json({
                    success: false,
                    message: "Signed contract document not found",
                })
            }
            documentUrl = contract.signedContractDocument.url
            fileName = contract.signedContractDocument.fileName || `signed_contract_${contract.contractNumber}.pdf`
        } else {
            if (!contract.contractDocument?.url) {
                return res.status(404).json({
                    success: false,
                    message: "Contract document not found",
                })
            }
            documentUrl = contract.contractDocument.url
            fileName = contract.contractDocument.fileName || `contract_${contract.contractNumber}.pdf`
        }

        res.status(200).json({
            success: true,
            data: {
                documentUrl,
                fileName,
                contractNumber: contract.contractNumber,
            },
        })
    } catch (error) {
        console.error("[v0] Error downloading contract document:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get contract document",
            error: error.message,
        })
    }
}
