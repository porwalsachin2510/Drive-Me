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
    'CONTRACT_CREATED': 'contract_created',
    'CONTRACT_DOCUMENT_UPLOADED': 'contract_document_uploaded',
    'CONTRACT_SIGNED': 'contract_signed',
    'CONTRACT_FULLY_SIGNED': 'contract_fully_signed',
    'CONTRACT_REJECTED': 'contract_rejected',
    'SIGNED_DOCUMENT_UPLOADED': 'signed_document_uploaded',
    'SIGNED_DOCUMENT_VERIFIED': 'signed_document_verified',
    'SIGNED_DOCUMENT_REJECTED': 'signed_document_rejected',
    // Quotation events
    'QUOTATION_REQUEST': 'quotation_request',
    'QUOTATION_RECEIVED': 'quotation_received',
    'QUOTATION_ACCEPTED': 'quotation_accepted',
    'QUOTATION_REJECTED': 'quotation_rejected',
    // Negotiation events
    'NEGOTIATION_REQUEST': 'negotiation_request',
    'NEGOTIATION_UPDATE': 'negotiation_update',
    'NEGOTIATION_OFFER': 'negotiation_offer',
    'NEGOTIATION_STARTED': 'negotiation_started',
    'NEGOTIATION_MESSAGE': 'negotiation_message',
    'NEGOTIATION_RESPONSE': 'negotiation_response',
    'NEGOTIATION_ACCEPTED': 'negotiation_accepted',
    'NEGOTIATION_REJECTED': 'negotiation_rejected',
    'NEGOTIATION_COUNTER_OFFER': 'negotiation_counter_offer',
    'NEGOTIATION_COMPLETED': 'negotiation_completed',
    // Assignment events
    'ASSIGNMENT_UPDATED': 'assignment_updated',
    'DRIVER_ASSIGNED': 'driver_assigned',
    'VEHICLE_ASSIGNED': 'vehicle_assigned',
    'VEHICLE_CHANGED': 'vehicle_changed',
    // Trip events
    'LATE_TRIP_START': 'late_trip_start',
    'TRIP_STARTED': 'trip-started',
    'TRIP_COMPLETED': 'trip-completed',
    'TRIP_STATUS_UPDATE': 'trip-status-update',
    'TRIP_CANCELLED': 'trip-cancelled',
    'TRIP_DELAYED': 'trip-delayed',
    // Route Request events
    'NEW_ROUTE_REQUEST': 'new_route_request',
    'ROUTE_REQUEST_RESPONSE': 'route_request_response',
    'ROUTE_REQUEST': 'route_request',
    // Driver Availability events
    'DRIVER_AVAILABILITY_CHANGED': 'driver_availability_changed',
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

// Broadcast driver availability change to B2C Partner
// This allows real-time updates in Add Route, Edit Route, Manage Schedule modals
export const broadcastDriverAvailabilityChange = (b2cPartnerId, driverData) => {
    if (!ioInstance) {
        console.log('Socket.io not initialized yet - cannot broadcast driver availability')
        return
    }

    if (!b2cPartnerId) {
        console.log('No b2cPartnerId provided - cannot broadcast driver availability')
        return
    }

    try {
        const availabilityPayload = {
            driverId: driverData.driverId,
            driverName: driverData.driverName,
            availabilityStatus: driverData.availabilityStatus,
            isSelfDriver: driverData.isSelfDriver || false,
            updatedAt: new Date().toISOString()
        }

        // Emit to B2C Partner's room so they see real-time availability updates
        const partnerRoom = `b2c-partner-${b2cPartnerId}`
        ioInstance.to(partnerRoom).emit('driver_availability_changed', availabilityPayload)

        // Also emit to notifications room for the B2C Partner
        const notificationRoom = `notifications-${b2cPartnerId}`
        ioInstance.to(notificationRoom).emit('driver_availability_changed', availabilityPayload)

        console.log(`Driver availability broadcast to partner ${b2cPartnerId}:`, availabilityPayload.driverName, '-', availabilityPayload.availabilityStatus)
    } catch (error) {
        console.error('Error broadcasting driver availability:', error)
    }
}

// Broadcast self-driver (B2C Partner) availability change
// This is for when the B2C Partner changes their own availability as a self-driver
export const broadcastSelfDriverAvailabilityChange = (b2cPartnerId, availabilityData) => {
    if (!ioInstance) {
        console.log('Socket.io not initialized yet - cannot broadcast self-driver availability')
        return
    }

    try {
        const availabilityPayload = {
            driverId: b2cPartnerId, // Self-driver uses their own ID
            driverName: availabilityData.driverName || 'Self',
            availabilityStatus: availabilityData.status,
            isSelfDriver: true,
            updatedAt: new Date().toISOString()
        }

        // Emit to B2C Partner's own room (for their own UI update)
        const partnerRoom = `b2c-partner-${b2cPartnerId}`
        ioInstance.to(partnerRoom).emit('driver_availability_changed', availabilityPayload)

        const notificationRoom = `notifications-${b2cPartnerId}`
        ioInstance.to(notificationRoom).emit('driver_availability_changed', availabilityPayload)

        console.log(`Self-driver availability broadcast for partner ${b2cPartnerId}:`, availabilityPayload.availabilityStatus)
    } catch (error) {
        console.error('Error broadcasting self-driver availability:', error)
    }
}

// Broadcast vehicle availability change to B2C Partner
// This allows real-time updates in Fleet Management, Add Route, Edit Route modals
export const broadcastVehicleAvailabilityChange = (b2cPartnerId, vehicleData) => {
    if (!ioInstance) {
        console.log('Socket.io not initialized yet - cannot broadcast vehicle availability')
        return
    }

    if (!b2cPartnerId) {
        console.log('No b2cPartnerId provided - cannot broadcast vehicle availability')
        return
    }

    try {
        const availabilityPayload = {
            vehicleId: vehicleData.vehicleId,
            vehicleModel: vehicleData.vehicleModel || 'Unknown',
            licensePlate: vehicleData.licensePlate || '',
            availabilityStatus: vehicleData.availabilityStatus,
            status: vehicleData.status, // Vehicle status (Active, Maintenance, etc.)
            updatedAt: new Date().toISOString()
        }

        // Emit to B2C Partner's room so they see real-time availability updates
        const partnerRoom = `b2c-partner-${b2cPartnerId}`
        ioInstance.to(partnerRoom).emit('vehicle_availability_changed', availabilityPayload)

        // Also emit to notifications room for the B2C Partner
        const notificationRoom = `notifications-${b2cPartnerId}`
        ioInstance.to(notificationRoom).emit('vehicle_availability_changed', availabilityPayload)

        console.log(`Vehicle availability broadcast to partner ${b2cPartnerId}:`, availabilityPayload.vehicleModel, '-', availabilityPayload.availabilityStatus)
    } catch (error) {
        console.error('Error broadcasting vehicle availability:', error)
    }
}
