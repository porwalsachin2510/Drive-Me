import Contract from "../models/Contract.js";
import User from "../models/User.js";
import Quotation from "../models/Quotation.js";
import Requirement from "../models/Requirement.js";
import { sendEmail } from "../Services/emailService.js";

// Create new client inquiry
export const createClientInquiry = async (req, res) => {
    try {
        const {
            companyName,
            contactPerson,
            email,
            phone,
            companySize,
            industry,
            transportRequirements,
            pickupLocations,
            dropoffLocations,
            officeLocations,
            shiftTimings,
            specialRequirements,
            expectedStartDate,
            budgetRange
        } = req.body;

        const b2bPartnerId = req.userId;

        // Create requirement record
        const requirement = new Requirement({
            corporateId: b2bPartnerId,
            companyName,
            contactPerson,
            email,
            phone,
            companySize,
            industry,
            transportRequirements,
            pickupLocations,
            dropoffLocations,
            officeLocations,
            shiftTimings,
            specialRequirements,
            expectedStartDate: new Date(expectedStartDate),
            budgetRange,
            status: "PENDING",
            source: "WEBSITE_INQUIRY"
        });

        await requirement.save();

        // Notify sales team
        await notifySalesTeam(requirement);

        res.status(201).json({
            success: true,
            message: "Client inquiry created successfully",
            data: {
                requirementId: requirement._id,
                referenceNumber: `REQ-${Date.now()}`
            }
        });

    } catch (error) {
        console.error("Error creating client inquiry:", error);
        res.status(500).json({
            success: false,
            message: "Error creating client inquiry",
            error: error.message
        });
    }
};

// Get all client inquiries/requirements
export const getClientRequirements = async (req, res) => {
    try {
        const b2bPartnerId = req.userId;
        const { 
            status, 
            priority, 
            page = 1, 
            limit = 20, 
            startDate, 
            endDate,
            search 
        } = req.query;

        const query = { corporateId: b2bPartnerId };
        
        if (status) query.status = status.toUpperCase();
        if (priority) query.priority = priority.toUpperCase();
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (search) {
            query.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { contactPerson: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const requirements = await Requirement.find(query)
            .sort({ priority: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Requirement.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                requirements,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalRequirements: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting client requirements:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving client requirements",
            error: error.message
        });
    }
};

// Create proposal for client
export const createProposal = async (req, res) => {
    try {
        const {
            requirementId,
            clientId,
            proposalTitle,
            routePlans,
            vehicleTypes,
            pricing,
            timeline,
            termsAndConditions,
            validityPeriod,
            specialNotes
        } = req.body;

        const b2bPartnerId = req.userId;

        // Check if requirement exists
        const requirement = await Requirement.findById(requirementId);
        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        // Create quotation/proposal
        const quotation = new Quotation({
            fleetOwnerId: b2bPartnerId,
            corporateOwnerId: clientId,
            requirementId,
            proposalTitle,
            routePlans,
            vehicleTypes,
            pricing,
            timeline,
            termsAndConditions,
            validityPeriod: new Date(validityPeriod),
            specialNotes,
            status: "DRAFT",
            createdAt: new Date()
        });

        await quotation.save();

        // Update requirement status
        requirement.status = "PROPOSAL_SENT";
        requirement.proposalSentAt = new Date();
        await requirement.save();

        // Send proposal to client
        await sendProposalToClient(quotation, requirement);

        res.status(201).json({
            success: true,
            message: "Proposal created successfully",
            data: {
                quotationId: quotation._id,
                proposalNumber: `PROP-${Date.now()}`
            }
        });

    } catch (error) {
        console.error("Error creating proposal:", error);
        res.status(500).json({
            success: false,
            message: "Error creating proposal",
            error: error.message
        });
    }
};

// Get all proposals
export const getProposals = async (req, res) => {
    try {
        const b2bPartnerId = req.userId;
        const { 
            status, 
            clientId, 
            page = 1, 
            limit = 20,
            startDate,
            endDate 
        } = req.query;

        const query = { fleetOwnerId: b2bPartnerId };
        
        if (status) query.status = status.toUpperCase();
        if (clientId) query.corporateOwnerId = clientId;
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const quotations = await Quotation.find(query)
            .populate('corporateOwnerId', 'companyName email fullName')
            .populate('requirementId', 'companyName transportRequirements')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Quotation.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                quotations,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalProposals: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting proposals:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving proposals",
            error: error.message
        });
    }
};

