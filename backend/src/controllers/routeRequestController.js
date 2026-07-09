import RouteRequest from "../models/RouteRequest.js";
import User from "../models/User.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import { sendEmail } from "../Services/emailService.js";
import { createNotification } from "../Services/notificationService.js";
import {
    getEffectiveCountry,
    getLocationCountry,
    normalizeCountry,
} from "../Config/localizationConfig.js";

// Case-insensitive exact matcher for corridor endpoints.
const escapeRegex = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Resolve the canonical service country for a route request. A commuter's
// country is an IDENTITY fact resolved from their account (dialing code /
// stored travel selection), so we trust that first and only fall back to the
// location-name heuristic for legacy/edge data.
const resolveRequestCountry = (passenger, pickupLocation, dropoffLocation) => {
    if (passenger) {
        const fromIdentity = getEffectiveCountry(passenger);
        if (fromIdentity) return normalizeCountry(fromIdentity);
    }
    return (
        getLocationCountry(pickupLocation) ||
        getLocationCountry(dropoffLocation) ||
        null
    );
};

// Create new route request
export const createRouteRequest = async (req, res) => {
    try {
        console.log("[v0] createRouteRequest called");
        console.log("[v0] Request body:", req.body);
        console.log("[v0] User ID:", req.userId);
        const {
            pickupLocation,
            dropoffLocation,
            preferredTime,
            requestType,
            travelDays,
            expectedStartDate,
            coordinates,
            pickupCoordinates,
            dropoffCoordinates
        } = req.body;

        const passengerId = req.userId;

        // Resolve the commuter's identity so we can stamp the demand with the
        // correct service country (used to keep partner demand boards scoped).
        const passenger = await User.findById(passengerId).select(
            "role country countryCode fullName email"
        );

        // Combine coordinates from different formats
        const finalCoordinates = coordinates || {
            pickup: pickupCoordinates,
            dropoff: dropoffCoordinates
        };

        // Validate required fields
        if (!pickupLocation || !dropoffLocation || !preferredTime || !requestType || !expectedStartDate) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields for route request"
            });
        }

        const requestCountry = resolveRequestCountry(passenger, pickupLocation, dropoffLocation);

        // Check if similar request already exists
        const existingRequest = await RouteRequest.findOne({
            passengerId,
            pickupLocation,
            dropoffLocation,
            preferredTime,
            status: { $in: ["PENDING", "UNDER_REVIEW"] }
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "Similar route request already exists",
                requestId: existingRequest._id
            });
        }

        // Check if route already exists
        const existingRoute = await B2CPartnerRoute.findOne({
            $or: [
                { fromLocation: pickupLocation, toLocation: dropoffLocation },
                { fromLocation: dropoffLocation, toLocation: pickupLocation }
            ],
            isActive: true
        });

        if (existingRoute) {
            return res.status(400).json({
                success: false,
                message: "Route already exists for this location",
                routeId: existingRoute._id,
                suggestion: "Please check available routes for this location"
            });
        }

        // Find similar requests to group demand (same corridor, same country).
        const similarRequests = await RouteRequest.find({
            pickupLocation: { $regex: `^${escapeRegex(pickupLocation)}$`, $options: "i" },
            dropoffLocation: { $regex: `^${escapeRegex(dropoffLocation)}$`, $options: "i" },
            status: { $in: ["PENDING", "UNDER_REVIEW", "OPEN"] },
            passengerId: { $ne: passengerId },
            ...(requestCountry ? { country: requestCountry } : {}),
        });

        // Create route request
        const routeRequest = new RouteRequest({
            passengerId,
            country: requestCountry,
            pickupLocation,
            dropoffLocation,
            preferredTime,
            requestType,
            travelDays: travelDays || ["MON", "TUE", "WED", "THU", "FRI"],
            expectedStartDate: new Date(expectedStartDate),
            coordinates: finalCoordinates,
            similarRequests: similarRequests.map(req => req._id),
            demandCount: similarRequests.length + 1
        });

        console.log("[v0] Route request saved:", routeRequest._id);

        await routeRequest.save();

        // Update similar requests with this request
        await RouteRequest.updateMany(
            { _id: { $in: similarRequests.map(req => req._id) } },
            { $push: { similarRequests: routeRequest._id }, $inc: { demandCount: 1 } }
        );

        // Notify nearby B2C partners (scoped to the demand's country)
        console.log("[v0] Calling notifyNearbyProviders...");
        await notifyNearbyProviders(pickupLocation, dropoffLocation, routeRequest, requestCountry);
        console.log("[v0] notifyNearbyProviders completed");
        res.status(201).json({
            success: true,
            message: "Route request created successfully",
            data: {
                requestId: routeRequest._id,
                demandCount: routeRequest.demandCount,
                similarRequests: similarRequests.length,
                estimatedProviders: await getNearbyProviderCount(pickupLocation, dropoffLocation)
            }
        });

    } catch (error) {
        console.error("Error creating route request:", error);
        res.status(500).json({
            success: false,
            message: "Error creating route request",
            error: error.message
        });
    }
};

