/* eslint-disable no-unused-vars */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../../../hooks/useSocket";
import { getPartnerBookings, acceptBooking, rejectBooking, startB2CTrip, completeB2CTrip } from "../../../Redux/slices/bookingSlice";
import DailyTripsInBooking from "../../../Components/DailyTripsInBooking/DailyTripsInBooking";
import api from "../../../utils/api";
import WalletRechargeModal from "../../../Components/WalletRechargeModal/WalletRechargeModal";
import "./b2c_partnerbookingspage.css";

const B2C_PartnerBookingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const socket = useSocket();
  const { partnerBookings, loading } = useSelector((state) => state.booking);
  const auth = useSelector((state) => state.auth);
  const [filterStatus, setFilterStatus] = useState("CONFIRMED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showWalletWarning, setShowWalletWarning] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const locationSharingRef = useRef(null);

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

  const handleAccept = (booking) => {
    // Check wallet balance for cash bookings
    if (booking.paymentMethod === "CASH") {
      const adminCommission = booking.adminCommissionAmount || 0;
      if (walletBalance < adminCommission) {
        setSelectedBooking(booking);
        setShowWalletWarning(true);
        return;
      }
    }
    
    dispatch(acceptBooking(booking._id)).then(() => {
      dispatch(getPartnerBookings({ status: filterStatus }));
      fetchWalletBalance(); // Refresh wallet balance
      }).catch((error) => {
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
        })
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
        const booking = partnerBookings.find(b => b._id === bookingId);
        if (booking && booking.isSelfDriver) {
          console.log("🚀 B2C_PARTNER starting self-drive trip, starting location sharing");
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
      
      console.log("🚀 B2C_PARTNER location sharing started for booking:", booking._id);
    } catch (error) {
      console.error("Error starting location sharing:", error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
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

  if (loading) {
    console.log("[B2C_PartnerBookingsPage] Loading state, showing loader...");
    return (
      <div className="B2C_Partner-bookings-page-container">
        <div className="B2C_Partner-bookings-page-loading">Loading bookings...</div>
      </div>
    );
  }

  console.log("[B2C_PartnerBookingsPage] Rendering with partnerBookings:", {
    isArray: Array.isArray(partnerBookings),
    length: partnerBookings?.length || 0,
    firstBooking: partnerBookings?.[0]
  });

  return (
    <div className="B2C_Partner-bookings-page-container">
      <div className="B2C_Partner-bookings-page-header">
        <h2>Booking Management</h2>
        <div className="B2C_Partner-bookings-page-wallet-info">
          <span className="B2C_Partner-bookings-page-wallet-balance">
            Wallet Balance: {walletBalance}{" "}
            {Array.isArray(partnerBookings) && partnerBookings.length > 0
              ? partnerBookings[0]?.currency || "AED"
              : "AED"}
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
                  <p>
                    <strong>Driver</strong>{" "}
                    {booking.driverName || "Not Assigned"}
                  </p>
                  <p>
                    <strong>Phone</strong> {booking.driverPhoneNumber || "N/A"}
                  </p>
                  <p>
                    <strong>Passenger</strong>{" "}
                    {booking.passengerId?.name || "Passenger"}
                  </p>
                </div>

                <div className="B2C_Partner-bookings-page-booking-info-details">
                  <p>
                    <strong>Seats</strong> {booking.numberOfSeats || 1}
                  </p>
                  <p>
                    <strong>Amount</strong>{" "}
                    {(booking.paymentAmount || 0).toLocaleString()}{" "}
                    {booking.currency || "KWD"}
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
                    {booking.currency || "KWD"}
                  </p>
                  <p>
                    <strong>Driver Earnings</strong>{" "}
                    {(booking.driverEarnings || 0).toLocaleString()}{" "}
                    {booking.currency || "KWD"}
                  </p>
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
                  {selectedBooking?.adminCommissionAmount || 0}{" "}
                  {selectedBooking?.currency || "KWD"}
                </p>
                <p>
                  <strong>Current Balance:</strong> {walletBalance}{" "}
                  {selectedBooking?.currency || "KWD"}
                </p>
                <p>
                  <strong>Shortfall:</strong>{" "}
                  {Math.max(
                    0,
                    (selectedBooking?.adminCommissionAmount || 0) -
                      walletBalance,
                  )}{" "}
                  {selectedBooking?.currency || "KWD"}
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
                  alert("Booking accepted successfully!");
                })
                .catch((error) => {
                  console.error("[v0] Retry accept booking failed:", error);
                  alert("Failed to accept booking. Please try again.");
                });
            }, 1000);
          }
        }}
        country={auth.user?.country || "UAE"}
        currency={auth.user?.country === "UAE" ? "AED" : "KWD"}
      />
    </div>
  );
};

export default B2C_PartnerBookingsPage;
