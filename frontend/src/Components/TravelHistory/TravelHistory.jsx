/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import api from "../../utils/api";
import "./TravelHistory.css";

const TravelHistory = ({ userId: _userId }) => {
  const [travelHistory, setTravelHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    period: "month",
    status: "all",
  });
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [ratingData, setRatingData] = useState({
    rating: 5,
    feedback: "",
    complaints: [],
  });

  const fetchTravelHistory = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        period: filter.period,
        status: filter.status !== "all" ? filter.status : "",
      });

      const response = await api.get(
        `/travel-history/my-history?${queryParams}`,
      );
      const data = response.data;

      console.log('queryParams', queryParams);

      console.log("data", data);


      if (data.success) {
        // Handle both 'history' and 'travelHistory' response keys for backward compatibility
        setTravelHistory(data.data.history || data.data.travelHistory || []);
      } else {
        setError(data.message || "Failed to fetch travel history");
      }
    } catch (error) {
      console.error("Error fetching travel history:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTravelHistory();
  }, [fetchTravelHistory]);

  const handleRateTrip = (trip) => {
    setSelectedTrip(trip);
    setShowRatingModal(true);
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post(
        `/travel-history/rate/${selectedTrip._id}`,
        ratingData,
      );
      const data = response.data;

      if (data.success) {
        // Update the trip in the list
        setTravelHistory((prev) =>
          prev.map((trip) =>
            trip._id === selectedTrip._id
              ? {
                  ...trip,
                  rating: ratingData.rating,
                  feedback: ratingData.feedback,
                }
              : trip,
          ),
        );
        setShowRatingModal(false);
        setSelectedTrip(null);
        setRatingData({ rating: 5, feedback: "", complaints: [] });
      } else {
        setError(data.message || "Failed to submit rating");
      }
    } catch (error) {
      console.error("Error submitting rating:", error);
      setError("Network error. Please try again.");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString) => {
    const time = new Date(timeString);
    return time.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="travel-history-loading">
        <div className="spinner"></div>
        <p>Loading travel history...</p>
      </div>
    );
  }

  return (
    <div className="travel-history-container">
      <div className="travel-history-header">
        <h3>My Travel History</h3>

        <div className="filters">
          <select
            value={filter.period}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, period: e.target.value }))
            }
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>

          <select
            value={filter.status}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="all">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="travel-history-list">
        {travelHistory.length === 0 ? (
          <div className="no-history">
            <p>No travel history found for the selected period.</p>
          </div>
        ) : (
          travelHistory.map((trip, index) => (
            <div key={trip._id} className="travel-history-item">
              <div className="trip-date">
                <div className="date">{formatDate(trip.tripDate)}</div>
                <div className="time">
                  {formatTime(trip.actualStartTime || trip.scheduledStartTime)}
                </div>
              </div>

              <div className="trip-route">
                <div className="route-info">
                  <span className="pickup">{trip.pickupLocation}</span>
                  <span className="arrow">→</span>
                  <span className="dropoff">{trip.dropoffLocation}</span>
                </div>
                <div className="trip-details">
                  <span className="vehicle">{trip.vehicleType}</span>
                  <span className="driver">Driver: {trip.driverName}</span>
                </div>
              </div>

              <div className="trip-status">
                <span className={`status ${trip.status.toLowerCase()}`}>
                  {trip.status.replace(/_/g, " ")}
                </span>
                {trip.rating && (
                  <div className="rating">
                    {"★".repeat(Math.floor(trip.rating))}
                    {"☆".repeat(5 - Math.floor(trip.rating))}
                  </div>
                )}
              </div>

              <div className="trip-actions">
                {trip.status === "COMPLETED" && !trip.rating && (
                  <button
                    className="rate-btn"
                    onClick={() => handleRateTrip(trip)}
                  >
                    Rate Trip
                  </button>
                )}
                {trip.noShowId && (
                  <button className="no-show-badge">No Show</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showRatingModal && (
        <div className="rating-overlay">
          <div className="rating-modal">
            <div className="rating-header">
              <h3>Rate Your Trip</h3>
              <button
                className="close-btn"
                onClick={() => setShowRatingModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRatingSubmit} className="rating-form">
              <div className="trip-summary">
                <p>
                  <strong>Date:</strong> {formatDate(selectedTrip?.tripDate)}
                </p>
                <p>
                  <strong>Route:</strong> {selectedTrip?.pickupLocation} →{" "}
                  {selectedTrip?.dropoffLocation}
                </p>
              </div>

              <div className="form-group">
                <label>Rating</label>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star ${star <= ratingData.rating ? "active" : ""}`}
                      onClick={() =>
                        setRatingData((prev) => ({ ...prev, rating: star }))
                      }
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Feedback</label>
                <textarea
                  value={ratingData.feedback}
                  onChange={(e) =>
                    setRatingData((prev) => ({
                      ...prev,
                      feedback: e.target.value,
                    }))
                  }
                  rows="4"
                  placeholder="Share your experience..."
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowRatingModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Submit Rating
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelHistory;
