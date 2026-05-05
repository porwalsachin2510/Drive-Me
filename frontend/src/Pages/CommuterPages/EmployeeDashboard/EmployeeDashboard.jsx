"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import api from "../../../utils/api";
import DashboardLayout from "../../../Components/DashboardLayout/DashboardLayout";
import EmployeeFeedback from "../../../Components/CorporateEmployee/EmployeeFeedback/EmployeeFeedback";
import "./employeedashboard.css";

export default function EmployeeDashboard() {
  const user = useSelector((state) => state.auth.user);
  const [dashTab, setDashTab] = useState("trip-info");
  const [tripInfo, setTripInfo] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch employee's assigned route/trip info
  useEffect(() => {
    fetchTripInfo();
    fetchDashboardData();
    fetchNotifications();
  }, [user?.id, user?._id]);

  const fetchTripInfo = async () => {
    try {
      const response = await api.get("/corporate-employee-users/route");
      if (response.data?.data) {
        setTripInfo(response.data.data);
        if (response.data.data.route?._id) {
          localStorage.setItem("routeId", response.data.data.route._id);
        }
      }
    } catch (err) {
      console.error("Error fetching trip info:", err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await api.get("/corporate-employee-users/dashboard");
      const dashboardData = response.data?.data;

      const bookingsData =
        dashboardData?.upcomingTrips || dashboardData?.bookings || [];
      setMyBookings(Array.isArray(bookingsData) ? bookingsData : []);

      const historyData =
        dashboardData?.travelHistory || dashboardData?.recentTrips || [];
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setMyBookings([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (!user?._id) return;
      const response = await api.get(`/notifications/user/${user._id}`);
      setNotifications(
        response.data?.data?.notifications ||
          response.data?.notifications ||
          [],
      );
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await api.post("/corporate-employee-users/booking", {
        action: "cancel",
        tripId: bookingId,
      });
      setMyBookings(myBookings.filter((b) => b._id !== bookingId));
    } catch (err) {
      console.error("Error canceling booking:", err);
    }
  };

  const handleMarkNotTraveling = async () => {
    try {
      await api.post("/corporate-employee-users/not-traveling-today", {
        reason: "Personal",
      });
      fetchTripInfo();
      fetchDashboardData();
    } catch (err) {
      console.error("Error marking not traveling:", err);
    }
  };

  const handleRateTrip = async (tripId, rating, feedback) => {
    try {
      await api.post("/corporate-employee-users/rate-trip", {
        tripId,
        rating,
        feedback,
      });
      fetchDashboardData();
    } catch (err) {
      console.error("Error rating trip:", err);
    }
  };

  const handleRequestRouteChange = async (reason, preferredRoute) => {
    try {
      await api.post("/corporate-employee-users/request-route-change", {
        reason,
        preferredRoute,
      });
      alert("Route change request submitted successfully");
    } catch (err) {
      console.error("Error requesting route change:", err);
    }
  };

  const renderContent = () => {
    switch (dashTab) {
      case "trip-info":
        return (
          <TripInfoTab
            tripInfo={tripInfo}
            loading={loading}
            onMarkNotTraveling={handleMarkNotTraveling}
          />
        );
      case "my-bookings":
        return (
          <MyBookingsTab
            bookings={myBookings}
            onCancel={handleCancelBooking}
            loading={loading}
          />
        );
      case "history":
        return (
          <HistoryTab
            history={history}
            loading={loading}
            onRate={handleRateTrip}
          />
        );
      case "notifications":
        return (
          <NotificationsTab notifications={notifications} loading={loading} />
        );
      case "feedback":
        return <EmployeeFeedback />;
      case "route-change":
        return <RouteChangeTab onSubmit={handleRequestRouteChange} />;
      default:
        return (
          <TripInfoTab
            tripInfo={tripInfo}
            loading={loading}
            onMarkNotTraveling={handleMarkNotTraveling}
          />
        );
    }
  };

  return (
    <DashboardLayout activeTab={dashTab} setActiveTab={setDashTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

function TripInfoTab({ tripInfo, loading, onMarkNotTraveling }) {
  if (loading)
    return (
      <div className="employee-dashboard-loading">
        Loading trip information...
      </div>
    );
  if (!tripInfo)
    return (
      <div className="employee-dashboard-empty-state">
        No trip information available. Please contact your manager to get
        assigned to a route.
      </div>
    );

  return (
    <div className="employee-dashboard-tab-content">
      <div className="employee-dashboard-tab-header">
        <h2>Your Assigned Route</h2>
        <button
          className="employee-dashboard-not-traveling-btn"
          onClick={onMarkNotTraveling}
        >
          Not Traveling Today
        </button>
      </div>
      {tripInfo.route ? (
        <>
          <div className="employee-dashboard-route-summary">
            <h3>
              {tripInfo.route?.fromLocation} → {tripInfo.route?.toLocation}
            </h3>
            <p>Status: Traveling Today</p>
          </div>
          <div className="employee-dashboard-info-cards">
            <div className="employee-dashboard-info-card">
              <label>Vehicle</label>
              <p>
                {tripInfo.vehicle?.vehicleName ||
                  (tripInfo.vehicle?.make && tripInfo.vehicle?.model
                    ? `${tripInfo.vehicle.make} ${tripInfo.vehicle.model}`
                    : "Not assigned")}
              </p>
              {(tripInfo.vehicle?.registrationNumber ||
                tripInfo.vehicle?.licensePlate) && (
                <small>
                  Registration:{" "}
                  {tripInfo.vehicle.registrationNumber ||
                    tripInfo.vehicle.licensePlate}
                </small>
              )}
              {tripInfo.vehicle?.vehicleCategory && (
                <small style={{ display: "block" }}>
                  Type: {tripInfo.vehicle.vehicleCategory}
                </small>
              )}
            </div>
            <div className="employee-dashboard-info-card">
              <label>Driver</label>
              <p>{tripInfo.driver?.fullName || "Not assigned"}</p>
              {tripInfo.driver?.phone && (
                <small>Phone: {tripInfo.driver.phone}</small>
              )}
            </div>
            <div className="employee-dashboard-info-card">
              <label>Pickup Stop</label>
              <p>{tripInfo.pickupStop || "Not assigned"}</p>
            </div>
            <div className="employee-dashboard-info-card">
              <label>Dropoff Stop</label>
              <p>{tripInfo.dropoffStop || "Not assigned"}</p>
            </div>
            <div className="employee-dashboard-info-card">
              <label>Shift Type</label>
              <p>{tripInfo.shiftType || "Full Day"}</p>
            </div>
            {tripInfo.route?.stopPoints &&
              tripInfo.route.stopPoints.length > 0 && (
                <div className="employee-dashboard-info-card employee-dashboard-info-card-wide">
                  <label>Stop Points</label>
                  <div className="employee-dashboard-stop-points">
                    {tripInfo.route.stopPoints.map((stop, index) => (
                      <div
                        key={index}
                        className="employee-dashboard-stop-point"
                      >
                        <strong>{stop.location}</strong> -{" "}
                        {stop.time || "Time not specified"}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </>
      ) : (
        <div className="employee-dashboard-no-route">
          <strong>No Route Assigned</strong>
          <p>
            You have not been assigned to a route yet. Please contact your
            manager or HR to request a route assignment.
          </p>
        </div>
      )}
    </div>
  );
}

function MyBookingsTab({ bookings, onCancel, loading }) {
  if (loading)
    return (
      <div className="employee-dashboard-loading">Loading bookings...</div>
    );

  const bookingsList = Array.isArray(bookings) ? bookings : [];

  return (
    <div className="employee-dashboard-tab-content">
      <h2>My Bookings</h2>
      {bookingsList.length === 0 ? (
        <div className="employee-dashboard-empty-state">No bookings yet</div>
      ) : (
        <div className="employee-dashboard-bookings-list">
          {bookingsList.map((booking) => (
            <div key={booking._id} className="employee-dashboard-booking-card">
              <div className="employee-dashboard-booking-info">
                <h3>
                  {booking.fromLocation} → {booking.toLocation}
                </h3>
                <p className="employee-dashboard-booking-date">
                  {new Date(booking.tripDate).toLocaleDateString()} at{" "}
                  {booking.startTime}
                </p>
                <span
                  className={`employee-dashboard-status employee-dashboard-status-${booking.status.toLowerCase()}`}
                >
                  {booking.status}
                </span>
              </div>
              <div className="employee-dashboard-booking-actions">
                {booking.status !== "COMPLETED" && (
                  <button
                    className="employee-dashboard-cancel-btn"
                    onClick={() => onCancel(booking._id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTab({ history, loading, onRate }) {
  const [ratingTrip, setRatingTrip] = useState(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");

  if (loading)
    return <div className="employee-dashboard-loading">Loading history...</div>;

  const historyList = Array.isArray(history) ? history : [];

  const handleSubmitRating = (tripId) => {
    onRate(tripId, rating, feedback);
    setRatingTrip(null);
    setRating(5);
    setFeedback("");
  };

  return (
    <div className="employee-dashboard-tab-content">
      <h2>Travel History</h2>
      {historyList.length === 0 ? (
        <div className="employee-dashboard-empty-state">No travel history</div>
      ) : (
        <div className="employee-dashboard-history-list">
          {historyList.map((trip) => (
            <div key={trip._id} className="employee-dashboard-history-item">
              <div className="employee-dashboard-history-date">
                {new Date(trip.date || trip.travelDate).toLocaleDateString()}
              </div>
              <div className="employee-dashboard-history-route">
                {trip.fromLocation || trip.route?.fromLocation} →{" "}
                {trip.toLocation || trip.route?.toLocation}
              </div>
              <div className="employee-dashboard-history-status">
                {trip.attendance || trip.status}
              </div>
              {trip.status === "COMPLETED" && !trip.rating && (
                <button
                  className="employee-dashboard-rate-btn"
                  onClick={() => setRatingTrip(trip._id)}
                >
                  Rate Trip
                </button>
              )}
              {ratingTrip === trip._id && (
                <div className="employee-dashboard-rating-form">
                  <div className="employee-dashboard-rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={`employee-dashboard-star ${star <= rating ? "active" : ""}`}
                      >
                        *
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Your feedback..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="employee-dashboard-feedback-input"
                  />
                  <div className="employee-dashboard-rating-actions">
                    <button
                      className="employee-dashboard-submit-btn"
                      onClick={() => handleSubmitRating(trip._id)}
                    >
                      Submit
                    </button>
                    <button
                      className="employee-dashboard-cancel-btn"
                      onClick={() => setRatingTrip(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsTab({ notifications, loading }) {
  if (loading)
    return (
      <div className="employee-dashboard-loading">Loading notifications...</div>
    );

  return (
    <div className="employee-dashboard-tab-content">
      <h2>Notifications</h2>
      {notifications.length === 0 ? (
        <div className="employee-dashboard-empty-state">No notifications</div>
      ) : (
        <div className="employee-dashboard-notifications-list">
          {notifications.map((notif) => (
            <div
              key={notif._id}
              className={`employee-dashboard-notification-item ${!notif.isRead ? "employee-dashboard-unread" : ""}`}
            >
              <div className="employee-dashboard-notif-title">
                {notif.title}
              </div>
              <div className="employee-dashboard-notif-message">
                {notif.message}
              </div>
              <div className="employee-dashboard-notif-time">
                {new Date(notif.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteChangeTab({ onSubmit }) {
  const [reason, setReason] = useState("");
  const [preferredRoute, setPreferredRoute] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit(reason, preferredRoute);
    setSubmitted(true);
    setReason("");
    setPreferredRoute("");
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="employee-dashboard-tab-content">
      <h2>Request Route Change</h2>
      <p className="employee-dashboard-description">
        If your pickup/dropoff location has changed, you can request a route
        change.
      </p>
      {submitted && (
        <div className="employee-dashboard-success-message">
          Route change request submitted successfully!
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="employee-dashboard-route-change-form"
      >
        <div className="employee-dashboard-form-group">
          <label>Reason for change *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you need a route change..."
            required
          />
        </div>
        <div className="employee-dashboard-form-group">
          <label>Preferred new route/area (optional)</label>
          <input
            type="text"
            value={preferredRoute}
            onChange={(e) => setPreferredRoute(e.target.value)}
            placeholder="e.g., Sector 62 Noida"
          />
        </div>
        <button type="submit" className="employee-dashboard-submit-btn">
          Submit Request
        </button>
      </form>
    </div>
  );
}