// Get passenger's route requests
export const getPassengerRouteRequests = async (req, res) => {
    try {
        const passengerId = req.userId;
        const { status, page = 1, limit = 10 } = req.query;

        const query = { passengerId };
        if (status) {
            query.status = status.toUpperCase();
        }

        const requests = await RouteRequest.find(query)
            .populate('assignedProviderId', 'fullName email companyName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await RouteRequest.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                requests,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalRequests: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting route requests:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving route requests",
            error: error.message
        });
    }
};

// Get all route requests for providers (demand dashboard)
export const getRouteRequestsForProviders = async (req, res) => {
    try {
        const { status, pickupLocation, dropoffLocation, page = 1, limit = 20 } = req.query;
        const providerId = req.userId;

        const query = {};
        if (status) {
            query.status = status.toUpperCase();
        }
        if (pickupLocation) {
            query.pickupLocation = { $regex: pickupLocation, $options: 'i' };
        }
        if (dropoffLocation) {
            query.dropoffLocation = { $regex: dropoffLocation, $options: 'i' };
        }

        const requests = await RouteRequest.find(query)
            .populate('passengerId', 'fullName email')
            .sort({ demandCount: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await RouteRequest.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                requests,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalRequests: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting route requests for providers:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving route requests",
            error: error.message
        });
    }
};

// Provider expresses interest in serving a route request (Open Marketplace model).
// Multiple partners can express interest in the same corridor; no exclusive assignment.
export const respondToRouteRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { response, estimatedPrice, message } = req.body;
        const providerId = req.userId;

        const routeRequest = await RouteRequest.findById(requestId);
        if (!routeRequest) {
            return res.status(404).json({
                success: false,
                message: "Route request not found"
            });
        }

        // Cannot express interest once the demand is closed/rejected/completed.
        if (["REJECTED", "COMPLETED"].includes(routeRequest.status)) {
            return res.status(400).json({
                success: false,
                message: "This route request is no longer accepting partner interest"
            });
        }

        const partnerMessage = message || response || null;
        const price = estimatedPrice != null && estimatedPrice !== "" ? Number(estimatedPrice) : null;

        // Apply interest to the whole corridor cluster so every matching request reflects it.
        const escapeRegex = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const clusterRequests = await RouteRequest.find({
            pickupLocation: { $regex: `^${escapeRegex(routeRequest.pickupLocation)}$`, $options: "i" },
            dropoffLocation: { $regex: `^${escapeRegex(routeRequest.dropoffLocation)}$`, $options: "i" },
            status: { $nin: ["REJECTED", "COMPLETED"] },
        });

        for (const request of clusterRequests) {
            const existing = (request.interestedPartners || []).find(
                (p) => String(p.partnerId) === String(providerId)
            );
            if (existing) {
                // Update the partner's existing interest (don't downgrade a published route).
                if (existing.status !== "ROUTE_PUBLISHED") {
                    existing.status = "INTERESTED";
                }
                existing.message = partnerMessage;
                existing.estimatedPrice = price;
                existing.respondedAt = new Date();
            } else {
                request.interestedPartners.push({
                    partnerId: providerId,
                    message: partnerMessage,
                    estimatedPrice: price,
                    status: "INTERESTED",
                    respondedAt: new Date(),
                });
            }
            // Surface partner interest to Admin (unless already opened/approved).
            if (request.status === "PENDING") {
                request.status = "UNDER_REVIEW";
            }
            await request.save();
        }

        // Notify the commuters in this cluster that a partner showed interest.
        await notifyPassengersOfInterest(routeRequest, providerId);

        res.status(200).json({
            success: true,
            message: "Interest submitted successfully. The admin will review demand and open this route to partners.",
            data: {
                requestId: routeRequest._id,
                clusterSize: clusterRequests.length,
            }
        });

    } catch (error) {
        console.error("Error responding to route request:", error);
        res.status(500).json({
            success: false,
            message: "Error submitting interest",
            error: error.message
        });
    }
};

