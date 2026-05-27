"use client";

import { useState } from "react";
import "./b2c_drivercard.css";

// eslint-disable-next-line no-unused-vars
function B2C_DriverCard({ driver, onEdit, onDelete, onRefresh }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const getDriverImage = () => {
    // Check multiple possible image field names
    if (driver.driverImage?.url) {
      return driver.driverImage.url;
    }
    if (driver.profileImage) {
      return driver.profileImage;
    }
    return "/placeholder-driver.jpg";
  };

  const getDriverName = () => {
    if (driver.isSelf) {
      return driver.fullName || "Self";
    }
    return driver.name || driver.fullName || "Unknown Driver";
  };

  const getDriverStatus = () => {
    return driver.status || driver.driverInfo?.status || "AVAILABLE";
  };

  const getPhoneNumber = () => {
    return driver.phoneNumber || driver.phone || driver.whatsappNumber || "N/A";
  };

  const getLicenseNumber = () => {
    if (driver.isSelf) {
      return driver.licenseNumber || "Not provided";
    }
    return driver.licenseNumber || "N/A";
  };

  const getNationality = () => {
    return driver.nationality || "N/A";
  };

  const getExperience = () => {
    const exp = driver.experience || driver.yearsOfExperience;
    if (exp === null || exp === undefined) {
      return "N/A";
    }
    return `${exp} years`;
  };

  const getRating = () => {
    const avg = driver.ratings?.average;
    const count = driver.ratings?.count || 0;
    return {
      average: avg ? avg.toFixed(1) : "0.0",
      count: count,
    };
  };

  // Get availability window information
  const getAvailabilityWindow = () => {
    const window = driver.availabilityWindow;
    if (!window) return null;

    return {
      completedTripsToday: window.completedTripsToday || [],
      nextScheduledTrip: window.nextScheduledTrip,
      availableUntilFormatted: window.availableUntilFormatted,
      timeUntilNextTrip: window.timeUntilNextTrip,
      hasCompletedTripsToday: window.hasCompletedTripsToday,
      hasUpcomingTrips: window.hasUpcomingTrips,
      canBeAvailableBetweenTrips: window.canBeAvailableBetweenTrips,
      inProgressTrip: window.inProgressTrip,
    };
  };

  // Get availability status display
  const getAvailabilityStatusDisplay = () => {
    const status =
      driver.availabilityStatus || driver.availability?.status || "available";
    const window = getAvailabilityWindow();

    if (window?.inProgressTrip) {
      return { status: "busy", label: "On Trip", color: "#f59e0b" };
    }

    if (status === "busy") {
      return { status: "busy", label: "Busy", color: "#ef4444" };
    }

    if (status === "offline") {
      return { status: "offline", label: "Offline", color: "#6b7280" };
    }

    // Available - check if between trips
    if (window?.canBeAvailableBetweenTrips) {
      return {
        status: "available",
        label: `Available until ${window.availableUntilFormatted}`,
        color: "#10b981",
      };
    }

    return { status: "available", label: "Available", color: "#10b981" };
  };

  const handleEditClick = () => {
    if (onEdit) {
      onEdit(driver);
    }
  };

  const handleDeleteClick = async () => {
    if (driver.isSelf) {
      return; // Cannot delete self
    }

    if (
      !window.confirm(
        `Are you sure you want to delete driver "${getDriverName()}"?`,
      )
    ) {
      return;
    }

    if (onDelete) {
      setIsDeleting(true);
      try {
        await onDelete(driver._id);
      } catch (error) {
        console.error("Error deleting driver:", error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="b2c-driver-card">
      <div className="b2c-status-badge">
        <span className="b2c-status-text" data-status={getDriverStatus()}>
          {getDriverStatus()}
        </span>
      </div>

      {/* Availability Status Badge */}
      {(() => {
        const availStatus = getAvailabilityStatusDisplay();
        return (
          <div
            className="b2c-availability-badge"
            style={{ backgroundColor: availStatus.color }}
          >
            <span
              className="b2c-availability-dot"
              style={{
                backgroundColor:
                  availStatus.status === "available"
                    ? "#fff"
                    : "rgba(255,255,255,0.5)",
              }}
            ></span>
            <span className="b2c-availability-label">{availStatus.label}</span>
          </div>
        );
      })()}

      <div className="b2c-driver-header">
        <div className="b2c-driver-image">
          <img
            src={getDriverImage()}
            alt={getDriverName()}
            onError={(e) => {
              e.target.src = "/placeholder-driver.jpg";
            }}
          />
        </div>

        <div className="b2c-driver-info">
          <div className="b2c-driver-header-info">
            <h3 className="b2c-driver-name">{getDriverName()}</h3>
            <div className="b2c-contact-info">
              <span className="b2c-email">📧 {driver.email || "N/A"}</span>
              <span className="b2c-phone">📱 {getPhoneNumber()}</span>
            </div>
          </div>

          <div className="b2c-driver-details-grid">
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">🪪 License</span>
              <span className="b2c-detail-value">{getLicenseNumber()}</span>
            </div>
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">🌍 Nationality</span>
              <span className="b2c-detail-value">{getNationality()}</span>
            </div>
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">💼 Experience</span>
              <span className="b2c-detail-value">{getExperience()}</span>
            </div>
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">⭐ Rating</span>
              <span className="b2c-detail-value">
                {getRating().average} / 5 ({getRating().count} reviews)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Availability Window Section */}
      {(() => {
        const window = getAvailabilityWindow();
        if (!window) return null;

        return (
          <div className="b2c-availability-window-section">
            {/* Completed Trips Today */}
            {window.hasCompletedTripsToday && (
              <div className="b2c-completed-trips">
                <span className="b2c-section-label">Completed Today:</span>
                <span className="b2c-completed-count">
                  {window.completedTripsToday.length} trip(s)
                </span>
              </div>
            )}

            {/* In Progress Trip */}
            {window.inProgressTrip && (
              <div className="b2c-in-progress-trip">
                <span className="b2c-section-label">Currently On Trip:</span>
                <span className="b2c-trip-info">
                  {window.inProgressTrip.fromLocation} →{" "}
                  {window.inProgressTrip.toLocation}
                </span>
              </div>
            )}

            {/* Next Scheduled Trip */}
            {window.nextScheduledTrip && !window.inProgressTrip && (
              <div className="b2c-next-trip">
                <span className="b2c-section-label">Next Trip:</span>
                <span className="b2c-trip-time">
                  {window.nextScheduledTrip.departureTime}
                </span>
                <span className="b2c-trip-route">
                  {window.nextScheduledTrip.fromLocation} →{" "}
                  {window.nextScheduledTrip.toLocation}
                </span>
                {window.timeUntilNextTrip && (
                  <span className="b2c-time-until">
                    in {window.timeUntilNextTrip}
                  </span>
                )}
              </div>
            )}

            {/* Availability Window Message */}
            {window.canBeAvailableBetweenTrips && (
              <div className="b2c-availability-window-msg">
                <span className="b2c-window-icon">🕐</span>
                <span className="b2c-window-text">
                  Available for assignment until{" "}
                  {window.availableUntilFormatted}
                </span>
              </div>
            )}
          </div>
        );
      })()}
      
      <div className="b2c-driver-actions">
        <button
          className="b2c-action-btn b2c-edit-btn"
          onClick={handleEditClick}
        >
          ✏️ Edit
        </button>
        {!driver.isSelf && (
          <button
            className="b2c-action-btn b2c-delete-btn"
            onClick={handleDeleteClick}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "🗑️ Delete"}
          </button>
        )}
      </div>
    </div>
  );
}

export default B2C_DriverCard;
