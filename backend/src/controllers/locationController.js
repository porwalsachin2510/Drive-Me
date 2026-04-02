import axios from "axios";
import User from "../models/User.js";
import { io } from "../index.js";

// In-memory store for driver locations (for quick access)
const driverLocations = new Map();

// Share driver location - used by B2C_PARTNER and B2C_PARTNER_DRIVER
export const shareDriverLocation = async (req, res) => {
    try {
        const { lat, lng, driverId, driverType, timestamp, bookingId, tripId } = req.body;

        if (!lat || !lng || !driverId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: lat, lng, driverId"
            });
        }

        // Store location in memory
        driverLocations.set(driverId, {
            lat,
            lng,
            driverId,
            driverType,
            timestamp: timestamp || new Date().toISOString(),
            bookingId,
            tripId,
            lastUpdated: Date.now()
        });

        // Emit location update via socket.io to all connected clients
        if (io) {
            // Broadcast to general location updates
            io.emit('location-update', {
                driverId,
                lat,
                lng,
                timestamp: timestamp || new Date().toISOString(),
                driverType
            });

            // If bookingId is provided, emit to specific booking room
            if (bookingId) {
                io.to(`booking-${bookingId}`).emit('driver-location-update', {
                    driverId,
                    location: { lat, lng },
                    timestamp: timestamp || new Date().toISOString(),
                    bookingId,
                    driverType
                });
            }

            // If tripId is provided, emit to specific trip room
            if (tripId) {
                io.to(`trip-${tripId}`).emit('driver-location-update', {
                    driverId,
                    location: { lat, lng },
                    timestamp: timestamp || new Date().toISOString(),
                    tripId,
                    driverType
                });
            }
        }

        console.log(`📍 Driver ${driverId} (${driverType}) location shared: ${lat}, ${lng}`);

        return res.status(200).json({
            success: true,
            message: "Location shared successfully",
            location: {
                lat,
                lng,
                driverId,
                driverType,
                timestamp: timestamp || new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("Error sharing driver location:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to share location"
        });
    }
};

// Get driver location by ID
export const getDriverLocationById = async (req, res) => {
    try {
        const { driverId } = req.params;

        if (!driverId) {
            return res.status(400).json({
                success: false,
                message: "Driver ID is required"
            });
        }

        const location = driverLocations.get(driverId);

        if (!location) {
            return res.status(404).json({
                success: false,
                message: "Driver location not found",
                isOnline: false
            });
        }

        // Check if location is recent (within last 2 minutes)
        const isOnline = (Date.now() - location.lastUpdated) < 120000;

        return res.status(200).json({
            success: true,
            location: {
                lat: location.lat,
                lng: location.lng,
                timestamp: location.timestamp,
                driverType: location.driverType
            },
            isOnline
        });
    } catch (error) {
        console.error("Error getting driver location:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get driver location"
        });
    }
};

const COUNTRY_MAP = {
    IN: "India",
    KW: "Kuwait",
    AE: "UAE",
    SA: "Saudi Arabia",
    QA: "Qatar",
    OM: "Oman",
    BH: "Bahrain",
};

export const detectUserLocation = async (req, res) => {
    try {
        const userId = req.userId;

        // -----------------------------
        // 1️⃣ Extract real client IP (Render-safe)
        // -----------------------------
        const forwarded = req.headers["x-forwarded-for"];
        let userIp = forwarded
            ? forwarded.split(",")[0].trim()
            : req.socket?.remoteAddress;

        if (userIp === "::1") userIp = "127.0.0.1";

        // -----------------------------
        // 2️⃣ Development / local fallback
        // -----------------------------
        if (
            !userIp ||
            userIp === "127.0.0.1" ||
            userIp.startsWith("192.168") ||
            userIp.startsWith("10.")
        ) {
            await User.findByIdAndUpdate(userId, {
                nationality: "UAE",
            });

            return res.status(200).json({
                success: true,
                nationality: "UAE",
                country: "UAE",
                ip: userIp,
                isDevelopment: true,
            });
        }

        // -----------------------------
        // 3️⃣ Provider #1 — ipinfo.io (BEST)
        // -----------------------------
        try {
            const ipinfoRes = await axios.get(
                `https://ipinfo.io/${userIp}?token=${process.env.IPINFO_TOKEN}`,
                { timeout: 5000 }
            );

            const countryCode = ipinfoRes.data?.country;
            const countryName = COUNTRY_MAP[countryCode];

            if (countryName) {
                await User.findByIdAndUpdate(userId, {
                    nationality: countryName,
                });

                return res.status(200).json({
                    success: true,
                    nationality: countryName,
                    country: countryName,
                    ip: userIp,
                    provider: "ipinfo",
                });
            }
        } catch (err) {
            console.warn("ipinfo failed:", err.response?.status || err.message);
        }

        // -----------------------------
        // 4️⃣ Provider #2 — ipapi.co (Fallback)
        // -----------------------------
        try {
            const ipapiRes = await axios.get(
                `https://ipapi.co/${userIp}/json/`,
                { timeout: 5000 }
            );

            const countryName = ipapiRes.data?.country_name;

            if (countryName) {
                await User.findByIdAndUpdate(userId, {
                    nationality: countryName,
                });

                return res.status(200).json({
                    success: true,
                    nationality: countryName,
                    country: countryName,
                    ip: userIp,
                    provider: "ipapi",
                });
            }
        } catch (err) {
            console.warn("ipapi failed:", err.response?.status || err.message);
        }

        // -----------------------------
        // 5️⃣ Final fallback (NEVER NULL)
        // -----------------------------
        let fallbackCountry = "India";

        // Simple safe heuristics (optional)
        if (userIp.startsWith("5.")) fallbackCountry = "Kuwait";
        if (userIp.startsWith("94.")) fallbackCountry = "UAE";

        await User.findByIdAndUpdate(userId, {
            nationality: fallbackCountry,
        });

        return res.status(200).json({
            success: true,
            nationality: fallbackCountry,
            country: fallbackCountry,
            ip: userIp,
            provider: "fallback",
            warning: "Geo detection failed, fallback applied",
        });
    } catch (error) {
        console.error("detectUserLocation fatal:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to detect user location",
        });
    }
};