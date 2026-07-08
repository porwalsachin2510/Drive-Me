import axios from "axios";
import User from "../models/User.js";
import {
    COUNTRY_CONFIG,
    normalizeCountry,
    buildLocalePayload,
    DEFAULT_COUNTRY,
    PLATFORM_BASE_COUNTRY,
    isPlatformAdmin,
    isCommuter,
    isServedCountry,
    getCountryFromPhoneCode,
} from "../Config/localizationConfig.js";

// Maps geo-provider ISO country codes -> our canonical country codes.
const ISO_TO_CANONICAL = {
    AE: "UAE",
    KW: "KW",
    SA: "SA",
    BH: "BH",
    OM: "OM",
    QA: "QA",
    IN: "IN", // India is detected but not served (handled gracefully)
};

// Human-readable names for ISO codes we may detect but do NOT serve yet. Used
// to power the "coming soon" experience so a commuter physically outside our
// markets sees the actual country name (e.g. "India") rather than a default.
const ISO_TO_NAME = {
    IN: "India",
    US: "United States",
    GB: "United Kingdom",
    PK: "Pakistan",
    EG: "Egypt",
    PH: "Philippines",
    LK: "Sri Lanka",
    NP: "Nepal",
    BD: "Bangladesh",
};

/**
 * Reverse-geocode precise GPS coordinates to an ISO country code using the
 * Google Geocoding API (same key as Places). Returns the ISO short code
 * ("AE", "KW", "IN", ...) or null when it can't be resolved. This is the
 * STRONGEST real signal for a commuter's country — far more reliable than IP —
 * and is what stops someone in the UAE from pretending to be in Kuwait.
 */
const resolveCountryFromCoords = async (lat, lng) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return null;
    try {
        const res = await axios.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            {
                params: {
                    latlng: `${lat},${lng}`,
                    key: apiKey,
                    result_type: "country",
                    language: "en",
                },
                timeout: 5000,
            }
        );
        if (res.data?.status === "OK") {
            for (const result of res.data.results || []) {
                const country = (result.address_components || []).find((c) =>
                    c.types.includes("country")
                );
                if (country?.short_name) return country.short_name.toUpperCase();
            }
        }
    } catch (err) {
        console.warn("[localization] reverse-geocode failed:", err.response?.status || err.message);
    }
    return null;
};

/**
 * Build a locale payload for a commuter who is physically located OUTSIDE the
 * countries we currently serve. For a country that exists in our config but
 * isn't live yet (e.g. SA) we reuse its real config (serviceAvailable is
 * already false there). For a genuinely unknown ISO (e.g. "IN") we synthesize a
 * payload with the human-readable name and serviceAvailable=false so the
 * frontend can render the localized "coming soon" screen.
 */
const buildUnsupportedLocalePayload = (codeOrIso) => {
    const key = String(codeOrIso || "").trim().toUpperCase();
    if (COUNTRY_CONFIG[key]) return buildLocalePayload(key);
    const name = ISO_TO_NAME[key] || key || "your region";
    return {
        ...buildLocalePayload(DEFAULT_COUNTRY),
        country: key || "UNKNOWN",
        countryName: name,
        displayName: name,
        serviceAvailable: false,
    };
};

/**
 * Resolve a canonical country code from the request IP using geo providers.
 * Returns { country, ip, provider } where country may be a non-served code
 * (e.g. "IN") so the caller can decide service availability.
 */
