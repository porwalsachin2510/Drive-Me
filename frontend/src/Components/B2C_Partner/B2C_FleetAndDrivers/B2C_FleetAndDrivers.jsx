"use client";

import { useState, useEffect } from "react";
import B2C_VehiclesTab from "../B2C_FleetAndDriversSub/B2C_VehiclesTab/B2C_VehiclesTab";
import B2C_DriversTab from "../B2C_FleetAndDriversSub/B2C_DriversTab/B2C_DriversTab";
import B2C_AddDriverModal from "../B2C_FleetAndDriversSub/B2C_AddDriverModal/B2C_AddDriverModal";
import B2C_AddVehicleModal from "../B2C_FleetAndDriversSub/B2C_AddVehicleModal/B2C_AddVehicleModal";
import "./b2c_fleetanddrivers.css";
import api from "../../../utils/api";

function B2C_FleetAndDrivers() {
  const [activeSubTab, setActiveSubTab] = useState("vehicles");
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [fleetData, setFleetData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFleetData();

    // Set up global callback for route creation to refresh fleet data
    window.onRouteCreated = () => {
      console.log("[v0] Route created, refreshing fleet data");
      fetchFleetData();
    };

    return () => {
      delete window.onRouteCreated;
    };
  }, []);

  const fetchFleetData = async () => {
    try {
      setLoading(true);
      const response = await api.get("/b2c-partner/fleet");
      setFleetData(response.data.fleet);
    } catch (error) {
      console.error("Error fetching fleet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDriver = async (driverData) => {
    try {
      await api.post("/b2c-partner/drivers", driverData);
      setShowAddDriverModal(false);
      fetchFleetData();
    } catch (error) {
      console.error("Error adding driver:", error);
    }
  };

  const handleAddVehicle = async (vehicleData) => {
    try {
      await api.post("/b2c-partner/vehicles", vehicleData);
      setShowAddVehicleModal(false);
      fetchFleetData();
    } catch (error) {
      console.error("Error adding vehicle:", error);
    }
  };

  if (loading) {
    return (
      <div className="b2c-fleet-and-drivers">
        <div className="loading">Loading fleet data...</div>
      </div>
    );
  }

  if (!fleetData) {
    return (
      <div className="b2c-fleet-and-drivers">
        <div className="error">Failed to load fleet data</div>
      </div>
    );
  }

  return (
    <div className="b2c-fleet-and-drivers">
      <div className="b2c-fleet-header">
        <h2 className="b2c-fleet-title">Fleet Management</h2>
        {activeSubTab === "drivers" ? (
          <button
            className="b2c-add-btn"
            onClick={() => setShowAddDriverModal(true)}
          >
            + Add Driver
          </button>
        ) : (
          <button
            className="b2c-add-btn"
            onClick={() => setShowAddVehicleModal(true)}
          >
            + Add Vehicle
          </button>
        )}
      </div>

      <div className="b2c-sub-tabs">
        <button
          className={`b2c-sub-tab ${activeSubTab === "vehicles" ? "active" : ""}`}
          onClick={() => setActiveSubTab("vehicles")}
        >
          Vehicles ({fleetData?.vehicles?.length || 0})
        </button>
        <button
          className={`b2c-sub-tab ${activeSubTab === "drivers" ? "active" : ""}`}
          onClick={() => setActiveSubTab("drivers")}
        >
          Drivers
        </button>
      </div>

      <div className="b2c-sub-tab-content">
        {activeSubTab === "vehicles" && (
          <B2C_VehiclesTab
            vehicles={fleetData?.vehicles || []}
            onVehicleUpdated={fetchFleetData}
          />
        )}
        {activeSubTab === "drivers" && <B2C_DriversTab />}
      </div>

      {showAddVehicleModal && (
        <B2C_AddVehicleModal
          onClose={() => setShowAddVehicleModal(false)}
          onSave={handleAddVehicle}
        />
      )}

      {showAddDriverModal && (
        <B2C_AddDriverModal
          onClose={() => setShowAddDriverModal(false)}
          onAddDriver={handleAddDriver}
        />
      )}
    </div>
  );
}

export default B2C_FleetAndDrivers;
