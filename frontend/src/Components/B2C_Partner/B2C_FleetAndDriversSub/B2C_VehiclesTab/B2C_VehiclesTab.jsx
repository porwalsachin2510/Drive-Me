"use client";

import React from "react";
import B2C_VehicleCard from "../B2C_VehicleCard/B2C_VehicleCard";
import "./b2c_vehiclestab.css";

function B2C_VehiclesTab({ vehicles }) {
  const handleVehicleDeleted = (deletedVehicleId) => {
    console.log("Vehicle deleted:", deletedVehicleId);
    // The parent component will handle the refresh
    window.location.reload();
  };

  return (
    <div className="b2c-vehicles-tab">
      {!vehicles || vehicles.length === 0 ? (
        <div className="b2c-empty-state">
          <div className="b2c-empty-icon">🚗</div>
          <h3 className="b2c-empty-title">No Vehicles Added</h3>
          <p className="b2c-empty-description">
            Start by adding your first vehicle to your fleet
          </p>
        </div>
      ) : (
        <div className="b2c-vehicles-grid">
          {vehicles.map((vehicle) => (
            <B2C_VehicleCard 
              key={vehicle._id} 
              vehicle={vehicle} 
              onVehicleDeleted={handleVehicleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default B2C_VehiclesTab;
