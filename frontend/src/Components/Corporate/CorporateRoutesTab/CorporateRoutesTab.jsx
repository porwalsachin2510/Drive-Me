/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import "./corporateroutestab.css";

export default function CorporateRoutesTab() {
  const [routesData, setRoutesData] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list or details

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/corporate/routes", {
        params: { status: statusFilter || undefined },
      });
      if (response.data.success) {
        setRoutesData(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching routes:", err);
      setError("Failed to load routes data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchRouteDetails = async (routeId) => {
    try {
      setDetailsLoading(true);
      const response = await api.get(`/corporate/routes/${routeId}`);
      if (response.data.success) {
        setRouteDetails(response.data.data);
        setViewMode("details");
      }
    } catch (err) {
      console.error("Error fetching route details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleRouteClick = (route) => {
    setSelectedRoute(route);
    fetchRouteDetails(route._id);
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedRoute(null);
    setRouteDetails(null);
  };

  const formatTime = (time) => {
    if (!time) return "N/A";
    return time;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadgeClass = (status) => {
    const statusLower = (status || "").toLowerCase();
    if (statusLower === "active" || statusLower === "completed")
      return "active";
    if (statusLower === "inactive" || statusLower === "cancelled")
      return "inactive";
    if (statusLower === "scheduled") return "scheduled";
    if (statusLower === "in_progress" || statusLower === "in-progress")
      return "in-progress";
    return "pending";
  };

  const getDayName = (day) => {
    const dayMap = {
      MON: "Monday",
      TUE: "Tuesday",
      WED: "Wednesday",
      THU: "Thursday",
      FRI: "Friday",
      SAT: "Saturday",
      SUN: "Sunday",
    };
    return dayMap[day] || day;
  };

  if (loading) {
    return (
      <div className="corp-routes">
        <div className="corp-routes-loading">Loading routes information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="corp-routes">
        <div className="corp-routes-error">{error}</div>
      </div>
    );
  }

  // Route Details View
  if (viewMode === "details" && routeDetails) {
    return (
      <div className="corp-routes">
        <div className="corp-routes-details-header">
          <button className="corp-routes-back-btn" onClick={handleBackToList}>
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
            Back to Routes
          </button>
          <div className="corp-routes-details-title">
            <h2>
              {routeDetails.route?.fromLocation} to{" "}
              {routeDetails.route?.toLocation}
            </h2>
            <span
              className={`corp-routes-status corp-routes-status-${getStatusBadgeClass(routeDetails.route?.status)}`}
            >
              {routeDetails.route?.status || "Active"}
            </span>
          </div>
        </div>

        {/* Route Info Cards */}
        <div className="corp-routes-info-grid">
          <div className="corp-routes-info-card">
            <div className="corp-routes-info-label">Distance</div>
            <div className="corp-routes-info-value">
              {routeDetails.route?.totalDistance || 0} km
            </div>
          </div>
          <div className="corp-routes-info-card">
            <div className="corp-routes-info-label">Duration</div>
            <div className="corp-routes-info-value">
              {routeDetails.route?.estimatedDuration || "N/A"}
            </div>
          </div>
          <div className="corp-routes-info-card">
            <div className="corp-routes-info-label">Total Seats</div>
            <div className="corp-routes-info-value">
              {routeDetails.route?.totalSeats || 0}
            </div>
          </div>
          <div className="corp-routes-info-card">
            <div className="corp-routes-info-label">Available Seats</div>
            <div className="corp-routes-info-value">
              {routeDetails.route?.availableSeats || 0}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="corp-routes-stats-section">
          <h3 className="corp-routes-section-title">Route Statistics</h3>
          <div className="corp-routes-stats-grid">
            <div className="corp-routes-stat-box">
              <div className="corp-routes-stat-value">
                {routeDetails.statistics?.totalTripsThisMonth || 0}
              </div>
              <div className="corp-routes-stat-label">Trips This Month</div>
            </div>
            <div className="corp-routes-stat-box">
              <div className="corp-routes-stat-value corp-routes-green">
                {routeDetails.statistics?.completedTripsThisMonth || 0}
              </div>
              <div className="corp-routes-stat-label">Completed</div>
            </div>
            <div className="corp-routes-stat-box">
              <div className="corp-routes-stat-value corp-routes-blue">
                {routeDetails.statistics?.completionRate || 0}%
              </div>
              <div className="corp-routes-stat-label">Completion Rate</div>
            </div>
            <div className="corp-routes-stat-box">
              <div className="corp-routes-stat-value">
                {routeDetails.statistics?.upcomingTripsCount || 0}
              </div>
              <div className="corp-routes-stat-label">Upcoming Trips</div>
            </div>
          </div>
        </div>

        {/* Available Days */}
        <div className="corp-routes-days-section">
          <h3 className="corp-routes-section-title">Operating Days</h3>
          <div className="corp-routes-days-grid">
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
              <div
                key={day}
                className={`corp-routes-day-badge ${routeDetails.route?.availableDays?.includes(day) ? "active" : "inactive"}`}
              >
                {getDayName(day).slice(0, 3)}
              </div>
            ))}
          </div>
        </div>

        {/* Schedules */}
        {routeDetails.schedules?.length > 0 && (
          <div className="corp-routes-section">
            <h3 className="corp-routes-section-title">
              Route Schedules ({routeDetails.schedules.length})
            </h3>
            <div className="corp-routes-schedules-grid">
              {routeDetails.schedules.map((schedule, idx) => (
                <div
                  key={schedule._id || idx}
                  className="corp-routes-schedule-card"
                >
                  <div className="corp-routes-schedule-header">
                    <span className="corp-routes-schedule-name">
                      {schedule.scheduleName || `Schedule ${idx + 1}`}
                    </span>
                    <span
                      className={`corp-routes-status corp-routes-status-${schedule.isActive ? "active" : "inactive"}`}
                    >
                      {schedule.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {schedule.tripTimes?.map((tripTime, tidx) => (
                    <div key={tidx} className="corp-routes-trip-time">
                      <div className="corp-routes-trip-number">
                        Trip {tripTime.tripNumber}
                      </div>
                      <div className="corp-routes-trip-type">
                        {tripTime.tripType}
                      </div>
                      <div className="corp-routes-trip-times">
                        <span>
                          Departure: {formatTime(tripTime.departureTime)}
                        </span>
                        {tripTime.returnDepartureTime && (
                          <span>
                            Return: {formatTime(tripTime.returnDepartureTime)}
                          </span>
                        )}
                      </div>
                      {tripTime.outboundStopPoints?.length > 0 && (
                        <div className="corp-routes-stops">
                          <div className="corp-routes-stops-label">
                            Stop Points:
                          </div>
                          {tripTime.outboundStopPoints.map((stop, sidx) => (
                            <div key={sidx} className="corp-routes-stop">
                              <span className="corp-routes-stop-time">
                                {stop.time}
                              </span>
                              <span className="corp-routes-stop-location">
                                {stop.location}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="corp-routes-schedule-meta">
                    <span>Start: {formatDate(schedule.startDate)}</span>
                    {schedule.endDate && (
                      <span>End: {formatDate(schedule.endDate)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Trips */}
        {routeDetails.upcomingTrips?.length > 0 && (
          <div className="corp-routes-section">
            <h3 className="corp-routes-section-title">
              Upcoming Trips (Next 7 Days)
            </h3>
            <div className="corp-routes-table-wrap">
              <table className="corp-routes-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Direction</th>
                    <th>Passengers</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {routeDetails.upcomingTrips.map((trip) => (
                    <tr key={trip._id}>
                      <td>{formatDate(trip.tripDate)}</td>
                      <td>{formatTime(trip.startTime)}</td>
                      <td>{trip.tripType?.replace("_", " ") || "One Way"}</td>
                      <td>{trip.direction || "Forward"}</td>
                      <td>
                        {trip.bookedSeats || 0} / {trip.totalSeats || 0}
                      </td>
                      <td>
                        <span
                          className={`corp-routes-status corp-routes-status-${getStatusBadgeClass(trip.status)}`}
                        >
                          {trip.status || "Scheduled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Contract & Vehicle Info */}
        <div className="corp-routes-meta-section">
          <div className="corp-routes-meta-card">
            <h4>Contract Information</h4>
            {routeDetails.route?.contract ? (
              <>
                <div className="corp-routes-meta-row">
                  <span>Contract #:</span>
                  <span className="corp-routes-contract-num">
                    {routeDetails.route.contract.contractNumber || "N/A"}
                  </span>
                </div>
                <div className="corp-routes-meta-row">
                  <span>Status:</span>
                  <span
                    className={`corp-routes-status corp-routes-status-${getStatusBadgeClass(routeDetails.route.contract.status)}`}
                  >
                    {routeDetails.route.contract.status || "Active"}
                  </span>
                </div>
              </>
            ) : (
              <div className="corp-routes-empty-small">No contract linked</div>
            )}
          </div>
          <div className="corp-routes-meta-card">
            <h4>Assigned Vehicle</h4>
            {routeDetails.route?.vehicle ? (
              <>
                <div className="corp-routes-meta-row">
                  <span>Vehicle:</span>
                  <span>{routeDetails.route.vehicle.vehicleName || "N/A"}</span>
                </div>
                <div className="corp-routes-meta-row">
                  <span>Registration:</span>
                  <span>
                    {routeDetails.route.vehicle.registrationNumber || "N/A"}
                  </span>
                </div>
                <div className="corp-routes-meta-row">
                  <span>Category:</span>
                  <span>
                    {routeDetails.route.vehicle.vehicleCategory || "N/A"}
                  </span>
                </div>
              </>
            ) : (
              <div className="corp-routes-empty-small">No vehicle assigned</div>
            )}
          </div>
          <div className="corp-routes-meta-card">
            <h4>Assigned Driver</h4>
            {routeDetails.route?.driver ? (
              <>
                <div className="corp-routes-meta-row">
                  <span>Name:</span>
                  <span>{routeDetails.route.driver.name || "N/A"}</span>
                </div>
                <div className="corp-routes-meta-row">
                  <span>Phone:</span>
                  <span>{routeDetails.route.driver.phone || "N/A"}</span>
                </div>
              </>
            ) : (
              <div className="corp-routes-empty-small">No driver assigned</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Routes List View
  return (
    <div className="corp-routes">
      <div className="corp-routes-header">
        <h2 className="corp-routes-title">Active Routes</h2>
        <div className="corp-routes-filters">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="corp-routes-select"
          >
            <option value="">All Routes</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {routesData?.summary && (
        <div className="corp-routes-summary">
          <div className="corp-routes-card">
            <div className="corp-routes-card-icon corp-routes-blue-bg">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
            <div className="corp-routes-card-content">
              <div className="corp-routes-card-label">Total Routes</div>
              <div className="corp-routes-card-value">
                {routesData.summary.totalRoutes || 0}
              </div>
            </div>
          </div>
          <div className="corp-routes-card">
            <div className="corp-routes-card-icon corp-routes-green-bg">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="corp-routes-card-content">
              <div className="corp-routes-card-label">Active Routes</div>
              <div className="corp-routes-card-value">
                {routesData.summary.activeRoutes || 0}
              </div>
            </div>
          </div>
          <div className="corp-routes-card">
            <div className="corp-routes-card-icon corp-routes-orange-bg">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="corp-routes-card-content">
              <div className="corp-routes-card-label">Today&apos;s Trips</div>
              <div className="corp-routes-card-value">
                {routesData.summary.todayTotalTrips || 0}
              </div>
            </div>
          </div>
          <div className="corp-routes-card">
            <div className="corp-routes-card-icon corp-routes-purple-bg">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="corp-routes-card-content">
              <div className="corp-routes-card-label">In Progress</div>
              <div className="corp-routes-card-value">
                {routesData.summary.todayInProgressTrips || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Routes List */}
      {!routesData?.routes || routesData.routes.length === 0 ? (
        <div className="corp-routes-empty">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ccc"
            strokeWidth="1.5"
          >
            <path d="M9 18l6-6-6-6" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <p>No routes found</p>
          <span>
            Routes will appear here once they are created from your active
            contracts.
          </span>
        </div>
      ) : (
        <div className="corp-routes-list">
          {routesData.routes.map((route) => (
            <div
              key={route._id}
              className="corp-routes-list-item"
              onClick={() => handleRouteClick(route)}
            >
              <div className="corp-routes-list-main">
                <div className="corp-routes-route-path">
                  <span className="corp-routes-from">{route.fromLocation}</span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#666"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span className="corp-routes-to">{route.toLocation}</span>
                </div>
                <span
                  className={`corp-routes-status corp-routes-status-${getStatusBadgeClass(route.status)}`}
                >
                  {route.status || "Active"}
                </span>
              </div>

              <div className="corp-routes-list-details">
                <div className="corp-routes-detail">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 3h18v18H3zM12 8v8M8 12h8" />
                  </svg>
                  <span>{route.totalDistance || 0} km</span>
                </div>
                <div className="corp-routes-detail">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{route.estimatedDuration || "N/A"}</span>
                </div>
                <div className="corp-routes-detail">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>{route.totalSeats || 0} seats</span>
                </div>
                <div className="corp-routes-detail">
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
                  <span>{route.schedules?.length || 0} schedules</span>
                </div>
              </div>

              {/* Today's Trip Summary */}
              {route.statistics && (
                <div className="corp-routes-list-stats">
                  <span className="corp-routes-stat-item">
                    <span className="corp-routes-stat-dot scheduled"></span>
                    {route.statistics.scheduledTripsToday || 0} Scheduled
                  </span>
                  <span className="corp-routes-stat-item">
                    <span className="corp-routes-stat-dot in-progress"></span>
                    {route.statistics.inProgressTripsToday || 0} In Progress
                  </span>
                  <span className="corp-routes-stat-item">
                    <span className="corp-routes-stat-dot completed"></span>
                    {route.statistics.completedTripsToday || 0} Completed
                  </span>
                  <span className="corp-routes-stat-item">
                    <span className="corp-routes-stat-dot passengers"></span>
                    {route.statistics.totalPassengersToday || 0} Passengers
                    Today
                  </span>
                </div>
              )}

              {/* Operating Days */}
              <div className="corp-routes-list-days">
                {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(
                  (day) => (
                    <span
                      key={day}
                      className={`corp-routes-day-mini ${route.availableDays?.includes(day) ? "active" : ""}`}
                    >
                      {day.charAt(0)}
                    </span>
                  ),
                )}
              </div>

              <div className="corp-routes-list-arrow">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#999"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
