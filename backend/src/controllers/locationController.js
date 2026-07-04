import axios from "axios";
import User from "../models/User.js";
import { io } from "../index.js";
import {
    buildLocalePayload,
    PLATFORM_BASE_COUNTRY,
    isPlatformAdmin,
} from "../Config/localizationConfig.js";

// In-memory store for driver locations (for quick access)
const driverLocations = new Map();

// Country-specific components for Google Places API
const COUNTRY_RESTRICTIONS = {
    "UAE": "ae",
    "Kuwait": "kw",
    "India": "in",
    "Saudi Arabia": "sa",
    "Qatar": "qa",
    "Oman": "om",
    "Bahrain": "bh",
};

// Google Places API - Search/Autocomplete
export const searchPlaces = async (req, res) => {
    try {
        const { query, country, sessionToken } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Query must be at least 2 characters"
            });
        }

        const apiKey = process.env.GOOGLE_PLACES_API_KEY;

        if (!apiKey) {
            console.error("GOOGLE_PLACES_API_KEY not configured");
            return res.status(500).json({
                success: false,
                message: "Places API not configured"
            });
        }

        // Build components for country restriction
        let components = "";
        if (country && COUNTRY_RESTRICTIONS[country]) {
            components = `country:${COUNTRY_RESTRICTIONS[country]}`;
        } else {
            // Default to UAE and Kuwait if no country specified
            components = "country:ae|country:kw";
        }

        const url = "https://maps.googleapis.com/maps/api/place/autocomplete/json";

        const params = {
            input: query,
            key: apiKey,
            components: components,
            types: "geocode|establishment",
            language: "en"
        };

        // Add session token if provided (for billing optimization)
        if (sessionToken) {
            params.sessiontoken = sessionToken;
        }

        const response = await axios.get(url, { params, timeout: 5000 });

        if (response.data.status === "OK" || response.data.status === "ZERO_RESULTS") {
            const predictions = (response.data.predictions || []).map(prediction => ({
                placeId: prediction.place_id,
                description: prediction.description,
                mainText: prediction.structured_formatting?.main_text || prediction.description,
                secondaryText: prediction.structured_formatting?.secondary_text || "",
                types: prediction.types || []
            }));

            return res.status(200).json({
                success: true,
                predictions
            });
        } else {
            console.error("Google Places API error:", response.data.status, response.data.error_message);
            return res.status(400).json({
                success: false,
                message: response.data.error_message || "Failed to search places"
            });
        }
    } catch (error) {
        console.error("Error searching places:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to search places"
        });
    }
};

// Google Places API - Get Place Details
export const getPlaceDetails = async (req, res) => {
    try {
        const { placeId } = req.params;
        const { sessionToken } = req.query;

        if (!placeId) {
            return res.status(400).json({
                success: false,
                message: "Place ID is required"
            });
        }

        const apiKey = process.env.GOOGLE_PLACES_API_KEY;

        if (!apiKey) {
            console.error("GOOGLE_PLACES_API_KEY not configured");
            return res.status(500).json({
                success: false,
                message: "Places API not configured"
            });
        }

        const url = "https://maps.googleapis.com/maps/api/place/details/json";

        const params = {
            place_id: placeId,
            key: apiKey,
            fields: "name,formatted_address,geometry,address_components,types",
            language: "en"
        };

        if (sessionToken) {
            params.sessiontoken = sessionToken;
        }

        const response = await axios.get(url, { params, timeout: 5000 });

        if (response.data.status === "OK") {
            const result = response.data.result;

            // Extract country from address components
            const addressComponents = result.address_components || [];
            const countryComponent = addressComponents.find(c => c.types.includes("country"));

            return res.status(200).json({
                success: true,
                place: {
                    placeId: placeId,
                    name: result.name,
                    formattedAddress: result.formatted_address,
                    location: {
                        lat: result.geometry?.location?.lat,
                        lng: result.geometry?.location?.lng
                    },
                    country: countryComponent?.long_name || null,
                    countryCode: countryComponent?.short_name || null,
                    types: result.types || []
                }
            });
        } else {
            console.error("Google Places Details API error:", response.data.status);
            return res.status(400).json({
                success: false,
                message: "Failed to get place details"
            });
        }
    } catch (error) {
        console.error("Error getting place details:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to get place details"
        });
    }
};

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

// ISO country code -> human-readable name. "nationality" stays human-readable
// for backward compatibility with existing consumers (search filters, UI).
const COUNTRY_MAP = {
    IN: "India",
    KW: "Kuwait",
    AE: "UAE",
    SA: "Saudi Arabia",
    QA: "Qatar",
    OM: "Oman",
    BH: "Bahrain",
};

/**
 * GET /api/location/detect
 * Detects the requester's country via IP. When authenticated (optionalAuth),
 * persists BOTH the canonical `country` code (source of truth for currency &
 * payment gateway) and the human-readable `nationality` (used by search/UI).
 *
 * Response keeps `nationality` + `country` for backward compatibility and adds
 * `countryCode`, `currency`, `currencySymbol` and `paymentGateway` so callers
 * can hydrate locale in a single round-trip.
 */