// Helper functions
const notifyNearbyProviders = async (pickupLocation, dropoffLocation, routeRequest, requestCountry = null) => {
    try {
        console.log("[v0] notifyNearbyProviders called with:", { pickupLocation, dropoffLocation, routeRequestId: routeRequest._id, requestCountry });
        // Find B2C partners operating in similar areas
        // Note: User model uses 'status' field, not 'isActive'
        const allProviders = await User.find({
            role: "B2C_PARTNER",
            status: "ACTIVE"
        }).select("_id fullName email status role country countryCode");

        // Only notify partners whose effective (identity) country matches the
        // demand's country, so a UAE partner never gets Kuwait demand alerts.
        const nearbyProviders = requestCountry
            ? allProviders.filter((p) => getEffectiveCountry(p) === requestCountry)
            : allProviders;

        console.log(`[v0] ${nearbyProviders.length}/${allProviders.length} B2C partners match country ${requestCountry || "ANY"}`);

        // Get passenger info for the notification
        const passenger = await User.findById(routeRequest.passengerId);
        const passengerName = passenger?.fullName || "A passenger";

        console.log("[v0] Passenger info:", { passengerId: routeRequest.passengerId, passengerName });

        // Send notifications to relevant providers
        for (const provider of nearbyProviders) {

            // Fetch B2C partner routes from the separate collection
            const providerRoutes = await B2CPartnerRoute.find({
                partnerId: provider._id,
                isActive: true
            });

            const hasSimilarRoute = providerRoutes?.some(route =>
                route.fromLocation?.includes(pickupLocation.split(' ')[0]) ||
                route.toLocation?.includes(dropoffLocation.split(' ')[0])
            );

            // Send to all B2C partners for now (or filter by hasSimilarRoute if needed)
            // Real-time notification for all B2C partners
            const notificationResult = await createNotification({
                userId: provider._id,
                type: "NEW_ROUTE_REQUEST",
                title: "New Route Request!",
                message: `${passengerName} requested a route from ${pickupLocation} to ${dropoffLocation}`,
                data: {
                    requestId: routeRequest._id,
                    pickupLocation,
                    dropoffLocation,
                    preferredTime: routeRequest.preferredTime,
                    requestType: routeRequest.requestType,
                    demandCount: routeRequest.demandCount,
                    passengerId: routeRequest.passengerId,
                },
            });

            console.log(`[v0] Notification created for ${provider._id}:`, notificationResult ? notificationResult._id : 'FAILED');

            // Also send email to providers with similar routes
            if (hasSimilarRoute) {
                await sendEmail({
                    to: provider.email,
                    subject: "New Route Request in Your Area",
                    template: "routeRequestNotification",
                    data: {
                        providerName: provider.fullName,
                        pickupLocation,
                        dropoffLocation,
                        demandCount: routeRequest.demandCount,
                        requestId: routeRequest._id
                    }
                });
            }
        }
        console.log(`[v0] Route request notifications sent to ${nearbyProviders.length} B2C partners`);
    } catch (error) {

        console.error("Error notifying providers:", error);
    }
};

