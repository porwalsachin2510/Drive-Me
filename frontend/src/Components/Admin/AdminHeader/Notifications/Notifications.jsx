"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useSelector } from "react-redux"
import api from "../../../../utils/api"
import "./Notifications.css"

function Notifications({ isOpen, onClose }) {
  const notificationsRef = useRef(null)
  const { user } = useSelector((state) => state.auth)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user?._id) return
    try {
      setLoading(true)
      const response = await api.get(`/notifications/user/${user._id}`, {
        params: { page: 1, limit: 10 }
      })
      const data = response.data?.data || response.data
      setNotifications(data?.notifications || [])
    } catch (error) {
      console.error("Error fetching admin notifications:", error)
    } finally {
      setLoading(false)
    }
  }, [user?._id])

  useEffect(() => {
    if (isOpen && user?._id) {
      fetchNotifications()
    }
  }, [isOpen, user?._id, fetchNotifications])

  const markAllAsRead = async () => {
    try {
      await api.patch(`/notifications/user/${user._id}/read-all`)
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (error) {
      console.error("Error marking all as read:", error)
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return "Just now"
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return "Just now"
    const now = new Date()
    const diffMin = Math.floor((now - date) / 60000)
    if (isNaN(diffMin) || diffMin < 1) return "Just now"
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
    return `${Math.floor(diffMin / 1440)}d ago`
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case "NEW_BOOKING":
      case "BOOKING_CONFIRMED":
      case "BOOKING_ACCEPTED":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect
              x="3"
              y="4"
              width="14"
              height="12"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M7 9L9 11L13 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "ADMIN_ALERT":
      case "EMERGENCY":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle
              cx="10"
              cy="10"
              r="8"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M10 6V10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="10" cy="13" r="0.5" fill="currentColor" />
          </svg>
        );
      case "NEGOTIATION_REQUEST":
      case "NEGOTIATION_OFFER":
      case "NEGOTIATION_STARTED":
      case "NEGOTIATION_MESSAGE":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M3 5h14a2 2 0 012 2v6a2 2 0 01-2 2H7l-4 4V7a2 2 0 012-2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 9h6M7 12h3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case "NEGOTIATION_ACCEPTED":
      case "NEGOTIATION_COMPLETED":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#22c55e" strokeWidth="1.5" />
            <path
              d="M7 10l2 2 4-4"
              stroke="#22c55e"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "NEGOTIATION_REJECTED":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#ef4444" strokeWidth="1.5" />
            <path
              d="M7 7l6 6M13 7l-6 6"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case "NEGOTIATION_COUNTER_OFFER":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#f59e0b" strokeWidth="1.5" />
            <path
              d="M10 6v4M10 14h.01"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case "SIGNED_DOCUMENT_UPLOADED":
      case "SIGNED_DOCUMENT_VERIFIED":
      case "SIGNED_DOCUMENT_REJECTED":
      case "CONTRACT_CREATED":
      case "CONTRACT_DOCUMENT_UPLOADED":
      case "CONTRACT_SIGNED":
      case "CONTRACT_FULLY_SIGNED":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect
              x="4"
              y="2"
              width="12"
              height="16"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 6h4M8 10h4M8 14h2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M14 7a4 4 0 10-8 0c0 5-2 6-2 6h12s-2-1-2-6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11.5 15a1.5 1.5 0 01-3 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
    }
  }

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

  if (!isOpen) return null

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="notifications-dropdown" ref={notificationsRef}>
      <div className="notifications-header">
        <h3>Notifications {unreadCount > 0 && <span className="admin-notif-badge">{unreadCount}</span>}</h3>
        {unreadCount > 0 && (
          <button className="mark-read-btn" onClick={markAllAsRead}>Mark all read</button>
        )}
      </div>

      <div className="notifications-list">
        {loading ? (
          <div className="notification-loading">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="notification-empty">No notifications yet</div>
        ) : (
          notifications.map((notification) => (
            <div key={notification._id} className={`notification-item ${!notification.isRead ? 'notification-unread' : ''}`}>
              <div className="notification-icon">{getNotificationIcon(notification.type)}</div>
              <div className="notification-content">
                <p className="notification-title">{notification.title}</p>
                <p className="notification-message-text">{notification.message}</p>
                <span className="notification-time">{formatTime(notification.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="notifications-footer">
        <button className="view-all-btn" onClick={fetchNotifications}>Refresh</button>
      </div>
    </div>
  )
}

export default Notifications
