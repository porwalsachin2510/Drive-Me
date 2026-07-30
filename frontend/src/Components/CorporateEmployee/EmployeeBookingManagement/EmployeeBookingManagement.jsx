import React, { useState, useEffect } from "react";
import api from "../../../utils/api";
import "./EmployeeBookingManagement.css";
import { notify } from "../../../utils/toast";

const EmployeeBookingManagement = () => {
  const [bookings, setBookings] = useState([]);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("current");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [bookingAction, setBookingAction] = useState("book"); // 'book' or 'cancel'

  useEffect(() => {
    fetchCurrentBookings();
    fetchUpcomingBookings();
  }, []);

  const fetchCurrentBookings = async () => {
    try {
      // Backend: GET /api/corporate-employee-users/dashboard
      const response = await api.get("/corporate-employee-users/dashboard");

      if (response.data.success) {
        setBookings(
          response.data.data?.todayTrips || response.data.data?.bookings || [],
        );
      } else {
        setError(response.data.message || "Failed to fetch current bookings");
      }
    } catch (error) {
      console.error("Error fetching current bookings:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingBookings = async () => {
    try {
      // Backend: GET /api/corporate-employee-users/dashboard (includes upcoming trips)
      const response = await api.get("/corporate-employee-users/dashboard");

      if (response.data.success) {
        setUpcomingBookings(
          response.data.data?.upcomingTrips ||
            response.data.data?.bookings ||
            [],
        );
      } else {
        console.error(
          "Failed to fetch upcoming bookings:",
          response.data.message,
        );
      }
    } catch (error) {
      console.error("Error fetching upcoming bookings:", error);
    }
  };

  const handleBookingAction = async (e) => {
    e.preventDefault();

    try {
      // Backend: POST /api/corporate-employee-users/booking (manageBooking)
      const response = await api.post("/corporate-employee-users/booking", {
        action: bookingAction,
        bookingDate: selectedDate,
      });

      if (response.data.success) {
        // Success - refresh data and close modal
        setShowBookingModal(false);
        setSelectedDate("");

        // Refresh bookings
        fetchCurrentBookings();
        fetchUpcomingBookings();
      } else {
        notify(response.data.message || `Failed to ${bookingAction} booking`);
      }
    } catch (error) {
      console.error("Error:", error);
      notify(`Error trying to ${bookingAction} booking`);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
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

  const openBookingModal = (action, date = "") => {
    setBookingAction(action);
    setSelectedDate(date);
    setShowBookingModal(true);
  };

  const currentBookings = activeTab === "current" ? bookings : upcomingBookings;

  if (loading) {
    return (
      <div className="employee-booking-management">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-booking-management">
      <div className="booking-header">
        <h2>My Bookings</h2>
        <button
          className="book-trip-btn"
          onClick={() => openBookingModal("book")}
        >
          Book a Trip
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === "current" ? "active" : ""}`}
          onClick={() => setActiveTab("current")}
        >
          Current Month
        </button>
        <button
          className={`tab-btn ${activeTab === "upcoming" ? "active" : ""}`}
          onClick={() => setActiveTab("upcoming")}
        >
          Upcoming
        </button>
      </div>

      <div className="bookings-list">
        {currentBookings.length === 0 ? (
          <div className="no-bookings">
            <p>
              No {activeTab === "current" ? "current" : "upcoming"} bookings
              found.
            </p>
            <button
              className="book-now-btn"
              onClick={() => openBookingModal("book")}
            >
              Book a Trip Now
            </button>
          </div>
        ) : (
          currentBookings.map((booking, index) => (
            <div key={index} className="booking-card">
              <div className="booking-info">
                <div className="booking-date">
                  <h3>{formatDate(booking.tripDate)}</h3>
                  <span className="trip-type">{booking.tripType}</span>
                </div>

                <div className="booking-details">
                  <div className="route-info">
                    <p>
                      <strong>Route:</strong> {booking.routeName}
                    </p>
                    <p>
                      <strong>Pickup:</strong> {booking.pickupLocation}
                    </p>
                    <p>
                      <strong>Dropoff:</strong> {booking.dropoffLocation}
                    </p>
                  </div>

                  <div className="time-info">
                    <p>
                      <strong>Pickup Time:</strong>{" "}
                      {formatTime(booking.pickupTime)}
                    </p>
                    <p>
                      <strong>Dropoff Time:</strong>{" "}
                      {formatTime(booking.dropoffTime)}
                    </p>
                    <p>
                      <strong>Vehicle:</strong> {booking.vehicleNumber}
                    </p>
                  </div>

                  <div className="seat-info">
                    <p>
                      <strong>Seat Number:</strong> {booking.seatNumber}
                    </p>
                    <p>
                      <strong>Driver:</strong> {booking.driverName}
                    </p>
                    <p>
                      <strong>Contact:</strong> {booking.driverContact}
                    </p>
                  </div>
                </div>
              </div>

              <div className="booking-status">
                <span
                  className={`status-badge ${booking.status.toLowerCase()}`}
                >
                  {booking.status}
                </span>

                <div className="booking-actions">
                  {booking.status === "CONFIRMED" && (
                    <button
                      className="cancel-btn"
                      onClick={() =>
                        openBookingModal("cancel", booking.tripDate)
                      }
                    >
                      Cancel Booking
                    </button>
                  )}

                  {booking.status === "COMPLETED" && (
                    <button
                      className="feedback-btn"
                      onClick={() =>
                        (window.location.href = "/employee-feedback")
                      }
                    >
                      Give Feedback
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showBookingModal && (
        <div className="booking-modal-overlay">
          <div className="booking-modal">
            <div className="modal-header">
              <h3>
                {bookingAction === "book" ? "Book a Trip" : "Cancel Booking"}
              </h3>
              <button
                className="close-btn"
                onClick={() => setShowBookingModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleBookingAction} className="booking-form">
              <div className="form-group">
                <label>Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              <div className="form-group">
                <label>Trip Type</label>
                <select
                  value={activeTab === "current" ? "today" : "upcoming"}
                  disabled
                >
                  <option value="today">Today's Trip</option>
                  <option value="upcoming">Upcoming Trip</option>
                </select>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowBookingModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={`submit-btn ${bookingAction}`}>
                  {bookingAction === "book" ? "Book Trip" : "Cancel Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeBookingManagement;
