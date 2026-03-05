"use client";

import { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { 
  fetchNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  addRealtimeNotification 
} from "../../Redux/slices/notificationSlice";
import api from "../../utils/api";
import "./NotificationIcon.css";

function NotificationIcon() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifications, unreadCount, loading } = useSelector((state) => state.notifications);
  const { user } = useSelector((state) => state.auth);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (user && user._id) {
      dispatch(fetchNotifications({ userId: user._id }));
    }
  }, [dispatch, user]);

  useEffect(() => {
    // Setup socket connection for real-time notifications
    const socket = api.getSocket();
    
    if (socket && user && user._id) {
      socket.emit('join_user_room', user._id);
      
      socket.on('new_notification', (notification) => {
        dispatch(addRealtimeNotification(notification));
        
        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: notification._id,
          });
        }
      });

      socket.on('wallet_update', (data) => {
        dispatch(addRealtimeNotification({
          _id: `wallet_${Date.now()}`,
          type: 'WALLET_UPDATED',
          title: 'Wallet Updated',
          message: data.message,
          isRead: false,
          createdAt: new Date().toISOString(),
        }));
      });

      socket.on('trip_update', (data) => {
        dispatch(addRealtimeNotification({
          _id: `trip_${Date.now()}`,
          type: 'TRIP_UPDATE',
          title: data.title,
          message: data.message,
          isRead: false,
          createdAt: new Date().toISOString(),
        }));
      });
    }

    return () => {
      if (socket) {
        socket.off('new_notification');
        socket.off('wallet_update');
        socket.off('trip_update');
      }
    };
  }, [dispatch, user]);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
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

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      dispatch(markNotificationAsRead({ 
        notificationId: notification._id, 
        userId: user._id 
      }));
    }
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'TRIP_REMINDER':
      case 'TRIP_STARTED':
      case 'TRIP_COMPLETED':
        navigate('/commuter/my-bookings');
        break;
      case 'WALLET_UPDATED':
      case 'PAYMENT_COMPLETED':
        navigate('/wallet');
        break;
      case 'SUBSCRIPTION_RENEWAL':
        navigate('/commuter/my-bookings');
        break;
      case 'EMERGENCY':
        navigate('/commuter/support');
        break;
      default:
        navigate('/notifications');
    }
    
    setShowDropdown(false);
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllNotificationsAsRead(user._id));
  };

  const handleViewAll = () => {
    navigate('/notifications');
    setShowDropdown(false);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Just now';
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (isNaN(diffInMinutes) || diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'TRIP_REMINDER': '⏰',
      'TRIP_STARTED': '🚌',
      'TRIP_COMPLETED': '✅',
      'TRIP_DELAY': '⏱️',
      'WALLET_UPDATED': '💰',
      'PAYMENT_COMPLETED': '💳',
      'SUBSCRIPTION_RENEWAL': '🔄',
      'EMERGENCY': '🚨',
      'ROUTE_REQUEST': '📍',
      'CORPORATE_UPDATE': '🏢',
    };
    return icons[type] || '📢';
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
            <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
      </button>

      {showDropdown && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
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
                  className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-wrapper">
                    <span className="notification-type-icon">
                      {getNotificationIcon(notification.type)}
                    </span>
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
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
