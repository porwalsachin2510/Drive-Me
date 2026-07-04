import Vehicle from "../models/Vehicle.js"
import User from "../models/User.js"
import { uploadToCloudinary, uploadMultipleSequential } from "../Config/Cloudinary.js"
import {
    getEffectiveCountry,
    getCountryCurrency,
    isLocationInCountry,
} from "../Config/localizationConfig.js"

export const addVehicle = async (req, res) => {
    try {
        console.log("[v0] ===== ADD VEHICLE START =====")

        const vehicleData = { ...req.body, fleetOwnerId: req.userId }

        console.log("vehicleData", vehicleData);

        const jsonFields = [
            "capacity",
            "driverAvailability",
            "fuelOptions",
            "facilities",
            "pricing",
            "kmLimits",
            "availability",
        ]

        for (const field of jsonFields) {
            if (vehicleData[field] && typeof vehicleData[field] === "string") {
                vehicleData[field] = JSON.parse(vehicleData[field])
            }
        }

        // ---- Multi-country integrity (server-side, defense in depth) ----
        // A fleet owner is an identity-locked earner: their vehicle MUST be
        // priced in their own country's currency and located in their own
        // country. Never trust the client-provided currency/location blindly,
        // otherwise cross-currency data (e.g. a Kuwait partner pricing in AED)
        // would corrupt wallets and admin totals.
        const owner = await User.findById(req.userId).select(
            "country countryCode role adminPermissions"
        )
        const ownerCountry = getEffectiveCountry(owner)
        const ownerCurrency = getCountryCurrency(ownerCountry)

        if (!vehicleData.pricing || typeof vehicleData.pricing !== "object") {
            vehicleData.pricing = {}
        }
        // Force the currency to the owner's country currency.
        vehicleData.pricing.currency = ownerCurrency

        if (vehicleData.location && !isLocationInCountry(vehicleData.location, ownerCountry)) {
            return res.status(400).json({
                success: false,
                message: `Selected location is not available in your registered country (${ownerCountry}).`,
            })
        }

        // ✅ IMAGES (SEQUENTIAL UPLOAD)
        if (req.files?.images?.length) {
            const uploads = await uploadMultipleSequential(
                req.files.images,
                "driveme/vehicles"
            )

            vehicleData.photos = uploads.map((u) => ({
                url: u.secure_url,
                publicId: u.public_id,
            }))
        }

        // ✅ DOCUMENTS
        const docMap = {
            registration: "RC_COPY",
            insurance: "INSURANCE",
            inspection: "FITNESS_CERTIFICATE",
        }

        vehicleData.documents = []

        for (const [field, type] of Object.entries(docMap)) {
            if (req.files?.[field]?.[0]) {
                const uploaded = await uploadToCloudinary(
                    req.files[field][0],
                    "driveme/documents"
                )

                vehicleData.documents.push({
                    documentType: type,
                    documentUrl: uploaded.secure_url,
                    publicId: uploaded.public_id,
                })
            }
        }

        const vehicle = await Vehicle.create(vehicleData)

        res.status(201).json({
            success: true,
            message: "Vehicle added successfully",
            data: vehicle,
        })
    } catch (error) {
        console.error("[v0] ADD VEHICLE ERROR:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Vehicle creation failed",
        })
    }
}

export const getMyVehicles = async (req, res) => {
    try {
        const { status, serviceType, page = 1, limit = 10 } = req.query

        const query = { fleetOwnerId: req.userId }
        if (status) query.status = status
        if (serviceType) query.serviceType = serviceType

        const vehicles = await Vehicle.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)

        const total = await Vehicle.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                vehicles,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            },
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch vehicles",
        })
    }
}

// export const searchVehicles = async (req, res) => {
//     try {
//         const {
//             serviceType,
//             vehicleCategory,
//             minSeats,
//             startDate,
//             budgetRange,
//             withDriver,
//             fuelIncluded,
//             facilities,
//             rentalDuration,
//             perKmUsage,
//             minDailyRate,
//             maxDailyRate,
//             minWeeklyRate,
//             maxWeeklyRate,
//             minMonthlyRate,
//             maxMonthlyRate,
//             page = 1,
//             limit = 12,
//         } = req.query

//         // Build query
//         const query = { status: "AVAILABLE", isActive: true }


