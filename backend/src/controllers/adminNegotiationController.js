import AdminNegotiation from "../models/AdminNegotiation.js"
import Quotation from "../models/Quotation.js"
import User from "../models/User.js"
import CommissionSettings from "../models/CommissionSettings.js"
import { calculateNegotiationCommission, resolveNegotiationCommissionRate, DEFAULT_NEGOTIATION_COMMISSION_RATE } from "../Services/HelperUtilities.js"
import { sendNegotiationRequestEmail, sendNegotiationUpdateEmail } from "../Services/emailService.js"
import { createNotification, sendAdminNotification, sendRealTimeNotification } from "../Services/notificationService.js"

/**
 * Corporate requests admin to negotiate on their behalf
 * POST /api/quotations/:quotationId/request-negotiation
 */
export const requestNegotiation = async (req, res) => {
    try {
        const { quotationId } = req.params
        const { message, expectedPrice } = req.body
        const corporateId = req.userId

        // Verify quotation exists and belongs to the corporate user
        const quotation = await Quotation.findById(quotationId)
            .populate("corporateOwnerId", "fullName email companyName")
            .populate("fleetOwnerId", "fullName email companyName")

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found",
            })
        }

        if (quotation.corporateOwnerId._id.toString() !== corporateId) {
            return res.status(403).json({
                success: false,
                message: "You can only request negotiation for your own quotations",
            })
        }

        // Check if quotation has a price (must be QUOTED status)
        if (quotation.status !== "QUOTED") {
            return res.status(400).json({
                success: false,
                message: "Negotiation can only be requested for quoted quotations",
            })
        }

        // Check if negotiation already exists for this quotation
        if (quotation.adminNegotiation?.requested && quotation.adminNegotiation?.status !== "FAILED" && quotation.adminNegotiation?.status !== "CANCELLED") {
            return res.status(400).json({
                success: false,
                message: "A negotiation request already exists for this quotation",
            })
        }

        const originalPrice = quotation.quotedPrice?.totalAmount

        if (!originalPrice) {
            return res.status(400).json({
                success: false,
                message: "Quotation does not have a price set",
            })
        }

        // Resolve the Corporate user's effective negotiation commission rate now,
        // so the negotiation is seeded with the rate Admin actually configured
        // (active custom NEGOTIATION rule -> configured rate -> default).
        const { rate: seededCommissionRate } = await resolveNegotiationCommissionRate(corporateId)

        // Create negotiation
        const negotiation = new AdminNegotiation({
            quotationId,
            corporateId,
            b2bPartnerId: quotation.fleetOwnerId._id,
            originalPrice,
            currency: quotation.quotedPrice?.currency || "AED",
            corporateRequest: {
                requestedAt: new Date(),
                message,
                expectedPrice,
            },
            adminCommissionFromCorporate: {
                rate: seededCommissionRate,
                amount: 0,
                status: "PENDING",
            },
            status: "REQUESTED",
        })

        await negotiation.save()

        // Update quotation with negotiation reference
        quotation.adminNegotiation = {
            requested: true,
            negotiationId: negotiation._id,
            status: "REQUESTED",
            originalPrice,
            priceReduced: false,
        }
        await quotation.save()

        // Send email notifications
        try {
            // Notify admin
            await sendNegotiationRequestEmail({
                negotiation,
                quotation,
                corporate: quotation.corporateOwnerId,
                b2bPartner: quotation.fleetOwnerId,
            })
        } catch (emailError) {
            console.error("Failed to send negotiation request email:", emailError)
        }

        // Send real-time notification to Admin
        const corporateName = quotation.corporateOwnerId?.companyName || quotation.corporateOwnerId?.fullName || 'Corporate';
        const fleetName = quotation.fleetOwnerId?.companyName || quotation.fleetOwnerId?.fullName || 'B2B Partner';

        await sendAdminNotification(
            "New Negotiation Request",
            `${corporateName} has requested price negotiation for quotation with ${fleetName}. Original Price: ${quotation.quotedPrice?.currency || 'AED'} ${originalPrice}. Expected Price: ${quotation.quotedPrice?.currency || 'AED'} ${expectedPrice || 'Not specified'}.`,
            "NEGOTIATION_REQUEST",
            {
                negotiationId: negotiation._id,
                quotationId: quotationId,
                corporateId: corporateId,
                b2bPartnerId: quotation.fleetOwnerId._id,
                originalPrice,
                expectedPrice,
                message
            }
        );

        console.log("[v0] Real-time notification sent to admin for negotiation request:", negotiation._id);

        res.status(201).json({
            success: true,
            message: "Negotiation request submitted. Admin will contact the B2B Partner on your behalf.",
            negotiation,
        })
    } catch (error) {
        console.error("Error requesting negotiation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to submit negotiation request",
            error: error.message,
        })
    }
}

