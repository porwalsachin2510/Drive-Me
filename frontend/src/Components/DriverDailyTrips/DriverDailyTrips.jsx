import React, { useState, useEffect, useCallback } from "react";
import api from "../../utils/api";
import "./DriverDailyTrips.css";

/**
 * DriverDailyTrips - Route-centric trip view for B2C Partner Drivers
 *
 * This component shows trips grouped by route+schedule+time.
 * Each trip displays ALL passengers who booked that trip.
 * The driver can start/complete a trip ONCE and it affects all passengers.
 *
 * For B2C_PARTNER_DRIVER: Shows trips where they are the assigned driver
 * For B2C_PARTNER (self-driver): Shows their own trips
 */
const DriverDailyTrips = ({
  onTripStatusChange,
  onTripStart,
  onTripComplete,
  isSharingLocation,
}) => {
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({
    todayTrips: 0,
    completedToday: 0,
    totalTrips: 0,
    inProgressTrips: 0,
  });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("today");
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedTrips, setExpandedTrips] = useState(new Set()); // Changed to Set for multiple expanded trips
  const [error, setError] = useState(null);

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[v0] Fetching driver trips with filter:", filter);

      const response = await api.get(
        `/b2c-daily-trips/driver/trips?filter=${filter}`,
      );

      console.log("[v0] Driver trips response:", response.data);

      if (response.data.success) {
        setTrips(response.data.data.trips || []);
        setStats(
          response.data.data.stats || {
            todayTrips: 0,
            completedToday: 0,
            totalTrips: 0,
            inProgressTrips: 0,
          },
        );
      } else {
        setError(response.data.message || "Failed to fetch trips");
        setTrips([]);
      }
    } catch (error) {
      console.error(
        "[DriverDailyTrips] Error fetching trips:",
        error?.response?.data || error.message,
      );
      setError(error?.response?.data?.message || "Failed to fetch trips");
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleStartTrip = async (tripId) => {
    try {
      setActionLoading(tripId);
      console.log("[v0] Starting trip:", tripId);

      const response = await api.put(`/b2c-daily-trips/driver/start/${tripId}`);
      console.log("[v0] Start trip response:", response.data);

      if (onTripStatusChange) onTripStatusChange("STARTED", tripId);
      if (onTripStart) onTripStart(tripId);

      await fetchTrips();
    } catch (error) {
      console.error(
        "[DriverDailyTrips] Error starting trip:",
        error?.response?.data || error.message,
      );
      alert(error?.response?.data?.message || "Failed to start trip");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteTrip = async (tripId) => {
    try {
      setActionLoading(tripId);
      console.log("[v0] Completing trip:", tripId);

      const response = await api.put(
        `/b2c-daily-trips/driver/complete/${tripId}`,
      );
      console.log("[v0] Complete trip response:", response.data);

      if (onTripStatusChange) onTripStatusChange("COMPLETED", tripId);
      if (onTripComplete) onTripComplete(tripId);

      await fetchTrips();
    } catch (error) {
      console.error(
        "[DriverDailyTrips] Error completing trip:",
        error?.response?.data || error.message,
      );
      alert(error?.response?.data?.message || "Failed to complete trip");
    } finally {
      setActionLoading(null);
    }
  };

  const togglePassengerList = (tripId) => {
    setExpandedTrips((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  const getStatusLabel = (status) => {
    const map = {
      Scheduled: "Scheduled",
      "In Progress": "In Progress",
      Completed: "Completed",
      Cancelled: "Cancelled",
      Delayed: "Delayed",
    };
    return map[status] || status || "Scheduled";
  };

  const getStatusClass = (status) => {
    const map = {
      Scheduled: "status-scheduled",
      "In Progress": "status-inprogress",
      Completed: "status-completed",
      Cancelled: "status-cancelled",
      Delayed: "status-delayed",
    };
    return map[status] || "status-scheduled";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      dateNum: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    };
  };

  const isToday = (dateString) => {
    const tripDate = new Date(dateString);
    const today = new Date();
    return tripDate.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <div className="driver-trips-container">
        <div className="driver-trips-loading">Loading trips...</div>
      </div>
    );
  }

  return (
    <div className="driver-trips-container">
      {/* Header with Stats */}
      <div className="driver-trips-header">
        <div className="driver-trips-title">
          <h2>Daily Trip Management</h2>
          <p className="driver-trips-subtitle">
            Start or complete trips for all passengers at once
          </p>
        </div>
        <div
          className={`driver-location-badge ${isSharingLocation ? "active" : ""}`}
        >
          {isSharingLocation ? "Sharing Location" : "Location Off"}
        </div>
      </div>

      {/* Stats Row */}
      <div className="driver-trips-stats">
        <div className="driver-stat-card">
          <span className="driver-stat-value">{stats.todayTrips}</span>
          <span className="driver-stat-label">Today</span>
        </div>
        <div className="driver-stat-card">
          <span className="driver-stat-value">{stats.inProgressTrips}</span>
          <span className="driver-stat-label">In Progress</span>
        </div>
        <div className="driver-stat-card">
          <span className="driver-stat-value">{stats.completedToday}</span>
          <span className="driver-stat-label">Completed</span>
        </div>
        <div className="driver-stat-card">
          <span className="driver-stat-value">{stats.totalTrips}</span>
          <span className="driver-stat-label">Total</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="driver-filter-tabs">
        <button
          className={`driver-filter-btn ${filter === "today" ? "active" : ""}`}
          onClick={() => setFilter("today")}
        >
          Today ({stats.todayTrips})
        </button>
        <button
          className={`driver-filter-btn ${filter === "upcoming" ? "active" : ""}`}
          onClick={() => setFilter("upcoming")}
        >
          Upcoming
        </button>
        <button
          className={`driver-filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All Trips
        </button>
        <button
          className="driver-refresh-btn"
          onClick={fetchTrips}
          title="Refresh trips"
        >
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="driver-trips-error">
          <p>{error}</p>
          <button onClick={fetchTrips}>Try Again</button>
        </div>
      )}

      {/* Trips List */}
      {trips.length === 0 && !error ? (
        <div className="driver-trips-empty">
          <div className="empty-icon">No trips</div>
          <h3>No {filter === "today" ? "trips for today" : "trips"} found</h3>
          <p>Check back later for scheduled trips</p>
        </div>
      ) : (
        <div className="driver-trips-list">
          {trips.map((trip) => {
            const dateInfo = formatDate(trip.tripDate);
            const tripIsToday = isToday(trip.tripDate);
            const tripStatus = trip.status || "Scheduled";
            const statusClass = getStatusClass(tripStatus);
            const isExpanded = expandedTrips.has(trip._id);

            return (
              <div
                key={trip._id}
                className={`driver-trip-card ${tripIsToday ? "today-highlight" : ""}`}
              >
                {/* Trip Header */}
                <div className="driver-trip-header">
                  <div className="trip-date-section">
                    <div className="trip-date-block">
                      <span className="trip-day">{dateInfo.day}</span>
                      <span className="trip-date-num">{dateInfo.dateNum}</span>
                      <span className="trip-month">{dateInfo.month}</span>
                    </div>
                  </div>

                  <div className="trip-info-section">
                    <div className="trip-route">
                      <span className="trip-from">{trip.fromLocation}</span>
                      <span className="trip-arrow">--&gt;</span>
                      <span className="trip-to">{trip.toLocation}</span>
                    </div>
                    <div className="trip-meta">
                      <span className="trip-time">{trip.startTime}</span>
                      <span className="trip-type">
                        {trip.tripType || "ONE WAY"}
                      </span>
                      <span className="trip-seats">
                        {trip.bookedSeats}/{trip.totalSeats} seats
                      </span>
                    </div>
                  </div>

                  <div className="trip-status-section">
                    <span className={`trip-status-pill ${statusClass}`}>
                      {getStatusLabel(tripStatus)}
                    </span>
                  </div>
                </div>

                {/* Passengers Summary */}
                <div
                  className="trip-passengers-summary"
                  onClick={() => togglePassengerList(trip._id)}
                >
                  <div className="passengers-count">
                    <span className="count-number">
                      {trip.passengerCount || 0}
                    </span>
                    <span className="count-label">
                      {trip.passengerCount === 1 ? "Passenger" : "Passengers"}
                    </span>
                  </div>
                  <div className="passengers-preview">
                    {trip.passengers &&
                      trip.passengers.slice(0, 3).map((passenger, idx) => (
                        <div
                          key={passenger._id || idx}
                          className="passenger-avatar"
                        >
                          {passenger.profileImage ? (
                            <img
                              src={passenger.profileImage}
                              alt={passenger.fullName}
                            />
                          ) : (
                            <span>{passenger.fullName?.charAt(0) || "?"}</span>
                          )}
                        </div>
                      ))}
                    {trip.passengerCount > 3 && (
                      <div className="passenger-avatar more">
                        +{trip.passengerCount - 3}
                      </div>
                    )}
                  </div>
                  <button className="expand-btn">
                    {isExpanded ? "Hide" : "View All"}
                  </button>
                </div>

                {/* Expanded Passenger List */}
                {isExpanded && (
                  <div className="trip-passengers-list">
                    {!trip.passengers || trip.passengers.length === 0 ? (
                      <div className="no-passengers">
                        No passengers booked yet
                      </div>
                    ) : (
                      trip.passengers.map((passenger, idx) => (
                        <div
                          key={passenger._id || idx}
                          className="passenger-item"
                        >
                          <div className="passenger-avatar-large">
                            {passenger.profileImage ? (
                              <img
                                src={passenger.profileImage}
                                alt={passenger.fullName}
                              />
                            ) : (
                              <span>
                                {passenger.fullName?.charAt(0) || "?"}
                              </span>
                            )}
                          </div>
                          <div className="passenger-info">
                            <span className="passenger-name">
                              {passenger.fullName}
                            </span>
                            <span className="passenger-contact">
                              {passenger.phone ||
                                passenger.email ||
                                "No contact"}
                            </span>
                          </div>
                          <div className="passenger-booking-type">
                            <span
                              className={`booking-type-badge ${passenger.bookingType === "Monthly Pass" ? "monthly" : "onetime"}`}
                            >
                              {passenger.bookingType}
                            </span>
                            <span className="seats-info">
                              {passenger.seats} seat(s)
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Action Buttons - Only show for today's trips */}
                {tripIsToday && (
                  <div className="trip-actions">
                    {tripStatus === "Scheduled" && (
                      <button
                        className="btn-start-trip"
                        onClick={() => handleStartTrip(trip._id)}
                        disabled={actionLoading === trip._id}
                      >
                        {actionLoading === trip._id
                          ? "Starting..."
                          : `Start Trip (${trip.passengerCount || 0} passengers)`}
                      </button>
                    )}
                    {tripStatus === "In Progress" && (
                      <button
                        className="btn-complete-trip"
                        onClick={() => handleCompleteTrip(trip._id)}
                        disabled={actionLoading === trip._id}
                      >
                        {actionLoading === trip._id
                          ? "Completing..."
                          : `Complete Trip (${trip.passengerCount || 0} passengers)`}
                      </button>
                    )}
                    {tripStatus === "Completed" && (
                      <div className="trip-completed-info">
                        Trip completed at{" "}
                        {trip.actualEndTime
                          ? new Date(trip.actualEndTime).toLocaleTimeString()
                          : "N/A"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DriverDailyTrips;
