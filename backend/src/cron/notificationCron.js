import cron from "node-cron";
import {
    sendDailyTripReminders,
    sendContractExpiryWarnings,
} from "../Services/notificationService.js";

// Trip reminders: run every 5 minutes. The service computes the real
// departure datetime and only fires when a trip departs in ~30 minutes,
// guarded by a per-trip flag so passengers are reminded exactly once.
export const tripReminderCron = cron.schedule(
    "*/5 * * * *",
    async () => {
        try {
            console.log("[CRON] Running trip reminder check...");
            await sendDailyTripReminders();
        } catch (error) {
            console.error("[CRON] Error in trip reminder check:", error);
        }
    },
    { scheduled: true, timezone: "Asia/Kolkata" }
);

// Contract expiry warnings: run once daily at 09:30. The service scans ACTIVE
// contracts expiring within 7 days and notifies both parties, de-duplicated.
export const contractExpiryCron = cron.schedule(
    "30 9 * * *",
    async () => {
        try {
            console.log("[CRON] Running contract expiry warning scan...");
            await sendContractExpiryWarnings();
        } catch (error) {
            console.error("[CRON] Error in contract expiry warning scan:", error);
        }
    },
    { scheduled: true, timezone: "Asia/Kolkata" }
);

// Start all notification cron jobs
export const initNotificationCronJobs = () => {
    tripReminderCron.start();
    contractExpiryCron.start();
    console.log("[v0] Notification cron jobs initialized (trip reminders + contract expiry)");
};