/**
 * Get all negotiations (Admin)
 * GET /api/admin/negotiations
 */
export const getAllNegotiations = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query

        const query = {}
        if (status) {
            query.status = status
        }

        const negotiations = await AdminNegotiation.find(query)
            .populate("quotationId", "quotationNumber quotedPrice vehicles rentalPeriod status")
            .populate("corporateId", "fullName email companyName")
            .populate("b2bPartnerId", "fullName email companyName")
            .populate("adminActions.adminId", "fullName email")
            .populate("completedBy", "fullName email")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        const total = await AdminNegotiation.countDocuments(query)

        // Get stats
        const stats = {
            total: await AdminNegotiation.countDocuments(),
            requested: await AdminNegotiation.countDocuments({ status: "REQUESTED" }),
            inProgress: await AdminNegotiation.countDocuments({ status: "IN_PROGRESS" }),
            completed: await AdminNegotiation.countDocuments({ status: "COMPLETED" }),
            failed: await AdminNegotiation.countDocuments({ status: "FAILED" }),
            cancelled: await AdminNegotiation.countDocuments({ status: "CANCELLED" }),
        }

        res.json({
            success: true,
            negotiations,
            stats: {
                total: await AdminNegotiation.countDocuments(),
                requested: await AdminNegotiation.countDocuments({ status: "REQUESTED" }),
                inProgress: await AdminNegotiation.countDocuments({ status: "IN_PROGRESS" }),
                completed: await AdminNegotiation.countDocuments({ status: "COMPLETED" }),
                failed: await AdminNegotiation.countDocuments({ status: "FAILED" }),
                cancelled: await AdminNegotiation.countDocuments({ status: "CANCELLED" }),
            },
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error("Error getting negotiations:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get negotiations",
            error: error.message,
        })
    }
}

/**
 * Get negotiation details (Admin)
 * GET /api/admin/negotiations/:negotiationId
 */
export const getNegotiationDetails = async (req, res) => {
    try {
        const { negotiationId } = req.params

        const negotiation = await AdminNegotiation.findById(negotiationId)
            .populate("quotationId")
            .populate("corporateId", "fullName email companyName whatsappNumber")
            .populate("b2bPartnerId", "fullName email companyName whatsappNumber")
            .populate("adminActions.adminId", "fullName email")
            .populate("completedBy", "fullName email")
            .populate("cancelledBy", "fullName email")
            .populate("notes.createdBy", "fullName email")

        if (!negotiation) {
            return res.status(404).json({
                success: false,
                message: "Negotiation not found",
            })
        }

        // Populate quotation details
        if (negotiation.quotationId) {
            await negotiation.quotationId.populate("vehicles.vehicleId")
        }

        // Resolve the Corporate user's effective negotiation commission rate
        // (active custom NEGOTIATION rule first, then their configured rate, then default).
        // This is what the completion form should pre-fill — NOT the static default.
        const { rate: effectiveCommissionRate, source: commissionRateSource } =
            await resolveNegotiationCommissionRate(negotiation.corporateId?._id || negotiation.corporateId)

        res.json({
            success: true,
            negotiation,
            effectiveCommissionRate,
            commissionRateSource,
        })
    } catch (error) {
        console.error("Error getting negotiation details:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get negotiation details",
            error: error.message,
        })
    }
}