const notifyPassengerOfResponse = async (routeRequest) => {
    try {
        const passenger = await User.findById(routeRequest.passengerId);
        const provider = await User.findById(routeRequest.assignedProviderId);
        const providerName = provider?.fullName || provider?.companyName || "A transport provider";

        if (passenger) {
            // Determine notification message based on status
            const statusMessages = {
                APPROVED: `Great news! ${providerName} has approved your route request from ${routeRequest.pickupLocation} to ${routeRequest.dropoffLocation}`,
                REJECTED: `${providerName} was unable to fulfill your route request from ${routeRequest.pickupLocation} to ${routeRequest.dropoffLocation}`,
                UNDER_REVIEW: `${providerName} is reviewing your route request from ${routeRequest.pickupLocation} to ${routeRequest.dropoffLocation}`,
            };

            const statusTitles = {
                APPROVED: "Route Request Approved!",
                REJECTED: "Route Request Update",
                UNDER_REVIEW: "Route Request Under Review",
            };

            // Send real-time notification to commuter
            await createNotification({
                userId: passenger._id,
                type: "ROUTE_REQUEST_RESPONSE",
                title: statusTitles[routeRequest.status] || "Route Request Update",
                message: statusMessages[routeRequest.status] || `Your route request has been updated to ${routeRequest.status}`,
                data: {
                    requestId: routeRequest._id,
                    pickupLocation: routeRequest.pickupLocation,
                    dropoffLocation: routeRequest.dropoffLocation,
                    status: routeRequest.status,
                    providerResponse: routeRequest.providerResponse,
                    estimatedPrice: routeRequest.estimatedPrice,
                    providerId: routeRequest.assignedProviderId,
                    providerName: providerName,
                },
            });

            // Also send email
            await sendEmail({
                to: passenger.email,
                subject: "Response to Your Route Request",
                template: "routeRequestResponse",
                data: {
                    passengerName: passenger.fullName,
                    pickupLocation: routeRequest.pickupLocation,
                    dropoffLocation: routeRequest.dropoffLocation,
                    providerResponse: routeRequest.providerResponse,
                    estimatedPrice: routeRequest.estimatedPrice,
                    status: routeRequest.status
                }
            });
            console.log(`[v0] Route request response notification sent to passenger: ${passenger._id}`);
        }
    } catch (error) {
        console.error("Error notifying passenger:", error);
    }
};

// Notify commuters in a corridor that a B2C partner expressed interest.
const notifyPassengersOfInterest = async (routeRequest, providerId) => {
    try {
        const provider = await User.findById(providerId);
        const providerName = provider?.companyName || provider?.fullName || "A transport provider";
        const passenger = await User.findById(routeRequest.passengerId);
        if (passenger) {
            await createNotification({
                userId: passenger._id,
                type: "ROUTE_REQUEST_RESPONSE",
                title: "A Partner is Interested in Your Route!",
                message: `${providerName} expressed interest in serving the route from ${routeRequest.pickupLocation} to ${routeRequest.dropoffLocation}. We'll notify you once it's available to book.`,
                data: {
                    requestId: routeRequest._id,
                    pickupLocation: routeRequest.pickupLocation,
                    dropoffLocation: routeRequest.dropoffLocation,
                    status: "UNDER_REVIEW",
                    providerId,
                    providerName,
                },
            });
        }
    } catch (error) {
        console.error("Error notifying passengers of interest:", error);
    }
};

