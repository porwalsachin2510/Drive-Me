"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import commuterBookingAPI from "../../../services/commuterBookingAPI";
import { useSocket } from "../../../hooks/useSocket";
import { useLocale } from "../../../hooks/useLocale";
import { getCurrencyDecimals } from "../../../config/localeConfig";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import "./commuterBookingDetailsPage.css";

const CommuterBookingDetailsPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const auth = useSelector((state) => state.auth);
  const { currency: localeCurrency } = useLocale();
  const socket = useSocket();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tracking states
  const [showTracking, setShowTracking] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [isDriverOnline, setIsDriverOnline] = useState(false);

  // Cancel booking states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelPreview, setCancelPreview] = useState(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);

  // Poll booking status to catch real-time trip starts and cancellations
  // This ensures when a driver starts the trip or completes it, the UI updates immediately
  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        const response = await commuterBookingAPI.getBookingDetails(bookingId);
        if (response.success && response.data?.booking) {
          setBooking(response.data.booking);
        }
      } catch (err) {
        console.error("[v0] Error polling booking details:", err);
      }
    };

    // Initial fetch on mount
    if (bookingId && auth.user) {
      setLoading(true);
      fetchBookingDetails().finally(() => setLoading(false));

      // Poll every 5 seconds to catch trip status changes in real-time
      const pollInterval = setInterval(fetchBookingDetails, 5000);
      return () => clearInterval(pollInterval);
    }
  }, [bookingId, auth.user]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      // Awaiting the B2C partner's approval — the commuter must not see "Confirmed" yet.
      PENDING: { color: "#d69e2e", bg: "#fefcbf", label: "Pending Approval" },
      // Legacy awaiting-approval state; still shown as pending until accepted.
      CONFIRMED: { color: "#d69e2e", bg: "#fefcbf", label: "Pending Approval" },
      // Partner accepted the booking — this is the real "Confirmed" state.
      ACCEPTED: { color: "#38a169", bg: "#c6f6d5", label: "Confirmed" },
      COMPLETED: { color: "#3182ce", bg: "#bee3f8", label: "Completed" },
      REJECTED: { color: "#e53e3e", bg: "#fed7d7", label: "Rejected" },
      CANCELLED: { color: "#718096", bg: "#e2e8f0", label: "Cancelled" },
      IN_PROGRESS: { color: "#d69e2e", bg: "#fefcbf", label: "In Progress" },
      ACTIVE: { color: "#38a169", bg: "#c6f6d5", label: "Active" },
    };
    return (
      statusConfig[status] || { color: "#718096", bg: "#e2e8f0", label: status }
    );
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount, currency) => {
    const cur = currency || localeCurrency;
    return `${cur} ${parseFloat(amount || 0).toFixed(getCurrencyDecimals(cur))}`;
  };

  // Get travel time from booking or schedule data
  const getTravelTime = (bookingData) => {
    // Check if booking has direct travel time
    if (bookingData?.travelTime) return bookingData.travelTime;
    if (bookingData?.outboundTripTime) return bookingData.outboundTripTime;
    if (bookingData?.tripTime) return bookingData.tripTime;

    // Try to get from linkedSchedule
    const schedule = bookingData?.linkedSchedule;
    if (schedule?.tripTimes?.[0]) {
      const tripTime = schedule.tripTimes[0];
      const pickupLocation = bookingData?.pickupLocation;

      // Check outbound stop points for matching pickup location
      const outboundStop = tripTime.outboundStopPoints?.find(
        (stop) => stop.location === pickupLocation,
      );
      if (outboundStop?.time) return outboundStop.time;

      // Check return stop points for matching pickup location
      const returnStop = tripTime.returnStopPoints?.find(
        (stop) => stop.location === pickupLocation,
      );
      if (returnStop?.time) return returnStop.time;

      // Default to departure time if no matching stop found
      return tripTime.departureTime;
    }

    // Try to get from schedule object directly on booking
    if (bookingData?.schedule?.tripTimes?.[0]) {
      const tripTime = bookingData.schedule.tripTimes[0];
      return tripTime.departureTime;
    }

    return "N/A";
  };

  // Get the RETURN trip time for ROUND_TRIP bookings.
  // The booking stores the return leg's time separately in returnTripTime.
  const getReturnTime = (bookingData) => {
    if (bookingData?.returnTripTime) return bookingData.returnTripTime;
    if (bookingData?.returnTime) return bookingData.returnTime;

    // Fall back to schedule return stop points matching the return pickup.
    const schedule = bookingData?.linkedSchedule || bookingData?.schedule;
    if (schedule?.tripTimes?.[0]) {
      const tripTime = schedule.tripTimes[0];
      const returnPickup =
        bookingData?.returnPickupLocation || bookingData?.dropoffLocation;
      const returnStop = tripTime.returnStopPoints?.find(
        (stop) => stop.location === returnPickup,
      );
      if (returnStop?.time) return returnStop.time;
      if (tripTime.returnDepartureTime) return tripTime.returnDepartureTime;
    }

    return "N/A";
  };

  const handleBackClick = () => {
    navigate("/commuter-profile?tab=my-rides");
  };

  // Join socket room on page load to receive real-time booking updates
  useEffect(() => {
    if (socket?.socket && booking) {
      // Join the booking room to receive trip status updates
      socket.socket.emit("join_booking_room", booking._id);
      socket.socket.emit("join-booking-room", booking._id);
      console.log(
        "[v0] Joined booking room for real-time updates:",
        booking._id,
      );
    }
  }, [socket, booking]);
  useEffect(() => {
    if (socket?.socket && booking) {
      // Listen for trip started event from the driver
      const handleTripStarted = (data) => {
        if (data.bookingId === booking._id) {
          console.log(
            "[v0] Received trip started event, updating booking status",
          );
          setBooking((prevBooking) => ({
            ...prevBooking,
            outboundTripStatus:
              data.status === "IN_PROGRESS"
                ? "IN_PROGRESS"
                : prevBooking.outboundTripStatus,
            hasActiveTripInProgress: true,
            hasAnyTripEverStarted: true, // Lock: once any trip starts, permanent lock
          }));
        }
      };

      const handleTripCompleted = (data) => {
        if (data.bookingId === booking._id) {
          console.log("[v0] Received trip completed event");
          // Re-fetch booking to get the accurate final status
          commuterBookingAPI.getBookingDetails(booking._id).then((res) => {
            if (res.success && res.data?.booking) {
              setBooking(res.data.booking);
            }
          });
        }
      };

      // Subscribe to booking-specific events
      socket.socket.on("b2c-trip-started", handleTripStarted);
      socket.socket.on("trip-completed", handleTripCompleted);

      return () => {
        socket.socket.off("b2c-trip-started", handleTripStarted);
        socket.socket.off("trip-completed", handleTripCompleted);
      };
    }
  }, [socket, booking]);

  // Socket listener for driver location updates (only when tracking is active)
  useEffect(() => {
    if (!socket?.socket || !booking || !showTracking) return;

    // Join booking room for location updates
    socket.socket.emit("join_booking_room", booking._id);
    socket.socket.emit("join-booking-room", booking._id);

    // Listen for driver location updates
    const handleLocationUpdate = (locationData) => {
      const lat =
        locationData.location?.lat || locationData.lat || locationData.latitude;
      const lng =
        locationData.location?.lng ||
        locationData.lng ||
        locationData.longitude;

      if (!lat || !lng) return;

      setDriverLocation({
        lat: lat,
        lng: lng,
        lastUpdate: Date.now(),
      });
      setIsDriverOnline(true);
    };

    socket.socket.on("driver-location-update", handleLocationUpdate);
    socket.socket.on("b2c-driver-location", handleLocationUpdate);
    socket.socket.on("location-update", handleLocationUpdate);

    return () => {
      socket.socket.off("driver-location-update", handleLocationUpdate);
      socket.socket.off("b2c-driver-location", handleLocationUpdate);
      socket.socket.off("location-update", handleLocationUpdate);
    };
  }, [socket, booking, showTracking]);

  // Resolve the OUTBOUND leg driver id (handles self-driver vs assigned driver).
  const getOutboundDriverId = () => {
    if (!booking) return null;
    if (booking.outboundIsSelfDriver) {
      return booking.b2cPartnerId?._id || booking.b2cPartnerId;
    }
    return (
      booking.outboundDriverId?._id ||
      booking.outboundDriverId ||
      booking.assignedDriverId?._id ||
      booking.assignedDriverId ||
      booking.b2cPartnerId?._id ||
      booking.b2cPartnerId
    );
  };

  // Resolve the RETURN leg driver id, falling back to the outbound driver when the
  // partner did not assign a dedicated return-leg driver.
  const getReturnDriverId = () => {
    if (!booking) return null;
    if (booking.returnIsSelfDriver) {
      return booking.b2cPartnerId?._id || booking.b2cPartnerId;
    }
    return (
      booking.returnDriverId?._id ||
      booking.returnDriverId ||
      getOutboundDriverId()
    );
  };

  // CRITICAL: For ROUND_TRIP, track the driver of the ACTIVE leg and auto-switch.
  // While the outbound (jaane) leg is scheduled/in-progress we track the outbound
  // driver; once the return (aane) leg becomes active we track the return driver.
  const resolveActiveLegDriverId = () => {
    if (!booking) return null;

    if (booking.bookingType !== "ROUND_TRIP") {
      // ONE_WAY
      if (booking.isSelfDriver) {
        return booking.b2cPartnerId?._id || booking.b2cPartnerId;
      }
      return (
        booking.assignedDriverId?._id ||
        booking.assignedDriverId ||
        getOutboundDriverId()
      );
    }

    const outboundDriverId = getOutboundDriverId();
    const returnDriverId = getReturnDriverId();
    const ob = booking.outboundTripStatus;
    const rb = booking.returnTripStatus;

    // 1) Whichever leg is actively running wins.
    if (rb === "IN_PROGRESS") return returnDriverId;
    if (ob === "IN_PROGRESS") return outboundDriverId;
    // 2) Otherwise track the next pending leg (outbound first).
    if (ob !== "COMPLETED" && ob !== "CANCELLED") return outboundDriverId;
    if (rb !== "COMPLETED" && rb !== "CANCELLED") return returnDriverId;
    // 3) Both legs finished - default to the return (last) leg.
    return returnDriverId || outboundDriverId;
  };

  // Human-readable label for which leg is currently being tracked.
  const getActiveLegLabel = () => {
    if (!booking || booking.bookingType !== "ROUND_TRIP") return null;
    const rb = booking.returnTripStatus;
    const ob = booking.outboundTripStatus;
    const trackingReturn =
      rb === "IN_PROGRESS" ||
      ((ob === "COMPLETED" || ob === "CANCELLED") &&
        rb !== "COMPLETED" &&
        rb !== "CANCELLED") ||
      (rb !== "COMPLETED" && ob === "COMPLETED");
    return trackingReturn
      ? "Return leg (To → From)"
      : "Outbound leg (From → To)";
  };

  // Handle track driver click
  const handleTrackDriver = async () => {
    setShowTracking(true);
    if (socket?.socket && booking) {
      // Join the booking room to receive location updates
      socket.socket.emit("join_booking_room", booking._id);
      socket.socket.emit("join-booking-room", booking._id);

      // Determine which driver to track based on the active leg (auto-switch).
      const driverId = resolveActiveLegDriverId();

      // Request current driver location via socket
      if (driverId) {
        socket.socket.emit("request-driver-location", {
          driverId,
          bookingId: booking._id,
        });
      }
    }

    // Also fetch current location from API as fallback
    await fetchDriverLocationFromAPI();
  };

  // Fetch driver location from API (fallback when socket doesn't provide updates)
  const fetchDriverLocationFromAPI = async () => {
    if (!booking) return;

    // Determine which driver to track based on the active leg (auto-switch
    // between outbound and return drivers for ROUND_TRIP bookings).
    const driverId = resolveActiveLegDriverId();

    if (!driverId) {
      return;
    }

    try {
      // Pass bookingId to ensure we get the correct trip for this specific booking
      const response = await commuterBookingAPI.getDriverLocation(
        driverId,
        booking._id,
      );

      if (response.success && response.data) {
        // CRITICAL: Check if tracking is allowed based on booking status
        // If trackingAllowed is false, booking is not ACCEPTED yet
        if (response.data.trackingAllowed === false) {
          setIsDriverOnline(false);
          return;
        }

        if (response.data.location) {
          const locationData = response.data.location;
          const lat = locationData.latitude || locationData.lat;
          const lng = locationData.longitude || locationData.lng;

          if (lat && lng) {
            setDriverLocation({
              lat: lat,
              lng: lng,
              lastUpdate: Date.now(),
            });
            setIsDriverOnline(true);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching driver location from API:", err);
    }
  };

  // Poll driver location via API when tracking is active (as fallback to socket)
  useEffect(() => {
    if (!showTracking || !booking) return;

    // Fetch immediately when tracking starts
    fetchDriverLocationFromAPI();

    // Poll every 10 seconds as a fallback when socket updates don't arrive
    const pollInterval = setInterval(() => {
      // Only poll if we haven't received a recent socket update
      if (
        !driverLocation ||
        Date.now() - (driverLocation.lastUpdate || 0) > 8000
      ) {
        fetchDriverLocationFromAPI();
      }
    }, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [showTracking, booking]);

  // Handle close tracking
  const handleCloseTracking = () => {
    setShowTracking(false);
    setDriverLocation(null);
  };

  // Handle cancel booking
  // Open the cancel modal and fetch the dynamic cancellation charge preview
  // so the commuter sees the exact fee/refund (per the admin's policy) up front.
  const openCancelModal = async () => {
    setShowCancelModal(true);
    setCancelPreview(null);
    try {
      setCancelPreviewLoading(true);
      const res = await commuterBookingAPI.getCancellationPreview(booking._id);
      if (res.success) {
        setCancelPreview(res.preview);
      }
    } catch (err) {
      console.error("[v0] Error fetching cancellation preview:", err);
    } finally {
      setCancelPreviewLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) {
      alert("Please provide a reason for cancellation");
      return;
    }

    try {
      setCancelLoading(true);
      const response = await commuterBookingAPI.cancelBooking(
        booking._id,
        cancelReason,
      );
      if (response.success) {
        // Show the detailed, settlement-aware message from the backend
        // (e.g. wallet refund vs. cash to be returned by the operator)
        alert(response.message || "Booking cancelled successfully");
        setShowCancelModal(false);
        // Refresh booking data
        const updatedBooking =
          await commuterBookingAPI.getBookingDetails(bookingId);
        if (updatedBooking.success && updatedBooking.data?.booking) {
          setBooking(updatedBooking.data.booking);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel booking");
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="cbdp-page">
        <Navbar />
        <div className="cbdp-container">
          <div className="cbdp-loading">
            <div className="cbdp-spinner"></div>
            <p>Loading booking details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="cbdp-page">
        <Navbar />
        <div className="cbdp-container">
          <div className="cbdp-error">
            <div className="cbdp-error-icon">!</div>
            <h2>Booking Not Found</h2>
            <p>{error || "The booking you're looking for doesn't exist."}</p>
            <button className="cbdp-btn-primary" onClick={handleBackClick}>
              Back to My Rides
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const statusInfo = getStatusBadge(booking.bookingStatus);
  const driverInfo = booking.driverInfo;
  const vehicleInfo = booking.vehicleInfo;
  const isRoundTripBooking = booking.bookingType === "ROUND_TRIP";
  // Per-leg driver/vehicle (populated by backend for ROUND_TRIP bookings)
  const outboundDriverInfo = booking.outboundDriverInfo || driverInfo;
  const returnDriverInfo = booking.returnDriverInfo || driverInfo;
  const outboundVehicleInfo = booking.outboundVehicleInfo || vehicleInfo;
  const returnVehicleInfo = booking.returnVehicleInfo || vehicleInfo;
  // Whether the two legs actually use different drivers/vehicles
  const hasDistinctReturnDriver =
    isRoundTripBooking &&
    returnDriverInfo &&
    outboundDriverInfo &&
    (returnDriverInfo.name !== outboundDriverInfo.name ||
      returnDriverInfo.phone !== outboundDriverInfo.phone);
  const hasDistinctReturnVehicle =
    isRoundTripBooking &&
    returnVehicleInfo &&
    outboundVehicleInfo &&
    returnVehicleInfo.licensePlate !== outboundVehicleInfo.licensePlate;
  const partnerInfo = booking.partnerInfo;

  return (
    <div className="cbdp-page">
      <Navbar />
      <div className="cbdp-container">
        {/* Back Button */}
        <button className="cbdp-back-btn" onClick={handleBackClick}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to My Rides
        </button>

        {/* Booking Header */}
        <div className="cbdp-header">
          <div className="cbdp-header-left">
            <h1>Booking Details</h1>
            <p className="cbdp-booking-id">
              Booking ID: #{booking._id?.slice(-8).toUpperCase()}
            </p>
          </div>
          <div
            className="cbdp-status-badge"
            style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
          >
            {statusInfo.label}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="cbdp-content-grid">
          {/* Route Information Card */}
          <div className="cbdp-card cbdp-route-card">
            <h2 className="cbdp-card-title">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Route Information
            </h2>
            <div className="cbdp-route-visual">
              <div className="cbdp-route-point cbdp-pickup">
                <div className="cbdp-point-marker pickup"></div>
                <div className="cbdp-point-details">
                  <span className="cbdp-point-label">Pickup</span>
                  <span className="cbdp-point-value">
                    {booking.pickupLocation || "N/A"}
                  </span>
                </div>
              </div>
              <div className="cbdp-route-line"></div>
              <div className="cbdp-route-point cbdp-dropoff">
                <div className="cbdp-point-marker dropoff"></div>
                <div className="cbdp-point-details">
                  <span className="cbdp-point-label">Dropoff</span>
                  <span className="cbdp-point-value">
                    {booking.dropoffLocation || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {booking.bookingType === "ROUND_TRIP" && (
              <div className="cbdp-return-route">
                <h3>Return Trip</h3>
                <div className="cbdp-route-visual">
                  <div className="cbdp-route-point cbdp-pickup">
                    <div className="cbdp-point-marker pickup"></div>
                    <div className="cbdp-point-details">
                      <span className="cbdp-point-label">Return Pickup</span>
                      <span className="cbdp-point-value">
                        {booking.returnPickupLocation ||
                          booking.dropoffLocation}
                      </span>
                    </div>
                  </div>
                  <div className="cbdp-route-line"></div>
                  <div className="cbdp-route-point cbdp-dropoff">
                    <div className="cbdp-point-marker dropoff"></div>
                    <div className="cbdp-point-details">
                      <span className="cbdp-point-label">Return Dropoff</span>
                      <span className="cbdp-point-value">
                        {booking.returnDropoffLocation ||
                          booking.pickupLocation}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Booking Details Card */}
          <div className="cbdp-card">
            <h2 className="cbdp-card-title">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Booking Details
            </h2>
            <div className="cbdp-details-grid">
              <div className="cbdp-detail-item">
                <span className="cbdp-detail-label">Travel Date</span>
                <span className="cbdp-detail-value">
                  {formatDate(booking.travelDate)}
                </span>
              </div>
              <div className="cbdp-detail-item">
                <span className="cbdp-detail-label">
                  {booking.bookingType === "ROUND_TRIP"
                    ? "Onward Time"
                    : "Travel Time"}
                </span>
                <span className="cbdp-detail-value">
                  {getTravelTime(booking)}
                </span>
              </div>
              {booking.bookingType === "ROUND_TRIP" && (
                <div className="cbdp-detail-item">
                  <span className="cbdp-detail-label">Return Time</span>
                  <span className="cbdp-detail-value">
                    {getReturnTime(booking)}
                  </span>
                </div>
              )}
              <div className="cbdp-detail-item">
                <span className="cbdp-detail-label">Booking Type</span>
                <span className="cbdp-detail-value">
                  {booking.bookingType?.replace("_", " ") || "ONE WAY"}
                </span>
              </div>
              <div className="cbdp-detail-item">
                <span className="cbdp-detail-label">Seats</span>
                <span className="cbdp-detail-value">
                  {booking.numberOfSeats || 1}
                </span>
              </div>
              <div className="cbdp-detail-item">
                <span className="cbdp-detail-label">Booked On</span>
                <span className="cbdp-detail-value">
                  {formatDate(booking.bookingDate || booking.createdAt)}
                </span>
              </div>
              {booking.isMonthlyPass && (
                <>
                  <div className="cbdp-detail-item">
                    <span className="cbdp-detail-label">Pass Duration</span>
                    <span className="cbdp-detail-value">
                      {booking.passDuration} Month(s)
                    </span>
                  </div>
                  <div className="cbdp-detail-item">
                    <span className="cbdp-detail-label">Pass Start</span>
                    <span className="cbdp-detail-value">
                      {formatDate(booking.passStartDate)}
                    </span>
                  </div>
                  <div className="cbdp-detail-item">
                    <span className="cbdp-detail-label">Pass End</span>
                    <span className="cbdp-detail-value">
                      {formatDate(booking.passEndDate)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Driver Information Card */}
          <div className="cbdp-card">
            <h2 className="cbdp-card-title">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {isRoundTripBooking && hasDistinctReturnDriver
                ? "Driver Information — Outbound (From → To)"
                : "Driver Information"}
            </h2>
            {driverInfo || booking.driverName ? (
              <div className="cbdp-driver-card">
                <div className="cbdp-driver-avatar">
                  {driverInfo?.profileImage || booking.driverImage ? (
                    <img
                      src={driverInfo?.profileImage || booking.driverImage}
                      alt={driverInfo?.name || booking.driverName}
                    />
                  ) : (
                    <div className="cbdp-avatar-placeholder">
                      {(driverInfo?.name || booking.driverName)?.charAt(0) ||
                        "D"}
                    </div>
                  )}
                </div>
                <div className="cbdp-driver-details">
                  <h3>
                    {driverInfo?.name || booking.driverName || "Driver Name"}
                  </h3>
                  {(driverInfo?.isSelfDriver || booking.isSelfDriver) && (
                    <span className="cbdp-self-driver-badge">
                      Partner Driver
                    </span>
                  )}
                  <p className="cbdp-driver-contact">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    {driverInfo?.phone || booking.driverPhoneNumber || "N/A"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="cbdp-no-driver">
                <p>Driver not assigned yet</p>
              </div>
            )}
          </div>

          {/* Return Driver Information Card (Round Trip with a different return driver) */}
          {isRoundTripBooking &&
            hasDistinctReturnDriver &&
            returnDriverInfo && (
              <div className="cbdp-card">
                <h2 className="cbdp-card-title">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Driver Information — Return (To → From)
                </h2>
                <div className="cbdp-driver-card">
                  <div className="cbdp-driver-avatar">
                    {returnDriverInfo.profileImage ? (
                      <img
                        src={returnDriverInfo.profileImage}
                        alt={returnDriverInfo.name}
                      />
                    ) : (
                      <div className="cbdp-avatar-placeholder">
                        {returnDriverInfo.name?.charAt(0) || "D"}
                      </div>
                    )}
                  </div>
                  <div className="cbdp-driver-details">
                    <h3>{returnDriverInfo.name || "Driver Name"}</h3>
                    {returnDriverInfo.isSelfDriver && (
                      <span className="cbdp-self-driver-badge">
                        Partner Driver
                      </span>
                    )}
                    <p className="cbdp-driver-contact">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {returnDriverInfo.phone || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* Vehicle Information Card */}
          <div className="cbdp-card">
            <h2 className="cbdp-card-title">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              {isRoundTripBooking && hasDistinctReturnVehicle
                ? "Vehicle Information — Outbound (From → To)"
                : "Vehicle Information"}
            </h2>
            {vehicleInfo ? (
              <div className="cbdp-vehicle-info">
                {vehicleInfo.image && (
                  <div className="cbdp-vehicle-image">
                    <img src={vehicleInfo.image} alt={vehicleInfo.model} />
                  </div>
                )}
                <div className="cbdp-vehicle-details-grid">
                  <div className="cbdp-vehicle-item">
                    <span className="cbdp-vehicle-label">Model</span>
                    <span className="cbdp-vehicle-value">
                      {vehicleInfo.model || "N/A"}
                    </span>
                  </div>
                  <div className="cbdp-vehicle-item">
                    <span className="cbdp-vehicle-label">Plate Number</span>
                    <span className="cbdp-vehicle-value">
                      {vehicleInfo.licensePlate || "N/A"}
                    </span>
                  </div>
                  <div className="cbdp-vehicle-item">
                    <span className="cbdp-vehicle-label">Type</span>
                    <span className="cbdp-vehicle-value">
                      {vehicleInfo.vehicleType || "N/A"}
                    </span>
                  </div>
                  <div className="cbdp-vehicle-item">
                    <span className="cbdp-vehicle-label">Color</span>
                    <span className="cbdp-vehicle-value">
                      {vehicleInfo.vehicleColor || "N/A"}
                    </span>
                  </div>
                  <div className="cbdp-vehicle-item">
                    <span className="cbdp-vehicle-label">Capacity</span>
                    <span className="cbdp-vehicle-value">
                      {vehicleInfo.seatingCapacity || "N/A"} seats
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="cbdp-no-vehicle">
                <p>Vehicle information not available</p>
              </div>
            )}
          </div>

          {/* Return Vehicle Information Card (Round Trip with a different return vehicle) */}
          {isRoundTripBooking &&
            hasDistinctReturnVehicle &&
            returnVehicleInfo && (
              <div className="cbdp-card">
                <h2 className="cbdp-card-title">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                  Vehicle Information — Return (To → From)
                </h2>
                <div className="cbdp-vehicle-info">
                  {returnVehicleInfo.image && (
                    <div className="cbdp-vehicle-image">
                      <img
                        src={returnVehicleInfo.image}
                        alt={returnVehicleInfo.model}
                      />
                    </div>
                  )}
                  <div className="cbdp-vehicle-details-grid">
                    <div className="cbdp-vehicle-item">
                      <span className="cbdp-vehicle-label">Model</span>
                      <span className="cbdp-vehicle-value">
                        {returnVehicleInfo.model || "N/A"}
                      </span>
                    </div>
                    <div className="cbdp-vehicle-item">
                      <span className="cbdp-vehicle-label">Plate Number</span>
                      <span className="cbdp-vehicle-value">
                        {returnVehicleInfo.licensePlate || "N/A"}
                      </span>
                    </div>
                    <div className="cbdp-vehicle-item">
                      <span className="cbdp-vehicle-label">Type</span>
                      <span className="cbdp-vehicle-value">
                        {returnVehicleInfo.vehicleType || "N/A"}
                      </span>
                    </div>
                    <div className="cbdp-vehicle-item">
                      <span className="cbdp-vehicle-label">Color</span>
                      <span className="cbdp-vehicle-value">
                        {returnVehicleInfo.vehicleColor || "N/A"}
                      </span>
                    </div>
                    <div className="cbdp-vehicle-item">
                      <span className="cbdp-vehicle-label">Capacity</span>
                      <span className="cbdp-vehicle-value">
                        {returnVehicleInfo.seatingCapacity || "N/A"} seats
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Payment Information Card */}
          <div className="cbdp-card">
            <h2 className="cbdp-card-title">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Payment Information
            </h2>
            <div className="cbdp-payment-summary">
              <div className="cbdp-payment-row">
                <span>Payment Method</span>
                <span>{booking.paymentMethod || "N/A"}</span>
              </div>
              <div className="cbdp-payment-row">
                <span>Payment Status</span>
                <span
                  className={`cbdp-payment-status ${booking.paymentStatus?.toLowerCase()}`}
                >
                  {booking.paymentStatus || "PENDING"}
                </span>
              </div>
              {booking.transactionId && (
                <div className="cbdp-payment-row">
                  <span>Transaction ID</span>
                  <span className="cbdp-transaction-id">
                    {booking.transactionId}
                  </span>
                </div>
              )}
              <div className="cbdp-payment-total">
                <span>Total Amount</span>
                <span className="cbdp-total-amount">
                  {formatCurrency(booking.paymentAmount, booking.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Partner Information */}
          {(partnerInfo || booking.b2cPartnerId) && (
            <div className="cbdp-card">
              <h2 className="cbdp-card-title">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Service Provider
              </h2>
              <div className="cbdp-partner-details">
                <div className="cbdp-partner-item">
                  <span className="cbdp-partner-label">Name</span>
                  <span className="cbdp-partner-value">
                    {partnerInfo?.name ||
                      booking.b2cPartnerId?.fullName ||
                      booking.b2cPartnerId?.name ||
                      "N/A"}
                  </span>
                </div>
                {(partnerInfo?.phone || booking.b2cPartnerId?.phone) && (
                  <div className="cbdp-partner-item">
                    <span className="cbdp-partner-label">Contact</span>
                    <span className="cbdp-partner-value">
                      {partnerInfo?.phone || booking.b2cPartnerId?.phone}
                    </span>
                  </div>
                )}
                {(partnerInfo?.email || booking.b2cPartnerId?.email) && (
                  <div className="cbdp-partner-item">
                    <span className="cbdp-partner-label">Email</span>
                    <span className="cbdp-partner-value">
                      {partnerInfo?.email || booking.b2cPartnerId?.email}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="cbdp-actions">
          {/* CRITICAL: Track Driver button visibility:
                      1. Booking must be ACCEPTED or IN_PROGRESS (not PENDING, CONFIRMED, or COMPLETED)
                      2. Trip must be IN_PROGRESS - checked via multiple sources:
                         - outboundTripStatus/returnTripStatus fields
                         - hasActiveTripInProgress flag (computed by backend from actual trip data)
                      - For ONE_WAY: Show only if outboundTripStatus is IN_PROGRESS
                      - For ROUND_TRIP: Show if outboundTripStatus OR returnTripStatus is IN_PROGRESS */}
          {(() => {
            // First check: Booking must be ACCEPTED or IN_PROGRESS status
            // PENDING/CONFIRMED means waiting for partner acceptance - no tracking yet
            // COMPLETED means all trips done - no tracking needed
            const bookingIsTrackable = ["ACCEPTED", "IN_PROGRESS"].includes(
              booking.bookingStatus,
            );

            if (!bookingIsTrackable) {
              return null; // Don't show track button if booking not accepted/in_progress
            }

            // Second check: At least one trip must be IN_PROGRESS
            // Check via booking-level fields AND backend-computed hasActiveTripInProgress
            const outboundStatus = booking.outboundTripStatus || "SCHEDULED";
            const returnStatus = booking.returnTripStatus || "SCHEDULED";
            const isRoundTrip = booking.bookingType === "ROUND_TRIP";

            // Show track button ONLY when trip is IN_PROGRESS
            // NOT before trip starts (SCHEDULED) and NOT after trip completes (COMPLETED)
            const outboundInProgress = outboundStatus === "IN_PROGRESS";
            const returnInProgress =
              isRoundTrip && returnStatus === "IN_PROGRESS";

            // CRITICAL: Also check hasActiveTripInProgress which is computed by backend
            // from the actual trip data (more reliable than booking-level fields)
            const showTrack =
              outboundInProgress ||
              returnInProgress ||
              booking.hasActiveTripInProgress;

            return showTrack ? (
              <button className="cbdp-btn-track" onClick={handleTrackDriver}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {showTracking ? "Tracking Active..." : "Track Driver"}
              </button>
            ) : null;
          })()}
          {(() => {
            // A commuter can cancel ONLY before ANY trip in the booking has started.
            // Once ANY trip has ever been IN_PROGRESS or COMPLETED (even if return trip pending),
            // cancellation is permanently locked for the entire booking.
            // This applies to monthly/round-trip passes which may have multiple trip legs.
            const cancellableStatus = [
              "PENDING",
              "CONFIRMED",
              "ACCEPTED",
            ].includes(booking.bookingStatus);

            // PERMANENT LOCK: Check if ANY trip has ever started (not just currently active)
            const tripStartedOrCompleted =
              booking.bookingStatus === "IN_PROGRESS" ||
              booking.outboundTripStatus === "IN_PROGRESS" ||
              booking.outboundTripStatus === "COMPLETED" ||
              booking.returnTripStatus === "IN_PROGRESS" ||
              booking.returnTripStatus === "COMPLETED" ||
              booking.hasActiveTripInProgress === true ||
              booking.hasAnyTripEverStarted === true;

            if (cancellableStatus && !tripStartedOrCompleted) {
              return (
                <button className="cbdp-btn-cancel" onClick={openCancelModal}>
                  Cancel Booking
                </button>
              );
            }

            if (tripStartedOrCompleted) {
              return (
                <span className="cbdp-cancel-locked">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  cancellation is no longer available
                </span>
              );
            }

            return null;
          })()}
          <button className="cbdp-btn-secondary" onClick={handleBackClick}>
            Back to My Rides
          </button>
        </div>

        {/* Tracking Modal */}
        {showTracking && (
          <div className="cbdp-tracking-overlay">
            <div className="cbdp-tracking-modal cbdp-tracking-modal-large">
              <div className="cbdp-tracking-header">
                <div>
                  <h3>Live Driver Tracking</h3>
                  {getActiveLegLabel() && (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        fontWeight: 500,
                      }}
                    >
                      Tracking: {getActiveLegLabel()}
                    </span>
                  )}
                </div>
                <button
                  className="cbdp-close-btn"
                  onClick={handleCloseTracking}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="cbdp-tracking-content">
                <div className="cbdp-driver-status">
                  <div
                    className={`cbdp-status-indicator ${isDriverOnline ? "online" : "offline"}`}
                  ></div>
                  <span>
                    {isDriverOnline
                      ? "Driver is Online"
                      : "Waiting for driver location..."}
                  </span>
                </div>

                {/* Map Container */}
                <div
                  className="cbdp-map-container"
                  style={{
                    height: "350px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "2px solid #e0e0e0",
                    position: "relative",
                    background: "#f8f9fa",
                    marginBottom: "16px",
                  }}
                >
                  {driverLocation ? (
                    <>
                      <iframe
                        title="Live Driver Tracking Map"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${driverLocation.lng - 0.005},${driverLocation.lat - 0.005},${driverLocation.lng + 0.005},${driverLocation.lat + 0.005}&layer=mapnik&mlat=${driverLocation.lat}&mlon=${driverLocation.lng}&zoom=16`}
                        style={{ border: 0 }}
                        allowFullScreen
                      />
                      {/* Driver Icon Overlay */}
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          zIndex: 1000,
                          pointerEvents: "none",
                        }}
                      >
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            backgroundColor: "#007bff",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 10px rgba(0, 123, 255, 0.5)",
                            border: "3px solid white",
                            animation: "driverPulse 2s infinite",
                          }}
                        >
                          <span style={{ fontSize: "20px", color: "white" }}>
                            🚗
                          </span>
                        </div>
                      </div>
                      {/* Status Badge */}
                      <div
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          backgroundColor: "rgba(40, 167, 69, 0.9)",
                          color: "white",
                          padding: "8px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        📍 Live Tracking Active
                      </div>
                    </>
                  ) : (
                    <div
                      className="cbdp-waiting-location"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                      }}
                    >
                      <div className="cbdp-pulse-loader"></div>
                      <p style={{ marginTop: "16px", color: "#718096" }}>
                        Waiting for driver to share location...
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#a0aec0",
                          marginTop: "8px",
                        }}
                      >
                        The map will appear once the driver starts sharing their
                        location
                      </p>
                    </div>
                  )}
                </div>

                {driverLocation && (
                  <div
                    className="cbdp-location-info"
                    style={{ marginBottom: "16px" }}
                  >
                    <p style={{ fontSize: "12px", color: "#718096" }}>
                      Last updated:{" "}
                      {new Date(driverLocation.lastUpdate).toLocaleTimeString()}
                    </p>
                  </div>
                )}

                <div className="cbdp-tracking-info">
                  <p>
                    <strong>Driver:</strong>{" "}
                    {driverInfo?.name || booking.driverName || "N/A"}
                  </p>
                  <p>
                    <strong>Phone:</strong>{" "}
                    {driverInfo?.phone || booking.driverPhoneNumber || "N/A"}
                  </p>
                  {(driverInfo?.profileImage || booking.driverImage) && (
                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <img
                        src={driverInfo?.profileImage || booking.driverImage}
                        alt="Driver"
                        style={{
                          width: "50px",
                          height: "50px",
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                      <div>
                        <p style={{ margin: 0, fontWeight: 600 }}>
                          {driverInfo?.name || booking.driverName}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            color: "#718096",
                          }}
                        >
                          {booking.isSelfDriver
                            ? "Partner Driver"
                            : "Assigned Driver"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Booking Modal */}
        {showCancelModal && (
          <div className="cbdp-modal-overlay">
            <div className="cbdp-modal">
              <div className="cbdp-modal-header">
                <h3>Cancel Booking</h3>
                <button
                  className="cbdp-close-btn"
                  onClick={() => setShowCancelModal(false)}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="cbdp-modal-content">
                <p>Are you sure you want to cancel this booking?</p>
                <p className="cbdp-warning-text">
                  This action cannot be undone.
                </p>

                {/* Dynamic cancellation charge breakdown (admin-configured policy) */}
                {cancelPreviewLoading && (
                  <div className="cbdp-cancel-preview cbdp-cancel-preview-loading">
                    Calculating cancellation charges...
                  </div>
                )}
                {!cancelPreviewLoading &&
                  cancelPreview &&
                  cancelPreview.isCashUncollected && (
                    <div className="cbdp-cancel-preview">
                      {cancelPreview.cashCancellationDue > 0 ? (
                        <>
                          <div className="cbdp-cancel-preview-row">
                            <span>Total Fare</span>
                            <span>
                              {formatCurrency(
                                cancelPreview.paymentAmount,
                                cancelPreview.currency,
                              )}
                            </span>
                          </div>
                          <div className="cbdp-cancel-preview-row cbdp-cancel-preview-total">
                            <span>
                              Cancellation Fee Due
                              {cancelPreview.chargePercentage > 0
                                ? ` (${cancelPreview.chargePercentage}%)`
                                : ""}
                            </span>
                            <span className="cbdp-cancel-fee">
                              {formatCurrency(
                                cancelPreview.cashCancellationDue,
                                cancelPreview.currency,
                              )}
                            </span>
                          </div>
                          <p className="cbdp-cancel-preview-note cbdp-cancel-preview-warning">
                            {`You paid by cash, so this fee (${cancelPreview.cashDueTierLabel}) will be deducted from your wallet. If your balance goes negative, add money to clear it — you will not be able to make a new booking until your wallet is back to zero.`}
                          </p>
                        </>
                      ) : (
                        <p className="cbdp-cancel-preview-note">
                          Free cancellation - you are within the free window, so
                          no fee is due.
                        </p>
                      )}
                    </div>
                  )}
                {!cancelPreviewLoading &&
                  cancelPreview &&
                  !cancelPreview.isCashUncollected && (
                    <div className="cbdp-cancel-preview">
                      <div className="cbdp-cancel-preview-row">
                        <span>Amount Paid</span>
                        <span>
                          {formatCurrency(
                            cancelPreview.paymentAmount,
                            cancelPreview.currency,
                          )}
                        </span>
                      </div>
                      <div className="cbdp-cancel-preview-row">
                        <span>
                          Cancellation Charge
                          {cancelPreview.chargePercentage > 0
                            ? ` (${cancelPreview.chargePercentage}%)`
                            : ""}
                        </span>
                        <span className="cbdp-cancel-fee">
                          -{" "}
                          {formatCurrency(
                            cancelPreview.cancellationFee,
                            cancelPreview.currency,
                          )}
                        </span>
                      </div>
                      <div className="cbdp-cancel-preview-row cbdp-cancel-preview-total">
                        <span>You Will Receive</span>
                        <span className="cbdp-cancel-refund">
                          {formatCurrency(
                            cancelPreview.refundAmount,
                            cancelPreview.currency,
                          )}
                        </span>
                      </div>
                      <p className="cbdp-cancel-preview-note">
                        {cancelPreview.isFree
                          ? "Free cancellation - full refund."
                          : cancelPreview.appliedTierLabel}
                      </p>
                    </div>
                  )}

                <div className="cbdp-form-group">
                  <label>Reason for cancellation *</label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="cbdp-select"
                  >
                    <option value="">Select a reason</option>
                    <option value="CHANGE_OF_PLANS">Change of plans</option>
                    <option value="FOUND_ALTERNATIVE">
                      Found alternative transport
                    </option>
                    <option value="SCHEDULE_CONFLICT">Schedule conflict</option>
                    <option value="EMERGENCY">Emergency</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div className="cbdp-modal-actions">
                <button
                  className="cbdp-btn-secondary"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelLoading}
                >
                  Keep Booking
                </button>
                <button
                  className="cbdp-btn-danger"
                  onClick={handleCancelBooking}
                  disabled={cancelLoading || !cancelReason}
                >
                  {cancelLoading ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Passenger Notes */}
        {booking.passengerNotes && (
          <div className="cbdp-card cbdp-notes-card">
            <h2 className="cbdp-card-title">Notes</h2>
            <p>{booking.passengerNotes}</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CommuterBookingDetailsPage;