const resolveCountryFromIp = async (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    let userIp = forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress;
    if (userIp === "::1") userIp = "127.0.0.1";
    // Normalize IPv6-mapped IPv4 addresses (e.g. "::ffff:103.48.196.1").
    if (userIp && userIp.startsWith("::ffff:")) userIp = userIp.slice(7);

    // Development / local / private-network fallback (no public IP to geolocate).
    if (
        !userIp ||
        userIp === "127.0.0.1" ||
        userIp.startsWith("192.168") ||
        userIp.startsWith("10.") ||
        userIp.startsWith("172.")
    ) {
        return { country: DEFAULT_COUNTRY, ip: userIp, provider: "development" };
    }

    // Ordered list of IP geolocation providers. Every one works WITHOUT any API
    // key so detection is reliable out of the box — the previous code appended
    // `token=undefined` to ipinfo (→ 403 "Unknown token") and then hit ipapi.co
    // (→ 429 rate-limited on cloud IPs), so it always fell through to the UAE
    // default and showed every visitor (India included) UAE routes. ipinfo's
    // free tier and ipwho.is both return the correct country with no token.
    // IPINFO_TOKEN, when present, is used only to raise ipinfo's rate limit.
    const providers = [
        {
            name: "ipinfo",
            url: process.env.IPINFO_TOKEN
                ? `https://ipinfo.io/${userIp}/json?token=${process.env.IPINFO_TOKEN}`
                : `https://ipinfo.io/${userIp}/json`,
            pick: (d) => d?.country,
        },
        {
            name: "ipwho",
            url: `https://ipwho.is/${userIp}`,
            pick: (d) => (d && d.success === false ? null : d?.country_code),
        },
        {
            name: "ipapi",
            url: `https://ipapi.co/${userIp}/json/`,
            pick: (d) => (d?.error ? null : d?.country_code || d?.country),
        },
    ];

    for (const provider of providers) {
        try {
            const res = await axios.get(provider.url, { timeout: 5000 });
            const iso = provider.pick(res.data);
            if (iso) {
                const up = String(iso).trim().toUpperCase();
                // Keep the RAW ISO for countries we don't serve (e.g. "IN",
                // "US") instead of normalizing them to the UAE default — that is
                // what lets the caller show the correct "coming soon" locale.
                return { country: ISO_TO_CANONICAL[up] || up, ip: userIp, provider: provider.name };
            }
        } catch (err) {
            console.warn(`[localization] ${provider.name} failed:`, err.response?.status || err.message);
        }
    }

    // Final fallback — genuinely could not determine the country.
    return { country: DEFAULT_COUNTRY, ip: userIp, provider: "fallback" };
};

/**
 * GET /api/localization/config
 * The single endpoint the frontend calls to bootstrap locale.
 *
 * Resolution order (source of truth):
 *   1. Explicit ?country= query (manual override / known value)
 *   2. Logged-in user's saved country (DB)
 *   3. IP-based geo detection
 *
 * When a user is authenticated, their detected country is persisted to the
 * DB so currency & payment gateway stay consistent everywhere.
 */