/**
 * Admin takes action on negotiation (start, send offer, message)
 * POST /api/admin/negotiations/:negotiationId/action
 */
export const adminNegotiationAction = async (req, res) => {
    try {
        const { negotiationId } = req.params
        const { action, message, proposedPrice } = req.body
        const adminId = req.userId

        const negotiation = await AdminNegotiation.findById(negotiationId)
            .populate("corporateId", "fullName email")
            .populate("b2bPartnerId", "fullName email")

        if (!negotiation) {
            return res.status(404).json({
                success: false,
                message: "Negotiation not found",
            })
        }

        // Validate action
        const validActions = ["STARTED", "SENT_OFFER", "SENT_MESSAGE"]
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                message: `Invalid action. Must be one of: ${validActions.join(", ")}`,
            })
        }

        // Update status based on action
        if (action === "STARTED" && negotiation.status === "REQUESTED") {
            negotiation.status = "IN_PROGRESS"
        }

        // Add action to history
        negotiation.adminActions.push({
            action,
            message,
            proposedPrice,
            timestamp: new Date(),
            adminId,
        })

        await negotiation.save()

        // Update quotation status
        const quotation = await Quotation.findById(negotiation.quotationId)
        if (quotation) {
            quotation.adminNegotiation.status = negotiation.status
            await quotation.save()
        }

        // Send notification to B2B Partner
        try {
            await sendNegotiationUpdateEmail({
                negotiation,
                recipient: negotiation.b2bPartnerId,
                recipientType: "B2B_PARTNER",
                action,
                message,
                proposedPrice,
            })
        } catch (emailError) {
            console.error("Failed to send negotiation update email:", emailError)
        }

        // Send real-time notification to B2B Partner
        const corporateName = negotiation.corporateId?.companyName || negotiation.corporateId?.fullName || 'Corporate';
        let notificationTitle = "Negotiation Update";
        let notificationMessage = message || "Admin has sent you an update regarding the negotiation.";
        let notificationType = "NEGOTIATION_UPDATE";

        if (action === "SENT_OFFER") {
            notificationTitle = "New Price Offer Received";
            notificationMessage = `Admin has sent you a price offer of ${negotiation.currency || 'AED'} ${proposedPrice} for ${corporateName}'s quotation. Please review and respond.`;
            notificationType = "NEGOTIATION_OFFER";
        } else if (action === "STARTED") {
            notificationTitle = "Negotiation Started";
            notificationMessage = `Admin has started negotiation on behalf of ${corporateName}. ${message || ''}`;
            notificationType = "NEGOTIATION_STARTED";
        } else if (action === "SENT_MESSAGE") {
            notificationTitle = "New Message from Admin";
            notificationMessage = message || "Admin has sent you a message regarding the negotiation.";
            notificationType = "NEGOTIATION_MESSAGE";
        }

        await createNotification({
            userId: negotiation.b2bPartnerId._id,
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            data: {
                negotiationId: negotiation._id,
                quotationId: negotiation.quotationId,
                action,
                proposedPrice,
                corporateName
            }
        });

        console.log("[v0] Real-time notification sent to B2B Partner for negotiation action:", action);

        const updatedNegotiation = await AdminNegotiation.findById(negotiationId)
            .populate("corporateId", "fullName email companyName")
            .populate("b2bPartnerId", "fullName email companyName")
            .populate("adminActions.adminId", "fullName email")

        res.json({
            success: true,
            message: "Action recorded successfully",
            data: updatedNegotiation,
        })
    } catch (error) {
        console.error("Error recording admin action:", error)
        res.status(500).json({
            success: false,
            message: "Failed to record action",
            error: error.message,
        })
    }
}

/**
 * B2B Partner responds to negotiation
 * POST /api/negotiations/:negotiationId/b2b-response
 */
