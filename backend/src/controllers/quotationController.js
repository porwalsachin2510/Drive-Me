import Quotation from "../models/Quotation.js"
import Notification from "../models/Notification.js"
import { createNotification as createNotificationService, sendAdminNotification, sendRealTimeNotification } from "../Services/notificationService.js"
import User from "../models/User.js"
import ManagedServiceBrief from "../models/ManagedServiceBrief.js"
import { deriveServiceMode } from "../utils/operationContext.js"

/**
 * Sanitize an incoming Managed Service Brief payload so we only persist the
 * fields the corporate is allowed to author at quotation-request time. Any
 * partner-side fulfilment/review state is stripped — items always start PENDING.
 */
const sanitizeManagedBrief = (raw = {}) => {
    const toStringArr = (v) =>
        Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : []

    const workLocations = Array.isArray(raw.workLocations)
        ? raw.workLocations
            .filter((l) => l && String(l.name || "").trim())
            .map((l) => ({
                name: String(l.name).trim(),
                address: String(l.address || "").trim(),
                city: String(l.city || "").trim(),
                shifts: Array.isArray(l.shifts)
                    ? l.shifts.map((s) => ({
                        label: String(s.label || "").trim(),
                        loginTime: String(s.loginTime || "").trim(),
                        logoutTime: String(s.logoutTime || "").trim(),
                        workingDays: toStringArr(s.workingDays),
                    }))
                    : [],
            }))
        : []

    const routeRequests = Array.isArray(raw.routeRequests)
        ? raw.routeRequests
            .filter((r) => r && String(r.label || "").trim())
            .map((r) => ({
                label: String(r.label).trim(),
                fromArea: String(r.fromArea || "").trim(),
                toWorkLocation: String(r.toWorkLocation || "").trim(),
                direction: ["PICKUP", "DROP", "BOTH"].includes(r.direction)
                    ? r.direction
                    : "BOTH",
                stops: toStringArr(r.stops),
                operatingDays: toStringArr(r.operatingDays),
                pickupWindowStart: String(r.pickupWindowStart || "").trim(),
                pickupWindowEnd: String(r.pickupWindowEnd || "").trim(),
                headcount: Number(r.headcount) || 0,
                preferredVehicleType: String(r.preferredVehicleType || "").trim(),
                notes: String(r.notes || "").trim(),
                fulfillment: { status: "PENDING" },
            }))
        : []

    const employeeRoster = Array.isArray(raw.employeeRoster)
        ? raw.employeeRoster
            .filter((e) => e && String(e.name || "").trim())
            .map((e) => ({
                name: String(e.name).trim(),
                email: String(e.email || "").trim(),
                phone: String(e.phone || "").trim(),
                employeeCode: String(e.employeeCode || "").trim(),
                department: String(e.department || "").trim(),
                homeAddress: String(e.homeAddress || "").trim(),
                pickupArea: String(e.pickupArea || "").trim(),
                workLocation: String(e.workLocation || "").trim(),
                shiftLabel: String(e.shiftLabel || "").trim(),
                passMonths: Math.max(0, Number(e.passMonths) || 0),
                preferredRouteLabel: String(e.preferredRouteLabel || "").trim(),
                assignmentHint: String(e.assignmentHint || "").trim(),
                fulfillment: { status: "PENDING" },
            }))
        : []

    return {
        summary: String(raw.summary || "").trim(),
        serviceStartDate: raw.serviceStartDate || null,
        sla: {
            targetCompletionDate: raw.sla?.targetCompletionDate || null,
            fulfillmentSlaHours: Number(raw.sla?.fulfillmentSlaHours) > 0
                ? Number(raw.sla.fulfillmentSlaHours)
                : 72,
        },
        pointOfContact: {
            name: String(raw.pointOfContact?.name || "").trim(),
            phone: String(raw.pointOfContact?.phone || "").trim(),
            email: String(raw.pointOfContact?.email || "").trim(),
        },
        workLocations,
        routeRequests,
        employeeRoster,
    }
}

const createNotification = async (userId, type, title, message, relatedEntityId, relatedEntityType) => {
    try {
        await Notification.create({
            userId,
            type,
            title,
            message,
            relatedEntityId,
            relatedEntityType,
        })
    } catch (error) {
        console.error("Notification creation error:", error)
    }
}

// Helper to get user name
const getUserName = async (userId) => {
    try {
        const user = await User.findById(userId).select('fullName companyName');
        return user?.companyName || user?.fullName || 'User';
    } catch {
        return 'User';
    }
}

