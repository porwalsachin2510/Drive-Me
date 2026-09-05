import mongoose from "mongoose";
import Requirement from "../models/Requirement.js";
import Quotation from "../models/Quotation.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Notification from "../models/Notification.js";
import { sendRealTimeNotification, sendAdminNotification } from "../Services/notificationService.js";
import { sendEmail } from "../Services/emailService.js";
import { getBusinessSegment, isCustomerRole, isPartnerRole } from "../utils/roleFamilies.js";

const createNotification = async (userId, type, title, message, relatedEntityId, relatedEntityType) => {
    try {
        const notification = await Notification.create({ userId, type, title, message, relatedEntityId, relatedEntityType });
        // Send real-time notification
        sendRealTimeNotification(userId.toString(), {
            _id: notification._id,
            type,
            title,
            message,
            metadata: { relatedEntityId, relatedEntityType },
        });
        return notification;
    } catch (error) {
        console.error("Notification creation error:", error);
    }
};

// @desc    Create new requirement
// @route   POST /api/requirements
// @access  Private (CORPORATE only)
export const createRequirement = async (req, res) => {
    try {
        const corporateId = req.userId;

        // Business segment is derived from the creator's role so it can never be
        // spoofed via the request body. SCHOOL_CUSTOMER => "SCHOOL", CORPORATE =>
        // "CORPORATE". This gates which partners will see the requirement.
        const businessSegment = getBusinessSegment(req.userRole) || "CORPORATE";

        const requirementData = {
            ...req.body,
            businessSegment,
            corporateId,
            createdBy: corporateId,
            status: "PUBLISHED", // Requirements are automatically published when created
        };

        const requirement = new Requirement(requirementData);
        await requirement.save();

        // If visibility is INVITE_ONLY, send notifications to invited partners
        if (requirement.visibility === "INVITE_ONLY" && requirement.invitedPartners.length > 0) {
            // TODO: Send notifications to invited partners
            console.log(`Sending notifications to ${requirement.invitedPartners.length} invited partners`);
        }

        res.status(201).json({
            success: true,
            message: "Requirement created successfully",
            data: requirement
        });
    } catch (error) {
        console.error("Error creating requirement:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create requirement"
        });
    }
};

// @desc    Get all requirements for a corporate
// @route   GET /api/requirements/corporate
// @access  Private (CORPORATE only)
export const getCorporateRequirements = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { page = 1, limit = 10, status, search } = req.query;

        // Build query
        const query = { corporateId, isDeleted: false };
        
        if (status && status !== "all") {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { "routeInfo.fromLocation": { $regex: search, $options: "i" } },
                { "routeInfo.toLocation": { $regex: search, $options: "i" } }
            ];
        }

        const requirements = await Requirement.find(query)
            .populate('quotations', 'totalAmount status createdAt')
            .populate('selectedQuotation', 'totalAmount status createdAt')
            .populate('corporateId', 'companyName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Requirement.countDocuments(query);

        res.json({
            success: true,
            data: {
                requirements,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Error fetching corporate requirements:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch requirements"
        });
    }
};

// @desc    Get all open requirements for B2B partners
// @route   GET /api/requirements/open
// @access  Private (B2B_PARTNER only)
export const getOpenRequirements = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, vehicleType, location } = req.query;

        const partnerId = req.userId;

        // Segment isolation: a partner only sees requirements from customers in
        // its own business segment. A SCHOOL_PARTNER sees only "SCHOOL"
        // requirements; a B2B_PARTNER sees only "CORPORATE" requirements. Legacy
        // requirements without a segment are treated as CORPORATE.
        const partnerSegment = getBusinessSegment(req.userRole) || "CORPORATE";
        // For CORPORATE partners, `$ne: "SCHOOL"` also matches legacy docs where
        // businessSegment is missing/null. School partners match "SCHOOL" only.
        const segmentFilter =
            partnerSegment === "CORPORATE"
                ? { businessSegment: { $ne: "SCHOOL" } }
                : { businessSegment: "SCHOOL" };

        // Build query for open requirements - PUBLIC (PUBLISHED, DRAFT, or IN_PROGRESS) + INVITE_ONLY where partner is invited
        let query = {
            status: { $in: ["PUBLISHED", "DRAFT", "IN_PROGRESS", "OPEN"] },
            $or: [
                { visibility: "PUBLIC" },
                { visibility: { $exists: false } },
                { visibility: null },
                { visibility: "INVITE_ONLY", invitedPartners: partnerId }
            ],
            ...segmentFilter,
            isDeleted: false
        };
        
        // Only filter by deadline if deadline exists
        query.$and = [
            { $or: [
                { quotationDeadline: { $gt: new Date() } },
                { quotationDeadline: { $exists: false } },
                { quotationDeadline: null }
            ]}
        ];

        // Add search filters
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { "routeInfo.fromLocation": { $regex: search, $options: "i" } },
                { "routeInfo.toLocation": { $regex: search, $options: "i" } }
            ];
        }

        if (vehicleType) {
            query["vehicleRequirements.vehicleType"] = vehicleType;
        }

        if (location) {
            query.$or = [
                { "routeInfo.fromLocation": { $regex: location, $options: "i" } },
                { "routeInfo.toLocation": { $regex: location, $options: "i" } }
            ];
        }

        const requirements = await Requirement.find(query)
            .populate('corporateId', 'companyName companyLogo')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Requirement.countDocuments(query);

        res.json({
            success: true,
            data: {
                requirements,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Error fetching open requirements:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch open requirements"
        });
    }
};