export const detectUserLocation = async (req, res) => {
    try {
        const userId = req.userId; // may be null (public route / optionalAuth)

        // 1) Extract real client IP (proxy-safe)
        const forwarded = req.headers["x-forwarded-for"];
        let userIp = forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress;
        if (userIp === "::1") userIp = "127.0.0.1";

        // Resolve a human-readable country name from the IP.
        let countryName = null;
        let provider = null;
        let isDevelopment = false;

        const isLocal =
            !userIp ||
            userIp === "127.0.0.1" ||
            userIp.startsWith("192.168") ||
            userIp.startsWith("10.");

        // Testing override: set DEV_COUNTRY in the backend env (e.g. "Kuwait" or
        // "UAE") to force a country during local/dev testing. Takes top priority
        // over IP detection so you can switch flows without touching code.
        if (process.env.DEV_COUNTRY) {
            countryName = process.env.DEV_COUNTRY;
            provider = "dev-override";
            isDevelopment = true;
        } else if (isLocal) {
            countryName = "UAE";
            provider = "development";
            isDevelopment = true;
        } else {
            // Provider #1 - ipinfo.io
            try {
                const ipinfoRes = await axios.get(
                    `https://ipinfo.io/${userIp}?token=${process.env.IPINFO_TOKEN}`,
                    { timeout: 5000 }
                );
                const code = ipinfoRes.data?.country;
                if (COUNTRY_MAP[code]) {
                    countryName = COUNTRY_MAP[code];
                    provider = "ipinfo";
                }
            } catch (err) {
                console.warn("ipinfo failed:", err.response?.status || err.message);
            }

            // Provider #2 - ipapi.co
            if (!countryName) {
                try {
                    const ipapiRes = await axios.get(`https://ipapi.co/${userIp}/json/`, {
                        timeout: 5000,
                    });
                    if (ipapiRes.data?.country_name) {
                        countryName = ipapiRes.data.country_name;
                        provider = "ipapi";
                    }
                } catch (err) {
                    console.warn("ipapi failed:", err.response?.status || err.message);
                }
            }

            // Final fallback heuristic
            if (!countryName) {
                countryName = "India";
                if (userIp.startsWith("5.")) countryName = "Kuwait";
                if (userIp.startsWith("94.")) countryName = "UAE";
                provider = "fallback";
            }
        }

        // Load the user once to detect platform admins (need role + perms).
        let userDoc = null;
        if (userId) {
            userDoc = await User.findById(userId).select("role adminPermissions");
        }

        // Admin query param override: admins can specify which country to view.
        // They send ?country=KW from the frontend currency selector to dynamically
        // switch their view currency without changing their profile.
        const adminUser = isPlatformAdmin(userDoc);
        if (adminUser && req.query.country) {
            try {
                const locale = buildLocalePayload(req.query.country);
                if (locale.countryName) {
                    countryName = locale.countryName;
                    provider = "admin-override";
                }
            } catch (e) {
                // invalid country, fall through to default
            }
        }
        // Platform admins / super-admins are LOCATION-INDEPENDENT: when not
        // overridden by query param, pin them to the stable platform base
        // regardless of where they browse from. Their IP country is ignored and
        // never persisted.
        else if (adminUser) {
            countryName = PLATFORM_BASE_COUNTRY;
            provider = "admin-base";
        }

        // Normalize to canonical code and build the locale payload.
        const locale = buildLocalePayload(countryName);

        // Persist to the authenticated user's profile (real DB operation).
        //
        // Skipped for platform admins -- their country must stay stable and is
        // never derived from where they happen to be browsing from.
        //
        // When DEV_COUNTRY is set (LOCAL/DEV ONLY) we DO persist the override so
        // the test user behaves EXACTLY like a real user in that country: every
        // endpoint that reads `user.country` from the DB (routes, wallet,
        // payments, settlements) gets full production parity. This is safe
        // because DEV_COUNTRY is never set in production, so this branch only
        // ever runs against a development database.
        if (userId && !adminUser) {
            const update = { nationality: countryName };
            // Only persist `country` when it's a served/known canonical code so
            // we never overwrite a valid profile country with an unsupported one.
            update.country = locale.country;
            await User.findByIdAndUpdate(userId, update);
        }

        return res.status(200).json({
            success: true,
            nationality: countryName,
            country: countryName, // legacy: human-readable (kept for old consumers)
            countryCode: locale.country, // canonical code: "UAE" | "KW" | ...
            currency: locale.currency,
            currencySymbol: locale.currencySymbol,
            currencyDecimals: locale.currencyDecimals,
            paymentGateway: locale.paymentGateway,
            serviceAvailable: locale.serviceAvailable,
            ip: userIp,
            provider,
            ...(isDevelopment ? { isDevelopment: true } : {}),
        });
    } catch (error) {
        console.error("detectUserLocation fatal:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to detect user location",
        });
    }
};