export const requestQuotation = async (req, res) => {
    try {
        const { fleetOwnerId, vehicles, rentalPeriod, requirements, validUntil } = req.body;

        if (
            !fleetOwnerId ||
            !vehicles ||
            !Array.isArray(vehicles) ||
            vehicles.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Fleet owner and at least one vehicle are required",
            })
        }

        if (!rentalPeriod || !rentalPeriod.startDate || !rentalPeriod.endDate || !rentalPeriod.durationType) {
            return res.status(400).json({
                success: false,
                message: "Complete rental period information is required",
            })
        }

        // Determine service mode. Prefer an explicit value from the client
        // (selected on the Service Selection screen), otherwise derive it from
        // the vehicles (any MANAGED_SERVICES vehicle => MANAGED).
        const requestedMode =
            typeof req.body.serviceMode === "string" ? req.body.serviceMode.toUpperCase() : null
        const serviceMode =
            requestedMode === "MANAGED" || requestedMode === "STANDARD"
                ? requestedMode
                : await deriveServiceMode(vehicles)

        // For MANAGED-service requests the corporate MUST hand the partner an
        // operations brief (work locations & shifts + the routes to operate)
        // BEFORE the partner prices anything. Without it the partner has no way
        // to know whether it can even serve those routes, so we refuse to create
        // the quotation until a valid brief is attached to the request.
        let cleanBrief = null
        if (serviceMode === "MANAGED") {
            cleanBrief = sanitizeManagedBrief(req.body.managedServiceBrief || {})

            if (cleanBrief.workLocations.length === 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Add at least one work location & shift to the service brief before requesting a managed-service quotation.",
                })
            }
            if (cleanBrief.routeRequests.length === 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Add at least one route / coverage request to the service brief so the partner knows which routes to operate before quoting.",
                })
            }
        }

        // Create quotation with the schema structure
        const quotation = await Quotation.create({
            corporateOwnerId: req.userId, // From auth middleware
            fleetOwnerId,
            vehicles, // Array of vehicle IDs
            serviceMode,
            rentalPeriod: {
                startDate: rentalPeriod.startDate,
                endDate: rentalPeriod.endDate,
                durationType: rentalPeriod.durationType,
                duration: rentalPeriod.duration,
            },
            requirements: {
                withDriver: requirements?.withDriver || false,
                fuelIncluded: requirements?.fuelIncluded || false,
            },
            validUntil: validUntil || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
            status: "REQUESTED",
        })

        // 🔹 total quantity calculate karo
        const totalQty = vehicles.reduce((sum, v) => sum + v.quantity, 0);

        // For MANAGED requests, persist the operations brief AGAINST this
        // quotation and mark it SUBMITTED immediately, so the partner sees the
        // required routes, work locations & shifts and employee roster the very
        // first time it opens the request — before it prices or agrees.
        let createdBrief = null
        if (serviceMode === "MANAGED" && cleanBrief) {
            createdBrief = await ManagedServiceBrief.create({
                quotationId: quotation._id,
                corporateOwnerId: req.userId,
                b2bPartnerId: fleetOwnerId,
                status: "SUBMITTED",
                submittedAt: new Date(),
                summary: cleanBrief.summary,
                serviceStartDate: cleanBrief.serviceStartDate,
                sla: cleanBrief.sla,
                pointOfContact: cleanBrief.pointOfContact,
                workLocations: cleanBrief.workLocations,
                routeRequests: cleanBrief.routeRequests,
                employeeRoster: cleanBrief.employeeRoster,
            })
        }

        // Managed requests get a brief-aware notification so the partner knows
        // to review the operational requirements before quoting.
        const briefSummaryText = createdBrief
            ? ` It includes an operations brief: ${createdBrief.routeRequests.length} route request(s), ${createdBrief.workLocations.length} work location(s) and ${createdBrief.employeeRoster.length} employee(s). Review it before you quote.`
            : ""

        // Create notification for fleet owner (B2B_PARTNER)
        await createNotification(
            fleetOwnerId,
            "QUOTATION_REQUEST",
            createdBrief ? "New Managed-Service Quotation Request" : "New Quotation Request",
            `You have received a new quotation request for ${totalQty} vehicle(s).${briefSummaryText}`,
            quotation._id,
            "QUOTATION",
        )

        // Send real-time notification to B2B Partner
        const corporateName = await getUserName(req.userId);
        const realTimeNotif = await createNotificationService({
            userId: fleetOwnerId,
            type: "QUOTATION_REQUEST",
            title: createdBrief ? "New Managed-Service Quotation Request" : "New Quotation Request",
            message: `${corporateName} has requested a quotation for ${totalQty} vehicle(s).${briefSummaryText} Please respond within 48 hours.`,
            metadata: {
                quotationId: quotation._id,
                corporateId: req.userId,
                corporateName,
                vehicleCount: totalQty,
                rentalPeriod: rentalPeriod,
                serviceMode,
                hasBrief: Boolean(createdBrief),
                briefId: createdBrief?._id || null,
            },
        })
        sendRealTimeNotification(fleetOwnerId.toString(), realTimeNotif)

        // Get fleet name for admin notification (corporateName already declared above)
        const fleetName = await getUserName(fleetOwnerId);

        // Send notification to ADMIN
        await sendAdminNotification(
            "New Quotation Request",
            `${corporateName} (CORPORATE) requested quotation for ${totalQty} vehicle(s) from ${fleetName} (B2B_PARTNER)`,
            "QUOTATION_REQUEST",
            { quotationId: quotation._id, corporateId: req.userId, fleetOwnerId, vehicleCount: totalQty }
        )

        // Populate the quotation with related data
        const populatedQuotation = await Quotation.findById(quotation._id)
            .populate("corporateOwnerId", "fullName companyName email whatsappNumber")
            .populate("fleetOwnerId", "fullName businessName email whatsappNumber")
            .populate("vehicles.vehicleId", "vehicleName vehicleCategory serviceType location capacity pricing photos")

        res.status(201).json({
            success: true,
            message: "Quotation request sent successfully",
            data: {
                quotation: populatedQuotation,
                quotationNumber: populatedQuotation.quotationNumber,
                briefId: createdBrief?._id || null,
            },
        })
    } catch (error) {
        console.error("Request quotation error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to request quotation",
        })
    }
}