export const b2bPartnerResponse = async (req, res) => {
    try {
        const { negotiationId } = req.params
        const { response, counterPrice, message } = req.body
        const b2bPartnerId = req.userId

        const negotiation = await AdminNegotiation.findById(negotiationId)
            .populate("corporateId", "fullName email")
            .populate("b2bPartnerId", "fullName email")

        if (!negotiation) {
            return res.status(404).json({
                success: false,
                message: "Negotiation not found",
            })
        }

        // Verify B2B Partner owns this negotiation
        if (negotiation.b2bPartnerId._id.toString() !== b2bPartnerId) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to respond to this negotiation",
            })
        }

        // Validate response
        const validResponses = ["ACCEPTED", "REJECTED", "COUNTER_OFFERED"]
        if (!validResponses.includes(response)) {
            return res.status(400).json({
                success: false,
                message: `Invalid response. Must be one of: ${validResponses.join(", ")}`,
            })
        }

        // Get the last proposed price from admin actions
        const getLastProposedPrice = () => {
            if (!negotiation.adminActions || negotiation.adminActions.length === 0) {
                return negotiation.originalPrice
            }
            // Find the last admin action with a proposed price
            for (let i = negotiation.adminActions.length - 1; i >= 0; i--) {
                if (negotiation.adminActions[i].proposedPrice) {
                    return negotiation.adminActions[i].proposedPrice
                }
            }
            return negotiation.originalPrice
        }

        const lastProposedPrice = getLastProposedPrice()

        // Add response to history
        negotiation.b2bPartnerResponses.push({
            response,
            counterPrice: counterPrice || (response === "ACCEPTED" ? lastProposedPrice : undefined),
            message,
            timestamp: new Date(),
        })

        // If accepted, update negotiated price with the last admin proposed price
        if (response === "ACCEPTED") {
            negotiation.negotiatedPrice = lastProposedPrice
        } else if (response === "COUNTER_OFFERED" && counterPrice) {
            // Store counter offer for admin to review
            negotiation.negotiatedPrice = counterPrice
        }

        await negotiation.save()

        // Send real-time notification to Admin about B2B Partner's response
        const b2bPartnerName = negotiation.b2bPartnerId?.companyName || negotiation.b2bPartnerId?.fullName || 'B2B Partner';
        const corporateName = negotiation.corporateId?.companyName || negotiation.corporateId?.fullName || 'Corporate';

        let adminNotificationTitle = "B2B Partner Response";
        let adminNotificationMessage = "";
        let adminNotificationType = "NEGOTIATION_RESPONSE";

        if (response === "ACCEPTED") {
            adminNotificationTitle = "Negotiation Offer Accepted";
            adminNotificationMessage = `${b2bPartnerName} has ACCEPTED the price offer of ${negotiation.currency || 'AED'} ${lastProposedPrice} for ${corporateName}'s quotation. ${message || ''}`;
            adminNotificationType = "NEGOTIATION_ACCEPTED";
        } else if (response === "REJECTED") {
            adminNotificationTitle = "Negotiation Offer Rejected";
            adminNotificationMessage = `${b2bPartnerName} has REJECTED the negotiation offer for ${corporateName}'s quotation. ${message || ''}`;
            adminNotificationType = "NEGOTIATION_REJECTED";
        } else if (response === "COUNTER_OFFERED") {
            adminNotificationTitle = "Counter Offer Received";
            adminNotificationMessage = `${b2bPartnerName} has sent a counter offer of ${negotiation.currency || 'AED'} ${counterPrice} for ${corporateName}'s quotation. ${message || ''}`;
            adminNotificationType = "NEGOTIATION_COUNTER_OFFER";
        }

        await sendAdminNotification(
            adminNotificationTitle,
            adminNotificationMessage,
            adminNotificationType,
            {
                negotiationId: negotiation._id,
                quotationId: negotiation.quotationId,
                b2bPartnerId: negotiation.b2bPartnerId._id,
                corporateId: negotiation.corporateId._id,
                response,
                counterPrice,
                lastProposedPrice,
                message
            }
        );

        console.log("[v0] Real-time notification sent to Admin for B2B Partner response:", response);

        res.json({
            success: true,
            message: "Response recorded successfully",
            data: negotiation,
        })
    } catch (error) {
        console.error("Error recording B2B response:", error)
        res.status(500).json({
            success: false,
            message: "Failed to record response",
            error: error.message,
        })
    }
}

