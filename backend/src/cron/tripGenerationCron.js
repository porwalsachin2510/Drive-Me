import cron from 'node-cron';
import { generateDailyTrips } from '../Services/tripGenerationService.js';
import { generateCorporateDailyTrips, generateCorporateTripsForDays } from '../Services/corporateTripGenerationService.js';

// Schedule daily trip generation at 12:00 AM every day (midnight) - ENABLED
const dailyTripGeneration = cron.schedule('0 0 * * *', async () => {
    console.log('[v0] Running daily B2C trip generation...');
    try {
        await generateDailyTrips();
    } catch (error) {
        console.error('[v0] Error in daily B2C trip generation:', error.message);
    }
}, {
    scheduled: true, // ENABLED
    timezone: "Asia/Kolkata"
});

// Schedule corporate trip generation at 12:30 AM every day - ENABLED
const corporateTripGeneration = cron.schedule('30 0 * * *', async () => {
    console.log('[v0] Running daily corporate trip generation...');
    try {
        await generateCorporateDailyTrips();
    } catch (error) {
        console.error('[v0] Error in daily corporate trip generation:', error.message);
    }
}, {
    scheduled: true, // ENABLED
    timezone: "Asia/Kolkata"
});

// Schedule trip generation every 6 hours for immediate availability - ENABLED
const frequentTripGeneration = cron.schedule('0 */6 * * *', async () => {
    console.log('[v0] Running frequent trip generation for both B2C and Corporate...');
    try {
        await generateDailyTrips();
        await generateCorporateTripsForDays(3); // Generate for next 3 days
    } catch (error) {
        console.error('[v0] Error in frequent trip generation:', error.message);
    }
}, {
    scheduled: true, // ENABLED
    timezone: "Asia/Kolkata"
});

// Schedule trip generation every 1 hour for testing and immediate updates - ENABLED
const hourlyTripGeneration = cron.schedule('0 * * * *', async () => {
    console.log('[v0] Running hourly trip generation for both B2C and Corporate...');
    try {
        await generateDailyTrips();
        await generateCorporateTripsForDays(2); // Generate for next 2 days
    } catch (error) {
        console.error('[v0] Error in hourly trip generation:', error.message);
    }
}, {
    scheduled: true, // ENABLED
    timezone: "Asia/Kolkata"
});

// Also run immediately on server start - ENABLED
const runImmediateGeneration = async () => {
    console.log('[v0] Running immediate trip generation on server start...');
    try {
        await generateDailyTrips();
        await generateCorporateTripsForDays(7); // Generate for next 7 days
        console.log('[v0] Immediate trip generation completed');
    } catch (error) {
        console.error('[v0] Error in immediate trip generation:', error.message);
    }
};

console.log('[v0] Trip generation cron jobs ENABLED');
console.log('[v0] - B2C Daily: ENABLED at 00:00');
console.log('[v0] - Corporate Daily: ENABLED at 00:30');
console.log('[v0] - Frequent: ENABLED every 6 hours');
console.log('[v0] - Hourly: ENABLED every hour');
console.log('[v0] - Immediate: ENABLED on server start');

export { dailyTripGeneration, frequentTripGeneration, hourlyTripGeneration, runImmediateGeneration, corporateTripGeneration };
