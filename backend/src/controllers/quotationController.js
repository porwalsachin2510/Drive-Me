import Quotation from "../models/Quotation.js"
import Notification from "../models/Notification.js"

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

        // Create quotation with the schema structure
        const quotation = await Quotation.create({
            corporateOwnerId: req.userId, // From auth middleware
            fleetOwnerId,
            vehicles, // Array of vehicle IDs
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

        // Create notification for fleet owner
        await createNotification(
            fleetOwnerId,
            "QUOTATION_REQUEST",
            "New Quotation Request",
            `You have received a new quotation request for ${totalQty} vehicle(s)`,
            quotation._id,
            "QUOTATION",
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
                quotationNumber: populatedQuotation.quotationNumber
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
                    "vehicleName vehicleCategory registrationNumber pricing capacity location photos documents manufacturingYear facilities",
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
                select: "vehicleName vehicleCategory registrationNumber pricing capacity location photos manufacturingYear",
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

            quotation.quotedPrice = {
                totalAmount: Number.parseFloat(quotedPrice.totalAmount),
                currency: quotationCurrency,
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

        // Create notification for fleet owner
        await createNotification(
            quotation.fleetOwnerId,
            "QUOTATION_NEGOTIATION",
            "Quotation Counter Offer",
            `Corporate owner has submitted a counter offer of ${counterOffer.totalAmount} for quotation ${quotation.quotationNumber}`,
            quotation._id,
            "QUOTATION",
        )

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
                    "vehicleName vehicleCategory registrationNumber pricing capacity location photos documents manufacturingYear facilities driverAvailability fuelOptions",
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




