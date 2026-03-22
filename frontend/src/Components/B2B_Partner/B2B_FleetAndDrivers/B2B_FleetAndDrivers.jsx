"use client"

import { useState, useEffect } from "react"
import B2B_VehiclesTab from "../B2B_FleetAndDriversSub/B2B_VehiclesTab/B2B_VehiclesTab"
import B2B_DriversTab from "../B2B_FleetAndDriversSub/B2B_DriversTab/B2B_DriversTab"
import B2B_AddDriverModal from "../B2B_FleetAndDriversSub/B2B_AddDriverModal/B2B_AddDriverModal"
import B2B_AddVehicleModal from "../B2B_FleetAndDriversSub/B2B_AddVehicleModal/B2B_AddVehicleModal"
import "./b2b_fleetanddrivers.css"
import api from "../../../utils/api"

function B2B_FleetAndDrivers() {
  const [activeSubTab, setActiveSubTab] = useState("vehicles")
  const [showAddDriverModal, setShowAddDriverModal] = useState(false)
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false)
  const [fleetData, setFleetData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFleetData()
  }, [])

  const fetchFleetData = async () => {
    try {
      setLoading(true)
      const [driversResponse, vehiclesResponse] = await Promise.all([
        api.get('/b2b/drivers'),
        api.get('/vehicles/my/vehicles')
      ])
      
      setFleetData({
        drivers: driversResponse.data.drivers || [],
        vehicles: vehiclesResponse.data.data?.vehicles || []
      })
    } catch (error) {
      console.error("Error fetching fleet data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDriver = async (driverData) => {
    try {
      const response = await api.post('/b2b/drivers', driverData)
      if (response.data.success) {
        setShowAddDriverModal(false)
        fetchFleetData()
      }
    } catch (error) {
      console.error("Error adding driver:", error)
      alert("Failed to add driver. Please try again.")
    }
  }

  const handleAddVehicle = async (vehicleData) => {
    try {
      const response = await api.post('/vehicles/my/vehicles', vehicleData)
      if (response.data.success) {
        setShowAddVehicleModal(false)
        fetchFleetData()
      }
    } catch (error) {
      console.error("Error adding vehicle:", error)
      alert("Failed to add vehicle. Please try again.")
    }
  }

  if (loading) {
    return (
      <div className="b2b-operator-dashboard-fleet-and-drivers">
        <div className="b2b-operator-dashboard-loading">
          Loading fleet data...
        </div>
      </div>
    );
  }

  if (!fleetData) {
    return (
      <div className="b2b-operator-dashboard-fleet-and-drivers">
        <div className="b2b-operator-dashboard-error">
          Failed to load fleet data
        </div>
      </div>
    );
  }

  return (
    <div className="b2b-operator-dashboard-fleet-and-drivers">
      <div className="b2b-operator-dashboard-fleet-header">
        <h2 className="b2b-operator-dashboard-fleet-title">Fleet Management</h2>
        {activeSubTab === "drivers" ? (
          <button
            className="b2b-operator-dashboard-add-btn"
            onClick={() => setShowAddDriverModal(true)}
          >
            + Add Driver
          </button>
        ) : (
          <button
            className="b2b-operator-dashboard-add-btn"
            onClick={() => setShowAddVehicleModal(true)}
          >
            + Add Vehicle
          </button>
        )}
      </div>

      <div className="b2b-operator-dashboard-fleet-tabs">
        <button
          className={`b2b-operator-dashboard-fleet-tab ${activeSubTab === "vehicles" ? "b2b-operator-dashboard-active" : ""}`}
          onClick={() => setActiveSubTab("vehicles")}
        >
          🚗 Vehicles ({fleetData.vehicles?.length || 0})
        </button>
        <button
          className={`b2b-operator-dashboard-fleet-tab ${activeSubTab === "drivers" ? "b2b-operator-dashboard-active" : ""}`}
          onClick={() => setActiveSubTab("drivers")}
        >
          👤 Drivers ({fleetData.drivers?.length || 0})
        </button>
      </div>

      <div className="b2b-operator-dashboard-fleet-content">
        {activeSubTab === "vehicles" ? (
          <B2B_VehiclesTab
            vehicles={fleetData.vehicles || []}
            onRefresh={fetchFleetData}
          />
        ) : (
          <B2B_DriversTab
            drivers={fleetData.drivers || []}
            onRefresh={fetchFleetData}
          />
        )}
      </div>

      {/* Add Driver Modal */}
      {showAddDriverModal && (
        <B2B_AddDriverModal
          onClose={() => setShowAddDriverModal(false)}
          onSave={handleAddDriver}
        />
      )}

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && (
        <B2B_AddVehicleModal
          onClose={() => setShowAddVehicleModal(false)}
          onSave={handleAddVehicle}
        />
      )}
    </div>
  );
}

export default B2B_FleetAndDrivers