//         if (serviceType) query.serviceType = serviceType
//         if (vehicleCategory && vehicleCategory !== "ANY_TYPE") {
//             query.vehicleCategory = vehicleCategory
//         }

//         if (minSeats) {
//             query["capacity.seatingCapacity"] = { $gte: Number.parseInt(minSeats) }
//         }

//         // Driver availability filter
//         if (withDriver === "true") {
//             query["driverAvailability.withDriver"] = true
//         } else if (withDriver === "false") {
//             query["driverAvailability.withoutDriver"] = true
//         }

//         // Fuel filter
//         if (fuelIncluded === "true") {
//             query["fuelOptions.fuelIncluded"] = true
//         } else if (fuelIncluded === "false") {
//             query["fuelOptions.withoutFuel"] = true
//         }

//         // Budget range filters for different rental durations
//         if (minDailyRate || maxDailyRate) {
//             query["pricing.dailyRate"] = {}
//             if (minDailyRate) query["pricing.dailyRate"].$gte = Number.parseFloat(minDailyRate)
//             if (maxDailyRate) query["pricing.dailyRate"].$lte = Number.parseFloat(maxDailyRate)
//         }

//         if (minWeeklyRate || maxWeeklyRate) {
//             query["pricing.weeklyRate"] = {}
//             if (minWeeklyRate) query["pricing.weeklyRate"].$gte = Number.parseFloat(minWeeklyRate)
//             if (maxWeeklyRate) query["pricing.weeklyRate"].$lte = Number.parseFloat(maxWeeklyRate)
//         }

//         if (minMonthlyRate || maxMonthlyRate) {
//             query["pricing.monthlyRate"] = {}
//             if (minMonthlyRate) query["pricing.monthlyRate"].$gte = Number.parseFloat(minMonthlyRate)
//             if (maxMonthlyRate) query["pricing.monthlyRate"].$lte = Number.parseFloat(maxMonthlyRate)
//         }

//         // Facilities filter
//         if (facilities) {
//             const facilitiesArray = facilities.split(",")
//             facilitiesArray.forEach((facility) => {
//                 query[`facilities.${facility}`] = true
//             })
//         }

//         console.log("query", query);

//         // Fetch vehicles
//         const vehicles = await Vehicle.find(query)
//             .populate("fleetOwnerId", "name businessName email phone rating totalReviews")
//             .sort({ createdAt: -1 })
//             .limit(limit * 1)
//             .skip((page - 1) * limit)

//         const total = await Vehicle.countDocuments(query)

//         // Group by fleet owner
//         const groupedByFleetOwner = vehicles.reduce((acc, vehicle) => {
//             const ownerId = vehicle.fleetOwnerId._id.toString()
//             if (!acc[ownerId]) {
//                 acc[ownerId] = {
//                     fleetOwner: vehicle.fleetOwnerId,
//                     vehicles: [],
//                 }
//             }
//             acc[ownerId].vehicles.push(vehicle)
//             return acc
//         }, {})

//         res.status(200).json({
//             success: true,
//             data: {
//                 vehicles,
//                 groupedByFleetOwner: Object.values(groupedByFleetOwner),
//                 totalPages: Math.ceil(total / limit),
//                 currentPage: Number.parseInt(page),
//                 total,
//             },
//         })
//     } catch (error) {
//         console.error("Search vehicles error:", error)
//         res.status(500).json({
//             success: false,
//             message: error.message || "Failed to search vehicles",
//         })
//     }
// }


