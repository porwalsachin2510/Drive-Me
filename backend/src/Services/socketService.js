let ioInstance = null

// Initialize with io instance from main server
export const initializeSocket = (io) => {
    ioInstance = io
}

// Send real-time notification to user
export const sendRealTimeNotification = (userId, notification) => {
    if (!ioInstance) {
        console.log('Socket.io not initialized yet')
        return
    }

    try {
        ioInstance.to(`notifications-${userId}`).emit('new-notification', {
            id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            relatedUserId: notification.relatedUserId,
            bookingId: notification.bookingId,
            createdAt: notification.createdAt,
            isRead: notification.isRead
        })
        console.log(`Real-time notification sent to user ${userId}`)
    } catch (error) {
        console.error('Error sending real-time notification:', error)
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
