"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import { useSelector } from "react-redux";
import { useSocket } from "../../../hooks/useSocket";
import api from "../../../utils/api";
import "./B2BPartnerDriverDashboard.css";

function B2BPartnerDriverDashboard() {
  const { user } = useSelector((state) => state.auth);
  const socket = useSocket();
  
  // Use driverId from drivers collection if available, fallback to user._id
  const effectiveDriverId = user?.driverId || user?._id;

  const [bookings, setBookings] = useState([]);
  const [liveLocation, setLiveLocation] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [notifications, setNotifications] = useState([]);
  const [activeBookingTab, setActiveBookingTab] = useState("confirmed");
  const [activeMainTab, setActiveMainTab] = useState("bookings");
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const locationIntervalRef = useRef(null);

  const navigate = useNavigate();
  const dispatch = useDispatch();

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
            driverType: "B2B_PARTNER",
            tripId: activeTrip?._id || null,
          };

          if (socket && socket.socket) {
            // Emit both event formats for compatibility
            socket.socket.emit("update-location", location);
            socket.socket.emit("driver-location-update", {
              ...location,
              location: { lat: location.lat, lng: location.lng },
              bookingId: activeTrip?._id || null,
            });
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
    console.log(
      "🚗 Starting automatic location sharing for B2B Partner Driver",
    );

    updateLocation();

    locationIntervalRef.current = setInterval(() => {
      updateLocation();
    }, 5000);

    if (socket && socket.socket) {
      socket.socket.emit("join-driver-room", effectiveDriverId);
      // Also join with user._id for compatibility
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

  const startTrip = async (bookingId) => {
    try {
      const response = await api.put(
        `/bookings/b2b-partner/${bookingId}/start`,
      );
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
        `/bookings/b2b-partner/${bookingId}/complete`,
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

  const fetchB2BPartnerBookings = useCallback(async () => {
    try {
      const response = await api.get(
        `/bookings/b2b-partner/driver/${user._id}`,
      );
      if (response.data.success) {
        setBookings(response.data.bookings);

        const inProgressTrips = response.data.bookings.filter(
          (booking) => booking.bookingStatus === "IN_PROGRESS",
        );

        const confirmedTrips = response.data.bookings.filter(
          (booking) => booking.bookingStatus === "CONFIRMED",
        );

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
      console.error("Error fetching B2B partner bookings:", error);
    }
  }, [user._id, isSharingLocation, startAutomaticLocationSharing]);

  const fetchNotifications = useCallback(async () => {
    try {
      if (!user?._id) return;
      const response = await api.get(`/notifications/user/${user._id}`);
      const data = response.data?.data?.notifications || response.data?.notifications || [];
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching B2B driver notifications:", error);
    }
  }, [user?._id]);

  useEffect(() => {
    // Use setTimeout to avoid cascading renders
    const timer = setTimeout(() => {
      fetchB2BPartnerBookings();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchB2BPartnerBookings]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!socket || !socket.socket) return;

    // Listen for new bookings
    socket.socket.on("new-b2b-booking", (booking) => {
      console.log("New B2B booking received:", booking);
      setBookings((prev) => [...prev, booking]);
      fetchNotifications();

      // Start location sharing for new booking
      if (!isSharingLocation) {
        startAutomaticLocationSharing();
      }
    });

    // Listen for location updates
    socket.socket.on("location-update", (location) => {
      console.log("📍 Location update received:", location);
    });

    return () => {
      socket.socket.off("new-b2b-booking");
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

  return (
    <div className="b2b-partner-driver-dashboard">
      <button className="b2b-logout-btn" onClick={handleLogout}>
        Log Out
      </button>
      
      <div className="B2BPartner-driver-dashboard-with-tabs-header">
        <h1>B2B Partner Driver Dashboard</h1>
        <div className="B2BPartner-driver-dashboard-with-tabs-driver-info">
          <span>Welcome, {user?.fullName || user?.name}</span>
          <div
            className={`B2BPartner-driver-dashboard-with-tabs-location-status ${isSharingLocation ? "active" : ""}`}
          >
            📍 {isSharingLocation ? "Sharing Live" : "Not Sharing"}
          </div>
        </div>
      </div>

      <div className="B2BPartner-driver-dashboard-with-tabs-tabs">
        <button
          className={`B2BPartner-driver-dashboard-with-tabs-tab ${activeMainTab === "bookings" ? "active" : ""}`}
          onClick={() => setActiveMainTab("bookings")}
        >
          Bookings
        </button>
        <button
          className={`B2BPartner-driver-dashboard-with-tabs-tab ${activeMainTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveMainTab("notifications")}
        >
          Notifications
        </button>
        <button
          className={`B2BPartner-driver-dashboard-with-tabs-tab ${activeMainTab === "location" ? "active" : ""}`}
          onClick={() => setActiveMainTab("location")}
        >
          Live Location
        </button>
      </div>

      <div className="B2BPartner-driver-dashboard-with-tabs-content">
        {activeMainTab === "bookings" && (
          <div className="B2BPartner-driver-dashboard-with-tabs-bookings-section">
            <div className="B2BPartner-driver-dashboard-with-tabs-booking-tabs">
              <button
                className={`B2BPartner-driver-dashboard-with-tabs-booking-tab ${activeBookingTab === "confirmed" ? "active" : ""}`}
                onClick={() => setActiveBookingTab("confirmed")}
              >
                Confirmed Bookings
              </button>
              <button
                className={`B2BPartner-driver-dashboard-with-tabs-booking-tab ${activeBookingTab === "in-progress" ? "active" : ""}`}
                onClick={() => setActiveBookingTab("in-progress")}
              >
                In Progress
              </button>
              <button
                className={`B2BPartner-driver-dashboard-with-tabs-booking-tab ${activeBookingTab === "completed" ? "active" : ""}`}
                onClick={() => setActiveBookingTab("completed")}
              >
                Completed
              </button>
            </div>

            <div className="B2BPartner-driver-dashboard-with-tabs-booking-cards">
              {activeBookingTab === "confirmed" && (
                <div className="B2BPartner-driver-dashboard-with-tabs-booking-card">
                  <h3>Confirmed Bookings</h3>
                  <div className="B2BPartner-driver-dashboard-with-tabs-booking-list">
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map((booking) => (
                        <div
                          key={booking._id}
                          className="B2BPartner-driver-dashboard-with-tabs-booking-item confirmed"
                        >
                          <div className="B2BPartner-driver-dashboard-with-tabs-booking-details">
                            <p>
                              <strong>Route:</strong> {getPickupLocation(booking)} → {getDropoffLocation(booking)}
                            </p>
                            <p>
                              <strong>Date:</strong>{" "}
                              {formatTripDate(booking.tripDate)}
                            </p>
                            <p>
                              <strong>Time:</strong> {getTravelTime(booking)}
                            </p>
                            <p>
                              <strong>Passengers:</strong> {getPassengerCount(booking)}
                            </p>
                            {booking.passengers && booking.passengers.length > 0 && (
                              <div className="B2BPartner-driver-dashboard-with-tabs-passenger-list">
                                <strong>Booked Employees:</strong>
                                <ul>
                                  {booking.passengers.map((p, idx) => (
                                    <li key={idx}>
                                      {p.employeeId?.fullName || "Employee"} - Seat {p.seatNumber}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div className="B2BPartner-driver-dashboard-with-tabs-booking-actions">
                            <button
                              onClick={() => startTrip(booking._id)}
                              className="B2BPartner-driver-dashboard-with-tabs-start-btn"
                            >
                              Start Trip
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="B2BPartner-driver-dashboard-with-tabs-no-bookings">
                        <p>No confirmed bookings</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeBookingTab === "in-progress" && (
                <div className="B2BPartner-driver-dashboard-with-tabs-booking-card">
                  <h3>In Progress Trips</h3>
                  <div className="B2BPartner-driver-dashboard-with-tabs-booking-list">
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map((booking) => (
                        <div
                          key={booking._id}
                          className="B2BPartner-driver-dashboard-with-tabs-booking-item in-progress"
                        >
                          <div className="B2BPartner-driver-dashboard-with-tabs-booking-details">
                            <p>
                              <strong>Route:</strong> {getPickupLocation(booking)} → {getDropoffLocation(booking)}
                            </p>
                            <p>
                              <strong>Date:</strong>{" "}
                              {formatTripDate(booking.tripDate)}
                            </p>
                            <p>
                              <strong>Time:</strong> {getTravelTime(booking)}
                            </p>
                            <p>
                              <strong>Passengers:</strong> {getPassengerCount(booking)}
                            </p>
                            <div className="B2BPartner-driver-dashboard-with-tabs-status-badge in-progress">
                              In Progress
                            </div>
                          </div>
                          <div className="B2BPartner-driver-dashboard-with-tabs-booking-actions">
                            <button
                              onClick={() => completeTrip(booking._id)}
                              className="B2BPartner-driver-dashboard-with-tabs-complete-btn"
                            >
                              Complete Trip
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="B2BPartner-driver-dashboard-with-tabs-no-bookings">
                        <p>No trips in progress</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeBookingTab === "completed" && (
                <div className="B2BPartner-driver-dashboard-with-tabs-booking-card">
                  <h3>Completed Trips</h3>
                  <div className="B2BPartner-driver-dashboard-with-tabs-booking-list">
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map((booking) => (
                        <div
                          key={booking._id}
                          className="B2BPartner-driver-dashboard-with-tabs-booking-item completed"
                        >
                          <div className="B2BPartner-driver-dashboard-with-tabs-booking-details">
                            <p>
                              <strong>Route:</strong> {getPickupLocation(booking)} → {getDropoffLocation(booking)}
                            </p>
                            <p>
                              <strong>Date:</strong>{" "}
                              {formatTripDate(booking.tripDate)}
                            </p>
                            <p>
                              <strong>Time:</strong> {getTravelTime(booking)}
                            </p>
                            <p>
                              <strong>Passengers:</strong> {getPassengerCount(booking)}
                            </p>
                            <div className="B2BPartner-driver-dashboard-with-tabs-status-badge completed">
                              Completed
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="B2BPartner-driver-dashboard-with-tabs-no-bookings">
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
          <div className="B2BPartner-driver-dashboard-with-tabs-notifications-section">
            <h3>Notifications</h3>
            <div className="B2BPartner-driver-dashboard-with-tabs-notification-list">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div key={notification._id} className={`B2BPartner-driver-dashboard-with-tabs-notification-item ${!notification.isRead ? 'unread' : ''}`}>
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <div className="B2BPartner-driver-dashboard-with-tabs-time">
                      {new Date(notification.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="B2BPartner-driver-dashboard-with-tabs-no-notifications">
                  <p>No notifications</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeMainTab === "location" && (
          <div className="B2BPartner-driver-dashboard-with-tabs-location-section">
            <h3>Live Location Tracking</h3>
            <div className="B2BPartner-driver-dashboard-with-tabs-location-info">
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
                  <strong>Active Trip:</strong> {activeTrip.pickupLocation} →{" "}
                  {activeTrip.dropoffLocation}
                </p>
              )}
            </div>

            <div className="B2BPartner-driver-dashboard-with-tabs-location-map">
              {liveLocation ? (
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${liveLocation.lng - 0.01},${liveLocation.lat - 0.01},${liveLocation.lng + 0.01},${liveLocation.lat + 0.01}&layer=mapnik&marker=${liveLocation.lat},${liveLocation.lng}`}
                  className="B2BPartner-driver-dashboard-with-tabs-live-map"
                  width="100%"
                  height="400"
                  frameBorder="0"
                  allowFullScreen
                  title="Driver Live Location"
                />
              ) : (
                <div className="B2BPartner-driver-dashboard-with-tabs-no-location">
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

export default B2BPartnerDriverDashboard;