export const searchVehicles = async (req, res) => {
    try {
        const {
            budget, // "10000-25000"
            driverRequired, // "true" or "false"
            features, // "GPS Tracking,WiFi" (comma-separated)
            fuelIncluded, // "true" or "false"
            location, // "Kuwait City"
            minseatsrequired, // "14"
            rentalDuration, // "daily", "weekly", "monthly"
            serviceType, // "passenger" or "cargo"
            startDate, // "2026-01-28"
            vehicleType, // "sedan", "suv", etc.
            page = 1,
            limit = 12,
        } = req.query;




        // Step 1: Find all B2B Partners (Fleet Owners)
        const fleetOwners = await User.find({
            role: "B2B_PARTNER"
        }).select("_id fullName companyName email whatsappNumber nationality acceptedPaymentMethods");

        if (!fleetOwners || fleetOwners.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    fleetOwners: [],
                    totalVehicles: 0,
                    totalFleetOwners: 0,
                    currentPage: Number.parseInt(page),
                    totalPages: 0,
                },
                message: "No fleet owners found",
            });
        }

        // Get all fleet owner IDs
        const fleetOwnerIds = fleetOwners.map((owner) => owner._id);

        // Step 2: Build vehicle query
        const vehicleQuery = {
            fleetOwnerId: { $in: fleetOwnerIds },
            status: "AVAILABLE",
            isActive: true,
            approvalStatus: "APPROVED", // Only show approved vehicles
        };

        // Service Type Filter - Map frontend values to backend enum
        // Frontend sends: "passenger", "goods", "managed", "cargo"
        // Backend expects: "PASSENGER", "GOODS_CARRIER", "MANAGED_SERVICES"
        if (serviceType) {
            const serviceTypeMap = {
                "passenger": "PASSENGER",
                "goods": "GOODS_CARRIER",
                "cargo": "GOODS_CARRIER",
                "goods_carrier": "GOODS_CARRIER",
                "managed": "MANAGED_SERVICES",
                "managed_services": "MANAGED_SERVICES",
            };
            const normalizedType = serviceType.toLowerCase();
            vehicleQuery.serviceType = serviceTypeMap[normalizedType] || serviceType.toUpperCase();
        }

        // Vehicle Category/Type Filter
        if (vehicleType && vehicleType !== "ANY_TYPE") {
            const upperVehicleType = vehicleType.toUpperCase();
            // Define valid categories for each service type to ensure correct matching
            const goodsCarrierCategories = ["PICKUP_1TON", "PICKUP_3TON", "TRUCK_7TON", "REEFER_TRUCK", "FLATBED_TRAILER"];
            const passengerCategories = ["SEDAN", "SUV", "MINIVAN", "COASTER_BUS", "LUXURY_COACH", "SHUTTLE_BUS"];

            // If searching for goods carrier service type with a goods category
            if (vehicleQuery.serviceType === "GOODS_CARRIER" && goodsCarrierCategories.includes(upperVehicleType)) {
                vehicleQuery.vehicleCategory = upperVehicleType;
            }
            // If searching for passenger service type with a passenger category
            else if (vehicleQuery.serviceType === "PASSENGER" && passengerCategories.includes(upperVehicleType)) {
                vehicleQuery.vehicleCategory = upperVehicleType;
            }
            // For other cases, just use the vehicleType as-is
            else {
                vehicleQuery.vehicleCategory = upperVehicleType;
            }
        }

        // Minimum Seats/Cargo Capacity Filter (greater than or equal)
        // For GOODS_CARRIER, use cargoCapacity; for others, use seatingCapacity
        if (minseatsrequired) {
            const minValue = Number.parseInt(minseatsrequired);
            if (vehicleQuery.serviceType === "GOODS_CARRIER") {
                // For goods carrier, filter by cargo capacity (tons)
                vehicleQuery["capacity.cargoCapacity"] = {
                    $gte: minValue,
                };
            } else if (vehicleQuery.serviceType) {
                // For passenger/managed services, filter by seating capacity
                vehicleQuery["capacity.seatingCapacity"] = {
                    $gte: minValue,
                };
            } else {
                // If no service type specified, check both capacity types with OR
                vehicleQuery.$or = [
                    { "capacity.seatingCapacity": { $gte: minValue } },
                    { "capacity.cargoCapacity": { $gte: minValue } }
                ];
            }
        }

        // Driver Availability Filter
        if (driverRequired === "true") {
            vehicleQuery["driverAvailability.withDriver"] = true;
        } else if (driverRequired === "false") {
            vehicleQuery["driverAvailability.withoutDriver"] = true;
        }

        // Fuel Options Filter
        if (fuelIncluded === "true") {
            vehicleQuery["fuelOptions.fuelIncluded"] = true;
        } else if (fuelIncluded === "false") {
            vehicleQuery["fuelOptions.withoutFuel"] = true;
        }

        // Location Filter
        if (location) {
            vehicleQuery.location = new RegExp(location, "i"); // case-insensitive search
        }

        // Budget Range Filter based on rental duration
        if (budget) {
            // Handle "+" suffix for premium ranges (e.g., "150000+")
            const isPremium = budget.endsWith("+");
            let minBudget, maxBudget;

            if (isPremium) {
                minBudget = Number(budget.replace("+", ""));
                maxBudget = Number.MAX_SAFE_INTEGER; // No upper limit
            } else {
                [minBudget, maxBudget] = budget.split("-").map(Number);
            }

            if (rentalDuration === "daily") {
                vehicleQuery["pricing.dailyRate"] = {
                    $gte: minBudget,
                    ...(maxBudget !== Number.MAX_SAFE_INTEGER && { $lte: maxBudget }),
                };
            } else if (rentalDuration === "weekly") {
                vehicleQuery["pricing.weeklyRate"] = {
                    $gte: minBudget,
                    ...(maxBudget !== Number.MAX_SAFE_INTEGER && { $lte: maxBudget }),
                };
            } else if (rentalDuration === "monthly") {
                vehicleQuery["pricing.monthlyRate"] = {
                    $gte: minBudget,
                    ...(maxBudget !== Number.MAX_SAFE_INTEGER && { $lte: maxBudget }),
                };
            } else if (rentalDuration === "long-term" || rentalDuration === "yearly") {
                // For long-term/yearly rentals, filter by yearlyRate
                // If yearlyRate is 0 or not set, fallback to monthlyRate * 12
                if (maxBudget === Number.MAX_SAFE_INTEGER) {
                    // Premium tier - no upper limit
                    vehicleQuery["$or"] = [
                        { "pricing.yearlyRate": { $gte: minBudget } },
                        {
                            "pricing.yearlyRate": { $in: [0, null] },
                            "$expr": {
                                "$gte": [{ "$multiply": ["$pricing.monthlyRate", 12] }, minBudget]
                            }
                        }
                    ];
                } else {
                    vehicleQuery["$or"] = [
                        { "pricing.yearlyRate": { $gte: minBudget, $lte: maxBudget } },
                        {
                            "pricing.yearlyRate": { $in: [0, null] },
                            "$expr": {
                                "$and": [
                                    { "$gte": [{ "$multiply": ["$pricing.monthlyRate", 12] }, minBudget] },
                                    { "$lte": [{ "$multiply": ["$pricing.monthlyRate", 12] }, maxBudget] }
                                ]
                            }
                        }
                    ];
                }
            }
        }

        // Features/Facilities Filter
        if (features) {
            const featuresArray = typeof features === 'string'
                ? features.split(",").map(f => f.trim())
                : features;

            featuresArray.forEach((feature) => {
                // Convert feature names to match schema
                const facilityMapping = {
                    "GPS Tracking": "gpsTracking",
                    "Air Conditioning": "airConditioning",
                    "WiFi": "wifiOnboard",
                    "Wheelchair Access": "wheelchairAccess",
                    "Music System": "musicSystem",
                    "Entertainment Screen": "entertainmentScreen",
                    "Refrigeration": "refrigeration",
                };

                const facilityKey = facilityMapping[feature] || feature.toLowerCase().replace(/\s+/g, "");
                vehicleQuery[`facilities.${facilityKey}`] = true;
            });
        }

        // Start Date Availability Check (optional - you may need to add booking logic)
        // This is a basic check, you might want to check against existing bookings
        if (startDate) {
            vehicleQuery["availability.blackoutDates"] = {
                $not: { $elemMatch: { $eq: new Date(startDate) } }
            };
        }

        console.log("[v0] Vehicle Query:", JSON.stringify(vehicleQuery, null, 2));

        // Step 3: Fetch vehicles with pagination
        const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);

        const vehicles = await Vehicle.find(vehicleQuery)
            .sort({ createdAt: -1, rating: -1 }) // Sort by newest and highest rated
            .skip(skip)
            .limit(Number.parseInt(limit));

        const totalVehicles = await Vehicle.countDocuments(vehicleQuery);

        console.log("[v0] Found vehicles:", totalVehicles);
        console.log("[v0] Vehicles details:", vehicles.map(v => ({
            name: v.vehicleName,
            serviceType: v.serviceType,
            category: v.vehicleCategory,
            status: v.status,
            approvalStatus: v.approvalStatus,
            location: v.location
        })));

        // Step 4: Group vehicles by fleet owner
        const fleetOwnerMap = {};

        fleetOwners.forEach((owner) => {
            fleetOwnerMap[owner._id.toString()] = {
                fleetOwnerId: owner._id,
                fullName: owner.fullName,
                companyName: owner.companyName,
                email: owner.email,
                whatsappNumber: owner.whatsappNumber,
                nationality: owner.nationality,
                acceptedPaymentMethods: owner.acceptedPaymentMethods,
                vehicles: [],
                totalVehicles: 0,
                rating: 0, // You can calculate average rating from vehicles
                totalReviews: 0,
            };
        });

        // Group vehicles by their fleet owner
        vehicles.forEach((vehicle) => {
            const ownerId = vehicle.fleetOwnerId.toString();
            if (fleetOwnerMap[ownerId]) {
                fleetOwnerMap[ownerId].vehicles.push({
                    _id: vehicle._id,
                    vehicleName: vehicle.vehicleName,
                    vehicleCategory: vehicle.vehicleCategory,
                    serviceType: vehicle.serviceType,
                    capacity: vehicle.capacity,
                    pricing: vehicle.pricing,
                    facilities: vehicle.facilities,
                    photos: vehicle.photos,
                    driverAvailability: vehicle.driverAvailability,
                    fuelOptions: vehicle.fuelOptions,
                    rating: vehicle.rating,
                    totalReviews: vehicle.totalReviews,
                    location: vehicle.location,
                    availability: vehicle.availability,
                });
                fleetOwnerMap[ownerId].totalVehicles += 1;
                fleetOwnerMap[ownerId].rating += vehicle.rating || 0;
                fleetOwnerMap[ownerId].totalReviews += vehicle.totalReviews || 0;
            }
        });

        // Calculate average rating for each fleet owner
        const groupedFleetOwners = Object.values(fleetOwnerMap)
            .filter((owner) => owner.vehicles.length > 0)
            .map((owner) => ({
                ...owner,
                rating: owner.totalVehicles > 0
                    ? (owner.rating / owner.totalVehicles).toFixed(1)
                    : 0,
            }))
            .sort((a, b) => b.rating - a.rating); // Sort by rating

        // Step 5: Get total count of fleet owners with matching vehicles
        const totalFleetOwners = groupedFleetOwners.length;

        res.status(200).json({
            success: true,
            data: {
                fleetOwners: groupedFleetOwners,
                totalVehicles,
                totalFleetOwners,
                currentPage: Number.parseInt(page),
                totalPages: Math.ceil(totalVehicles / Number.parseInt(limit)),
                searchParams: {
                    budget,
                    driverRequired,
                    features,
                    fuelIncluded,
                    location,
                    minseatsrequired,
                    rentalDuration,
                    serviceType,
                    startDate,
                    vehicleType,
                },
            },

        });
    } catch (error) {
        console.error("Search vehicles error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to search vehicles",
        });
    }
};

