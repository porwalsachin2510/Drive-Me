import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import "./CorporateTripManagement.css";
import { notify } from "../../../utils/toast";

function CorporateTripManagement() {
  const [trips, setTrips] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [formData, setFormData] = useState({
    routeId: "",
    startDate: "",
    endDate: "",
    daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI"],
  });

  useEffect(() => {
    fetchTrips();
    fetchRoutes();
  }, []);

  const fetchTrips = async ({ silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      // Backend: GET /api/corporate-operations/daily-trips
      const response = await api.get("/corporate-operations/daily-trips");
      setTrips(response.data.data?.trips || response.data.trips || []);
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      // Backend: GET /api/corporate-operations/assigned-routes-status
      const response = await api.get(
        "/corporate-operations/assigned-routes-status",
      );
      setRoutes(response.data.data?.routes || response.data.routes || []);
    } catch (error) {
      console.error("Error fetching routes:", error);
    }
  };

  // Live auto-refresh: daily trips + route statuses change throughout the day.
  const refreshOperations = useCallback(({ silent } = {}) => {
    fetchTrips({ silent });
    fetchRoutes();
  }, []);

  useAutoRefresh(refreshOperations, {
    interval: 15000,
    socketEvents: [
      "trip-started",
      "trip-completed",
      "trip-assigned",
      "new-notification",
    ],
  });

  const handleCreateTrips = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post("/trips/create-from-route", formData);
      setShowCreateModal(false);
      fetchTrips();
      notify("Trips created successfully!");
    } catch (error) {
      console.error("Error creating trips:", error);
      notify("Failed to create trips");
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day) => {
    setFormData((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "SCHEDULED":
        return "#10b981";
      case "IN_PROGRESS":
        return "#3b82f6";
      case "COMPLETED":
        return "#6b7280";
      case "CANCELLED":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="corporate-trip-management">
      <div className="trip-header">
        <h2>Trip Management</h2>
        <button
          className="create-trip-btn"
          onClick={() => setShowCreateModal(true)}
        >
          Create Trips from Route
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading trips...</div>
      ) : (
        <div className="trips-container">
          {trips.length === 0 ? (
            <div className="no-trips">
              <p>No trips found. Create trips from your routes.</p>
            </div>
          ) : (
            <div className="trips-grid">
              {trips.map((trip) => (
                <div key={trip._id} className="trip-card">
                  <div className="trip-header-info">
                    <h3>
                      {trip.fromLocation} → {trip.toLocation}
                    </h3>
                    <span
                      className="trip-status"
                      style={{ backgroundColor: getStatusColor(trip.status) }}
                    >
                      {trip.status}
                    </span>
                  </div>

                  <div className="trip-details">
                    <div className="trip-info">
                      <p>
                        <strong>Date:</strong> {formatDate(trip.tripDate)}
                      </p>
                      <p>
                        <strong>Time:</strong> {trip.startTime} - {trip.endTime}
                      </p>
                      <p>
                        <strong>Vehicle:</strong> {trip.vehicleId?.make}{" "}
                        {trip.vehicleId?.model}
                      </p>
                      <p>
                        <strong>Driver:</strong> {trip.driverId?.fullName}
                      </p>
                    </div>

                    <div className="trip-seats">
                      <div className="seats-info">
                        <span className="seats-count">
                          {trip.bookedSeats}/{trip.totalSeats}
                        </span>
                        <span className="seats-label">Seats Booked</span>
                      </div>
                      <div className="seats-progress">
                        <div
                          className="seats-progress-bar"
                          style={{
                            width: `${(trip.bookedSeats / trip.totalSeats) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="trip-passengers">
                    <h4>Passengers ({trip.passengers.length})</h4>
                    <div className="passengers-list">
                      {trip.passengers.slice(0, 3).map((passenger, index) => (
                        <div key={index} className="passenger-item">
                          <span>{passenger.employeeId?.fullName}</span>
                          <span className="seat-info">
                            Seat {passenger.seatNumber}
                          </span>
                        </div>
                      ))}
                      {trip.passengers.length > 3 && (
                        <span className="more-passengers">
                          +{trip.passengers.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create Trips from Route</h3>
              <button
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTrips} className="modal-form">
              <div className="form-group">
                <label>Select Route</label>
                <select
                  value={formData.routeId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      routeId: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Choose a route</option>
                  {routes.map((route) => (
                    <option key={route._id} value={route._id}>
                      {route.fromLocation} → {route.toLocation}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Days of Week</label>
                <div className="days-selector">
                  {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(
                    (day) => (
                      <button
                        key={day}
                        type="button"
                        className={`day-btn ${formData.daysOfWeek.includes(day) ? "active" : ""}`}
                        onClick={() => handleDayToggle(day)}
                      >
                        {day}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? "Creating..." : "Create Trips"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CorporateTripManagement;