/**
 * Admin completes negotiation and updates quotation price
 * POST /api/admin/negotiations/:negotiationId/complete
 */
export const completeNegotiation = async (req, res) => {
    try {
        const { negotiationId } = req.params
        const { finalPrice, corporateCommissionRate } = req.body
        const adminId = req.userId

        const negotiation = await AdminNegotiation.findById(negotiationId)
            .populate("corporateId", "fullName email")
            .populate("b2bPartnerId", "fullName email")

        if (!negotiation) {
            return res.status(404).json({
                success: false,
                message: "Negotiation not found",
            })
        }

        if (negotiation.status === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "This negotiation is already completed",
            })
        }

        if (!finalPrice || finalPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: "Final negotiated price is required",
            })
        }

        // Calculate savings
        const priceSaved = negotiation.originalPrice - finalPrice

        if (priceSaved < 0) {
            return res.status(400).json({
                success: false,
                message: "Final price cannot be higher than original price",
            })
        }

        // Calculate commission from savings - use dynamic rate from CommissionSettings
        // Priority:
        //   1. Explicit rate passed in the request body (Admin can override/rewrite it)
        //   2. The Corporate user's effective configured rate (active custom NEGOTIATION
        //      rule first, then their configured negotiationCommissionRate)
        //   3. The rate already stored on this negotiation
        //   4. System default (25%)
        let commissionRate = DEFAULT_NEGOTIATION_COMMISSION_RATE
        let commissionRateSource = "default"

        if (corporateCommissionRate !== undefined && corporateCommissionRate !== null && corporateCommissionRate !== "") {
            commissionRate = Number(corporateCommissionRate)
            commissionRateSource = "admin_override"
        } else {
            // NOTE: the negotiation's Corporate user field is `corporateId` (not corporateOwnerId)
            const resolved = await resolveNegotiationCommissionRate(negotiation.corporateId?._id || negotiation.corporateId)
            if (resolved.source !== "default") {
                commissionRate = resolved.rate
                commissionRateSource = resolved.source
            } else if (negotiation.adminCommissionFromCorporate?.rate) {
                commissionRate = negotiation.adminCommissionFromCorporate.rate
                commissionRateSource = "stored"
            } else {
                commissionRate = resolved.rate
                commissionRateSource = resolved.source
            }
        }

        // Clamp to a valid 0-100 range
        if (Number.isNaN(commissionRate) || commissionRate < 0) commissionRate = 0
        if (commissionRate > 100) commissionRate = 100

        console.log("[v0] Negotiation Commission Rate:", commissionRate, "% (source:", commissionRateSource + ")")
        const commissionAmount = (priceSaved * commissionRate) / 100

        // Update negotiation
        negotiation.negotiatedPrice = finalPrice
        negotiation.priceSaved = priceSaved
        negotiation.adminCommissionFromCorporate.rate = commissionRate
        negotiation.adminCommissionFromCorporate.amount = commissionAmount
        negotiation.adminCommissionFromCorporate.status = "PENDING"
        negotiation.status = "COMPLETED"
        negotiation.completedAt = new Date()
        negotiation.completedBy = adminId

        negotiation.adminActions.push({
            action: "COMPLETED",
            message: `Negotiation completed. Price reduced from ${negotiation.originalPrice} to ${finalPrice}. Savings: ${priceSaved}. Admin commission: ${commissionAmount}`,
            proposedPrice: finalPrice,
            timestamp: new Date(),
            adminId,
        })

        await negotiation.save()

        // UPDATE QUOTATION PRICE - This is the key step!
        const quotation = await Quotation.findById(negotiation.quotationId)
        if (quotation) {
            // Calculate reduction ratio
            const reductionRatio = finalPrice / negotiation.originalPrice

            // Update quotation with new negotiated price and proportionally reduced breakdown
            quotation.quotedPrice.totalAmount = finalPrice

            // Proportionally reduce breakdown items
            if (quotation.quotedPrice.breakdown) {
                quotation.quotedPrice.breakdown.vehicleRental = Math.round(
                    (quotation.quotedPrice.breakdown.vehicleRental || 0) * reductionRatio
                )
                quotation.quotedPrice.breakdown.driverCharges = Math.round(
                    (quotation.quotedPrice.breakdown.driverCharges || 0) * reductionRatio
                )
                quotation.quotedPrice.breakdown.fuelCharges = Math.round(
                    (quotation.quotedPrice.breakdown.fuelCharges || 0) * reductionRatio
                )
            }

            // Update per-vehicle breakdown if exists
            if (quotation.quotedPrice.perVehicleBreakdown && quotation.quotedPrice.perVehicleBreakdown.length > 0) {
                quotation.quotedPrice.perVehicleBreakdown.forEach((vehicleBreakdown) => {
                    vehicleBreakdown.baseRental = Math.round((vehicleBreakdown.baseRental || 0) * reductionRatio)
                    vehicleBreakdown.driverCharges = Math.round((vehicleBreakdown.driverCharges || 0) * reductionRatio)
                    vehicleBreakdown.fuelCharges = Math.round((vehicleBreakdown.fuelCharges || 0) * reductionRatio)
                    vehicleBreakdown.totalAmount = Math.round((vehicleBreakdown.totalAmount || 0) * reductionRatio)
                })
            }

            // Update negotiation status in quotation
            // IMPORTANT: Set the negotiationId so contract can reference it later
            quotation.adminNegotiation.negotiationId = negotiation._id
            quotation.adminNegotiation.status = "COMPLETED"
            quotation.adminNegotiation.priceReduced = true
            quotation.adminNegotiation.savingsAmount = priceSaved
            quotation.adminNegotiation.originalPrice = negotiation.originalPrice
            quotation.adminNegotiation.adminCommission = commissionAmount
            quotation.adminNegotiation.adminCommissionRate = commissionRate

            await quotation.save()
        }

        // Send notifications
        try {
            // Notify Corporate that negotiation is complete
            await sendNegotiationUpdateEmail({
                negotiation,
                recipient: negotiation.corporateId,
                recipientType: "CORPORATE",
                action: "COMPLETED",
                message: `Great news! We've successfully negotiated a better price for you. Original: ${negotiation.currency} ${negotiation.originalPrice}, New Price: ${negotiation.currency} ${finalPrice}. You save ${negotiation.currency} ${priceSaved}!`,
                proposedPrice: finalPrice,
            })

            // Notify B2B Partner
            await sendNegotiationUpdateEmail({
                negotiation,
                recipient: negotiation.b2bPartnerId,
                recipientType: "B2B_PARTNER",
                action: "COMPLETED",
                message: `The negotiation has been finalized. The quotation price has been updated to ${negotiation.currency} ${finalPrice}.`,
                proposedPrice: finalPrice,
            })
        } catch (emailError) {
            console.error("Failed to send completion emails:", emailError)
        }

        // Send real-time notifications to both Corporate and B2B Partner
        const corporateName = negotiation.corporateId?.companyName || negotiation.corporateId?.fullName || 'Corporate';
        const b2bPartnerName = negotiation.b2bPartnerId?.companyName || negotiation.b2bPartnerId?.fullName || 'B2B Partner';
        const currency = negotiation.currency || 'AED';

        // Notify Corporate User
        await createNotification({
            userId: negotiation.corporateId._id,
            type: "NEGOTIATION_COMPLETED",
            title: "Negotiation Completed - Price Reduced!",
            message: `Great news! Admin has successfully negotiated a better price for you. Original: ${currency} ${negotiation.originalPrice}, New Price: ${currency} ${finalPrice}. You save ${currency} ${priceSaved}! Quotation price has been updated.`,
            data: {
                negotiationId: negotiation._id,
                quotationId: negotiation.quotationId,
                originalPrice: negotiation.originalPrice,
                finalPrice,
                priceSaved,
                commissionAmount,
                currency
            }
        });

        // Notify B2B Partner
        await createNotification({
            userId: negotiation.b2bPartnerId._id,
            type: "NEGOTIATION_COMPLETED",
            title: "Negotiation Finalized",
            message: `The negotiation for ${corporateName}'s quotation has been finalized. Final price: ${currency} ${finalPrice}. Quotation has been updated.`,
            data: {
                negotiationId: negotiation._id,
                quotationId: negotiation.quotationId,
                originalPrice: negotiation.originalPrice,
                finalPrice,
                corporateName,
                currency
            }
        });

        console.log("[v0] Real-time notifications sent to Corporate and B2B Partner for negotiation completion");

        res.json({
            success: true,
            message: "Negotiation completed successfully. Quotation price has been updated.",
            data: {
                negotiation,
                summary: {
                    originalPrice: negotiation.originalPrice,
                    finalPrice,
                    priceSaved,
                    adminCommissionRate: commissionRate,
                    adminCommission: commissionAmount,
                    corporateSavings: priceSaved - commissionAmount,
                },
            },
        })
    } catch (error) {
        console.error("Error completing negotiation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to complete negotiation",
            error: error.message,
        })
    }
}

