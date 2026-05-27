"use client";

import { useState, useEffect, useCallback } from "react";
import api from "../../utils/api";
import "./DriverRatings.css";

function DriverRatings() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalRatings: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  const fetchRatings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/travel-history/driver-ratings");

      if (response.data.success) {
        setRatings(response.data.data.ratings || []);
        setStats({
          averageRating: response.data.data.averageRating || 0,
          totalRatings: response.data.data.totalRatings || 0,
          ratingDistribution: response.data.data.ratingDistribution || {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
          },
        });
      } else {
        setError(response.data.message || "Failed to fetch ratings");
      }
    } catch (err) {
      console.error("Error fetching driver ratings:", err);
      setError("Failed to load ratings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(
          <span key={i} className="star filled">
            &#9733;
          </span>,
        );
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(
          <span key={i} className="star half">
            &#9733;
          </span>,
        );
      } else {
        stars.push(
          <span key={i} className="star empty">
            &#9734;
          </span>,
        );
      }
    }
    return stars;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMaxDistribution = () => {
    return Math.max(...Object.values(stats.ratingDistribution), 1);
  };

  if (loading) {
    return (
      <div className="driver-ratings-loading">
        <div className="loading-spinner"></div>
        <p>Loading your ratings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="driver-ratings-error">
        <p>{error}</p>
        <button onClick={fetchRatings} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="driver-ratings-container">
      <div className="ratings-header">
        <h2>My Ratings</h2>
        <p>See what passengers say about your service</p>
      </div>

      {/* Stats Overview */}
      <div className="ratings-stats-card">
        <div className="overall-rating">
          <div className="rating-number">{stats.averageRating.toFixed(1)}</div>
          <div className="rating-stars">{renderStars(stats.averageRating)}</div>
          <div className="rating-count">{stats.totalRatings} total ratings</div>
        </div>

        <div className="rating-distribution">
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star} className="distribution-row">
              <span className="star-label">{star} star</span>
              <div className="distribution-bar-container">
                <div
                  className="distribution-bar"
                  style={{
                    width: `${(stats.ratingDistribution[star] / getMaxDistribution()) * 100}%`,
                  }}
                ></div>
              </div>
              <span className="distribution-count">
                {stats.ratingDistribution[star]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="reviews-section">
        <h3>Recent Reviews</h3>

        {ratings.length === 0 ? (
          <div className="no-ratings">
            <div className="no-ratings-icon">&#9733;</div>
            <p>No ratings yet</p>
            <span>Complete trips to receive ratings from passengers</span>
          </div>
        ) : (
          <div className="reviews-list">
            {ratings.map((review) => (
              <div key={review._id} className="review-card">
                <div className="review-header">
                  <div className="passenger-info">
                    <img
                      src={review.passengerImage || "/placeholder-user.jpg"}
                      alt={review.passengerName}
                      className="passenger-avatar"
                      onError={(e) => {
                        e.target.src = "/placeholder-user.jpg";
                      }}
                    />
                    <div className="passenger-details">
                      <span className="passenger-name">
                        {review.passengerName}
                      </span>
                      <span className="review-date">
                        {formatDate(review.ratedAt || review.tripDate)}
                      </span>
                    </div>
                  </div>
                  <div className="review-rating">
                    {renderStars(review.rating)}
                    <span className="rating-value">
                      {review.rating.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="review-route">
                  <span className="route-icon">&#128205;</span>
                  <span className="route-name">{review.routeName}</span>
                </div>

                {review.feedback && (
                  <div className="review-feedback">
                    <p>{review.feedback}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverRatings;
