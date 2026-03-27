/* eslint-disable no-unused-vars */
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import { useSelector } from "react-redux";
import { useSocket } from "../../../hooks/useSocket";
import {
  getPartnerDriverBookings,
  getPartnerBookings,
  startB2CTrip,
  completeB2CTrip,
  acceptBooking,
  rejectBooking,
  completeBooking
} from "../../../Redux/slices/bookingSlice";
import DailyTripsInBooking from "../../../Components/DailyTripsInBooking/DailyTripsInBooking";
import api from "../../../utils/api";
import "./B2CPartnerDriverDashboard.css";

function B2CPartnerDriverDashboard() {
  const { user } = useSelector((state) => state.auth);
  const { partnerBookings, loading } = useSelector((state) => state.booking);
  const socket = useSocket();
  const dispatch = useDispatch();

  // Get driver-specific bookings from Redux
  const driverBookings =
    useSelector((state) => state.booking.driverBookings) || [];

  const [liveLocation, setLiveLocation] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ACCEPTED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("bookings");
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [formattedLastLogin, setFormattedLastLogin] = useState("");
  const [activeTrip, setActiveTrip] = useState(null);
  const locationIntervalRef = useRef(null);

  const navigate = useNavigate();

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

  // Fetch B2C Partner Driver Bookings
  useEffect(() => {
    if (user?.role === "B2C_PARTNER_DRIVER") {
      dispatch(getPartnerDriverBookings({ status: "ALL" }));
    } else {
      navigate("/");
    }
  }, [dispatch, user, navigate]);

  // Memoize driverBookings to prevent dependency changes
  const memoizedDriverBookings = useMemo(
    () => driverBookings,
    [JSON.stringify(driverBookings)],
  );

  // Compute initial filter status from bookings
  const initialFilterStatus = useMemo(() => {
    if (memoizedDriverBookings && memoizedDriverBookings.length > 0) {
      const statuses = memoizedDriverBookings.map((b) => b.bookingStatus);
      const hasInProgress = statuses.includes("IN_PROGRESS");
      const hasAccepted = statuses.includes("ACCEPTED");
      const hasPending = statuses.includes("PENDING");

      if (hasInProgress) return "IN_PROGRESS";
      if (hasAccepted) return "ACCEPTED";
      if (hasPending) return "PENDING";
      return "ALL";
    }
    return "ACCEPTED";
  }, [memoizedDriverBookings]);

  // Set filter status based on available bookings - only on first load
  const hasSetInitialFilter = useRef(false);
  useEffect(() => {
    if (!hasSetInitialFilter.current && memoizedDriverBookings.length > 0) {
      setFilterStatus(initialFilterStatus);
      hasSetInitialFilter.current = true;
    }
  }, [memoizedDriverBookings, initialFilterStatus]);

  const handleAccept = (bookingId) => {
    dispatch(acceptBooking(bookingId)).then(() => {
      dispatch(getPartnerDriverBookings({ status: filterStatus }));
    });
  };

  const handleRejectClick = (booking) => {
    setSelectedBooking(booking);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = () => {
    if (selectedBooking) {
      dispatch(
        rejectBooking({
          bookingId: selectedBooking._id,
          rejectionReason,
        }),
      ).then(() => {
        dispatch(getPartnerDriverBookings({ status: filterStatus }));
        setShowRejectModal(false);
        setSelectedBooking(null);
        setRejectionReason("");
      });
    }
  };

  const handleComplete = async (bookingId) => {
    try {
      await dispatch(completeBooking(bookingId)).unwrap();
      dispatch(getPartnerBookings({ status: filterStatus }));
    } catch (error) {
      console.error("Error completing booking:", error);
    }
  };

  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      });
    });
  };

  const shareLocation = async () => {
    try {
      const position = await getCurrentPosition();
      const locationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        driverId: user?.driverId || user?._id, // Use driverId first, fallback to _id
        driverType: user?.role,
        timestamp: new Date().toISOString(),
      };

      console.log("📍 Location updated:", locationData);

      // Send location to backend
      const response = await api.post("/location/share", locationData);

      // Send real-time location to passenger
      if (socket && activeTrip) {
        socket.socket.emit("driver-location-update", {
          bookingId: activeTrip._id,
          driverId: user?.driverId || user?._id, // Use driverId first, fallback to _id
          userId: user?._id, // Always send userId so commuter can match by b2cPartnerId
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error sharing location:", error);
    }
  };

  const updateLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            driverId: user?.driverId || user?._id, // Use driverId first, fallback to _id
            timestamp: new Date().toISOString(),
            driverType: user?.role,
          };

          if (socket && socket.socket) {
            const locationData = {
              bookingId: activeTrip?._id,
              driverId: user?.driverId || user?._id,
              userId: user?._id, // Always send userId so commuter can match by b2cPartnerId
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              },
              timestamp: new Date().toISOString(),
              driverType: user?.role,
            };

            console.log("🚗 Emitting driver-location-update:", locationData);
            socket.socket.emit("driver-location-update", locationData);
          }

          setLiveLocation(location);
          console.log("📍 Location updated:", location);
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
  }, [socket, user?._id, user?.driverId, user?.role, activeTrip?._id]);

  const startAutomaticLocationSharing = useCallback(() => {
    if (isSharingLocation) return;

    setIsSharingLocation(true);
    console.log(
      "🚗 Starting automatic location sharing for B2C Partner Driver",
    );

    updateLocation();

    locationIntervalRef.current = setInterval(() => {
      updateLocation();
    }, 5000);

    if (socket && socket.socket) {
      socket.socket.emit("join-driver-room", user._id);
    }
  }, [isSharingLocation, socket, user._id, updateLocation]);

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
      console.log("🚀 Starting trip for booking:", bookingId);

      // Start the trip using the new Redux action
      const result = await dispatch(startB2CTrip(bookingId)).unwrap();

      console.log("📊 Start trip response:", result);

      // Refresh bookings to get updated status
      await dispatch(getPartnerDriverBookings({ status: filterStatus }));

      // Start location sharing for the trip
      const booking = driverBookings.find((b) => b._id === bookingId);
      setActiveTrip(booking);
      if (!isSharingLocation) {
        startAutomaticLocationSharing();
      }

      console.log("✅ Trip started successfully:", bookingId);
    } catch (error) {
      console.error("❌ Error starting trip:", error);
    }
  };

  const completeTrip = async (bookingId) => {
    try {
      console.log("🏁 Completing trip for booking:", bookingId);

      // Complete the trip using the new Redux action
      const result = await dispatch(completeB2CTrip(bookingId)).unwrap();

      console.log("📊 Complete trip response:", result);

      // Refresh bookings to get updated status
      await dispatch(getPartnerDriverBookings({ status: filterStatus }));

      const remainingTrips = partnerBookings.filter(
        (booking) =>
          booking._id !== bookingId &&
          (booking.bookingStatus === "ACCEPTED" ||
            booking.bookingStatus === "IN_PROGRESS"),
      );

      if (remainingTrips.length === 0) {
        stopAutomaticLocationSharing();
      } else {
        setActiveTrip(remainingTrips[0]);
      }

      console.log("✅ Trip completed successfully:", bookingId);
    } catch (error) {
      console.error("❌ Error completing trip:", error);
    }
  };

  useEffect(() => {
    if (!socket || !socket.socket) return;

    // Listen for new bookings
    socket.socket.on("new-b2c-booking", (booking) => {
      console.log("📱 New B2C booking received:", booking);
      dispatch(getPartnerBookings({ status: filterStatus }));

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
      socket.socket.off("new-b2c-booking");
      socket.socket.off("location-update");
    };
  }, [
    socket,
    isSharingLocation,
    startAutomaticLocationSharing,
    dispatch,
    filterStatus,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const filteredBookings = Array.isArray(driverBookings)
    ? driverBookings.filter((booking) => {
        if (filterStatus === "ALL") return true;
        return booking.bookingStatus === filterStatus;
      })
    : [];

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "#ffc107";
      case "ACCEPTED":
        return "#28a745";
      case "REJECTED":
        return "#dc3545";
      case "COMPLETED":
        return "#6c757d";
      default:
        return "#6c757d";
    }
  };

  // Compute dynamic stats from driverBookings (must be before any early return)
  const driverStats = useMemo(() => {
    const bookingsArr = Array.isArray(driverBookings) ? driverBookings : [];
    const totalTrips = bookingsArr.length;
    const completedTrips = bookingsArr.filter(
      (b) => b.bookingStatus === "COMPLETED",
    ).length;
    const acceptedTrips = bookingsArr.filter((b) =>
      ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(b.bookingStatus),
    ).length;
    const rejectedTrips = bookingsArr.filter(
      (b) => b.bookingStatus === "REJECTED",
    ).length;
    const totalDecisions = acceptedTrips + rejectedTrips;
    const acceptanceRate =
      totalDecisions > 0
        ? Math.round((acceptedTrips / totalDecisions) * 100)
        : 100;
    const ratedTrips = bookingsArr.filter((b) => b.rating && b.rating > 0);
    const avgRating =
      ratedTrips.length > 0
        ? (
            ratedTrips.reduce((sum, b) => sum + b.rating, 0) / ratedTrips.length
          ).toFixed(1)
        : "N/A";
    return { totalTrips, completedTrips, acceptanceRate, avgRating };
  }, [driverBookings]);


  const userName = user?.fullName || "User";
  const userRole = user?.role || "ADMIN";

  if (loading) {
    return (
      <div className="b2c-partner-driver-dashboard">
        <div className="loading">Loading bookings...</div>
      </div>
    );
  }

  return (
    <div className="b2c-partner-driver-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <h1>{getRoleDisplayName(userRole)} Dashboard</h1>
          <p className="driver-welcome">
            Welcome back, {user?.fullName || user?.name || "Driver"}
          </p>
          <small>Last login: {formattedLastLogin || "Never"}</small>
        </div>

        <div className="dashboard-header-right">
          <div className="driver-stat-box">
            <span className="driver-stat-label">RATING</span>
            <span className="driver-stat-value">
              {driverStats.avgRating}
              {driverStats.avgRating !== "N/A" ? "\u2605" : ""}
            </span>
          </div>
          <div className="driver-stat-box">
            <span className="driver-stat-label">TRIPS</span>
            <span className="driver-stat-value">
              {driverStats.totalTrips.toLocaleString()}
            </span>
          </div>
          <div className="driver-stat-box">
            <span className="driver-stat-label">ACCEPTANCE</span>
            <span className="driver-stat-value">
              {driverStats.acceptanceRate}%
            </span>
          </div>
          <div
            className={`location-status ${isSharingLocation ? "active" : ""}`}
          >
            {isSharingLocation ? "Sharing Live" : "Not Sharing"}
          </div>
          <button className="driver-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab ${activeMainTab === "bookings" ? "active" : ""}`}
          onClick={() => setActiveMainTab("bookings")}
        >
          Bookings
        </button>
        <button
          className={`tab ${activeMainTab === "daily-trips" ? "active" : ""}`}
          onClick={() => setActiveMainTab("daily-trips")}
        >
          Daily Trips
        </button>
        <button
          className={`tab ${activeMainTab === "location" ? "active" : ""}`}
          onClick={() => setActiveMainTab("location")}
        >
          Live Location
        </button>
      </div>

      <div className="dashboard-content">
        {activeMainTab === "bookings" && (
          <div className="bookings-section">
            <div className="bookings-header">
              <h2>Booking Management</h2>
              <div className="filter-controls">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="status-filter"
                >
                  <option value="PENDING">Pending</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ALL">All</option>
                </select>
              </div>
            </div>

            <div className="bookings-stats">
              <div className="stat-card">
                <span className="stat-number">
                  {Array.isArray(driverBookings) ? driverBookings.length : 0}
                </span>
                <span className="stat-label">Total Bookings</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {Array.isArray(driverBookings)
                    ? driverBookings.filter(
                        (b) => b.bookingStatus === "PENDING",
                      ).length
                    : 0}
                </span>
                <span className="stat-label">Pending</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {Array.isArray(driverBookings)
                    ? driverBookings.filter(
                        (b) => b.bookingStatus === "ACCEPTED",
                      ).length
                    : 0}
                </span>
                <span className="stat-label">Accepted</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {Array.isArray(driverBookings)
                    ? driverBookings.filter(
                        (b) => b.bookingStatus === "COMPLETED",
                      ).length
                    : 0}
                </span>
                <span className="stat-label">Completed</span>
              </div>
            </div>

            <div className="bookings-list">
              {filteredBookings.length === 0 ? (
                <div className="no-bookings">
                  <div className="no-bookings-icon">📋</div>
                  <h3>No bookings found</h3>
                  <p>No bookings found for the selected status</p>
                </div>
              ) : (
                filteredBookings.map((booking) => (
                  <div
                    key={booking._id}
                    className="driver-dashboard-booking-card"
                  >
                    <div className="driver-dashboard-booking-header">
                      <div className="driver-dashboard-booking-info">
                        <h4>Booking #{booking._id.slice(-8)}</h4>
                        <span
                          className="driver-dashboard-status-badge"
                          style={{
                            backgroundColor: getStatusColor(
                              booking.bookingStatus,
                            ),
                          }}
                        >
                          {booking.bookingStatus}
                        </span>
                      </div>
                      <div className="booking-date">
                        {formatDate(booking.createdAt)}
                      </div>
                    </div>

                    <div className="driver-dashboard-booking-details">
                      <div className="driver-dashboard-route-info">
                        <div className="driver-dashboard-route-point">
                          <span className="driver-dashboard-route-label">
                            From:
                          </span>{" "}
                          {booking.pickupLocation}
                        </div>
                        <div className="driver-dashboard-route-arrow">
                          &rarr;
                        </div>
                        <div className="driver-dashboard-route-point">
                          <span className="driver-dashboard-route-label">
                            To:
                          </span>{" "}
                          {booking.dropoffLocation}
                        </div>
                      </div>

                      <div className="driver-dashboard-booking-info-grid">
                        <div className="info-item">
                          <span className="info-label">Passenger</span>
                          <span className="info-value">
                            {booking.passengerId?.name ||
                              booking.passengerName ||
                              "N/A"}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Phone</span>
                          <span className="info-value">
                            {booking.passengerId?.phone || "N/A"}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Seats</span>
                          <span className="info-value">
                            {booking.numberOfSeats}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Type</span>
                          <span className="info-value">
                            {booking.bookingType === "ROUND_TRIP"
                              ? "Round Trip"
                              : "One Way"}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Price</span>
                          <span className="info-value price-highlight">
                            {booking.paymentAmount?.toLocaleString()} KWD
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Payment</span>
                          <span className="info-value">
                            {booking.paymentStatus} / {booking.paymentMethod}
                          </span>
                        </div>
                        {booking.isMonthlyPass && (
                          <>
                            <div className="info-item">
                              <span className="info-label">Pass Type</span>
                              <span className="info-value">Monthly Pass</span>
                            </div>
                            <div className="info-item">
                              <span className="info-label">
                                Driver Earnings
                              </span>
                              <span className="info-value price-highlight">
                                {booking.driverEarnings?.toLocaleString()} KWD
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {booking.bookingStatus === "PENDING" && (
                      <div className="booking-actions">
                        <button
                          className="accept-btn"
                          onClick={() => handleAccept(booking._id)}
                        >
                          Accept
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => handleRejectClick(booking)}
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Daily Trips for this Booking - trips are managed at daily level, not booking level */}
                    {(booking.bookingStatus === "ACCEPTED" ||
                      booking.bookingStatus === "IN_PROGRESS") && (
                      <DailyTripsInBooking
                        booking={booking}
                        userRole={user?.role}
                        currentUserId={user?._id}
                        currentDriverId={user?.driverId}
                        onTripStatusChange={(status, tripId) => {
                          dispatch(getPartnerDriverBookings({ status: "ALL" }));
                        }}
                        onTripStart={(tripId) => {
                          setActiveTrip(booking);
                          if (!isSharingLocation) {
                            startAutomaticLocationSharing();
                          }
                        }}
                        onTripComplete={(tripId) => {
                          stopAutomaticLocationSharing();
                        }}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Reject Modal */}
            {showRejectModal && selectedBooking && (
              <div className="modal-overlay">
                <div className="reject-modal">
                  <div className="modal-header">
                    <h3>Reject Booking</h3>
                    <button
                      className="close-btn"
                      onClick={() => {
                        setShowRejectModal(false);
                        setSelectedBooking(null);
                        setRejectionReason("");
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="modal-body">
                    <p>Are you sure you want to reject this booking?</p>
                    <div className="form-group">
                      <label>Reason for rejection:</label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter reason for rejection..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setShowRejectModal(false);
                        setSelectedBooking(null);
                        setRejectionReason("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="confirm-reject-btn"
                      onClick={handleRejectSubmit}
                      disabled={!rejectionReason.trim()}
                    >
                      Reject Booking
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeMainTab === "daily-trips" && (
          <div className="driver-dashboard-daily-trips-section">
            <h2 style={{ marginBottom: "16px" }}>Daily Trip Management</h2>
            <p style={{ color: "#666", marginBottom: "24px" }}>
              View and manage your daily trips. Start and complete individual
              trips for each booking.
            </p>
            {Array.isArray(driverBookings) &&
            driverBookings.filter(
              (b) =>
                b.bookingStatus === "ACCEPTED" ||
                b.bookingStatus === "IN_PROGRESS",
            ).length > 0 ? (
              driverBookings
                .filter(
                  (b) =>
                    b.bookingStatus === "ACCEPTED" ||
                    b.bookingStatus === "IN_PROGRESS",
                )
                .map((booking) => (
                  <div key={booking._id} style={{ marginBottom: "24px" }}>
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "#f8f9fa",
                        borderRadius: "8px 8px 0 0",
                        borderBottom: "2px solid #007bff",
                      }}
                    >
                      <strong>Booking #{booking._id.slice(-8)}</strong>
                      <span style={{ marginLeft: "12px", color: "#666" }}>
                        {booking.pickupLocation} → {booking.dropoffLocation}
                      </span>
                    </div>
                    <DailyTripsInBooking
                      booking={booking}
                      userRole={user?.role}
                      currentUserId={user?._id}
                      currentDriverId={user?.driverId}
                      onTripStatusChange={() => {
                        dispatch(getPartnerDriverBookings({ status: "ALL" }));
                      }}
                      onTripStart={() => {
                        setActiveTrip(booking);
                        if (!isSharingLocation) {
                          startAutomaticLocationSharing();
                        }
                      }}
                      onTripComplete={() => {
                        stopAutomaticLocationSharing();
                      }}
                    />
                  </div>
                ))
            ) : (
              <div className="driver-dashboard-no-bookings">
                <div className="driver-dashboard-no-bookings-icon">📅</div>
                <h3>No active trips</h3>
                <p>
                  You have no accepted or in-progress bookings with daily trips
                </p>
              </div>
            )}
          </div>
        )}

        {activeMainTab === "location" && (
          <div className="driver-dashboard-location-section">
            <h3>Live Location Tracking</h3>
            <div className="driver-dashboard-location-info">
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

            <div className="driver-dashboard-location-map">
              {liveLocation ? (
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${liveLocation.lng - 0.01},${liveLocation.lat - 0.01},${liveLocation.lng + 0.01},${liveLocation.lat + 0.01}&layer=mapnik&marker=${liveLocation.lat},${liveLocation.lng}`}
                  className="driver-dashboard-live-map"
                  width="100%"
                  height="400"
                  frameBorder="0"
                  allowFullScreen
                  title="Driver Live Location"
                />
              ) : (
                <div className="driver-dashboard-no-location">
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

export default B2CPartnerDriverDashboard;
