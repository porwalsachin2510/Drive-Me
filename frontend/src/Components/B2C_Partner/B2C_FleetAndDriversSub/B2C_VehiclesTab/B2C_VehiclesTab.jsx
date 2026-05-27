"use client";

import React, { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import B2C_VehicleCard from "../B2C_VehicleCard/B2C_VehicleCard";
import { fetchB2CPartnerVehicles } from "../../../../Redux/slices/b2cPartnerSlice";
import api from "../../../../utils/api";
import "./b2c_vehiclestab.css";

function B2C_VehiclesTab({ vehicles: propVehicles, onVehicleUpdated }) {
  const dispatch = useDispatch();
  const { vehicles: reduxVehicles } = useSelector((state) => state.b2cPartner);
  const pollIntervalRef = useRef(null);

  // Use Redux vehicles if available, otherwise use prop vehicles
  // This ensures real-time updates from socket events are reflected
  const vehicles = reduxVehicles.length > 0 ? reduxVehicles : propVehicles;

  // Fetch vehicles on mount to populate Redux store
  useEffect(() => {
    dispatch(fetchB2CPartnerVehicles());
  }, [dispatch]);

  // Poll for vehicle availability changes every 5 seconds
  useEffect(() => {
    const pollVehicles = async () => {
      try {
        // Fetch fresh vehicle data from backend
        dispatch(fetchB2CPartnerVehicles());
      } catch (error) {
        // Silent fail - don't disrupt user experience
        console.error("[v0] Error polling vehicles:", error);
      }
    };

    // Start polling every 5 seconds
    pollIntervalRef.current = setInterval(pollVehicles, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [dispatch]);

  const handleVehicleDeleted = (deletedVehicleId) => {
    // Refresh vehicles from Redux
    dispatch(fetchB2CPartnerVehicles());
  };

  const handleVehicleUpdated = (updatedVehicle) => {
    // Refresh vehicles from Redux
    dispatch(fetchB2CPartnerVehicles());
    if (onVehicleUpdated) {
      onVehicleUpdated(updatedVehicle);
    }
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
              onVehicleUpdated={handleVehicleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default B2C_VehiclesTab;
