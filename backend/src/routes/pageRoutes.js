import express from "express";
import Page from "../models/Page.js";
import SiteSettings from "../models/SiteSettings.js";
import { verifyToken, checkAdminRole } from "../middleware/auth.js";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get site settings (public) - MUST come before :slug route
router.get("/public/settings", async (req, res) => {
    try {
        let settings = await SiteSettings.findOne();

        if (!settings) {
            settings = await SiteSettings.create({});
        }

        res.status(200).json({
            success: true,
            data: settings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching site settings",
            error: error.message,
        });
    }
});

// Get online payment status (public) - for users to check if online payments are enabled
router.get("/public/payment-settings", async (req, res) => {
    try {
        let settings = await SiteSettings.findOne();

        if (!settings) {
            settings = await SiteSettings.create({});
        }

        const paymentControl = settings.paymentControl || {
            onlinePaymentsEnabled: true,
            lastToggled: null,
        };

        res.status(200).json({
            success: true,
            data: {
                onlinePaymentsEnabled: paymentControl.onlinePaymentsEnabled !== false,
                lastUpdated: paymentControl.lastToggled,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching payment settings",
            error: error.message,
        });
    }
});

// Get admin cash collection details (public) - shown to any user who selects a
// Cash payment method so they know exactly where to transfer / drop off the
// cash before the admin verifies and approves the payment. These are the
// business's own collection details (meant to be shared with paying customers),
// sourced from the Admin Configuration in the backend environment.
router.get("/public/cash-payment-details", async (req, res) => {
    try {
        const hasBank = Boolean(
            process.env.ADMIN_ACCOUNT_NUMBER || process.env.ADMIN_IBAN,
        );
        const hasOffice = Boolean(process.env.ADMIN_OFFICE_ADDRESS);

        res.status(200).json({
            success: true,
            data: {
                bankTransfer: hasBank
                    ? {
                        bankName: process.env.ADMIN_BANK_NAME || "",
                        accountName: process.env.ADMIN_ACCOUNT_NAME || "",
                        accountNumber: process.env.ADMIN_ACCOUNT_NUMBER || "",
                        iban: process.env.ADMIN_IBAN || "",
                        swiftCode: process.env.ADMIN_SWIFT_CODE || "",
                    }
                    : null,
                office: hasOffice
                    ? {
                        name: process.env.ADMIN_OFFICE_NAME || "",
                        address: process.env.ADMIN_OFFICE_ADDRESS || "",
                        hours: process.env.ADMIN_OFFICE_HOURS || "",
                    }
                    : null,
                contact: {
                    phone: process.env.ADMIN_CONTACT_PHONE || "",
                    email: process.env.ADMIN_CONTACT_EMAIL || "",
                },
                instructions:
                    process.env.ADMIN_PAYMENT_INSTRUCTIONS ||
                    "Complete your cash payment using the details above. Your payment will be activated once the admin verifies it.",
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching cash payment details",
            error: error.message,
        });
    }
});

// Get a published page by slug (public)
router.get("/public/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        const page = await Page.findOne({ slug, isPublished: true });

        if (!page) {
            return res.status(404).json({
                success: false,
                message: "Page not found",
            });
        }

        res.status(200).json({
            success: true,
            data: page,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching page",
            error: error.message,
        });
    }
});

// ==================== ADMIN ROUTES ====================

// Get all pages (admin)
router.get("/admin/all", verifyToken, checkAdminRole, async (req, res) => {
    try {
        const pages = await Page.find().sort({ slug: 1 });

        // If no pages exist, create default ones
        if (pages.length === 0) {
            const defaultPages = [
                {
                    slug: "terms-and-conditions",
                    title: "Terms & Conditions",
                    content: "<h1>Terms & Conditions</h1><p>Please add your terms and conditions here.</p>",
                },
                {
                    slug: "privacy-policy",
                    title: "Privacy Policy",
                    content: "<h1>Privacy Policy</h1><p>Please add your privacy policy here.</p>",
                },
                {
                    slug: "refund-policy",
                    title: "Refund Policy",
                    content: "<h1>Refund Policy</h1><p>Please add your refund policy here.</p>",
                },
                {
                    slug: "contact-us",
                    title: "Contact Us",
                    content: "<h1>Contact Us</h1><p>Please add your contact information here.</p>",
                },
            ];

            await Page.insertMany(defaultPages);
            const createdPages = await Page.find().sort({ slug: 1 });

            return res.status(200).json({
                success: true,
                data: createdPages,
            });
        }

        res.status(200).json({
            success: true,
            data: pages,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching pages",
            error: error.message,
        });
    }
});

// Get a single page by slug (admin)
router.get("/admin/:slug", verifyToken, checkAdminRole, async (req, res) => {
    try {
        const { slug } = req.params;
        const page = await Page.findOne({ slug });

        if (!page) {
            return res.status(404).json({
                success: false,
                message: "Page not found",
            });
        }

        res.status(200).json({
            success: true,
            data: page,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching page",
            error: error.message,
        });
    }
});

// Update a page (admin)
router.put("/admin/:slug", verifyToken, checkAdminRole, async (req, res) => {
    try {
        const { slug } = req.params;
        const { title, content, metaDescription, isPublished } = req.body;

        const page = await Page.findOneAndUpdate(
            { slug },
            {
                title,
                content,
                metaDescription,
                isPublished,
                lastUpdatedBy: req.userId,
            },
            { new: true, upsert: true }
        );

        res.status(200).json({
            success: true,
            message: "Page updated successfully",
            data: page,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating page",
            error: error.message,
        });
    }
});

// Get site settings (admin)
router.get("/admin/settings/all", verifyToken, checkAdminRole, async (req, res) => {
    try {
        let settings = await SiteSettings.findOne();

        if (!settings) {
            settings = await SiteSettings.create({});
        }

        res.status(200).json({
            success: true,
            data: settings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching site settings",
            error: error.message,
        });
    }
});

// Update site settings (admin)
router.put("/admin/settings/update", verifyToken, checkAdminRole, async (req, res) => {
    try {
        const { socialLinks, contactEmail, contactPhone, address } = req.body;

        let settings = await SiteSettings.findOne();

        if (!settings) {
            settings = await SiteSettings.create({
                socialLinks,
                contactEmail,
                contactPhone,
                address,
            });
        } else {
            settings = await SiteSettings.findOneAndUpdate(
                {},
                {
                    socialLinks,
                    contactEmail,
                    contactPhone,
                    address,
                },
                { new: true }
            );
        }

        res.status(200).json({
            success: true,
            message: "Site settings updated successfully",
            data: settings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating site settings",
            error: error.message,
        });
    }
});

export default router;