// Get all quotations for a corporate owner
export const getCorporateOwnerQuotations = async (req, res) => {
    try {
        // req.userId is set by verifyToken middleware
        const corporateOwnerId = req.userId

        // Get filter parameters from query
        const { status, startDate, endDate, page = 1, limit = 10 } = req.query

        // Build filter object
        const filter = { corporateOwnerId }

        // Add status filter if provided
        if (status) {
            filter.status = status
        }

        // Add date range filter if provided
        if (startDate || endDate) {
            filter.requestedAt = {}
            if (startDate) {
                filter.requestedAt.$gte = new Date(startDate)
            }
            if (endDate) {
                filter.requestedAt.$lte = new Date(endDate)
            }
        }

        // Calculate pagination
        const skip = (page - 1) * limit

        // Fetch quotations with population
        const quotations = await Quotation.find(filter)
            .populate({
                path: "fleetOwnerId",
                select: "fullName email phone companyName",
            })
            .populate({
                path: "vehicles.vehicleId",
                select: "vehicleModel manufacturer year registrationNumber vehicleType seatingCapacity",
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))

        // Get total count for pagination
        const totalCount = await Quotation.countDocuments(filter)

        // Calculate summary statistics
        const summary = {
            total: totalCount,
            requested: await Quotation.countDocuments({
                corporateOwnerId,
                status: "REQUESTED"
            }),
            quoted: await Quotation.countDocuments({
                corporateOwnerId,
                status: "QUOTED"
            }),
            negotiating: await Quotation.countDocuments({
                corporateOwnerId,
                status: "NEGOTIATING"
            }),
            accepted: await Quotation.countDocuments({
                corporateOwnerId,
                status: "ACCEPTED"
            }),
            rejected: await Quotation.countDocuments({
                corporateOwnerId,
                status: "REJECTED"
            }),
            expired: await Quotation.countDocuments({
                corporateOwnerId,
                status: "EXPIRED"
            }),
        }

        return res.status(200).json({
            success: true,
            message: "Quotations fetched successfully",
            data: {
                quotations,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalItems: totalCount,
                    itemsPerPage: parseInt(limit),
                },
                summary,
            },
        })
    } catch (error) {
        console.error("Error fetching corporate owner quotations:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch quotations",
            error: error.message,
        })
    }
}

// Get single quotation by ID
// Get single quotation by ID with proper data transformation
// export const getCorporateOwnerQuotationById = async (req, res) => {
//     try {
//         const { quotationId } = req.params;
//         const corporateOwnerId = req.userId;

//         const quotation = await Quotation.findOne({
//             _id: quotationId,
//             corporateOwnerId,
//         })
//             .populate({
//                 path: "fleetOwnerId",
//                 select: "fullName email whatsappNumber companyName",
//             })
//             .populate({
//                 path: "vehicles.vehicleId",
//                 select: "vehicleName registrationNumber manufacturingYear vehicleCategory serviceType capacity location photos pricing kmLimits driverAvailability fuelOptions facilities",
//             })
//             .lean();

//         if (!quotation) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Quotation not found",
//             });
//         }

//         // Calculate total vehicles count
//         const totalVehicles = quotation.vehicles.reduce((sum, v) => sum + (v.quantity || 1), 0);

//         // Transform the data to match frontend expectations
//         const transformedQuotation = {
//             _id: quotation._id,
//             quotationNumber: quotation.quotationNumber,
//             status: quotation.status.toLowerCase(), // Convert REQUESTED -> requested for CSS
//             validUntil: quotation.validUntil,
//             responseMessage: quotation.responseMessage || null,

//             // Transform fleet owner data
//             fleetOwner: {
//                 companyName: quotation.fleetOwnerId?.companyName || quotation.fleetOwnerId?.fullName || "N/A",
//                 email: quotation.fleetOwnerId?.email || "N/A",
//                 phone: quotation.fleetOwnerId?.whatsappNumber || "N/A",
//                 profileImage: null, // Not available in current schema
//                 rating: 0, // Not available in current schema
//                 totalReviews: 0, // Not available in current schema
//             },

//             // Transform vehicles data - flatten quantities
//             vehicles: quotation.vehicles.flatMap(v => {
//                 const vehicleData = v.vehicleId;
//                 if (!vehicleData) return [];