export const getLocalizationConfig = async (req, res) => {
    try {
        const userId = req.userId; // set by optionalAuth (may be null)
        const requested = req.query.country;

        let canonical = null;
        let source = null;
        let detectedRaw = null;

        // Load the user once (need role + adminPermissions to detect admins).
        let userDoc = null;
        if (userId) {
            userDoc = await User.findById(userId).select(
                "country nationality countryCode role adminPermissions"
            );
        }

        const adminUser = isPlatformAdmin(userDoc);
        const commuterUser = !adminUser && isCommuter(userDoc);
        const earnerUser = !!userDoc && !adminUser && !commuterUser;

        // The locale is resolved differently for the three kinds of caller.
        // Getting this order right is what keeps a Kuwait user in KWD even when
        // the request happens to come from a UAE browser / IP / dev machine.

        if (adminUser) {
            // ---- Platform admins / super-admins ----
            // LOCATION-INDEPENDENT. They manage every served country, so they may
            // explicitly pick a view country via the currency selector (?country=).
            // With no selection they default to the stable platform base, never
            // their IP or DEV_COUNTRY. Per-record currencies are shown in each
            // record's own currency elsewhere in the admin UI.
            if (requested) {
                canonical = normalizeCountry(requested);
                source = "query";
            } else {
                canonical = PLATFORM_BASE_COUNTRY;
                source = "admin-base";
            }
        } else if (commuterUser) {
            // ---- Logged-in COMMUTER (consumer / traveller) ----
            // A commuter's country is AUTO-DETECTED from their REAL location so
            // one account works across every served country (Uber/Careem style)
            // WITHOUT letting them hand-pick a market they aren't physically in.
            // A client-supplied ?country= is intentionally NOT trusted here — that
            // was the abuse vector (a commuter in the UAE choosing Kuwait to book
            // Kuwait routes). Resolution priority:
            //   1. DEV_COUNTRY  — local/dev testing override only.
            //   2. Precise GPS coords (?lat=&lng=) reverse-geocoded to a country —
            //      the strongest real signal, sent by the in-app location badge.
            //   3. IP-based geo detection — the fallback when GPS is unavailable.
            // When the detected country is one we serve it becomes their active
            // country and is persisted. When they are physically outside our
            // markets we return a "coming soon" locale for the detected country
            // and leave their stored active country untouched.
            let detected = null;
            let via = null;

            const lat = parseFloat(req.query.lat);
            const lng = parseFloat(req.query.lng);

            if (process.env.DEV_COUNTRY) {
                detected = normalizeCountry(process.env.DEV_COUNTRY);
                via = "dev";
            } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
                const iso = await resolveCountryFromCoords(lat, lng);
                if (iso) {
                    detected = ISO_TO_CANONICAL[iso] || iso;
                    via = "geo";
                }
            }

            if (!detected) {
                const geo = await resolveCountryFromIp(req);
                detectedRaw = geo.country;
                detected = geo.country;
                via = geo.provider === "development" ? "geo-dev" : "ip";
            }

            if (isServedCountry(detected)) {
                canonical = normalizeCountry(detected);
                source = `commuter-${via}`;
            } else if (via === "ip" && userDoc.country) {
                // An IP lookup that didn't land on a served market is unreliable
                // (VPN, carrier routing, etc.) — keep their last known active
                // country rather than churn it or show a false "coming soon".
                canonical = normalizeCountry(userDoc.country);
                source = "commuter";
            } else {
                // Commuter is genuinely outside our served markets (confirmed by
                // GPS, DEV_COUNTRY, or a first-load IP with no stored fallback).
                // Serve the localized "coming soon" experience for the detected
                // country and do NOT overwrite their stored active country.
                const unsupported = buildUnsupportedLocalePayload(detected);
                return res.status(200).json({
                    success: true,
                    ...unsupported,
                    source: `commuter-${via}-unsupported`,
                    detectedRaw,
                });
            }
        } else if (earnerUser) {
            // ---- Logged-in EARNER (B2C/B2B partner, driver, corporate, employee) ----
            // Their country is a fixed business IDENTITY: the single source of
            // truth for currency, wallet, earnings and settlements. It must NEVER
            // be overridden by a client-supplied ?country= param, by DEV_COUNTRY,
            // or by IP geo — a partner who registered in Kuwait keeps seeing KWD
            // even when opening the app from the UAE.
            //
            // SELF-HEAL: the authority for correcting the stored country is the
            // user's own immutable dialing code (e.g. "+965" => KW), the same
            // signal registration uses. This silently repairs legacy/corrupted
            // records (e.g. a Kuwait partner left as "UAE") on the next app load,
            // regardless of DEV_COUNTRY.
            const dialCountry = getCountryFromPhoneCode(userDoc.countryCode);

            if (userDoc.country) {
                const stored = normalizeCountry(userDoc.country);
                if (dialCountry && dialCountry !== stored) {
                    canonical = dialCountry; // corrupted record -> heal from dialing code
                    source = "user-reconciled";
                } else {
                    canonical = stored; // healthy record -> account country wins
                    source = "user";
                }
            } else {
                // Account has no country yet (legacy record). Resolve it ONCE so we
                // can backfill: dialing code -> DEV_COUNTRY (dev only) -> IP geo.
                if (dialCountry) {
                    canonical = dialCountry;
                    source = "user-init-dial";
                } else if (process.env.DEV_COUNTRY) {
                    canonical = normalizeCountry(process.env.DEV_COUNTRY);
                    source = "user-init-dev";
                } else {
                    const geo = await resolveCountryFromIp(req);
                    detectedRaw = geo.country;
                    canonical = normalizeCountry(geo.country);
                    source = `user-init-${geo.provider}`;
                }
            }
        } else {
            // ---- Anonymous visitor (no account yet, e.g. public homepage) ----
            // Here it is fine to be driven by the environment, because there is no
            // account to anchor to. This is the ONLY place DEV_COUNTRY and the
            // persisted client selection are honored for non-admins.
            if (process.env.DEV_COUNTRY) {
                // Local/dev testing: force the country so the whole flow (currency,
                // gateway, routes) can be exercised. Unset in production.
                canonical = normalizeCountry(process.env.DEV_COUNTRY);
                source = "dev-override";
            } else if (requested && isServedCountry(requested)) {
                // A served country the visitor explicitly chose on a previous
                // visit (currency selector). Unserved explicit values fall
                // through to IP detection below rather than being trusted.
                canonical = normalizeCountry(requested);
                source = "query";
            } else {
                // First-time visitor: detect from their REAL location via IP.
                const geo = await resolveCountryFromIp(req);
                detectedRaw = geo.country;
                if (isServedCountry(geo.country)) {
                    canonical = normalizeCountry(geo.country);
                    source = geo.provider;
                } else {
                    // Visitor is physically outside our served markets (e.g.
                    // India). Show the localized "coming soon" experience for
                    // their ACTUAL country instead of silently defaulting them
                    // to UAE routes/prices.
                    const unsupported = buildUnsupportedLocalePayload(geo.country);
                    return res.status(200).json({
                        success: true,
                        ...unsupported,
                        source: `${geo.provider}-unsupported`,
                        detectedRaw,
                    });
                }
            }
        }

        // Persist to the authenticated user's profile in these safe cases:
        //   EARNERS (identity):
        //     1. Backfill — a legacy account with no country/nationality yet.
        //     2. Reconcile — the stored country disagrees with the immutable
        //        dialing code, so we heal it (e.g. a "+965" record saved as "UAE").
        //     We NEVER mutate an earner's country from DEV_COUNTRY, IP, or a
        //     client ?country= — those only drive the response, never the DB.
        //   COMMUTERS (travel context):
        //     3. Auto-detect — their real location (GPS or a confident IP lookup)
        //        resolved to a served market; we save it as their active country.
        //        The "commuter" (kept last-known) and "*-unsupported" (returned
        //        early) cases never reach here, so they never mutate the DB.
        const shouldPersist =
            source === "user-reconciled" ||
            (source &&
                (source.startsWith("user-init") ||
                    source === "commuter-geo" ||
                    source === "commuter-ip" ||
                    source === "commuter-geo-dev" ||
                    source === "commuter-dev"));
        if (shouldPersist) {
            const filled = buildLocalePayload(canonical);
            const fromCountry = userDoc.country || null;
            userDoc.country = filled.country;
            userDoc.nationality = filled.countryName;
            await userDoc.save();
            console.log("[v0] Persisted account country:", {
                userId,
                from: fromCountry,
                to: filled.country,
                nationality: filled.countryName,
                source,
            });
        }

        const locale = buildLocalePayload(canonical);

        return res.status(200).json({
            success: true,
            ...locale,
            source,
            detectedRaw,
        });
    } catch (error) {
        console.error("[localization] getLocalizationConfig error:", error);
        // Never hard-fail locale bootstrap; return a safe default.
        return res.status(200).json({
            success: true,
            ...buildLocalePayload(DEFAULT_COUNTRY),
            source: "error-fallback",
        });
    }
};

export default { getLocalizationConfig };