/**
 * Cancel negotiation
 * POST /api/negotiations/:negotiationId/cancel
 */
export const cancelNegotiation = async (req, res) => {
    try {
        const { negotiationId } = req.params
        const { reason } = req.body
        const userId = req.userId

        const negotiation = await AdminNegotiation.findById(negotiationId)
            .populate("corporateId", "fullName email")
            .populate("b2bPartnerId", "fullName email")

        if (!negotiation) {
            return res.status(404).json({
                success: false,
                message: "Negotiation not found",
            })
        }

        // Allow admin or corporate to cancel
        const user = await User.findById(userId)
        const isAdmin = user.role === "ADMIN"
        const isCorporate = negotiation.corporateId._id.toString() === userId

        if (!isAdmin && !isCorporate) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to cancel this negotiation",
            })
        }

        if (negotiation.status === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel a completed negotiation",
            })
        }

        negotiation.status = "CANCELLED"
        negotiation.cancelledAt = new Date()
        negotiation.cancelledBy = userId
        negotiation.cancellationReason = reason

        await negotiation.save()

        // Update quotation
        const quotation = await Quotation.findById(negotiation.quotationId)
        if (quotation) {
            quotation.adminNegotiation.status = "CANCELLED"
            await quotation.save()
        }

        // Notify parties
        try {
            await sendNegotiationUpdateEmail({
                negotiation,
                recipient: negotiation.corporateId,
                recipientType: "CORPORATE",
                action: "CANCELLED",
                message: `The negotiation has been cancelled. ${reason ? `Reason: ${reason}` : ""} You can still accept the original quotation if you wish.`,
            })
        } catch (emailError) {
            console.error("Failed to send cancellation email:", emailError)
        }

        res.json({
            success: true,
            message: "Negotiation cancelled successfully",
            data: negotiation,
        })
    } catch (error) {
        console.error("Error cancelling negotiation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to cancel negotiation",
            error: error.message,
        })
    }
}

