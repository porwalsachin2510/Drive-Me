"use client";

import { useState, useEffect, useRef, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  addRealtimeNotification,
  getUnreadNotificationCount,
} from "../../Redux/slices/notificationSlice";
import { SocketContext } from "../../context/SocketContext";
import { getSocket } from "../../utils/socket";
import { getNotificationRoute } from "../../utils/notificationRoute";
import "./NotificationIcon.css";

function NotificationIcon() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifications, unreadCount, loading } = useSelector(
    (state) => state.notifications,
  );
  const { user } = useSelector((state) => state.auth);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Use SocketContext for real-time connection status
  const socketContext = useContext(SocketContext);

  // Fetch notifications on mount and when user changes
  useEffect(() => {
    if (user && user._id) {
      dispatch(fetchNotifications({ userId: user._id }));
      dispatch(getUnreadNotificationCount(user._id));
    }
  }, [dispatch, user]);

  // Real-time notification listener using both SocketContext and direct socket
  useEffect(() => {
    // Get socket from context or direct socket utility
    const socket = socketContext?.socket || getSocket();

    if (socket && user && user._id) {
      // Join user's notification room
      socket.emit("join_user_room", user._id);
      socket.emit("join-notification-room", user._id);

      // Listen for new notifications - real-time updates
      const handleNewNotification = (notification) => {
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));

        // Show browser notification if permission granted
        if (Notification.permission === "granted") {
          new Notification(notification.title || "New Notification", {
            body: notification.message || "You have a new notification",
            icon: "/favicon.ico",
            tag: notification._id,
          });
        }
      };

      const handleWalletUpdate = (data) => {
        const notification = {
          _id: `wallet_${Date.now()}`,
          type: "WALLET_UPDATED",
          title: "Wallet Updated",
          message: data.message || `Your wallet balance has been updated`,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
      };

      const handleTripUpdate = (data) => {
        const notification = {
          _id: `trip_${Date.now()}`,
          type: "TRIP_UPDATE",
          title: data.title || "Trip Update",
          message: data.message,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
      };

      const handleBookingUpdate = (data) => {
        const notification = {
          _id: `booking_${Date.now()}`,
          type: data.type || "BOOKING_UPDATE",
          title: data.title || "Booking Update",
          message: data.message,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
      };

      // Register all event listeners
      socket.on("new_notification", handleNewNotification);
      socket.on("new-notification", handleNewNotification);
      socket.on("wallet_update", handleWalletUpdate);
      socket.on("wallet-updated", handleWalletUpdate);
      socket.on("trip_update", handleTripUpdate);
      socket.on("trip-started", handleTripUpdate);
      socket.on("trip-completed", handleTripUpdate);
      socket.on("booking-accepted", handleBookingUpdate);
      socket.on("booking-rejected", handleBookingUpdate);
      socket.on("driver-assigned", handleBookingUpdate);

      // Route request events
      socket.on("new_route_request", handleNewNotification);
      socket.on("route_request_response", handleNewNotification);
      socket.on("notification", handleNewNotification);

      // Cleanup listeners on unmount
      return () => {
        socket.off("new_notification", handleNewNotification);
        socket.off("new-notification", handleNewNotification);
        socket.off("wallet_update", handleWalletUpdate);
        socket.off("wallet-updated", handleWalletUpdate);
        socket.off("trip_update", handleTripUpdate);
        socket.off("trip-started", handleTripUpdate);
        socket.off("trip-completed", handleTripUpdate);
        socket.off("booking-accepted", handleBookingUpdate);
        socket.off("booking-rejected", handleBookingUpdate);
        socket.off("driver-assigned", handleBookingUpdate);
        socket.off("new_route_request", handleNewNotification);
        socket.off("route_request_response", handleNewNotification);
        socket.off("notification", handleNewNotification);
      };
    }
  }, [dispatch, user, socketContext?.socket]);

  useEffect(() => {
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      dispatch(
        markNotificationAsRead({
          notificationId: notification._id,
          userId: user._id,
        }),
      );
    }

    // Navigate using the shared, role-aware notification routing helper so the
    // dropdown and the full Notifications page always agree on the destination
    // (commuters -> the correct `/commuter-profile?tab=...` tab).
    navigate(getNotificationRoute(notification, user));

    setShowDropdown(false);
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllNotificationsAsRead(user._id));
  };

  const handleViewAll = () => {
    navigate("/notifications");
    setShowDropdown(false);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Just now";
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (isNaN(diffInMinutes) || diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getNotificationIcon = (type) => {
    const icons = {
      TRIP_REMINDER: "⏰",
      TRIP_STARTED: "🚌",
      TRIP_COMPLETED: "✅",
      TRIP_DELAY: "⏱️",
      LATE_TRIP_START: "⚠️",
      WALLET_UPDATED: "💰",
      PAYMENT_COMPLETED: "💳",
      PAYMENT_SUBMITTED: "📤",
      PAYMENT_RECEIVED: "💵",
      PAYMENT_VERIFIED: "✅",
      PAYMENT_REJECTED: "❌",
      SUBSCRIPTION_RENEWAL: "🔄",
      EMERGENCY: "🚨",
      ROUTE_REQUEST: "📍",
      NEW_ROUTE_REQUEST: "🛣️",
      ROUTE_REQUEST_RESPONSE: "📬",
      CORPORATE_UPDATE: "🏢",
      QUOTATION_REQUEST: "📋",
      QUOTATION_RECEIVED: "📩",
      QUOTATION_ACCEPTED: "✅",
      QUOTATION_REJECTED: "❌",
      CONTRACT_ACTIVATED: "🎉",
      CONTRACT_UPDATE: "📝",
      CONTRACT_CREATED: "📄",
      CONTRACT_DOCUMENT_UPLOADED: "📎",
      CONTRACT_SIGNED: "✍️",
      CONTRACT_FULLY_SIGNED: "🎉",
      CONTRACT_REJECTED: "❌",
      ASSIGNMENT_UPDATED: "🔄",
      DRIVER_ASSIGNED: "👤",
      VEHICLE_ASSIGNED: "🚗",
      VEHICLE_CHANGED: "🚗",
      // Negotiation notifications
      NEGOTIATION_REQUEST: "💬",
      NEGOTIATION_UPDATE: "📝",
      NEGOTIATION_OFFER: "💰",
      NEGOTIATION_STARTED: "🚀",
      NEGOTIATION_MESSAGE: "💬",
      NEGOTIATION_RESPONSE: "📩",
      NEGOTIATION_ACCEPTED: "✅",
      NEGOTIATION_REJECTED: "❌",
      NEGOTIATION_COUNTER_OFFER: "🔄",
      NEGOTIATION_COMPLETED: "🎉",
      // Signed document notifications
      SIGNED_DOCUMENT_UPLOADED: "📤",
      SIGNED_DOCUMENT_VERIFIED: "✅",
      SIGNED_DOCUMENT_REJECTED: "❌",
    };
    return icons[type] || "📢";
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="notification-icon-container" ref={dropdownRef}>
      <button
        className="notification-button"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <div className="notification-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13.73 21a2 2 0 0 1-3.46 0"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </button>

      {showDropdown && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="loading-notifications">
                <div className="loading-spinner"></div>
                <span>Loading notifications...</span>
              </div>
            ) : recentNotifications.length > 0 ? (
              recentNotifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`notification-item ${!notification.isRead ? "unread" : ""}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-wrapper">
                    <span className="notification-type-icon">
                      {getNotificationIcon(notification.type)}
                    </span>
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">
                      {notification.title}
                    </div>
                    <div className="notification-message">
                      {notification.message}
                    </div>
                    <div className="notification-time">
                      {formatTime(notification.createdAt)}
                    </div>
                  </div>
                  {!notification.isRead && (
                    <div className="unread-indicator"></div>
                  )}
                </div>
              ))
            ) : (
              <div className="no-notifications">
                <span className="no-notifications-icon">🔔</span>
                <p>No notifications yet</p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="dropdown-footer">
              <button className="view-all-btn" onClick={handleViewAll}>
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationIcon;
