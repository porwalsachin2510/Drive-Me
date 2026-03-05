"use client";

import { useState } from "react";
import "./b2c_drivercard.css";

function B2C_DriverCard({ driver }) {
  const _getStatusColor = (status) => {
    switch (status) {
      case "Active":
      case "AVAILABLE":
        return "#10b981";
      case "On Leave":
      case "ON_LEAVE":
        return "#f59e0b";
      case "Inactive":
      case "INACTIVE":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getDriverImage = () => {
    if (driver.driverImage?.url) {
      return driver.driverImage.url;
    }
    return "/placeholder-driver.jpg";
  };

  const getDriverName = () => {
    return driver.name || driver.fullName || "Unknown Driver";
  };

  const getDriverStatus = () => {
    return driver.status || driver.driverInfo?.status || "AVAILABLE";
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
              <span className="b2c-phone">📱 {driver.phoneNumber || driver.phone || "N/A"}</span>
            </div>
          </div>
          
          <div className="b2c-driver-details-grid">
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">🪪 License</span>
              <span className="b2c-detail-value">{driver.licenseNumber || "N/A"}</span>
            </div>
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">🌍 Nationality</span>
              <span className="b2c-detail-value">{driver.nationality || "N/A"}</span>
            </div>
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">💼 Experience</span>
              <span className="b2c-detail-value">{driver.experience || "0"} years</span>
            </div>
          </div>
        </div>
      </div>

      <div className="b2c-driver-vehicles">
        <h4>Assigned Vehicles</h4>
        {driver.assignedVehicles && driver.assignedVehicles.length > 0 ? (
          <div className="b2c-vehicle-list">
            {driver.assignedVehicles.map((vehicle, index) => (
              <span key={index} className="b2c-vehicle-tag">
                {vehicle.model} ({vehicle.licensePlate})
              </span>
            ))}
          </div>
        ) : (
          <p className="b2c-no-vehicles">No vehicles assigned</p>
        )}
      </div>

      <div className="b2c-driver-actions">
        <button 
          className="b2c-action-btn b2c-edit-btn"
          onClick={() => console.log("Edit driver:", driver._id)}
        >
          ✏️ Edit
        </button>
        <button 
          className="b2c-action-btn b2c-assign-btn"
          onClick={() => console.log("Assign vehicle:", driver._id)}
        >
          🚗 Assign
        </button>
        <button 
          className="b2c-action-btn b2c-delete-btn"
          onClick={() => console.log("Delete driver:", driver._id)}
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}

export default B2C_DriverCard;
