/**
 * geocodeController
 * -----------------
 * A thin, well-behaved proxy over the FREE OpenStreetMap stack so the frontend
 * never has to talk to third-party map services directly (which keeps our app
 * name / User-Agent + attribution correct and lets us enforce the public
 * server's usage policy centrally):
 *
 *   - Nominatim  -> address <-> coordinates (geocoding & reverse geocoding)
 *   - OSRM       -> road route geometry between two points (route drawing)
 *
 * Nominatim public-server rules we MUST respect (https://operations.osmfoundation.org/policies/nominatim/):
 *   - Max 1 request/second (no bulk). We serialize calls through a queue so we
 *     never exceed it, no matter how many users hit us at once.
 *   - A valid, identifying User-Agent is required.
 *   - Results should be cached to avoid hammering the server.
 *
 * Everything here is free and requires no API key or credit card. When traffic
 * grows we can point NOMINATIM_BASE_URL / OSRM_BASE_URL at a self-hosted
 * instance via env vars without touching any calling code.
 */

const NOMINATIM_BASE_URL =
    process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org"
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org"
// Identifying User-Agent per Nominatim policy. Override via env in production.
const GEO_USER_AGENT =
    process.env.GEO_USER_AGENT ||
    "DriveMeGo/1.0 (employee-transport platform; hello@drivemekw.com)"

// Bias results toward the countries we operate in (UAE + Kuwait). Nominatim
// accepts ISO 3166-1 alpha-2 codes.
const DEFAULT_COUNTRY_CODES = process.env.GEO_COUNTRY_CODES || "ae,kw"

/* ----------------------------- rate limiting ----------------------------- */
// Serialize all outbound Nominatim calls so at most one runs per second across
// the whole process, honoring the public-server fair-use policy.
const MIN_INTERVAL_MS = 1100
let lastCallAt = 0
let chain = Promise.resolve()

const scheduleNominatim = (fn) => {
    const run = async () => {
        const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now())
        if (wait > 0) await new Promise((r) => setTimeout(r, wait))
        lastCallAt = Date.now()
        return fn()
    }
    // Queue behind the previous call; swallow prior errors so the chain lives on.
    const result = chain.then(run, run)
    chain = result.then(
        () => undefined,
        () => undefined,
    )
    return result
}

/* -------------------------------- caching -------------------------------- */
// Small in-memory LRU-ish cache to avoid repeat lookups (addresses rarely
// change). Keeps the process light and dramatically cuts external calls.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24h
const CACHE_MAX = 1000
const cache = new Map()

const cacheGet = (key) => {
    const hit = cache.get(key)
    if (!hit) return null
    if (Date.now() - hit.at > CACHE_TTL_MS) {
        cache.delete(key)
        return null
    }
    // refresh recency
    cache.delete(key)
    cache.set(key, hit)
    return hit.value
}

const cacheSet = (key, value) => {
    if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(key, { value, at: Date.now() })
}

const fetchJson = async (url) => {
    const res = await fetch(url, {
        headers: {
            "User-Agent": GEO_USER_AGENT,
            Referer: process.env.FRONTEND_URL || "https://drivemekw.com",
            Accept: "application/json",
        },
    })
    if (!res.ok) {
        const text = await res.text().catch(() => "")
        const err = new Error(`Upstream ${res.status}: ${text.slice(0, 120)}`)
        err.status = res.status
        throw err
    }
    return res.json()
}

/**
 * GET /api/geocode/search?q=<address>&limit=5
 * Address -> list of candidate coordinates. Biased to UAE/Kuwait.
 */
export const searchAddress = async (req, res) => {
    try {
        const q = (req.query.q || "").toString().trim()
        if (q.length < 3) {
            return res
                .status(400)
                .json({ success: false, message: "Enter at least 3 characters to search." })
        }
        const limit = Math.min(Number(req.query.limit) || 6, 10)
        const cacheKey = `search:${DEFAULT_COUNTRY_CODES}:${limit}:${q.toLowerCase()}`
        const cached = cacheGet(cacheKey)
        if (cached) return res.json({ success: true, cached: true, data: cached })

        const params = new URLSearchParams({
            q,
            format: "jsonv2",
            addressdetails: "1",
            limit: String(limit),
            countrycodes: DEFAULT_COUNTRY_CODES,
        })
        const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`
        const raw = await scheduleNominatim(() => fetchJson(url))

        const data = (Array.isArray(raw) ? raw : []).map((r) => ({
            displayName: r.display_name,
            lat: Number(r.lat),
            lng: Number(r.lon),
            type: r.type,
            category: r.category || r.class,
            address: r.address || null,
        }))
        cacheSet(cacheKey, data)
        res.json({ success: true, data })
    } catch (error) {
        console.error("[geocode] searchAddress error:", error.message)
        res.status(502).json({
            success: false,
            message: "Address lookup is temporarily unavailable. You can still drop the pin manually.",
        })
    }
}

/**
 * GET /api/geocode/reverse?lat=<>&lng=<>
 * Coordinates -> a human-readable address (used after the user drags the pin).
 */
export const reverseGeocode = async (req, res) => {
    try {
        const lat = Number(req.query.lat)
        const lng = Number(req.query.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return res.status(400).json({ success: false, message: "Valid lat & lng are required." })
        }
        const cacheKey = `reverse:${lat.toFixed(5)}:${lng.toFixed(5)}`
        const cached = cacheGet(cacheKey)
        if (cached) return res.json({ success: true, cached: true, data: cached })

        const params = new URLSearchParams({
            lat: String(lat),
            lon: String(lng),
            format: "jsonv2",
            addressdetails: "1",
        })
        const url = `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`
        const raw = await scheduleNominatim(() => fetchJson(url))

        const data = {
            displayName: raw?.display_name || "",
            lat,
            lng,
            address: raw?.address || null,
        }
        cacheSet(cacheKey, data)
        res.json({ success: true, data })
    } catch (error) {
        console.error("[geocode] reverseGeocode error:", error.message)
        res.status(502).json({
            success: false,
            message: "Could not resolve the address for this point right now.",
        })
    }
}

/**
 * GET /api/geocode/route?from=<lat,lng>&to=<lat,lng>
 * Road route geometry + distance/duration between two points (via OSRM). Used
 * to draw the pickup -> office route line on the map. OSRM has no per-second
 * limit like Nominatim, but we still cache aggressively.
 */
export const routeBetween = async (req, res) => {
    try {
        const parse = (s) => {
            const [a, b] = (s || "").toString().split(",").map(Number)
            return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null
        }
        const from = parse(req.query.from) // [lat, lng]
        const to = parse(req.query.to)
        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: "Provide from and to as 'lat,lng'.",
            })
        }

        const cacheKey = `route:${from.join(",")}:${to.join(",")}`
        const cached = cacheGet(cacheKey)
        if (cached) return res.json({ success: true, cached: true, data: cached })

        // OSRM expects lng,lat order.
        const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`
        const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`
        const raw = await fetchJson(url)

        if (raw?.code !== "Ok" || !raw.routes?.length) {
            return res.status(404).json({ success: false, message: "No route found between these points." })
        }
        const route = raw.routes[0]
        const data = {
            distanceMeters: route.distance,
            durationSeconds: route.duration,
            // GeoJSON is [lng,lat]; convert to [lat,lng] for Leaflet polylines.
            coordinates: (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]),
        }
        cacheSet(cacheKey, data)
        res.json({ success: true, data })
    } catch (error) {
        console.error("[geocode] routeBetween error:", error.message)
        res.status(502).json({
            success: false,
            message: "Routing is temporarily unavailable.",
        })
    }
}
