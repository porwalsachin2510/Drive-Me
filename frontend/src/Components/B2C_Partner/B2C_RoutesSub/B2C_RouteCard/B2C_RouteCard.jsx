"use client";

import { useState, useEffect } from "react";
import "./b2c_routecard.css";
import api from "../../../../utils/api";
import B2C_TripModal from "../B2C_TripModal/B2C_TripModal.jsx";

function B2C_RouteCard({ route, onRouteUpdated, onAddSchedule }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    fromLocation: "",
    toLocation: "",
    startTime: "",
    totalSeats: "",
    availableSeats: "",
    oneWayPrice: "",
    roundTripPrice: "",
    status: "",
    availableDays: [],
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const checkScheduleAndTrips = async () => {
      try {
        const scheduleResponse = await api.get(`/b2c-schedules/schedules?routeId=${route._id}`);
        const hasScheduleData = scheduleResponse.data.success && scheduleResponse.data.schedules.length > 0;
        if (cancelled) return;
        setHasSchedule(hasScheduleData);

        if (hasScheduleData) {
          const tripsResponse = await api.get(`/b2c-trips/trips/today?routeId=${route._id}`);
          if (!cancelled && tripsResponse.data.success) {
            setUpcomingTrips(tripsResponse.data.trips || []);
          }
        }
      } catch (error) {
        console.error("Error checking schedule/trips:", error);
      }
    };
    checkScheduleAndTrips();
    return () => { cancelled = true; };
  }, [route._id]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Active": return "#10b981";
      case "Inactive": return "#ef4444";
      case "Scheduled": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const getTripTypeColor = (type) => {
    switch (type) {
      case "One Way": return "#3b82f6";
      case "Round Trip": return "#8b5cf6";
      default: return "#6b7280";
    }
  };

  const dayOptions = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  const openEditModal = () => {
    setEditForm({
      fromLocation: route.fromLocation || "",
      toLocation: route.toLocation || "",
      startTime: route.startTime || "",
      totalSeats: route.totalSeats?.toString() || "",
      availableSeats: route.availableSeats?.toString() || "",
      oneWayPrice: route.pricing?.oneWayPrice?.toString() || "",
      roundTripPrice: route.pricing?.roundTripPrice?.toString() || "",
      status: route.status || "Active",
      availableDays: route.availableDays || [],
    });
    setEditError("");
    setShowEditModal(true);
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day) => {
    setEditForm(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day]
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");

    try {
      const payload = {
        fromLocation: editForm.fromLocation,
        toLocation: editForm.toLocation,
        startTime: editForm.startTime,
        totalSeats: parseInt(editForm.totalSeats),
        availableSeats: parseInt(editForm.availableSeats),
        pricing: {
          oneWayPrice: parseFloat(editForm.oneWayPrice),
          roundTripPrice: parseFloat(editForm.roundTripPrice || 0),
        },
        status: editForm.status,
        availableDays: editForm.availableDays,
      };

      await api.put(`/b2c-partner/routes/${route._id}`, payload);
      setShowEditModal(false);
      if (onRouteUpdated) onRouteUpdated();
    } catch (error) {
      setEditError(error.response?.data?.message || "Failed to update route");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!window.confirm("Are you sure you want to delete this route? This action cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/b2c-partner/routes/${route._id}`);
      if (onRouteUpdated) onRouteUpdated();
    } catch (error) {
      console.error("Error deleting route:", error);
      alert(error.response?.data?.message || "Failed to delete route");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="b2c-route-card">
      <div className="b2c-route-header">
        <div className="b2c-route-info">
          <div className="b2c-route-locations">
            <div className="b2c-location">
              <span className="b2c-location-dot b2c-from"></span>
              <span className="b2c-location-text">{route.fromLocation}</span>
            </div>
            <div className="b2c-route-arrow">{"→"}</div>
            <div className="b2c-location">
              <span className="b2c-location-dot b2c-to"></span>
              <span className="b2c-location-text">{route.toLocation}</span>
            </div>
          </div>
        </div>
        <div className="b2c-badges-wrapper">
          <span className="b2c-status-badge" style={{ backgroundColor: getStatusColor(route.status) }}>
            {route.status}
          </span>
        </div>
      </div>

      <div className="b2c-route-details">
        <div className="b2c-detail-row">
          <div className="b2c-detail-item">
            <span className="b2c-detail-label">Start Time:</span>
            <span className="b2c-detail-value">{route.startTime || "N/A"}</span>
          </div>
          <div className="b2c-detail-item">
            <span className="b2c-detail-label">Available Days:</span>
            <span className="b2c-detail-value">{route.availableDays?.join(", ") || "Daily"}</span>
          </div>
        </div>
        <div className="b2c-detail-row">
          <div className="b2c-detail-item">
            <span className="b2c-detail-label">Total Seats:</span>
            <span className="b2c-detail-value">{route.totalSeats}</span>
          </div>
          <div className="b2c-detail-item">
            <span className="b2c-detail-label">Available:</span>
            <span className="b2c-detail-value">{route.availableSeats}</span>
          </div>
        </div>
        <div className="b2c-pricing-row">
          <div className="b2c-price-item">
            <span className="b2c-price-label">One Way:</span>
            <span className="b2c-price-value">KWD {route.pricing?.oneWayPrice || 0}</span>
          </div>
          {route.pricing?.roundTripPrice > 0 && (
            <div className="b2c-price-item">
              <span className="b2c-price-label">Round Trip:</span>
              <span className="b2c-price-value">KWD {route.pricing.roundTripPrice}</span>
            </div>
          )}
        </div>

        {route.stopPoints && route.stopPoints.length > 0 && (
          <div className="b2c-stop-points">
            <div className="b2c-stop-header">
              <button className="b2c-toggle-details" onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? "Hide" : "Show"} Stop Points ({route.stopPoints.length})
              </button>
              <span className="b2c-trip-type-badge" style={{ backgroundColor: getTripTypeColor(route.tripType) }}>
                {route.tripType}
              </span>
            </div>
            {showDetails && (
              <div className="b2c-stop-points-list">
                {route.stopPoints.map((stop, index) => (
                  <div key={index} className="b2c-stop-point">
                    <span className="b2c-stop-number">{index + 1}</span>
                    <span className="b2c-stop-location">{stop.location}</span>
                    <span className="b2c-stop-time">{stop.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="b2c-route-assignments">
          <div className="b2c-assignment-item">
            <span className="b2c-assignment-label">Vehicle:</span>
            <span className="b2c-assignment-value">
              {route.assignedVehicle?.model || "Not Assigned"}
            </span>
          </div>
          <div className="b2c-assignment-item">
            <span className="b2c-assignment-label">Driver:</span>
            <span className="b2c-assignment-value">
              {route.assignedDriver?.name || route.assignedDriverId?.fullName || "Not Assigned"}
            </span>
          </div>
        </div>
      </div>

      <div className="b2c-route-actions">
        <button className="b2c-action-btn b2c-edit-btn" onClick={openEditModal}>
          Edit
        </button>
        <button className="b2c-action-btn b2c-schedule-btn" onClick={() => onAddSchedule && onAddSchedule(route)}>
          {hasSchedule ? "Manage Schedule" : "Add Schedule"}
        </button>
        {hasSchedule ? (
          <button className="b2c-action-btn b2c-view-trips-btn" onClick={() => setShowTripModal(true)}>
            View Trips ({upcomingTrips.length})
          </button>
        ) : (
          <button className="b2c-action-btn b2c-trip-btn" onClick={() => setShowCreateTripModal(true)}>
            Create Trip
          </button>
        )}
        <button className="b2c-action-btn b2c-delete-btn" onClick={handleDeleteRoute} disabled={deleting}>
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>

      {/* Edit Route Modal */}
      {showEditModal && (
        <div className="b2c-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="b2c-modal-content b2c-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="b2c-modal-header">
              <h3>Edit Route</h3>
              <button className="b2c-modal-close" onClick={() => setShowEditModal(false)}>X</button>
            </div>
            {editError && <div className="b2c-edit-error">{editError}</div>}
            <form onSubmit={handleEditSubmit} className="b2c-edit-form">
              <div className="b2c-edit-row">
                <div className="b2c-edit-field">
                  <label>From Location</label>
                  <input type="text" value={editForm.fromLocation} onChange={(e) => handleEditChange("fromLocation", e.target.value)} required />
                </div>
                <div className="b2c-edit-field">
                  <label>To Location</label>
                  <input type="text" value={editForm.toLocation} onChange={(e) => handleEditChange("toLocation", e.target.value)} required />
                </div>
              </div>
              <div className="b2c-edit-row">
                <div className="b2c-edit-field">
                  <label>Start Time</label>
                  <input type="time" value={editForm.startTime} onChange={(e) => handleEditChange("startTime", e.target.value)} />
                </div>
                <div className="b2c-edit-field">
                  <label>Status</label>
                  <select value={editForm.status} onChange={(e) => handleEditChange("status", e.target.value)}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Scheduled">Scheduled</option>
                  </select>
                </div>
              </div>
              <div className="b2c-edit-row">
                <div className="b2c-edit-field">
                  <label>Total Seats</label>
                  <input type="number" min="1" value={editForm.totalSeats} onChange={(e) => handleEditChange("totalSeats", e.target.value)} required />
                </div>
                <div className="b2c-edit-field">
                  <label>Available Seats</label>
                  <input type="number" min="0" value={editForm.availableSeats} onChange={(e) => handleEditChange("availableSeats", e.target.value)} required />
                </div>
              </div>
              <div className="b2c-edit-row">
                <div className="b2c-edit-field">
                  <label>One Way Price (KWD)</label>
                  <input type="number" min="0" step="0.001" value={editForm.oneWayPrice} onChange={(e) => handleEditChange("oneWayPrice", e.target.value)} required />
                </div>
                <div className="b2c-edit-field">
                  <label>Round Trip Price (KWD)</label>
                  <input type="number" min="0" step="0.001" value={editForm.roundTripPrice} onChange={(e) => handleEditChange("roundTripPrice", e.target.value)} />
                </div>
              </div>
              <div className="b2c-edit-field b2c-days-field">
                <label>Available Days</label>
                <div className="b2c-days-grid">
                  {dayOptions.map(day => (
                    <button key={day} type="button" className={`b2c-day-btn ${editForm.availableDays.includes(day) ? "active" : ""}`} onClick={() => toggleDay(day)}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="b2c-edit-actions">
                <button type="button" className="b2c-cancel-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="b2c-save-btn" disabled={editLoading}>
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTripModal && (
        <B2C_TripModal route={route} onClose={() => setShowTripModal(false)} />
      )}
    </div>
  );
}

export default B2C_RouteCard;
