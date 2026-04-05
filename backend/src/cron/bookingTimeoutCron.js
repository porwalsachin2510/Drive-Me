import cron from 'node-cron';
import B2CPassengerBooking from '../models/B2CPassengerBooking.js';
import User from '../models/User.js';
import { createNotification } from '../Services/notificationService.js';
import { sendRealTimeNotification } from '../Services/socketService.js';
import { sendBookingWarningEmail, sendBookingAutoCancelledEmail } from '../Services/emailService.js';

// Constants for timeout durations (in hours)
const WARNING_HOURS = 20; // Send warning 20 hours after booking creation
const CANCELLATION_HOURS = 24; // Auto-cancel 24 hours after booking creation (4 hours after warning)

/**
 * Process booking warnings - send warning to B2C_PARTNER 20 hours after booking
 * if they haven't accepted the booking yet
 */
export const processBookingWarnings = async () => {
    try {
        console.log('[v0] Processing booking warnings...');

        const now = new Date();
        const warningThreshold = new Date(now.getTime() - (WARNING_HOURS * 60 * 60 * 1000));

        // Find all CONFIRMED bookings (not yet accepted) that were created more than 20 hours ago
        // and haven't received a warning yet
        const bookingsNeedingWarning = await B2CPassengerBooking.find({
            bookingStatus: 'CONFIRMED',
            createdAt: { $lte: warningThreshold },
            warningSentAt: null,
            warningNotificationSent: { $ne: true }
        })
            .populate('b2cPartnerId', 'fullName email companyName whatsappNumber notifications')
            .populate('passengerId', 'fullName email');

        console.log(`[v0] Found ${bookingsNeedingWarning.length} bookings needing warning`);

        for (const booking of bookingsNeedingWarning) {
            try {
                const partner = booking.b2cPartnerId;
                if (!partner) {
                    console.log(`[v0] Skipping booking ${booking._id}: Partner not found`);
                    continue;
                }

                const partnerName = partner.companyName || partner.fullName || 'Partner';
                const passengerName = booking.passengerId?.fullName || 'Passenger';

                // Calculate time remaining until auto-cancellation
                const bookingCreatedAt = new Date(booking.createdAt);
                const cancellationTime = new Date(bookingCreatedAt.getTime() + (CANCELLATION_HOURS * 60 * 60 * 1000));
                const hoursRemaining = Math.max(0, Math.floor((cancellationTime - now) / (1000 * 60 * 60)));

                // Create system notification for B2C_PARTNER
                const warningNotification = await createNotification({
                    userId: partner._id,
                    type: 'BOOKING_WARNING',
                    title: 'Booking Acceptance Warning',
                    message: `Warning: You have not accepted the booking from ${passengerName} for route ${booking.pickupLocation || 'N/A'} to ${booking.dropoffLocation || 'N/A'}. If you do not accept within ${hoursRemaining} hours, this booking will be automatically cancelled.`,
                    data: {
                        bookingId: booking._id,
                        passengerId: booking.passengerId?._id,
                        pickupLocation: booking.pickupLocation,
                        dropoffLocation: booking.dropoffLocation,
                        paymentAmount: booking.paymentAmount,
                        currency: booking.currency,
                        travelDate: booking.travelDate,
                        hoursRemaining: hoursRemaining,
                        cancellationTime: cancellationTime.toISOString()
                    }
                });

                // Send real-time notification to B2C_PARTNER
                await sendRealTimeNotification(partner._id, {
                    type: 'BOOKING_WARNING',
                    title: 'Booking Acceptance Warning',
                    message: `Warning: Accept booking from ${passengerName} within ${hoursRemaining} hours or it will be auto-cancelled.`,
                    data: {
                        bookingId: booking._id,
                        hoursRemaining: hoursRemaining,
                        cancellationTime: cancellationTime.toISOString()
                    }
                });

                // Send email warning to B2C_PARTNER
                if (partner.email && partner.notifications?.emailNotifications !== false) {
                    try {
                        await sendBookingWarningEmail(
                            partner.email,
                            partnerName,
                            {
                                bookingId: booking._id.toString().slice(-8),
                                passengerName: passengerName,
                                pickupLocation: booking.pickupLocation || 'N/A',
                                dropoffLocation: booking.dropoffLocation || 'N/A',
                                paymentAmount: booking.paymentAmount,
                                currency: booking.currency || 'AED',
                                travelDate: booking.travelDate,
                                hoursRemaining: hoursRemaining,
                                cancellationTime: cancellationTime
                            }
                        );
                        booking.warningEmailSent = true;
                    } catch (emailErr) {
                        console.error(`[v0] Error sending warning email for booking ${booking._id}:`, emailErr.message);
                    }
                }

                // Update booking with warning sent timestamp
                booking.warningSentAt = now;
                booking.warningNotificationSent = true;
                booking.warningDeadline = cancellationTime;
                await booking.save();

                console.log(`[v0] Warning sent for booking ${booking._id} to partner ${partner._id}`);

            } catch (bookingErr) {
                console.error(`[v0] Error processing warning for booking ${booking._id}:`, bookingErr.message);
            }
        }

        console.log(`[v0] Completed processing booking warnings`);
        return bookingsNeedingWarning.length;

    } catch (error) {
        console.error('[v0] Error in processBookingWarnings:', error.message);
        return 0;
    }
};

