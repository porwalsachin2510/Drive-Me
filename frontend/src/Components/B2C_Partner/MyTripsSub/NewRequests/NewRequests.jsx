"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getPartnerBookings,
  acceptBooking,
  rejectBooking,
} from "../../../../Redux/slices/bookingSlice";
import PassengerDetailsModal from "../../PassengerDetailsModal/PassengerDetailsModal";
import "./newrequests.css";

function NewRequests() {
  const dispatch = useDispatch();
  const { partnerBookings, loading } = useSelector((state) => state.booking);
  const auth = useSelector((state) => state.auth);
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (auth.user?.role === "B2C_PARTNER") {
      dispatch(getPartnerBookings({ status: "CONFIRMED" }));
    }
  }, [dispatch, auth.user]);

  const handleAccept = (booking) => {
    dispatch(acceptBooking(booking._id)).then(() => {
      dispatch(getPartnerBookings({ status: "CONFIRMED" }));
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
        dispatch(getPartnerBookings({ status: "CONFIRMED" }));
        setShowRejectModal(false);
        setSelectedBooking(null);
        setRejectionReason("");
      });
    }
  };

  const handleViewPassenger = (bookingId) => {
    setSelectedBookingId(bookingId);
    setShowPassengerModal(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter only CONFIRMED bookings
  const confirmedBookings = Array.isArray(partnerBookings)
    ? partnerBookings.filter((b) => b.bookingStatus === "CONFIRMED")
    : [];

  if (loading) {
    return (
      <div className="new-requests">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading new requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="new-requests">
      {confirmedBookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3>No New Requests</h3>
          <p>You have no pending booking requests at the moment.</p>
        </div>
      ) : (
        <div className="trips-grid">
          {confirmedBookings.map((booking) => (
            <div key={booking._id} className="trip-card new-request-card">
              <div className="trip-card-header">
                <span className="trip-status-badge confirmed">New Request</span>
                <div className="trip-meta">
                  <span className="trip-id">#{booking._id.slice(-8)}</span>
                  <div className="trip-time">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle
                        cx="6"
                        cy="6"
                        r="5"
                        stroke="currentColor"
                        strokeWidth="1"
                      />
                      <path
                        d="M6 3V6L8 7"
                        stroke="currentColor"
                        strokeWidth="0.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    {formatDate(booking.bookingDate)} -{" "}
                    {formatTime(booking.bookingDate)}
                  </div>
                </div>
              </div>

              <div className="trip-fare">
                <span className="fare-amount">
                  {booking.paymentAmount?.toLocaleString() || 0}{" "}
                  {booking.currency || "AED"}
                </span>
                <span className="booking-type-badge">
                  {booking.isMonthlyPass
                    ? "Monthly Pass"
                    : booking.bookingType?.replace("_", " ") || "Trip"}
                </span>
              </div>

              <div className="trip-locations">
                <div className="location-item">
                  <div className="location-dot pickup"></div>
                  <div>
                    <p className="location-label">PICKUP</p>
                    <p className="location-name">
                      {booking.pickupLocation || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="location-item">
                  <div className="location-dot dropoff"></div>
                  <div>
                    <p className="location-label">DROPOFF</p>
                    <p className="location-name">
                      {booking.dropoffLocation || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="trip-info-row">
                <div className="info-item">
                  <span className="info-label">Seats</span>
                  <span className="info-value">
                    {booking.numberOfSeats || 1}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Payment</span>
                  <span
                    className={`info-value payment-status ${booking.paymentStatus?.toLowerCase()}`}
                  >
                    {booking.paymentStatus || "N/A"}
                  </span>
                </div>
              </div>

              <div className="passenger-section">
                <div className="passenger-info">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                  </svg>
                  <span className="passenger-name">
                    {booking.passengerId?.fullName || "Passenger"}
                  </span>
                </div>
                <button
                  className="view-passenger-btn"
                  onClick={() => handleViewPassenger(booking._id)}
                >
                  View Details
                </button>
              </div>

              <div className="trip-actions">
                <button
                  className="trip-action-btn primary"
                  onClick={() => handleAccept(booking)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Accept
                </button>
                <button
                  className="trip-action-btn secondary"
                  onClick={() => handleRejectClick(booking)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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

      {/* Passenger Details Modal */}
      <PassengerDetailsModal
        bookingId={selectedBookingId}
        isOpen={showPassengerModal}
        onClose={() => {
          setShowPassengerModal(false);
          setSelectedBookingId(null);
        }}
      />
    </div>
  );
}

export default NewRequests;
