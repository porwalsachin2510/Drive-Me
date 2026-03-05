import mongoose from "mongoose";
import Requirement from "../models/Requirement.js";
import Quotation from "../models/Quotation.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const createNotification = async (userId, type, title, message, relatedEntityId, relatedEntityType) => {
    try {
        await Notification.create({ userId, type, title, message, relatedEntityId, relatedEntityType });
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
        const requirementData = {
            ...req.body,
            corporateId,
            createdBy: corporateId,
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
        
        // Build query for open requirements - PUBLIC (PUBLISHED or DRAFT) + INVITE_ONLY where partner is invited
        let query = {
            status: { $in: ["PUBLISHED", "DRAFT", "OPEN"] },
            $or: [
                { visibility: "PUBLIC" },
                { visibility: { $exists: false } },
                { visibility: null },
                { visibility: "INVITE_ONLY", invitedPartners: partnerId }
            ],
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
        if (userRole === "CORPORATE" && requirement.corporateId._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        if (userRole === "B2B_PARTNER" && requirement.visibility !== "PUBLIC") {
            return res.status(403).json({
                success: false,
                message: "This requirement is not publicly visible"
            });
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
