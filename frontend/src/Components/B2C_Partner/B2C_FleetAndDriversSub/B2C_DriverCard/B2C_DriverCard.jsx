"use client";

import { useState } from "react";
import "./b2c_drivercard.css";

/* Inline brand SVG icons (no emoji — per design system) */
const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
    <path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11 11 0 003.5.56 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.56 3.5 1 1 0 01-.24 1L6.6 10.8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
const IconLicense = () => (
  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="8.5" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
    <path d="M13 10h5M13 13.5h5M6 15.5c.5-1.4 4-1.4 4.5 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconGlobe = () => (
  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const IconBriefcase = () => (
  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
    <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const IconStar = () => (
  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
    <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconEdit = () => (
  <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
    <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
    <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// eslint-disable-next-line no-unused-vars
function B2C_DriverCard({ driver, onEdit, onDelete, onRefresh }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const getDriverImage = () => {
    if (driver.driverImage?.url) return driver.driverImage.url;
    if (driver.profileImage) return driver.profileImage;
    return null;
  };

  const getDriverName = () => {
    if (driver.isSelf) return driver.fullName || "Self";
    return driver.name || driver.fullName || "Unknown Driver";
  };

  const getInitials = () => {
    const name = getDriverName();
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "D";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getDriverStatus = () => {
    return driver.status || driver.driverInfo?.status || "AVAILABLE";
  };

  const getPhoneNumber = () => {
    return driver.phoneNumber || driver.phone || driver.whatsappNumber || "N/A";
  };

  const getLicenseNumber = () => {
    if (driver.isSelf) return driver.licenseNumber || "Not provided";
    return driver.licenseNumber || "N/A";
  };

  const getNationality = () => driver.nationality || "N/A";

  const getExperience = () => {
    const exp = driver.experience || driver.yearsOfExperience;
    if (exp === null || exp === undefined) return "N/A";
    return `${exp} yrs`;
  };

  const getRating = () => {
    const avg = driver.ratings?.average;
    const count = driver.ratings?.count || 0;
    // New drivers with no reviews show "New" instead of a fake 0.0 score.
    return {
      isNew: !count,
      average: avg ? avg.toFixed(1) : "0.0",
      count: count,
    };
  };

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
    if (window?.canBeAvailableBetweenTrips) {
      return {
        status: "available",
        label: `Until ${window.availableUntilFormatted}`,
        color: "#16a34a",
      };
    }
    return { status: "available", label: "Available", color: "#16a34a" };
  };

  const handleEditClick = () => {
    if (onEdit) onEdit(driver);
  };

  const handleDeleteClick = async () => {
    if (driver.isSelf) return;
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

  const rating = getRating();
  const availStatus = getAvailabilityStatusDisplay();
  const image = getDriverImage();
  const showImage = image && !imgError;
  const window = getAvailabilityWindow();

  return (
    <div className="b2c-driver-card">
      {/* Header band */}
      <div className="b2c-driver-header">
        <div className="b2c-driver-badges">
          <span
            className="b2c-availability-badge"
            style={{ backgroundColor: availStatus.color }}
          >
            <span className="b2c-availability-dot" />
            {availStatus.label}
          </span>
          <span className="b2c-status-text" data-status={getDriverStatus()}>
            {getDriverStatus()}
          </span>
        </div>

        <div className="b2c-driver-identity">
          <div className="b2c-driver-image">
            {showImage ? (
              <img
                src={image || "/placeholder.svg"}
                alt={getDriverName()}
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="b2c-driver-initials">{getInitials()}</span>
            )}
          </div>
          <div className="b2c-driver-header-info">
            <h3 className="b2c-driver-name">{getDriverName()}</h3>
            <div className="b2c-contact-info">
              <span className="b2c-contact-line">
                <IconMail />
                {driver.email || "N/A"}
              </span>
              <span className="b2c-contact-line">
                <IconPhone />
                {getPhoneNumber()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="b2c-driver-details-grid">
        <div className="b2c-detail-item">
          <span className="b2c-detail-ico">
            <IconLicense />
          </span>
          <div className="b2c-detail-text">
            <span className="b2c-detail-label">License</span>
            <span className="b2c-detail-value">{getLicenseNumber()}</span>
          </div>
        </div>
        <div className="b2c-detail-item">
          <span className="b2c-detail-ico">
            <IconGlobe />
          </span>
          <div className="b2c-detail-text">
            <span className="b2c-detail-label">Nationality</span>
            <span className="b2c-detail-value">{getNationality()}</span>
          </div>
        </div>
        <div className="b2c-detail-item">
          <span className="b2c-detail-ico">
            <IconBriefcase />
          </span>
          <div className="b2c-detail-text">
            <span className="b2c-detail-label">Experience</span>
            <span className="b2c-detail-value">{getExperience()}</span>
          </div>
        </div>
        <div className="b2c-detail-item">
          <span className="b2c-detail-ico b2c-detail-ico-star">
            <IconStar />
          </span>
          <div className="b2c-detail-text">
            <span className="b2c-detail-label">Rating</span>
            <span className="b2c-detail-value">
              {rating.isNew
                ? "New"
                : `${rating.average} / 5 (${rating.count})`}
            </span>
          </div>
        </div>
      </div>

      {/* Availability Window Section */}
      {window && (
        <div className="b2c-availability-window-section">
          {window.hasCompletedTripsToday && (
            <div className="b2c-completed-trips">
              <span className="b2c-section-label">Completed Today:</span>
              <span className="b2c-completed-count">
                {window.completedTripsToday.length} trip(s)
              </span>
            </div>
          )}
          {window.inProgressTrip && (
            <div className="b2c-in-progress-trip">
              <span className="b2c-section-label">Currently On Trip:</span>
              <span className="b2c-trip-info">
                {window.inProgressTrip.fromLocation} →{" "}
                {window.inProgressTrip.toLocation}
              </span>
            </div>
          )}
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
          {window.canBeAvailableBetweenTrips && (
            <div className="b2c-availability-window-msg">
              <IconClock />
              <span className="b2c-window-text">
                Available for assignment until {window.availableUntilFormatted}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="b2c-driver-actions">
        <button
          className="b2c-action-btn b2c-edit-btn"
          onClick={handleEditClick}
        >
          <IconEdit />
          Edit
        </button>
        {!driver.isSelf && (
          <button
            className="b2c-action-btn b2c-delete-btn"
            onClick={handleDeleteClick}
            disabled={isDeleting}
          >
            <IconTrash />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}

export default B2C_DriverCard;
