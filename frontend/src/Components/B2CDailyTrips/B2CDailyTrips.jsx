import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import "./B2CDailyTrips.css";

const B2CDailyTrips = () => {
  const [todayTrips, setTodayTrips] = useState([]);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [seatUpdate, setSeatUpdate] = useState({
    availableSeats: 0,
    totalSeats: 0,
    reason: "",
  });

  useEffect(() => {
    fetchAllTrips();
  }, []);

  const fetchAllTrips = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchTodayTrips(), fetchUpcomingTrips()]);
    } catch (err) {
      console.error("Error fetching trips:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayTrips = async () => {
    try {
      const response = await api.get("/b2c-daily-trips/today");
      if (response.data.success) {
        setTodayTrips(response.data.data?.trips || []);
      } else {
        setError(response.data.message || "Failed to fetch today's trips");
      }
    } catch (error) {
      console.error("Error fetching today trips:", error);
      setError("Network error. Please try again.");
    }
  };

  const fetchUpcomingTrips = async () => {
    try {
      const response = await api.get("/b2c-daily-trips/upcoming", {
        params: { days: 7 },
      });
      if (response.data.success) {
        setUpcomingTrips(response.data.data?.trips || []);
      } else {
        console.error("Failed to fetch upcoming trips:", response.data.message);
      }
    } catch (error) {
      console.error("Error fetching upcoming trips:", error);
    }
  };

  const updateTripStatus = async (tripId, status) => {
    setUpdating(true);
    try {
      const response = await api.put(`/b2c-daily-trips/status/${tripId}`, {
        status,
      });

      if (response.data.success) {
        // Map status to display format
        const statusMap = {
          STARTED: "In Progress",
          IN_PROGRESS: "In Progress",
          COMPLETED: "Completed",
          CANCELLED: "Cancelled",
          SCHEDULED: "Scheduled",
        };
        const displayStatus = statusMap[status.toUpperCase()] || status;

        const updateTrips = (trips) =>
          trips.map((trip) =>
            trip._id === tripId ? { ...trip, status: displayStatus } : trip,
          );

        setTodayTrips((prev) => updateTrips(prev));
        setUpcomingTrips((prev) => updateTrips(prev));
      } else {
        setError(response.data.message || "Failed to update trip status");
      }
    } catch (error) {
      console.error("Error updating trip status:", error);
      setError("Network error. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const openSeatModal = (trip) => {
    setSelectedTrip(trip);
    setSeatUpdate({
      availableSeats: trip.availableSeats || 0,
      totalSeats: trip.totalSeats || 0,
      reason: "",
    });
    setShowSeatModal(true);
  };

  const handleSeatUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      const response = await api.put(
        `/b2c-daily-trips/seats/${selectedTrip._id}`,
        seatUpdate,
      );

      if (response.data.success) {
        const updateTrips = (trips) =>
          trips.map((trip) =>
            trip._id === selectedTrip._id
              ? {
                  ...trip,
                  availableSeats: seatUpdate.availableSeats,
                  totalSeats: seatUpdate.totalSeats,
                  bookedSeats:
                    seatUpdate.totalSeats - seatUpdate.availableSeats,
                }
              : trip,
          );

        setTodayTrips((prev) => updateTrips(prev));
        setUpcomingTrips((prev) => updateTrips(prev));
        setShowSeatModal(false);
        setSelectedTrip(null);
      } else {
        setError(response.data.message || "Failed to update seats");
      }
    } catch (error) {
      console.error("Error updating seats:", error);
      setError("Network error. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Get route name from route data
  const getRouteName = (trip) => {
    if (trip.routeId?.description) {
      return trip.routeId.description;
    }
    if (trip.fromLocation && trip.toLocation) {
      return `${trip.fromLocation} to ${trip.toLocation}`;
    }
    if (trip.routeId?.fromLocation && trip.routeId?.toLocation) {
      return `${trip.routeId.fromLocation} to ${trip.routeId.toLocation}`;
    }
    return "Route";
  };

  // Get route path (from -> to)
  const getRoutePath = (trip) => {
    const from = trip.fromLocation || trip.routeId?.fromLocation || "Unknown";
    const to = trip.toLocation || trip.routeId?.toLocation || "Unknown";
    return `${from} → ${to}`;
  };

  // Get vehicle info
  const getVehicleInfo = (trip) => {
    if (trip.vehicleId) {
      const vehicle = trip.vehicleId;
      if (vehicle.model && vehicle.licensePlate) {
        return `${vehicle.vehicleType || ""} ${vehicle.model} (${vehicle.licensePlate})`.trim();
      }
      if (vehicle.vehicleType) {
        return vehicle.vehicleType;
      }
    }
    if (trip.vehicleInfo?.model) {
      return `${trip.vehicleInfo.model} (${trip.vehicleInfo.licensePlate || "N/A"})`;
    }
    return "Not assigned";
  };

  // Get driver name
  const getDriverName = (trip) => {
    // Check populated driverId object
    if (trip.driverId?.name) {
      return trip.driverId.name;
    }
    // Check driver info snapshot
    if (trip.driverInfo?.name) {
      return trip.driverInfo.name;
    }
    return "Not assigned";
  };

  const getStatusColor = (status) => {
    const statusLower = (status || "").toLowerCase();
    if (statusLower === "scheduled") return "#3b82f6";
    if (statusLower === "in progress" || statusLower === "started")
      return "#f59e0b";
    if (statusLower === "completed") return "#10b981";
    if (statusLower === "cancelled") return "#ef4444";
    if (statusLower === "delayed") return "#8b5cf6";
    return "#6b7280";
  };

  const getStatusDisplay = (status) => {
    if (!status) return "Unknown";
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const currentTrips = activeTab === "today" ? todayTrips : upcomingTrips;

  if (loading) {
    return (
      <div className="drivemego-b2c-daily-trips-tab-container">
        <div className="drivemego-b2c-daily-trips-tab-loading">
          <div className="drivemego-b2c-daily-trips-tab-spinner"></div>
          <p>Loading trips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="drivemego-b2c-daily-trips-tab-container">
      <div className="drivemego-b2c-daily-trips-tab-header">
        <h2>Daily Trip Management</h2>

        <div className="drivemego-b2c-daily-trips-tab-navigation">
          <button
            className={`drivemego-b2c-daily-trips-tab-btn ${activeTab === "today" ? "active" : ""}`}
            onClick={() => setActiveTab("today")}
          >
            {"Today's Trips"} ({todayTrips.length})
          </button>
          <button
            className={`drivemego-b2c-daily-trips-tab-btn ${activeTab === "upcoming" ? "active" : ""}`}
            onClick={() => setActiveTab("upcoming")}
          >
            Upcoming ({upcomingTrips.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="drivemego-b2c-daily-trips-tab-error-message">
          {error}
          <button
            onClick={() => setError("")}
            className="drivemego-b2c-daily-trips-tab-error-close"
          >
            ×
          </button>
        </div>
      )}

      <div className="drivemego-b2c-daily-trips-tab-list">
        {currentTrips.length === 0 ? (
          <div className="drivemego-b2c-daily-trips-tab-no-trips">
            <p>
              No {activeTab === "today" ? "today's" : "upcoming"} trips found.
            </p>
            <button
              onClick={fetchAllTrips}
              className="drivemego-b2c-daily-trips-tab-refresh-btn"
            >
              Refresh
            </button>
          </div>
        ) : (
          currentTrips.map((trip) => (
            <div key={trip._id} className="drivemego-b2c-daily-trips-tab-card">
              <div className="drivemego-b2c-daily-trips-tab-card-header">
                <div className="drivemego-b2c-daily-trips-tab-route-info">
                  <h3>{getRouteName(trip)}</h3>
                  <p>{getRoutePath(trip)}</p>
                </div>
                <div className="drivemego-b2c-daily-trips-tab-status">
                  <span
                    className="drivemego-b2c-daily-trips-tab-status-badge"
                    style={{ backgroundColor: getStatusColor(trip.status) }}
                  >
                    {getStatusDisplay(trip.status)}
                  </span>
                </div>
              </div>

              <div className="drivemego-b2c-daily-trips-tab-details">
                <div className="drivemego-b2c-daily-trips-tab-detail-item">
                  <label>Date:</label>
                  <span>{formatDate(trip.tripDate)}</span>
                </div>
                <div className="drivemego-b2c-daily-trips-tab-detail-item">
                  <label>Time:</label>
                  <span>{trip.startTime || "N/A"}</span>
                </div>
                <div className="drivemego-b2c-daily-trips-tab-detail-item">
                  <label>Vehicle:</label>
                  <span>{getVehicleInfo(trip)}</span>
                </div>
                <div className="drivemego-b2c-daily-trips-tab-detail-item">
                  <label>Driver:</label>
                  <span>{getDriverName(trip)}</span>
                </div>
              </div>

              <div className="drivemego-b2c-daily-trips-tab-seat-info">
                <div className="drivemego-b2c-daily-trips-tab-seat-stats">
                  <div className="drivemego-b2c-daily-trips-tab-stat-item">
                    <span className="drivemego-b2c-daily-trips-tab-label">
                      Total Seats:
                    </span>
                    <span className="drivemego-b2c-daily-trips-tab-value">
                      {trip.totalSeats || 0}
                    </span>
                  </div>
                  <div className="drivemego-b2c-daily-trips-tab-stat-item">
                    <span className="drivemego-b2c-daily-trips-tab-label">
                      Booked:
                    </span>
                    <span className="drivemego-b2c-daily-trips-tab-value drivemego-b2c-daily-trips-tab-booked">
                      {trip.bookedSeats || 0}
                    </span>
                  </div>
                  <div className="drivemego-b2c-daily-trips-tab-stat-item">
                    <span className="drivemego-b2c-daily-trips-tab-label">
                      Available:
                    </span>
                    <span className="drivemego-b2c-daily-trips-tab-value drivemego-b2c-daily-trips-tab-available">
                      {trip.availableSeats || 0}
                    </span>
                  </div>
                </div>
                <div className="drivemego-b2c-daily-trips-tab-utilization-bar">
                  <div
                    className="drivemego-b2c-daily-trips-tab-utilization-fill"
                    style={{
                      width: `${trip.totalSeats > 0 ? ((trip.bookedSeats || 0) / trip.totalSeats) * 100 : 0}%`,
                      backgroundColor:
                        trip.totalSeats > 0 &&
                        (trip.bookedSeats || 0) / trip.totalSeats > 0.8
                          ? "#ef4444"
                          : "#10b981",
                    }}
                  ></div>
                </div>
                <span className="drivemego-b2c-daily-trips-tab-utilization-text">
                  {trip.totalSeats > 0
                    ? (
                        ((trip.bookedSeats || 0) / trip.totalSeats) *
                        100
                      ).toFixed(1)
                    : 0}
                  % utilized
                </span>
              </div>

              <div className="drivemego-b2c-daily-trips-tab-actions">
                <button
                  className="drivemego-b2c-daily-trips-tab-action-btn drivemego-b2c-daily-trips-tab-update-seats"
                  onClick={() => openSeatModal(trip)}
                  disabled={updating}
                >
                  Update Seats
                </button>


                {trip.status !== "Completed" &&
                  trip.status !== "COMPLETED" &&
                  trip.status !== "Cancelled" &&
                  trip.status !== "CANCELLED" && (
                    <button
                      className="drivemego-b2c-daily-trips-tab-action-btn drivemego-b2c-daily-trips-tab-cancel-trip"
                      onClick={() => updateTripStatus(trip._id, "CANCELLED")}
                      disabled={updating}
                    >
                      Cancel Trip
                    </button>
                  )}
              </div>
            </div>
          ))
        )}
      </div>

      {showSeatModal && selectedTrip && (
        <div className="drivemego-b2c-daily-trips-tab-modal-overlay">
          <div className="drivemego-b2c-daily-trips-tab-modal">
            <div className="drivemego-b2c-daily-trips-tab-modal-header">
              <h3>Update Trip Seats</h3>
              <button
                className="drivemego-b2c-daily-trips-tab-close-btn"
                onClick={() => setShowSeatModal(false)}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSeatUpdate}
              className="drivemego-b2c-daily-trips-tab-form"
            >
              <div className="drivemego-b2c-daily-trips-tab-trip-summary">
                <p>
                  <strong>Route:</strong> {getRouteName(selectedTrip)}
                </p>
                <p>
                  <strong>Date:</strong> {formatDate(selectedTrip.tripDate)}
                </p>
                <p>
                  <strong>Current:</strong> {selectedTrip.bookedSeats || 0}/
                  {selectedTrip.totalSeats || 0} seats booked
                </p>
              </div>

              <div className="drivemego-b2c-daily-trips-tab-form-row">
                <div className="drivemego-b2c-daily-trips-tab-form-group">
                  <label>Total Seats</label>
                  <input
                    type="number"
                    value={seatUpdate.totalSeats}
                    onChange={(e) =>
                      setSeatUpdate((prev) => ({
                        ...prev,
                        totalSeats: parseInt(e.target.value) || 0,
                      }))
                    }
                    min={selectedTrip.bookedSeats || 0}
                    required
                  />
                </div>

                <div className="drivemego-b2c-daily-trips-tab-form-group">
                  <label>Available Seats</label>
                  <input
                    type="number"
                    value={seatUpdate.availableSeats}
                    onChange={(e) =>
                      setSeatUpdate((prev) => ({
                        ...prev,
                        availableSeats: parseInt(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    max={seatUpdate.totalSeats}
                    required
                  />
                </div>
              </div>

              <div className="drivemego-b2c-daily-trips-tab-form-group">
                <label>Reason for Change</label>
                <textarea
                  value={seatUpdate.reason}
                  onChange={(e) =>
                    setSeatUpdate((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  rows="3"
                  placeholder="Reason for seat adjustment..."
                />
              </div>

              <div className="drivemego-b2c-daily-trips-tab-form-actions">
                <button
                  type="button"
                  className="drivemego-b2c-daily-trips-tab-cancel-btn"
                  onClick={() => setShowSeatModal(false)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="drivemego-b2c-daily-trips-tab-submit-btn"
                  disabled={updating}
                >
                  {updating ? "Updating..." : "Update Seats"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2CDailyTrips;