// @desc    Get requirement by ID
// @route   GET /api/requirements/:id
// @access  Private (CORPORATE or B2B_PARTNER)
export const getRequirementById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const userRole = req.userRole;

        const requirement = await Requirement.findById(id)
            .populate('corporateId', 'companyName companyLogo website')
            .populate('quotations')
            .populate('selectedQuotation')
            .populate('createdBy', 'fullName email');

        if (!requirement || requirement.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        // Check access permissions
        if (isCustomerRole(userRole) && requirement.corporateId._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        if (isPartnerRole(userRole)) {
            // Partners can only view publicly visible requirements in their own segment
            if (requirement.visibility !== "PUBLIC") {
                return res.status(403).json({
                    success: false,
                    message: "This requirement is not publicly visible"
                });
            }
            const partnerSegment = getBusinessSegment(userRole) || "CORPORATE";
            const reqSegment = requirement.businessSegment || "CORPORATE";
            if (partnerSegment !== reqSegment) {
                return res.status(403).json({
                    success: false,
                    message: "This requirement is not available to your account type"
                });
            }
        }

        res.json({
            success: true,
            data: requirement
        });
    } catch (error) {
        console.error("Error fetching requirement:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch requirement"
        });
    }
};

// @desc    Update requirement
// @route   PUT /api/requirements/:id
// @access  Private (CORPORATE only)
export const updateRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateId = req.userId;
        const updateData = {
            ...req.body,
            lastModifiedBy: corporateId,
        };

        const requirement = await Requirement.findOne({
            _id: id,
            corporateId,
            isDeleted: false
        });

        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        // Don't allow updates if requirement is already published and has quotations
        if (requirement.status === "PUBLISHED" && requirement.quotations.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot update requirement that has received quotations"
            });
        }

        Object.assign(requirement, updateData);
        await requirement.save();

        res.json({
            success: true,
            message: "Requirement updated successfully",
            data: requirement
        });
    } catch (error) {
        console.error("Error updating requirement:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update requirement"
        });
    }
};

// @desc    Publish requirement
// @route   POST /api/requirements/:id/publish
// @access  Private (CORPORATE only)
export const publishRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateId = req.userId;

        const requirement = await Requirement.findOne({
            _id: id,
            corporateId,
            isDeleted: false
        });

        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        if (requirement.status !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Only draft requirements can be published"
            });
        }

        await requirement.publish();

        // Notify B2B partners about new requirement
        // TODO: Implement notification system

        res.json({
            success: true,
            message: "Requirement published successfully",
            data: requirement
        });
    } catch (error) {
        console.error("Error publishing requirement:", error);
        res.status(500).json({
            success: false,
            message: "Failed to publish requirement"
        });
    }
};

// @desc    Close requirement
// @route   POST /api/requirements/:id/close
// @access  Private (CORPORATE only)
export const closeRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateId = req.userId;

        const requirement = await Requirement.findOne({
            _id: id,
            corporateId,
            isDeleted: false
        });

        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        await requirement.close();

        res.json({
            success: true,
            message: "Requirement closed successfully",
            data: requirement
        });
    } catch (error) {
        console.error("Error closing requirement:", error);
        res.status(500).json({
            success: false,
            message: "Failed to close requirement"
        });
    }
};

