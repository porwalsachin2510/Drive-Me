import cron from 'node-cron';
import { calculateSettlementsForPeriod } from "../controllers/settlementController.js";

/**
 * Auto-calculate monthly settlement statements for all partners.
 * Runs at 02:00 on the 1st of every month and settles the PREVIOUS month,
 * so a full month of transactions is always captured.
 */
export const monthlySettlementJob = cron.schedule('0 2 1 * *', async () => {
    try {
        const now = new Date();
        // Previous month: if today is 1 Jan, settle December of last year
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const targetMonth = prev.getMonth() + 1;
        const targetYear = prev.getFullYear();

        console.log(`[CRON] Auto-calculating settlement for ${targetMonth}/${targetYear}...`);
        const results = await calculateSettlementsForPeriod(targetMonth, targetYear, null);
        console.log(`[CRON] Settlement auto-calculation completed for ${results.length} partner(s)`);
    } catch (error) {
        console.error("[CRON] Error in monthly settlement auto-calculation:", error);
    }
}, {
    scheduled: true,
    timezone: "Asia/Dubai"
});
