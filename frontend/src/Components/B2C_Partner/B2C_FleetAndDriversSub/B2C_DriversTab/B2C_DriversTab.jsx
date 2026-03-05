"use client";

import { useState, useEffect } from "react";
import api from "../../../../utils/api";
import B2C_DriverCard from "../B2C_DriverCard/B2C_DriverCard";
import "./b2c_driverstab.css";

function B2C_DriversTab() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/b2c-partner/drivers');

      if (response.data.success) {
        setDrivers(response.data.drivers || []);
        console.log('Fetched B2C drivers:', response.data.drivers);
      } else {
        console.error('Failed to fetch drivers:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
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
            <B2C_DriverCard key={driver._id} driver={driver} />
          ))}
        </div>
      )}
    </div>
  );
}

export default B2C_DriversTab;
