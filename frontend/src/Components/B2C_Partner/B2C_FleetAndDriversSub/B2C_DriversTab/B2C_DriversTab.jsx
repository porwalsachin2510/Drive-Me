"use client";

import { useState, useEffect, useCallback } from "react";
import api from "../../../../utils/api";
import B2C_DriverCard from "../B2C_DriverCard/B2C_DriverCard";
import B2C_EditDriverModal from "../B2C_EditDriverModal/B2C_EditDriverModal";
import "./b2c_driverstab.css";

function B2C_DriversTab() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchDrivers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/b2c-partner/drivers");

      if (response.data.success) {
        setDrivers(response.data.drivers || []);
      } else {
        console.error("Failed to fetch drivers:", response.data.message);
      }
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const handleEditDriver = (driver) => {
    setSelectedDriver(driver);
    setShowEditModal(true);
  };

  const handleDeleteDriver = async (driverId) => {
    try {
      const response = await api.delete(`/b2c-partner/drivers/${driverId}`);

      if (response.data.success) {
        // Refresh the drivers list
        await fetchDrivers();
        return true;
      } else {
        alert(response.data.message || "Failed to delete driver");
        return false;
      }
    } catch (error) {
      console.error("Error deleting driver:", error);
      alert(error.response?.data?.message || "Error deleting driver");
      return false;
    }
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setSelectedDriver(null);
  };

  const handleDriverUpdated = () => {
    fetchDrivers();
    handleEditModalClose();
  };

  if (loading) {
    return (
      <div className="b2c-drivers-tab">
        <div className="b2c-loading-state">
          <div className="b2c-loading-spinner">⏳</div>
          <p>Loading drivers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="b2c-drivers-tab">
      {drivers.length === 0 ? (
        <div className="b2c-empty-state">
          <div className="b2c-empty-icon">👤</div>
          <h3 className="b2c-empty-title">No Drivers Added</h3>
          <p className="b2c-empty-description">
            Add your first driver to manage your transportation services
          </p>
        </div>
      ) : (
        <div className="b2c-drivers-grid">
          {drivers.map((driver) => (
            <B2C_DriverCard
              key={driver._id}
              driver={driver}
              onEdit={handleEditDriver}
              onDelete={handleDeleteDriver}
              onRefresh={fetchDrivers}
            />
          ))}
        </div>
      )}

      {showEditModal && selectedDriver && (
        <B2C_EditDriverModal
          driver={selectedDriver}
          onClose={handleEditModalClose}
          onSuccess={handleDriverUpdated}
        />
      )}
    </div>
  );
}

export default B2C_DriversTab;
