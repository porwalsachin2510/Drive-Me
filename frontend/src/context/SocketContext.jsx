import React, { createContext, useEffect, useState } from "react";
import io from "socket.io-client";
import { useSelector, useDispatch } from "react-redux";
import {
  addRealtimeNotification,
  getUnreadNotificationCount,
} from "../Redux/slices/notificationSlice";

const SocketContext = createContext();

export { SocketContext };

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  // Main socket connection effect
  useEffect(() => {
    let instance = null;

    if (user) {
      // Connect to Socket.io server
      instance = io(import.meta.env.VITE_BACKEND_URL, {
        auth: {
          token: localStorage.getItem("token"),
        },

        transports: ["polling", "websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      });

      instance.on("connect", () => {
        console.log("Connected to Socket.io server");
        setConnected(true);

        // Join user's notification room
        instance.emit("join-notification-room", user._id);

        // Fetch initial unread count
        dispatch(getUnreadNotificationCount(user._id));
      });

      instance.on("disconnect", () => {
        console.log("Disconnected from Socket.io server");
        setConnected(false);
      });

      // Listen for new notifications
      instance.on("new-notification", (notification) => {
        console.log("New notification received:", notification);

        // Add to Redux store for real-time updates
        dispatch(addRealtimeNotification(notification));

        // Update unread count
        dispatch(getUnreadNotificationCount(user._id));

        // Show browser notification
        if (Notification.permission === "granted") {
          new Notification(notification.title || "New Notification", {
            body: notification.message || "You have a new notification",
            icon: "/favicon.ico",
          });
        }
      });

      // Listen for booking updates
      instance.on("booking-accepted", (data) => {
        console.log("Booking accepted:", data);

        // Create notification object
        const notification = {
          _id: `booking-accepted-${Date.now()}`,
          userId: user._id,
          type: "BOOKING_ACCEPTED",
          title: "Booking Accepted",
          message: `Your booking has been accepted by ${data.driverName || "a driver"}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };

        // Add to Redux store
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));

        // Show browser notification
        if (Notification.permission === "granted") {
          new Notification("Booking Accepted", {
            body: `Your booking has been accepted by ${data.driverName || "a driver"}`,
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("booking-rejected", (data) => {
        console.log("Booking rejected:", data);

        const notification = {
          _id: `booking-rejected-${Date.now()}`,
          userId: user._id,
          type: "BOOKING_REJECTED",
          title: "Booking Rejected",
          message: `Your booking has been rejected. ${data.reason || "Please try again later."}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };

        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));

        if (Notification.permission === "granted") {
          new Notification("Booking Rejected", {
            body: `Your booking has been rejected. ${data.reason || "Please try again later."}`,
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("trip-started", (data) => {
        console.log("Trip started:", data);

        const notification = {
          _id: `trip-started-${Date.now()}`,
          userId: user._id,
          type: "TRIP_STARTED",
          title: "Trip Started",
          message: `Your trip has started. Driver: ${data.driverName || "Your driver"}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };

        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));

        if (Notification.permission === "granted") {
          new Notification("Trip Started", {
            body: `Your trip has started. Driver: ${data.driverName || "Your driver"}`,
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("trip-completed", (data) => {
        console.log("Trip completed:", data);

        const notification = {
          _id: `trip-completed-${Date.now()}`,
          userId: user._id,
          type: "TRIP_COMPLETED",
          title: "Trip Completed",
          message: "Your trip has been completed successfully.",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };

        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));

        if (Notification.permission === "granted") {
          new Notification("Trip Completed", {
            body: "Your trip has been completed successfully.",
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("driver-assigned", (data) => {
        console.log("Driver assigned:", data);

        const notification = {
          _id: `driver-assigned-${Date.now()}`,
          userId: user._id,
          type: "DRIVER_ASSIGNED",
          title: "Driver Assigned",
          message: `Driver ${data.driverName || "has been assigned"} to your booking.`,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };

        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));

        if (Notification.permission === "granted") {
          new Notification("Driver Assigned", {
            body: `Driver ${data.driverName || "has been assigned"} to your booking.`,
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("corporate-booking-created", (data) => {
        console.log("Corporate booking created:", data);

        const notification = {
          _id: `corporate-booking-${Date.now()}`,
          userId: user._id,
          type: "NEW_CORPORATE_BOOKING",
          title: "New Corporate Booking",
          message: `New corporate booking from ${data.employeeName || "an employee"}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };

        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));

        if (Notification.permission === "granted") {
          new Notification("New Corporate Booking", {
            body: `New corporate booking from ${data.employeeName || "an employee"}`,
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("wallet-updated", (data) => {
        console.log("Wallet updated:", data);

        const notification = {
          _id: `wallet-updated-${Date.now()}`,
          userId: user._id,
          type: "WALLET_UPDATED",
          title: "Wallet Updated",
          message: `Your wallet has been updated. New balance: ${data.newBalance || data.amount}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };

        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));

        if (Notification.permission === "granted") {
          new Notification("Wallet Updated", {
            body: `Your wallet has been updated. New balance: ${data.newBalance || data.amount}`,
            icon: "/favicon.ico",
          });
        }
      });

      // Set socket state asynchronously to avoid cascading renders
      setTimeout(() => {
        setSocket(instance);
      }, 0);
    }

    return () => {
      if (instance) {
        instance.disconnect();
      }
    };
  }, [user, dispatch]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const value = {
    socket,
    connected,
    // Socket event emitters
    joinBookingRoom: (bookingId) => {
      if (socket) {
        socket.emit("join_booking_room", bookingId);
        console.log("🗺️ Joined booking room:", bookingId);
      }
    },
    acceptBooking: (bookingId) => {
      if (socket) {
        socket.emit("accept-booking", { bookingId });
      }
    },
    rejectBooking: (bookingId, reason) => {
      if (socket) {
        socket.emit("reject-booking", { bookingId, reason });
      }
    },
    startTrip: (bookingId) => {
      if (socket) {
        socket.emit("start-trip", { bookingId });
      }
    },
    completeTrip: (bookingId) => {
      if (socket) {
        socket.emit("complete-trip", { bookingId });
      }
    },
    getNearbyDrivers: (location) => {
      if (socket) {
        socket.emit("get-nearby-drivers", location);
      }
    },
    stopLocationSharing: () => {
      if (socket) {
        socket.emit("stop-location-sharing");
      }
    },
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
