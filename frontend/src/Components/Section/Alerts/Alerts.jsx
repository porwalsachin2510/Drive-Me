"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import "./alerts.css";
import api from "../../../utils/api";

export default function Alerts() {
  const { user } = useSelector((state) => state.auth);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const isInitialLoad = useRef(true);
  const pageRef = useRef(1);

  const fetchNotifications = useCallback(async (reset = true) => {
    if (!user?._id) return;
    try {
      if (reset && isInitialLoad.current) {
        setLoading(true);
      } else if (!reset) {
        setLoadingMore(true);
      }
      
      const currentPage = reset ? 1 : pageRef.current;
      const response = await api.get(`/notifications/user/${user._id}`, {
        params: {
          page: currentPage,
          limit: 20,
          type: filterType === "all" ? undefined : filterType
        }
      });
      
      const responseData = response.data?.data || response.data;
      const newNotifications = responseData?.notifications || response.data?.notifications || [];
      const totalNotifications = responseData?.pagination?.total || response.data?.total || 0;
      
      if (reset) {
        setNotifications(newNotifications);
        pageRef.current = 2;
        setHasMore(newNotifications.length < totalNotifications);
      } else {
        setNotifications(prev => {
          const combined = [...prev, ...newNotifications];
          setHasMore(combined.length < totalNotifications);
          return combined;
        });
        pageRef.current = currentPage + 1;
      }

      isInitialLoad.current = false;
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterType, user?._id]);

  useEffect(() => {
    if (user?._id) {
      isInitialLoad.current = true;
      fetchNotifications(true);
    }
  }, [user?._id, filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  const markAsRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch(`/notifications/user/${user._id}/read-all`);
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      );
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      setNotifications(prev =>
        prev.filter(notif => notif._id !== notificationId)
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "PAYMENT": return "\u{1F4B3}";
      case "PROMOTION": return "\u{1F389}";
      case "SYSTEM": return "\u2699\uFE0F";
      case "TRIP_UPDATE": return "\u{1F68C}";
      case "BOOKING": return "\u{1F4CB}";
      case "WALLET": return "\u{1F4B0}";
      case "EMERGENCY": return "\u{1F6A8}";
      default: return "\u{1F4E2}";
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "PAYMENT": return "#00B074";
      case "PROMOTION": return "#FF6B6B";
      case "SYSTEM": return "#4ECDC4";
      case "TRIP_UPDATE": return "#45B7D1";
      case "BOOKING": return "#96CEB4";
      case "WALLET": return "#FECA57";
      case "EMERGENCY": return "#FF6348";
      default: return "#6C757D";
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="al-alerts-section">
        <h2>Notifications</h2>
        <div className="al-loading">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="al-alerts-section">
      <div className="al-alerts-header">
        <h2>Notifications</h2>
        <div className="al-alerts-controls">
          <div className="al-unread-badge">
            {unreadCount} Unread
          </div>
          {unreadCount > 0 && (
            <button
              className="al-mark-all-read-btn"
              onClick={markAllAsRead}
            >
              Mark All as Read
            </button>
          )}
        </div>
      </div>

      <div className="al-filter-options">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="al-filter-select"
        >
          <option value="all">All Notifications</option>
          <option value="PAYMENT">Payments</option>
          <option value="PROMOTION">Promotions</option>
          <option value="SYSTEM">System</option>
          <option value="TRIP_UPDATE">Trip Updates</option>
          <option value="BOOKING">Bookings</option>
          <option value="WALLET">Wallet</option>
        </select>
      </div>

      <div className="al-notifications-list">
        {notifications.length === 0 ? (
          <div className="al-no-notifications">
            <div className="al-no-notifications-icon">{"\u{1F514}"}</div>
            <h3>No notifications found</h3>
            <p>
              {filterType === "all"
                ? "You don't have any notifications yet."
                : "No notifications found for this type."}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification._id}
              className={`al-notification-item ${!notification.isRead ? "al-unread" : ""}`}
            >
              <div className="al-notification-icon">
                <span style={{ color: getNotificationColor(notification.type) }}>
                  {getNotificationIcon(notification.type)}
                </span>
              </div>

              <div className="al-notification-content">
                <div className="al-notification-header">
                  <h4>{notification.title}</h4>
                  <span className="al-notification-date">
                    {new Date(notification.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>

                <p className="al-notification-message">
                  {notification.message}
                </p>

                {notification.actionUrl && (
                  <a
                    href={notification.actionUrl}
                    className="al-notification-action"
                  >
                    {notification.actionText || "View Details"}
                  </a>
                )}
              </div>

              <div className="al-notification-actions">
                {!notification.isRead && (
                  <button
                    className="al-mark-read-btn"
                    onClick={() => markAsRead(notification._id)}
                    title="Mark as read"
                  >
                    {"\u2713"}
                  </button>
                )}
                <button
                  className="al-delete-btn"
                  onClick={() => deleteNotification(notification._id)}
                  title="Delete notification"
                >
                  {"\u00D7"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && hasMore && (
        <div className="al-load-more-section">
          <button
            className="al-load-more-btn"
            onClick={() => fetchNotifications(false)}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
