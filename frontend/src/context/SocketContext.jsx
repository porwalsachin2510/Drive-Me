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
        instance.emit("join_user_room", user._id); // Alias for compatibility

        // Join admin room if user is admin
        if (user.role === "ADMIN") {
          instance.emit("join-admin-room");
          console.log("Admin joined admin notification room");
        }

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

      // B2B Partner specific events
      instance.on("quotation-received", (data) => {
        console.log("New quotation received:", data);
        const notification = {
          _id: `quotation-${Date.now()}`,
          userId: user._id,
          type: "NEW_QUOTATION",
          title: "New Quotation Request",
          message: data.message || "You have received a new quotation request",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification("New Quotation Request", {
            body: data.message || "You have received a new quotation request",
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("contract-update", (data) => {
        console.log("Contract update:", data);
        const notification = {
          _id: `contract-${Date.now()}`,
          userId: user._id,
          type: "CONTRACT_UPDATE",
          title: data.title || "Contract Update",
          message: data.message || "Your contract has been updated",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Contract Update", {
            body: data.message || "Your contract has been updated",
            icon: "/favicon.ico",
          });
        }
      });

      // Payment notifications (Corporate payments to B2B)
      instance.on("payment_submitted", (data) => {
        console.log("Payment submitted:", data);
        const notification = {
          _id: data._id || `payment-submitted-${Date.now()}`,
          userId: user._id,
          type: "PAYMENT_SUBMITTED",
          title: data.title || "Payment Submitted",
          message: data.message || "A payment has been submitted",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Payment Submitted", {
            body: data.message || "A payment has been submitted",
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("payment_received", (data) => {
        console.log("Payment received:", data);
        const notification = {
          _id: data._id || `payment-received-${Date.now()}`,
          userId: user._id,
          type: "PAYMENT_RECEIVED",
          title: data.title || "Payment Received",
          message: data.message || "Payment has been credited to your wallet",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Payment Received", {
            body: data.message || "Payment has been credited to your wallet",
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("payment_verified", (data) => {
        console.log("Payment verified:", data);
        const notification = {
          _id: data._id || `payment-verified-${Date.now()}`,
          userId: user._id,
          type: "PAYMENT_VERIFIED",
          title: data.title || "Payment Verified",
          message: data.message || "Your payment has been verified",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Payment Verified", {
            body: data.message || "Your payment has been verified",
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("payment_rejected", (data) => {
        console.log("Payment rejected:", data);
        const notification = {
          _id: data._id || `payment-rejected-${Date.now()}`,
          userId: user._id,
          type: "PAYMENT_REJECTED",
          title: data.title || "Payment Rejected",
          message: data.message || "Your payment has been rejected",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Payment Rejected", {
            body: data.message || "Your payment has been rejected",
            icon: "/favicon.ico",
          });
        }
      });

      // Contract activation notification
      instance.on("contract_activated", (data) => {
        console.log("Contract activated:", data);
        const notification = {
          _id: data._id || `contract-activated-${Date.now()}`,
          userId: user._id,
          type: "CONTRACT_ACTIVATED",
          title: data.title || "Contract Activated",
          message: data.message || "Your contract is now active!",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Contract Activated", {
            body: data.message || "Your contract is now active!",
            icon: "/favicon.ico",
          });
        }
      });

      // Assignment update notifications
      instance.on("assignment_updated", (data) => {
        console.log("Assignment updated:", data);
        const notification = {
          _id: data._id || `assignment-${Date.now()}`,
          userId: user._id,
          type: "ASSIGNMENT_UPDATED",
          title: data.title || "Assignment Updated",
          message:
            data.message || "Vehicle or driver assignment has been changed",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Assignment Updated", {
            body:
              data.message || "Vehicle or driver assignment has been changed",
            icon: "/favicon.ico",
          });
        }
      });

      // Late trip start warning
      instance.on("late_trip_start", (data) => {
        console.log("Late trip start:", data);
        const notification = {
          _id: data._id || `late-trip-${Date.now()}`,
          userId: user._id,
          type: "LATE_TRIP_START",
          title: data.title || "Late Trip Start Warning",
          message: data.message || "A driver started their trip late",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Late Trip Start Warning", {
            body: data.message || "A driver started their trip late",
            icon: "/favicon.ico",
          });
        }
      });

      // B2C Partner specific events
      instance.on("new-booking-request", (data) => {
        console.log("New booking request:", data);
        const notification = {
          _id: `booking-request-${Date.now()}`,
          userId: user._id,
          type: "NEW_BOOKING_REQUEST",
          title: "New Booking Request",
          message: data.message || "You have a new booking request",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification("New Booking Request", {
            body: data.message || "You have a new booking request",
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("route-request", (data) => {
        console.log("Route request:", data);
        const notification = {
          _id: `route-request-${Date.now()}`,
          userId: user._id,
          type: "NEW_ROUTE_REQUEST",
          title: "New Route Request",
          message: data.message || "You have a new route request",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification("New Route Request", {
            body: data.message || "You have a new route request",
            icon: "/favicon.ico",
          });
        }
      });

      // Driver specific events
      instance.on("new-trip-available", (data) => {
        console.log("New trip available:", data);
        const notification = {
          _id: `trip-available-${Date.now()}`,
          userId: user._id,
          type: "NEW_TRIP_AVAILABLE",
          title: "New Trip Available",
          message:
            data.message ||
            `New trip available: ${data.pickup || ""} to ${data.dropoff || ""}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification("New Trip Available", {
            body:
              data.message ||
              `New trip available: ${data.pickup || ""} to ${data.dropoff || ""}`,
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("earnings-updated", (data) => {
        console.log("Earnings updated:", data);
        const notification = {
          _id: `earnings-${Date.now()}`,
          userId: user._id,
          type: "EARNINGS_UPDATED",
          title: "Earnings Updated",
          message:
            data.message ||
            `Your earnings have been updated: ${data.amount || ""}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification("Earnings Updated", {
            body: data.message || `Your earnings have been updated`,
            icon: "/favicon.ico",
          });
        }
      });

      // Admin specific events
      instance.on("admin-alert", (data) => {
        console.log("Admin alert:", data);
        const notification = {
          _id: `admin-alert-${Date.now()}`,
          userId: user._id,
          type: "ADMIN_ALERT",
          title: data.title || "Admin Alert",
          message: data.message || "New admin notification",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Admin Alert", {
            body: data.message || "New admin notification",
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("payout-request", (data) => {
        console.log("Payout request:", data);
        const notification = {
          _id: `payout-${Date.now()}`,
          userId: user._id,
          type: "PAYOUT_REQUEST",
          title: "New Payout Request",
          message: data.message || "A new payout request has been submitted",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification("New Payout Request", {
            body: data.message || "A new payout request has been submitted",
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("user-verification", (data) => {
        console.log("User verification:", data);
        const notification = {
          _id: `verification-${Date.now()}`,
          userId: user._id,
          type: "USER_VERIFICATION",
          title: data.title || "Verification Update",
          message: data.message || "User verification status has been updated",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Verification Update", {
            body: data.message || "User verification status has been updated",
            icon: "/favicon.ico",
          });
        }
      });

      // Corporate Employee specific events
      instance.on("employee-booking-approved", (data) => {
        console.log("Employee booking approved:", data);
        const notification = {
          _id: `employee-booking-approved-${Date.now()}`,
          userId: user._id,
          type: "EMPLOYEE_BOOKING_APPROVED",
          title: "Booking Approved",
          message:
            data.message || "Your booking has been approved by your company",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification("Booking Approved", {
            body:
              data.message || "Your booking has been approved by your company",
            icon: "/favicon.ico",
          });
        }
      });

      instance.on("schedule-reminder", (data) => {
        console.log("Schedule reminder:", data);
        const notification = {
          _id: `reminder-${Date.now()}`,
          userId: user._id,
          type: "SCHEDULE_REMINDER",
          title: "Trip Reminder",
          message: data.message || "You have an upcoming trip",
          isRead: false,
          createdAt: new Date().toISOString(),
          data: data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification("Trip Reminder", {
            body: data.message || "You have an upcoming trip",
            icon: "/favicon.ico",
          });
        }
      });

      // ============ NEGOTIATION EVENTS ============

      // For Admin: New negotiation request from Corporate
      instance.on("negotiation_request", (data) => {
        console.log("New negotiation request:", data);
        const notification = {
          _id: data._id || `negotiation_request_${Date.now()}`,
          userId: user._id,
          type: "NEGOTIATION_REQUEST",
          title: data.title || "New Negotiation Request",
          message:
            data.message || "A corporate user has requested price negotiation",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "New Negotiation Request", {
            body:
              data.message ||
              "A corporate user has requested price negotiation",
            icon: "/favicon.ico",
          });
        }
      });

      // For B2B Partner: Admin sent an offer
      instance.on("negotiation_offer", (data) => {
        console.log("Negotiation offer received:", data);
        const notification = {
          _id: data._id || `negotiation_offer_${Date.now()}`,
          userId: user._id,
          type: "NEGOTIATION_OFFER",
          title: data.title || "New Price Offer Received",
          message: data.message || "Admin has sent you a price offer",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "New Price Offer Received", {
            body: data.message || "Admin has sent you a price offer",
            icon: "/favicon.ico",
          });
        }
      });

      // For B2B Partner: Negotiation started
      instance.on("negotiation_started", (data) => {
        console.log("Negotiation started:", data);
        const notification = {
          _id: data._id || `negotiation_started_${Date.now()}`,
          userId: user._id,
          type: "NEGOTIATION_STARTED",
          title: data.title || "Negotiation Started",
          message:
            data.message ||
            "Admin has started negotiation on behalf of corporate",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Negotiation Started", {
            body: data.message || "Admin has started negotiation",
            icon: "/favicon.ico",
          });
        }
      });

      // For B2B Partner: Message from Admin
      instance.on("negotiation_message", (data) => {
        console.log("Negotiation message:", data);
        const notification = {
          _id: data._id || `negotiation_message_${Date.now()}`,
          userId: user._id,
          type: "NEGOTIATION_MESSAGE",
          title: data.title || "New Message from Admin",
          message: data.message || "Admin has sent you a message",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "New Message from Admin", {
            body: data.message || "Admin has sent you a message",
            icon: "/favicon.ico",
          });
        }
      });

      // For Admin: B2B Partner accepted offer
      instance.on("negotiation_accepted", (data) => {
        console.log("Negotiation accepted:", data);
        const notification = {
          _id: data._id || `negotiation_accepted_${Date.now()}`,
          userId: user._id,
          type: "NEGOTIATION_ACCEPTED",
          title: data.title || "Offer Accepted",
          message:
            data.message || "B2B Partner has accepted the negotiation offer",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Offer Accepted", {
            body: data.message || "B2B Partner has accepted the offer",
            icon: "/favicon.ico",
          });
        }
      });

      // For Admin: B2B Partner rejected offer
      instance.on("negotiation_rejected", (data) => {
        console.log("Negotiation rejected:", data);
        const notification = {
          _id: data._id || `negotiation_rejected_${Date.now()}`,
          userId: user._id,
          type: "NEGOTIATION_REJECTED",
          title: data.title || "Offer Rejected",
          message:
            data.message || "B2B Partner has rejected the negotiation offer",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Offer Rejected", {
            body: data.message || "B2B Partner has rejected the offer",
            icon: "/favicon.ico",
          });
        }
      });

      // For Admin: B2B Partner sent counter offer
      instance.on("negotiation_counter_offer", (data) => {
        console.log("Counter offer received:", data);
        const notification = {
          _id: data._id || `negotiation_counter_${Date.now()}`,
          userId: user._id,
          type: "NEGOTIATION_COUNTER_OFFER",
          title: data.title || "Counter Offer Received",
          message: data.message || "B2B Partner has sent a counter offer",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Counter Offer Received", {
            body: data.message || "B2B Partner has sent a counter offer",
            icon: "/favicon.ico",
          });
        }
      });

      // For Corporate & B2B Partner: Negotiation completed
      instance.on("negotiation_completed", (data) => {
        console.log("Negotiation completed:", data);
        const notification = {
          _id: data._id || `negotiation_completed_${Date.now()}`,
          userId: user._id,
          type: "NEGOTIATION_COMPLETED",
          title: data.title || "Negotiation Completed",
          message:
            data.message ||
            "The negotiation has been completed and quotation updated",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Negotiation Completed", {
            body: data.message || "The negotiation has been completed",
            icon: "/favicon.ico",
          });
        }
      });

      // ============ CONTRACT DOCUMENT EVENTS ============

      // For B2B Partner: Corporate uploaded signed contract
      instance.on("signed_document_uploaded", (data) => {
        console.log("Signed document uploaded:", data);
        const notification = {
          _id: data._id || `signed_doc_uploaded_${Date.now()}`,
          userId: user._id,
          type: "SIGNED_DOCUMENT_UPLOADED",
          title: data.title || "Signed Contract Uploaded",
          message:
            data.message ||
            "Corporate has uploaded the signed contract. Please verify.",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Signed Contract Uploaded", {
            body: data.message || "Corporate has uploaded the signed contract",
            icon: "/favicon.ico",
          });
        }
      });

      // For Corporate: B2B Partner verified/approved signed document
      instance.on("signed_document_verified", (data) => {
        console.log("Signed document verified:", data);
        const notification = {
          _id: data._id || `signed_doc_verified_${Date.now()}`,
          userId: user._id,
          type: "SIGNED_DOCUMENT_VERIFIED",
          title: data.title || "Signed Document Approved",
          message:
            data.message || "B2B Partner has approved your signed contract",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Signed Document Approved", {
            body: data.message || "Your signed contract has been approved",
            icon: "/favicon.ico",
          });
        }
      });

      // For Corporate: B2B Partner rejected signed document
      instance.on("signed_document_rejected", (data) => {
        console.log("Signed document rejected:", data);
        const notification = {
          _id: data._id || `signed_doc_rejected_${Date.now()}`,
          userId: user._id,
          type: "SIGNED_DOCUMENT_REJECTED",
          title: data.title || "Signed Document Rejected",
          message:
            data.message ||
            "B2B Partner has rejected your signed contract. Please re-upload.",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: data.metadata || data.data,
        };
        dispatch(addRealtimeNotification(notification));
        dispatch(getUnreadNotificationCount(user._id));
        if (Notification.permission === "granted") {
          new Notification(data.title || "Signed Document Rejected", {
            body: data.message || "Your signed contract was rejected",
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
