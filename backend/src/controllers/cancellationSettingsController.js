import CancellationSettings from "../models/CancellationSettings.js";
import CancellationLedger from "../models/CancellationLedger.js";
import { clearLedgerDues } from "../Services/cashCancellationService.js";

// GET /api/admin/cancellation-settings  (admin)
// Returns the singleton cancellation policy, creating a default if none exists.
export const getCancellationSettings = async (req, res) => {
    try {
        const settings = await CancellationSettings.getSettings();
        res.status(200).json({ success: true, settings });
    } catch (error) {
        console.error("[v0] Error fetching cancellation settings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching cancellation settings",
            error: error.message,
        });
    }
};

// PUT /api/admin/cancellation-settings  (admin)
// Updates the cancellation policy. Validates tiers before saving.
export const updateCancellationSettings = async (req, res) => {
    try {
        const { freeWindowHoursAfterBooking, tiers, isActive, notes, cashPenaltyActive, blockBookingUntilDueCleared } = req.body;

        const settings = await CancellationSettings.getSettings();

        // ===== Cash cancellation policy fields =====
        // Always assign these explicitly (falling back to the current persisted value,
        // or the default of `true`) so the stored document ALWAYS contains them. Older
        // documents created before these fields existed were missing them on disk,
        // which made the admin's "Cash Penalty" / "Block until cleared" toggles look
        // like they were never saved.
        settings.cashPenaltyActive =
            cashPenaltyActive !== undefined ? Boolean(cashPenaltyActive) : settings.cashPenaltyActive !== false;
        settings.blockBookingUntilDueCleared =
            blockBookingUntilDueCleared !== undefined
                ? Boolean(blockBookingUntilDueCleared)
                : settings.blockBookingUntilDueCleared !== false;
        // Ensure Mongoose writes them even if the loaded doc lacked the paths.
        settings.markModified("cashPenaltyActive");
        settings.markModified("blockBookingUntilDueCleared");

        if (freeWindowHoursAfterBooking !== undefined) {
            const fw = Number(freeWindowHoursAfterBooking);
            if (Number.isNaN(fw) || fw < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Free window hours must be a non-negative number",
                });
            }
            settings.freeWindowHoursAfterBooking = fw;
        }

        if (Array.isArray(tiers)) {
            if (tiers.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "At least one cancellation tier is required",
                });
            }
            // Validate each tier
            const cleaned = [];
            for (const tier of tiers) {
                const min = Number(tier.minHoursBeforeTravel);
                const charge = Number(tier.chargePercentage);
                const label = (tier.label || "").trim();
                if (!label) {
                    return res.status(400).json({ success: false, message: "Each tier needs a label" });
                }
                if (Number.isNaN(min) || min < 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid hours-before-travel for tier "${label}"`,
                    });
                }
                if (Number.isNaN(charge) || charge < 0 || charge > 100) {
                    return res.status(400).json({
                        success: false,
                        message: `Charge for tier "${label}" must be between 0 and 100`,
                    });
                }
                cleaned.push({ label, minHoursBeforeTravel: min, chargePercentage: charge });
            }
            // Store sorted descending by threshold for predictable evaluation
            cleaned.sort((a, b) => b.minHoursBeforeTravel - a.minHoursBeforeTravel);
            settings.tiers = cleaned;
        }

        if (isActive !== undefined) {
            settings.isActive = Boolean(isActive);
        }

        if (notes !== undefined) {
            settings.notes = notes;
        }

        settings.updatedBy = req.userId || null;
        await settings.save();

        res.status(200).json({
            success: true,
            message: "Cancellation settings updated successfully",
            settings,
        });
    } catch (error) {
        console.error("[v0] Error updating cancellation settings:", error);
        res.status(500).json({
            success: false,
            message: "Error updating cancellation settings",
            error: error.message,
        });
    }
};

// GET /api/admin/cancellation-settings/cash-dues  (admin)
// Lists identity-anchored cash cancellation ledgers (receivables / repeat offenders).
// Query: ?status=outstanding|all  &search=<name|email|phone>
export const getCashCancellationDues = async (req, res) => {
    try {
        const { status = "outstanding", search = "" } = req.query;

        const query = {};
        if (status === "outstanding") {
            query.totalOutstanding = { $gt: 0 };
        }
        if (search && search.trim()) {
            const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            query.$or = [
                { lastKnownName: rx },
                { lastKnownEmail: rx },
                { lastKnownPhone: rx },
            ];
        }

        const ledgers = await CancellationLedger.find(query)
            .sort({ totalOutstanding: -1, updatedAt: -1 })
            .limit(500)
            .lean();

        const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
        const totals = ledgers.reduce(
            (acc, l) => {
                acc.totalOutstanding += Number(l.totalOutstanding) || 0;
                acc.totalStrikes += Number(l.strikeCount) || 0;
                if (l.isBlocked) acc.blockedCount += 1;
                return acc;
            },
            { totalOutstanding: 0, totalStrikes: 0, blockedCount: 0 }
        );
        totals.totalOutstanding = round2(totals.totalOutstanding);

        res.status(200).json({ success: true, count: ledgers.length, totals, dues: ledgers });
    } catch (error) {
        console.error("[v0] Error fetching cash cancellation dues:", error);
        res.status(500).json({ success: false, message: "Error fetching cash dues", error: error.message });
    }
};

// POST /api/admin/cancellation-settings/cash-dues/:ledgerId/resolve  (admin)
// Body: { resolution: "WAIVED" | "SETTLED", note?: string }
// Clears the outstanding due and lifts the booking block for that identity.
export const resolveCashCancellationDue = async (req, res) => {
    try {
        const { ledgerId } = req.params;
        const { resolution = "WAIVED", note = "" } = req.body;

        if (!["WAIVED", "SETTLED"].includes(resolution)) {
            return res.status(400).json({ success: false, message: "resolution must be WAIVED or SETTLED" });
        }

        const ledger = await CancellationLedger.findById(ledgerId);
        if (!ledger) {
            return res.status(404).json({ success: false, message: "Ledger record not found" });
        }

        await clearLedgerDues({ ledger, resolution, adminId: req.userId || null, note });

        res.status(200).json({
            success: true,
            message: `Outstanding due ${resolution === "WAIVED" ? "waived" : "marked as settled"} successfully.`,
            ledger,
        });
    } catch (error) {
        console.error("[v0] Error resolving cash cancellation due:", error);
        res.status(500).json({ success: false, message: "Error resolving due", error: error.message });
    }
};
