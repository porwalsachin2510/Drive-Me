"use client";
import { useState, useEffect } from "react";
import "./find-routes.css";
import api from "../../../utils/api";
import BookingModal from "../../BookingModal/BookingModal";

export default function FindRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [savingId, setSavingId] = useState(null);

  // Booking modal state
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const response = await api.get("/commuter/routes");
      setRoutes(response.data.routes || []);
    } catch (error) {
      console.error("Error fetching routes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBooking = (route) => {
    setSelectedRoute(route);
    setShowBookingModal(true);
  };

  const handleCloseBooking = () => {
    setShowBookingModal(false);
    setSelectedRoute(null);
  };

  const handleBookingSuccess = () => {
    handleCloseBooking();
    // Refresh so the booked route reflects its new "Booked" status
    fetchRoutes();
  };

  const handleToggleSave = async (route) => {
    setSavingId(route._id);
    try {
      if (route.isSaved) {
        await api.post(`/commuter/routes/${route._id}/leave`);
      } else {
        await api.post(`/commuter/routes/${route._id}/save`);
      }
      // Optimistically update local state, then refetch to stay in sync
      setRoutes((prev) =>
        prev.map((r) =>
          r._id === route._id ? { ...r, isSaved: !r.isSaved } : r,
        ),
      );
      fetchRoutes();
    } catch (error) {
      console.error("Error updating saved route:", error);
      alert(error.response?.data?.message || "Failed to update saved route");
    } finally {
      setSavingId(null);
    }
  };

  const filteredRoutes = routes.filter((route) => {
    const name = (route.name || "").toLowerCase();
    const start = (route.startPoint || "").toLowerCase();
    const end = (route.endPoint || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      name.includes(query) ||
      start.includes(query) ||
      end.includes(query);

    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "saved") return matchesSearch && route.isSaved;
    if (filterStatus === "booked") return matchesSearch && route.isBooked;
    if (filterStatus === "available") return matchesSearch && !route.isBooked;
    return matchesSearch;
  });

  const bookedCount = routes.filter((r) => r.isBooked).length;
  const savedCount = routes.filter((r) => r.isSaved).length;

  if (loading) {
    return (
      <div className="fr-find-routes-section">
        <h2>Find Routes</h2>
        <div className="fr-loading">Loading routes...</div>
      </div>
    );
  }

  return (
    <div className="fr-find-routes-section">
      <h2>Find Routes</h2>
      <p className="fr-routes-count">
        {bookedCount} Booked &bull; {savedCount} Saved
      </p>

      <div className="fr-routes-controls">
        <div className="fr-search-box">
          <input
            type="text"
            placeholder="Search routes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="fr-search-input"
          />
        </div>
        <div className="fr-filter-box">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="fr-filter-select"
          >
            <option value="all">All Routes</option>
            <option value="booked">My Booked</option>
            <option value="saved">Saved</option>
            <option value="available">Available</option>
          </select>
        </div>
      </div>

      <div className="fr-routes-list">
        {filteredRoutes.length === 0 ? (
          <div className="fr-empty-state">
            <p className="fr-empty-title">
              {searchQuery || filterStatus !== "all"
                ? "No routes found matching your criteria."
                : "No partner routes available yet."}
            </p>
            <p className="fr-empty-subtitle">
              {searchQuery || filterStatus !== "all"
                ? "Try adjusting your search or filter."
                : "Check back later for available routes!"}
            </p>
          </div>
        ) : (
          filteredRoutes.map((route) => (
            <div key={route._id} className="fr-route-card">
              <div className="fr-route-header">
                <div className="fr-route-info">
                  <h3>{route.name}</h3>
                  <div className="fr-route-badges">
                    {route.isBooked && (
                      <span className="fr-route-status fr-booked">Booked</span>
                    )}
                    {route.isSaved && (
                      <span className="fr-route-status fr-saved">Saved</span>
                    )}
                    {!route.isBooked && !route.isSaved && (
                      <span className="fr-route-status fr-available">
                        Available
                      </span>
                    )}
                  </div>
                </div>
                <div className="fr-route-price">
                  {route.pricing?.currency || route.currency || "KWD"}{" "}
                  {route.price || route.pricing?.oneWayPrice || 0}
                </div>
              </div>

              <div className="fr-route-details">
                <div className="fr-route-path">
                  <div className="fr-route-point">
                    <strong>From:</strong> {route.startPoint}
                  </div>
                  <div className="fr-route-arrow">&#8594;</div>
                  <div className="fr-route-point">
                    <strong>To:</strong> {route.endPoint}
                  </div>
                </div>

                <div className="fr-route-meta">
                  <div className="fr-meta-item">
                    <span className="fr-meta-label">Distance:</span>
                    <span className="fr-meta-value">
                      {route.distance || "Not available"}
                    </span>
                  </div>
                  <div className="fr-meta-item">
                    <span className="fr-meta-label">Duration:</span>
                    <span className="fr-meta-value">
                      {route.estimatedTime || "Not available"}
                    </span>
                  </div>
                  <div className="fr-meta-item">
                    <span className="fr-meta-label">Partner:</span>
                    <span className="fr-meta-value">
                      {route.partnerName || "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="fr-route-schedule">
                  <div className="fr-schedule-item">
                    <span className="fr-schedule-label">Departure:</span>
                    <span className="fr-schedule-time">
                      {route.departureTime || "Not set"}
                    </span>
                  </div>
                  <div className="fr-schedule-item">
                    <span className="fr-schedule-label">Arrival:</span>
                    <span className="fr-schedule-time">
                      {route.arrivalTime || "Not set"}
                    </span>
                  </div>
                </div>

                {route.operatingDays && route.operatingDays.length > 0 && (
                  <div className="fr-route-days">
                    <span className="fr-days-label">Operating Days:</span>
                    <div className="fr-days-list">
                      {route.operatingDays.map((day, idx) => (
                        <span key={idx} className="fr-day-badge">
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="fr-route-seats-info">
                  <span className="fr-seats-label">Available Seats:</span>
                  <span className="fr-seats-value">
                    {route.availableSeats} / {route.totalSeats}
                  </span>
                </div>
              </div>

              <div className="fr-route-actions">
                <button
                  className="fr-save-btn"
                  onClick={() => handleToggleSave(route)}
                  disabled={savingId === route._id}
                >
                  {savingId === route._id
                    ? "..."
                    : route.isSaved
                      ? "Unsave"
                      : "Save"}
                </button>
                <button
                  className="fr-book-btn"
                  onClick={() => handleOpenBooking(route)}
                  disabled={route.availableSeats <= 0}
                >
                  {route.availableSeats <= 0 ? "Full" : "Book This Route"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedRoute && (
        <BookingModal
          route={selectedRoute}
          isOpen={showBookingModal}
          onClose={handleCloseBooking}
          isCorporate={false}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
}
