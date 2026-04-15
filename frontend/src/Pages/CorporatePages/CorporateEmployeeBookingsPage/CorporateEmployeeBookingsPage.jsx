"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getCorporateOwnerBookings } from "../../../Redux/slices/bookingSlice";
import "./corporateemployeebookingspage.css";

const CorporateEmployeeBookingsPage = () => {
  const dispatch = useDispatch();
  const { corporateOwnerBookings, loading, error } = useSelector(
    (state) => state.booking,
  );
  const auth = useSelector((state) => state.auth);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [expandedBookings, setExpandedBookings] = useState({});

  useEffect(() => {
    if (auth.user?.role === "CORPORATE") {
      dispatch(
        getCorporateOwnerBookings({
          status: filterStatus !== "all" ? filterStatus : undefined,
          date: filterDate || undefined,
        }),
      );
    }
  }, [dispatch, auth.user, filterStatus, filterDate]);

  const toggleBookingExpand = (bookingId) => {
    setExpandedBookings((prev) => ({
      ...prev,
      [bookingId]: !prev[bookingId],
    }));
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      CONFIRMED: { color: "#28a745", label: "Confirmed" },
      SCHEDULED: { color: "#007bff", label: "Scheduled" },
      IN_PROGRESS: { color: "#fd7e14", label: "In Progress" },
      COMPLETED: { color: "#17a2b8", label: "Completed" },
      CANCELLED: { color: "#dc3545", label: "Cancelled" },
    };
    return statusConfig[status] || { color: "#6c757d", label: status };
  };

  const getTripStatusBadge = (status) => {
    const statusConfig = {
      SCHEDULED: { color: "#007bff", label: "Scheduled" },
      IN_PROGRESS: { color: "#fd7e14", label: "In Progress" },
      COMPLETED: { color: "#28a745", label: "Completed" },
      CANCELLED: { color: "#dc3545", label: "Cancelled" },
    };
    return (
      statusConfig[status] || { color: "#6c757d", label: status || "Scheduled" }
    );
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (time) => {
    if (!time) return "--:--";
    if (typeof time === "string" && time.includes(":")) return time;
    return new Date(time).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Group bookings by employee
  const groupedByEmployee = corporateOwnerBookings.reduce((acc, booking) => {
    const empKey =
      booking.passengerId?._id || booking.employeeName || "unknown";
    if (!acc[empKey]) {
      acc[empKey] = {
        employeeName: booking.employeeName || "Unknown Employee",
        employeeEmail: booking.employeeEmail || "",
        employeePhone: booking.employeePhone || "",
        employeeIdNumber: booking.employeeIdNumber || "",
        department: booking.department || "",
        bookings: [],
      };
    }
    acc[empKey].bookings.push(booking);
    return acc;
  }, {});

  const totalEmployees = Object.keys(groupedByEmployee).length;
  const totalBookings = corporateOwnerBookings.length;

  return (
    <div className="drivemego-cebp-corporate-bookings-page">
      <div className="drivemego-cebp-bookings-container">
        <div className="drivemego-cebp-bookings-header">
          <div className="drivemego-cebp-header-content">
            <h1>Employee Bookings</h1>
            <p>View all bookings made by your employees</p>
          </div>
          <div className="drivemego-cebp-header-stats">
            <div className="drivemego-cebp-stat-card">
              <span className="drivemego-cebp-stat-value">{totalBookings}</span>
              <span className="drivemego-cebp-stat-label">Total Bookings</span>
            </div>
            <div className="drivemego-cebp-stat-card">
              <span className="drivemego-cebp-stat-value">
                {totalEmployees}
              </span>
              <span className="drivemego-cebp-stat-label">Total Employees</span>
            </div>
          </div>
        </div>

        <div className="drivemego-cebp-filters-section">
          <div className="drivemego-cebp-filter-group">
            <label>Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="drivemego-cebp-filter-select"
            >
              <option value="all">All Bookings</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="drivemego-cebp-filter-group">
            <label>Filter by Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="drivemego-cebp-filter-input"
            />
          </div>

          {filterDate && (
            <button
              className="drivemego-cebp-clear-filter-btn"
              onClick={() => setFilterDate("")}
            >
              Clear Date
            </button>
          )}
        </div>

        {loading ? (
          <div className="drivemego-cebp-loading-state">
            <div className="drivemego-cebp-spinner"></div>
            <p>Loading bookings...</p>
          </div>
        ) : error ? (
          <div className="drivemego-cebp-empty-state">
            <div className="drivemego-cebp-empty-icon">!</div>
            <p>Error loading bookings</p>
            <p className="drivemego-cebp-empty-subtitle">{error}</p>
          </div>
        ) : corporateOwnerBookings.length === 0 ? (
          <div className="drivemego-cebp-empty-state">
            <div className="drivemego-cebp-empty-icon">📋</div>
            <p>No employee bookings found</p>
            <p className="drivemego-cebp-empty-subtitle">
              Employee bookings will appear here when they book rides
            </p>
          </div>
        ) : (
          <div className="drivemego-cebp-employee-bookings-list">
            {Object.entries(groupedByEmployee).map(([empKey, empData]) => (
              <div key={empKey} className="drivemego-cebp-employee-section">
                <div className="drivemego-cebp-employee-header-card">
                  <div className="drivemego-cebp-employee-avatar">
                    {empData.employeeName.charAt(0).toUpperCase()}
                  </div>
                  <div className="drivemego-cebp-employee-info">
                    <h3>{empData.employeeName}</h3>
                    <div className="drivemego-cebp-employee-meta">
                      {empData.employeeIdNumber && (
                        <span className="drivemego-cebp-meta-tag">
                          ID: {empData.employeeIdNumber}
                        </span>
                      )}
                      {empData.department && (
                        <span className="drivemego-cebp-meta-tag">
                          {empData.department}
                        </span>
                      )}
                      {empData.employeeEmail && (
                        <span className="drivemego-cebp-meta-tag">
                          {empData.employeeEmail}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="drivemego-cebp-employee-booking-count">
                    <span className="drivemego-cebp-count-value">
                      {empData.bookings.length}
                    </span>
                    <span className="drivemego-cebp-count-label">
                      Booking{empData.bookings.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="drivemego-cebp-employee-bookings">
                  {empData.bookings.map((booking) => {
                    const statusConfig = getStatusBadge(booking.bookingStatus);
                    const isExpanded = expandedBookings[booking._id];
                    const hasTrips = booking.trips && booking.trips.length > 0;

                    return (
                      <div
                        key={booking._id}
                        className="drivemego-cebp-booking-card-wrapper"
                      >
                        <div
                          className={`drivemego-cebp-booking-card ${isExpanded ? "drivemego-cebp-expanded" : ""}`}
                          onClick={() =>
                            hasTrips && toggleBookingExpand(booking._id)
                          }
                        >
                          <div className="drivemego-cebp-booking-card-header">
                            <div className="drivemego-cebp-booking-info">
                              <span className="drivemego-cebp-booking-id">
                                Booking #{booking._id?.slice(-8)}
                              </span>
                              <span
                                className="drivemego-cebp-status-badge"
                                style={{ backgroundColor: statusConfig.color }}
                              >
                                {statusConfig.label}
                              </span>
                              {booking.isMonthlyPass && (
                                <span className="drivemego-cebp-pass-badge">
                                  Monthly Pass
                                </span>
                              )}
                              {booking.bookingType === "ROUND_TRIP" && (
                                <span className="drivemego-cebp-trip-type-badge">
                                  Round Trip
                                </span>
                              )}
                            </div>
                            <div className="drivemego-cebp-booking-date">
                              <span>
                                Created: {formatDate(booking.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="drivemego-cebp-booking-card-body">
                            <div className="drivemego-cebp-route-section">
                              <div className="drivemego-cebp-route-visual">
                                <div className="drivemego-cebp-route-point">
                                  <span className="drivemego-cebp-point-marker drivemego-cebp-pickup"></span>
                                  <div className="drivemego-cebp-point-details">
                                    <span className="drivemego-cebp-point-label">
                                      Pickup
                                    </span>
                                    <span className="drivemego-cebp-point-location">
                                      {booking.pickupLocation || "N/A"}
                                    </span>
                                  </div>
                                </div>
                                <div className="drivemego-cebp-route-connector">
                                  <div className="drivemego-cebp-connector-line"></div>
                                </div>
                                <div className="drivemego-cebp-route-point">
                                  <span className="drivemego-cebp-point-marker dropoff"></span>
                                  <div className="drivemego-cebp-point-details">
                                    <span className="drivemego-cebp-point-label">
                                      Drop-off
                                    </span>
                                    <span className="drivemego-cebp-point-location">
                                      {booking.dropoffLocation || "N/A"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="drivemego-cebp-booking-details-grid">
                              <div className="drivemego-cebp-detail-item">
                                <span className="drivemego-cebp-detail-icon">
                                  📅
                                </span>
                                <div className="drivemego-cebp-detail-content">
                                  <span className="drivemego-cebp-detail-label">
                                    Travel Date
                                  </span>
                                  <span className="drivemego-cebp-detail-value">
                                    {formatDate(booking.travelDate)}
                                  </span>
                                </div>
                              </div>
                              <div className="drivemego-cebp-detail-item">
                                <span className="drivemego-cebp-detail-icon">
                                  💺
                                </span>
                                <div className="drivemego-cebp-detail-content">
                                  <span className="drivemego-cebp-detail-label">
                                    Seats
                                  </span>
                                  <span className="drivemego-cebp-detail-value">
                                    {booking.numberOfSeats || 1}
                                  </span>
                                </div>
                              </div>
                              {booking.driverName &&
                                booking.driverName !== "Not Assigned" && (
                                  <div className="drivemego-cebp-detail-item">
                                    <span className="drivemego-cebp-detail-icon">
                                      🚗
                                    </span>
                                    <div className="drivemego-cebp-detail-content">
                                      <span className="drivemego-cebp-detail-label">
                                        Driver
                                      </span>
                                      <span className="drivemego-cebp-detail-value">
                                        {booking.driverName}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              {booking.vehiclePlate && (
                                <div className="drivemego-cebp-detail-item">
                                  <span className="drivemego-cebp-detail-icon">
                                    🚌
                                  </span>
                                  <div className="drivemego-cebp-detail-content">
                                    <span className="drivemego-cebp-detail-label">
                                      Vehicle
                                    </span>
                                    <span className="drivemego-cebp-detail-value">
                                      {booking.vehicleModel
                                        ? `${booking.vehicleModel} - `
                                        : ""}
                                      {booking.vehiclePlate}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {booking.isMonthlyPass && (
                                <div className="drivemego-cebp-detail-item">
                                  <span className="drivemego-cebp-detail-icon">
                                    📆
                                  </span>
                                  <div className="drivemego-cebp-detail-content">
                                    <span className="drivemego-cebp-detail-label">
                                      Pass Duration
                                    </span>
                                    <span className="drivemego-cebp-detail-value">
                                      {formatDate(booking.passStartDate)} -{" "}
                                      {formatDate(booking.passEndDate)}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {booking.totalTripsCount > 0 && (
                                <div className="drivemego-cebp-detail-item">
                                  <span className="drivemego-cebp-detail-icon">
                                    🔄
                                  </span>
                                  <div className="drivemego-cebp-detail-content">
                                    <span className="drivemego-cebp-detail-label">
                                      Total Trips
                                    </span>
                                    <span className="drivemego-cebp-detail-value">
                                      {booking.totalTripsCount}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {hasTrips && (
                              <div className="drivemego-cebp-trips-toggle">
                                <button className="drivemego-cebp-toggle-btn">
                                  {isExpanded
                                    ? "Hide Trips"
                                    : `View ${booking.trips.length} Trips`}
                                  <span
                                    className={`drivemego-cebp-toggle-arrow ${isExpanded ? "drivemego-cebp-up" : "drivemego-cebp-down"}`}
                                  >
                                    {isExpanded ? "▲" : "▼"}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expandable Trips Section */}
                        {isExpanded && hasTrips && (
                          <div className="drivemego-cebp-trips-section">
                            <div className="drivemego-cebp-trips-header">
                              <h4>Scheduled Trips ({booking.trips.length})</h4>
                            </div>
                            <div className="drivemego-cebp-trips-list">
                              {booking.trips.map((trip, index) => {
                                const tripStatusConfig = getTripStatusBadge(
                                  trip.status,
                                );
                                return (
                                  <div
                                    key={trip._id || index}
                                    className="drivemego-cebp-trip-item"
                                  >
                                    <div className="drivemego-cebp-trip-date-block">
                                      <span className="drivemego-cebp-trip-day">
                                        {new Date(
                                          trip.tripDate,
                                        ).toLocaleDateString("en-US", {
                                          weekday: "short",
                                        })}
                                      </span>
                                      <span className="drivemego-cebp-trip-date-num">
                                        {new Date(trip.tripDate).getDate()}
                                      </span>
                                      <span className="drivemego-cebp-trip-month">
                                        {new Date(
                                          trip.tripDate,
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                        })}
                                      </span>
                                    </div>
                                    <div className="drivemego-cebp-trip-details">
                                      <div className="drivemego-cebp-trip-route">
                                        <span className="drivemego-cebp-trip-from">
                                          {trip.fromLocation}
                                        </span>
                                        <span className="drivemego-cebp-trip-arrow">
                                          →
                                        </span>
                                        <span className="drivemego-cebp-trip-to">
                                          {trip.toLocation}
                                        </span>
                                      </div>
                                      <div className="drivemego-cebp-trip-meta">
                                        <span className="drivemego-cebp-trip-time">
                                          {formatTime(trip.startTime)}
                                        </span>
                                        {trip.direction && (
                                          <span className="drivemego-cebp-trip-direction">
                                            {trip.direction}
                                          </span>
                                        )}
                                        {trip.driverName && (
                                          <span className="drivemego-cebp-trip-driver">
                                            {trip.driverName}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="drivemego-cebp-trip-status">
                                      <span
                                        className="drivemego-cebp-trip-status-badge"
                                        style={{
                                          backgroundColor:
                                            tripStatusConfig.color,
                                        }}
                                      >
                                        {tripStatusConfig.label}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CorporateEmployeeBookingsPage;
