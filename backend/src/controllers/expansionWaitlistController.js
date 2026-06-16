import ExpansionWaitlist from "../models/ExpansionWaitlist.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/expansion-waitlist/join  (public)
 * Adds a user from an unsupported country to the expansion waitlist so we
 * can notify them when Drive Me Go launches in their region.
 */
export const joinWaitlist = async (req, res) => {
    try {
        const {
            email,
            fullName,
            country,
            city,
            pickupLocation,
            dropoffLocation,
            source,
        } = req.body;

        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({
                success: false,
                message: "A valid email address is required.",
            });
        }

        if (!country || !country.trim()) {
            return res.status(400).json({
                success: false,
                message: "Country is required.",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedCountry = country.trim();

        // Upsert: if the user already joined for this country, update their
        // details instead of throwing a duplicate-key error.
        const entry = await ExpansionWaitlist.findOneAndUpdate(
            { email: normalizedEmail, country: normalizedCountry },
            {
                $set: {
                    email: normalizedEmail,
                    country: normalizedCountry,
                    fullName: fullName?.trim() || null,
                    city: city?.trim() || null,
                    pickupLocation: pickupLocation?.trim() || null,
                    dropoffLocation: dropoffLocation?.trim() || null,
                    source: source || "home_page",
                },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // How many people from this country are also waiting.
        const countryCount = await ExpansionWaitlist.countDocuments({
            country: normalizedCountry,
        });

        return res.status(200).json({
            success: true,
            message: `You're on the list! We'll email you the moment Drive Me Go launches in ${normalizedCountry}.`,
            countryCount,
            entry: {
                id: entry._id,
                email: entry.email,
                country: entry.country,
            },
        });
    } catch (error) {
        console.error("[v0] joinWaitlist error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again.",
        });
    }
};

/**
 * GET /api/expansion-waitlist/stats?country=India  (public)
 * Returns how many people are waiting (optionally filtered by country).
 */
export const getWaitlistStats = async (req, res) => {
    try {
        const { country } = req.query;

        const total = await ExpansionWaitlist.countDocuments();
        let countryCount = null;

        if (country && country.trim()) {
            countryCount = await ExpansionWaitlist.countDocuments({
                country: country.trim(),
            });
        }

        return res.status(200).json({
            success: true,
            total,
            country: country?.trim() || null,
            countryCount,
        });
    } catch (error) {
        console.error("[v0] getWaitlistStats error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again.",
        });
    }
};
