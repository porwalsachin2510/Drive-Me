"use client";

import { useState } from "react";
import "./vehiclecard.css";

function VehicleCard({ vehicle }) {
  // eslint-disable-next-line no-unused-vars
  const [activeStatus, setActiveStatus] = useState(vehicle.status);

  return (
    <div className="vehicle-card">
      <div className="card-top">
        <div className="vehicle-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="19" stroke="#e5e7eb" strokeWidth="1" />
            <path d="M12 20H28" stroke="#6b7280" strokeWidth="1.5" />
            <path
              d="M14 18L15 12C15.5 10 16 9 18 9H22C24 9 24.5 10 25 12L26 18"
              stroke="#6b7280"
              strokeWidth="1.5"
            />
            <circle cx="14" cy="24" r="2" stroke="#6b7280" strokeWidth="1" />
            <circle cx="26" cy="24" r="2" stroke="#6b7280" strokeWidth="1" />
          </svg>
        </div>

        <div className="vehicle-status">
          <span className={`status-badge ${activeStatus.toLowerCase()}`}>
            {activeStatus}
          </span>
        </div>
      </div>

      <div className="vehicle-info">
        <h3 className="vehicle-model">{vehicle.model}</h3>
        <p className="vehicle-details">
          {vehicle.plate} • {vehicle.year}
        </p>
        <p className="vehicle-service">Next Service: {vehicle.nextService}</p>
      </div>

      <div className="vehicle-actions">
        <button
          className={`action-btn ${
            activeStatus === "Active" ? "secondary" : "primary"
          }`}
        >
          {activeStatus === "Active" ? "Set Maintenance" : "Set Active"}
        </button>
        <button className="settings-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="3" r="1.5" fill="#6b7280" />
            <circle cx="10" cy="10" r="1.5" fill="#6b7280" />
            <circle cx="10" cy="17" r="1.5" fill="#6b7280" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default VehicleCard;
