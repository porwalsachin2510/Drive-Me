"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import { useSocket } from "../../../hooks/useSocket";
import api from "../../../utils/api";
import "./CorporateDriverDashboard.css";

export default function CorporateDriverDashboard() {
  const { user } = useSelector((state) => state.auth);
  const socket = useSocket();

  // Use driverId from drivers collection if available, fallback to user._id
  const effectiveDriverId = user?.driverId || user?._id;

  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [liveLocation, setLiveLocation] = useState(null);
  const [activeBookingTab, setActiveBookingTab] = useState("confirmed");
  const [activeMainTab, setActiveMainTab] = useState("bookings");
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [formattedLastLogin, setFormattedLastLogin] = useState("");
  const [activeTrip, setActiveTrip] = useState(null);
  const [corporateInfo, setCorporateInfo] = useState(null);
  const locationIntervalRef = useRef(null);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Format last login time
  useEffect(() => {
    if (user?.lastLogin) {
      const loginDate = new Date(user.lastLogin);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateString = "";

      if (loginDate.toDateString() === today.toDateString()) {
        dateString = "Today";
      } else if (loginDate.toDateString() === yesterday.toDateString()) {
        dateString = "Yesterday";
      } else {
        dateString = loginDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      const timeString = loginDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      setFormattedLastLogin(`${dateString}, ${timeString}`);
    }
  }, [user?.lastLogin]);

  const getRoleDisplayName = (role) => {
    const roleMap = {
      ADMIN: "Admin",
      COMMUTER: "Commuter",
      CORPORATE: "Corporate",
      B2C_PARTNER: "B2C Partner",
      B2B_PARTNER: "B2B Partner",
      CORPORATE_DRIVER: "Corporate Driver",
      B2B_PARTNER_DRIVER: "B2B Partner Driver",
      CORPORATE_EMPLOYEE: "Corporate Employee",
      B2C_PARTNER_DRIVER: "B2C Partner Driver",
    };
    return roleMap[role] || role;
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.log("No token found, redirecting to login");
        navigate("/login");
        return;
      }

      dispatch(logout());

      // Call backend logout endpoint to clear cookies and session
      await api.post(
        "/auth/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        },
      );

      // Clear frontend storage
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      console.log("User logged out successfully");

      // Redirect to login page
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Redirect to login regardless of error
      navigate("/login");
    }
  };

  const updateLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            driverId: effectiveDriverId,
            userId: user._id,
            timestamp: new Date().toISOString(),
            driverType: "CORPORATE",
            tripId: activeTrip?._id || null,
          };

          if (socket && socket.socket) {
            socket.socket.emit("update-location", location);
            socket.socket.emit("driver-location-update", location);
          }

          setLiveLocation(location);
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      );
    }
  }, [socket, user._id, effectiveDriverId, activeTrip]);

  const startAutomaticLocationSharing = useCallback(() => {
    if (isSharingLocation) return;

    setIsSharingLocation(true);
    console.log("🚗 Starting automatic location sharing for Corporate Driver");

    updateLocation();

    locationIntervalRef.current = setInterval(() => {
      updateLocation();
    }, 5000);

    if (socket && socket.socket) {
      socket.socket.emit("join-driver-room", effectiveDriverId);
      if (effectiveDriverId !== user._id) {
        socket.socket.emit("join-driver-room", user._id);
      }
    }
  }, [isSharingLocation, socket, user._id, effectiveDriverId, updateLocation]);

  const stopAutomaticLocationSharing = useCallback(() => {
    if (!isSharingLocation) return;

    setIsSharingLocation(false);
    console.log("🛑 Stopping automatic location sharing");

    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }

    setActiveTrip(null);
  }, [isSharingLocation]);

  const fetchCorporateBookings = useCallback(async () => {
    try {
      const response = await api.get(`/bookings/corporate/driver/${user._id}`);
      if (response.data.success) {
        setBookings(response.data.bookings);

        // Handle both bookingStatus and status fields
        const inProgressTrips = response.data.bookings.filter(
          (booking) =>
            (booking.bookingStatus || booking.status) === "IN_PROGRESS",
        );

        const confirmedTrips = response.data.bookings.filter((booking) => {
          const status = booking.bookingStatus || booking.status;
          return status === "CONFIRMED" || status === "SCHEDULED";
        });

        if (
          (inProgressTrips.length > 0 || confirmedTrips.length > 0) &&
          !isSharingLocation
        ) {
          startAutomaticLocationSharing();
        }

        if (inProgressTrips.length > 0) {
          setActiveTrip(inProgressTrips[0]);
        } else if (confirmedTrips.length > 0) {
          setActiveTrip(confirmedTrips[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching corporate bookings:", error);
    }
  }, [user._id, isSharingLocation, startAutomaticLocationSharing]);

  const fetchNotifications = useCallback(async () => {
    try {
      if (!user?._id) return;
      const response = await api.get(`/notifications/user/${user._id}`);
      const data =
        response.data?.data?.notifications ||
        response.data?.notifications ||
        [];
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [user?._id]);

  const fetchCorporateInfo = useCallback(async () => {
    try {
      // Fetch the corporate owner info using employedBy
      if (user?.employedBy) {
        const response = await api.get(`/auth/user/${user.employedBy}`);
        if (response.data?.success) {
          setCorporateInfo(response.data.user || response.data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching corporate info:", error);
    }
  }, [user?.employedBy]);

  const startTrip = async (bookingId) => {
    try {
      const response = await api.put(`/bookings/corporate/${bookingId}/start`);
      if (response.data.success) {
        setBookings((prev) =>
          prev.map((booking) =>
            booking._id === bookingId
              ? {
                  ...booking,
                  bookingStatus: "IN_PROGRESS",
                  startedAt: new Date(),
                }
              : booking,
          ),
        );

        setActiveTrip(bookings.find((b) => b._id === bookingId));

        if (!isSharingLocation) {
          startAutomaticLocationSharing();
        }

        console.log("🚀 Trip started:", bookingId);
      }
    } catch (error) {
      console.error("Error starting trip:", error);
    }
  };

  const completeTrip = async (bookingId) => {
    try {
      const response = await api.put(
        `/bookings/corporate/${bookingId}/complete`,
      );
      if (response.data.success) {
        setBookings((prev) =>
          prev.map((booking) =>
            booking._id === bookingId
              ? {
                  ...booking,
                  bookingStatus: "COMPLETED",
                  completedAt: new Date(),
                }
              : booking,
          ),
        );

        const remainingTrips = bookings.filter(
          (booking) =>
            booking._id !== bookingId &&
            (booking.bookingStatus === "CONFIRMED" ||
              booking.bookingStatus === "IN_PROGRESS"),
        );

        if (remainingTrips.length === 0) {
          stopAutomaticLocationSharing();
        } else {
          setActiveTrip(remainingTrips[0]);
        }

        console.log("✅ Trip completed:", bookingId);
      }
    } catch (error) {
      console.error("Error completing trip:", error);
    }
  };

  useEffect(() => {
    // Use setTimeout to avoid cascading renders
    const timer = setTimeout(() => {
      fetchCorporateBookings();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchCorporateBookings]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchCorporateInfo();
  }, [fetchCorporateInfo]);

  useEffect(() => {
    if (!socket || !socket.socket) return;

    // Listen for new bookings
    socket.socket.on("new-corporate-booking", (booking) => {
      console.log("New corporate booking received:", booking);
      setBookings((prev) => [...prev, booking]);
      fetchNotifications();

      // Start location sharing for new booking
      if (!isSharingLocation) {
        startAutomaticLocationSharing();
      }
    });

    // Listen for booking updates
    socket.socket.on("corporate-booking-updated", (booking) => {
      console.log("Corporate booking updated:", booking);
      setBookings((prev) =>
        prev.map((b) => (b._id === booking._id ? booking : b)),
      );
      fetchNotifications();
    });

    // Listen for location updates
    socket.socket.on("location-update", (location) => {
      console.log("📍 Location update received:", location);
    });

    return () => {
      socket.socket.off("new-corporate-booking");
      socket.socket.off("corporate-booking-updated");
      socket.socket.off("location-update");
    };
  }, [socket, isSharingLocation, startAutomaticLocationSharing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const filteredBookings = bookings.filter((booking) => {
    const status = booking.bookingStatus || booking.status;
    switch (activeBookingTab) {
      case "confirmed":
        return status === "CONFIRMED" || status === "SCHEDULED";
      case "in-progress":
        return status === "IN_PROGRESS";
      case "completed":
        return status === "COMPLETED";
      default:
        return false;
    }
  });

  // Helper functions for Trip data format
  const getPickupLocation = (booking) => {
    return booking.pickupLocation || booking.fromLocation || "";
  };

  const getDropoffLocation = (booking) => {
    return booking.dropoffLocation || booking.toLocation || "";
  };

  const getTravelTime = (booking) => {
    return booking.travelTime || booking.startTime || "";
  };

  const getPassengerCount = (booking) => {
    return booking.passengerCount || booking.passengers?.length || 0;
  };

  const formatTripDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const userName = user?.fullName || "User";
  const userRole = user?.role || "ADMIN";
  
  return (
    <div className="corporate-driver-dashboard">
      <div className="corp-driver-dashboard-header">
        <div>
          <h1>{getRoleDisplayName(userRole)} Dashboard</h1>
          <small style={{ color: "#ffffff" }}>
            Last login: {formattedLastLogin || "Never"}
          </small>
        </div>
        <div className="corp-driver-driver-info">
          <span>Welcome, {user?.fullName}</span>
          {/* {corporateInfo && (
            <span
              className="corp-driver-company-name"
              style={{ fontSize: "14px", color: "#666", marginLeft: "8px" }}
            >
              | {corporateInfo.companyName || corporateInfo.fullName}
            </span>
          )} */}
          <div
            className={`corp-driver-location-status ${isSharingLocation ? "active" : ""}`}
          >
            📍 {isSharingLocation ? "Sharing Live" : "Not Sharing"}
          </div>
        </div>
        <button className="corp-logout-btn" onClick={handleLogout}>
          Log Out
        </button>
      </div>

      <div className="corp-driver-dashboard-tabs">
        <button
          className={`corp-driver-tab ${activeMainTab === "bookings" ? "active" : ""}`}
          onClick={() => setActiveMainTab("bookings")}
        >
          Bookings
        </button>
        <button
          className={`corp-driver-tab ${activeMainTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveMainTab("notifications")}
        >
          Notifications
        </button>
        <button
          className={`corp-driver-tab ${activeMainTab === "location" ? "active" : ""}`}
          onClick={() => setActiveMainTab("location")}
        >
          Live Location
        </button>
      </div>

      <div className="corp-driver-dashboard-content">
        {activeMainTab === "bookings" && (
          <div className="corp-driver-bookings-section">
            <div className="corp-driver-booking-tabs">
              <button
                className={`corp-driver-tab ${activeBookingTab === "confirmed" ? "active" : ""}`}
                onClick={() => setActiveBookingTab("confirmed")}
              >
                Confirmed Bookings
              </button>
              <button
                className={`corp-driver-tab ${activeBookingTab === "in-progress" ? "active" : ""}`}
                onClick={() => setActiveBookingTab("in-progress")}
              >
                In Progress
              </button>
              <button
                className={`corp-driver-tab ${activeBookingTab === "completed" ? "active" : ""}`}
                onClick={() => setActiveBookingTab("completed")}
              >
                Completed
              </button>
            </div>

            <div className="corp-driver-booking-cards">
              {activeBookingTab === "confirmed" && (
                <div className="corp-driver-booking-card">
                  <h3>Confirmed Bookings</h3>
                  <div className="corp-driver-booking-list">
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map((booking) => (
                        <div
                          key={booking._id}
                          className="corp-driver-booking-item confirmed"
                        >
                          <div className="corp-driver-booking-details">
                            <p>
                              <strong>Route:</strong>{" "}
                              {getPickupLocation(booking)} →{" "}
                              {getDropoffLocation(booking)}
                            </p>
                            <p>
                              <strong>Date:</strong>{" "}
                              {formatTripDate(
                                booking.tripDate || booking.travelDate,
                              )}
                            </p>
                            <p>
                              <strong>Time:</strong> {getTravelTime(booking)}
                            </p>
                            <p>
                              <strong>Passengers:</strong>{" "}
                              {getPassengerCount(booking)}
                            </p>
                            {booking.passengers &&
                              booking.passengers.length > 0 && (
                                <div className="corp-driver-passenger-list">
                                  <strong>Passengers to Pickup:</strong>
                                  <ul>
                                    {booking.passengers.map((p, idx) => (
                                      <li key={idx} className="passenger-item">
                                        <span className="passenger-name">
                                          {p.name ||
                                            p.passengerId?.fullName ||
                                            p.employeeId?.fullName ||
                                            "Employee"}
                                        </span>
                                        {p.seatNumber && (
                                          <span className="passenger-seat">
                                            Seat {p.seatNumber}
                                          </span>
                                        )}
                                        {p.pickupStop && (
                                          <span className="passenger-pickup">
                                            Pickup: {p.pickupStop}
                                          </span>
                                        )}
                                        {p.dropoffStop && (
                                          <span className="passenger-dropoff">
                                            Drop: {p.dropoffStop}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                          </div>
                          <div className="corp-driver-booking-actions">
                            <button
                              onClick={() => startTrip(booking._id)}
                              className="corp-driver-start-btn"
                            >
                              Start Trip
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="corp-driver-no-bookings">
                        <p>No confirmed bookings</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeBookingTab === "in-progress" && (
                <div className="corp-driver-booking-card">
                  <h3>In Progress Trips</h3>
                  <div className="corp-driver-booking-list">
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map((booking) => (
                        <div
                          key={booking._id}
                          className="corp-driver-booking-item in-progress"
                        >
                          <div className="corp-driver-booking-details">
                            <p>
                              <strong>Route:</strong>{" "}
                              {getPickupLocation(booking)} →{" "}
                              {getDropoffLocation(booking)}
                            </p>
                            <p>
                              <strong>Date:</strong>{" "}
                              {formatTripDate(
                                booking.tripDate || booking.travelDate,
                              )}
                            </p>
                            <p>
                              <strong>Passengers:</strong>{" "}
                              {getPassengerCount(booking)}
                            </p>
                            <div className="corp-driver-status-badge in-progress">
                              In Progress
                            </div>
                          </div>
                          <div className="corp-driver-booking-actions">
                            <button
                              onClick={() => completeTrip(booking._id)}
                              className="corp-driver-complete-btn"
                            >
                              Complete Trip
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="corp-driver-no-bookings">
                        <p>No trips in progress</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeBookingTab === "completed" && (
                <div className="corp-driver-booking-card">
                  <h3>Completed Trips</h3>
                  <div className="corp-driver-booking-list">
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map((booking) => (
                        <div
                          key={booking._id}
                          className="corp-driver-booking-item completed"
                        >
                          <div className="corp-driver-booking-details">
                            <p>
                              <strong>Route:</strong>{" "}
                              {getPickupLocation(booking)} →{" "}
                              {getDropoffLocation(booking)}
                            </p>
                            <p>
                              <strong>Date:</strong>{" "}
                              {formatTripDate(
                                booking.tripDate || booking.travelDate,
                              )}
                            </p>
                            <p>
                              <strong>Passengers:</strong>{" "}
                              {getPassengerCount(booking)}
                            </p>
                            <div className="corp-driver-status-badge completed">
                              Completed
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="corp-driver-no-bookings">
                        <p>No completed trips</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeMainTab === "notifications" && (
          <div className="corp-driver-notifications-section">
            <h3>Notifications</h3>
            <div className="corp-driver-notification-list">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`corp-driver-notification-item ${!notification.isRead ? "unread" : ""}`}
                  >
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <div className="corp-driver-time">
                      {new Date(notification.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="corp-driver-no-notifications">
                  <p>No notifications available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeMainTab === "location" && (
          <div className="corp-driver-location-section">
            <h3>Live Location Tracking</h3>
            <div className="corp-driver-location-info">
              <p>
                <strong>Status:</strong>{" "}
                {isSharingLocation ? (
                  <span style={{ color: "#28a745" }}>
                    🟢 Actively sharing location
                  </span>
                ) : (
                  <span style={{ color: "#ffc107" }}>
                    🟡 Not sharing location
                  </span>
                )}
              </p>
              {liveLocation && (
                <>
                  <p>
                    <strong>Current Location:</strong>{" "}
                    {liveLocation.lat?.toFixed(6)},{" "}
                    {liveLocation.lng?.toFixed(6)}
                  </p>
                  <p>
                    <strong>Last Updated:</strong>{" "}
                    {new Date(liveLocation.timestamp).toLocaleTimeString()}
                  </p>
                </>
              )}
              {activeTrip && (
                <p>
                  <strong>Active Trip:</strong> {activeTrip.employeeName} -{" "}
                  {activeTrip.routeId?.fromLocation} →{" "}
                  {activeTrip.routeId?.toLocation}
                </p>
              )}
            </div>

            <div className="corp-driver-location-map">
              {liveLocation ? (
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${liveLocation.lng - 0.01},${liveLocation.lat - 0.01},${liveLocation.lng + 0.01},${liveLocation.lat + 0.01}&layer=mapnik&marker=${liveLocation.lat},${liveLocation.lng}`}
                  className="corp-driver-live-map"
                  width="100%"
                  height="400"
                  frameBorder="0"
                  allowFullScreen
                  title="Driver Live Location"
                />
              ) : (
                <div className="corp-driver-no-location">
                  <p>No location data available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
