"use client";

import { useState } from "react";
import "./AdminReassignModal.css";

const AdminReassignModal = ({
  booking,
  availableRoutes = [],
  onClose,
  onProcess,
  processingId,
}) => {
  const [activeTab, setActiveTab] = useState("details");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [reason, setReason] = useState("");

  const formatCurrency = (amount, currency = "AED") => {
    const decimals = ["KWD", "BHD", "OMR"].includes(currency) ? 3 : 2;
    return `${currency} ${(amount || 0).toFixed(decimals)}`;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    const statusLower = (status || "").toLowerCase();
    switch (statusLower) {
      case "accepted":
      case "approved":
      case "confirmed":
        return "#28a745";
      case "rejected":
      case "cancelled":
        return "#dc3545";
      case "pending":
        return "#ffc107";
      case "in_progress":
      case "processing":
        return "#17a2b8";
      case "completed":
        return "#6f42c1";
      default:
        return "#6c757d";
    }
  };

  const handleApprove = () => {
    onProcess(booking._id, "approve", reason);
  };

  const handleReject = () => {
    if (!reason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    onProcess(booking._id, "reject", reason);
  };

  const handleReassign = () => {
    if (!selectedRoute) {
      alert("Please select a new route");
      return;
    }
    onProcess(booking._id, "reassign", reason, { newRouteId: selectedRoute });
  };

  const handleCancel = () => {
    if (!reason.trim()) {
      alert("Please provide a reason for cancellation");
      return;
    }
    onProcess(booking._id, "cancel", reason);
  };

  const isProcessing = processingId === booking._id;
  const isPending = (booking.status || "").toLowerCase() === "pending";

  return (
    <div className="drivemego-ad-dash-reassign-modal-overlay" onClick={onClose}>
      <div
        className="drivemego-ad-dash-reassign-modal drivemego-ad-dash-reassign-modal-large"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drivemego-ad-dash-reassign-modal-header">
          <h3>Booking Details</h3>
          <span
            className="drivemego-booking-status-badge"
            style={{ backgroundColor: getStatusColor(booking.status) }}
          >
            {booking.status}
          </span>
          <button
            className="drivemego-ad-dash-reassign-modal-close"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="drivemego-ad-dash-reassign-modal-tabs">
          <button
            className={`drivemego-modal-tab ${activeTab === "details" ? "drivemego-active" : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Booking Details
          </button>
          <button
            className={`drivemego-modal-tab ${activeTab === "passenger" ? "drivemego-active" : ""}`}
            onClick={() => setActiveTab("passenger")}
          >
            Passenger Info
          </button>
          <button
            className={`drivemego-modal-tab ${activeTab === "provider" ? "drivemego-active" : ""}`}
            onClick={() => setActiveTab("provider")}
          >
            Provider & Vehicle
          </button>
          {isPending && (
            <button
              className={`drivemego-modal-tab ${activeTab === "actions" ? "drivemego-active" : ""}`}
              onClick={() => setActiveTab("actions")}
            >
              Actions
            </button>
          )}
        </div>

        <div className="drivemego-ad-dash-reassign-modal-body">
          {/* Details Tab */}
          {activeTab === "details" && (
            <div className="drivemego-modal-tab-content">
              <div className="drivemego-booking-details-grid">
                <div className="drivemego-detail-section">
                  <h4>Route Information</h4>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">From:</span>
                    <span className="drivemego-detail-value">
                      {booking.startPoint || booking.pickupLocation || "N/A"}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">To:</span>
                    <span className="drivemego-detail-value">
                      {booking.endPoint || booking.dropoffLocation || "N/A"}
                    </span>
                  </div>
                  {booking.bookingType === "ROUND_TRIP" && (
                    <>
                      <div className="drivemego-detail-row">
                        <span className="drivemego-detail-label">
                          Return From:
                        </span>
                        <span className="drivemego-detail-value">
                          {booking.returnPickupLocation || "N/A"}
                        </span>
                      </div>
                      <div className="drivemego-detail-row">
                        <span className="drivemego-detail-label">
                          Return To:
                        </span>
                        <span className="drivemego-detail-value">
                          {booking.returnDropoffLocation || "N/A"}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">
                      Booking Type:
                    </span>
                    <span className="drivemego-detail-value">
                      {booking.bookingType || "ONE_WAY"}
                    </span>
                  </div>
                  {booking.isMonthlyPass && (
                    <>
                      <div className="drivemego-detail-row drivemego-highlight">
                        <span className="drivemego-detail-label">
                          Monthly Pass:
                        </span>
                        <span className="drivemego-detail-value">
                          Yes ({booking.passDuration || 1} month)
                        </span>
                      </div>
                      <div className="drivemego-detail-row">
                        <span className="drivemego-detail-label">
                          Pass Start:
                        </span>
                        <span className="drivemego-detail-value">
                          {formatDate(booking.passStartDate)}
                        </span>
                      </div>
                      <div className="drivemego-detail-row">
                        <span className="drivemego-detail-label">
                          Pass End:
                        </span>
                        <span className="drivemego-detail-value">
                          {formatDate(booking.passEndDate)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="drivemego-detail-section">
                  <h4>Payment Information</h4>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">Amount:</span>
                    <span className="drivemego-detail-value drivemego-amount">
                      {formatCurrency(booking.amount, booking.currency)}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">
                      Payment Method:
                    </span>
                    <span className="drivemego-detail-value">
                      {booking.paymentMethod || "CASH"}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">
                      Payment Status:
                    </span>
                    <span
                      className={`drivemego-detail-value drivemego-status ${(booking.paymentStatus || "").toLowerCase()}`}
                    >
                      {booking.paymentStatus || "PENDING"}
                    </span>
                  </div>
                  {booking.transactionId && (
                    <div className="drivemego-detail-row">
                      <span className="drivemego-detail-label">
                        Transaction ID:
                      </span>
                      <span className="drivemego-detail-value drivemego-mono">
                        {booking.transactionId}
                      </span>
                    </div>
                  )}
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">
                      Admin Commission:
                    </span>
                    <span className="drivemego-detail-value">
                      {formatCurrency(
                        booking.adminCommissionAmount,
                        booking.currency,
                      )}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">
                      Driver Earnings:
                    </span>
                    <span className="drivemego-detail-value">
                      {formatCurrency(booking.driverEarnings, booking.currency)}
                    </span>
                  </div>
                </div>

                <div className="drivemego-detail-section">
                  <h4>Booking Details</h4>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">Booking ID:</span>
                    <span className="drivemego-detail-value drivemego-mono">
                      {booking._id}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">Seats:</span>
                    <span className="drivemego-detail-value">
                      {booking.seats || 1}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">
                      Booking Date:
                    </span>
                    <span className="drivemego-detail-value">
                      {formatDate(booking.bookingDate)}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">Travel Date:</span>
                    <span className="drivemego-detail-value">
                      {formatDate(booking.travelDate)}
                    </span>
                  </div>
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">Created:</span>
                    <span className="drivemego-detail-value">
                      {formatDate(booking.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Passenger Tab */}
          {activeTab === "passenger" && (
            <div className="drivemego-modal-tab-content">
              <div className="drivemego-passenger-profile">
                {booking.passengerImage && (
                  <img
                    src={booking.passengerImage}
                    alt={booking.passengerName}
                    className="drivemego-passenger-profile-image"
                  />
                )}
                <div className="drivemego-passenger-profile-info">
                  <h4>{booking.passengerName}</h4>
                  <p className="drivemego-passenger-email">
                    {booking.passengerEmail}
                  </p>
                  {booking.passengerPhone && (
                    <p className="drivemego-passenger-phone">
                      {booking.passengerPhone}
                    </p>
                  )}
                </div>
              </div>
              <div className="drivemego-detail-section">
                <h4>Passenger Details</h4>
                <div className="drivemego-detail-row">
                  <span className="drivemego-detail-label">Passenger ID:</span>
                  <span className="drivemego-detail-value drivemego-mono">
                    {booking.passengerId}
                  </span>
                </div>
                <div className="drivemego-detail-row">
                  <span className="drivemego-detail-label">Name:</span>
                  <span className="drivemego-detail-value">
                    {booking.passengerName}
                  </span>
                </div>
                <div className="drivemego-detail-row">
                  <span className="drivemego-detail-label">Email:</span>
                  <span className="drivemego-detail-value">
                    {booking.passengerEmail}
                  </span>
                </div>
                <div className="drivemego-detail-row">
                  <span className="drivemego-detail-label">Phone:</span>
                  <span className="drivemego-detail-value">
                    {booking.passengerPhone || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Provider Tab */}
          {activeTab === "provider" && (
            <div className="drivemego-modal-tab-content">
              <div className="drivemego-detail-section">
                <h4>Provider Information</h4>
                <div className="drivemego-provider-profile">
                  {booking.providerImage && (
                    <img
                      src={booking.providerImage}
                      alt={booking.providerName}
                      className="drivemego-provider-profile-image"
                    />
                  )}
                  <div className="drivemego-provider-profile-info">
                    <h4>{booking.providerName}</h4>
                    {booking.providerPhone && (
                      <p className="drivemego-provider-phone">
                        {booking.providerPhone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="drivemego-detail-row">
                  <span className="drivemego-detail-label">Provider ID:</span>
                  <span className="drivemego-detail-value drivemego-mono">
                    {booking.providerId}
                  </span>
                </div>
              </div>

              <div className="drivemego-detail-section">
                <h4>Vehicle Information</h4>
                {booking.vehicleInfo ? (
                  <>
                    <div className="drivemego-detail-row">
                      <span className="drivemego-detail-label">Model:</span>
                      <span className="drivemego-detail-value">
                        {booking.vehicleInfo.model}
                      </span>
                    </div>
                    <div className="drivemego-detail-row">
                      <span className="drivemego-detail-label">Type:</span>
                      <span className="drivemego-detail-value">
                        {booking.vehicleInfo.vehicleType}
                      </span>
                    </div>
                    <div className="drivemego-detail-row">
                      <span className="drivemego-detail-label">Color:</span>
                      <span className="drivemego-detail-value">
                        {booking.vehicleInfo.vehicleColor}
                      </span>
                    </div>
                    <div className="drivemego-detail-row">
                      <span className="drivemego-detail-label">
                        License Plate:
                      </span>
                      <span className="drivemego-detail-value mono">
                        {booking.vehicleInfo.licensePlate}
                      </span>
                    </div>
                    <div className="drivemego-detail-row">
                      <span className="drivemego-detail-label">
                        Seating Capacity:
                      </span>
                      <span className="drivemego-detail-value">
                        {booking.vehicleInfo.seatingCapacity} seats
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="no-data">No vehicle information available</p>
                )}
              </div>

              <div className="drivemego-detail-section">
                <h4>Driver Information</h4>
                {booking.driverInfo ? (
                  <>
                    {booking.driverInfo.driverImage && (
                      <img
                        src={booking.driverInfo.driverImage}
                        alt={booking.driverInfo.name}
                        className="drivemego-driver-profile-image"
                      />
                    )}
                    <div className="drivemego-detail-row">
                      <span className="drivemego-detail-label">Name:</span>
                      <span className="drivemego-detail-value">
                        {booking.driverInfo.name}
                        {booking.driverInfo.isSelf && (
                          <span className="drivemego-self-badge">Self</span>
                        )}
                      </span>
                    </div>
                    {booking.driverInfo.phoneNumber && (
                      <div className="drivemego-detail-row">
                        <span className="drivemego-detail-label">Phone:</span>
                        <span className="drivemego-detail-value">
                          {booking.driverInfo.phoneNumber}
                        </span>
                      </div>
                    )}
                  </>
                ) : booking.isSelfDriver ? (
                  <div className="drivemego-detail-row">
                    <span className="drivemego-detail-label">Driver:</span>
                    <span className="drivemego-detail-value">
                      {booking.driverName || "Self"}{" "}
                      <span className="drivemego-self-badge">Self-Driving</span>
                    </span>
                  </div>
                ) : (
                  <p className="drivemego-no-data">No driver assigned</p>
                )}
              </div>
            </div>
          )}

          {/* Actions Tab */}
          {activeTab === "actions" && isPending && (
            <div className="drivemego-modal-tab-content">
              <div className="drivemego-action-section">
                <h4>Quick Actions</h4>
                <div className="drivemego-quick-actions">
                  <button
                    className="drivemego-action-btn drivemego-approve"
                    onClick={handleApprove}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Processing..." : "Approve Booking"}
                  </button>
                  <button
                    className="drivemego-action-btn drivemego-reject"
                    onClick={handleReject}
                    disabled={isProcessing || !reason.trim()}
                  >
                    {isProcessing ? "Processing..." : "Reject Booking"}
                  </button>
                  <button
                    className="drivemego-action-btn drivemego-cancel"
                    onClick={handleCancel}
                    disabled={isProcessing || !reason.trim()}
                  >
                    {isProcessing ? "Processing..." : "Cancel Booking"}
                  </button>
                </div>
              </div>

              <div className="drivemego-action-section">
                <h4>Reassign to Different Route</h4>
                <div className="drivemego-ad-dash-reassign-modal-field">
                  <label>Select New Route</label>
                  <select
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    className="drivemego-ad-dash-reassign-modal-select"
                  >
                    <option value="">Choose a route...</option>
                    {availableRoutes.map((route) => (
                      <option key={route._id} value={route._id}>
                        {route.fromLocation} to {route.toLocation} -{" "}
                        {formatCurrency(
                          route.pricing?.oneWayPrice,
                          route.pricing?.currency,
                        )}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="drivemego-action-btn drivemego-reassign"
                  onClick={handleReassign}
                  disabled={isProcessing || !selectedRoute}
                >
                  {isProcessing ? "Processing..." : "Reassign to New Route"}
                </button>
              </div>

              <div className="drivemego-ad-dash-reassign-modal-field">
                <label>Reason / Notes (required for reject/cancel)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for rejection, cancellation, or reassignment..."
                  className="ad-dash-reassign-modal-textarea"
                  rows="4"
                />
              </div>
            </div>
          )}
        </div>

        <div className="drivemego-ad-dash-reassign-modal-footer">
          <button
            className="drivemego-ad-dash-reassign-modal-cancel"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminReassignModal;