const getNearbyProviderCount = async (pickupLocation, dropoffLocation) => {
    try {
        const count = await User.countDocuments({
            role: "B2C_PARTNER",
            status: "ACTIVE"
        });
        return count;
    } catch (error) {
        return 0;
    }
};

// ======================================================
// COMMUTER: ALREADY-REQUESTED ROUTES
// ------------------------------------------------------
// Shown inside the "Request a Route" modal so a commuter can see the corridors
// OTHER commuters have already requested and simply "show interest" instead of
// filling the form and creating a duplicate request. Corridors are grouped
// (case-insensitive), scoped to the commuter's own country, and each reports
// how many DISTINCT commuters want it. We include still-active demand
// (PENDING/UNDER_REVIEW/OPEN) as well as launched corridors (APPROVED/FULFILLED)
// so the commuter also learns a route already exists and shouldn't be
// re-requested. Only terminal states (REJECTED/COMPLETED) are excluded.
// ======================================================
export const getMostRequestedRoutes = async (req, res) => {
    try {
        const commuterId = req.userId;
        const { limit = 12 } = req.query;

        const commuter = await User.findById(commuterId).select("role country countryCode");
        const commuterCountry = commuter ? normalizeCountry(getEffectiveCountry(commuter)) : null;

        const match = {
            status: { $in: ["PENDING", "UNDER_REVIEW", "OPEN", "APPROVED", "FULFILLED"] },
        };
        if (commuterCountry) match.country = commuterCountry;

        const clusters = await RouteRequest.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        pickup: { $toLower: "$pickupLocation" },
                        dropoff: { $toLower: "$dropoffLocation" },
                    },
                    primaryRequestId: { $first: "$_id" },
                    passengerIds: { $addToSet: "$passengerId" },
                    pickupLocation: { $first: "$pickupLocation" },
                    dropoffLocation: { $first: "$dropoffLocation" },
                    preferredTimes: { $addToSet: "$preferredTime" },
                    requestTypes: { $addToSet: "$requestType" },
                    travelDays: { $first: "$travelDays" },
                    statuses: { $addToSet: "$status" },
                    createdAt: { $min: "$createdAt" },
                },
            },
            {
                $project: {
                    primaryRequestId: 1,
                    passengerIds: 1,
                    pickupLocation: 1,
                    dropoffLocation: 1,
                    preferredTimes: 1,
                    requestTypes: 1,
                    travelDays: 1,
                    statuses: 1,
                    createdAt: 1,
                    demandCount: { $size: "$passengerIds" },
                },
            },
            { $sort: { demandCount: -1, createdAt: -1 } },
            { $limit: Number(limit) },
        ]);

        const routes = clusters.map((c) => {
            const alreadyRequested = (c.passengerIds || []).some(
                (id) => String(id) === String(commuterId)
            );
            // A corridor is "launched" once a partner route is published/approved
            // for it — commuters should book it rather than register fresh demand.
            const launched =
                c.statuses.includes("FULFILLED") || c.statuses.includes("APPROVED");
            const isOpen =
                c.statuses.includes("OPEN") || c.statuses.includes("UNDER_REVIEW");
            const stage = launched ? "LAUNCHED" : isOpen ? "OPEN" : "PENDING";
            return {
                requestId: c.primaryRequestId,
                pickupLocation: c.pickupLocation,
                dropoffLocation: c.dropoffLocation,
                preferredTime: (c.preferredTimes || [])[0] || "8:00 AM",
                requestType: (c.requestTypes || [])[0] || "MONTHLY",
                travelDays: c.travelDays || ["MON", "TUE", "WED", "THU", "FRI"],
                demandCount: c.demandCount,
                alreadyRequested,
                launched,
                stage,
                status: stage,
            };
        });

        // Surface actively-gathering demand first; launched corridors last.
        routes.sort((a, b) => {
            if (a.launched !== b.launched) return a.launched ? 1 : -1;
            return b.demandCount - a.demandCount;
        });

        return res.status(200).json({ success: true, data: { routes } });
    } catch (error) {
        console.error("Error fetching most requested routes:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching most requested routes",
            error: error.message,
        });
    }
};

