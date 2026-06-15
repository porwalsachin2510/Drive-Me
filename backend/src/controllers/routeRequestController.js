import RouteRequest from "../models/RouteRequest.js";
import User from "../models/User.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import { sendEmail } from "../Services/emailService.js";
import { createNotification } from "../Services/notificationService.js";

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

        // Find similar requests to group demand
        const similarRequests = await RouteRequest.find({
            pickupLocation,
            dropoffLocation,
            status: { $in: ["PENDING", "UNDER_REVIEW"] },
            passengerId: { $ne: passengerId }
        });

        // Create route request
        const routeRequest = new RouteRequest({
            passengerId,
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

        // Notify nearby B2C partners
        console.log("[v0] Calling notifyNearbyProviders...");
        await notifyNearbyProviders(pickupLocation, dropoffLocation, routeRequest);
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
const notifyNearbyProviders = async (pickupLocation, dropoffLocation, routeRequest) => {
    try {
        console.log("[v0] notifyNearbyProviders called with:", { pickupLocation, dropoffLocation, routeRequestId: routeRequest._id });
        // Find B2C partners operating in similar areas
        // Note: User model uses 'status' field, not 'isActive'
        const nearbyProviders = await User.find({
            role: "B2C_PARTNER",
            status: "ACTIVE"
        });

        console.log(`[v0] Found ${nearbyProviders.length} B2C partners with status ACTIVE:`, nearbyProviders.map(p => ({ id: p._id, name: p.fullName, status: p.status })));

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
