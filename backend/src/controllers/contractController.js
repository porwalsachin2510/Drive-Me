import Contract from "../models/Contract.js"
import Quotation from "../models/Quotation.js"
import AdminNegotiation from "../models/AdminNegotiation.js"
import Route from "../models/Route.js"
import CorporateRouteSchedule from "../models/CorporateRouteSchedule.js"
import Driver from "../models/Driver.js"
import { uploadToCloudinary } from "../Config/Cloudinary.js"
import { createNotification, sendAdminNotification, sendRealTimeNotification } from "../Services/notificationService.js"
import { syncInvoicesForContract } from "../Services/invoiceService.js"
import User from "../models/User.js"
import ManagedServiceBrief from "../models/ManagedServiceBrief.js"
import { logRequestActivity } from "../utils/operationContext.js"
import { autoFulfillBriefItem } from "./managedServiceBriefController.js"
import { isCustomerRole, isPartnerRole, sameSegment, segmentTag, partnerRoleLabel, customerRoleLabel, partnerNoun, customerNoun } from "../utils/roleFamilies.js"

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
            .populate("fleetOwnerId", "fullName email companyName role userType phone whatsappNumber companyAddress nationality")
            .populate("vehicles.vehicleId")

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Accepted quotation not found",
            })
        }

        const customer = await User.findById(quotation.corporateOwnerId).select("role")
        const partner = await User.findById(quotation.fleetOwnerId?._id || quotation.fleetOwnerId).select("role")
        if (!customer || !isCustomerRole(customer.role) || !partner || !isPartnerRole(partner.role) || !sameSegment(customer.role, partner.role)) {
            return res.status(422).json({
                success: false,
                message: "The quotation participants do not belong to a valid matching business segment",
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
            // Use the quantity the partner actually OFFERED in their quote
            // (per-vehicle breakdown), which for a PARTIAL offer is fewer than
            // the corporate originally requested. Falls back to the requested
            // quantity for legacy quotations without a breakdown.
            vehicles: quotation.vehicles.map((v) => {
                const vid = String(v.vehicleId._id || v.vehicleId)
                const offered = (quotation.quotedPrice?.perVehicleBreakdown || []).find(
                    (b) => String(b.vehicleId) === vid,
                )
                const offeredQty = Number(offered?.quantity)
                return {
                    vehicleId: v.vehicleId._id,
                    quantity: offeredQty > 0 ? offeredQty : v.quantity,
                    assignedVehicles: [],
                }
            }),
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
                select: "fullName email companyName role userType",
            },
            {
                path: "fleetOwnerId",
                select: "fullName email companyName role userType",
            },
            {
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber",
            },
        ])

        // Get names for notifications
        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || 'Fleet Owner';

        // Segment-aware wording so school users don't see corporate/B2B copy.
        const customerRole = contract.corporateOwnerId?.role
        const partnerRole = contract.fleetOwnerId?.role

        // Notify partner (B2B_PARTNER / SCHOOL_PARTNER) about new contract
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
            `${corporateName} (${segmentTag(customerRole)}) created contract with ${fleetName} (${segmentTag(partnerRole)}). Total: ${totalAmount} ${contractCurrency}`,
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
                select: "fullName email companyName role userType",
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
                select: "fullName email companyName role userType",
            })
            .populate({
                path: "fleetOwnerId",
                select: "fullName email companyName role userType",
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
                select: "fullName email companyName whatsappNumber role userType",
            })
            .populate({
                path: "fleetOwnerId",
                select: "fullName email companyName whatsappNumber acceptedPaymentMethods role userType",
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
                select: "fullName email companyName role userType",
            },
            {
                path: "fleetOwnerId",
                select: "fullName email companyName role userType",
            },
        ])

        // Get names for notifications
        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || 'Fleet Owner';
        const customerRole = contract.corporateOwnerId?.role
        const partnerRole = contract.fleetOwnerId?.role

        // Notify customer (CORPORATE / SCHOOL_CUSTOMER) about document upload
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
            `${fleetName} (${segmentTag(partnerRole)}) uploaded contract document for ${corporateName} (${segmentTag(customerRole)}). Contract #${contract._id}`,
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
            .populate("corporateOwnerId", "fullName email companyName whatsappNumber role userType")
            .populate("fleetOwnerId", "fullName email companyName whatsappNumber role userType")
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
            isCustomerRole(userRole) &&
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
            isPartnerRole(userRole) &&
            contract.fleetOwnerId._id.toString() === userId
        ) {
            if (!contract.digitalSignatures.corporateOwner?.signed) {
                return res.status(400).json({
                    success: false,
                    message: `${customerRoleLabel(contract.corporateOwnerId?.role)} must sign first`,
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

        // Segment-aware wording so school users don't see corporate/B2B copy.
        const customerRole = contract.corporateOwnerId?.role
        const partnerRole = contract.fleetOwnerId?.role
        const customerLabel = customerRoleLabel(customerRole)
        const partnerLabel = partnerRoleLabel(partnerRole)

        // Send notifications based on who signed
        if (isCustomerRole(userRole)) {
            // Notify partner (B2B_PARTNER / SCHOOL_PARTNER) that customer signed
            await createNotification({
                userId: contract.fleetOwnerId._id,
                type: "CONTRACT_SIGNED",
                title: `Contract Signed by ${customerLabel}`,
                message: `${corporateName} has signed the contract. Please review and sign to finalize.`,
                data: { contractId: contract._id }
            });

            // Notify ADMIN
            await sendAdminNotification(
                `Contract Signed by ${customerLabel}`,
                `${corporateName} (${segmentTag(customerRole)}) signed contract with ${fleetName} (${segmentTag(partnerRole)}). Awaiting ${partnerLabel} signature.`,
                "CONTRACT_SIGNED",
                { contractId: contract._id, signedBy: customerRole, corporateId: contract.corporateOwnerId._id, fleetOwnerId: contract.fleetOwnerId._id }
            );
        } else if (isPartnerRole(userRole)) {
            // Notify customer (CORPORATE / SCHOOL_CUSTOMER) that partner signed - contract is now ready for payment
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
                `${fleetName} (${segmentTag(partnerRole)}) signed contract. Contract between ${corporateName} and ${fleetName} is now fully signed. Awaiting payment.`,
                "CONTRACT_FULLY_SIGNED",
                { contractId: contract._id, signedBy: partnerRole, corporateId: contract.corporateOwnerId._id, fleetOwnerId: contract.fleetOwnerId._id }
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
                select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality",
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
                select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality",
            },
            {
                path: "fleetOwnerId",
                select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality",
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
            { path: "corporateOwnerId", select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality" },
            { path: "fleetOwnerId", select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality" },
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
        if (isPartnerRole(userRole)) {
            query.fleetOwnerId = userId
        } else if (isCustomerRole(userRole)) {
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

        // ---- Driver de-duplication guard (real DB enforcement) ----
        // A single driver can only ever be assigned to ONE vehicle. We check for:
        //   1) duplicates inside the incoming payload, and
        //   2) drivers that are already assigned to another vehicle in this
        //      contract from an earlier save.
        // This mirrors the B2C route-assignment rule so the same driver can
        // never be double-booked, even across separate assignment submissions.
        const incomingDriverIds = vehicleAssignments
            .map((a) => a.driverId)
            .filter(Boolean)
            .map((d) => d.toString())

        // 1) Duplicate within the same submission.
        const duplicateInPayload = incomingDriverIds.find(
            (id, idx) => incomingDriverIds.indexOf(id) !== idx,
        )
        if (duplicateInPayload) {
            return res.status(400).json({
                success: false,
                message:
                    "The same driver cannot be assigned to more than one vehicle. Please pick a different driver for each vehicle.",
            })
        }

        // 2) Already assigned to another vehicle in this contract.
        const alreadyAssignedDriverIds = new Set()
        contract.vehicles.forEach((v) => {
            ; (v.assignedVehicles || []).forEach((av) => {
                const did = av.driverId?._id?.toString() || av.driverId?.toString()
                if (did) alreadyAssignedDriverIds.add(did)
            })
        })
        const conflictDriverId = incomingDriverIds.find((id) =>
            alreadyAssignedDriverIds.has(id),
        )
        if (conflictDriverId) {
            const conflictDriver = await Driver.findById(conflictDriverId).select("name")
            return res.status(400).json({
                success: false,
                message: `Driver ${conflictDriver?.name || ""} is already assigned to another vehicle in this contract. Please choose a different driver.`.trim(),
            })
        }

        // 3) Validate ownership + availability of every incoming driver.
        if (incomingDriverIds.length > 0) {
            const validDrivers = await Driver.find({
                _id: { $in: incomingDriverIds },
                fleetOwnerId: userId,
            }).select("_id status name")

            if (validDrivers.length !== incomingDriverIds.length) {
                return res.status(400).json({
                    success: false,
                    message: "One or more selected drivers were not found in your fleet.",
                })
            }

            const unavailable = validDrivers.find((d) => d.status === "INACTIVE")
            if (unavailable) {
                return res.status(400).json({
                    success: false,
                    message: `Driver ${unavailable.name} is inactive and cannot be assigned.`,
                })
            }
        }

        // ---- Over-assignment guard ----
        // Each incoming assignment object represents ONE physical vehicle
        // (one unit of the requested quantity). The number of already-assigned
        // vehicles plus the incoming ones for a given type must never exceed the
        // quantity the corporate requested.
        const incomingCountByType = {}
        vehicleAssignments.forEach((a) => {
            const key = a.vehicleId?.toString()
            if (!key) return
            incomingCountByType[key] = (incomingCountByType[key] || 0) + 1
        })
        for (const [vehicleTypeId, incomingCount] of Object.entries(incomingCountByType)) {
            const group = contract.vehicles.find(
                (v) => v.vehicleId._id.toString() === vehicleTypeId,
            )
            if (!group) continue
            const alreadyAssigned = group.assignedVehicles?.length || 0
            if (alreadyAssigned + incomingCount > group.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `You are trying to assign ${alreadyAssigned + incomingCount} vehicle(s) for ${group.vehicleId.vehicleName || "a vehicle"}, but only ${group.quantity} were requested.`,
                })
            }
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
                // Store the authenticated actor role exactly. The Contract
                // schema explicitly supports school and corporate segments.
                vehicleAssignment.driverAssignedBy = userRole

                vehicleAssignment.driverModel =
                    isCustomerRole(userRole) ? "CorporateDriver" : "Driver"
            }

            if (assignment.fuelCardNumber) {
                vehicleAssignment.fuelCardNumber = assignment.fuelCardNumber
                // Keep fuel assignment audit data consistent with driver data.
                vehicleAssignment.fuelAssignedBy = userRole
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
            reason: `Vehicles assigned to contract by ${isPartnerRole(userRole) ? partnerRoleLabel(userRole) : customerRoleLabel(userRole)}`,
        })

        await contract.save()

        // Mark the newly assigned drivers as ASSIGNED so they stop appearing in
        // the "available drivers" list and can't be double-booked elsewhere.
        if (incomingDriverIds.length > 0) {
            await Driver.updateMany(
                { _id: { $in: incomingDriverIds }, fleetOwnerId: userId },
                { $set: { status: "ASSIGNED" } },
            )
        }

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
            // Route reuse: when the user picks an already-created route to apply to
            // ANOTHER vehicle (instead of re-typing it), the frontend sends the id
            // of that existing route here. We then attach the SAME route to the
            // target vehicle rather than creating a duplicate Route document.
            reuseRouteId,
        } = req.body

        // availableDays is only required when creating a brand new route. When
        // reusing an existing route we already have its schedule, so skip it.
        if (!reuseRouteId && (!availableDays || !availableDays.length)) {
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

        // ---- REUSE PATH ----------------------------------------------------
        // Attach an existing route (already created on another vehicle in this
        // same contract) to this vehicle. We share the SAME Route document so
        // the two vehicles run an identical route — exactly the behaviour the
        // shared-route model already uses for brief imports.
        if (reuseRouteId) {
            const existingRoute = await Route.findOne({ _id: reuseRouteId, contractId })
            if (!existingRoute) {
                return res.status(404).json({
                    success: false,
                    message: "Selected route was not found on this contract",
                })
            }

            let reuseUpdated = false
            for (const vehicleGroup of contract.vehicles) {
                const assignedVehicle = vehicleGroup.assignedVehicles.find(
                    (v) => v._id.toString() === assignedVehicleId,
                )
                if (assignedVehicle) {
                    if (!Array.isArray(assignedVehicle.routeDetails)) {
                        assignedVehicle.routeDetails = []
                    }
                    // Guard against attaching the same route twice.
                    const already = assignedVehicle.routeDetails.some(
                        (rid) => String(rid) === String(existingRoute._id),
                    )
                    if (already) {
                        return res.status(400).json({
                            success: false,
                            message: "This route is already assigned to this vehicle",
                        })
                    }
                    assignedVehicle.routeDetails.push(existingRoute._id)
                    reuseUpdated = true
                    break
                }
            }

            if (!reuseUpdated) {
                return res.status(404).json({
                    success: false,
                    message: "Assigned vehicle not found",
                })
            }

            contract.markModified("vehicles")
            await contract.save()

            await logRequestActivity(req, {
                contractId,
                action: "ROUTE_CREATED",
                entityType: "ROUTE",
                entityId: existingRoute._id,
                description: `Reused route ${existingRoute.fromLocation} → ${existingRoute.toLocation} on another vehicle`,
                meta: { reuseRouteId: String(existingRoute._id), assignedVehicleId },
            })

            await contract.populate([
                { path: "vehicles.vehicleId", select: "vehicleName vehicleCategory registrationNumber photos" },
                { path: "vehicles.assignedVehicles.driverId", select: "name licenseNumber" },
                {
                    path: "vehicles.assignedVehicles.routeDetails",
                    select:
                        "fromLocation toLocation routeStartDate startTime endTime stopPoints totalDistance estimatedDuration routeNotes totalSeats availableSeats status tripTimes availableDays",
                },
            ])

            return res.status(200).json({
                success: true,
                message: "Route assigned to vehicle successfully",
                data: { route: existingRoute, contract },
            })
        }
        // ---- END REUSE PATH ------------------------------------------------

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

        // Managed-service auto-link: if the creator indicated which brief route
        // request this route satisfies, mark that brief item FULFILLED and link
        // it to the created route (defensive — never breaks route creation).
        // Applies to the partner acting on behalf AND to the customer working its
        // own brief, otherwise a customer-created route would leave the brief item
        // showing as outstanding forever.
        let briefAutoFulfilled = false
        if (briefItemId) {
            briefAutoFulfilled = await autoFulfillBriefItem({
                contractId: req.onBehalfContractId || contractId,
                section: "routeRequests",
                briefItemId,
                entityId: route._id,
                entityType: "ROUTE",
                actorId: req.actorId || req.userId,
                actorRole: req.actingRole || "CORPORATE",
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

// @desc    Bulk-create every PENDING route request from the managed-service
//          brief against a single assigned vehicle, and auto-fulfil each brief
//          route item. This is how a B2B partner turns an Excel-driven brief
//          (which may list hundreds/thousands of routes) into real operational
//          routes in one action, instead of adding them one by one.
// @route   POST /api/contracts/bulk-assign-routes/:contractId/:assignedVehicleId
// @access  Private (CORPORATE self-serve, or B2B_PARTNER on-behalf via context)
export const bulkCreateRoutesFromBrief = async (req, res) => {
    try {
        const { contractId, assignedVehicleId } = req.params
        const corporateOwnerId = req.userId
        // Optional: restrict to a specific subset of brief route item ids.
        const { briefItemIds } = req.body || {}

        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        }).populate({
            path: "vehicles.vehicleId",
            select: "capacity vehicleName registrationNumber",
        })

        if (!contract) {
            return res.status(404).json({ success: false, message: "Contract not found" })
        }

        // Locate the target assigned vehicle inside the contract.
        let assignedVehicleData = null
        let vehicleDetails = null
        let vehicleGroupRef = null
        for (const vehicleGroup of contract.vehicles) {
            const found = vehicleGroup.assignedVehicles.find(
                (v) => v._id.toString() === assignedVehicleId,
            )
            if (found) {
                assignedVehicleData = found
                vehicleDetails = vehicleGroup.vehicleId
                vehicleGroupRef = vehicleGroup
                break
            }
        }

        if (!assignedVehicleData) {
            return res.status(404).json({
                success: false,
                message: "Assigned vehicle not found in contract",
            })
        }

        // Load the brief so we know which routes to build.
        const brief = await ManagedServiceBrief.findOne({ contractId })
        if (!brief) {
            return res.status(404).json({
                success: false,
                message: "No managed-service brief exists for this contract.",
            })
        }

        const seatingCapacity = vehicleDetails?.capacity?.seatingCapacity || 0

        // Which brief route items to process: not-yet-fulfilled (or a requested
        // subset). Already fulfilled items are skipped so re-running is safe.
        const wanted = Array.isArray(briefItemIds) && briefItemIds.length > 0
            ? new Set(briefItemIds.map(String))
            : null
        const pendingRoutes = (brief.routeRequests || []).filter((r) => {
            if (wanted && !wanted.has(String(r._id))) return false
            return r.fulfillment?.status !== "FULFILLED"
        })

        if (pendingRoutes.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No pending route requests to create.",
                data: { created: 0, results: [] },
            })
        }

        const defaultStartDate = brief.serviceStartDate
            ? new Date(brief.serviceStartDate)
            : new Date()

        const results = []
        let createdCount = 0

        for (const rr of pendingRoutes) {
            try {
                const fromLocation = (rr.fromArea || rr.label || "Pickup").trim()
                const toLocation = (rr.toWorkLocation || "Work location").trim()
                const availableDays = (rr.operatingDays && rr.operatingDays.length)
                    ? rr.operatingDays
                    : ["MON", "TUE", "WED", "THU", "FRI"]

                // Map brief stops -> route stop points (objects with location/time).
                // Accept both plain stop names (older briefs) and {location,time}
                // objects (the current parser, which carries per-stop times).
                const stopPoints = (rr.stops || [])
                    .map((s) =>
                        typeof s === "string"
                            ? { location: s.trim(), time: "" }
                            : { location: String(s?.location || "").trim(), time: s?.time || "" },
                    )
                    .filter((s) => s.location)

                // A single one-way trip covering the brief's pickup window.
                const tripTimes = [
                    {
                        tripType: "One Way",
                        departureTime: rr.pickupWindowStart || "",
                        arrivalTime: rr.pickupWindowEnd || "",
                        outboundStopPoints: stopPoints,
                        returnStopPoints: [],
                    },
                ]

                const formattedTripTimesForRoute = tripTimes.map((trip, index) => ({
                    tripNumber: index + 1,
                    tripType: trip.tripType,
                    departureTime: trip.departureTime || "",
                    pickupStartTime: null,
                    pickupEndTime: null,
                    returnStartTime: null,
                    returnEndTime: null,
                    outboundStopPoints: trip.outboundStopPoints,
                    returnStopPoints: [],
                }))

                const route = new Route({
                    contractId,
                    assignedVehicleId,
                    vehicleId: vehicleDetails?._id || null,
                    fromLocation,
                    toLocation,
                    routeStartDate: defaultStartDate,
                    startTime: rr.pickupWindowStart || "",
                    endTime: rr.pickupWindowEnd || "",
                    stopPoints,
                    totalDistance: 0,
                    estimatedDuration: "",
                    availableDays,
                    routeNotes: rr.notes || "",
                    tripTimes: formattedTripTimesForRoute,
                    assignedBy: corporateOwnerId,
                    totalSeats: seatingCapacity,
                    availableSeats: seatingCapacity,
                    routeType: "CORPORATE",
                    corporateId: corporateOwnerId,
                })

                await route.save()

                const routeSchedule = new CorporateRouteSchedule({
                    corporateId: corporateOwnerId,
                    routeId: route._id,
                    contractId: contractId,
                    scheduleName: `${fromLocation} to ${toLocation} Schedule`,
                    tripTimes: formattedTripTimesForRoute.map((t) => ({
                        tripNumber: t.tripNumber,
                        departureTime: t.departureTime,
                        arrivalTime: rr.pickupWindowEnd || null,
                        pickupStartTime: null,
                        pickupEndTime: null,
                        returnStartTime: null,
                        returnEndTime: null,
                        tripType: t.tripType,
                        outboundStopPoints: t.outboundStopPoints,
                        returnStopPoints: [],
                    })),
                    availableDays,
                    assignedVehicleId: assignedVehicleId,
                    assignedVehicle: vehicleDetails?._id || null,
                    assignedDriver: assignedVehicleData.driverId || null,
                    startDate: defaultStartDate,
                    endDate: null,
                    totalSeats: seatingCapacity,
                    isActive: true,
                    status: "Active",
                })
                await routeSchedule.save()

                // Link the route onto the assigned vehicle.
                if (
                    !assignedVehicleData.routeDetails ||
                    !Array.isArray(assignedVehicleData.routeDetails)
                ) {
                    assignedVehicleData.routeDetails = []
                }
                assignedVehicleData.routeDetails.push(route._id)

                // Auto-fulfil the corresponding brief route item. Works for the
                // partner on-behalf context and for the customer's own contract.
                const briefAutoFulfilled = await autoFulfillBriefItem({
                    contractId: req.onBehalfContractId || contractId,
                    section: "routeRequests",
                    briefItemId: rr._id,
                    entityId: route._id,
                    entityType: "ROUTE",
                    actorId: req.actorId || req.userId,
                    actorRole: req.actingRole || "CORPORATE",
                })

                createdCount += 1
                results.push({
                    briefItemId: String(rr._id),
                    label: rr.label,
                    routeId: route._id,
                    scheduleId: routeSchedule._id,
                    briefAutoFulfilled,
                })
            } catch (rowError) {
                console.error("[v0] Bulk route row failed:", rowError.message)
                results.push({
                    briefItemId: String(rr._id),
                    label: rr.label,
                    error: rowError.message,
                })
            }
        }

        contract.markModified("vehicles")
        await contract.save()

        if (createdCount > 0) {
            await logRequestActivity(req, {
                contractId,
                action: "ROUTE_CREATED",
                entityType: "ROUTE",
                description: `Bulk-created ${createdCount} route(s) from the service brief on one vehicle`,
                meta: { count: createdCount, assignedVehicleId },
            })
        }

        res.status(201).json({
            success: true,
            message: `Created ${createdCount} route(s) from the brief.`,
            data: {
                created: createdCount,
                failed: results.filter((r) => r.error).length,
                results,
            },
        })
    } catch (error) {
        console.error("[v0] Error in bulk route creation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to bulk-create routes from brief",
            error: error.message,
        })
    }
}

// Hard cap on a single import batch. A brief can legitimately list hundreds of
// routes, but an unbounded batch would hold a request open indefinitely.
const MAX_ROUTE_IMPORT_BATCH = 300

// @desc    Import many routes from a managed-service brief in ONE action, with a
//          DIFFERENT assigned vehicle chosen per route.
//
//          This is the realistic managed-service path. A brief is never a single
//          route: the customer hands over a document listing many routes, and each
//          route has to run on a specific vehicle. The old
//          /bulk-assign-routes/:contractId/:assignedVehicleId endpoint could only
//          dump every route onto one vehicle, which is not how a fleet operates.
//
//          Rows may come from the structured brief (they carry a briefItemId, so
//          the created route auto-fulfils the brief item for the customer to
//          review) or straight out of the parsed requirement document (no
//          briefItemId — the route is still created, just not linked).
//
//          Both parties can call it: the customer runs it on its own contract, and
//          the partner runs it on behalf of the customer through
//          resolveCorporateContext. They hold the same document.
// @route   POST /api/contracts/import-routes/:contractId
// @access  Private (customer self-serve, or partner on-behalf via context)
export const importRoutesFromBrief = async (req, res) => {
    try {
        const { contractId } = req.params
        // After resolveCorporateContext this is ALWAYS the customer's id — either
        // the caller itself, or the customer the partner is acting for.
        const corporateOwnerId = req.userId
        const { items } = req.body || {}

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Select at least one route to import.",
            })
        }

        if (items.length > MAX_ROUTE_IMPORT_BATCH) {
            return res.status(400).json({
                success: false,
                message: `You can import at most ${MAX_ROUTE_IMPORT_BATCH} routes at a time. Please import them in smaller batches.`,
            })
        }

        const contract = await Contract.findOne({
            _id: contractId,
            corporateOwnerId,
        }).populate({
            path: "vehicles.vehicleId",
            select: "capacity vehicleName registrationNumber",
        })

        if (!contract) {
            return res.status(404).json({ success: false, message: "Contract not found" })
        }

        // Index every assigned vehicle on the contract so each row can be routed
        // to the vehicle the user picked for it, in a single pass.
        const vehicleIndex = new Map()
        for (const vehicleGroup of contract.vehicles) {
            for (const av of vehicleGroup.assignedVehicles || []) {
                vehicleIndex.set(av._id.toString(), {
                    assignedVehicle: av,
                    vehicleDetails: vehicleGroup.vehicleId,
                })
            }
        }

        if (vehicleIndex.size === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "No vehicles are assigned to this contract yet. Assign a vehicle before importing routes.",
            })
        }

        // The brief supplies the default service start date and is what the
        // created routes get linked back to. A missing brief is not fatal —
        // document-sourced rows can still be imported.
        const brief = await ManagedServiceBrief.findOne({ contractId })
        const defaultStartDate = brief?.serviceStartDate
            ? new Date(brief.serviceStartDate)
            : new Date()

        // Auto-fulfilment always targets THIS contract's brief, whether the caller
        // is the partner (on-behalf context) or the customer itself. The customer
        // importing its own brief must mark the items too, otherwise its dashboard
        // would still show every row as outstanding.
        const briefContractId = req.onBehalfContractId || contractId

        // Guard against creating a route that already exists ANYWHERE on this
        // contract (e.g. the user imports the same brief twice, or opens
        // "Import Routes from Brief" from each vehicle card). A brief route is a
        // single physical route and must exist only ONCE per contract — it runs
        // on one bus, not replicated across every bus. Keyed by contract +
        // from>to, mirroring the "alreadyExists" flag the import screen shows.
        const existingRouteDocs = await Route.find({ contractId })
            .select("fromLocation toLocation assignedVehicleId")
            .lean()
        const normKey = (v) =>
            String(v ?? "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")
        const existingRouteKeys = new Set(
            existingRouteDocs.map(
                (r) => `${normKey(r.fromLocation)}>${normKey(r.toLocation)}`,
            ),
        )

        const results = []
        let createdCount = 0
        let skippedCount = 0
        let touchedVehicles = false

        // Accept both plain stop names (from a document) and {location,time}
        // objects (from a richer editor / the structured brief).
        const normalizeStops = (list) =>
            (Array.isArray(list) ? list : [])
                .filter(Boolean)
                .map((s) =>
                    typeof s === "string"
                        ? { location: s.trim(), time: "" }
                        : { location: String(s.location || "").trim(), time: s.time || "" },
                )
                .filter((s) => s.location)

        for (const item of items) {
            const label = item?.label || item?.fromArea || "route"

            // A route can now run on MULTIPLE vehicles. Support the new
            // assignedVehicleIds[] (multi-select) and the legacy single
            // assignedVehicleId, de-duplicated.
            const rawVehicleIds =
                Array.isArray(item?.assignedVehicleIds) && item.assignedVehicleIds.length
                    ? item.assignedVehicleIds
                    : item?.assignedVehicleId
                      ? [item.assignedVehicleId]
                      : []
            const targetIds = [
                ...new Set(rawVehicleIds.map((id) => String(id || "")).filter(Boolean)),
            ]
            const targets = targetIds
                .map((id) => vehicleIndex.get(id))
                .filter(Boolean)

            if (targets.length === 0) {
                results.push({
                    sourceKey: item?.sourceKey || null,
                    briefItemId: item?.briefItemId || null,
                    label,
                    error: "Pick at least one vehicle for this route before importing it.",
                })
                continue
            }

            // ---- Build the route shape ONCE; every selected vehicle gets it. ----
            const fromLocation = String(item.fromArea || item.label || "Pickup").trim()
            const toLocation = String(item.toWorkLocation || "Work location").trim()

            const availableDays =
                Array.isArray(item.operatingDays) && item.operatingDays.length
                    ? item.operatingDays
                    : ["MON", "TUE", "WED", "THU", "FRI"]

            const outboundStopPoints = normalizeStops(
                Array.isArray(item.outboundStops) && item.outboundStops.length
                    ? item.outboundStops
                    : item.stops,
            )
            const explicitReturnStops = normalizeStops(item.returnStops)

            // Prefer the explicit Trip Type (mirrors the manual Assign Route
            // form). Fall back to inferring a round trip from the legacy
            // direction + return time when no trip type was supplied.
            const explicitType = String(item.tripType || "").toUpperCase()
            const pickupStart = item.pickupStartTime || item.pickupWindowStart || ""
            const pickupEnd =
                item.pickupEndTime || item.pickupWindowEnd || item.shiftLoginTime || ""
            const returnStart = item.returnStartTime || item.shiftLogoutTime || ""
            const returnEnd = item.returnEndTime || ""

            let isRoundTrip
            if (explicitType === "ROUND_TRIP") isRoundTrip = true
            else if (explicitType === "ONE_WAY") isRoundTrip = false
            else {
                const direction = String(item.direction || "BOTH").toUpperCase()
                isRoundTrip = direction === "BOTH" && Boolean(pickupStart && returnStart)
            }

            // A round trip retraces the outbound stops on the way back when no
            // explicit return stops were given.
            const returnStopPoints = isRoundTrip
                ? explicitReturnStops.length
                    ? explicitReturnStops
                    : [...outboundStopPoints].reverse()
                : []

            const directionForOneWay = String(item.direction || "").toUpperCase()
            const tripTimes = [
                isRoundTrip
                    ? {
                          tripNumber: 1,
                          tripType: "Round Trip",
                          departureTime: pickupStart,
                          pickupStartTime: pickupStart,
                          pickupEndTime: pickupEnd || null,
                          returnStartTime: returnStart,
                          returnEndTime: returnEnd || null,
                          outboundStopPoints,
                          returnStopPoints,
                      }
                    : {
                          tripNumber: 1,
                          tripType: "One Way",
                          // A DROP route leaves at the return/logout time.
                          departureTime:
                              directionForOneWay === "DROP"
                                  ? returnStart || pickupStart
                                  : pickupStart,
                          pickupStartTime: null,
                          pickupEndTime: null,
                          returnStartTime: null,
                          returnEndTime: null,
                          outboundStopPoints,
                          returnStopPoints: [],
                      },
            ]

            // Auto-fulfil the structured brief item only once per row, even when
            // the route runs on several vehicles.
            let briefAutoFulfilled = false

            // A brief route is ONE physical route. We create a single Route doc
            // (anchored to the first selected vehicle) and then share it across
            // EVERY selected vehicle's routeDetails, so the Routes tab shows one
            // card and every assigned vehicle card shows the same route. On a
            // re-import we reuse the existing route and just attach it to any
            // newly-selected vehicles.
            const dupKey = `${normKey(fromLocation)}>${normKey(toLocation)}`
            let sharedRouteId = null

            try {
                if (existingRouteKeys.has(dupKey)) {
                    // Route already exists on the contract — resolve its id so we
                    // can attach it to any newly-selected vehicles without making
                    // a duplicate.
                    const existingDoc =
                        existingRouteDocs.find(
                            (r) =>
                                `${normKey(r.fromLocation)}>${normKey(r.toLocation)}` === dupKey,
                        ) ||
                        (await Route.findOne({ contractId })
                            .where("fromLocation")
                            .equals(fromLocation)
                            .where("toLocation")
                            .equals(toLocation)
                            .select("_id")
                            .lean())
                    sharedRouteId = existingDoc?._id || null
                    skippedCount += 1
                    results.push({
                        sourceKey: item.sourceKey || null,
                        briefItemId: item.briefItemId || null,
                        label,
                        routeId: sharedRouteId,
                        skipped: true,
                        reason: "This route already exists on the contract.",
                    })
                } else {
                    // Create ONE route + schedule, anchored to the first selected
                    // vehicle (its canonical vehicle for trip generation).
                    const primary = targets[0]
                    const seatingCapacity =
                        primary.vehicleDetails?.capacity?.seatingCapacity || 0

                    const route = new Route({
                        contractId,
                        assignedVehicleId: primary.assignedVehicle._id,
                        vehicleId: primary.vehicleDetails?._id || null,
                        fromLocation,
                        toLocation,
                        routeStartDate: item.routeStartDate
                            ? new Date(item.routeStartDate)
                            : defaultStartDate,
                        startTime: tripTimes[0].departureTime || "",
                        endTime: pickupEnd || "",
                        stopPoints: outboundStopPoints,
                        totalDistance: Number(item.totalDistance) || 0,
                        estimatedDuration: item.estimatedDuration || "",
                        availableDays,
                        routeNotes: item.notes || "",
                        tripTimes,
                        assignedBy: corporateOwnerId,
                        totalSeats: seatingCapacity,
                        availableSeats: seatingCapacity,
                        routeType: "CORPORATE",
                        corporateId: corporateOwnerId,
                    })

                    await route.save()

                    // Every corporate route needs a schedule for trip generation,
                    // so create it here exactly as the manual "+ Add Route" flow.
                    const routeSchedule = new CorporateRouteSchedule({
                        corporateId: corporateOwnerId,
                        routeId: route._id,
                        contractId: contractId,
                        scheduleName: `${fromLocation} to ${toLocation} Schedule`,
                        tripTimes: tripTimes.map((t) => ({
                            tripNumber: t.tripNumber,
                            departureTime: t.departureTime,
                            arrivalTime: t.pickupEndTime || pickupEnd || null,
                            pickupStartTime: t.pickupStartTime,
                            pickupEndTime: t.pickupEndTime,
                            returnStartTime: t.returnStartTime,
                            returnEndTime: t.returnEndTime,
                            returnDepartureTime: t.returnStartTime,
                            returnArrivalTime: t.returnEndTime,
                            tripType: t.tripType,
                            outboundStopPoints: t.outboundStopPoints,
                            returnStopPoints: t.returnStopPoints,
                        })),
                        availableDays,
                        assignedVehicleId: primary.assignedVehicle._id,
                        assignedVehicle: primary.vehicleDetails?._id || null,
                        assignedDriver: primary.assignedVehicle.driverId || null,
                        startDate: item.routeStartDate
                            ? new Date(item.routeStartDate)
                            : defaultStartDate,
                        endDate: item.routeEndDate ? new Date(item.routeEndDate) : null,
                        totalSeats: seatingCapacity,
                        isActive: true,
                        status: "Active",
                    })
                    await routeSchedule.save()

                    sharedRouteId = route._id
                    existingRouteKeys.add(dupKey)
                    // Keep the in-memory dedup cache consistent for later items.
                    existingRouteDocs.push({
                        _id: route._id,
                        fromLocation,
                        toLocation,
                    })

                    // Only structured brief rows can be auto-linked — a document
                    // row has no brief sub-document to fulfil. Fulfil once.
                    if (item.briefItemId && !briefAutoFulfilled) {
                        briefAutoFulfilled = await autoFulfillBriefItem({
                            contractId: briefContractId,
                            section: "routeRequests",
                            briefItemId: item.briefItemId,
                            entityId: route._id,
                            entityType: "ROUTE",
                            actorId: req.actorId || req.userId,
                            actorRole: req.actingRole || "CORPORATE",
                        })
                    }

                    createdCount += 1
                    results.push({
                        sourceKey: item.sourceKey || null,
                        briefItemId: item.briefItemId || null,
                        label,
                        routeId: route._id,
                        scheduleId: routeSchedule._id,
                        assignedVehicleId: String(primary.assignedVehicle._id),
                        briefAutoFulfilled,
                    })
                }

                // Share the single route across EVERY selected vehicle so each
                // assigned vehicle card displays it (no duplicate route docs).
                if (sharedRouteId) {
                    for (const target of targets) {
                        const av = target.assignedVehicle
                        if (!Array.isArray(av.routeDetails)) av.routeDetails = []
                        const already = av.routeDetails.some(
                            (id) => String(id) === String(sharedRouteId),
                        )
                        if (!already) {
                            av.routeDetails.push(sharedRouteId)
                            touchedVehicles = true
                        }
                    }
                }
            } catch (rowError) {
                // One bad row must never abort the rest of the batch.
                console.error("[v0] Route import row failed:", rowError.message)
                results.push({
                    sourceKey: item?.sourceKey || null,
                    briefItemId: item?.briefItemId || null,
                    label,
                    error: rowError.message,
                })
            }
        }

        if (touchedVehicles) {
            contract.markModified("vehicles")
            await contract.save()
        }

        if (createdCount > 0) {
            await logRequestActivity(req, {
                contractId: briefContractId,
                action: "ROUTE_CREATED",
                entityType: "ROUTE",
                description: `Imported ${createdCount} route(s) from the service brief`,
                meta: {
                    count: createdCount,
                    failed: results.filter((r) => r.error).length,
                    vehicles: [
                        ...new Set(results.filter((r) => r.assignedVehicleId).map((r) => r.assignedVehicleId)),
                    ].length,
                },
            })
        }

        const failedCount = results.filter((r) => r.error).length
        // Success when we created something OR when nothing was created only
        // because every selected route already existed (skipped, not failed).
        const ok = createdCount > 0 || (failedCount === 0 && skippedCount > 0)
        let message
        if (createdCount > 0) {
            message = `Imported ${createdCount} route(s) from the brief.${
                skippedCount > 0 ? ` ${skippedCount} already existed and were skipped.` : ""
            }`
        } else if (skippedCount > 0 && failedCount === 0) {
            message = touchedVehicles
                ? `Those route(s) already existed and are now shown on the selected vehicle(s).`
                : `All ${skippedCount} selected route(s) already exist on the contract. Nothing new to import.`
        } else {
            message = "No routes could be imported. Please review the errors."
        }

        res.status(ok ? 201 : 400).json({
            success: ok,
            message,
            data: {
                created: createdCount,
                skipped: skippedCount,
                failed: failedCount,
                results,
            },
        })
    } catch (error) {
        console.error("[v0] Error importing routes from brief:", error)
        res.status(500).json({
            success: false,
            message: "Failed to import routes from the brief",
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

        // Find and verify the route exists on THIS contract. We intentionally do
        // NOT scope by assignedVehicleId: a route can be shared across several
        // vehicles and its canonical assignedVehicleId is only the first bus, so
        // scoping by it would 404 when deleting from any other vehicle's card.
        const route = await Route.findOne({
            _id: routeId,
            contractId,
        })

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            })
        }

        // A shared route is one physical route. Deleting it removes it from
        // EVERY vehicle it runs on (not just the card it was clicked from), then
        // the Route doc + schedules are deleted, so no dangling references remain.
        let updated = false
        for (const vehicleGroup of contract.vehicles) {
            for (const assignedVehicle of vehicleGroup.assignedVehicles || []) {
                if (!Array.isArray(assignedVehicle.routeDetails)) continue
                const before = assignedVehicle.routeDetails.length
                assignedVehicle.routeDetails = assignedVehicle.routeDetails.filter(
                    (r) => r.toString() !== routeId
                )
                if (assignedVehicle.routeDetails.length !== before) updated = true
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
            { path: "corporateOwnerId", select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality" },
            { path: "fleetOwnerId", select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality" },
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
            { path: "corporateOwnerId", select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality" },
            { path: "fleetOwnerId", select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality" },
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
            { path: "corporateOwnerId", select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality" },
            { path: "fleetOwnerId", select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality" },
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
                message: "Original contract document not found. The partner must upload the contract first.",
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
            reason: "Customer uploaded signed contract document for partner verification",
        })

        await contract.save()

        await contract.populate([
            {
                path: "corporateOwnerId",
                select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality",
            },
            {
                path: "fleetOwnerId",
                select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality",
            },
        ])

        // Get names for notifications
        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || 'Fleet Owner';

        // Segment-aware wording so school users don't see corporate/B2B copy.
        const customerRole = contract.corporateOwnerId?.role
        const partnerRole = contract.fleetOwnerId?.role
        const partnerLabel = partnerRoleLabel(partnerRole)

        // Notify partner (B2B_PARTNER / SCHOOL_PARTNER) about signed document upload
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
            `${corporateName} (${segmentTag(customerRole)}) uploaded signed contract document for ${fleetName} (${segmentTag(partnerRole)}). Pending verification.`,
            "SIGNED_DOCUMENT_UPLOADED",
            { contractId: contract._id, corporateId: corporateOwnerId, fleetOwnerId: contract.fleetOwnerId._id }
        );

        res.status(200).json({
            success: true,
            message: `Signed contract document uploaded successfully. Waiting for ${partnerLabel} verification.`,
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
                message: `Cannot verify signed document in current status: ${contract.status}. Contract must be pending partner verification.`,
            })
        }

        // Check if signed document exists
        if (!contract.signedContractDocument?.url) {
            return res.status(400).json({
                success: false,
                message: "Signed contract document not found. The customer must upload the signed document first.",
            })
        }

        await contract.populate([
            {
                path: "corporateOwnerId",
                select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality",
            },
            {
                path: "fleetOwnerId",
                select: "fullName email companyName role userType phone whatsappNumber companyAddress nationality",
            },
        ])

        const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || 'Fleet Owner';

        // Segment-aware wording so school users don't see corporate/B2B copy.
        const customerRole = contract.corporateOwnerId?.role
        const partnerRole = contract.fleetOwnerId?.role
        const partnerLabel = partnerRoleLabel(partnerRole)

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
                reason: verificationNotes || `${partnerLabel} verified signed contract document. Ready for ${partnerLabel} signature.`,
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
                `${fleetName} (${segmentTag(partnerRole)}) verified signed contract from ${corporateName} (${segmentTag(customerRole)}). Ready for ${partnerLabel} signature.`,
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
                `${fleetName} (${segmentTag(partnerRole)}) rejected signed contract from ${corporateName} (${segmentTag(customerRole)}). Reason: ${rejectionReason}`,
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
