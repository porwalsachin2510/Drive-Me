import { useState, useEffect } from "react";
import { getPassengerDetails } from "../../../services/b2cPartnerService";
import "./passengerdetailsmodal.css";

function PassengerDetailsModal({ bookingId, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passengerData, setPassengerData] = useState(null);
  const [bookingData, setBookingData] = useState(null);

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchPassengerDetails();
    }
  }, [isOpen, bookingId]);

  const fetchPassengerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getPassengerDetails(bookingId);
      if (response.success) {
        setPassengerData(response.data.passenger);
        setBookingData(response.data.booking);
      } else {
        setError(response.message || "Failed to fetch passenger details");
      }
    } catch (err) {
      setError(err.message || "Error fetching passenger details");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="drivemego-passengerdetailsmodal-overlay" onClick={onClose}>
      <div
        className="drivemego-passengerdetailsmodal-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drivemego-passengerdetailsmodal-header">
          <h3>Passenger Details</h3>
          <button
            className="drivemego-passengerdetailsmodal-close-btn"
            onClick={onClose}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="drivemego-passengerdetailsmodal-content">
          {loading ? (
            <div className="drivemego-passengerdetailsmodal-loading-state">
              <div className="drivemego-passengerdetailsmodal-spinner"></div>
              <p>Loading passenger details...</p>
            </div>
          ) : error ? (
            <div className="drivemego-passengerdetailsmodal-error-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="#ef4444"
                  strokeWidth="2"
                />
                <path
                  d="M12 8v4M12 16h.01"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <p>{error}</p>
              <button
                className="drivemego-passengerdetailsmodal-retry-btn"
                onClick={fetchPassengerDetails}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Passenger Profile Section */}
              <div className="drivemego-passengerdetailsmodal-profile">
                <div className="drivemego-passengerdetailsmodal-profile-image-container">
                  {passengerData?.profileImage ? (
                    <img
                      src={passengerData.profileImage}
                      alt={passengerData.fullName}
                      className="drivemego-passengerdetailsmodal-profile-image"
                    />
                  ) : (
                    <div className="drivemego-passengerdetailsmodal-profile-placeholder">
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="8"
                          r="4"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M4 20c0-4 4-6 8-6s8 2 8 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="drivemego-passengerdetailsmodal-profile-info">
                  <h4 className="drivemego-passengerdetailsmodal-passenger-name">
                    {passengerData?.fullName || "N/A"}
                  </h4>
                  <span
                    className={`drivemego-passengerdetailsmodal-status-badge ${passengerData?.status?.toLowerCase()}`}
                  >
                    {passengerData?.status || "N/A"}
                  </span>
                </div>
              </div>

              {/* Contact Information */}
              <div className="drivemego-passengerdetailsmodal-info-section">
                <h5 className="drivemego-passengerdetailsmodal-section-title">
                  Contact Information
                </h5>
                <div className="drivemego-passengerdetailsmodal-info-grid">
                  <div className="drivemego-passengerdetailsmodal-info-item">
                    <div className="drivemego-passengerdetailsmodal-info-icon">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-info-content">
                      <span className="drivemego-passengerdetailsmodal-info-label">
                        Email
                      </span>
                      <span className="drivemego-passengerdetailsmodal-info-value">
                        {passengerData?.email || "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="drivemego-passengerdetailsmodal-info-item">
                    <div className="drivemego-passengerdetailsmodal-info-icon">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-info-content">
                      <span className="drivemego-passengerdetailsmodal-info-label">
                        Phone
                      </span>
                      <span className="drivemego-passengerdetailsmodal-info-value">
                        {passengerData?.countryCode}{" "}
                        {passengerData?.phone || "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="drivemego-passengerdetailsmodal-info-item">
                    <div className="drivemego-passengerdetailsmodal-info-icon">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="10"
                          r="3"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-info-content">
                      <span className="drivemego-passengerdetailsmodal-info-label">
                        Country
                      </span>
                      <span className="drivemego-passengerdetailsmodal-info-value">
                        {passengerData?.country || "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="drivemego-passengerdetailsmodal-info-item">
                    <div className="drivemego-passengerdetailsmodal-info-icon">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M16 2v4M8 2v4M3 10h18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-info-content">
                      <span className="drivemego-passengerdetailsmodal-info-label">
                        Member Since
                      </span>
                      <span className="drivemego-passengerdetailsmodal-info-value">
                        {formatDate(passengerData?.memberSince)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Booking Information */}
              <div className="drivemego-passengerdetailsmodal-info-section">
                <h5 className="drivemego-passengerdetailsmodal-section-title">
                  Booking Details
                </h5>
                <div className="drivemego-passengerdetailsmodal-booking-summary">
                  <div className="drivemego-passengerdetailsmodal-booking-route">
                    <div className="drivemego-passengerdetailsmodal-route-point">
                      <div className="drivemego-passengerdetailsmodal-dot pickup"></div>
                      <div>
                        <span className="drivemego-passengerdetailsmodal-route-label">
                          Pickup
                        </span>
                        <p className="drivemego-passengerdetailsmodal-route-location">
                          {bookingData?.pickupLocation || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-route-line"></div>
                    <div className="drivemego-passengerdetailsmodal-route-point">
                      <div className="drivemego-passengerdetailsmodal-dot dropoff"></div>
                      <div>
                        <span className="drivemego-passengerdetailsmodal-route-label">
                          Dropoff
                        </span>
                        <p className="drivemego-passengerdetailsmodal-route-location">
                          {bookingData?.dropoffLocation || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="drivemego-passengerdetailsmodal-booking-details-grid">
                    <div className="drivemego-passengerdetailsmodal-booking-detail">
                      <span className="drivemego-passengerdetailsmodal-detail-label">
                        Booking Type
                      </span>
                      <span className="drivemego-passengerdetailsmodal-detail-value">
                        {bookingData?.isMonthlyPass
                          ? "Monthly Pass"
                          : bookingData?.bookingType?.replace("_", " ") ||
                            "N/A"}
                      </span>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-booking-detail">
                      <span className="drivemego-passengerdetailsmodal-detail-label">
                        Seats
                      </span>
                      <span className="drivemego-passengerdetailsmodal-detail-value">
                        {bookingData?.numberOfSeats || 1}
                      </span>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-booking-detail">
                      <span className="drivemego-passengerdetailsmodal-detail-label">
                        Amount
                      </span>
                      <span className="drivemego-passengerdetailsmodal-detail-value highlight">
                        {bookingData?.paymentAmount?.toLocaleString() || 0}{" "}
                        {bookingData?.currency || "AED"}
                      </span>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-booking-detail">
                      <span className="drivemego-passengerdetailsmodal-detail-label">
                        Payment Status
                      </span>
                      <span
                        className={`drivemego-passengerdetailsmodal-detail-value status ${bookingData?.paymentStatus?.toLowerCase()}`}
                      >
                        {bookingData?.paymentStatus || "N/A"}
                      </span>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-booking-detail">
                      <span className="drivemego-passengerdetailsmodal-detail-label">
                        Booking Status
                      </span>
                      <span
                        className={`drivemego-passengerdetailsmodal-detail-value status ${bookingData?.bookingStatus?.toLowerCase()}`}
                      >
                        {bookingData?.bookingStatus || "N/A"}
                      </span>
                    </div>
                    <div className="drivemego-passengerdetailsmodal-booking-detail">
                      <span className="drivemego-passengerdetailsmodal-detail-label">
                        Booking Date
                      </span>
                      <span className="drivemego-passengerdetailsmodal-detail-value">
                        {formatDateTime(bookingData?.bookingDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PassengerDetailsModal;