// ======================================================
// COMMUTER: SHOW INTEREST IN AN EXISTING CORRIDOR
// ------------------------------------------------------
// Adds the commuter to an existing demand corridor (incrementing its distinct
// demand count) instead of creating a fresh, unrelated duplicate request.
// ======================================================
export const showInterestInRoute = async (req, res) => {
    try {
        const commuterId = req.userId;
        const {
            pickupLocation,
            dropoffLocation,
            preferredTime,
            requestType,
            travelDays,
            expectedStartDate,
        } = req.body;

        if (!pickupLocation || !dropoffLocation) {
            return res.status(400).json({
                success: false,
                message: "Pickup and dropoff locations are required",
            });
        }

        const passenger = await User.findById(commuterId).select(
            "role country countryCode fullName email"
        );
        const requestCountry = resolveRequestCountry(passenger, pickupLocation, dropoffLocation);

        const corridorMatch = {
            pickupLocation: { $regex: `^${escapeRegex(pickupLocation)}$`, $options: "i" },
            dropoffLocation: { $regex: `^${escapeRegex(dropoffLocation)}$`, $options: "i" },
            status: { $nin: ["REJECTED", "COMPLETED"] },
            ...(requestCountry ? { country: requestCountry } : {}),
        };

        // If the commuter already has an active request on this corridor, don't
        // duplicate — just acknowledge their existing interest.
        const own = await RouteRequest.findOne({ ...corridorMatch, passengerId: commuterId });
        if (own) {
            return res.status(200).json({
                success: true,
                alreadyInterested: true,
                message: "You've already requested this route. We'll notify you when it's available.",
                data: { requestId: own._id },
            });
        }

        // If a partner has already launched a route for this corridor, there's
        // no point gathering more demand — the commuter should just book it.
        const launched = await RouteRequest.findOne({
            ...corridorMatch,
            status: { $in: ["APPROVED", "FULFILLED"] },
        });
        if (launched) {
            return res.status(200).json({
                success: true,
                launched: true,
                message: "Good news — a route for this trip is already available. Search to book it.",
                data: { requestId: launched._id },
            });
        }

        // Group with the rest of the corridor demand from OTHER commuters.
        const similarRequests = await RouteRequest.find({
            ...corridorMatch,
            passengerId: { $ne: commuterId },
        });

        const start = expectedStartDate
            ? new Date(expectedStartDate)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);

        const routeRequest = new RouteRequest({
            passengerId: commuterId,
            country: requestCountry,
            pickupLocation,
            dropoffLocation,
            preferredTime: preferredTime || "8:00 AM",
            requestType: requestType || "MONTHLY",
            travelDays: travelDays || ["MON", "TUE", "WED", "THU", "FRI"],
            expectedStartDate: start,
            similarRequests: similarRequests.map((r) => r._id),
            demandCount: similarRequests.length + 1,
        });
        await routeRequest.save();

        // Keep the whole cluster's demand count / links in sync.
        await RouteRequest.updateMany(
            { _id: { $in: similarRequests.map((r) => r._id) } },
            { $push: { similarRequests: routeRequest._id }, $inc: { demandCount: 1 } }
        );

        // Alert matching partners about the increased demand.
        await notifyNearbyProviders(pickupLocation, dropoffLocation, routeRequest, requestCountry);

        return res.status(201).json({
            success: true,
            message: "Interest registered! You've joined the demand for this route.",
            data: {
                requestId: routeRequest._id,
                demandCount: routeRequest.demandCount,
            },
        });
    } catch (error) {
        console.error("Error showing interest in route:", error);
        return res.status(500).json({
            success: false,
            message: "Error registering interest",
            error: error.message,
        });
    }
};
