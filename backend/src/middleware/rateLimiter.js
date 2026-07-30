/**
 * rateLimiter
 * -----------
 * Lightweight, dependency-free in-memory rate limiter for public endpoints
 * (e.g. the public lead-capture form). Keyed by client IP + route key.
 *
 * NOTE: This is per-process. It is sufficient to stop casual abuse / accidental
 * double-submits on a single instance. For multi-instance deployments a shared
 * store (Redis) would be required, but that is out of scope here.
 */

const buckets = new Map() // key -> { count, resetAt }

// Periodically clear expired buckets so the map does not grow unbounded.
setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(key)
    }
}, 60 * 1000).unref?.()

/**
 * @param {Object} opts
 * @param {number} opts.windowMs  Time window in ms (default 60s).
 * @param {number} opts.max       Max requests per window (default 10).
 * @param {string} opts.keyName   Namespace so different routes don't share buckets.
 */
export const rateLimit = ({ windowMs = 60 * 1000, max = 10, keyName = "default" } = {}) => {
    return (req, res, next) => {
        try {
            const ip =
                (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
                req.socket?.remoteAddress ||
                req.ip ||
                "unknown"
            const key = `${keyName}:${ip}`
            const now = Date.now()

            let bucket = buckets.get(key)
            if (!bucket || bucket.resetAt <= now) {
                bucket = { count: 0, resetAt: now + windowMs }
                buckets.set(key, bucket)
            }

            bucket.count += 1

            if (bucket.count > max) {
                const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
                res.set("Retry-After", String(retryAfter))
                return res.status(429).json({
                    success: false,
                    message: "Too many requests. Please wait a moment and try again.",
                })
            }
            next()
        } catch (e) {
            // Never block a request because the limiter itself failed.
            next()
        }
    }
}

export default rateLimit