//                 // Create an array of vehicles based on quantity
//                 return Array.from({ length: v.quantity || 1 }, () => ({
//                     brand: vehicleData.vehicleName?.split(' ')[0] || "Vehicle", // Extract first word as brand
//                     model: vehicleData.vehicleName || "Unknown Model",
//                     year: vehicleData.manufacturingYear,
//                     vehicleType: vehicleData.vehicleCategory,
//                     color: "N/A", // Not available in schema
//                     images: vehicleData.photos?.map(p => p.url) || [],
//                     seatingCapacity: vehicleData.capacity?.seatingCapacity,
//                     cargoCapacity: vehicleData.capacity?.cargoCapacity,
//                     registrationNumber: vehicleData.registrationNumber,
//                     location: vehicleData.location,
//                     facilities: vehicleData.facilities,
//                 }));
//             }),

//             // Transform pricing data
//             pricing: {
//                 basePrice: quotation.quotedPrice?.basePrice || 0,
//                 durationType: quotation.rentalPeriod?.durationType || "DAILY",
//                 duration: quotation.rentalPeriod?.duration || 1,
//                 driverCharges: quotation.quotedPrice?.driverCharges || 0,
//                 fuelIncluded: quotation.requirements?.fuelIncluded || false,
//                 fuelLimit: quotation.quotedPrice?.fuelLimit || 0,
//                 perKmRate: quotation.quotedPrice?.perKmRate || 0,
//                 discount: quotation.quotedPrice?.discount || 0,
//                 totalPrice: quotation.quotedPrice?.totalPrice || quotation.quotedPrice?.basePrice || 0,
//                 currency: quotation.quotedPrice?.currency || "AED",

//                 // Additional info from vehicles
//                 vehiclePricing: quotation.vehicles.map(v => ({
//                     vehicleName: v.vehicleId?.vehicleName,
//                     quantity: v.quantity,
//                     dailyRate: v.vehicleId?.pricing?.dailyRate,
//                     weeklyRate: v.vehicleId?.pricing?.weeklyRate,
//                     monthlyRate: v.vehicleId?.pricing?.monthlyRate,
//                     driverCharges: v.vehicleId?.pricing?.driverCharges,
//                     fuelCharges: v.vehicleId?.pricing?.fuelCharges,
//                 })),
//             },

//             // Rental period
//             rentalPeriod: {
//                 startDate: quotation.rentalPeriod?.startDate,
//                 endDate: quotation.rentalPeriod?.endDate,
//                 durationType: quotation.rentalPeriod?.durationType,
//                 duration: quotation.rentalPeriod?.duration,
//             },

//             // Requirements
//             requirements: {
//                 withDriver: quotation.requirements?.withDriver,
//                 fuelIncluded: quotation.requirements?.fuelIncluded,
//             },

//             // Additional metadata
//             totalVehicles,

//             // Timestamps
//             requestedAt: quotation.requestedAt,
//             createdAt: quotation.createdAt,
//             updatedAt: quotation.updatedAt,
//         };

//         return res.status(200).json({
//             success: true,
//             message: "Quotation fetched successfully",
//             data: transformedQuotation,
//         });
//     } catch (error) {
//         console.error("Error fetching quotation:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Failed to fetch quotation",
//             error: error.message,
//         });
//     }
// };

// @desc    Get quotation details for corporate owner (after fleet owner responds)
// @route   GET /api/quotations/corporate/:quotationId
// @access  Private (CORPORATE only)
export const getCorporateOwnerQuotationById = async (req, res) => {
    try {
        const { quotationId } = req.params
        const corporateOwnerId = req.userId

        const quotation = await Quotation.findOne({
            _id: quotationId,
            corporateOwnerId,
        })
            .populate({
                path: "fleetOwnerId",
                select: "fullName email companyName whatsappNumber acceptedPaymentMethods",
            })
            .populate({
                path: "vehicles.vehicleId",
                select:
                    "vehicleName vehicleCategory serviceType registrationNumber pricing capacity location photos documents manufacturingYear facilities",
            })


        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found",
            })
        }

        res.status(200).json({
            success: true,
            data: {
                quotation,
            },
        })
    } catch (error) {
        console.error("Error fetching quotation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch quotation details",
            error: error.message,
        })
    }
}


