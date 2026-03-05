import RouteRequest from "../models/RouteRequest.js";
import User from "../models/User.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import { sendEmail } from "../Services/emailService.js";

// Create new route request
export const createRouteRequest = async (req, res) => {
    try {
        const {
            pickupLocation,
            dropoffLocation,
            preferredTime,
            requestType,
            travelDays,
            expectedStartDate,
            coordinates
        } = req.body;

        const passengerId = req.userId;

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
            coordinates,
            similarRequests: similarRequests.map(req => req._id),
            demandCount: similarRequests.length + 1
        });

        await routeRequest.save();

        // Update similar requests with this request
        await RouteRequest.updateMany(
            { _id: { $in: similarRequests.map(req => req._id) } },
            { $push: { similarRequests: routeRequest._id }, $inc: { demandCount: 1 } }
        );

        // Notify nearby B2C partners
        await notifyNearbyProviders(pickupLocation, dropoffLocation, routeRequest);

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

// Provider responds to route request
export const respondToRouteRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { response, estimatedPrice, status } = req.body;
        const providerId = req.userId;

        if (!requestId || !response) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const routeRequest = await RouteRequest.findById(requestId);
        if (!routeRequest) {
            return res.status(404).json({
                success: false,
                message: "Route request not found"
            });
        }

        if (routeRequest.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: "Route request is no longer pending"
            });
        }

        // Update route request
        routeRequest.assignedProviderId = providerId;
        routeRequest.providerResponse = response;
        routeRequest.estimatedPrice = estimatedPrice;
        routeRequest.status = status || "UNDER_REVIEW";

        await routeRequest.save();

        // Notify passenger
        await notifyPassengerOfResponse(routeRequest);

        res.status(200).json({
            success: true,
            message: "Response submitted successfully",
            data: {
                requestId: routeRequest._id,
                status: routeRequest.status
            }
        });

    } catch (error) {
        console.error("Error responding to route request:", error);
        res.status(500).json({
            success: false,
            message: "Error submitting response",
            error: error.message
        });
    }
};

// Helper functions
const notifyNearbyProviders = async (pickupLocation, dropoffLocation, routeRequest) => {
    try {
        // Find B2C partners operating in similar areas
        const nearbyProviders = await User.find({
            role: "B2C_PARTNER",
            isActive: true
        }).populate('b2cPartnerRoutes');

        // Send notifications to relevant providers
        for (const provider of nearbyProviders) {
            const hasSimilarRoute = provider.b2cPartnerRoutes?.some(route => 
                route.fromLocation.includes(pickupLocation.split(' ')[0]) ||
                route.toLocation.includes(dropoffLocation.split(' ')[0])
            );

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
    } catch (error) {
        console.error("Error notifying providers:", error);
    }
};

const notifyPassengerOfResponse = async (routeRequest) => {
    try {
        const passenger = await User.findById(routeRequest.passengerId);
        if (passenger) {
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
        }
    } catch (error) {
        console.error("Error notifying passenger:", error);
    }
};

const getNearbyProviderCount = async (pickupLocation, dropoffLocation) => {
    try {
        const count = await User.countDocuments({
            role: "B2C_PARTNER",
            isActive: true
        });
        return count;
    } catch (error) {
        return 0;
    }
};
