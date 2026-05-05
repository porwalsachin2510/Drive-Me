"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import { useSocket } from "../../../hooks/useSocket";
import {
  getPartnerDriverBookings,
  getPartnerBookings,
  startB2CTrip,
  completeB2CTrip,
  acceptBooking,
  rejectBooking,
  completeBooking,
} from "../../../Redux/slices/bookingSlice";
import DailyTripsInBooking from "../../../Components/DailyTripsInBooking/DailyTripsInBooking";
import DashboardLayout from "../../../Components/DashboardLayout/DashboardLayout";
import api from "../../../utils/api";
import "./B2CPartnerDriverDashboard.css";

function B2CPartnerDriverDashboard() {
  const { user } = useSelector((state) => state.auth);
  const { partnerBookings, loading } = useSelector((state) => state.booking);
  const socket = useSocket();
  const dispatch = useDispatch();

  const driverBookings =
    useSelector((state) => state.booking.driverBookings) || [];

  const [liveLocation, setLiveLocation] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ACCEPTED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("bookings");
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const locationIntervalRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === "B2C_PARTNER_DRIVER") {
      dispatch(getPartnerDriverBookings({ status: "ALL" }));
    } else {
      navigate("/");
    }
  }, [dispatch, user, navigate]);

  const memoizedDriverBookings = useMemo(
    () => driverBookings,
    [JSON.stringify(driverBookings)],
  );

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

  const updateLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            driverId: user?.driverId || user?._id,
            timestamp: new Date().toISOString(),
            driverType: user?.role,
          };

          if (socket && socket.socket) {
            const locationData = {
              bookingId: activeTrip?._id,
              driverId: user?.driverId || user?._id,
              userId: user?._id,
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
      const result = await dispatch(startB2CTrip(bookingId)).unwrap();
      console.log("📊 Start trip response:", result);

      await dispatch(getPartnerDriverBookings({ status: filterStatus }));

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
      const result = await dispatch(completeB2CTrip(bookingId)).unwrap();
      console.log("📊 Complete trip response:", result);

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

    socket.socket.on("new-b2c-booking", (booking) => {
      console.log("📱 New B2C booking received:", booking);
      dispatch(getPartnerBookings({ status: filterStatus }));

      if (!isSharingLocation) {
        startAutomaticLocationSharing();
      }
    });

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

  if (loading) {
    return (
      <DashboardLayout
        activeTab={activeMainTab}
        setActiveTab={setActiveMainTab}
      >
        <div className="b2c-driver-loading">Loading bookings...</div>
      </DashboardLayout>
    );
  }

  const renderContent = () => {
    switch (activeMainTab) {
      case "bookings":
        return (
          <div className="b2c-driver-tab-content">
            <div className="b2c-driver-tab-header">
              <h2>Booking Management</h2>
              <div
                className={`b2c-driver-location-badge ${isSharingLocation ? "active" : ""}`}
              >
                {isSharingLocation ? "Sharing Live Location" : "Location Off"}
              </div>
            </div>

            <div className="b2c-driver-stats-row">
              <div className="b2c-driver-stat-card">
                <span className="b2c-driver-stat-value">
                  {driverStats.avgRating}
                  {driverStats.avgRating !== "N/A" ? "★" : ""}
                </span>
                <span className="b2c-driver-stat-label">Rating</span>
              </div>
              <div className="b2c-driver-stat-card">
                <span className="b2c-driver-stat-value">
                  {driverStats.totalTrips}
                </span>
                <span className="b2c-driver-stat-label">Total Trips</span>
              </div>
              <div className="b2c-driver-stat-card">
                <span className="b2c-driver-stat-value">
                  {driverStats.acceptanceRate}%
                </span>
                <span className="b2c-driver-stat-label">Acceptance</span>
              </div>
              <div className="b2c-driver-stat-card">
                <span className="b2c-driver-stat-value">
                  {driverStats.completedTrips}
                </span>
                <span className="b2c-driver-stat-label">Completed</span>
              </div>
            </div>

            <div className="b2c-driver-filter-row">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="b2c-driver-status-filter"
              >
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REJECTED">Rejected</option>
                <option value="COMPLETED">Completed</option>
                <option value="ALL">All Bookings</option>
              </select>
            </div>

            <div className="b2c-driver-bookings-list">
              {filteredBookings.length === 0 ? (
                <div className="b2c-driver-empty-state">
                  <span className="b2c-driver-empty-icon">📋</span>
                  <h3>No bookings found</h3>
                  <p>No bookings found for the selected status</p>
                </div>
              ) : (
                filteredBookings.map((booking) => (
                  <div key={booking._id} className="b2c-driver-booking-card">
                    <div className="b2c-driver-booking-header">
                      <div className="b2c-driver-booking-id">
                        <h4>Booking #{booking._id.slice(-8)}</h4>
                        <span
                          className="b2c-driver-status-badge"
                          style={{
                            backgroundColor: getStatusColor(
                              booking.bookingStatus,
                            ),
                          }}
                        >
                          {booking.bookingStatus}
                        </span>
                      </div>
                      <span className="b2c-driver-booking-date">
                        {formatDate(booking.createdAt)}
                      </span>
                    </div>

                    <div className="b2c-driver-booking-route">
                      <div className="b2c-driver-route-point">
                        <span className="b2c-driver-route-label">From:</span>
                        <span>{booking.pickupLocation}</span>
                      </div>
                      <span className="b2c-driver-route-arrow">→</span>
                      <div className="b2c-driver-route-point">
                        <span className="b2c-driver-route-label">To:</span>
                        <span>{booking.dropoffLocation}</span>
                      </div>
                    </div>

                    <div className="b2c-driver-booking-details">
                      <div className="b2c-driver-detail-item">
                        <span className="b2c-driver-detail-label">
                          Passenger
                        </span>
                        <span className="b2c-driver-detail-value">
                          {booking.passengerId?.name ||
                            booking.passengerName ||
                            "N/A"}
                        </span>
                      </div>
                      <div className="b2c-driver-detail-item">
                        <span className="b2c-driver-detail-label">Phone</span>
                        <span className="b2c-driver-detail-value">
                          {booking.passengerId?.phone || "N/A"}
                        </span>
                      </div>
                      <div className="b2c-driver-detail-item">
                        <span className="b2c-driver-detail-label">Seats</span>
                        <span className="b2c-driver-detail-value">
                          {booking.numberOfSeats}
                        </span>
                      </div>
                      <div className="b2c-driver-detail-item">
                        <span className="b2c-driver-detail-label">Price</span>
                        <span className="b2c-driver-detail-value b2c-driver-price">
                          {booking.paymentAmount?.toLocaleString()}{" "}
                          {booking.currency || "KWD"}
                        </span>
                      </div>
                    </div>

                    {booking.bookingStatus === "PENDING" && (
                      <div className="b2c-driver-booking-actions">
                        <button
                          className="b2c-driver-action-btn accept"
                          onClick={() => handleAccept(booking._id)}
                        >
                          Accept
                        </button>
                        <button
                          className="b2c-driver-action-btn reject"
                          onClick={() => handleRejectClick(booking)}
                        >
                          Reject
                        </button>
                      </div>
                    )}

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

            {showRejectModal && selectedBooking && (
              <div className="b2c-driver-modal-overlay">
                <div className="b2c-driver-modal">
                  <div className="b2c-driver-modal-header">
                    <h3>Reject Booking</h3>
                    <button
                      className="b2c-driver-modal-close"
                      onClick={() => {
                        setShowRejectModal(false);
                        setSelectedBooking(null);
                        setRejectionReason("");
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="b2c-driver-modal-body">
                    <p>Are you sure you want to reject this booking?</p>
                    <div className="b2c-driver-form-group">
                      <label>Reason for rejection:</label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter reason for rejection..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="b2c-driver-modal-actions">
                    <button
                      className="b2c-driver-action-btn cancel"
                      onClick={() => {
                        setShowRejectModal(false);
                        setSelectedBooking(null);
                        setRejectionReason("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="b2c-driver-action-btn reject"
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
        );

      case "daily-trips":
        return (
          <div className="b2c-driver-tab-content">
            <h2>Daily Trip Management</h2>
            <p className="b2c-driver-description">
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
                  <div key={booking._id} className="b2c-driver-daily-trip-card">
                    <div className="b2c-driver-daily-trip-header">
                      <strong>Booking #{booking._id.slice(-8)}</strong>
                      <span>
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
              <div className="b2c-driver-empty-state">
                <span className="b2c-driver-empty-icon">📅</span>
                <h3>No active trips</h3>
                <p>
                  You have no accepted or in-progress bookings with daily trips
                </p>
              </div>
            )}
          </div>
        );

      case "location":
        return (
          <div className="b2c-driver-tab-content">
            <h2>Live Location Tracking</h2>
            <div className="b2c-driver-location-section">
              <div className="b2c-driver-location-status-card">
                <div
                  className={`b2c-driver-location-indicator ${isSharingLocation ? "active" : ""}`}
                >
                  <span className="b2c-driver-location-icon">📍</span>
                  <span>
                    {isSharingLocation
                      ? "Actively sharing location"
                      : "Not sharing location"}
                  </span>
                </div>
                {liveLocation && (
                  <div className="b2c-driver-location-coords">
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
                  <div className="b2c-driver-active-trip">
                    <strong>Active Trip:</strong> {activeTrip.pickupLocation} →{" "}
                    {activeTrip.dropoffLocation}
                  </div>
                )}
              </div>

              <div className="b2c-driver-location-map">
                {liveLocation ? (
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${liveLocation.lng - 0.01},${liveLocation.lat - 0.01},${liveLocation.lng + 0.01},${liveLocation.lat + 0.01}&layer=mapnik&marker=${liveLocation.lat},${liveLocation.lng}`}
                    className="b2c-driver-map-iframe"
                    width="100%"
                    height="400"
                    frameBorder="0"
                    allowFullScreen
                    title="Driver Live Location"
                  />
                ) : (
                  <div className="b2c-driver-no-location">
                    <p>No location data available</p>
                  </div>
                )}
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

export default B2CPartnerDriverDashboard;