/**
 * Process booking auto-cancellations - auto-cancel bookings 24 hours after creation
 * if B2C_PARTNER hasn't accepted them
 */
export const processBookingAutoCancellations = async () => {
    try {
        console.log('[v0] Processing booking auto-cancellations...');

        const now = new Date();
        const cancellationThreshold = new Date(now.getTime() - (CANCELLATION_HOURS * 60 * 60 * 1000));

        // Find all CONFIRMED bookings (not yet accepted) that were created more than 24 hours ago
        const bookingsToCancel = await B2CPassengerBooking.find({
            bookingStatus: 'CONFIRMED',
            createdAt: { $lte: cancellationThreshold },
            autoCancelledAt: null
        })
            .populate('b2cPartnerId', 'fullName email companyName whatsappNumber notifications')
            .populate('passengerId', 'fullName email notifications');

        console.log(`[v0] Found ${bookingsToCancel.length} bookings to auto-cancel`);

        for (const booking of bookingsToCancel) {
            try {
                const partner = booking.b2cPartnerId;
                const passenger = booking.passengerId;

                if (!passenger) {
                    console.log(`[v0] Skipping booking ${booking._id}: Passenger not found`);
                    continue;
                }

                const partnerName = partner?.companyName || partner?.fullName || 'B2C Partner';
                const passengerName = passenger.fullName || 'Passenger';

                // Update booking status to CANCELLED
                booking.bookingStatus = 'CANCELLED';
                booking.cancelledAt = now;
                booking.cancelledBy = 'SYSTEM';
                booking.autoCancelledAt = now;
                booking.autoCancelReason = `Booking was automatically cancelled because ${partnerName} did not accept it within 24 hours.`;
                await booking.save();

                // ======= Notify COMMUTER (Passenger) =======

                // Create system notification for COMMUTER
                const commuterNotification = await createNotification({
                    userId: passenger._id,
                    type: 'BOOKING_AUTO_CANCELLED',
                    title: 'Booking Auto-Cancelled',
                    message: `Your booking from ${booking.pickupLocation || 'N/A'} to ${booking.dropoffLocation || 'N/A'} has been automatically cancelled because ${partnerName} did not accept it within 24 hours. You can now book with another B2C Partner.`,
                    data: {
                        bookingId: booking._id,
                        partnerId: partner?._id,
                        partnerName: partnerName,
                        pickupLocation: booking.pickupLocation,
                        dropoffLocation: booking.dropoffLocation,
                        travelDate: booking.travelDate,
                        paymentAmount: booking.paymentAmount,
                        currency: booking.currency,
                        reason: 'Partner did not accept within 24 hours',
                        redirectTo: '/commuter'
                    }
                });

                // Send real-time notification to COMMUTER
                await sendRealTimeNotification(passenger._id, {
                    type: 'BOOKING_AUTO_CANCELLED',
                    title: 'Booking Auto-Cancelled',
                    message: `Your booking was auto-cancelled because ${partnerName} did not accept it. Book with another partner now.`,
                    data: {
                        bookingId: booking._id,
                        redirectTo: '/',
                        partnerName: partnerName
                    }
                });

                // Send email to COMMUTER
                if (passenger.email && passenger.notifications?.emailNotifications !== false) {
                    try {
                        await sendBookingAutoCancelledEmail(
                            passenger.email,
                            passengerName,
                            {
                                bookingId: booking._id.toString().slice(-8),
                                partnerName: partnerName,
                                pickupLocation: booking.pickupLocation || 'N/A',
                                dropoffLocation: booking.dropoffLocation || 'N/A',
                                paymentAmount: booking.paymentAmount,
                                currency: booking.currency || 'AED',
                                travelDate: booking.travelDate,
                                reason: `${partnerName} did not accept your booking within 24 hours.`
                            },
                            'passenger'
                        );
                    } catch (emailErr) {
                        console.error(`[v0] Error sending cancellation email to passenger for booking ${booking._id}:`, emailErr.message);
                    }
                }

                // ======= Notify B2C_PARTNER =======

                if (partner) {
                    // Create system notification for B2C_PARTNER
                    await createNotification({
                        userId: partner._id,
                        type: 'BOOKING_TIMEOUT_CANCELLED',
                        title: 'Booking Auto-Cancelled Due to Timeout',
                        message: `Booking from ${passengerName} for route ${booking.pickupLocation || 'N/A'} to ${booking.dropoffLocation || 'N/A'} has been automatically cancelled because you did not accept it within 24 hours.`,
                        data: {
                            bookingId: booking._id,
                            passengerId: passenger._id,
                            passengerName: passengerName,
                            pickupLocation: booking.pickupLocation,
                            dropoffLocation: booking.dropoffLocation,
                            paymentAmount: booking.paymentAmount,
                            currency: booking.currency
                        }
                    });

                    // Send real-time notification to B2C_PARTNER
                    await sendRealTimeNotification(partner._id, {
                        type: 'BOOKING_TIMEOUT_CANCELLED',
                        title: 'Booking Auto-Cancelled',
                        message: `Booking from ${passengerName} was auto-cancelled due to timeout. Please accept bookings within 24 hours.`,
                        data: {
                            bookingId: booking._id
                        }
                    });

                    // Send email to B2C_PARTNER
                    if (partner.email && partner.notifications?.emailNotifications !== false) {
                        try {
                            await sendBookingAutoCancelledEmail(
                                partner.email,
                                partnerName,
                                {
                                    bookingId: booking._id.toString().slice(-8),
                                    passengerName: passengerName,
                                    pickupLocation: booking.pickupLocation || 'N/A',
                                    dropoffLocation: booking.dropoffLocation || 'N/A',
                                    paymentAmount: booking.paymentAmount,
                                    currency: booking.currency || 'AED',
                                    travelDate: booking.travelDate,
                                    reason: 'You did not accept this booking within 24 hours.'
                                },
                                'partner'
                            );
                        } catch (emailErr) {
                            console.error(`[v0] Error sending cancellation email to partner for booking ${booking._id}:`, emailErr.message);
                        }
                    }
                }

                console.log(`[v0] Auto-cancelled booking ${booking._id}`);

            } catch (bookingErr) {
                console.error(`[v0] Error auto-cancelling booking ${booking._id}:`, bookingErr.message);
            }
        }

        console.log(`[v0] Completed processing booking auto-cancellations`);
        return bookingsToCancel.length;

    } catch (error) {
        console.error('[v0] Error in processBookingAutoCancellations:', error.message);
        return 0;
    }
};

