import React, { useState, useEffect, useCallback } from "react";
import api from "../../utils/api";
import { notify } from "../../utils/toast";
import "./DailyTripsInBooking.css";

const DailyTripsInBooking = ({
  booking,
  userRole,
  onTripStatusChange,
  currentUserId,
  currentDriverId,
  onTripStart,
  onTripComplete,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
}) => {
  const [dailyTrips, setDailyTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("today"); // "today", "upcoming", "all"
  const [actionLoading, setActionLoading] = useState(null);
  // Use controlled state if provided, otherwise use local state (for backward compatibility)
  const [localIsExpanded, setLocalIsExpanded] = useState(false);
  const isExpanded =
    controlledIsExpanded !== undefined ? controlledIsExpanded : localIsExpanded;

  // Unique identifier for this component instance
  const bookingId = booking?._id || booking?.bookingId;

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalIsExpanded(!localIsExpanded);
    }
  };

  const fetchDailyTrips = useCallback(async () => {
    try {
      setLoading(true);
      const bookingId = booking?.bookingId || booking?._id;
      const response = await api.get(`/bookings/${bookingId}/daily-trips`);

      if (response.data.success) {
        const trips = Array.isArray(response.data.data)
          ? response.data.data
          : [];
        setDailyTrips(trips);
      }
    } catch (error) {
      console.error(
        "[DailyTrips] Error fetching trips:",
        error?.response?.data || error.message,
      );
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
      console.error(
        "[DailyTrips] Error starting trip:",
        error?.response?.data || error.message,
      );
      notify(error?.response?.data?.message || "Failed to start trip");
    } finally {
      setActionLoading(null);
    }
  };

  // Complete a specific trip (changes status from In Progress -> Completed)
  const handleCompleteTrip = async (tripId) => {
    try {
      setActionLoading(tripId);
      await api.put(`/b2c-daily-trips/status/${tripId}`, {
        status: "Completed",
      });
      if (onTripStatusChange) onTripStatusChange("COMPLETED", tripId);
      if (onTripComplete) onTripComplete(tripId);
      await fetchDailyTrips();
    } catch (error) {
      console.error(
        "[DailyTrips] Error completing trip:",
        error?.response?.data || error.message,
      );
      notify(error?.response?.data?.message || "Failed to complete trip");
    } finally {
      setActionLoading(null);
    }
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

  // Only show Start/Complete buttons if current user is the actual driver for this booking
  const isDriverRole = (() => {
    if (userRole === "B2C_PARTNER" && booking?.isSelfDriver) return true;
    if (userRole === "B2C_PARTNER_DRIVER") {
      const bookingDriverId = booking?.assignedDriverId || booking?.driverId;
      if (!bookingDriverId) return false;
      const driverIdStr = bookingDriverId.toString();
      if (currentUserId && driverIdStr === currentUserId.toString())
        return true;
      if (currentDriverId && driverIdStr === currentDriverId.toString())
        return true;
      return false;
    }
    return false;
  })();

  // Filter trips
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );

  const filteredTrips = dailyTrips.filter((trip) => {
    const tripDate = new Date(trip.tripDate);
    if (filter === "today") {
      return tripDate >= todayStart && tripDate < todayEnd;
    }
    if (filter === "upcoming") {
      // "Upcoming" means trips from tomorrow onwards (exclude today's trips,
      // which have their own "Today" tab). This keeps the counts consistent:
      // All = Today + Upcoming + Past.
      return tripDate >= todayEnd;
    }
    return true; // "all"
  });

  // Count stats
  const todayTrips = dailyTrips.filter((t) => {
    const d = new Date(t.tripDate);
    return d >= todayStart && d < todayEnd;
  });
  // Upcoming excludes today (starts from tomorrow) so it never equals All
  const upcomingTrips = dailyTrips.filter(
    (t) => new Date(t.tripDate) >= todayEnd,
  );
  const completedTrips = dailyTrips.filter(
    (t) => t.status === "Completed" || t.tripStatus === "Completed",
  );
  const inProgressTrips = dailyTrips.filter(
    (t) => t.status === "In Progress" || t.tripStatus === "In Progress",
  );

  if (loading && !dailyTrips.length) {
    return null; // Don't show loading state initially
  }

  if (!dailyTrips || dailyTrips.length === 0) {
    return null; // Don't show anything if no trips
  }

  return (
    <div className="daily-trips-wrapper">
      {/* Collapsible Toggle Header */}
      <div className="daily-trips-toggle" onClick={handleToggleExpand}>
        <div className="toggle-left">
          <svg
            width="16"
            height="16"
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
          <span className="toggle-text">Daily Trips</span>
          {inProgressTrips.length > 0 && (
            <span className="badge-live">{inProgressTrips.length} Active</span>
          )}
          {todayTrips.length > 0 && !inProgressTrips.length && (
            <span className="badge-today">{todayTrips.length} Today</span>
          )}
        </div>
        <div className="toggle-right">
          <span className="trips-count">{dailyTrips.length} trips</span>
          <svg
            className={`chevron-icon ${isExpanded ? "expanded" : ""}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expandable Content */}
      <div className={`daily-trips-content ${isExpanded ? "expanded" : ""}`}>
        <div className="trips-inner-content">
          {/* Filter Pills */}
          <div className="filter-pills">
            <button
              className={`filter-pill ${filter === "today" ? "active" : ""}`}
              onClick={() => setFilter("today")}
            >
              Today ({todayTrips.length})
            </button>
            <button
              className={`filter-pill ${filter === "upcoming" ? "active" : ""}`}
              onClick={() => setFilter("upcoming")}
            >
              Upcoming ({upcomingTrips.length})
            </button>
            <button
              className={`filter-pill ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All ({dailyTrips.length})
            </button>
            <button
              className="refresh-btn"
              onClick={(e) => {
                e.stopPropagation();
                fetchDailyTrips();
              }}
              title="Refresh trips"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>

          {/* Compact Trip List */}
          {filteredTrips.length === 0 ? (
            <div className="no-trips-msg">
              No{" "}
              {filter === "today"
                ? "trips today"
                : filter === "upcoming"
                  ? "upcoming trips"
                  : "trips"}
            </div>
          ) : (
            <div className="compact-trips-list">
              {filteredTrips.slice(0, 5).map((trip) => {
                const tripDate = new Date(trip.tripDate);
                const isToday = tripDate >= todayStart && tripDate < todayEnd;
                const tripStatus =
                  trip.status || trip.tripStatus || "Scheduled";
                const statusClass = getStatusClass(tripStatus);

                return (
                  <div
                    key={trip._id}
                    className={`compact-trip-item ${isToday ? "today" : ""}`}
                  >
                    <div className="trip-date-mini">
                      <span className="date-num">{tripDate.getDate()}</span>
                      <span className="date-month">
                        {tripDate.toLocaleDateString("en-US", {
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div className="trip-info-mini">
                      <div className="route-mini">
                        <span className="from">
                          {trip.fromLocation || booking.pickupLocation}
                        </span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                        <span className="to">
                          {trip.toLocation || booking.dropoffLocation}
                        </span>
                      </div>
                      <div className="trip-time-mini">
                        {trip.startTime || trip.pickupTime || "--:--"} •{" "}
                        {trip.tripType || "One Way"}
                      </div>
                    </div>
                    <div className="trip-status-mini">
                      <span className={`status-dot ${statusClass}`}>
                        {getStatusLabel(tripStatus)}
                      </span>
                      {isDriverRole && isToday && (
                        <div className="mini-actions">
                          {tripStatus === "Scheduled" && (
                            <button
                              className="mini-start-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartTrip(trip._id);
                              }}
                              disabled={actionLoading === trip._id}
                            >
                              {actionLoading === trip._id ? "..." : "Start"}
                            </button>
                          )}
                          {tripStatus === "In Progress" && (
                            <button
                              className="mini-complete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteTrip(trip._id);
                              }}
                              disabled={actionLoading === trip._id}
                            >
                              {actionLoading === trip._id ? "..." : "Done"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredTrips.length > 5 && (
                <div className="more-trips-msg">
                  +{filteredTrips.length - 5} more trips
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyTripsInBooking;
