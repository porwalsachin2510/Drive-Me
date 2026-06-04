"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./b2c_tripmodal.css";
import api from "../../../../utils/api";

function B2C_TripModal({ route, onClose }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState(null);

  useEffect(() => {
    fetchTrips();
  }, [route._id]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30);

      const response = await api.get(
        `/b2c-trips/trips/today?routeId=${route._id}`,
      );
      if (response.data.success) {
        setTrips(response.data.trips || []);
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString) => {
    return timeString;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Scheduled":
        return "#10b981";
      case "In Progress":
        return "#3b82f6";
      case "Completed":
        return "#6b7280";
      case "Cancelled":
        return "#ef4444";
      case "Delayed":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  return createPortal(
    <div className="b2c-trip-modal-overlay">
      <div
        className="b2c-trip-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="b2c-trip-modal-header">
          <div className="b2c-trip-modal-title-section">
            <h2 className="b2c-trip-modal-title">
              Trips for {route.fromLocation} → {route.toLocation}
            </h2>
            <p className="b2c-trip-modal-subtitle">
              Total {trips.length} upcoming trips
            </p>
          </div>
          <button className="b2c-trip-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 6l12 12"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="b2c-trip-modal-body">
          {loading ? (
            <div className="b2c-trip-loading">
              <div className="b2c-trip-spinner"></div>
              <p>Loading trips...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="b2c-trip-empty">
              <div className="b2c-trip-empty-icon">🚌</div>
              <h3>No trips found</h3>
              <p>No upcoming trips scheduled for this route.</p>
            </div>
          ) : (
            <div className="b2c-trips-list">
              {trips.map((trip, index) => (
                <div key={trip._id} className="b2c-trip-card">
                  <div className="b2c-trip-header">
                    <div className="b2c-trip-date-time">
                      <div className="b2c-trip-date">
                        <span className="b2c-trip-day">
                          {formatDate(trip.tripDate).split(",")[0]}
                        </span>
                        <span className="b2c-trip-date-num">
                          {new Date(trip.tripDate).getDate()}
                        </span>
                      </div>
                      <div className="b2c-trip-time">
                        <span className="b2c-trip-time-text">
                          {formatTime(trip.startTime)}
                        </span>
                      </div>
                    </div>
                    <div className="b2c-trip-status">
                      <span
                        className="b2c-trip-status-badge"
                        style={{ backgroundColor: getStatusColor(trip.status) }}
                      >
                        {trip.status}
                      </span>
                    </div>
                  </div>

                  <div className="b2c-trip-route">
                    <div className="b2c-trip-from">
                      <span className="b2c-trip-location">
                        {trip.fromLocation}
                      </span>
                      <span className="b2c-trip-time-small">
                        {formatTime(trip.startTime)}
                      </span>
                    </div>
                    <div className="b2c-trip-arrow">→</div>
                    <div className="b2c-trip-to">
                      <span className="b2c-trip-location">
                        {trip.toLocation}
                      </span>
                      <span className="b2c-trip-time-small">
                        {trip.tripType === "Round Trip"
                          ? "Return Trip"
                          : "One Way"}
                      </span>
                    </div>
                  </div>

                  <div className="b2c-trip-details">
                    <div className="b2c-trip-vehicle">
                      <div className="b2c-trip-detail-item">
                        <span className="b2c-trip-detail-label">Vehicle:</span>
                        <span className="b2c-trip-detail-value">
                          {trip.vehicleId?.model || "Not Assigned"}
                          {trip.vehicleId?.licensePlate &&
                            ` (${trip.vehicleId.licensePlate})`}
                        </span>
                      </div>
                    </div>
                    <div className="b2c-trip-driver">
                      <div className="b2c-trip-detail-item">
                        <span className="b2c-trip-detail-label">Driver:</span>
                        <span className="b2c-trip-detail-value">
                          {trip.driverId?.name || "Not Assigned"}
                          {trip.driverId?.phoneNumber &&
                            ` • ${trip.driverId.phoneNumber}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="b2c-trip-seats">
                    <div className="b2c-trip-seat-info">
                      <span className="b2c-trip-seat-label">Seats:</span>
                      <div className="b2c-trip-seat-bar">
                        <div
                          className="b2c-trip-seat-filled"
                          style={{
                            width: `${(trip.bookedSeats / trip.totalSeats) * 100}%`,
                          }}
                        ></div>
                      </div>
                      <span className="b2c-trip-seat-count">
                        {trip.bookedSeats}/{trip.totalSeats}
                      </span>
                    </div>
                  </div>

                  <div className="b2c-trip-actions">
                    <button className="b2c-trip-action-btn b2c-trip-view-btn">
                      View Details
                    </button>
                    <button className="b2c-trip-action-btn b2c-trip-manage-btn">
                      Manage Trip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="b2c-trip-modal-footer">
          <button
            className="b2c-trip-modal-btn b2c-trip-modal-secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button className="b2c-trip-modal-btn b2c-trip-modal-primary">
            Export Trips
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default B2C_TripModal;
