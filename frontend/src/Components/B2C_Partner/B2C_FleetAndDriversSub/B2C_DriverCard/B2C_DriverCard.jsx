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
          </div>
        </div>
      </div>

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
