import io from 'socket.io-client';

let socket = null;

export const initializeSocket = (token) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    auth: {
      token: token
    },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Socket event listeners for different user types
export const setupSocketListeners = (userRole, userId, dispatch) => {
  if (!socket || !userId) return;

  // Join user-specific room
  socket.emit('join_user_room', userId);

  // Common listeners for all users
  socket.on('new_notification', (notification) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: notification
    });
  });

  socket.on('wallet_update', (data) => {
    dispatch({
      type: 'wallet/updateWalletBalance',
      payload: data.balance
    });

    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `wallet_${Date.now()}`,
        type: 'WALLET_UPDATED',
        title: 'Wallet Updated',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Role-specific listeners
  switch (userRole) {
    case 'COMMUTER':
      setupCommuterListeners(dispatch);
      break;
    case 'B2C_PARTNER':
      setupB2CPartnerListeners(dispatch);
      break;
    case 'B2B_PARTNER':
      setupB2BPartnerListeners(dispatch);
      break;
    case 'CORPORATE':
      setupCorporateListeners(dispatch);
      break;
    case 'DRIVER':
    case 'B2B_PARTNER_DRIVER':
    case 'CORPORATE_DRIVER':
    case 'B2C_PARTNER_DRIVER':
      setupDriverListeners(dispatch);
      break;
    case 'ADMIN':
      setupAdminListeners(dispatch);
      break;
  }
};

const setupCommuterListeners = (dispatch) => {
  // Trip reminders and updates
  socket.on('trip_reminder', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `trip_reminder_${Date.now()}`,
        type: 'TRIP_REMINDER',
        title: 'Trip Starting Soon!',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  socket.on('trip_started', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `trip_started_${Date.now()}`,
        type: 'TRIP_STARTED',
        title: 'Trip Started!',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  socket.on('trip_completed', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `trip_completed_${Date.now()}`,
        type: 'TRIP_COMPLETED',
        title: 'Trip Completed!',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  socket.on('trip_delay', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `trip_delay_${Date.now()}`,
        type: 'TRIP_DELAY',
        title: 'Trip Delayed',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Subscription updates
  socket.on('subscription_renewal_reminder', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `subscription_${Date.now()}`,
        type: 'SUBSCRIPTION_RENEWAL',
        title: 'Subscription Expiring Soon!',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });
};

const setupB2CPartnerListeners = (dispatch) => {
  // New booking notifications
  socket.on('new_booking', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `booking_${Date.now()}`,
        type: 'NEW_BOOKING',
        title: 'New Booking Received!',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Route requests
  socket.on('route_request', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `route_request_${Date.now()}`,
        type: 'ROUTE_REQUEST',
        title: 'New Route Request',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Payment notifications
  socket.on('payment_received', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `payment_${Date.now()}`,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Received',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });
};

const setupCorporateListeners = (dispatch) => {
  // Quotation response from B2B Partner
  socket.on('quotation_received', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `quotation_received_${Date.now()}`,
        type: 'QUOTATION_RECEIVED',
        title: data.title || 'Quotation Received',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Quotation rejected by B2B Partner
  socket.on('quotation_rejected', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `quotation_rejected_${Date.now()}`,
        type: 'QUOTATION_REJECTED',
        title: data.title || 'Quotation Request Rejected',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Payment verified by Admin
  socket.on('payment_verified', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `payment_verified_${Date.now()}`,
        type: 'PAYMENT_VERIFIED',
        title: data.title || 'Payment Verified',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Payment rejected by Admin
  socket.on('payment_rejected', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `payment_rejected_${Date.now()}`,
        type: 'PAYMENT_REJECTED',
        title: data.title || 'Payment Rejected',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Contract activated
  socket.on('contract_activated', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `contract_activated_${Date.now()}`,
        type: 'CONTRACT_ACTIVATED',
        title: data.title || 'Contract Activated',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Assignment updates (driver/vehicle change)
  socket.on('assignment_updated', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `assignment_${Date.now()}`,
        type: 'ASSIGNMENT_UPDATED',
        title: data.title || 'Vehicle Assignment Updated',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Late trip notifications from drivers
  socket.on('late_trip_start', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `late_trip_${Date.now()}`,
        type: 'LATE_TRIP_START',
        title: data.title || 'Driver Started Trip Late',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });
};

const setupB2BPartnerListeners = (dispatch) => {
  // Quotation request from Corporate
  socket.on('quotation_request', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `quotation_request_${Date.now()}`,
        type: 'QUOTATION_REQUEST',
        title: data.title || 'New Quotation Request',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Quotation accepted by Corporate
  socket.on('quotation_accepted', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `quotation_accepted_${Date.now()}`,
        type: 'QUOTATION_ACCEPTED',
        title: data.title || 'Quotation Accepted!',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Quotation rejected by Corporate
  socket.on('quotation_rejected', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `quotation_rejected_${Date.now()}`,
        type: 'QUOTATION_REJECTED',
        title: data.title || 'Quotation Rejected',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Payment submitted by Corporate
  socket.on('payment_submitted', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `payment_submitted_${Date.now()}`,
        type: 'PAYMENT_SUBMITTED',
        title: data.title || 'Payment Submitted',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Payment verified/received
  socket.on('payment_received', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `payment_received_${Date.now()}`,
        type: 'PAYMENT_RECEIVED',
        title: data.title || 'Payment Received',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Contract activated
  socket.on('contract_activated', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `contract_activated_${Date.now()}`,
        type: 'CONTRACT_ACTIVATED',
        title: data.title || 'Contract Activated',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Late trip start notifications (driver is late)
  socket.on('late_trip_start', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `late_trip_${Date.now()}`,
        type: 'LATE_TRIP_START',
        title: data.title || 'Driver Started Trip Late',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Employee notifications
  socket.on('employee_added', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `employee_${Date.now()}`,
        type: 'EMPLOYEE_ADDED',
        title: 'New Employee Added',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Contract updates
  socket.on('contract_update', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `contract_${Date.now()}`,
        type: 'CONTRACT_UPDATE',
        title: 'Contract Updated',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Assignment updates (driver/vehicle change)
  socket.on('assignment_updated', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `assignment_${Date.now()}`,
        type: 'ASSIGNMENT_UPDATED',
        title: data.title || 'Assignment Updated',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Billing notifications
  socket.on('billing_reminder', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `billing_${Date.now()}`,
        type: 'BILLING_REMINDER',
        title: 'Billing Reminder',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });
};

const setupDriverListeners = (dispatch) => {
  // Trip assignments
  socket.on('trip_assigned', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `trip_assigned_${Date.now()}`,
        type: 'TRIP_ASSIGNED',
        title: 'New Trip Assigned',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Location sharing updates
  socket.on('location_update_request', (data) => {
    // Handle location update requests
    console.log('Location update request received:', data);
  });
};

const setupAdminListeners = (dispatch) => {
  // Join admin-specific rooms
  socket.emit('join-admin-room');
  socket.emit('join_admin_room');

  // System notifications
  socket.on('new_user_registration', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `new_user_${Date.now()}`,
        type: 'NEW_USER_REGISTRATION',
        title: 'New User Registration',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  socket.on('payment_verification_required', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `payment_verify_${Date.now()}`,
        type: 'PAYMENT_VERIFICATION',
        title: 'Payment Verification Required',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // Late trip start notifications
  socket.on('late_trip_start', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: data._id || `late_trip_${Date.now()}`,
        type: 'LATE_TRIP_START',
        title: data.title || 'Late Trip Start Warning',
        message: data.message,
        metadata: data.metadata,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  socket.on('emergency_alert', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `emergency_${Date.now()}`,
        type: 'EMERGENCY',
        title: 'Emergency Alert',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });

  // System updates
  socket.on('system_update', (data) => {
    dispatch({
      type: 'notifications/addRealtimeNotification',
      payload: {
        _id: `system_${Date.now()}`,
        type: 'SYSTEM_UPDATE',
        title: 'System Update',
        message: data.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    });
  });
};

export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
  setupSocketListeners,
};

// Additional socket utility functions
export const joinBookingRoom = (bookingId) => {
  if (socket && bookingId) {
    socket.emit('join_booking_room', bookingId);
    console.log('🗺️ Joined booking room:', bookingId);
  }
};

export const leaveBookingRoom = (bookingId) => {
  if (socket && bookingId) {
    socket.emit('leave_booking_room', bookingId);
    console.log('🗺️ Left booking room:', bookingId);
  }
};

export const emitLocationUpdate = (locationData) => {
  if (socket && locationData) {
    socket.emit('driver-location-update', locationData);
    console.log('📍 Location update emitted:', locationData);
  }
};

export const emitGenericLocationUpdate = (locationData) => {
  if (socket && locationData) {
    socket.emit('location-update', locationData);
    console.log('📍 Generic location update emitted:', locationData);
  }
};
