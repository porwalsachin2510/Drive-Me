"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../../../Redux/slices/authSlice";
import { useSocket } from "../../../hooks/useSocket";
import api from "../../../utils/api";
import DashboardLayout from "../../../Components/DashboardLayout/DashboardLayout";
import "./CorporateDriverDashboard.css";

export default function CorporateDriverDashboard() {
  const { user } = useSelector((state) => state.auth);
  const socket = useSocket();

  const effectiveDriverId = user?.driverId || user?._id;

  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [liveLocation, setLiveLocation] = useState(null);
  const [activeBookingTab, setActiveBookingTab] = useState("confirmed");
  const [activeMainTab, setActiveMainTab] = useState("bookings");
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [corporateInfo, setCorporateInfo] = useState(null);
  const locationIntervalRef = useRef(null);

  const navigate = useNavigate();
  const dispatch = useDispatch();

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

    socket.socket.on("new-corporate-booking", (booking) => {
      console.log("New corporate booking received:", booking);
      setBookings((prev) => [...prev, booking]);
      fetchNotifications();

      if (!isSharingLocation) {
        startAutomaticLocationSharing();
      }
    });

    socket.socket.on("corporate-booking-updated", (booking) => {
      console.log("Corporate booking updated:", booking);
      setBookings((prev) =>
        prev.map((b) => (b._id === booking._id ? booking : b)),
      );
      fetchNotifications();
    });

    socket.socket.on("location-update", (location) => {
      console.log("📍 Location update received:", location);
    });

    return () => {
      socket.socket.off("new-corporate-booking");
      socket.socket.off("corporate-booking-updated");
      socket.socket.off("location-update");
    };
  }, [
    socket,
    isSharingLocation,
    startAutomaticLocationSharing,
    fetchNotifications,
  ]);

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

  const renderContent = () => {
    switch (activeMainTab) {
      case "bookings":
        return (
          <div className="corp-driver-tab-content">
            <div className="corp-driver-tab-header">
              <h2>My Bookings</h2>
              <div
                className={`corp-driver-location-badge ${isSharingLocation ? "active" : ""}`}
              >
                {isSharingLocation ? "Sharing Live Location" : "Location Off"}
              </div>
            </div>

            <div className="corp-driver-booking-tabs">
              <button
                className={`corp-driver-booking-tab ${activeBookingTab === "confirmed" ? "active" : ""}`}
                onClick={() => setActiveBookingTab("confirmed")}
              >
                Confirmed
              </button>
              <button
                className={`corp-driver-booking-tab ${activeBookingTab === "in-progress" ? "active" : ""}`}
                onClick={() => setActiveBookingTab("in-progress")}
              >
                In Progress
              </button>
              <button
                className={`corp-driver-booking-tab ${activeBookingTab === "completed" ? "active" : ""}`}
                onClick={() => setActiveBookingTab("completed")}
              >
                Completed
              </button>
            </div>

            <div className="corp-driver-bookings-list">
              {filteredBookings.length > 0 ? (
                filteredBookings.map((booking) => (
                  <div
                    key={booking._id}
                    className={`corp-driver-booking-card ${activeBookingTab}`}
                  >
                    <div className="corp-driver-booking-info">
                      <h3>
                        {getPickupLocation(booking)} →{" "}
                        {getDropoffLocation(booking)}
                      </h3>
                      <div className="corp-driver-booking-meta">
                        <span className="corp-driver-meta-item">
                          <strong>Date:</strong>{" "}
                          {formatTripDate(
                            booking.tripDate || booking.travelDate,
                          )}
                        </span>
                        <span className="corp-driver-meta-item">
                          <strong>Time:</strong> {getTravelTime(booking)}
                        </span>
                        <span className="corp-driver-meta-item">
                          <strong>Passengers:</strong>{" "}
                          {getPassengerCount(booking)}
                        </span>
                      </div>
                      {booking.passengers && booking.passengers.length > 0 && (
                        <div className="corp-driver-passenger-list">
                          <strong>Passengers:</strong>
                          <ul>
                            {booking.passengers.map((p, idx) => (
                              <li key={idx}>
                                <span className="passenger-name">
                                  {p.name ||
                                    p.passengerId?.fullName ||
                                    p.employeeId?.fullName ||
                                    "Employee"}
                                </span>
                                {p.pickupStop && (
                                  <span className="passenger-stop">
                                    Pickup: {p.pickupStop}
                                  </span>
                                )}
                                {p.dropoffStop && (
                                  <span className="passenger-stop">
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
                      {activeBookingTab === "confirmed" && (
                        <button
                          onClick={() => startTrip(booking._id)}
                          className="corp-driver-action-btn start"
                        >
                          Start Trip
                        </button>
                      )}
                      {activeBookingTab === "in-progress" && (
                        <button
                          onClick={() => completeTrip(booking._id)}
                          className="corp-driver-action-btn complete"
                        >
                          Complete Trip
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="corp-driver-empty-state">
                  No{" "}
                  {activeBookingTab === "confirmed"
                    ? "confirmed"
                    : activeBookingTab === "in-progress"
                      ? "in-progress"
                      : "completed"}{" "}
                  bookings
                </div>
              )}
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="corp-driver-tab-content">
            <h2>Notifications</h2>
            {notifications.length === 0 ? (
              <div className="corp-driver-empty-state">No notifications</div>
            ) : (
              <div className="corp-driver-notifications-list">
                {notifications.map((notif) => (
                  <div
                    key={notif._id}
                    className={`corp-driver-notification-item ${!notif.isRead ? "unread" : ""}`}
                  >
                    <div className="corp-driver-notif-title">{notif.title}</div>
                    <div className="corp-driver-notif-message">
                      {notif.message}
                    </div>
                    <div className="corp-driver-notif-time">
                      {new Date(notif.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "location":
        return (
          <div className="corp-driver-tab-content">
            <h2>Live Location Tracking</h2>
            <div className="corp-driver-location-section">
              <div className="corp-driver-location-status-card">
                <div
                  className={`corp-driver-location-indicator ${isSharingLocation ? "active" : ""}`}
                >
                  <span className="corp-driver-location-icon">📍</span>
                  <span className="corp-driver-location-text">
                    {isSharingLocation
                      ? "Currently Sharing Location"
                      : "Location Sharing Off"}
                  </span>
                </div>
                {liveLocation && (
                  <div className="corp-driver-location-coords">
                    <p>
                      <strong>Latitude:</strong> {liveLocation.lat?.toFixed(6)}
                    </p>
                    <p>
                      <strong>Longitude:</strong> {liveLocation.lng?.toFixed(6)}
                    </p>
                    <p>
                      <strong>Last Updated:</strong>{" "}
                      {new Date(liveLocation.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                )}
                {activeTrip && (
                  <div className="corp-driver-active-trip">
                    <strong>Active Trip:</strong>{" "}
                    {activeTrip.employeeName || ""} -{" "}
                    {getPickupLocation(activeTrip)} →{" "}
                    {getDropoffLocation(activeTrip)}
                  </div>
                )}
                <div className="corp-driver-location-actions">
                  {!isSharingLocation ? (
                    <button
                      onClick={startAutomaticLocationSharing}
                      className="corp-driver-action-btn start"
                    >
                      Start Sharing
                    </button>
                  ) : (
                    <button
                      onClick={stopAutomaticLocationSharing}
                      className="corp-driver-action-btn stop"
                    >
                      Stop Sharing
                    </button>
                  )}
                </div>
              </div>

              <div className="corp-driver-location-map">
                {liveLocation ? (
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${liveLocation.lng - 0.01},${liveLocation.lat - 0.01},${liveLocation.lng + 0.01},${liveLocation.lat + 0.01}&layer=mapnik&marker=${liveLocation.lat},${liveLocation.lng}`}
                    className="corp-driver-map-iframe"
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

              <div className="corp-driver-location-info">
                <h3>How Location Sharing Works</h3>
                <ul>
                  <li>
                    Your location is shared automatically when you have active
                    trips
                  </li>
                  <li>Employees can track your real-time location</li>
                  <li>
                    Location updates every 5 seconds for accurate tracking
                  </li>
                  <li>
                    Location sharing stops automatically when all trips are
                    completed
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout activeTab={activeMainTab} setActiveTab={setActiveMainTab}>
      {renderContent()}
    </DashboardLayout>
  );
}