// Finalize contract
export const finalizeContract = async (req, res) => {
    try {
        const { quotationId, contractTerms, startDate, endDate, billingCycle } = req.body;
        const b2bPartnerId = req.userId;

        // Get quotation details
        const quotation = await Quotation.findById(quotationId)
            .populate('corporateOwnerId', 'companyName email fullName')
            .populate('requirementId', 'transportRequirements');

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found"
            });
        }

        // Create contract
        const contract = new Contract({
            fleetOwnerId: b2bPartnerId,
            corporateOwnerId: quotation.corporateOwnerId._id,
            quotationId: quotation._id,
            contractNumber: `CONTRACT-${Date.now()}`,
            contractTerms,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            billingCycle,
            status: "ACTIVE",
            signedAt: new Date(),
            totalValue: quotation.pricing.totalMonthlyRate * 12, // Annual value
            currency: quotation.pricing.currency
        });

        await contract.save();

        // Update quotation status
        quotation.status = "ACCEPTED";
        quotation.acceptedAt = new Date();
        await quotation.save();

        // Update requirement status
        await Requirement.findByIdAndUpdate(quotation.requirementId._id, {
            status: "CONTRACT_SIGNED"
        });

        // Setup client account
        await setupClientAccount(quotation.corporateOwnerId._id, b2bPartnerId);

        // Send contract confirmation
        await sendContractConfirmation(contract, quotation);

        res.status(201).json({
            success: true,
            message: "Contract finalized successfully",
            data: {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                clientId: quotation.corporateOwnerId._id
            }
        });

    } catch (error) {
        console.error("Error finalizing contract:", error);
        res.status(500).json({
            success: false,
            message: "Error finalizing contract",
            error: error.message
        });
    }
};

// Get all contracts
export const getContracts = async (req, res) => {
    try {
        const b2bPartnerId = req.userId;
        const { 
            status, 
            clientId, 
            page = 1, 
            limit = 20,
            startDate,
            endDate 
        } = req.query;

        const query = { fleetOwnerId: b2bPartnerId };
        
        if (status) query.status = status.toUpperCase();
        if (clientId) query.corporateOwnerId = clientId;
        if (startDate && endDate) {
            query.startDate = { $gte: new Date(startDate) };
            query.endDate = { $lte: new Date(endDate) };
        }

        const contracts = await Contract.find(query)
            .populate('corporateOwnerId', 'companyName email fullName')
            .populate('fleetOwnerId', 'fullName businessName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Contract.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                contracts,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalContracts: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting contracts:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving contracts",
            error: error.message
        });
    }
};

// Get client management dashboard
export const getClientDashboard = async (req, res) => {
    try {
        const b2bPartnerId = req.userId;
        const { period = 'month' } = req.query;

        const dashboard = await getClientDashboardData(b2bPartnerId, period);

        res.status(200).json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        console.error("Error getting client dashboard:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving client dashboard",
            error: error.message
        });
    }
};

// Helper functions
const notifySalesTeam = async (requirement) => {
    try {
        // Get sales team members
        const salesTeam = await User.find({
            role: "B2B_PARTNER",
            isActive: true
        });

        for (const salesPerson of salesTeam) {
            await sendEmail({
                to: salesPerson.email,
                subject: "New Client Inquiry",
                template: "newInquiry",
                data: {
                    salesPersonName: salesPerson.fullName,
                    companyName: requirement.companyName,
                    contactPerson: requirement.contactPerson,
                    email: requirement.email,
                    phone: requirement.phone,
                    transportRequirements: requirement.transportRequirements,
                    inquiryId: requirement._id
                }
            });
        }
    } catch (error) {
        console.error("Error notifying sales team:", error);
    }
};

