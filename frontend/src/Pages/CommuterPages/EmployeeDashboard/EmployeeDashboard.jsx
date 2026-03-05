import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import api from "../../../utils/api";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import EmployeeFeedback from "../../../Components/CorporateEmployee/EmployeeFeedback/EmployeeFeedback";
import "./employeedashboard.css";

export default function EmployeeDashboard() {
  const user = useSelector((state) => state.auth.user);
  const [dashTab, setDashTab] = useState("trip-info");
  const [navTab, setNavTab] = useState("employee");
  const [tripInfo, setTripInfo] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);

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
        // Store routeId in localStorage for use in other components
        if (response.data.data.route?._id) {
          localStorage.setItem('routeId', response.data.data.route._id);
        }
      }
    } catch (err) {
      console.error("Error fetching trip info:", err);
    }
  };

  // Single dashboard call that provides both bookings and history
  const fetchDashboardData = async () => {
    try {
      const response = await api.get("/corporate-employee-users/dashboard");
      const dashboardData = response.data?.data;
      
      // Extract bookings - ensure it's always an array
      const bookingsData = dashboardData?.upcomingTrips || dashboardData?.bookings || [];
      setMyBookings(Array.isArray(bookingsData) ? bookingsData : []);
      
      // Extract history - ensure it's always an array
      const historyData = dashboardData?.travelHistory || dashboardData?.recentTrips || [];
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
      setNotifications(response.data?.data?.notifications || response.data?.notifications || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await api.post("/corporate-employee-users/booking", { action: "cancel", tripId: bookingId });
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
      await api.post("/corporate-employee-users/rate-trip", { tripId, rating, feedback });
      fetchDashboardData();
    } catch (err) {
      console.error("Error rating trip:", err);
    }
  };

  const handleRequestRouteChange = async (reason, preferredRoute) => {
    try {
      await api.post("/corporate-employee-users/request-route-change", { reason, preferredRoute });
      alert("Route change request submitted successfully");
    } catch (err) {
      console.error("Error requesting route change:", err);
    }
  };

  const renderContent = () => {
    switch (dashTab) {
      case "trip-info":
        return <TripInfoTab tripInfo={tripInfo} loading={loading} onMarkNotTraveling={handleMarkNotTraveling} />;
      case "my-bookings":
        return (
          <MyBookingsTab
            bookings={myBookings}
            onCancel={handleCancelBooking}
            loading={loading}
          />
        );
      case "history":
        return <HistoryTab history={history} loading={loading} onRate={handleRateTrip} />;
      case "notifications":
        return (
          <NotificationsTab notifications={notifications} loading={loading} />
        );
      case "feedback":
        return <EmployeeFeedback />;
      case "route-change":
        return <RouteChangeTab onSubmit={handleRequestRouteChange} />;
      default:
        return <TripInfoTab tripInfo={tripInfo} loading={loading} onMarkNotTraveling={handleMarkNotTraveling} />;
    }
  };

  return (
    <>
    <Navbar activeTab={navTab} setActiveTab={setNavTab} />
    <div className="employee-dashboard-corporate-container">
      <div className="employee-dashboard-corporate-header">
        <h1>Welcome, {user?.fullName || "Employee"}</h1>
        <p className="employee-dashboard-corporate-subtitle">Corporate Employee Transportation Dashboard</p>
      </div>

      <div className="employee-dashboard-corporate-tabs">
        <button
          className={`employee-dashboard-corporate-tab-btn ${dashTab === "trip-info" ? "employee-dashboard-corporate-active" : ""}`}
          onClick={() => setDashTab("trip-info")}
        >
          Trip Info
        </button>
        <button
          className={`employee-dashboard-corporate-tab-btn ${dashTab === "my-bookings" ? "employee-dashboard-corporate-active" : ""}`}
          onClick={() => setDashTab("my-bookings")}
        >
          My Bookings
        </button>
        <button
          className={`employee-dashboard-corporate-tab-btn ${dashTab === "history" ? "employee-dashboard-corporate-active" : ""}`}
          onClick={() => setDashTab("history")}
        >
          History
        </button>
        <button
          className={`employee-dashboard-corporate-tab-btn ${dashTab === "notifications" ? "employee-dashboard-corporate-active" : ""}`}
          onClick={() => setDashTab("notifications")}
        >
          Notifications
        </button>
        <button
          className={`employee-dashboard-corporate-tab-btn ${dashTab === "feedback" ? "employee-dashboard-corporate-active" : ""}`}
          onClick={() => setDashTab("feedback")}
        >
          Rate & Feedback
        </button>
        <button
          className={`employee-dashboard-corporate-tab-btn ${dashTab === "route-change" ? "employee-dashboard-corporate-active" : ""}`}
          onClick={() => setDashTab("route-change")}
        >
          Route Change
        </button>
      </div>

      <div className="employee-dashboard-corporate-content">{renderContent()}</div>
    </div>
    <Footer />
    </>
  );
}