// @desc    Corporate owner accepts or rejects the quoted price
// @route   POST /api/quotations/corporate/:quotationId/decision
// @access  Private (CORPORATE only)
export const corporateDecisionOnQuotation = async (req, res) => {
    try {
        const { quotationId } = req.params
        const corporateOwnerId = req.userId
        const { decision, message } = req.body // decision: 'accept' or 'reject'

        // Validate required fields
        if (!decision || !["accept", "reject"].includes(decision)) {
            return res.status(400).json({
                success: false,
                message: "Invalid decision. Must be 'accept' or 'reject'",
            })
        }

        // Find the quotation
        const quotation = await Quotation.findOne({
            _id: quotationId,
            corporateOwnerId,
        })
            .populate({
                path: "fleetOwnerId",
                select: "fullName email whatsappNumber",
            })
            .populate({
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory",
            })

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found",
            })
        }

        // Check if quotation is in QUOTED status
        if (quotation.status !== "QUOTED") {
            return res.status(400).json({
                success: false,
                message: `Cannot make decision on quotation with status: ${quotation.status}`,
            })
        }

        // Check if quotation is expired
        if (quotation.validUntil && new Date() > new Date(quotation.validUntil)) {
            quotation.status = "EXPIRED"
            await quotation.save()
            return res.status(400).json({
                success: false,
                message: "This quotation has expired",
            })
        }

        // Update quotation status
        if (decision === "accept") {
            quotation.status = "ACCEPTED"
            quotation.acceptedAt = new Date()
            quotation.corporateResponseMessage = message || "Quotation accepted"
        } else {
            quotation.status = "REJECTED"
            quotation.rejectedAt = new Date()
            quotation.corporateResponseMessage = message || "Quotation rejected"
        }

        await quotation.save()

        // Get names for notifications
        const corporateName = await getUserName(corporateOwnerId);
        const fleetName = quotation.fleetOwnerId?.fullName || quotation.fleetOwnerId?.companyName || 'Fleet Owner';

        // Notify B2B_PARTNER about corporate's decision
        if (decision === "accept") {
            await createNotification(
                quotation.fleetOwnerId._id,
                "QUOTATION_ACCEPTED",
                "Quotation Accepted!",
                `${corporateName} has accepted your quotation for ${quotation.quotedPrice?.totalAmount || 'N/A'} ${quotation.quotedPrice?.currency || 'AED'}`,
                quotation._id,
                "QUOTATION"
            );


            // Send REAL-TIME notification to B2B Partner
            const acceptNotif = await createNotificationService({
                userId: quotation.fleetOwnerId._id,
                type: "QUOTATION_ACCEPTED",
                title: "Quotation Accepted!",
                message: `Great news! ${corporateName} has accepted your quotation of ${quotation.quotedPrice?.totalAmount || 'N/A'} ${quotation.quotedPrice?.currency || 'AED'}. A contract will be created shortly.`,
                metadata: {
                    quotationId: quotation._id,
                    quotationNumber: quotation.quotationNumber,
                    corporateId: corporateOwnerId,
                    corporateName,
                    totalAmount: quotation.quotedPrice?.totalAmount,
                    currency: quotation.quotedPrice?.currency,
                },
            })
            sendRealTimeNotification(quotation.fleetOwnerId._id.toString(), acceptNotif)

            // Notify ADMIN
            await sendAdminNotification(
                "Quotation Accepted",
                `${corporateName} (CORPORATE) accepted quotation of ${quotation.quotedPrice?.totalAmount || 'N/A'} ${quotation.quotedPrice?.currency || 'AED'} from ${fleetName} (B2B_PARTNER)`,
                "QUOTATION_ACCEPTED",
                { quotationId: quotation._id, corporateId: corporateOwnerId, fleetOwnerId: quotation.fleetOwnerId._id }
            );
        } else {
            await createNotification(
                quotation.fleetOwnerId._id,
                "QUOTATION_REJECTED",
                "Quotation Rejected",
                `${corporateName} has rejected your quotation. Reason: ${message || 'No reason provided'}`,
                quotation._id,
                "QUOTATION"
            );


            // Send REAL-TIME notification to B2B Partner about rejection
            const rejectNotif = await createNotificationService({
                userId: quotation.fleetOwnerId._id,
                type: "QUOTATION_REJECTED",
                title: "Quotation Rejected",
                message: `${corporateName} has rejected your quotation. Reason: ${message || 'No reason provided'}`,
                metadata: {
                    quotationId: quotation._id,
                    quotationNumber: quotation.quotationNumber,
                    corporateId: corporateOwnerId,
                    corporateName,
                    reason: message || 'No reason provided',
                },
            })
            sendRealTimeNotification(quotation.fleetOwnerId._id.toString(), rejectNotif)

            // Notify ADMIN
            await sendAdminNotification(
                "Quotation Rejected by Corporate",
                `${corporateName} (CORPORATE) rejected quotation from ${fleetName} (B2B_PARTNER). Reason: ${message || 'No reason provided'}`,
                "QUOTATION_REJECTED",
                { quotationId: quotation._id, corporateId: corporateOwnerId, fleetOwnerId: quotation.fleetOwnerId._id }
            );
        }

        res.status(200).json({
            success: true,
            message: `Quotation ${decision}ed successfully`,
            data: {
                quotation,
            },
        })
    } catch (error) {
        console.error("[Backend] Error processing corporate decision:", error)
        res.status(500).json({
            success: false,
            message: "Failed to process decision",
            error: error.message,
        })
    }
}

