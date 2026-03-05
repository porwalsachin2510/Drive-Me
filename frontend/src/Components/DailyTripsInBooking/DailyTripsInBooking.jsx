import React, { useState, useEffect, useCallback } from "react";
import api from "../../utils/api";
import "./DailyTripsInBooking.css";

const DailyTripsInBooking = ({ booking, userRole, onTripStatusChange, currentUserId, currentDriverId, onTripStart, onTripComplete }) => {
  const [dailyTrips, setDailyTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("today"); // "today", "upcoming", "all"
  const [actionLoading, setActionLoading] = useState(null);

  const fetchDailyTrips = useCallback(async () => {
    try {
      setLoading(true);
      const bookingId = booking?.bookingId || booking?._id;
      const response = await api.get(`/bookings/${bookingId}/daily-trips`);
      
      if (response.data.success) {
        const trips = Array.isArray(response.data.data) ? response.data.data : [];
        setDailyTrips(trips);
      }
    } catch (error) {
      console.error("[DailyTrips] Error fetching trips:", error?.response?.data || error.message);
      setDailyTrips([]);
    } finally {
      setLoading(false);
    }
  }, [booking?.bookingId, booking?._id]);

  useEffect(() => {
    if (booking?.bookingId || booking?._id) {
      fetchDailyTrips();
    }
  }, [fetchDailyTrips]);

  // Start a specific trip (changes status from Scheduled -> In Progress)
  const handleStartTrip = async (tripId) => {
    try {
      setActionLoading(tripId);
      await api.put(`/b2c-daily-trips/status/${tripId}`, { status: "Started" });
      if (onTripStatusChange) onTripStatusChange("STARTED", tripId);
      if (onTripStart) onTripStart(tripId);
      await fetchDailyTrips();
    } catch (error) {
      console.error("[DailyTrips] Error starting trip:", error?.response?.data || error.message);
      alert(error?.response?.data?.message || "Failed to start trip");
    } finally {
      setActionLoading(null);
    }
  };

  // Complete a specific trip (changes status from In Progress -> Completed)
  const handleCompleteTrip = async (tripId) => {
    try {
      setActionLoading(tripId);
      await api.put(`/b2c-daily-trips/status/${tripId}`, { status: "Completed" });
      if (onTripStatusChange) onTripStatusChange("COMPLETED", tripId);
      if (onTripComplete) onTripComplete(tripId);
      await fetchDailyTrips();
    } catch (error) {
      console.error("[DailyTrips] Error completing trip:", error?.response?.data || error.message);
      alert(error?.response?.data?.message || "Failed to complete trip");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusLabel = (status) => {
    const map = {
      "Scheduled": "Scheduled",
      "In Progress": "In Progress",
      "Completed": "Completed",
      "Cancelled": "Cancelled",
      "Delayed": "Delayed",
    };
    return map[status] || status || "Scheduled";
  };

  const getStatusClass = (status) => {
    const map = {
      "Scheduled": "status-scheduled",
      "In Progress": "status-inprogress",
      "Completed": "status-completed",
      "Cancelled": "status-cancelled",
      "Delayed": "status-delayed",
    };
    return map[status] || "status-scheduled";
  };

  // Only show Start/Complete buttons if current user is the actual driver for this booking
  const isDriverRole = (() => {
    if (userRole === "B2C_PARTNER" && booking?.isSelfDriver) return true;
    if (userRole === "B2C_PARTNER_DRIVER") {
      const bookingDriverId = booking?.assignedDriverId || booking?.driverId;
      if (!bookingDriverId) return false;
      const driverIdStr = bookingDriverId.toString();
      // Check both user._id and user.driverId since assignedDriverId may reference B2CPartnerDriver doc
      if (currentUserId && driverIdStr === currentUserId.toString()) return true;
      if (currentDriverId && driverIdStr === currentDriverId.toString()) return true;
      return false;
    }
    return false;
  })();

  // Filter trips
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const filteredTrips = dailyTrips.filter((trip) => {
    const tripDate = new Date(trip.tripDate);
    if (filter === "today") {
      return tripDate >= todayStart && tripDate < todayEnd;
    }
    if (filter === "upcoming") {
      return tripDate >= todayStart;
    }
    return true; // "all"
  });

  // Count stats
  const todayTrips = dailyTrips.filter(t => {
    const d = new Date(t.tripDate);
    return d >= todayStart && d < todayEnd;
  });
  const upcomingTrips = dailyTrips.filter(t => new Date(t.tripDate) >= todayStart);
  const completedTrips = dailyTrips.filter(t => t.status === "Completed" || t.tripStatus === "Completed");

  if (loading) {
    return <div className="daily-trips-loading">Loading trips...</div>;
  }

  if (!dailyTrips || dailyTrips.length === 0) {
    return <div className="daily-trips-empty">No trips scheduled for this booking</div>;
  }

  return (
    <div className="daily-trips-container">
      <div className="daily-trips-header">
        <h4>Daily Trips</h4>
        <div className="trip-stats-mini">
          <span className="stat-mini">{todayTrips.length} today</span>
          <span className="stat-mini">{upcomingTrips.length} upcoming</span>
          <span className="stat-mini">{completedTrips.length} done</span>
        </div>
      </div>

      <div className="trip-filter-tabs">
        <button
          className={`trip-filter-btn ${filter === "today" ? "active" : ""}`}
          onClick={() => setFilter("today")}
        >
          Today ({todayTrips.length})
        </button>
        <button
          className={`trip-filter-btn ${filter === "upcoming" ? "active" : ""}`}
          onClick={() => setFilter("upcoming")}
        >
          Upcoming ({upcomingTrips.length})
        </button>
        <button
          className={`trip-filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All ({dailyTrips.length})
        </button>
        <button className="trip-refresh-btn" onClick={fetchDailyTrips} title="Refresh">
          Refresh
        </button>
      </div>

      {filteredTrips.length === 0 ? (
        <div className="daily-trips-empty">
          No {filter === "today" ? "trips for today" : filter === "upcoming" ? "upcoming trips" : "trips"} found
        </div>
      ) : (
        <div className="daily-trips-list">
          {filteredTrips.map((trip) => {
            const tripDate = new Date(trip.tripDate);
            const isToday = tripDate >= todayStart && tripDate < todayEnd;
            const tripStatus = trip.status || trip.tripStatus || "Scheduled";
            const statusClass = getStatusClass(tripStatus);

            return (
              <div key={trip._id} className={`daily-trip-item ${isToday ? "today-highlight" : ""}`}>
                <div className="trip-item-left">
                  <div className="trip-date-block">
                    <span className="trip-day">{tripDate.toLocaleDateString("en-US", { weekday: "short" })}</span>
                    <span className="trip-date-num">{tripDate.getDate()}</span>
                    <span className="trip-month">{tripDate.toLocaleDateString("en-US", { month: "short" })}</span>
                  </div>
                </div>
                <div className="trip-item-center">
                  <div className="trip-route-line">
                    <span className="trip-from">{trip.fromLocation || booking.pickupLocation}</span>
                    <span className="trip-arrow">--&gt;</span>
                    <span className="trip-to">{trip.toLocation || booking.dropoffLocation}</span>
                  </div>
                  <div className="trip-meta-row">
                    <span className="trip-time">{trip.startTime || trip.pickupTime || "--"}</span>
                    <span className="trip-type-badge">{trip.tripType || "One Way"}</span>
                    {trip.driverName && <span className="trip-driver-name">{trip.driverName}</span>}
                  </div>
                </div>
                <div className="trip-item-right">
                  <span className={`trip-status-pill ${statusClass}`}>
                    {getStatusLabel(tripStatus)}
                  </span>
                  
                  {isDriverRole && isToday && (
                    <div className="trip-action-btns">
                      {(tripStatus === "Scheduled") && (
                        <button
                          className="btn-trip-start"
                          onClick={() => handleStartTrip(trip._id)}
                          disabled={actionLoading === trip._id}
                        >
                          {actionLoading === trip._id ? "..." : "Start"}
                        </button>
                      )}
                      {(tripStatus === "In Progress") && (
                        <button
                          className="btn-trip-complete"
                          onClick={() => handleCompleteTrip(trip._id)}
                          disabled={actionLoading === trip._id}
                        >
                          {actionLoading === trip._id ? "..." : "Complete"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DailyTripsInBooking;
