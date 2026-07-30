/* eslint-disable no-unused-vars */
"use client";

import { useLocale } from "../../../hooks/useLocale";
import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../../../hooks/useSocket";
import {
  getPartnerBookings,
  acceptBooking,
  rejectBooking,
  startB2CTrip,
  completeB2CTrip,
} from "../../../Redux/slices/bookingSlice";
import DailyTripsInBooking from "../../../Components/DailyTripsInBooking/DailyTripsInBooking";
import api from "../../../utils/api";
import WalletRechargeModal from "../../../Components/WalletRechargeModal/WalletRechargeModal";
import PassengerDetailsModal from "../../../Components/B2C_Partner/PassengerDetailsModal/PassengerDetailsModal";
import {
  getCountryConfig,
  getCashAcceptanceBuffer,
} from "../../../config/localeConfig";
import "./b2c_partnerbookingspage.css";
import { notify } from "../../../utils/toast";

const B2C_PartnerBookingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const socket = useSocket();
  const { partnerBookings, loading } = useSelector((state) => state.booking);
  const auth = useSelector((state) => state.auth);
  // Active currency for the logged-in partner's country (e.g. KWD for Kuwait).
  const { currency: activeCurrency } = useLocale();
  const [filterStatus, setFilterStatus] = useState("CONFIRMED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showWalletWarning, setShowWalletWarning] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const locationSharingRef = useRef(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningData, setWarningData] = useState(null);
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [selectedPassengerBookingId, setSelectedPassengerBookingId] =
    useState(null);

  const fetchWalletBalance = async () => {
    try {
      const response = await api.get("/wallet/balance");
      const balance = response.data.data?.balance || 0;
      setWalletBalance(balance);
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      setWalletBalance(0);
    }
  };

  useEffect(() => {
    if (auth.user?.role === "B2C_PARTNER") {
      dispatch(getPartnerBookings({ status: filterStatus }));
      fetchWalletBalance();
    } else {
      navigate("/");
    }
  }, [dispatch, auth.user, filterStatus, navigate]);

  // Add useEffect to fetch wallet balance when component mounts
  useEffect(() => {
    if (auth.user?.role === "B2C_PARTNER") {
      fetchWalletBalance();
    }
  }, [auth.user]);

  // Socket listener for booking warning notifications
  useEffect(() => {
    if (socket && socket.socket && auth.user) {
      // Join notification room
      socket.socket.emit(
        "join-notification-room",
        auth.user.id || auth.user._id,
      );

      // Listen for booking warning notifications
      socket.socket.on("BOOKING_WARNING", (data) => {
        console.log("[v0] Booking warning notification received:", data);
        setWarningData(data);
        setShowWarningModal(true);
        // Refresh bookings to update warning indicators
        dispatch(getPartnerBookings({ status: filterStatus }));
      });

      // Listen for general notifications that include warnings
      socket.socket.on("notification", (notification) => {
        if (notification.type === "BOOKING_WARNING") {
          setWarningData(notification.data || notification);
          setShowWarningModal(true);
          dispatch(getPartnerBookings({ status: filterStatus }));
        }
        if (notification.type === "BOOKING_TIMEOUT_CANCELLED") {
          // Refresh bookings when a booking is auto-cancelled
          dispatch(getPartnerBookings({ status: filterStatus }));
        }
      });

      return () => {
        if (socket.socket) {
          socket.socket.off("BOOKING_WARNING");
          socket.socket.off("notification");
        }
      };
    }
  }, [socket, auth.user, dispatch, filterStatus]);

  const handleAccept = (booking) => {
    // Check wallet balance for cash bookings
    if (booking.paymentMethod === "CASH") {
      const adminCommission = booking.adminCommissionAmount || 0;
      // Required = admin commission + a small per-currency safety buffer
      // (mirrors backend). Never a flat "+ 50" reused across currencies.
      const bookingCurrency = booking.currency || activeCurrency;
      const requiredBalance =
        adminCommission + getCashAcceptanceBuffer(bookingCurrency);
      if (walletBalance < requiredBalance) {
        setSelectedBooking(booking);
        setShowWalletWarning(true);
        return;
      }
    }

    dispatch(acceptBooking(booking._id))
      .then(() => {
        dispatch(getPartnerBookings({ status: filterStatus }));
        fetchWalletBalance(); // Refresh wallet balance
      })
      .catch((error) => {
        console.log("[v0] Accept booking error:", error);
        // If error is wallet funding needed, wallet modal is shown
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
        dispatch(getPartnerBookings({ status: filterStatus }));
        setShowRejectModal(false);
        setSelectedBooking(null);
        setRejectionReason("");
      });
    }
  };

  const handleComplete = (bookingId) => {
    dispatch(completeB2CTrip(bookingId)).then(() => {
      dispatch(getPartnerBookings({ status: filterStatus }));
      fetchWalletBalance(); // Refresh wallet balance after completion
    });
  };

  const handleStartTrip = (bookingId) => {
    dispatch(startB2CTrip(bookingId)).then(() => {
      dispatch(getPartnerBookings({ status: filterStatus }));

      // Start location sharing if B2C_PARTNER is self-driving
      if (auth.user?.role === "B2C_PARTNER") {
        const booking = partnerBookings.find((b) => b._id === bookingId);
        if (booking && booking.isSelfDriver) {
          console.log(
            "🚀 B2C_PARTNER starting self-drive trip, starting location sharing",
          );
          startLocationSharing(booking);
        }
      }
    });
  };

  // Start location sharing for self-driving B2C_PARTNER
  const startLocationSharing = async (booking) => {
    if (!auth.user || !booking) return;

    try {
      const shareLocation = async () => {
        if (navigator.geolocation) {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });
          });

          const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            driverId: auth.user._id, // B2C_PARTNER uses _id as driverId
            driverType: auth.user.role,
            timestamp: new Date().toISOString(),
            bookingId: booking._id, // Include booking ID for room-based updates
          };

          console.log("📍 B2C_PARTNER Location updated:", locationData);

          // Send location to backend
          try {
            await api.post("/location/share", locationData);
          } catch (apiError) {
            console.error("Error sending location to API:", apiError.message);
          }

          // Send real-time location to passenger
          if (socket && booking) {
            socket.socket.emit("driver-location-update", {
              bookingId: booking._id,
              driverId: auth.user._id,
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              },
              timestamp: new Date().toISOString(),
              driverType: auth.user.role,
            });
          }
        }
      };

      // Start sharing location every 5 seconds
      shareLocation(); // Initial share
      const interval = setInterval(shareLocation, 5000);

      // Store interval ID for cleanup
      locationSharingRef.current = interval;

      console.log(
        "🚀 B2C_PARTNER location sharing started for booking:",
        booking._id,
      );
    } catch (error) {
      console.error("Error starting location sharing:", error);
    }
  };

  const handleViewPassenger = (bookingId) => {
    setSelectedPassengerBookingId(bookingId);
    setShowPassengerModal(true);
  };

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
      case "CONFIRMED":
        return "#007bff";
      case "ACCEPTED":
        return "#28a745";
      case "REJECTED":
        return "#dc3545";
      case "COMPLETED":
        return "#6c757d";
      case "CANCELLED":
        return "#ff6b6b";
      case "IN_PROGRESS":
        return "#ffc107";
      default:
        return "#6c757d";
    }
  };

  const getBookingTypeColor = (isSelfDriver) => {
    return isSelfDriver ? "#28a745" : "#007bff";
  };

  const getBookingTypeText = (isSelfDriver) => {
    return isSelfDriver ? "Self-Driving" : "Assigned Driver";
  };

  // Calculate hours remaining before auto-cancellation for CONFIRMED bookings
  const getHoursRemaining = (booking) => {
    if (booking.bookingStatus !== "CONFIRMED") return null;

    const createdAt = new Date(booking.createdAt);
    const cancellationTime = new Date(
      createdAt.getTime() + 24 * 60 * 60 * 1000,
    ); // 24 hours
    const now = new Date();
    const hoursRemaining = Math.max(
      0,
      (cancellationTime - now) / (1000 * 60 * 60),
    );

    return hoursRemaining;
  };

  // Get warning level based on hours remaining
  const getWarningLevel = (hoursRemaining) => {
    if (hoursRemaining === null) return null;
    if (hoursRemaining <= 4) return "critical"; // Red - 4 hours or less
    if (hoursRemaining <= 8) return "warning"; // Orange - 8 hours or less
    if (hoursRemaining <= 20) return "caution"; // Yellow - 20 hours or less
    return null;
  };

  if (loading) {
    console.log("[B2C_PartnerBookingsPage] Loading state, showing loader...");
    return (
      <div className="B2C_Partner-bookings-page-container">
        <div className="B2C_Partner-bookings-page-loading">
          Loading bookings...
        </div>
      </div>
    );
  }

  console.log("[B2C_PartnerBookingsPage] Rendering with partnerBookings:", {
    isArray: Array.isArray(partnerBookings),
    length: partnerBookings?.length || 0,
    firstBooking: partnerBookings?.[0],
  });

  return (
    <div className="B2C_Partner-bookings-page-container">
      <div className="B2C_Partner-bookings-page-header">
        <h2>Booking Management</h2>
        <div className="B2C_Partner-bookings-page-wallet-info">
          <span className="B2C_Partner-bookings-page-wallet-balance">
            Wallet Balance: {walletBalance}{" "}
            {partnerBookings?.[0]?.currency || activeCurrency}
          </span>
        </div>
        <div className="B2C_Partner-bookings-page-filter-controls">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="B2C_Partner-bookings-page-status-filter"
          >
            <option value="CONFIRMED">Confirmed</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
        </div>
      </div>

      <div className="B2C_Partner-bookings-page-stats">
        <div className="B2C_Partner-bookings-page-stat-card">
          <span className="B2C_Partner-bookings-page-stat-number">
            {Array.isArray(partnerBookings) ? partnerBookings.length : 0}
          </span>
          <span className="B2C_Partner-bookings-page-stat-label">
            Total Bookings
          </span>
        </div>
        <div className="B2C_Partner-bookings-page-stat-card">
          <span className="B2C_Partner-bookings-page-stat-number">
            {Array.isArray(partnerBookings)
              ? partnerBookings.filter((b) => b.bookingStatus === "CONFIRMED")
                  .length
              : 0}
          </span>
          <span className="B2C_Partner-bookings-page-stat-label">
            Confirmed
          </span>
        </div>
        <div className="B2C_Partner-bookings-page-stat-card">
          <span className="B2C_Partner-bookings-page-stat-number">
            {Array.isArray(partnerBookings)
              ? partnerBookings.filter((b) => b.bookingStatus === "ACCEPTED")
                  .length
              : 0}
          </span>
          <span className="B2C_Partner-bookings-page-stat-label">Accepted</span>
        </div>
        <div className="B2C_Partner-bookings-page-stat-card">
          <span className="B2C_Partner-bookings-page-stat-number">
            {Array.isArray(partnerBookings)
              ? partnerBookings.filter((b) => b.bookingStatus === "COMPLETED")
                  .length
              : 0}
          </span>
          <span className="B2C_Partner-bookings-page-stat-label">
            Completed
          </span>
        </div>
        <div className="B2C_Partner-bookings-page-stat-card">
          <span
            className="B2C_Partner-bookings-page-stat-number"
            style={{ color: "#ff6b6b" }}
          >
            {Array.isArray(partnerBookings)
              ? partnerBookings.filter((b) => b.bookingStatus === "CANCELLED")
                  .length
              : 0}
          </span>
          <span className="B2C_Partner-bookings-page-stat-label">
            Cancelled
          </span>
        </div>
      </div>

      <div className="B2C_Partner-bookings-page-list">
        {!Array.isArray(partnerBookings) || partnerBookings.length === 0 ? (
          <div className="B2C_Partner-bookings-page-no-bookings">
            <div className="B2C_Partner-bookings-page-no-bookings-icon">📋</div>
            <h3>No bookings found</h3>
            <p>No bookings found for the selected status</p>
          </div>
        ) : (
          Array.isArray(partnerBookings) &&
          partnerBookings.map((booking) => (
            <div
              key={booking._id}
              className="B2C_Partner-bookings-page-booking-card"
            >
              <div className="B2C_Partner-bookings-page-booking-header">
                <div className="B2C_Partner-bookings-page-booking-info">
                  <h4>Booking #{booking._id.slice(-8)}</h4>
                  <span
                    className="B2C_Partner-bookings-page-status-badge"
                    style={{
                      backgroundColor: getStatusColor(booking.bookingStatus),
                    }}
                  >
                    {booking.bookingStatus}
                  </span>
                  <span
                    className="B2C_Partner-bookings-page-booking-type-badge"
                    style={{
                      backgroundColor: getBookingTypeColor(
                        booking.isSelfDriver,
                      ),
                    }}
                  >
                    {getBookingTypeText(booking.isSelfDriver)}
                  </span>
                  {/* Timeout Warning Indicator for CONFIRMED bookings */}
                  {booking.bookingStatus === "CONFIRMED" &&
                    (() => {
                      const hoursRemaining = getHoursRemaining(booking);
                      const warningLevel = getWarningLevel(hoursRemaining);
                      if (warningLevel) {
                        const warningStyles = {
                          critical: {
                            bg: "#fee2e2",
                            color: "#dc2626",
                            border: "#fca5a5",
                          },
                          warning: {
                            bg: "#ffedd5",
                            color: "#ea580c",
                            border: "#fdba74",
                          },
                          caution: {
                            bg: "#fef9c3",
                            color: "#ca8a04",
                            border: "#fde047",
                          },
                        };
                        const style = warningStyles[warningLevel];
                        return (
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: "600",
                              backgroundColor: style.bg,
                              color: style.color,
                              border: `1px solid ${style.border}`,
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {hoursRemaining < 1
                              ? "< 1 hour left"
                              : `${Math.floor(hoursRemaining)}h left`}
                          </span>
                        );
                      }
                      return null;
                    })()}
                </div>
                <div className="B2C_Partner-bookings-page-booking-date">
                  {formatDate(booking.createdAt)}
                </div>
              </div>

              <div className="B2C_Partner-bookings-page-booking-details">
                <div className="B2C_Partner-bookings-page-route-info">
                  <div className="B2C_Partner-bookings-page-route-point">
                    <strong>From</strong> {booking.pickupLocation || "N/A"}
                  </div>
                  <div className="B2C_Partner-bookings-page-route-arrow">
                    &rarr;
                  </div>
                  <div className="B2C_Partner-bookings-page-route-point">
                    <strong>To</strong> {booking.dropoffLocation || "N/A"}
                  </div>
                </div>

                <div className="B2C_Partner-bookings-page-driver-info">
                  {/* Show separate outbound and return drivers for ROUND_TRIP bookings */}
                  {booking.bookingType === "ROUND_TRIP" ? (
                    <>
                      <div className="B2C_Partner-bookings-page-driver-section">
                        <p
                          style={{
                            marginBottom: "4px",
                            color: "#6b7280",
                            fontSize: "12px",
                          }}
                        >
                          <strong>
                            Outbound ({booking.outboundTripTime || "N/A"})
                          </strong>
                        </p>
                        <p>
                          <strong>Driver</strong>{" "}
                          {booking.outboundDriverName ||
                            (booking.outboundIsSelfDriver
                              ? "Self-Driving"
                              : booking.driverName || "Not Assigned")}
                        </p>
                      </div>
                      <div
                        className="B2C_Partner-bookings-page-driver-section"
                        style={{
                          marginTop: "8px",
                          paddingTop: "8px",
                          borderTop: "1px dashed #e5e7eb",
                        }}
                      >
                        <p
                          style={{
                            marginBottom: "4px",
                            color: "#6b7280",
                            fontSize: "12px",
                          }}
                        >
                          <strong>
                            Return ({booking.returnTripTime || "N/A"})
                          </strong>
                        </p>
                        <p>
                          <strong>Driver</strong>{" "}
                          {booking.returnDriverName ||
                            (booking.returnIsSelfDriver
                              ? "Self-Driving"
                              : "Not Assigned")}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>
                        <strong>Driver</strong>{" "}
                        {booking.outboundDriverName ||
                          (booking.isSelfDriver
                            ? "Self-Driving"
                            : booking.driverName || "Not Assigned")}
                      </p>
                      <p>
                        <strong>Phone</strong>{" "}
                        {booking.driverPhoneNumber || "N/A"}
                      </p>
                    </>
                  )}
                  <div className="B2C_Partner-bookings-page-passenger-row">
                    <p>
                      <strong>Passenger</strong>{" "}
                      {booking.passengerId?.fullName ||
                        booking.passengerId?.name ||
                        "Passenger"}
                    </p>
                    <button
                      className="B2C_Partner-bookings-page-view-passenger-btn"
                      onClick={() => handleViewPassenger(booking._id)}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                      </svg>
                      View Details
                    </button>
                  </div>
                </div>

                <div className="B2C_Partner-bookings-page-booking-info-details">
                  <p>
                    <strong>Seats</strong> {booking.numberOfSeats || 1}
                  </p>
                  <p>
                    <strong>Amount</strong>{" "}
                    {(booking.paymentAmount || 0).toLocaleString()}{" "}
                    {booking.currency || activeCurrency}
                  </p>
                  <p>
                    <strong>Payment</strong> {booking.paymentStatus || "N/A"} /{" "}
                    {booking.paymentMethod || "N/A"}
                  </p>
                  <p>
                    <strong>Type</strong>{" "}
                    {booking.isMonthlyPass ? "Monthly Pass" : "Single Trip"}
                  </p>
                </div>

                <div className="B2C_Partner-bookings-page-commission-info">
                  <p>
                    <strong>Admin Commission</strong>{" "}
                    {(booking.adminCommissionAmount || 0).toLocaleString()}{" "}
                    {booking.currency || activeCurrency}
                  </p>
                  <p>
                    <strong>Driver Earnings</strong>{" "}
                    {(booking.driverEarnings || 0).toLocaleString()}{" "}
                    {booking.currency || activeCurrency}
                  </p>
                  {/* Show commission refund info for CANCELLED bookings */}
                  {booking.bookingStatus === "CANCELLED" &&
                    booking.commissionRefunded && (
                      <p
                        style={{
                          color: "#28a745",
                          fontWeight: "600",
                          padding: "8px",
                          backgroundColor: "#d4edda",
                          borderRadius: "6px",
                          marginTop: "8px",
                        }}
                      >
                        <strong>Commission Refunded:</strong>{" "}
                        {(booking.commissionRefundAmount || 0).toLocaleString()}{" "}
                        {booking.currency || activeCurrency}
                      </p>
                    )}
                  {/* Show cancellation reason for CANCELLED bookings */}
                  {booking.bookingStatus === "CANCELLED" &&
                    booking.cancellationReason && (
                      <p
                        style={{
                          color: "#dc3545",
                          marginTop: "8px",
                          fontSize: "13px",
                        }}
                      >
                        <strong>Cancellation Reason:</strong>{" "}
                        {booking.cancellationReason}
                      </p>
                    )}
                </div>
              </div>

              <div className="B2C_Partner-bookings-page-booking-actions">
                {booking.bookingStatus === "CONFIRMED" && (
                  <>
                    <button
                      className="B2C_Partner-bookings-page-accept-btn"
                      onClick={() => handleAccept(booking)}
                    >
                      Accept Booking
                    </button>
                    <button
                      className="B2C_Partner-bookings-page-reject-btn"
                      onClick={() => handleRejectClick(booking)}
                    >
                      Reject
                    </button>
                  </>
                )}

                {booking.bookingStatus === "IN_PROGRESS" && (
                  <>
                    {/* Show Complete Trip button only if user can actually complete this trip */}
                    {(auth.user?.role === "B2C_PARTNER" &&
                      booking.isSelfDriver === true) ||
                    (auth.user?.role === "B2C_PARTNER_DRIVER" &&
                      booking.assignedDriverId === auth.user?._id) ? (
                      <button
                        className="B2C_Partner-bookings-page-complete-btn"
                        onClick={() => handleComplete(booking._id)}
                      >
                        Complete Trip
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              {/* Daily Trips for this Booking */}
              {(booking.bookingStatus === "ACCEPTED" ||
                booking.bookingStatus === "IN_PROGRESS") && (
                <DailyTripsInBooking
                  booking={booking}
                  userRole={auth.user?.role}
                  currentUserId={auth.user?._id}
                  currentDriverId={auth.user?.driverId}
                  onTripStatusChange={(status, tripId) => {
                    // Refresh bookings after trip status change
                    dispatch(getPartnerBookings({ status: filterStatus }));
                  }}
                  onTripStart={(tripId) => {
                    // Start location sharing when driver starts trip
                    if (
                      auth.user?.role === "B2C_PARTNER" &&
                      booking.isSelfDriver
                    ) {
                      startLocationSharing(booking);
                    }
                  }}
                  onTripComplete={(tripId) => {
                    // Stop location sharing when trip completes
                    if (locationSharingRef.current) {
                      clearInterval(locationSharingRef.current);
                      locationSharingRef.current = null;
                    }
                    fetchWalletBalance();
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Wallet Warning Modal */}
      {showWalletWarning && selectedBooking && (
        <div className="B2C_Partner-bookings-page-modal-overlay">
          <div className="B2C_Partner-bookings-page-wallet-warning-modal">
            <div className="B2C_Partner-bookings-page-modal-header">
              <h3>Insufficient Wallet Balance</h3>
              <button
                className="B2C_Partner-bookings-page-close-btn"
                onClick={() => setShowWalletWarning(false)}
              >
                ×
              </button>
            </div>
            <div className="B2C_Partner-bookings-page-modal-body">
              <p>
                You cannot accept this CASH booking because your wallet balance
                is insufficient.
              </p>
              <div className="B2C_Partner-bookings-page-balance-info">
                <p>
                  <strong>Required Amount:</strong>{" "}
                  {(selectedBooking?.adminCommissionAmount || 0) +
                    getCashAcceptanceBuffer(
                      selectedBooking?.currency || activeCurrency,
                    )}{" "}
                  {selectedBooking?.currency || activeCurrency}
                </p>
                <p>
                  <strong>Current Balance:</strong> {walletBalance}{" "}
                  {selectedBooking?.currency || activeCurrency}
                </p>
                <p>
                  <strong>Shortfall:</strong>{" "}
                  {Math.max(
                    0,
                    (selectedBooking?.adminCommissionAmount || 0) +
                      getCashAcceptanceBuffer(
                        selectedBooking?.currency || activeCurrency,
                      ) -
                      walletBalance,
                  )}{" "}
                  {selectedBooking?.currency || activeCurrency}
                </p>
              </div>
              <p>Please add funds to your wallet to accept this booking.</p>
            </div>
            <div className="B2C_Partner-bookings-page-modal-actions">
              <button
                className="B2C_Partner-bookings-page-cancel-btn"
                onClick={() => setShowWalletWarning(false)}
              >
                Close
              </button>
              <button
                className="B2C_Partner-bookings-page-add-funds-btn"
                onClick={() => {
                  setShowWalletWarning(false);
                  setShowRechargeModal(true);
                }}
              >
                Add Funds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedBooking && (
        <div className="B2C_Partner-bookings-page-modal-overlay">
          <div className="B2C_Partner-bookings-page-reject-modal">
            <div className="B2C_Partner-bookings-page-modal-header">
              <h3>Reject Booking</h3>
              <button
                className="B2C_Partner-bookings-page-close-btn"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedBooking(null);
                  setRejectionReason("");
                }}
              >
                ×
              </button>
            </div>
            <div className="B2C_Partner-bookings-page-modal-body">
              <p>Are you sure you want to reject this booking?</p>
              <div className="B2C_Partner-bookings-page-form-group">
                <label>Reason for rejection:</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                />
              </div>
            </div>
            <div className="B2C_Partner-bookings-page-modal-actions">
              <button
                className="B2C_Partner-bookings-page-cancel-btn"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedBooking(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </button>
              <button
                className="B2C_Partner-bookings-page-confirm-reject-btn"
                onClick={handleRejectSubmit}
                disabled={!rejectionReason.trim()}
              >
                Reject Booking
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Wallet Recharge Modal */}
      <WalletRechargeModal
        isOpen={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        onRechargeSuccess={() => {
          setShowRechargeModal(false);
          fetchWalletBalance(); // Refresh wallet balance after successful recharge
          // Auto-retry booking acceptance after wallet is funded
          if (selectedBooking) {
            console.log(
              "[v0] Wallet funded, retrying booking acceptance for:",
              selectedBooking._id,
            );
            setTimeout(() => {
              dispatch(acceptBooking(selectedBooking._id))
                .then(() => {
                  dispatch(getPartnerBookings({ status: filterStatus }));
                  fetchWalletBalance();
                  notify("Booking accepted successfully!");
                })
                .catch((error) => {
                  console.error("[v0] Retry accept booking failed:", error);
                  notify("Failed to accept booking. Please try again.");
                });
            }, 1000);
          }
        }}
        country={auth.user?.country || "UAE"}
        currency={getCountryConfig(auth.user?.country).currency}
      />

      {/* Booking Warning Modal */}
      {showWarningModal && warningData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "520px",
              width: "90%",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            {/* Warning Icon */}
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                backgroundColor: "#fef3c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d97706"
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h2
              style={{
                fontSize: "24px",
                fontWeight: "700",
                color: "#1f2937",
                marginBottom: "12px",
              }}
            >
              Booking Acceptance Warning
            </h2>

            <p
              style={{
                fontSize: "16px",
                color: "#6b7280",
                marginBottom: "16px",
                lineHeight: "1.6",
              }}
            >
              You have a pending booking that requires your attention. If you do
              not accept it within{" "}
              <strong style={{ color: "#d97706" }}>
                {warningData?.hoursRemaining || 4} hours
              </strong>
              , it will be automatically cancelled.
            </p>

            {warningData?.pickupLocation && warningData?.dropoffLocation && (
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  padding: "16px",
                  borderRadius: "12px",
                  marginBottom: "16px",
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    fontSize: "14px",
                    color: "#374151",
                    margin: "0 0 8px 0",
                  }}
                >
                  <strong>Route:</strong> {warningData.pickupLocation} →{" "}
                  {warningData.dropoffLocation}
                </p>
                {warningData?.paymentAmount && (
                  <p style={{ fontSize: "14px", color: "#374151", margin: 0 }}>
                    <strong>Amount:</strong> {warningData.paymentAmount}{" "}
                    {warningData.currency || activeCurrency}
                  </p>
                )}
              </div>
            )}

            <div
              style={{
                backgroundColor: "#fef2f2",
                padding: "14px",
                borderRadius: "10px",
                marginBottom: "24px",
              }}
            >
              <p style={{ fontSize: "14px", color: "#dc2626", margin: 0 }}>
                <strong>Action Required:</strong> Please accept or reject the
                booking before the deadline to avoid automatic cancellation.
              </p>
            </div>

            <div
              style={{ display: "flex", gap: "12px", justifyContent: "center" }}
            >
              <button
                onClick={() => setShowWarningModal(false)}
                style={{
                  padding: "12px 24px",
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  backgroundColor: "white",
                  color: "#374151",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "500",
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  setFilterStatus("CONFIRMED");
                }}
                style={{
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: "10px",
                  background:
                    "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600",
                }}
              >
                View Pending Bookings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passenger Details Modal */}
      <PassengerDetailsModal
        bookingId={selectedPassengerBookingId}
        isOpen={showPassengerModal}
        onClose={() => {
          setShowPassengerModal(false);
          setSelectedPassengerBookingId(null);
        }}
      />
    </div>
  );
};

export default B2C_PartnerBookingsPage;