// @desc    Delete requirement (soft delete)
// @route   DELETE /api/requirements/:id
// @access  Private (CORPORATE only)
export const deleteRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateId = req.userId;

        const requirement = await Requirement.findOne({
            _id: id,
            corporateId,
            isDeleted: false
        });

        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        // Don't allow deletion if requirement has quotations
        if (requirement.quotations.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete requirement that has received quotations"
            });
        }

        requirement.isDeleted = true;
        await requirement.save();

        res.json({
            success: true,
            message: "Requirement deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting requirement:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete requirement"
        });
    }
};

// @desc    Get requirement statistics
// @route   GET /api/requirements/statistics
// @access  Private (CORPORATE only)
export const getRequirementStatistics = async (req, res) => {
    try {
        const corporateId = req.userId;

        const stats = await Requirement.aggregate([
            { $match: { corporateId: new mongoose.Types.ObjectId(corporateId), isDeleted: false } },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalBudget: { $sum: "$contractDetails.budgetRange.max" }
                }
            }
        ]);

        const totalRequirements = await Requirement.countDocuments({
            corporateId,
            isDeleted: false
        });

        const openQuotations = await Requirement.countDocuments({
            corporateId,
            status: "PUBLISHED",
            isDeleted: false
        });

        res.json({
            success: true,
            data: {
                totalRequirements,
                openQuotations,
                statusBreakdown: stats,
            }
        });
    } catch (error) {
        console.error("Error fetching requirement statistics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch statistics"
        });
    }
};

// @desc    B2B Partner submits quotation against a requirement
// @route   POST /api/requirements/:id/submit-quotation
// @access  Private (B2B_PARTNER only)
export const submitQuotationForRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const partnerId = req.userId;
        const {
            vehicleOfferings,
            pricing,
            terms,
            availability,
            message,
            validUntil
        } = req.body;

        // Find the requirement
        const requirement = await Requirement.findById(id);

        if (!requirement || requirement.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        // Segment isolation: a partner may only quote requirements in its own
        // business segment (school partners <-> school requirements, etc.).
        const partnerSegment = getBusinessSegment(req.userRole) || "CORPORATE";
        const reqSegment = requirement.businessSegment || "CORPORATE";
        if (partnerSegment !== reqSegment) {
            return res.status(403).json({
                success: false,
                message: "This requirement is not available to your account type"
            });
        }

        // Check requirement is published and open for quotations
        if (requirement.status !== "PUBLISHED") {
            return res.status(400).json({
                success: false,
                message: "Requirement is not accepting quotations"
            });
        }

        // Check deadline
        if (requirement.quotationDeadline && new Date() > new Date(requirement.quotationDeadline)) {
            return res.status(400).json({
                success: false,
                message: "Quotation deadline has passed"
            });
        }

        // Check if partner already submitted a quotation
        const existingQuotation = await Quotation.findOne({
            requirementId: id,
            fleetOwnerId: partnerId,
            status: { $ne: "REJECTED" }
        });

        if (existingQuotation) {
            return res.status(400).json({
                success: false,
                message: "You have already submitted a quotation for this requirement"
            });
        }

        // Check visibility (INVITE_ONLY check)
        if (requirement.visibility === "INVITE_ONLY") {
            const isInvited = requirement.invitedPartners.some(
                p => p.toString() === partnerId
            );
            if (!isInvited) {
                return res.status(403).json({
                    success: false,
                    message: "You are not invited to submit a quotation for this requirement"
                });
            }
        }

        // Build vehicles array from offerings for the Quotation model
        const vehicles = (vehicleOfferings || []).map(offering => ({
            vehicleId: offering.vehicleId,
            quantity: offering.quantity || 1
        }));

        // Create quotation
        const quotation = await Quotation.create({
            corporateOwnerId: requirement.corporateId,
            fleetOwnerId: partnerId,
            requirementId: requirement._id,
            vehicles: vehicles.length > 0 ? vehicles : undefined,
            rentalPeriod: {
                startDate: requirement.contractDetails.startDate,
                endDate: requirement.contractDetails.endDate,
                durationType: "MONTHLY",
                duration: requirement.contractDetails.duration
            },
            requirements: {
                withDriver: requirement.driverRequirements?.required || false,
                fuelIncluded: requirement.fuelRequirements?.included || false,
            },
            quotedPrice: {
                totalAmount: pricing?.totalAmount || pricing?.monthlyRate || 0,
                currency: pricing?.currency || requirement.contractDetails.budgetRange.currency || "KWD",
                breakdown: {
                    vehicleRental: pricing?.vehicleRental || 0,
                    driverCharges: pricing?.driverCharges || 0,
                    fuelCharges: pricing?.fuelCharges || 0
                },
                perVehicleBreakdown: pricing?.perVehicleBreakdown || []
            },
            responseMessage: message || "",
            terms: terms?.notes || JSON.stringify(terms) || "",
            validUntil: validUntil || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: "QUOTED",
            respondedAt: new Date()
        });

        // Add quotation to requirement
        await requirement.addQuotation(quotation._id);

        // Create notification for corporate
        await createNotification(
            requirement.corporateId,
            "REQUIREMENT_QUOTATION",
            "New Quotation Received",
            `A B2B partner has submitted a quotation for your requirement "${requirement.title}"`,
            quotation._id,
            "QUOTATION"
        );

        // Populate the quotation
        const populatedQuotation = await Quotation.findById(quotation._id)
            .populate("fleetOwnerId", "fullName companyName email businessName")
            .populate("corporateOwnerId", "fullName companyName email");

        res.status(201).json({
            success: true,
            message: "Quotation submitted successfully",
            data: populatedQuotation
        });

    } catch (error) {
        console.error("Error submitting quotation for requirement:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to submit quotation"
        });
    }
};

