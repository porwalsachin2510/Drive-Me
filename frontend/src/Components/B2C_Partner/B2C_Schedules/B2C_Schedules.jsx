"use client";

import { useState, useEffect } from "react";
import "./b2c_schedules.css";
import api from "../../../../utils/api";
import B2C_AddScheduleModal from "./B2C_AddScheduleModal/B2C_AddScheduleModal";

function B2C_Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchRoutes();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      // Backend: GET /api/b2c-schedules/schedules (b2cScheduleRoutes.js)
      const response = await api.get('/b2c-schedules/schedules');
      setSchedules(response.data.schedules || []);
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      // Backend: GET /api/b2c-schedules/routes (b2cScheduleRoutes.js)
      const response = await api.get('/b2c-schedules/routes');
      setRoutes(response.data.routes || []);
    } catch (error) {
      console.error("Error fetching routes:", error);
    }
  };

  const handleAddSchedule = async (scheduleData) => {
    try {
      // Backend: POST /api/b2c-schedules/schedules (b2cScheduleRoutes.js)
      await api.post('/b2c-schedules/schedules', scheduleData);
      setShowAddScheduleModal(false);
      fetchSchedules();
    } catch (error) {
      console.error("Error adding schedule:", error);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (window.confirm("Are you sure you want to delete this schedule?")) {
      try {
        // Backend: DELETE /api/b2c-schedules/schedules/:scheduleId (b2cScheduleRoutes.js)
        await api.delete(`/b2c-schedules/schedules/${scheduleId}`);
        fetchSchedules();
      } catch (error) {
        console.error("Error deleting schedule:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="b2c-schedules-container">
        <div className="b2c-loading-container">
          <div className="b2c-loading-spinner"></div>
          <p className="b2c-loading-text">Loading schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="b2c-schedules-container">
      <div className="b2c-schedules-header">
        <div className="b2c-schedules-title-section">
          <h2 className="b2c-schedules-title">Schedule Management</h2>
          <p className="b2c-schedules-subtitle">Manage your daily trip schedules and timings</p>
        </div>
        <div className="b2c-schedules-actions">
          <div className="b2c-schedule-stats">
            <div className="b2c-stat-item">
              <span className="b2c-stat-label">Total Schedules</span>
              <span className="b2c-stat-value">{schedules.length}</span>
            </div>
            <div className="b2c-stat-item">
              <span className="b2c-stat-label">Active</span>
              <span className="b2c-stat-value">{schedules.filter(s => s.status === 'Active').length}</span>
            </div>
          </div>
          <button
            className="b2c-add-schedule-btn"
            onClick={() => setShowAddScheduleModal(true)}
          >
            <span className="b2c-btn-icon">+</span>
            <span className="b2c-btn-text">Add Schedule</span>
          </button>
        </div>
      </div>

      <div className="b2c-schedules-content">
        {schedules.length === 0 ? (
          <div className="b2c-empty-state">
            <div className="b2c-empty-icon">🕐</div>
            <h3 className="b2c-empty-title">No Schedules Found</h3>
            <p className="b2c-empty-description">
              Create your first schedule to start generating daily trips automatically.
            </p>
            <button
              className="b2c-btn b2c-btn-primary"
              onClick={() => setShowAddScheduleModal(true)}
            >
              Create First Schedule
            </button>
          </div>
        ) : (
          <div className="b2c-schedules-grid">
            {schedules.map((schedule) => (
              <div key={schedule._id} className="b2c-schedule-card">
                <div className="b2c-schedule-header">
                  <div className="b2c-schedule-time">
                    <span className="b2c-time-display">{schedule.scheduleTime}</span>
                    <span className="b2c-time-badge">{schedule.repeatPattern}</span>
                  </div>
                  <div className={`b2c-schedule-status ${schedule.status.toLowerCase()}`}>
                    {schedule.status}
                  </div>
                </div>

                <div className="b2c-schedule-route">
                  <h4 className="b2c-route-name">
                    {schedule.routeId?.fromLocation} → {schedule.routeId?.toLocation}
                  </h4>
                  <p className="b2c-route-description">
                    {schedule.routeId?.tripType} • {schedule.routeId?.totalSeats} seats
                  </p>
                </div>

                <div className="b2c-schedule-details">
                  <div className="b2c-detail-row">
                    <span className="b2c-detail-label">Days:</span>
                    <span className="b2c-detail-value">
                      {schedule.availableDays?.join(", ") || "All days"}
                    </span>
                  </div>
                  
                  {schedule.assignedVehicle && (
                    <div className="b2c-detail-row">
                      <span className="b2c-detail-label">Vehicle:</span>
                      <span className="b2c-detail-value">
                        {schedule.assignedVehicle?.model} ({schedule.assignedVehicle?.licensePlate})
                      </span>
                    </div>
                  )}
                  
                  {schedule.assignedDriver && (
                    <div className="b2c-detail-row">
                      <span className="b2c-detail-label">Driver:</span>
                      <span className="b2c-detail-value">
                        {schedule.assignedDriver?.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="b2c-schedule-actions">
                  <button className="b2c-btn b2c-btn-edit">
                    ✏️ Edit
                  </button>
                  <button 
                    className="b2c-btn b2c-btn-delete"
                    onClick={() => handleDeleteSchedule(schedule._id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddScheduleModal && (
        <B2C_AddScheduleModal 
          onClose={() => setShowAddScheduleModal(false)}
          onSave={handleAddSchedule}
          routes={routes}
        />
      )}
    </div>
  );
}

export default B2C_Schedules;
