import ExpansionWaitlist from "../models/ExpansionWaitlist.js";
import { sendEmail } from "../Services/emailService.js";

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

/**
 * GET /api/admin/expansion-waitlist/countries  (admin only)
 * Returns list of all countries with pending notifications (notified: false).
 * Includes count of users per country.
 */
export const getCountriesWithPendingNotifications = async (req, res) => {
    try {
        // Aggregate: find unique countries where notified is false, count users.
        const countries = await ExpansionWaitlist.aggregate([
            { $match: { notified: false } },
            {
                $group: {
                    _id: "$country",
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const formattedCountries = countries.map((c) => ({
            country: c._id,
            pendingCount: c.count,
        }));

        return res.status(200).json({
            success: true,
            countries: formattedCountries,
            totalCountries: formattedCountries.length,
        });
    } catch (error) {
        console.error("[v0] getCountriesWithPendingNotifications error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch countries.",
        });
    }
};

/**
 * GET /api/admin/expansion-waitlist/country/:country  (admin only)
 * Returns all pending waitlist entries for a specific country.
 */
export const getWaitlistByCountry = async (req, res) => {
    try {
        const { country } = req.params;
        const { notified } = req.query; // Filter by notified status if provided

        if (!country || !country.trim()) {
            return res.status(400).json({
                success: false,
                message: "Country parameter is required.",
            });
        }

        const query = { country: country.trim() };
        if (notified !== undefined) {
            query.notified = notified === "true";
        }

        const entries = await ExpansionWaitlist.find(query)
            .select("email createdAt")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            country: country.trim(),
            total: entries.length,
            entries,
        });
    } catch (error) {
        console.error("[v0] getWaitlistByCountry error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch waitlist for country.",
        });
    }
};

/**
 * POST /api/admin/expansion-waitlist/notify  (admin only)
 * Sends notification emails to all users in a country who haven't been notified yet.
 * Body: { country, subject, template }
 */
export const sendNotificationsForCountry = async (req, res) => {
    try {
        const { country, subject, template } = req.body;

        if (!country || !country.trim()) {
            return res.status(400).json({
                success: false,
                message: "Country is required.",
            });
        }

        // Validate template is not empty
        if (!template || template.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Email template/message is required. Cannot send empty emails.",
            });
        }

        // Fetch all unnotified users for this country.
        const users = await ExpansionWaitlist.find({
            country: country.trim(),
            notified: false,
        });

        if (users.length === 0) {
            return res.status(200).json({
                success: true,
                message: `No pending users to notify in ${country}.`,
                sent: 0,
                failed: 0,
            });
        }

        let sent = 0;
        let failed = 0;
        const failedEmails = [];

        // Send email to each user.
        for (const user of users) {
            try {
                // Build a personalized email using the template.
                const emailSubject = subject || `Drive Me Go is now available in ${country}!`;
                let emailBody = template.trim(); // Use provided template (already validated as non-empty)

                // Personalize template (replace placeholders).
                // Only {country} placeholder is available since users only provide email.
                const personalizedBody = emailBody
                    .replace(/\{country\}/g, country)
                    .replace(/\{email\}/g, user.email);

                // Send via existing emailService - correct signature: (email, subject, body, options)
                console.log(`[v0] Sending email to ${user.email} for ${country}`);
                const emailResult = await sendEmail(user.email, emailSubject, personalizedBody);

                console.log(`[v0] Email result for ${user.email}:`, emailResult);

                if (!emailResult || !emailResult.success) {
                    throw new Error(emailResult?.message || "Email service returned failure");
                }

                // Mark as notified.
                await ExpansionWaitlist.updateOne(
                    { _id: user._id },
                    { $set: { notified: true, notifiedAt: new Date() } }
                );

                sent++;
            } catch (emailError) {
                console.error(`[v0] Failed to notify ${user.email}:`, emailError.message);
                failed++;
                failedEmails.push(user.email);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Notification process completed for ${country}.`,
            sent,
            failed,
            failedEmails: failed > 0 ? failedEmails : null,
            total: users.length,
        });
    } catch (error) {
        console.error("[v0] sendNotificationsForCountry error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send notifications.",
        });
    }
};

/**
 * POST /api/admin/expansion-waitlist/notify-single  (admin only)
 * Sends a notification to a single user manually.
 * Body: { email, country, subject, message }
 */
export const sendSingleNotification = async (req, res) => {
    try {
        const { email, country, subject, message } = req.body;

        if (!email || !country) {
            return res.status(400).json({
                success: false,
                message: "Email and country are required.",
            });
        }

        // Send email.
        const emailResult = await sendEmail(
            email,
            subject || `Drive Me Go is now available in ${country}!`,
            message || `Welcome to Drive Me Go in ${country}!`
        );

        if (!emailResult.success) {
            throw new Error(emailResult.message);
        }

        // Mark this user as notified (if exists).
        await ExpansionWaitlist.updateOne(
            { email: email.toLowerCase(), country },
            { $set: { notified: true, notifiedAt: new Date() } }
        );

        return res.status(200).json({
            success: true,
            message: "Notification sent successfully.",
        });
    } catch (error) {
        console.error("[v0] sendSingleNotification error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send notification.",
        });
    }
};