// @desc    Corporate selects/awards a quotation for a requirement
// @route   POST /api/requirements/:id/select-quotation
// @access  Private (CORPORATE only)
export const selectQuotationForRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateId = req.userId;
        const { quotationId, message } = req.body;

        const requirement = await Requirement.findOne({
            _id: id,
            corporateId,
            isDeleted: false
        });

        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        if (!requirement.quotations.includes(quotationId)) {
            return res.status(400).json({
                success: false,
                message: "This quotation does not belong to this requirement"
            });
        }

        // Select the quotation (sets selectedQuotation and closes requirement)
        await requirement.selectQuotation(quotationId);

        // Update the quotation status to ACCEPTED
        const quotation = await Quotation.findByIdAndUpdate(
            quotationId,
            {
                status: "ACCEPTED",
                acceptedAt: new Date(),
                corporateResponseMessage: message || "Quotation selected for this requirement"
            },
            { new: true }
        ).populate("fleetOwnerId", "fullName companyName email");

        // Notify the B2B partner
        if (quotation) {
            await createNotification(
                quotation.fleetOwnerId._id || quotation.fleetOwnerId,
                "QUOTATION_ACCEPTED",
                "Quotation Accepted",
                `Your quotation for "${requirement.title}" has been accepted!`,
                quotation._id,
                "QUOTATION"
            );
        }

        // Reject all other quotations for this requirement
        await Quotation.updateMany(
            {
                _id: { $in: requirement.quotations, $ne: quotationId },
            },
            {
                status: "REJECTED",
                rejectedAt: new Date(),
                corporateResponseMessage: "Another quotation was selected"
            }
        );

        res.json({
            success: true,
            message: "Quotation selected successfully",
            data: {
                requirement: await Requirement.findById(id)
                    .populate("selectedQuotation")
                    .populate("corporateId", "companyName"),
                selectedQuotation: quotation
            }
        });

    } catch (error) {
        console.error("Error selecting quotation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to select quotation"
        });
    }
};

// @desc    Get quotations for a specific requirement
// @route   GET /api/requirements/:id/quotations
// @access  Private (CORPORATE only)
export const getRequirementQuotations = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateId = req.userId;

        const requirement = await Requirement.findOne({
            _id: id,
            corporateId,
            isDeleted: false
        });

        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        const quotations = await Quotation.find({
            _id: { $in: requirement.quotations }
        })
            .populate("fleetOwnerId", "fullName companyName email businessName whatsappNumber")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: {
                requirementId: id,
                requirementTitle: requirement.title,
                totalQuotations: quotations.length,
                quotations
            }
        });

    } catch (error) {
        console.error("Error fetching requirement quotations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch quotations"
        });
    }
};

