"use client";

import { useState } from "react";
import "./b2b_routecard.css";
import api from "../../../../utils/api";

function B2B_RouteCard({ route, onRefresh }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    fromLocation: "",
    toLocation: "",
    totalDistance: "",
    estimatedDuration: "",
    status: "",
    availableDays: [],
    routeNotes: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const getStatusColor = (status) => {
    switch (status) {
      case "ACTIVE":
      case "Active":
        return "#10b981";
      case "INACTIVE":
      case "Inactive":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const dayOptions = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  const openEditModal = () => {
    setEditForm({
      fromLocation: route.fromLocation || "",
      toLocation: route.toLocation || "",
      totalDistance: route.totalDistance?.toString() || "",
      estimatedDuration: route.estimatedDuration || "",
      status: route.status || "ACTIVE",
      availableDays: route.availableDays || [],
      routeNotes: route.routeNotes || "",
    });
    setEditError("");
    setShowEditModal(true);
  };

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day) => {
    setEditForm((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");

    try {
      await api.put(`/b2b/routes/${route._id}`, editForm);
      setShowEditModal(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      setEditError(error.response?.data?.message || "Failed to update route");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this route? This action cannot be undone.",
      )
    )
      return;
    setDeleting(true);
    try {
      await api.delete(`/b2b-partner/routes/${route._id}`);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error deleting route:", error);
      alert(error.response?.data?.message || "Failed to delete route");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <div className="drivemego-b2broutecard-b2b-route-card">
        <div className="drivemego-b2broutecard-b2b-route-header">
          <div className="drivemego-b2broutecard-b2b-route-info">
            <div className="drivemego-b2broutecard-b2b-route-locations">
              <div className="drivemego-b2broutecard-b2b-location">
                <span className="drivemego-b2broutecard-b2b-location-dot drivemego-b2broutecard-b2b-from"></span>
                <span className="drivemego-b2broutecard-b2b-location-text">
                  {route.fromLocation}
                </span>
              </div>
              <div className="drivemego-b2broutecard-b2b-route-arrow">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="2"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div className="drivemego-b2broutecard-b2b-location">
                <span className="drivemego-b2broutecard-b2b-location-dot drivemego-b2broutecard-b2b-to"></span>
                <span className="drivemego-b2broutecard-b2b-location-text">
                  {route.toLocation}
                </span>
              </div>
            </div>
          </div>
          <span
            className="drivemego-b2broutecard-b2b-status-badge"
            style={{ backgroundColor: getStatusColor(route.status) }}
          >
            {route.status}
          </span>
        </div>

        <div className="drivemego-b2broutecard-b2b-route-details">
          <div className="drivemego-b2broutecard-b2b-detail-row">
            <div className="drivemego-b2broutecard-b2b-detail-item">
              <span className="drivemego-b2broutecard-b2b-detail-label">
                Start Date:
              </span>
              <span className="drivemego-b2broutecard-b2b-detail-value">
                {formatDate(route.routeStartDate)}
              </span>
            </div>
            <div className="drivemego-b2broutecard-b2b-detail-item">
              <span className="drivemego-b2broutecard-b2b-detail-label">
                Distance:
              </span>
              <span className="drivemego-b2broutecard-b2b-detail-value">
                {route.totalDistance ? `${route.totalDistance} km` : "N/A"}
              </span>
            </div>
          </div>

          <div className="drivemego-b2broutecard-b2b-detail-row">
            <div className="drivemego-b2broutecard-b2b-detail-item">
              <span className="drivemego-b2broutecard-b2b-detail-label">
                Duration:
              </span>
              <span className="drivemego-b2broutecard-b2b-detail-value">
                {route.estimatedDuration || "N/A"}
              </span>
            </div>
            <div className="drivemego-b2broutecard-b2b-detail-item">
              <span className="drivemego-b2broutecard-b2b-detail-label">
                Seats:
              </span>
              <span className="drivemego-b2broutecard-b2b-detail-value">
                {route.totalSeats || 0}
              </span>
            </div>
          </div>

          <div className="drivemego-b2broutecard-b2b-days-row">
            <span className="drivemego-b2broutecard-b2b-detail-label">
              Available Days:
            </span>
            <div className="drivemego-b2broutecard-b2b-days-badges">
              {route.availableDays?.map((day) => (
                <span
                  key={day}
                  className="drivemego-b2broutecard-b2b-day-badge"
                >
                  {day}
                </span>
              ))}
            </div>
          </div>

          {route.routeNotes && (
            <div className="drivemego-b2broutecard-b2b-notes-row">
              <span className="drivemego-b2broutecard-b2b-detail-label">
                Notes:
              </span>
              <span className="drivemego-b2broutecard-b2b-notes-text">
                {route.routeNotes}
              </span>
            </div>
          )}

          {/* Contract Info */}
          {route.contractId && (
            <div className="drivemego-b2broutecard-b2b-contract-info">
              <span className="drivemego-b2broutecard-b2b-detail-label">
                Contract:
              </span>
              <span className="drivemego-b2broutecard-b2b-contract-badge">
                {route.contractId?.contractNumber || "Linked"}
              </span>
            </div>
          )}

          {/* Stop Points Toggle */}
          {route.stopPoints && route.stopPoints.length > 0 && (
            <div className="drivemego-b2broutecard-b2b-stop-points">
              <button
                className="drivemego-b2broutecard-b2b-toggle-details"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? "Hide" : "Show"} Stop Points (
                {route.stopPoints.length})
              </button>
              {showDetails && (
                <div className="drivemego-b2broutecard-b2b-stop-points-list">
                  {route.stopPoints.map((stop, index) => (
                    <div key={index} className="b2b-stop-point">
                      <span className="drivemego-b2broutecard-b2b-stop-number">
                        {index + 1}
                      </span>
                      <span className="drivemego-b2broutecard-b2b-stop-location">
                        {stop.location}
                      </span>
                      <span className="drivemego-b2broutecard-b2b-stop-time">
                        {stop.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="drivemego-b2broutecard-b2b-route-actions">
          <button
            className="drivemego-b2broutecard-b2b-action-btn drivemego-b2broutecard-b2b-edit-btn"
            onClick={openEditModal}
          >
            Edit
          </button>
          <button
            className="drivemego-b2broutecard-b2b-action-btn drivemego-b2broutecard-b2b-delete-btn"
            onClick={handleDeleteRoute}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Edit Route Modal */}
      {showEditModal && (
        <div
          className="drivemego-b2broutecard-b2b-modal-overlay"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="drivemego-b2broutecard-b2b-modal-content drivemego-b2broutecard-b2b-edit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drivemego-b2broutecard-b2b-modal-header">
              <h3>Edit Route</h3>
              <button
                className="drivemego-b2broutecard-b2b-modal-close"
                onClick={() => setShowEditModal(false)}
              >
                X
              </button>
            </div>
            {editError && (
              <div className="drivemego-b2broutecard-b2b-edit-error">
                {editError}
              </div>
            )}
            <form
              onSubmit={handleEditSubmit}
              className="drivemego-b2broutecard-b2b-edit-form"
            >
              <div className="drivemego-b2broutecard-b2b-edit-row">
                <div className="drivemego-b2broutecard-b2b-edit-field">
                  <label>From Location</label>
                  <input
                    type="text"
                    value={editForm.fromLocation}
                    onChange={(e) =>
                      handleEditChange("fromLocation", e.target.value)
                    }
                    required
                  />
                </div>
                <div className="drivemego-b2broutecard-b2b-edit-field">
                  <label>To Location</label>
                  <input
                    type="text"
                    value={editForm.toLocation}
                    onChange={(e) =>
                      handleEditChange("toLocation", e.target.value)
                    }
                    required
                  />
                </div>
              </div>
              <div className="drivemego-b2broutecard-b2b-edit-row">
                <div className="drivemego-b2broutecard-b2b-edit-field">
                  <label>Total Distance (km)</label>
                  <input
                    type="number"
                    value={editForm.totalDistance}
                    onChange={(e) =>
                      handleEditChange("totalDistance", e.target.value)
                    }
                  />
                </div>
                <div className="drivemego-b2broutecard-b2b-edit-field">
                  <label>Estimated Duration</label>
                  <input
                    type="text"
                    placeholder="e.g. 2 hours"
                    value={editForm.estimatedDuration}
                    onChange={(e) =>
                      handleEditChange("estimatedDuration", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="drivemego-b2broutecard-b2b-edit-row">
                <div className="drivemego-b2broutecard-b2b-edit-field">
                  <label>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => handleEditChange("status", e.target.value)}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="drivemego-b2broutecard-b2b-edit-field drivemego-b2broutecard-b2b-days-field">
                <label>Available Days</label>
                <div className="drivemego-b2broutecard-b2b-days-grid">
                  {dayOptions.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`drivemego-b2broutecard-b2b-day-btn ${editForm.availableDays.includes(day) ? "drivemego-b2broutecard-active" : ""}`}
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="drivemego-b2broutecard-b2b-edit-field">
                <label>Route Notes</label>
                <textarea
                  value={editForm.routeNotes}
                  onChange={(e) =>
                    handleEditChange("routeNotes", e.target.value)
                  }
                  rows="3"
                />
              </div>
              <div className="drivemego-b2broutecard-b2b-edit-actions">
                <button
                  type="button"
                  className="drivemego-b2broutecard-b2b-cancel-btn"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="drivemego-b2broutecard-b2b-save-btn"
                  disabled={editLoading}
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default B2B_RouteCard;
