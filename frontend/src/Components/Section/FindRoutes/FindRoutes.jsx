"use client";
import { useState, useEffect } from "react";
import "./find-routes.css";
import api from "../../../utils/api";

export default function FindRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/commuter/routes');
      setRoutes(response.data.routes || []);
    } catch (error) {
      console.error("Error fetching routes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoute = async (routeId) => {
    try {
      await api.post(`/commuter/routes/${routeId}/join`);
      alert("Successfully joined route!");
      fetchRoutes();
    } catch (error) {
      console.error("Error joining route:", error);
      alert(error.response?.data?.message || "Failed to join route");
    }
  };

  const handleLeaveRoute = async (routeId) => {
    if (!window.confirm("Are you sure you want to leave this route?")) return;
    try {
      await api.post(`/commuter/routes/${routeId}/leave`);
      alert("Successfully left route!");
      fetchRoutes();
    } catch (error) {
      console.error("Error leaving route:", error);
      const msg = error.response?.data?.message || "Failed to leave route";
      alert(msg);
    }
  };

  const filteredRoutes = routes.filter(route => {
    const name = (route.name || '').toLowerCase();
    const start = (route.startPoint || '').toLowerCase();
    const end = (route.endPoint || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || name.includes(query) || start.includes(query) || end.includes(query);
    
    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "active") return matchesSearch && route.isMember;
    if (filterStatus === "available") return matchesSearch && !route.isMember;
    return matchesSearch;
  });

  const activeCount = routes.filter(r => r.isMember).length;

  if (loading) {
    return (
      <div className="fr-find-routes-section">
        <h2>My Active Routes</h2>
        <div className="fr-loading">Loading routes...</div>
      </div>
    );
  }

  return (
    <div className="fr-find-routes-section">
      <h2>My Active Routes</h2>
      <p className="fr-routes-count">{activeCount} Active</p>

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
            <option value="active">My Routes</option>
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
                  <span className={`fr-route-status ${route.isMember ? 'fr-active' : 'fr-available'}`}>
                    {route.isMember ? 'Active' : 'Available'}
                  </span>
                </div>
                <div className="fr-route-price">
                  KWD {route.price || 0}
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
                    <span className="fr-meta-value">{route.distance || 'Not available'}</span>
                  </div>
                  <div className="fr-meta-item">
                    <span className="fr-meta-label">Duration:</span>
                    <span className="fr-meta-value">{route.estimatedTime || 'Not available'}</span>
                  </div>
                  <div className="fr-meta-item">
                    <span className="fr-meta-label">Partner:</span>
                    <span className="fr-meta-value">{route.partnerName || 'Unknown'}</span>
                  </div>
                </div>

                <div className="fr-route-schedule">
                  <div className="fr-schedule-item">
                    <span className="fr-schedule-label">Departure:</span>
                    <span className="fr-schedule-time">{route.departureTime || 'Not set'}</span>
                  </div>
                  <div className="fr-schedule-item">
                    <span className="fr-schedule-label">Arrival:</span>
                    <span className="fr-schedule-time">{route.arrivalTime || 'Not set'}</span>
                  </div>
                </div>

                {route.operatingDays && route.operatingDays.length > 0 && (
                  <div className="fr-route-days">
                    <span className="fr-days-label">Operating Days:</span>
                    <div className="fr-days-list">
                      {route.operatingDays.map((day, idx) => (
                        <span key={idx} className="fr-day-badge">{day}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="fr-route-seats-info">
                  <span className="fr-seats-label">Available Seats:</span>
                  <span className="fr-seats-value">{route.availableSeats} / {route.totalSeats}</span>
                </div>
              </div>

              <div className="fr-route-actions">
                {route.isMember ? (
                  <button
                    className="fr-leave-btn"
                    onClick={() => handleLeaveRoute(route._id)}
                  >
                    Leave Route
                  </button>
                ) : (
                  <button
                    className="fr-join-btn"
                    onClick={() => handleJoinRoute(route._id)}
                    disabled={route.availableSeats <= 0}
                  >
                    {route.availableSeats <= 0 ? 'Full' : 'Join Route'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