// @desc    Fetch quotations for fleet owner (B2B_PARTNER)
// @route   GET /api/quotations/fleet/my-quotations
// @access  Private (B2B_PARTNER only)
export const fetchFleetQuotations = async (req, res) => {
    try {
        const fleetOwnerId = req.userId

        // Fetch all quotations for this fleet owner with populated references
        const quotations = await Quotation.find({ fleetOwnerId })
            .populate({
                path: "corporateOwnerId",
                select: "fullName email companyName whatsappNumber nationality companyAddress",
            })
            .populate({
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory serviceType registrationNumber pricing capacity location photos manufacturingYear",
            })
            .sort({ createdAt: -1 })

        // Calculate stats
        const stats = {
            total: quotations.length,
            requested: quotations.filter((q) => q.status === "REQUESTED").length,
            quoted: quotations.filter((q) => q.status === "QUOTED").length,
            accepted: quotations.filter((q) => q.status === "ACCEPTED").length,
            rejected: quotations.filter((q) => q.status === "REJECTED").length,
            negotiating: quotations.filter((q) => q.status === "NEGOTIATING").length,
            expired: quotations.filter((q) => q.status === "EXPIRED").length,
        }

        res.status(200).json({
            success: true,
            data: {
                quotations,
                stats,
            },
        })
    } catch (error) {
        console.error("Error fetching fleet quotations:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch quotations",
            error: error.message,
        })
    }
}