/**
 * Set acceptance deadlines for new bookings when they are created
 * This should be called when a new booking is created
 */
export const setBookingDeadlines = (booking) => {
    const createdAt = booking.createdAt || new Date();

    // Warning deadline: 20 hours after creation
    booking.warningDeadline = new Date(createdAt.getTime() + (WARNING_HOURS * 60 * 60 * 1000));

    // Acceptance deadline: 24 hours after creation
    booking.acceptanceDeadline = new Date(createdAt.getTime() + (CANCELLATION_HOURS * 60 * 60 * 1000));

    return booking;
};

// Schedule booking warnings check every 15 minutes
const bookingWarningsCron = cron.schedule('*/15 * * * *', async () => {
    console.log('[v0] Running booking warnings cron job...');
    try {
        const warningCount = await processBookingWarnings();
        console.log(`[v0] Booking warnings cron completed. Processed ${warningCount} warnings.`);
    } catch (error) {
        console.error('[v0] Error in booking warnings cron:', error.message);
    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// Schedule booking auto-cancellations check every 15 minutes
const bookingAutoCancellationCron = cron.schedule('*/15 * * * *', async () => {
    console.log('[v0] Running booking auto-cancellation cron job...');
    try {
        const cancelCount = await processBookingAutoCancellations();
        console.log(`[v0] Booking auto-cancellation cron completed. Cancelled ${cancelCount} bookings.`);
    } catch (error) {
        console.error('[v0] Error in booking auto-cancellation cron:', error.message);
    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// Run immediately on server start to catch any missed bookings
export const runImmediateBookingTimeoutCheck = async () => {
    console.log('[v0] Running immediate booking timeout check on server start...');
    try {
        const warningCount = await processBookingWarnings();
        const cancelCount = await processBookingAutoCancellations();
        console.log(`[v0] Immediate booking timeout check completed. Warnings: ${warningCount}, Cancellations: ${cancelCount}`);
    } catch (error) {
        console.error('[v0] Error in immediate booking timeout check:', error.message);
    }
};

console.log('[v0] Booking timeout cron jobs ENABLED');
console.log('[v0] - Booking warnings: every 15 minutes');
console.log('[v0] - Booking auto-cancellations: every 15 minutes');

export { bookingWarningsCron, bookingAutoCancellationCron };
