"use client";

import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../../Redux/slices/notificationSlice";
import Navbar from "../../Components/Navbar/Navbar";
import Footer from "../../Components/Footer/Footer";
import { getNotificationRoute } from "../../utils/notificationRoute";
import "./NotificationsPage.css";

function NotificationsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifications, loading, error, pagination, unreadCount } =
    useSelector((state) => state.notifications);
  const { user } = useSelector((state) => state.auth);

  const [activeFilter, setActiveFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (user && user._id) {
      dispatch(
        fetchNotifications({ userId: user._id, page: currentPage, limit: 20 }),
      );
    }
  }, [dispatch, user, currentPage]);

  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !notification.isRead;
    if (activeFilter === "read") return notification.isRead;
    return notification.type
      ?.toLowerCase()
      .includes(activeFilter.toLowerCase());
  });

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      dispatch(
        markNotificationAsRead({
          notificationId: notification._id,
          userId: user._id,
        }),
      );
    }

    // Navigate using the shared, role-aware notification routing helper so
    // commuters land on the correct `/commuter-profile?tab=...` tab (and other
    // roles on their dedicated pages) consistently with the navbar dropdown.
    navigate(getNotificationRoute(notification, user));
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllNotificationsAsRead(user._id));
  };

  const handleDeleteNotification = (notification) => {
    setDeleteTarget(notification);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      dispatch(
        deleteNotification({
          notificationId: deleteTarget._id,
          userId: user._id,
        }),
      );
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handleSelectNotification = (notificationId) => {
    setSelectedNotifications((prev) =>
      prev.includes(notificationId)
        ? prev.filter((id) => id !== notificationId)
        : [...prev, notificationId],
    );
  };

  const handleSelectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map((n) => n._id));
    }
  };

  const handleBulkDelete = () => {
    selectedNotifications.forEach((id) => {
      dispatch(deleteNotification({ notificationId: id, userId: user._id }));
    });
    setSelectedNotifications([]);
  };

  const handleBulkMarkAsRead = () => {
    selectedNotifications.forEach((id) => {
      const notification = notifications.find((n) => n._id === id);
      if (notification && !notification.isRead) {
        dispatch(
          markNotificationAsRead({ notificationId: id, userId: user._id }),
        );
      }
    });
    setSelectedNotifications([]);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Just now";
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (isNaN(diffInMinutes) || diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440)
      return `${Math.floor(diffInMinutes / 60)} hours ago`;
    if (diffInMinutes < 10080)
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getNotificationIcon = (type) => {
    const icons = {
      TRIP_REMINDER: "clock",
      TRIP_STARTED: "play",
      TRIP_COMPLETED: "check-circle",
      TRIP_DELAY: "alert-triangle",
      LATE_TRIP_START: "alert-triangle",
      TRIP_UPDATE: "refresh-cw",
      WALLET_UPDATED: "wallet",
      PAYMENT_COMPLETED: "credit-card",
      PAYMENT_SUBMITTED: "upload",
      PAYMENT_RECEIVED: "download",
      PAYMENT_VERIFIED: "check-circle",
      PAYMENT_REJECTED: "x-circle",
      SUBSCRIPTION_RENEWAL: "refresh-cw",
      EMERGENCY: "alert-circle",
      ROUTE_REQUEST: "map-pin",
      CORPORATE_UPDATE: "building",
      QUOTATION_REQUEST: "file-text",
      QUOTATION_RECEIVED: "inbox",
      QUOTATION_ACCEPTED: "check-circle",
      QUOTATION_REJECTED: "x-circle",
      CONTRACT_ACTIVATED: "zap",
      CONTRACT_UPDATE: "edit",
      ASSIGNMENT_UPDATED: "refresh-cw",
      DRIVER_ASSIGNED: "user",
      TRIP_ASSIGNED: "user-check",
      BUS_NEAR_STOP: "navigation",
      CONTRACT_EXPIRY_WARNING: "alert-triangle",
      NEW_USER_REGISTRATION: "user-plus",
      VEHICLE_CHANGED: "truck",
      BOOKING_ACCEPTED: "check-circle",
      BOOKING_REJECTED: "x-circle",
      BOOKING_UPDATE: "refresh-cw",
    };
    return icons[type] || "bell";
  };

  const getNotificationColor = (type) => {
    const colors = {
      TRIP_REMINDER: "#3b82f6",
      TRIP_STARTED: "#10b981",
      TRIP_COMPLETED: "#10b981",
      TRIP_DELAY: "#f59e0b",
      LATE_TRIP_START: "#f59e0b",
      TRIP_UPDATE: "#6366f1",
      WALLET_UPDATED: "#8b5cf6",
      PAYMENT_COMPLETED: "#10b981",
      PAYMENT_SUBMITTED: "#3b82f6",
      PAYMENT_RECEIVED: "#10b981",
      PAYMENT_VERIFIED: "#10b981",
      PAYMENT_REJECTED: "#ef4444",
      SUBSCRIPTION_RENEWAL: "#6366f1",
      EMERGENCY: "#ef4444",
      ROUTE_REQUEST: "#3b82f6",
      CORPORATE_UPDATE: "#6366f1",
      QUOTATION_REQUEST: "#f59e0b",
      QUOTATION_RECEIVED: "#3b82f6",
      QUOTATION_ACCEPTED: "#10b981",
      QUOTATION_REJECTED: "#ef4444",
      CONTRACT_ACTIVATED: "#10b981",
      CONTRACT_UPDATE: "#6366f1",
      ASSIGNMENT_UPDATED: "#6366f1",
      DRIVER_ASSIGNED: "#3b82f6",
      TRIP_ASSIGNED: "#3b82f6",
      BUS_NEAR_STOP: "#10b981",
      CONTRACT_EXPIRY_WARNING: "#f59e0b",
      NEW_USER_REGISTRATION: "#6366f1",
      VEHICLE_CHANGED: "#f59e0b",
      BOOKING_ACCEPTED: "#10b981",
      BOOKING_REJECTED: "#ef4444",
      BOOKING_UPDATE: "#6366f1",
    };
    return colors[type] || "#6b7280";
  };

  // Group notifications by date
  const groupNotificationsByDate = (notificationsList) => {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notificationsList.forEach((notification) => {
      const date = new Date(notification.createdAt);
      date.setHours(0, 0, 0, 0);

      let key;
      if (date.getTime() === today.getTime()) {
        key = "Today";
      } else if (date.getTime() === yesterday.getTime()) {
        key = "Yesterday";
      } else {
        key = formatDate(notification.createdAt);
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(notification);
    });

    return groups;
  };

  const groupedNotifications = groupNotificationsByDate(filteredNotifications);

  const renderIcon = (iconName, color) => {
    const iconMap = {
      clock: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      play: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      ),
      "check-circle": (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      "alert-triangle": (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      "refresh-cw": (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      ),
      wallet: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      ),
      "credit-card": (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
      upload: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
      download: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
      "x-circle": (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      "alert-circle": (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
      "map-pin": (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
      building: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01" />
          <path d="M16 6h.01" />
          <path d="M12 6h.01" />
          <path d="M12 10h.01" />
          <path d="M12 14h.01" />
          <path d="M16 10h.01" />
          <path d="M16 14h.01" />
          <path d="M8 10h.01" />
          <path d="M8 14h.01" />
        </svg>
      ),
      "file-text": (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      inbox: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      ),
      zap: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      edit: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      user: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      truck: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
      bell: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    };
    return iconMap[iconName] || iconMap.bell;
  };

  return (
    <>
      <Navbar />
      <div className="dmg-notifications-page">
        <div className="dmg-notifications-container">
          {/* Header */}
          <div className="dmg-notifications-header">
            <div className="dmg-notifications-header-left">
              <h1>Notifications</h1>
              {unreadCount > 0 && (
                <span className="dmg-notifications-badge">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="dmg-notifications-header-actions">
              {selectedNotifications.length > 0 ? (
                <>
                  <button
                    className="dmg-notifications-btn dmg-notifications-btn-secondary"
                    onClick={handleBulkMarkAsRead}
                  >
                    Mark as Read
                  </button>
                  <button
                    className="dmg-notifications-btn dmg-notifications-btn-danger"
                    onClick={handleBulkDelete}
                  >
                    Delete Selected ({selectedNotifications.length})
                  </button>
                </>
              ) : (
                unreadCount > 0 && (
                  <button
                    className="dmg-notifications-btn dmg-notifications-btn-primary"
                    onClick={handleMarkAllAsRead}
                  >
                    Mark All as Read
                  </button>
                )
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="dmg-notifications-filters">
            <button
              className={`dmg-notifications-filter-btn ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              All
            </button>
            <button
              className={`dmg-notifications-filter-btn ${activeFilter === "unread" ? "active" : ""}`}
              onClick={() => setActiveFilter("unread")}
            >
              Unread
            </button>
            <button
              className={`dmg-notifications-filter-btn ${activeFilter === "payment" ? "active" : ""}`}
              onClick={() => setActiveFilter("payment")}
            >
              Payments
            </button>
            <button
              className={`dmg-notifications-filter-btn ${activeFilter === "trip" ? "active" : ""}`}
              onClick={() => setActiveFilter("trip")}
            >
              Trips
            </button>
            <button
              className={`dmg-notifications-filter-btn ${activeFilter === "booking" ? "active" : ""}`}
              onClick={() => setActiveFilter("booking")}
            >
              Bookings
            </button>
          </div>

          {/* Select All */}
          {filteredNotifications.length > 0 && (
            <div className="dmg-notifications-select-all">
              <label className="dmg-notifications-checkbox-label">
                <input
                  type="checkbox"
                  checked={
                    selectedNotifications.length ===
                      filteredNotifications.length &&
                    filteredNotifications.length > 0
                  }
                  onChange={handleSelectAll}
                />
                <span>Select All</span>
              </label>
            </div>
          )}

          {/* Notifications List */}
          <div className="dmg-notifications-list">
            {loading ? (
              <div className="dmg-notifications-loading">
                <div className="dmg-notifications-spinner"></div>
                <p>Loading notifications...</p>
              </div>
            ) : error ? (
              <div className="dmg-notifications-error">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p>Failed to load notifications</p>
                <button
                  className="dmg-notifications-btn dmg-notifications-btn-primary"
                  onClick={() =>
                    dispatch(
                      fetchNotifications({
                        userId: user._id,
                        page: 1,
                        limit: 20,
                      }),
                    )
                  }
                >
                  Try Again
                </button>
              </div>
            ) : Object.keys(groupedNotifications).length === 0 ? (
              <div className="dmg-notifications-empty">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <h3>No notifications</h3>
                <p>
                  {activeFilter === "all"
                    ? "You're all caught up! Check back later for new updates."
                    : `No ${activeFilter} notifications found.`}
                </p>
              </div>
            ) : (
              Object.entries(groupedNotifications).map(
                ([date, notificationGroup]) => (
                  <div key={date} className="dmg-notifications-group">
                    <div className="dmg-notifications-group-header">
                      <span className="dmg-notifications-date">{date}</span>
                    </div>
                    {notificationGroup.map((notification) => (
                      <div
                        key={notification._id}
                        className={`dmg-notification-item ${!notification.isRead ? "unread" : ""} ${
                          selectedNotifications.includes(notification._id)
                            ? "selected"
                            : ""
                        }`}
                      >
                        <div className="dmg-notification-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedNotifications.includes(
                              notification._id,
                            )}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectNotification(notification._id);
                            }}
                          />
                        </div>
                        <div
                          className="dmg-notification-content"
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div
                            className="dmg-notification-icon"
                            style={{
                              backgroundColor: `${getNotificationColor(notification.type)}15`,
                            }}
                          >
                            {renderIcon(
                              getNotificationIcon(notification.type),
                              getNotificationColor(notification.type),
                            )}
                          </div>
                          <div className="dmg-notification-details">
                            <div className="dmg-notification-title-row">
                              <h4 className="dmg-notification-title">
                                {notification.title}
                              </h4>
                              {!notification.isRead && (
                                <span className="dmg-notification-unread-dot"></span>
                              )}
                            </div>
                            <p className="dmg-notification-message">
                              {notification.message}
                            </p>
                            <span className="dmg-notification-time">
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="dmg-notification-actions">
                          <button
                            className="dmg-notification-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNotification(notification);
                            }}
                            title="Delete"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              )
            )}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="dmg-notifications-pagination">
              <button
                className="dmg-notifications-pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <span className="dmg-notifications-pagination-info">
                Page {currentPage} of {pagination.pages}
              </span>
              <button
                className="dmg-notifications-pagination-btn"
                disabled={currentPage === pagination.pages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(pagination.pages, prev + 1))
                }
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="dmg-notifications-modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="dmg-notifications-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dmg-notifications-modal-header">
              <h3>Delete Notification</h3>
            </div>
            <div className="dmg-notifications-modal-body">
              <p>
                Are you sure you want to delete this notification? This action
                cannot be undone.
              </p>
            </div>
            <div className="dmg-notifications-modal-actions">
              <button
                className="dmg-notifications-btn dmg-notifications-btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="dmg-notifications-btn dmg-notifications-btn-danger"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export default NotificationsPage;