/**
 * Mark negotiation as failed
 * POST /api/admin/negotiations/:negotiationId/fail
 */
export const failNegotiation = async (req, res) => {
    try {
        const { negotiationId } = req.params
        const { reason } = req.body
        const adminId = req.userId

        const negotiation = await AdminNegotiation.findById(negotiationId)
            .populate("corporateId", "fullName email")
            .populate("b2bPartnerId", "fullName email")

        if (!negotiation) {
            return res.status(404).json({
                success: false,
                message: "Negotiation not found",
            })
        }

        negotiation.status = "FAILED"
        negotiation.failureReason = reason

        negotiation.adminActions.push({
            action: "CANCELLED",
            message: `Negotiation failed. Reason: ${reason}`,
            timestamp: new Date(),
            adminId,
        })

        await negotiation.save()

        // Update quotation
        const quotation = await Quotation.findById(negotiation.quotationId)
        if (quotation) {
            quotation.adminNegotiation.status = "FAILED"
            await quotation.save()
        }

        // Notify Corporate
        try {
            await sendNegotiationUpdateEmail({
                negotiation,
                recipient: negotiation.corporateId,
                recipientType: "CORPORATE",
                action: "FAILED",
                message: `Unfortunately, we were unable to negotiate a better price. ${reason ? `Reason: ${reason}` : ""} You can still accept the original quotation.`,
            })
        } catch (emailError) {
            console.error("Failed to send failure email:", emailError)
        }

        res.json({
            success: true,
            message: "Negotiation marked as failed",
            data: negotiation,
        })
    } catch (error) {
        console.error("Error failing negotiation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to mark negotiation as failed",
            error: error.message,
        })
    }
}

