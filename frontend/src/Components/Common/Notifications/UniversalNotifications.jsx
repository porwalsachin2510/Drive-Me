import React, { useEffect, useRef, useState, useCallback } from "react"
import { useSelector, useDispatch } from "react-redux"
import {
  fetchNotifications,
  markNotificationAsRead,
  deleteNotification,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
} from "../../../Redux/slices/notificationSlice";
import { useNavigate } from "react-router-dom"
import "./Notifications.css"

function UniversalNotifications({ isOpen, onClose }) {
  const notificationsRef = useRef(null)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { 
    notifications, 
    unreadCount, 
    loading, 
    error 
  } = useSelector(state => state.notifications)
  const { user } = useSelector(state => state.auth)
  const [page, setPage] = useState(1)

  // Fetch notifications on mount and when opened
  useEffect(() => {
    if (isOpen && user?._id) {
      dispatch(fetchNotifications({ userId: user._id, page }))
      dispatch(getUnreadNotificationCount(user._id))
    }
  }, [isOpen, user?._id, page, dispatch])

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle navigation based on notification type
  const handleNotificationNavigation = useCallback((notification) => {
    const { type, bookingId } = notification
    const userRole = user?.role

    
    if (!userRole) return
    
    switch (type) {
      case "NEW_BOOKING":
      case "BOOKING_ACCEPTED":
      case "BOOKING_REJECTED":
        if (bookingId) {
          // Navigate based on user role
          if (userRole === "CORPORATE" || userRole === "B2B_PARTNER") {
            navigate(`/${userRole.toLowerCase()}/bookings/${bookingId}`)
          } else if (userRole === "B2C_PARTNER") {
            navigate(`/partner/bookings/${bookingId}`)
          } else if (userRole === "COMMUTER") {
            navigate(`/commuter/bookings/${bookingId}`)
          } else {
            navigate(`/bookings/${bookingId}`)
          }
        }
        break
        
      case "TRIP_STARTED":
      case "TRIP_COMPLETED":
        if (bookingId) {
          if (userRole === "CORPORATE" || userRole === "B2B_PARTNER") {
            navigate(`/${userRole.toLowerCase()}/trips/${bookingId}`)
          } else if (userRole === "B2C_PARTNER") {
            navigate(`/partner/trips/${bookingId}`)
          } else if (userRole === "COMMUTER") {
            navigate(`/commuter/trips/${bookingId}`)
          } else {
            navigate(`/trips/${bookingId}`)
          }
        }
        break
        
      case "DRIVER_ASSIGNED":
        if (bookingId) {
          navigate(`/bookings/${bookingId}`)
        }
        break
        
      case "NEW_CORPORATE_BOOKING":
        if (userRole === "CORPORATE" || userRole === "B2B_PARTNER") {
          navigate(`/${userRole.toLowerCase()}/bookings`)
        }
        break
        
      case "PAYMENT_RECEIVED":
      case "WALLET_UPDATED":
        if (userRole === "B2C_PARTNER" || userRole === "CORPORATE_DRIVER" || userRole === "B2B_PARTNER_DRIVER") {
          navigate(`/${userRole.toLowerCase()}/wallet`)
        }
        break
        
      default:
        // Default to notifications page
        if (userRole) {
          navigate(`/${userRole.toLowerCase()}/notifications`)
        }
    }
  }, [user, navigate])

  // Handle notification click
  const handleNotificationClick = useCallback(async (notification) => {
    if (!notification.isRead) {
      await dispatch(markNotificationAsRead({
        userId: user._id,
        notificationId: notification._id
      }))
    }
    
    // Handle navigation based on notification type and user role
    handleNotificationNavigation(notification)
    onClose()
  }, [user, dispatch, onClose, handleNotificationNavigation])

  // Handle delete notification
  const handleDeleteNotification = useCallback(async (e, notificationId) => {
    e.stopPropagation()
    await dispatch(deleteNotification({
      userId: user._id,
      notificationId
    }))
  }, [user, dispatch])

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    await dispatch(markAllNotificationsAsRead(user._id))
  }, [user, dispatch])

  // Filter notifications based on user type
  const getFilteredNotifications = useCallback(() => {
    if (!notifications || notifications.length === 0) return []
    
    const userRole = user?.role

    // Filter notifications relevant to user type
    return notifications.filter(notification => {
      // Admin sees all notifications
      if (userRole === "ADMIN") return true
      
      // Corporate users see corporate-related notifications
      if (userRole === "CORPORATE") {
        return [
          "NEW_CORPORATE_BOOKING",
          "BOOKING_ACCEPTED", 
          "BOOKING_REJECTED",
          "TRIP_STARTED",
          "TRIP_COMPLETED",
          "DRIVER_ASSIGNED"
        ].includes(notification.type)
      }
      
      // Commuters see their booking notifications
      if (userRole === "COMMUTER") {
        return [
          "BOOKING_ACCEPTED",
          "BOOKING_REJECTED", 
          "TRIP_STARTED",
          "TRIP_COMPLETED",
          "DRIVER_ASSIGNED"
        ].includes(notification.type)
      }
      
      // B2C Partners see booking and payment notifications
      if (userRole === "B2C_PARTNER") {
        return [
          "NEW_BOOKING",
          "BOOKING_ACCEPTED",
          "BOOKING_REJECTED",
          "TRIP_STARTED", 
          "TRIP_COMPLETED",
          "PAYMENT_RECEIVED",
          "WALLET_UPDATED"
        ].includes(notification.type)
      }
      
      // B2B Partners see corporate booking notifications
      if (userRole === "B2B_PARTNER") {
        return [
          "NEW_CORPORATE_BOOKING",
          "BOOKING_ACCEPTED",
          "BOOKING_REJECTED",
          "TRIP_STARTED",
          "TRIP_COMPLETED"
        ].includes(notification.type)
      }
      
      // Drivers see trip and payment notifications
      if (userRole?.includes("DRIVER")) {
        return [
          "NEW_BOOKING",
          "BOOKING_ACCEPTED",
          "BOOKING_REJECTED",
          "TRIP_STARTED",
          "TRIP_COMPLETED", 
          "PAYMENT_RECEIVED",
          "WALLET_UPDATED"
        ].includes(notification.type)
      }
      
      return true
    })
  }, [notifications, user])

  const filteredNotifications = getFilteredNotifications()

  // Calculate hasMore based on filtered notifications (derived state)
  const hasMoreCalculated = filteredNotifications.length >= page * 20

  // Load more notifications
  const loadMore = useCallback(() => {
    if (hasMoreCalculated && !loading) {
      setPage(prev => prev + 1)
    }
  }, [hasMoreCalculated, loading])

  if (!isOpen) return null

  return (
    <div className="notifications-dropdown" ref={notificationsRef}>
      <div className="notifications-header">
        <h3>Notifications</h3>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button 
              className="mark-all-read-btn"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </button>
          )}
          <button className="close-notifications-btn" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div className="notifications-content">
        {loading && notifications.length === 0 ? (
          <div className="notifications-loading">
            <div className="loading-spinner"></div>
            <p>Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="notifications-error">
            <p>Error loading notifications: {error}</p>
            <button onClick={() => dispatch(fetchNotifications({ userId: user._id, page: 1 }))}>
              Retry
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="no-notifications">
            <div className="no-notifications-icon">🔔</div>
            <p>No notifications yet</p>
            <span className="no-notifications-subtitle">
              {user?.role === "ADMIN" 
                ? "Admin notifications will appear here"
                : user?.role === "CORPORATE"
                ? "Corporate notifications will appear here"
                : user?.role === "COMMUTER"
                ? "Your booking updates will appear here"
                : user?.role === "B2C_PARTNER"
                ? "Partner notifications will appear here"
                : user?.role?.includes("DRIVER")
                ? "Your trip notifications will appear here"
                : "Notifications will appear here"
              }
            </span>
          </div>
        ) : (
          <>
            <div className="notifications-list">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`notification-item ${!notification.isRead ? 'unread' : 'read'}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-content">
                    <div className="notification-header">
                      <span className="notification-type">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <span className="notification-time">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </div>
                    <h4 className="notification-title">{notification.title}</h4>
                    <p className="notification-message">{notification.message}</p>
                  </div>
                  <div className="notification-actions">
                    <button
                      className="delete-notification-btn"
                      onClick={(e) => handleDeleteNotification(e, notification._id)}
                      title="Delete notification"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMoreCalculated && (
              <div className="load-more-container">
                <button 
                  className="load-more-btn"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Helper function to get notification icon
function getNotificationIcon(type) {
  const icons = {
    "NEW_BOOKING": "📋",
    "BOOKING_ACCEPTED": "✅",
    "BOOKING_REJECTED": "❌", 
    "TRIP_STARTED": "🚗",
    "TRIP_COMPLETED": "🏁",
    "DRIVER_ASSIGNED": "👤",
    "NEW_CORPORATE_BOOKING": "🏢",
    "PAYMENT_RECEIVED": "💰",
    "WALLET_UPDATED": "💳",
    "PAYMENT_FAILED": "❌",
    "SYSTEM_MAINTENANCE": "🔧",
    "ACCOUNT_UPDATE": "👤"
  }
  return icons[type] || "📢"
}

// Helper function to format notification time
function formatNotificationTime(timestamp) {
  const now = new Date()
  const notificationTime = new Date(timestamp)
  const diffInMs = now - notificationTime
  const diffInMins = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMs / 3600000)
  const diffInDays = Math.floor(diffInMs / 86400000)

  if (diffInMins < 1) return 'Just now'
  if (diffInMins < 60) return `${diffInMins}m ago`
  if (diffInHours < 24) return `${diffInHours}h ago`
  if (diffInDays < 7) return `${diffInDays}d ago`
  return notificationTime.toLocaleDateString()
}

export default UniversalNotifications