// @desc    Respond to a quotation request (approve/reject with pricing)
// @route   POST /api/quotations/fleet/:quotationId/respond
// @access  Private (B2B_PARTNER only)
export const respondToQuotation = async (req, res) => {
    try {
        const { quotationId } = req.params
        const fleetOwnerId = req.userId
        const { status, message, terms, quotedPrice } = req.body

        console.log("[Backend] Received quotation response:", {
            quotationId,
            fleetOwnerId,
            status,
            message,
            terms,
            quotedPrice: JSON.stringify(quotedPrice, null, 2),
        })

        // Validate required fields
        if (!message || !message.trim()) {
            console.log("[Backend] Validation failed: message is required")
            return res.status(400).json({
                success: false,
                message: "Response message is required",
            })
        }

        // Validate status
        const validStatuses = ["approved", "rejected"]
        if (!validStatuses.includes(status)) {
            console.log("[Backend] Validation failed: invalid status")
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be 'approved' or 'rejected'",
            })
        }

        // Find the quotation
        const quotation = await Quotation.findOne({
            _id: quotationId,
            fleetOwnerId,
        })
            .populate({
                path: "vehicles.vehicleId",
                select: "vehicleName pricing capacity driverAvailability fuelOptions currency",
            })
            .populate({
                path: "corporateOwnerId",
                select: "fullName email companyName whatsappNumber",
            })

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found or you don't have permission to respond",
            })
        }

        // Check if quotation is in REQUESTED status
        if (quotation.status !== "REQUESTED") {
            return res.status(400).json({
                success: false,
                message: `Cannot respond to quotation with status: ${quotation.status}`,
            })
        }

        // Check if quotation is expired
        if (quotation.validUntil && new Date() > new Date(quotation.validUntil)) {
            quotation.status = "EXPIRED"
            await quotation.save()
            return res.status(400).json({
                success: false,
                message: "This quotation has expired",
            })
        }

        // Handle APPROVAL
        if (status === "approved") {
            console.log("[Backend] Processing approval, checking quotedPrice...")

            if (!quotedPrice || typeof quotedPrice !== "object") {
                console.log("[Backend] Validation failed: quotedPrice missing or invalid type")
                return res.status(400).json({
                    success: false,
                    message: "Quoted price information is required for approval",
                })
            }

            console.log("[Backend] quotedPrice.totalAmount:", quotedPrice.totalAmount)

            if (!quotedPrice.totalAmount || Number.parseFloat(quotedPrice.totalAmount) <= 0) {
                console.log("[Backend] Validation failed: invalid total amount")
                return res.status(400).json({
                    success: false,
                    message: "Valid total amount is required for approval",
                })
            }

            if (
                !quotedPrice.perVehicleBreakdown ||
                !Array.isArray(quotedPrice.perVehicleBreakdown) ||
                quotedPrice.perVehicleBreakdown.length === 0
            ) {
                console.log("[Backend] Validation failed: perVehicleBreakdown missing or empty")
                return res.status(400).json({
                    success: false,
                    message: "Per vehicle breakdown is required for approval",
                })
            }

            console.log("[Backend] All validations passed, saving quotation...")

            const firstVehicle = quotation.vehicles?.[0]?.vehicleId
            const quotationCurrency = firstVehicle?.pricing?.currency || "AED"

            // Management/service charge only applies to MANAGED quotations. The
            // partner may charge any amount (including 0) for running operations
            // on the corporate's behalf. It is added on top of the vehicle totals.
            const serviceCharge =
                quotation.serviceMode === "MANAGED"
                    ? Math.max(0, Number.parseFloat(quotedPrice.serviceCharge) || 0)
                    : 0

            // The client may send a total that already includes the service charge.
            // Normalise so the stored total always reflects vehicles + serviceCharge.
            const incomingTotal = Number.parseFloat(quotedPrice.totalAmount) || 0
            const vehiclesTotal = (quotedPrice.perVehicleBreakdown || []).reduce(
                (sum, b) => sum + (Number.parseFloat(b.totalAmount) || 0),
                0,
            )
            const baseTotal = vehiclesTotal > 0 ? vehiclesTotal : Math.max(0, incomingTotal - serviceCharge)
            const finalTotal = baseTotal + serviceCharge

            quotation.quotedPrice = {
                totalAmount: finalTotal,
                currency: quotationCurrency,
                serviceCharge,
                breakdown: {
                    vehicleRental: Number.parseFloat(quotedPrice.breakdown?.vehicleRental) || 0,
                    driverCharges: Number.parseFloat(quotedPrice.breakdown?.driverCharges) || 0,
                    fuelCharges: Number.parseFloat(quotedPrice.breakdown?.fuelCharges) || 0,
                },
                perVehicleBreakdown: quotedPrice.perVehicleBreakdown.map((breakdown) => ({
                    vehicleId: breakdown.vehicleId,
                    vehicleName: breakdown.vehicleName,
                    quantity: Number(breakdown.quantity) || 0,
                    baseRental: Number.parseFloat(breakdown.baseRental) || 0,
                    driverCharges: Number.parseFloat(breakdown.driverCharges) || 0,
                    fuelCharges: Number.parseFloat(breakdown.fuelCharges) || 0,
                    totalAmount: Number.parseFloat(breakdown.totalAmount) || 0,
                })),
            }

            console.log("[Backend] Quotation price set:", JSON.stringify(quotation.quotedPrice, null, 2))

            quotation.status = "QUOTED"
            quotation.responseMessage = message
            quotation.terms = terms || ""
            quotation.respondedAt = new Date()

            // Set new validity period for corporate owner to accept (7 days)
            quotation.validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }

        // Handle REJECTION
        if (status === "rejected") {
            quotation.status = "REJECTED"
            quotation.responseMessage = message
            quotation.respondedAt = new Date()
        }

        await quotation.save()

        console.log("[Backend] Quotation saved successfully")

        // Populate the updated quotation for response
        await quotation.populate([
            {
                path: "corporateOwnerId",
                select: "fullName email companyName whatsappNumber",
            },
            {
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber pricing capacity location photos",
            },
        ])

        // Send notification to CORPORATE user about quotation response
        const fleetName = await getUserName(fleetOwnerId);
        const corporateName = quotation.corporateOwnerId?.companyName || quotation.corporateOwnerId?.fullName || 'Corporate';

        if (status === "approved") {
            await createNotification(
                quotation.corporateOwnerId._id,
                "QUOTATION_RESPONSE",
                "Quotation Received",
                `${fleetName} has sent you a quotation for ${quotation.quotedPrice?.totalAmount || 'N/A'} ${quotation.quotedPrice?.currency || 'AED'}`,
                quotation._id,
                "QUOTATION"
            );

            // Send REAL-TIME notification to Corporate
            const realTimeNotif = await createNotificationService({
                userId: quotation.corporateOwnerId._id,
                type: "QUOTATION_RECEIVED",
                title: "Quotation Received",
                message: `${fleetName} has sent you a quotation of ${quotation.quotedPrice?.totalAmount || 'N/A'} ${quotation.quotedPrice?.currency || 'AED'}. Please review and accept or reject within 7 days.`,
                metadata: {
                    quotationId: quotation._id,
                    quotationNumber: quotation.quotationNumber,
                    fleetOwnerId,
                    fleetName,
                    totalAmount: quotation.quotedPrice?.totalAmount,
                    currency: quotation.quotedPrice?.currency,
                    validUntil: quotation.validUntil,
                },
            })
            sendRealTimeNotification(quotation.corporateOwnerId._id.toString(), realTimeNotif)

            // Send to ADMIN
            await sendAdminNotification(
                "Quotation Sent",
                `${fleetName} (B2B_PARTNER) sent quotation of ${quotation.quotedPrice?.totalAmount || 'N/A'} ${quotation.quotedPrice?.currency || 'AED'} to ${corporateName} (CORPORATE)`,
                "QUOTATION_RESPONSE",
                { quotationId: quotation._id, fleetOwnerId, corporateId: quotation.corporateOwnerId._id, amount: quotation.quotedPrice?.totalAmount }
            );
        } else {
            await createNotification(
                quotation.corporateOwnerId._id,
                "QUOTATION_REJECTED",
                "Quotation Request Rejected",
                `${fleetName} has declined your quotation request. Reason: ${message}`,
                quotation._id,
                "QUOTATION"
            );

            // Send REAL-TIME notification to Corporate about rejection
            const rejectNotif = await createNotificationService({
                userId: quotation.corporateOwnerId._id,
                type: "QUOTATION_REJECTED",
                title: "Quotation Request Rejected",
                message: `${fleetName} has declined your quotation request. Reason: ${message}. You can request from another fleet owner.`,
                metadata: {
                    quotationId: quotation._id,
                    quotationNumber: quotation.quotationNumber,
                    fleetOwnerId,
                    fleetName,
                    reason: message,
                },
            })
            sendRealTimeNotification(quotation.corporateOwnerId._id.toString(), rejectNotif)

            // Send to ADMIN
            await sendAdminNotification(
                "Quotation Rejected by Fleet Owner",
                `${fleetName} (B2B_PARTNER) rejected quotation request from ${corporateName} (CORPORATE). Reason: ${message}`,
                "QUOTATION_REJECTED",
                { quotationId: quotation._id, fleetOwnerId, corporateId: quotation.corporateOwnerId._id }
            );
        }

        res.status(200).json({
            success: true,
            message: `Quotation ${status === "approved" ? "approved" : "rejected"} successfully`,
            data: {
                quotation,
            },
        })
    } catch (error) {
        console.error("[Backend] Error responding to quotation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to respond to quotation",
            error: error.message,
        })
    }
}

