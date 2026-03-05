import cron from 'node-cron';
import { processRenewals, sendRenewalReminders } from "../controllers/subscriptionSettingsController.js";

// Process renewals daily at midnight (00:15) - ENABLED
export const processDailyRenewals = cron.schedule('15 0 * * *', async () => {
    try {
        console.log("[CRON] Starting daily renewal processing...");
        await processRenewals();
        console.log("[CRON] Daily renewal processing completed");
    } catch (error) {
        console.error("[CRON] Error in daily renewal processing:", error);
    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// Send renewal reminders daily at 9 AM (09:00) - ENABLED
export const sendDailyRenewalReminders = cron.schedule('0 9 * * *', async () => {
    try {
        console.log("[CRON] Starting daily renewal reminders...");
        await sendRenewalReminders();
        console.log("[CRON] Daily renewal reminders completed");
    } catch (error) {
        console.error("[CRON] Error in daily renewal reminders:", error);
    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});