function TripInfoTab({ tripInfo, loading, onMarkNotTraveling }) {
  if (loading)
    return <div className="employee-dashboard-corporate-loading">Loading trip information...</div>;
  if (!tripInfo)
    return <div className="employee-dashboard-corporate-empty-state">No trip information available. Please contact your manager to get assigned to a route.</div>;

  return (
    <div className="employee-dashboard-corporate-tab-content">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Your Assigned Route</h2>
        <button className="employee-dashboard-corporate-cancel-btn" onClick={onMarkNotTraveling}>
          Not Traveling Today
        </button>
      </div>
      {tripInfo.route ? (
        <>
          <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f0f0f0", borderRadius: "8px" }}>
            <h3 style={{ marginTop: 0 }}>
              {tripInfo.route?.fromLocation} → {tripInfo.route?.toLocation}
            </h3>
            <p style={{ marginBottom: 0, color: "#666" }}>Status: Traveling Today</p>
          </div>
          <div className="employee-dashboard-corporate-trip-info-cards">
            <div className="employee-dashboard-corporate-info-card">
              <label>Vehicle</label>
              <p>
                {tripInfo.vehicle?.vehicleName || 
                 (tripInfo.vehicle?.make && tripInfo.vehicle?.model 
                  ? `${tripInfo.vehicle.make} ${tripInfo.vehicle.model}`
                  : "Not assigned")}
              </p>
              {(tripInfo.vehicle?.registrationNumber || tripInfo.vehicle?.licensePlate) && (
                <small>Registration: {tripInfo.vehicle.registrationNumber || tripInfo.vehicle.licensePlate}</small>
              )}
              {tripInfo.vehicle?.vehicleCategory && (
                <small style={{ display: "block" }}>Type: {tripInfo.vehicle.vehicleCategory}</small>
              )}
            </div>
            <div className="employee-dashboard-corporate-info-card">
              <label>Driver</label>
              <p>{tripInfo.driver?.fullName || "Not assigned"}</p>
              {tripInfo.driver?.phone && (
                <small>Phone: {tripInfo.driver.phone}</small>
              )}
            </div>
            <div className="employee-dashboard-corporate-info-card">
              <label>Pickup Stop</label>
              <p>{tripInfo.pickupStop || "Not assigned"}</p>
            </div>
            <div className="employee-dashboard-corporate-info-card">
              <label>Dropoff Stop</label>
              <p>{tripInfo.dropoffStop || "Not assigned"}</p>
            </div>
            <div className="employee-dashboard-corporate-info-card">
              <label>Shift Type</label>
              <p>{tripInfo.shiftType || "Full Day"}</p>
            </div>
            {tripInfo.route?.stopPoints && tripInfo.route.stopPoints.length > 0 && (
              <div className="employee-dashboard-corporate-info-card" style={{ gridColumn: "span 2" }}>
                <label>Stop Points</label>
                <div style={{ display: "grid", gap: "8px" }}>
                  {tripInfo.route.stopPoints.map((stop, index) => (
                    <div key={index} style={{ padding: "8px", backgroundColor: "#fff", borderRadius: "4px", borderLeft: "3px solid #6b7280" }}>
                      <strong>{stop.location}</strong> - {stop.time || "Time not specified"}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: "20px", backgroundColor: "#fff3cd", borderRadius: "8px", color: "#856404" }}>
          <strong>No Route Assigned</strong>
          <p>You haven't been assigned to a route yet. Please contact your manager or HR to request a route assignment.</p>
        </div>
      )}
    </div>
  );
}

function MyBookingsTab({ bookings, onCancel, loading }) {
  if (loading) return <div className="employee-dashboard-corporate-loading">Loading bookings...</div>;
  
  // Ensure bookings is an array
  const bookingsList = Array.isArray(bookings) ? bookings : [];

  return (
    <div className="employee-dashboard-corporate-tab-content">
      <h2>My Bookings</h2>
      {bookingsList.length === 0 ? (
        <div className="employee-dashboard-corporate-empty-state">No bookings yet</div>
      ) : (
        <div className="employee-dashboard-corporate-bookings-list">
          {bookingsList.map((booking) => (
            <div key={booking._id} className="employee-dashboard-corporate-booking-card">
              <div className="employee-dashboard-corporate-booking-info">
                <h3>
                  {booking.fromLocation} → {booking.toLocation}
                </h3>
                <p className="employee-dashboard-corporate-date">
                  {new Date(booking.tripDate).toLocaleDateString()} at{" "}
                  {booking.startTime}
                </p>
                <span className={`employee-dashboard-corporate-status employee-dashboard-corporate-status-${booking.status.toLowerCase()}`}>
                  {booking.status}
                </span>
              </div>
              <div className="employee-dashboard-corporate-booking-actions">
                {booking.status !== "COMPLETED" && (
                  <button
                    className="employee-dashboard-corporate-cancel-btn"
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

  if (loading) return <div className="employee-dashboard-corporate-loading">Loading history...</div>;
  
  // Ensure history is an array
  const historyList = Array.isArray(history) ? history : [];

  const handleSubmitRating = (tripId) => {
    onRate(tripId, rating, feedback);
    setRatingTrip(null);
    setRating(5);
    setFeedback("");
  };

  return (
    <div className="employee-dashboard-corporate-tab-content">
      <h2>Travel History</h2>
      {historyList.length === 0 ? (
        <div className="employee-dashboard-corporate-empty-state">No travel history</div>
      ) : (
        <div className="employee-dashboard-corporate-history-list">
          {historyList.map((trip) => (
            <div key={trip._id} className="employee-dashboard-corporate-history-item">
              <div className="employee-dashboard-corporate-history-date">
                {new Date(trip.date || trip.travelDate).toLocaleDateString()}
              </div>
              <div className="employee-dashboard-corporate-history-route">
                {trip.fromLocation || trip.route?.fromLocation} → {trip.toLocation || trip.route?.toLocation}
              </div>
              <div className="employee-dashboard-corporate-history-status">{trip.attendance || trip.status}</div>
              {trip.status === "COMPLETED" && !trip.rating && (
                <button className="employee-dashboard-corporate-tab-btn" onClick={() => setRatingTrip(trip._id)}>
                  Rate Trip
                </button>
              )}
              {ratingTrip === trip._id && (
                <div className="employee-dashboard-corporate-rating-form" style={{ marginTop: "8px", padding: "12px", background: "#f5f5f5", borderRadius: "8px" }}>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: star <= rating ? "#f59e0b" : "#d1d5db" }}
                      >
                        *
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Your feedback..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", marginBottom: "8px", resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="employee-dashboard-corporate-tab-btn employee-dashboard-corporate-active" onClick={() => handleSubmitRating(trip._id)}>Submit</button>
                    <button className="employee-dashboard-corporate-cancel-btn" onClick={() => setRatingTrip(null)}>Cancel</button>
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
  if (loading) return <div className="employee-dashboard-corporate-loading">Loading notifications...</div>;

  return (
    <div className="employee-dashboard-corporate-tab-content">
      <h2>Notifications</h2>
      {notifications.length === 0 ? (
        <div className="employee-dashboard-corporate-empty-state">No notifications</div>
      ) : (
        <div className="employee-dashboard-corporate-notifications-list">
          {notifications.map((notif) => (
            <div
              key={notif._id}
              className={`employee-dashboard-corporate-notification-item ${!notif.isRead ? "employee-dashboard-corporate-unread" : ""}`}
            >
              <div className="employee-dashboard-corporate-notif-title">{notif.title}</div>
              <div className="employee-dashboard-corporate-notif-message">{notif.message}</div>
              <div className="employee-dashboard-corporate-notif-time">
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
    <div className="employee-dashboard-corporate-tab-content">
      <h2>Request Route Change</h2>
      <p style={{ color: "#666", marginBottom: "16px" }}>
        If your pickup/dropoff location has changed, you can request a route change.
      </p>
      {submitted && (
        <div style={{ padding: "12px", background: "#d4edda", color: "#155724", borderRadius: "8px", marginBottom: "16px" }}>
          Route change request submitted successfully!
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ maxWidth: "500px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "4px" }}>
            Reason for change *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you need a route change..."
            required
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", minHeight: "100px", resize: "vertical" }}
          />
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "4px" }}>
            Preferred new route/area (optional)
          </label>
          <input
            type="text"
            value={preferredRoute}
            onChange={(e) => setPreferredRoute(e.target.value)}
            placeholder="e.g., Sector 62 Noida"
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
          />
        </div>
        <button type="submit" className="employee-dashboard-corporate-tab-btn employee-dashboard-corporate-active" style={{ padding: "10px 24px" }}>
          Submit Request
        </button>
      </form>
    </div>
  );
}