const sendProposalToClient = async (quotation, requirement) => {
    try {
        await sendEmail({
            to: requirement.email,
            subject: `Transportation Proposal from ${quotation.b2bPartnerId}`,
            template: "proposalSent",
            data: {
                clientName: requirement.contactPerson,
                companyName: requirement.companyName,
                proposalTitle: quotation.proposalTitle,
                proposalDetails: quotation.routePlans,
                pricing: quotation.pricing,
                validityPeriod: quotation.validityPeriod,
                proposalLink: `${process.env.FRONTEND_URL}/proposals/${quotation._id}`
            }
        });
    } catch (error) {
        console.error("Error sending proposal to client:", error);
    }
};

const sendContractConfirmation = async (contract, quotation) => {
    try {
        await sendEmail({
            to: quotation.corporateOwnerId.email,
            subject: "Contract Confirmation - Transport Services",
            template: "contractConfirmation",
            data: {
                clientName: quotation.corporateOwnerId.fullName,
                companyName: quotation.corporateOwnerId.companyName,
                contractNumber: contract.contractNumber,
                startDate: contract.startDate,
                endDate: contract.endDate,
                billingCycle: contract.billingCycle,
                totalValue: contract.totalValue
            }
        });
    } catch (error) {
        console.error("Error sending contract confirmation:", error);
    }
};

const setupClientAccount = async (clientId, b2bPartnerId) => {
    try {
        // Update client user to have corporate role
        await User.findByIdAndUpdate(clientId, {
            role: "CORPORATE",
            b2bProviderId: b2bPartnerId,
            isActive: true
        });
    } catch (error) {
        console.error("Error setting up client account:", error);
    }
};

const getClientDashboardData = async (b2bPartnerId, period) => {
    try {
        let dateFilter;
        const today = new Date();

        switch (period) {
            case 'today':
                dateFilter = {
                    $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                    $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
                };
                break;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                dateFilter = {
                    $gte: weekAgo,
                    $lte: today
                };
                break;
            case 'month':
            default:
                const monthAgo = new Date(today);
                monthAgo.setMonth(today.getMonth() - 1);
                dateFilter = {
                    $gte: monthAgo,
                    $lte: today
                };
                break;
            case 'year':
                const yearAgo = new Date(today);
                yearAgo.setFullYear(today.getFullYear() - 1);
                dateFilter = {
                    $gte: yearAgo,
                    $lte: today
                };
                break;
        }

        // Get statistics
        const totalRequirements = await Requirement.countDocuments({
            corporateId: b2bPartnerId,
            createdAt: dateFilter
        });

        const totalProposals = await Quotation.countDocuments({
            fleetOwnerId: b2bPartnerId,
            createdAt: dateFilter
        });

        const totalContracts = await Contract.countDocuments({
            fleetOwnerId: b2bPartnerId,
            createdAt: dateFilter
        });

        const activeContracts = await Contract.countDocuments({
            fleetOwnerId: b2bPartnerId,
            status: "ACTIVE"
        });

        const totalValue = await Contract.aggregate([
            { $match: { fleetOwnerId: b2bPartnerId, status: "ACTIVE" } },
            { $group: { _id: null, totalValue: { $sum: "$totalValue" } } }
        ]);

        const conversionRate = totalProposals > 0 ? ((totalContracts / totalProposals) * 100).toFixed(2) : 0;

        return {
            period,
            totalRequirements,
            totalProposals,
            totalContracts,
            activeContracts,
            totalValue: totalValue[0]?.totalValue || 0,
            conversionRate: parseFloat(conversionRate),
            averageContractValue: totalContracts > 0 ? (totalValue[0]?.totalValue / totalContracts).toFixed(2) : 0
        };

    } catch (error) {
        console.error("Error getting client dashboard data:", error);
        return {
            period,
            totalRequirements: 0,
            totalProposals: 0,
            totalContracts: 0,
            activeContracts: 0,
            totalValue: 0,
            conversionRate: 0,
            averageContractValue: 0
        };
    }
};
