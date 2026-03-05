import axios from "axios";
import User from "../models/User.js";

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
                nationality: "Kuwait",
            });

            return res.status(200).json({
                success: true,
                nationality: "Kuwait",
                country: "Kuwait",
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