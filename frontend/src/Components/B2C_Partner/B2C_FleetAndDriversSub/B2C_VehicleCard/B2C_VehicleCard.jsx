"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import "./b2c_vehiclecard.css";
import api from "../../../../utils/api";
import B2C_EditVehicleModal from "../B2C_EditVehicleModal/B2C_EditVehicleModal";
import { updateVehicleAvailabilityInStore } from "../../../../Redux/slices/b2cPartnerSlice";
import { notify } from "../../../../utils/toast";

function B2C_VehicleCard({ vehicle, onVehicleUpdated, onVehicleDeleted }) {
  const dispatch = useDispatch();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [localAvailabilityStatus, setLocalAvailabilityStatus] = useState(
    vehicle.availabilityStatus || "available",
  );
  const [availabilityWindow, setAvailabilityWindow] = useState({
    availableUntil: vehicle.availableUntil || null,
    nextScheduledTripTime: vehicle.nextScheduledTripTime || null,
  });

  // Sync local availability status when vehicle prop changes
  useEffect(() => {
    setLocalAvailabilityStatus(vehicle.availabilityStatus || "available");
    setAvailabilityWindow({
      availableUntil: vehicle.availableUntil || null,
      nextScheduledTripTime: vehicle.nextScheduledTripTime || null,
    });
  }, [
    vehicle.availabilityStatus,
    vehicle.availableUntil,
    vehicle.nextScheduledTripTime,
  ]);

  // Handle availability status toggle
  const handleAvailabilityToggle = async (newStatus) => {
    if (updatingAvailability || localAvailabilityStatus === newStatus) return;

    setUpdatingAvailability(true);
    try {
      const response = await api.put(
        `/b2c-partner/vehicles/${vehicle._id}/status`,
        {
          availabilityStatus: newStatus,
        },
      );

      if (response.data.success) {
        setLocalAvailabilityStatus(newStatus);
        // Update availability window info if returned
        if (
          response.data.availableUntil ||
          response.data.nextScheduledTripTime
        ) {
          setAvailabilityWindow({
            availableUntil: response.data.availableUntil,
            nextScheduledTripTime: response.data.nextScheduledTripTime,
          });
        } else {
          setAvailabilityWindow({
            availableUntil: null,
            nextScheduledTripTime: null,
          });
        }

        // Update Redux store for instant reactivity across the app
        dispatch(
          updateVehicleAvailabilityInStore({
            vehicleId: vehicle._id,
            availabilityStatus: newStatus,
            availableUntil: response.data.availableUntil,
            nextScheduledTripTime: response.data.nextScheduledTripTime,
          }),
        );

        if (onVehicleUpdated) {
          onVehicleUpdated({
            ...vehicle,
            availabilityStatus: newStatus,
            availableUntil: response.data.availableUntil,
            nextScheduledTripTime: response.data.nextScheduledTripTime,
          });
        }
      } else {
        throw new Error(response.data.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating vehicle availability:", error);
      // Show the error message from the backend (e.g., "Vehicle has incomplete trips")
      notify(
        error.response?.data?.message ||
          "Failed to update vehicle availability",
      );
    } finally {
      setUpdatingAvailability(false);
    }
  };

  // Get availability status color
  const getAvailabilityColor = (status) => {
    switch (status) {
      case "available":
        return "#10b981";
      case "busy":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  // Automatic slideshow effect
  useEffect(() => {
    if (vehicle.images && vehicle.images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % vehicle.images.length);
      }, 3000); // Change image every 3 seconds

      return () => clearInterval(interval);
    }
  }, [vehicle.images]);

  const openImageModal = () => {
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
      case "AVAILABLE":
        return "#10b981";
      case "Booked":
      case "BOOKED":
        return "#3b82f6";
      case "Maintenance":
      case "MAINTENANCE":
        return "#f59e0b";
      case "Inactive":
      case "INACTIVE":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "Active":
      case "AVAILABLE":
        return "Available";
      case "Booked":
      case "BOOKED":
        return "Booked";
      case "Maintenance":
      case "MAINTENANCE":
        return "Maintenance";
      case "Inactive":
      case "INACTIVE":
        return "Inactive";
      default:
        return "Unknown";
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete ${vehicle.model} (${vehicle.licensePlate})?`,
      )
    ) {
      setLoading(true);
      try {
        const response = await api.delete(
          `/b2c-partner/vehicles/${vehicle._id}`,
        );

        if (response.data.success) {
          notify("Vehicle deleted successfully!");
          // Call the parent callback to refresh the vehicle list
          if (onVehicleDeleted) {
            onVehicleDeleted(vehicle._id);
          } else {
            // Fallback: reload the page
            window.location.reload();
          }
        } else {
          throw new Error(response.data.message || "Failed to delete vehicle");
        }
      } catch (error) {
        console.error("Error deleting vehicle:", error);
        notify(
          `Failed to delete vehicle: ${error.response?.data?.message || error.message}`,
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const handleVehicleUpdated = (updatedVehicle) => {
    if (onVehicleUpdated) {
      onVehicleUpdated(updatedVehicle);
    } else {
      // Fallback: reload the page
      window.location.reload();
    }
  };

  // Handle vehicle images - use first image from array or placeholder
  const vehicleImage =
    vehicle.images && vehicle.images.length > 0
      ? vehicle.images[0].url || vehicle.images[0]
      : `https://via.placeholder.com/300x200/4f46e5/ffffff?text=${encodeURIComponent(vehicle.model || "Vehicle")}`;

  return (
    <>
      <div className="b2c-vehicle-card">
        <div className="b2c-vehicle-header">
          <div className="b2c-vehicle-image-container">
            {vehicle.images && vehicle.images.length > 0 ? (
              <>
                <img
                  src={
                    vehicle.images[currentImageIndex]?.url ||
                    vehicle.images[currentImageIndex]
                  }
                  alt={`${vehicle.model} - Image ${currentImageIndex + 1}`}
                  className="b2c-vehicle-image"
                  onClick={openImageModal}
                />
                {vehicle.images.length > 1 && (
                  <div className="b2c-image-counter">
                    {currentImageIndex + 1}/{vehicle.images.length}
                  </div>
                )}
              </>
            ) : (
              <img
                src={vehicleImage}
                alt={vehicle.model || "Vehicle"}
                className="b2c-vehicle-image"
                onError={(e) => {
                  e.target.src = `https://via.placeholder.com/300x200/ef4444/ffffff?text=No+Image`;
                }}
              />
            )}
            <div
              className="b2c-vehicle-status"
              style={{
                backgroundColor:
                  localAvailabilityStatus === "busy"
                    ? "#ef4444"
                    : getStatusColor(vehicle.status),
              }}
            >
              {localAvailabilityStatus === "busy"
                ? "BUSY"
                : getStatusText(vehicle.status)}
            </div>
          </div>
        </div>

        <div className="b2c-vehicle-body">
          <div className="b2c-vehicle-title">
            <h3 className="b2c-vehicle-model">
              {vehicle.model || "Unknown Model"}
            </h3>
            <span className="b2c-vehicle-type">
              {vehicle.type || vehicle.vehicleType || "Standard"}
            </span>
          </div>

          <div className="b2c-vehicle-specs">
            <div className="b2c-spec-item">
              <div className="b2c-spec-icon">🚗</div>
              <div className="b2c-spec-details">
                <span className="b2c-spec-label">License Plate</span>
                <span className="b2c-spec-value">
                  {vehicle.licensePlate || "N/A"}
                </span>
              </div>
            </div>

            <div className="b2c-spec-item">
              <div className="b2c-spec-icon">👥</div>
              <div className="b2c-spec-details">
                <span className="b2c-spec-label">Capacity</span>
                <span className="b2c-spec-value">
                  {vehicle.capacity || vehicle.seatingCapacity || 0} Seats
                </span>
              </div>
            </div>

            <div className="b2c-spec-item">
              <div className="b2c-spec-icon">📅</div>
              <div className="b2c-spec-details">
                <span className="b2c-spec-label">Year</span>
                <span className="b2c-spec-value">{vehicle.year || "N/A"}</span>
              </div>
            </div>

            {vehicle.vehicleColor && (
              <div className="b2c-spec-item">
                <div className="b2c-spec-icon">🎨</div>
                <div className="b2c-spec-details">
                  <span className="b2c-spec-label">Color</span>
                  <span className="b2c-spec-value">{vehicle.vehicleColor}</span>
                </div>
              </div>
            )}

            {vehicle.insuranceExpiry && (
              <div className="b2c-spec-item">
                <div className="b2c-spec-icon">🛡️</div>
                <div className="b2c-spec-details">
                  <span className="b2c-spec-label">Insurance</span>
                  <span className="b2c-spec-value">
                    {new Date(vehicle.insuranceExpiry).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}

            {vehicle.registrationExpiry && (
              <div className="b2c-spec-item">
                <div className="b2c-spec-icon">📋</div>
                <div className="b2c-spec-details">
                  <span className="b2c-spec-label">Registration</span>
                  <span className="b2c-spec-value">
                    {new Date(vehicle.registrationExpiry).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {vehicle.features && vehicle.features.length > 0 && (
            <div className="b2c-vehicle-features">
              <span className="b2c-features-label">Features:</span>
              <div className="b2c-features-list">
                {vehicle.features.slice(0, 3).map((feature, index) => (
                  <span key={index} className="b2c-feature-tag">
                    {feature}
                  </span>
                ))}
                {vehicle.features.length > 3 && (
                  <span className="b2c-feature-more">
                    +{vehicle.features.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Vehicle Availability Status Toggle */}
        <div
          className="b2c-vehicle-availability"
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            padding: "12px 16px",
            marginTop: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: getAvailabilityColor(
                    localAvailabilityStatus,
                  ),
                  boxShadow: `0 0 6px ${getAvailabilityColor(localAvailabilityStatus)}50`,
                }}
              />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#334155",
                }}
              >
                Availability Status
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => handleAvailabilityToggle("available")}
                disabled={updatingAvailability}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "500",
                  border:
                    localAvailabilityStatus === "available"
                      ? "2px solid #10b981"
                      : "1px solid #e2e8f0",
                  backgroundColor:
                    localAvailabilityStatus === "available"
                      ? "#ecfdf5"
                      : "#fff",
                  color:
                    localAvailabilityStatus === "available"
                      ? "#10b981"
                      : "#64748b",
                  cursor: updatingAvailability ? "wait" : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {updatingAvailability && localAvailabilityStatus !== "available"
                  ? "..."
                  : "Available"}
              </button>
              <button
                onClick={() => handleAvailabilityToggle("busy")}
                disabled={updatingAvailability}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "500",
                  border:
                    localAvailabilityStatus === "busy"
                      ? "2px solid #ef4444"
                      : "1px solid #e2e8f0",
                  backgroundColor:
                    localAvailabilityStatus === "busy" ? "#fef2f2" : "#fff",
                  color:
                    localAvailabilityStatus === "busy" ? "#ef4444" : "#64748b",
                  cursor: updatingAvailability ? "wait" : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {updatingAvailability && localAvailabilityStatus !== "busy"
                  ? "..."
                  : "Busy"}
              </button>
            </div>
          </div>

          {/* Availability Window Display */}
          {localAvailabilityStatus === "available" &&
            availabilityWindow.nextScheduledTripTime && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  backgroundColor: "#dbeafe",
                  borderRadius: "6px",
                  border: "1px solid #93c5fd",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "14px" }}>&#128337;</span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#1e40af",
                    fontWeight: "500",
                  }}
                >
                  Available until {availabilityWindow.nextScheduledTripTime}{" "}
                  (next trip)
                </span>
              </div>
            )}
        </div>

        <div className="b2c-vehicle-footer">
          <button
            className="b2c-action-btn b2c-edit-btn"
            onClick={handleEdit}
            disabled={loading}
          >
            <span className="b2c-btn-icon">✏️</span>
            Edit
          </button>
          <button
            className="b2c-action-btn b2c-delete-btn"
            onClick={handleDelete}
            disabled={loading}
          >
            <span className="b2c-btn-icon">🗑️</span>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Edit Vehicle Modal */}
      <B2C_EditVehicleModal
        vehicle={vehicle}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onVehicleUpdated={handleVehicleUpdated}
      />

      {/* Image Gallery Modal */}
      {showImageModal && vehicle.images && vehicle.images.length > 0 && (
        <div className="b2c-image-modal-overlay">
          <div
            className="b2c-image-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="b2c-image-modal-header">
              <h3>Vehicle Images</h3>
              <button className="b2c-modal-close-btn" onClick={closeImageModal}>
                ×
              </button>
            </div>
            <div className="b2c-image-gallery">
              {vehicle.images.map((image, index) => (
                <div
                  key={index}
                  className={`b2c-gallery-item ${index === currentImageIndex ? "active" : ""}`}
                  onClick={() => setCurrentImageIndex(index)}
                >
                  <img
                    src={image.url || image}
                    alt={`${vehicle.model} - Image ${index + 1}`}
                    className="b2c-gallery-image"
                  />
                  <div className="b2c-gallery-overlay">
                    <span className="b2c-gallery-icon">🔍</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default B2C_VehicleCard;