// @desc    Corporate owner negotiates quotation price
// @route   POST /api/quotations/corporate/:quotationId/negotiate
// @access  Private (CORPORATE only)
export const negotiateQuotation = async (req, res) => {
    try {
        const { quotationId } = req.params
        const corporateOwnerId = req.userId
        const { counterOffer, message } = req.body

        if (!counterOffer || !counterOffer.totalAmount || Number.parseFloat(counterOffer.totalAmount) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid counter offer amount is required",
            })
        }

        const quotation = await Quotation.findOne({
            _id: quotationId,
            corporateOwnerId,
        })

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found",
            })
        }

        if (!["QUOTED", "NEGOTIATING"].includes(quotation.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot negotiate quotation with status: ${quotation.status}`,
            })
        }

        if (quotation.validUntil && new Date() > new Date(quotation.validUntil)) {
            quotation.status = "EXPIRED"
            await quotation.save()
            return res.status(400).json({
                success: false,
                message: "This quotation has expired",
            })
        }

        // Update quotation with negotiation data
        quotation.status = "NEGOTIATING"
        quotation.corporateResponseMessage = message || "Counter offer submitted"

        // Store negotiation history
        if (!quotation.negotiationHistory) {
            quotation.negotiationHistory = []
        }
        quotation.negotiationHistory.push({
            from: "CORPORATE",
            amount: Number.parseFloat(counterOffer.totalAmount),
            message: message || "",
            timestamp: new Date(),
        })

        // Extend validity for negotiation
        quotation.validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        await quotation.save()

        // Create notification for fleet owner (B2B_PARTNER)
        await createNotification(
            quotation.fleetOwnerId,
            "QUOTATION_NEGOTIATION",
            "Quotation Counter Offer",
            `Corporate owner has submitted a counter offer of ${counterOffer.totalAmount} for quotation ${quotation.quotationNumber}`,
            quotation._id,
            "QUOTATION",
        )

        // Get names for admin notification
        const corporateName = await getUserName(corporateOwnerId);
        const fleetName = await getUserName(quotation.fleetOwnerId);

        // Notify ADMIN about negotiation
        await sendAdminNotification(
            "Quotation Counter Offer",
            `${corporateName} (CORPORATE) submitted counter offer of ${counterOffer.totalAmount} to ${fleetName} (B2B_PARTNER) for quotation ${quotation.quotationNumber}`,
            "QUOTATION_NEGOTIATION",
            { quotationId: quotation._id, corporateId: corporateOwnerId, fleetOwnerId: quotation.fleetOwnerId, counterOffer: counterOffer.totalAmount }
        );

        const populatedQuotation = await Quotation.findById(quotation._id)
            .populate("corporateOwnerId", "fullName companyName email whatsappNumber")
            .populate("fleetOwnerId", "fullName email whatsappNumber")
            .populate("vehicles.vehicleId", "vehicleName vehicleCategory pricing")

        res.status(200).json({
            success: true,
            message: "Counter offer submitted successfully",
            data: {
                quotation: populatedQuotation,
            },
        })
    } catch (error) {
        console.error("Error negotiating quotation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to submit counter offer",
            error: error.message,
        })
    }
}

// @desc    Get single quotation details for fleet owner
// @route   GET /api/quotations/fleet/:quotationId
// @access  Private (B2B_PARTNER only)
export const getFleetQuotationById = async (req, res) => {
    try {
        const { quotationId } = req.params
        const fleetOwnerId = req.userId

        const quotation = await Quotation.findOne({
            _id: quotationId,
            fleetOwnerId,
        })
            .populate({
                path: "corporateOwnerId",
                select: "fullName email companyName whatsappNumber nationality companyAddress tradeLicense",
            })
            .populate({
                path: "vehicles.vehicleId",
                select:
                    "vehicleName vehicleCategory serviceType registrationNumber pricing capacity location photos documents manufacturingYear facilities driverAvailability fuelOptions",
            })

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found",
            })
        }

        res.status(200).json({
            success: true,
            data: {
                quotation,
            },
        })
    } catch (error) {
        console.error("Error fetching quotation:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch quotation details",
            error: error.message,
        })
    }
}