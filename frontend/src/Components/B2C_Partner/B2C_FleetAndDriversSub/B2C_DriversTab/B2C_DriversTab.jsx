"use client";

import { useState, useEffect, useCallback } from "react";
import api from "../../../../utils/api";
import B2C_DriverCard from "../B2C_DriverCard/B2C_DriverCard";
import B2C_EditDriverModal from "../B2C_EditDriverModal/B2C_EditDriverModal";
import "./b2c_driverstab.css";

function B2C_DriversTab({ onDriversCountChange }) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Self-driver registration state
  const [selfDriverStatus, setSelfDriverStatus] = useState({
    isRegistered: false,
    loading: true,
    toggling: false,
  });

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

  // Fetch self-driver registration status
  const fetchSelfDriverStatus = useCallback(async () => {
    try {
      const response = await api.get("/b2c-partner/self-driver/status");
      if (response.data.success) {
        setSelfDriverStatus((prev) => ({
          ...prev,
          isRegistered: response.data.isRegisteredAsDriver,
          loading: false,
        }));
      }
    } catch (error) {
      console.error("Error fetching self-driver status:", error);
      setSelfDriverStatus((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // Toggle self-driver registration
  const handleToggleSelfDriver = async () => {
    try {
      setSelfDriverStatus((prev) => ({ ...prev, toggling: true }));
      const newStatus = !selfDriverStatus.isRegistered;

      const response = await api.post("/b2c-partner/self-driver/toggle", {
        register: newStatus,
      });

      if (response.data.success) {
        setSelfDriverStatus((prev) => ({
          ...prev,
          isRegistered: response.data.isRegisteredAsDriver,
          toggling: false,
        }));
        // Refresh drivers list to show/hide self in the list
        fetchDrivers();
      } else {
        alert(response.data.message || "Failed to update self-driver status");
        setSelfDriverStatus((prev) => ({ ...prev, toggling: false }));
      }
    } catch (error) {
      console.error("Error toggling self-driver status:", error);
      alert(
        error.response?.data?.message || "Error updating self-driver status",
      );
      setSelfDriverStatus((prev) => ({ ...prev, toggling: false }));
    }
  };

  useEffect(() => {
    fetchDrivers();
    fetchSelfDriverStatus();
  }, [fetchDrivers, fetchSelfDriverStatus]);

  // Keep the parent tab badge in sync with the total drivers count.
  // The partner counts as a driver too when "Registered as Driver" is ON.
  useEffect(() => {
    if (typeof onDriversCountChange === "function") {
      const externalCount = drivers.filter((driver) => !driver.isSelf).length;
      const selfCount = selfDriverStatus.isRegistered ? 1 : 0;
      onDriversCountChange(externalCount + selfCount);
    }
  }, [drivers, selfDriverStatus.isRegistered, onDriversCountChange]);

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
          <div className="b2c-loading-spinner">Loading...</div>
          <p>Loading drivers...</p>
        </div>
      </div>
    );
  }

  // Filter out "Self" from the drivers list for display (it's handled separately in the toggle)
  const externalDrivers = drivers.filter((driver) => !driver.isSelf);

  return (
    <div className="b2c-drivers-tab">
      {/* Self-Driver Registration Section */}
      <div className="b2c-self-driver-section">
        <div className="b2c-self-driver-card">
          <div className="b2c-self-driver-info">
            <h4 className="b2c-self-driver-title">Drive Your Own Routes</h4>
            <p className="b2c-self-driver-description">
              Register yourself as a driver to appear in the driver dropdown
              when assigning trips. This allows you to drive your own routes
              without adding a separate driver.
            </p>
          </div>
          <div className="b2c-self-driver-toggle">
            <label className="b2c-toggle-switch">
              <input
                type="checkbox"
                checked={selfDriverStatus.isRegistered}
                onChange={handleToggleSelfDriver}
                disabled={selfDriverStatus.toggling || selfDriverStatus.loading}
              />
              <span className="b2c-toggle-slider"></span>
            </label>
            <span
              className={`b2c-toggle-label ${selfDriverStatus.isRegistered ? "active" : ""}`}
            >
              {selfDriverStatus.loading
                ? "Loading..."
                : selfDriverStatus.toggling
                  ? "Updating..."
                  : selfDriverStatus.isRegistered
                    ? "Registered as Driver"
                    : "Not Registered"}
            </span>
          </div>
        </div>
      </div>

      {/* External Drivers List */}
      <div className="b2c-external-drivers-section">
        <h4 className="b2c-section-subtitle">Your Drivers</h4>
        {externalDrivers.length === 0 ? (
          <div className="b2c-empty-state">
            <div className="b2c-empty-icon">Users</div>
            <h3 className="b2c-empty-title">No Drivers Added</h3>
            <p className="b2c-empty-description">
              Add your first driver to manage your transportation services
            </p>
          </div>
        ) : (
          <div className="b2c-drivers-grid">
            {externalDrivers.map((driver) => (
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
      </div>

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