// @desc    B2B Partner responds to a requirement (before formal quotation)
// @route   POST /api/requirements/:id/respond
// @access  Private (B2B_PARTNER only)
export const respondToRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const partnerId = req.userId;
        const { responseType, message, estimatedAvailability, vehicleDetails } = req.body;

        // Find the requirement
        const requirement = await Requirement.findById(id).populate('corporateId', 'companyName email fullName');

        if (!requirement || requirement.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        // Check if partner already responded
        const existingResponse = requirement.partnerResponses?.find(
            r => r.partnerId.toString() === partnerId
        );

        if (existingResponse) {
            return res.status(400).json({
                success: false,
                message: "You have already responded to this requirement"
            });
        }

        // Get B2B partner info
        const partner = await User.findById(partnerId).select('fullName companyName businessName email');
        const partnerName = partner?.companyName || partner?.businessName || partner?.fullName || 'B2B Partner';

        // Add response
        if (!requirement.partnerResponses) {
            requirement.partnerResponses = [];
        }

        requirement.partnerResponses.push({
            partnerId,
            responseType,
            message,
            estimatedAvailability: estimatedAvailability ? new Date(estimatedAvailability) : null,
            vehicleDetails,
            respondedAt: new Date(),
        });

        // Update status from DRAFT to PUBLISHED when first response is received
        if (requirement.status === "DRAFT") {
            requirement.status = "PUBLISHED";
        }

        await requirement.save();

        // Create notification for Corporate
        let notificationMessage = "";
        if (responseType === "INTERESTED") {
            notificationMessage = `${partnerName} is interested in your requirement "${requirement.title}" and may submit a quotation.`;
        } else if (responseType === "WILL_ADD_VEHICLE") {
            notificationMessage = `${partnerName} plans to add a matching vehicle for your requirement "${requirement.title}". ${estimatedAvailability ? `Estimated availability: ${new Date(estimatedAvailability).toLocaleDateString()}.` : ''}`;
        } else {
            notificationMessage = `${partnerName} has responded to your requirement "${requirement.title}".`;
        }

        await createNotification(
            requirement.corporateId._id,
            "REQUIREMENT_RESPONSE",
            "New Response to Your Requirement",
            notificationMessage,
            requirement._id,
            "REQUIREMENT"
        );

        res.status(201).json({
            success: true,
            message: "Response submitted successfully",
            data: {
                requirementId: requirement._id,
                responseType,
                message,
            }
        });

    } catch (error) {
        console.error("Error responding to requirement:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to submit response"
        });
    }
};

// @desc    Get B2B Partner's responses to requirements
// @route   GET /api/requirements/my-responses
// @access  Private (B2B_PARTNER only)
export const getMyResponses = async (req, res) => {
    try {
        const partnerId = req.userId;

        const requirements = await Requirement.find({
            "partnerResponses.partnerId": partnerId,
            isDeleted: false
        })
            .populate('corporateId', 'companyName companyLogo')
            .select('title description routeInfo vehicleRequirements contractDetails partnerResponses status quotationDeadline')
            .sort({ 'partnerResponses.respondedAt': -1 });

        // Filter to only include the partner's own responses
        const responsesWithDetails = requirements.map(req => {
            const myResponse = req.partnerResponses.find(r => r.partnerId.toString() === partnerId);
            return {
                requirementId: req._id,
                title: req.title,
                description: req.description,
                corporateId: req.corporateId,
                routeInfo: req.routeInfo,
                vehicleRequirements: req.vehicleRequirements,
                contractDetails: req.contractDetails,
                status: req.status,
                quotationDeadline: req.quotationDeadline,
                myResponse,
            };
        });

        res.json({
            success: true,
            data: responsesWithDetails
        });

    } catch (error) {
        console.error("Error fetching my responses:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch responses"
        });
    }
};

