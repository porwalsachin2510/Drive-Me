"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import commuterBookingAPI from "../../../services/commuterBookingAPI";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import "./commuterBookingDetailsPage.css";

const CommuterBookingDetailsPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const auth = useSelector((state) => state.auth);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await commuterBookingAPI.getBookingDetails(bookingId);
        if (response.success && response.data?.booking) {
          setBooking(response.data.booking);
        } else {
          setError("Booking not found");
        }
      } catch (err) {
        console.error("Error fetching booking details:", err);
        setError(
          err.response?.data?.message || "Failed to load booking details",
        );
      } finally {
        setLoading(false);
      }
    };

    if (bookingId && auth.user) {
      fetchBookingDetails();
    }
  }, [bookingId, auth.user]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { color: "#d69e2e", bg: "#fefcbf", label: "Pending" },
      CONFIRMED: { color: "#38a169", bg: "#c6f6d5", label: "Confirmed" },
      ACCEPTED: { color: "#38a169", bg: "#c6f6d5", label: "Accepted" },
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

  const formatCurrency = (amount, currency = "KWD") => {
    return `${currency} ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const handleBackClick = () => {
    navigate("/commuter-profile?tab=my-rides");
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
                <span className="cbdp-detail-label">Travel Time</span>
                <span className="cbdp-detail-value">
                  {booking.travelTime ||
                    formatTime(booking.travelDate) ||
                    "N/A"}
                </span>
              </div>
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
              Driver Information
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
              Vehicle Information
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
                      booking.b2cPartnerId?.businessName ||
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
          {booking.bookingStatus === "CONFIRMED" && (
            <button className="cbdp-btn-track">
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
              Track Driver
            </button>
          )}
          {(booking.bookingStatus === "PENDING" ||
            booking.bookingStatus === "CONFIRMED") && (
            <button className="cbdp-btn-cancel">Cancel Booking</button>
          )}
          <button className="cbdp-btn-secondary" onClick={handleBackClick}>
            Back to All Bookings
          </button>
        </div>

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
