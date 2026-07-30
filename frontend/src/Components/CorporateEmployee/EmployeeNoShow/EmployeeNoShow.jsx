import React, { useState, useEffect } from "react";
import api from "../../../utils/api";
import "./EmployeeNoShow.css";
import { notify } from "../../../utils/toast";

const EmployeeNoShow = () => {
  const [todayBookings, setTodayBookings] = useState([]);
  const [noShowHistory, setNoShowHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [noShowReason, setNoShowReason] = useState("");
  const [noShowNotes, setNoShowNotes] = useState("");

  useEffect(() => {
    fetchTodayBookings();
    fetchNoShowHistory();
  }, []);

  const fetchTodayBookings = async () => {
    try {
      // Backend: GET /api/corporate-employee-users/dashboard (for today's bookings)
      const response = await api.get("/corporate-employee-users/dashboard");

      if (response.data.success) {
        setTodayBookings(
          response.data.data?.todayTrips || response.data.data?.bookings || [],
        );
      } else {
        setError(response.data.message || "Failed to fetch today's bookings");
      }
    } catch (error) {
      console.error("Error fetching today bookings:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchNoShowHistory = async () => {
    try {
      // Backend: GET /api/no-show/my-no-shows (noShowRoutes.js)
      const response = await api.get("/no-show/my-no-shows");

      if (response.data.success) {
        setNoShowHistory(
          response.data.data?.noShows || response.data.noShows || [],
        );
      } else {
        console.error(
          "Failed to fetch no-show history:",
          response.data.message,
        );
      }
    } catch (error) {
      console.error("Error fetching no-show history:", error);
    }
  };

  const handleNoShowSubmit = async (e) => {
    e.preventDefault();

    try {
      // Backend: POST /api/corporate-employee-users/not-traveling-today
      const response = await api.post(
        "/corporate-employee-users/not-traveling-today",
        {
          bookingId: selectedBooking._id,
          reason: noShowReason,
          notes: noShowNotes,
        },
      );

      if (response.data.success) {
        // Success - refresh data and close modal
        setShowNoShowModal(false);
        setSelectedBooking(null);
        setNoShowReason("");
        setNoShowNotes("");

        // Refresh the data
        fetchTodayBookings();
        fetchNoShowHistory();
      } else {
        console.error("Failed to mark no-show:", response.data.message);
        notify(response.data.message || "Failed to mark no-show");
      }
    } catch (error) {
      console.error("Error marking no-show:", error);
      notify("Error marking no-show");
    }
  };

  const openNoShowModal = (booking) => {
    setSelectedBooking(booking);
    setNoShowReason("");
    setNoShowNotes("");
    setShowNoShowModal(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString) => {
    const time = new Date(timeString);
    return time.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const noShowReasons = [
    "Sick Leave",
    "Personal Emergency",
    "Work From Home",
    "Meeting Conflict",
    "Transportation Issue",
    "Other",
  ];

  const currentBookings = activeTab === "today" ? todayBookings : noShowHistory;

  if (loading) {
    return (
      <div className="employee-no-show">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-no-show">
      <div className="no-show-header">
        <h2>No Show Management</h2>
        <p>Mark yourself as not traveling for today's trips</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === "today" ? "active" : ""}`}
          onClick={() => setActiveTab("today")}
        >
          Today's Bookings ({todayBookings.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          No Show History ({noShowHistory.length})
        </button>
      </div>

      <div className="bookings-list">
        {currentBookings.length === 0 ? (
          <div className="no-bookings">
            <p>
              No{" "}
              {activeTab === "today" ? "bookings for today" : "no-show records"}{" "}
              found.
            </p>
          </div>
        ) : (
          currentBookings.map((booking, index) => (
            <div key={index} className="booking-card">
              <div className="booking-info">
                <div className="trip-info">
                  <h3>{booking.routeName}</h3>
                  <p className="route">
                    {booking.pickupLocation} → {booking.dropoffLocation}
                  </p>
                  <div className="time-details">
                    <span className="date">{formatDate(booking.tripDate)}</span>
                    <span className="time">
                      {formatTime(booking.pickupTime)}
                    </span>
                  </div>
                </div>

                <div className="vehicle-info">
                  <p>
                    <strong>Vehicle:</strong> {booking.vehicleNumber}
                  </p>
                  <p>
                    <strong>Seat:</strong> {booking.seatNumber}
                  </p>
                  <p>
                    <strong>Driver:</strong> {booking.driverName}
                  </p>
                </div>
              </div>

              <div className="booking-actions">
                {activeTab === "today" && booking.status === "CONFIRMED" && (
                  <button
                    className="no-show-btn"
                    onClick={() => openNoShowModal(booking)}
                  >
                    Mark as Not Traveling
                  </button>
                )}

                {activeTab === "history" && (
                  <div className="no-show-details">
                    <div className="reason-info">
                      <span className="reason-label">Reason:</span>
                      <span className="reason-value">{booking.reason}</span>
                    </div>
                    <div className="notes-info">
                      <span className="notes-label">Notes:</span>
                      <span className="notes-value">
                        {booking.notes || "No notes provided"}
                      </span>
                    </div>
                    <div className="date-info">
                      <span className="date-label">Marked on:</span>
                      <span className="date-value">
                        {formatDate(booking.createdAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showNoShowModal && selectedBooking && (
        <div className="no-show-modal-overlay">
          <div className="no-show-modal">
            <div className="modal-header">
              <h3>Mark as Not Traveling</h3>
              <button
                className="close-btn"
                onClick={() => setShowNoShowModal(false)}
              >
                ×
              </button>
            </div>

            <div className="booking-summary">
              <p>
                <strong>Route:</strong> {selectedBooking.routeName}
              </p>
              <p>
                <strong>Date:</strong> {formatDate(selectedBooking.tripDate)}
              </p>
              <p>
                <strong>Time:</strong> {formatTime(selectedBooking.pickupTime)}
              </p>
              <p>
                <strong>Vehicle:</strong> {selectedBooking.vehicleNumber}
              </p>
            </div>

            <form onSubmit={handleNoShowSubmit} className="no-show-form">
              <div className="form-group">
                <label>Reason for not traveling</label>
                <select
                  value={noShowReason}
                  onChange={(e) => setNoShowReason(e.target.value)}
                  required
                >
                  <option value="">Select a reason</option>
                  {noShowReasons.map((reason, index) => (
                    <option key={index} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Additional Notes (Optional)</label>
                <textarea
                  value={noShowNotes}
                  onChange={(e) => setNoShowNotes(e.target.value)}
                  rows="3"
                  placeholder="Provide any additional information..."
                />
              </div>

              <div className="warning-message">
                <p>
                  ⚠️ By marking yourself as not traveling, your seat will be
                  made available for other employees.
                </p>
                <p>This action cannot be undone for today's trips.</p>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowNoShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Mark as Not Traveling
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeNoShow;
