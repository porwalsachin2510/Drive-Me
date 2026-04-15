let ioInstance = null

// Initialize with io instance from main server
export const initializeSocket = (io) => {
    ioInstance = io
}

// Map notification types to specific socket event names
const TYPE_TO_EVENT_MAP = {
    // Payment events
    'PAYMENT_SUBMITTED': 'payment_submitted',
    'PAYMENT_RECEIVED': 'payment_received',
    'PAYMENT_VERIFIED': 'payment_verified',
    'PAYMENT_REJECTED': 'payment_rejected',
    // Contract events
    'CONTRACT_ACTIVATED': 'contract_activated',
    'CONTRACT_UPDATE': 'contract_update',
    // Quotation events
    'QUOTATION_REQUEST': 'quotation_request',
    'QUOTATION_RECEIVED': 'quotation_received',
    'QUOTATION_ACCEPTED': 'quotation_accepted',
    'QUOTATION_REJECTED': 'quotation_rejected',
    // Assignment events
    'ASSIGNMENT_UPDATED': 'assignment_updated',
    'DRIVER_ASSIGNED': 'driver_assigned',
    'VEHICLE_CHANGED': 'vehicle_changed',
    // Trip events
    'LATE_TRIP_START': 'late_trip_start',
    'TRIP_STARTED': 'trip_started',
    'TRIP_COMPLETED': 'trip_completed',
}

// Send real-time notification to user
export const sendRealTimeNotification = (userId, notification) => {
    if (!ioInstance) {
        console.log('[v0] Socket.io not initialized yet - cannot send notification')
        return
    }

    if (!userId) {
        console.log('[v0] No userId provided - cannot send notification')
        return
    }

    try {
        const notificationPayload = {
            _id: notification._id || notification.notificationId || `notif_${Date.now()}`,
            type: notification.type || 'GENERAL',
            title: notification.title || 'Notification',
            message: notification.message || 'You have a new notification',
            metadata: notification.metadata || notification.data || {},
            relatedUserId: notification.relatedUserId,
            bookingId: notification.bookingId,
            contractId: notification.contractId,
            createdAt: notification.createdAt || new Date().toISOString(),
            isRead: notification.isRead || false
        }

        const room = `notifications-${userId}`

        // Emit to generic notification events for all listeners
        ioInstance.to(room).emit('new-notification', notificationPayload)
        ioInstance.to(room).emit('new_notification', notificationPayload)

        // Also emit to specific event type if mapped (for role-specific listeners)
        const specificEvent = TYPE_TO_EVENT_MAP[notification.type]
        if (specificEvent) {
            ioInstance.to(room).emit(specificEvent, notificationPayload)
            console.log(`[v0] Also emitted specific event: ${specificEvent}`)
        }

        console.log(`[v0] Real-time notification sent to user ${userId}:`, notificationPayload.type, '-', notificationPayload.title)
    } catch (error) {
        console.error('[v0] Error sending real-time notification:', error)
    }
}

// Send notification to all admin users
export const sendAdminNotificationSocket = (notification) => {
    if (!ioInstance) {
        console.log('[v0] Socket.io not initialized yet - cannot send admin notification')
        return
    }

    try {
        const notificationPayload = {
            _id: notification._id || `admin_notif_${Date.now()}`,
            type: notification.type || 'ADMIN_NOTIFICATION',
            title: notification.title || 'Admin Notification',
            message: notification.message || 'You have a new admin notification',
            metadata: notification.metadata || notification.data || {},
            createdAt: notification.createdAt || new Date().toISOString(),
            isRead: false
        }

        // Emit to admin notification room
        ioInstance.to('admin-notifications').emit('new-notification', notificationPayload)
        ioInstance.to('admin-notifications').emit('new_notification', notificationPayload)

        console.log(`[v0] Admin notification sent:`, notificationPayload.type, '-', notificationPayload.title)
    } catch (error) {
        console.error('[v0] Error sending admin notification:', error)
    }
}

// Send booking update
export const sendBookingUpdate = (bookingId, event, data) => {
    if (!ioInstance) {
        console.log('Socket.io not initialized yet')
        return
    }

    try {
        ioInstance.to(`booking-${bookingId}`).emit(event, data)
        console.log(`Booking update sent for booking ${bookingId}: ${event}`)
    } catch (error) {
        console.error('Error sending booking update:', error)
    }
}

// Send location update
export const sendLocationUpdate = (bookingId, locationData) => {
    if (!ioInstance) {
        console.log('Socket.io not initialized yet')
        return
    }

    try {
        // Send both events for compatibility
        ioInstance.to(`booking-${bookingId}`).emit('location-update', locationData)
        ioInstance.to(`booking-${bookingId}`).emit('driver-location-update', locationData)
        console.log(`Location update sent for booking ${bookingId}`)
    } catch (error) {
        console.error('Error sending location update:', error)
    }
}

// Get nearby drivers
export const getNearbyDrivers = (passengerLat, passengerLng, activeDrivers, radius = 5000) => {
    const nearbyDrivers = []
    activeDrivers.forEach((location, driverId) => {
        const distance = calculateDistance(
            passengerLat, passengerLng,
            location.lat, location.lng
        )

        if (distance <= radius) {
            nearbyDrivers.push({
                driverId,
                lat: location.lat,
                lng: location.lng,
                distance: Math.round(distance)
            })
        }
    })
    return nearbyDrivers
}

// Helper function to calculate distance between two points
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
}


// Send wallet activity update to all admins
export const sendAdminWalletUpdate = (walletData) => {
    if (!ioInstance) {
        console.log('Socket.io not initialized yet')
        return
    }

    try {
        ioInstance.to('admin-wallet-updates').emit('wallet-activity', walletData)
        console.log(`Admin wallet update sent: ${walletData.type}`)
    } catch (error) {
        console.error('Error sending admin wallet update:', error)
    }
}

// Notify all admins about a wallet event
export const notifyAdminsWalletEvent = (eventType, data) => {
    if (!ioInstance) {
        console.log('Socket.io not initialized yet')
        return
    }

    try {
        ioInstance.to('admin-wallet-updates').emit(eventType, {
            ...data,
            timestamp: new Date()
        })
        console.log(`Admin wallet event sent: ${eventType}`)
    } catch (error) {
        console.error('Error notifying admins about wallet event:', error)
    }
}