// @desc    B2B Partner notifies Corporate that vehicle matching requirement is now available
// @route   POST /api/requirements/:id/notify-vehicle-added
// @access  Private (B2B_PARTNER only)
export const notifyVehicleAdded = async (req, res) => {
    try {
        const { id } = req.params;
        const partnerId = req.userId;
        const { vehicleId, message } = req.body;

        // Find the requirement
        const requirement = await Requirement.findById(id).populate('corporateId', 'companyName email fullName');

        if (!requirement || requirement.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        // Check if partner has a "WILL_ADD_VEHICLE" response
        const partnerResponse = requirement.partnerResponses?.find(
            r => r.partnerId.toString() === partnerId && r.responseType === "WILL_ADD_VEHICLE"
        );

        if (!partnerResponse) {
            return res.status(400).json({
                success: false,
                message: "You must have previously indicated you will add a vehicle for this requirement"
            });
        }

        if (partnerResponse.vehicleAddedNotified) {
            return res.status(400).json({
                success: false,
                message: "You have already notified the corporate about this vehicle"
            });
        }

        // Get B2B partner info
        const partner = await User.findById(partnerId).select('fullName companyName businessName email');
        const partnerName = partner?.companyName || partner?.businessName || partner?.fullName || 'B2B Partner';

        // Get vehicle info if provided
        let vehicleInfo = "";
        if (vehicleId) {
            const vehicle = await Vehicle.findById(vehicleId).select('vehicleName vehicleCategory registrationNumber');
            if (vehicle) {
                vehicleInfo = `${vehicle.vehicleName} (${vehicle.vehicleCategory}) - ${vehicle.registrationNumber}`;
            }
        }

        // Update the response
        partnerResponse.vehicleAddedNotified = true;
        partnerResponse.linkedVehicleId = vehicleId || null;

        // Update status to IN_PROGRESS when a vehicle is added/notified
        if (requirement.status === "DRAFT" || requirement.status === "PUBLISHED") {
            requirement.status = "IN_PROGRESS";
        }
        
        await requirement.save();

        // Create notification for Corporate
        const notificationMessage = `Great news! ${partnerName} has added the vehicle you were looking for based on your requirement "${requirement.title}". ${vehicleInfo ? `Vehicle: ${vehicleInfo}.` : ''} You can now search for this vehicle and request a quotation.`;

        await createNotification(
            requirement.corporateId._id,
            "VEHICLE_ADDED_FOR_REQUIREMENT",
            "Vehicle Now Available for Your Requirement",
            notificationMessage,
            requirement._id,
            "REQUIREMENT"
        );

        // Send email notification to Corporate
        try {
            const corporateEmail = requirement.corporateId.email;
            const corporateName = requirement.corporateId.fullName || requirement.corporateId.companyName;

            if (corporateEmail) {
                const emailSubject = `Vehicle Now Available - ${requirement.title}`;
                const emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1e293b;">Vehicle Now Available!</h2>
                        <p>Dear ${corporateName},</p>
                        <p>${partnerName} has added a vehicle matching your requirement:</p>
                        <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin: 0 0 10px 0; color: #374151;">${requirement.title}</h3>
                            <p style="margin: 5px 0; color: #64748b;">Route: ${requirement.routeInfo?.fromLocation} to ${requirement.routeInfo?.toLocation}</p>
                            ${vehicleInfo ? `<p style="margin: 5px 0; color: #374151;"><strong>Vehicle:</strong> ${vehicleInfo}</p>` : ''}
                        </div>
                        ${message ? `<p><strong>Message from ${partnerName}:</strong> ${message}</p>` : ''}
                        <p>You can now search for this vehicle on the platform and request a quotation from ${partnerName}.</p>
                        <a href="${process.env.FRONTEND_URL.split(",")[0]}/corporate-profile?tab=requirement-management" || 'http://localhost:5173'}/corporate-profile?tab=requirement-management" 
                           style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
                            View Requirements
                        </a>
                        <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
                            Best regards,<br>
                            DriveMe Go Team
                        </p>
                    </div>
                `;
                await sendEmail(corporateEmail, emailSubject, emailBody);
            }
        } catch (emailError) {
            console.error("Error sending email notification:", emailError);
            // Don't fail the request if email fails
        }

        res.json({
            success: true,
            message: "Corporate has been notified that the vehicle is now available",
            data: {
                requirementId: requirement._id,
                notifiedAt: new Date(),
            }
        });

    } catch (error) {
        console.error("Error notifying vehicle added:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to notify corporate"
        });
    }
};

// @desc    Get responses for a requirement (Corporate view)
// @route   GET /api/requirements/:id/responses
// @access  Private (CORPORATE only)
export const getRequirementResponses = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateId = req.userId;

        const requirement = await Requirement.findOne({
            _id: id,
            corporateId,
            isDeleted: false
        }).populate('partnerResponses.partnerId', 'fullName companyName businessName companyLogo email whatsappNumber');

        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: "Requirement not found"
            });
        }

        res.json({
            success: true,
            data: {
                requirementId: id,
                requirementTitle: requirement.title,
                totalResponses: requirement.partnerResponses?.length || 0,
                responses: requirement.partnerResponses || []
            }
        });

    } catch (error) {
        console.error("Error fetching requirement responses:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch responses"
        });
    }
};