export const getVehicleById = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id).populate(
            "fleetOwnerId",
            "name businessName email phone rating totalReviews businessAddress",
        )

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found",
            })
        }

        res.status(200).json({
            success: true,
            data: { vehicle },
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch vehicle",
        })
    }
}

export const getFleetOwnerVehicles = async (req, res) => {
    try {
        const { fleetOwnerId } = req.params
        const { status, serviceType } = req.query

        const query = { fleetOwnerId, isActive: true }
        if (status) query.status = status
        if (serviceType) query.serviceType = serviceType

        const vehicles = await Vehicle.find(query).sort({ createdAt: -1 })
        const fleetOwner = await User.findById(fleetOwnerId).select("-password")

        res.status(200).json({
            success: true,
            data: {
                fleetOwner,
                vehicles,
                totalVehicles: vehicles.length,
            },
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch fleet owner vehicles",
        })
    }
}

export const updateVehicle = async (req, res) => {
    try {
        console.log("[v0] ===== UPDATE VEHICLE REQUEST =====")
        console.log("[v0] Vehicle ID:", req.params.id)
        console.log("[v0] Update data:", req.body)

        const vehicle = await Vehicle.findOne({
            _id: req.params.id,
            fleetOwnerId: req.userId,
        })

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found or unauthorized",
            })
        }

        const updates = { ...req.body }

        const jsonFields = [
            "capacity",
            "driverAvailability",
            "fuelOptions",
            "facilities",
            "pricing",
            "kmLimits",
            "availability",
        ]

        for (const field of jsonFields) {
            if (updates[field] && typeof updates[field] === "string") {
                try {
                    updates[field] = JSON.parse(updates[field])
                } catch (parseError) {
                    console.error(`[v0] Error parsing ${field}:`, parseError)
                }
            }
        }

        // ---- Multi-country integrity (server-side, defense in depth) ----
        // Keep the vehicle's currency locked to the owner's country currency and
        // reject a location outside their country, mirroring addVehicle.
        const owner = await User.findById(req.userId).select(
            "country countryCode role adminPermissions"
        )
        const ownerCountry = getEffectiveCountry(owner)
        const ownerCurrency = getCountryCurrency(ownerCountry)

        if (updates.pricing && typeof updates.pricing === "object") {
            updates.pricing.currency = ownerCurrency
        }

        if (updates.location && !isLocationInCountry(updates.location, ownerCountry)) {
            return res.status(400).json({
                success: false,
                message: `Selected location is not available in your registered country (${ownerCountry}).`,
            })
        }

        if (req.files && req.files.images && req.files.images.length > 0) {
            console.log(`[v0] Uploading ${req.files.images.length} new images...`)
            try {
                const photoUploads = await Promise.all(
                    req.files.images.map((file) => uploadToCloudinary(file, "driveme/vehicles")),
                )
                const newPhotos = photoUploads.map((upload) => ({
                    url: upload.secure_url,
                    publicId: upload.public_id,
                }))
                updates.photos = [...vehicle.photos, ...newPhotos]
                console.log("[v0] New photos uploaded successfully")
            } catch (uploadError) {
                console.error("[v0] Photo upload error:", uploadError)
            }
        }

        const docTypes = {
            registration: "RC_COPY",
            insurance: "INSURANCE",
            inspection: "FITNESS_CERTIFICATE",
        }

        const updatedDocuments = [...vehicle.documents]

        for (const [fieldName, docType] of Object.entries(docTypes)) {
            if (req.files && req.files[fieldName] && req.files[fieldName][0]) {
                console.log(`[v0] Updating ${fieldName} document...`)
                try {
                    const docUpload = await uploadToCloudinary(req.files[fieldName][0], "driveme/documents")

                    // Remove old document of same type
                    const existingIndex = updatedDocuments.findIndex((doc) => doc.documentType === docType)
                    if (existingIndex !== -1) {
                        updatedDocuments[existingIndex] = {
                            documentType: docType,
                            documentUrl: docUpload.secure_url,
                            publicId: docUpload.public_id,
                        }
                    } else {
                        updatedDocuments.push({
                            documentType: docType,
                            documentUrl: docUpload.secure_url,
                            publicId: docUpload.public_id,
                        })
                    }
                } catch (docError) {
                    console.error(`[v0] ERROR updating ${fieldName}:`, docError.message)
                }
            }
        }

        if (updatedDocuments.length > vehicle.documents.length) {
            updates.documents = updatedDocuments
        }

        const updatedVehicle = await Vehicle.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true },
        )

        console.log("[v0] Vehicle updated successfully")

        res.status(200).json({
            success: true,
            message: "Vehicle updated successfully",
            data: { vehicle: updatedVehicle },
        })
    } catch (error) {
        console.error("[v0] Update vehicle error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update vehicle",
        })
    }
}

export const deleteVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.findOneAndDelete({
            _id: req.params.id,
            fleetOwnerId: req.userId,
        })

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found or unauthorized",
            })
        }

        res.status(200).json({
            success: true,
            message: "Vehicle deleted successfully",
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to delete vehicle",
        })
    }
}

export const updateVehicleStatus = async (req, res) => {
    try {
        const { status } = req.body

        const vehicle = await Vehicle.findOneAndUpdate(
            { _id: req.params.id, fleetOwnerId: req.userId },
            { status },
            { new: true },
        )

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found or unauthorized",
            })
        }

        res.status(200).json({
            success: true,
            message: "Vehicle status updated successfully",
            data: { vehicle },
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update vehicle status",
        })
    }
}

// Get available vehicles by type
export const getAvailableVehicles = async (req, res) => {
    try {
        const { vehicleType } = req.query

        const filter = {
            fleetOwnerId: req.userId,
            status: "AVAILABLE",
        }

        if (vehicleType) {
            filter.vehicleType = vehicleType
        }

        const vehicles = await Vehicle.find(filter).sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            count: vehicles.length,
            vehicles,
        })
    } catch (error) {
        console.error("Error fetching available vehicles:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching available vehicles",
            error: error.message,
        })
    }
}