/**
 * Add note to negotiation
 * POST /api/admin/negotiations/:negotiationId/notes
 */
export const addNegotiationNote = async (req, res) => {
    try {
        const { negotiationId } = req.params
        const { message, isInternal } = req.body
        const userId = req.userId

        const negotiation = await AdminNegotiation.findById(negotiationId)

        if (!negotiation) {
            return res.status(404).json({
                success: false,
                message: "Negotiation not found",
            })
        }

        negotiation.notes.push({
            message,
            createdBy: userId,
            createdAt: new Date(),
            isInternal: isInternal || false,
        })

        await negotiation.save()

        const updatedNegotiation = await AdminNegotiation.findById(negotiationId)
            .populate("notes.createdBy", "fullName email")

        res.json({
            success: true,
            message: "Note added successfully",
            data: updatedNegotiation,
        })
    } catch (error) {
        console.error("Error adding note:", error)
        res.status(500).json({
            success: false,
            message: "Failed to add note",
            error: error.message,
        })
    }
}

/**
 * Get negotiations for Corporate user
 * GET /api/my-negotiations
 */
export const getMyNegotiations = async (req, res) => {
    try {
        const userId = req.userId
        const { status, page = 1, limit = 20 } = req.query

        const query = { corporateId: userId }
        if (status) {
            query.status = status
        }

        const negotiations = await AdminNegotiation.find(query)
            .populate("quotationId", "quotationNumber quotedPrice status")
            .populate("b2bPartnerId", "fullName companyName")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        const total = await AdminNegotiation.countDocuments(query)

        res.json({
            success: true,
            data: {
                negotiations,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit),
                },
            },
        })
    } catch (error) {
        console.error("Error getting my negotiations:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get negotiations",
            error: error.message,
        })
    }
}

/**
 * Get negotiations for B2B Partner
 * GET /api/partner-negotiations
 */
export const getPartnerNegotiations = async (req, res) => {
    try {
        const userId = req.userId
        const { status, page = 1, limit = 20 } = req.query

        const query = { b2bPartnerId: userId }
        if (status) {
            query.status = status
        }

        const negotiations = await AdminNegotiation.find(query)
            .populate("quotationId", "quotationNumber quotedPrice status")
            .populate("corporateId", "fullName companyName")
            .populate("adminActions.adminId", "fullName")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        const total = await AdminNegotiation.countDocuments(query)

        res.json({
            success: true,
            data: {
                negotiations,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit),
                },
            },
        })
    } catch (error) {
        console.error("Error getting partner negotiations:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get negotiations",
            error: error.message,
        })
    }
}
