"use client";

import { useState, useEffect } from "react";
import "./b2c_addschedulemodal.css";
import api from "../../../../utils/api";

function B2C_AddScheduleModal({ onClose, onSave, routes }) {
  const [formData, setFormData] = useState({
    routeId: "",
    scheduleTime: "",
    repeatPattern: "Daily",
    availableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    assignedVehicle: "",
    assignedDriver: "",
  });
  const [loading, setLoading] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const repeatPatterns = ["Daily", "Weekdays", "Weekends", "Custom"];
  const timeOptions = [
    "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM",
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
    "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
    "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM",
    "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM"
  ];

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoadingAssets(true);
      
      const [vehiclesResponse, driversResponse] = await Promise.all([
        api.get('/b2c-partner/fleet'),
        api.get('/b2c-partner/drivers')
      ]);

      setAvailableVehicles(vehiclesResponse.data.fleet?.vehicles || []);
      setAvailableDrivers(driversResponse.data.drivers || []);
    } catch (error) {
      console.error("Error fetching assets:", error);
      setAvailableVehicles([]);
      setAvailableDrivers([]);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleDay = (day) => {
    setFormData((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  const handleRepeatPatternChange = (pattern) => {
    let days = [...formData.availableDays];
    
    if (pattern === "Daily") {
      days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    } else if (pattern === "Weekdays") {
      days = ["MON", "TUE", "WED", "THU", "FRI"];
    } else if (pattern === "Weekends") {
      days = ["SAT", "SUN"];
    }
    
    setFormData(prev => ({
      ...prev,
      repeatPattern: pattern,
      availableDays: days
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const scheduleData = {
        ...formData,
        assignedVehicle: formData.assignedVehicle || null,
        assignedDriver: formData.assignedDriver || null,
      };
      
      await api.post('/b2c-schedules/schedules', scheduleData);
      onSave(scheduleData);
    } catch (error) {
      console.error("Error creating schedule:", error);
      alert("Failed to create schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="b2c-modal-overlay" onClick={onClose}>
      <div className="b2c-modal-content b2c-schedule-modal" onClick={(e) => e.stopPropagation()}>
        <div className="b2c-modal-header">
          <h2 className="b2c-modal-title">Add New Schedule</h2>
          <button className="b2c-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
              <path d="M6 6L18 18" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="b2c-modal-form">
          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Schedule Information</h3>
            
            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="routeId" className="b2c-form-label">
                  Route *
                </label>
                <select
                  id="routeId"
                  name="routeId"
                  value={formData.routeId}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                >
                  <option value="">Select route</option>
                  {routes.map((route) => (
                    <option key={route._id} value={route._id}>
                      {route.fromLocation} → {route.toLocation} ({route.tripType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="b2c-form-group">
                <label htmlFor="scheduleTime" className="b2c-form-label">
                  Schedule Time *
                </label>
                <select
                  id="scheduleTime"
                  name="scheduleTime"
                  value={formData.scheduleTime}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                >
                  <option value="">Select time</option>
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label className="b2c-form-label">
                  Repeat Pattern *
                </label>
                <div className="b2c-repeat-patterns">
                  {repeatPatterns.map((pattern) => (
                    <button
                      key={pattern}
                      type="button"
                      className={`b2c-pattern-btn ${
                        formData.repeatPattern === pattern ? "selected" : ""
                      }`}
                      onClick={() => handleRepeatPatternChange(pattern)}
                    >
                      {pattern}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {formData.repeatPattern === "Custom" && (
              <div className="b2c-form-row">
                <div className="b2c-form-group">
                  <label className="b2c-form-label">
                    Available Days *
                  </label>
                  <div className="b2c-days-selector">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={`b2c-day-btn ${
                          formData.availableDays.includes(day) ? "selected" : ""
                        }`}
                        onClick={() => toggleDay(day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Assignments</h3>
            
            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="assignedVehicle" className="b2c-form-label">
                  Assign Vehicle
                </label>
                {loadingAssets ? (
                  <select className="b2c-form-input" disabled>
                    <option>Loading vehicles...</option>
                  </select>
                ) : (
                  <select
                    id="assignedVehicle"
                    name="assignedVehicle"
                    value={formData.assignedVehicle}
                    onChange={handleChange}
                    className="b2c-form-input"
                  >
                    <option value="">Select vehicle (optional)</option>
                    {availableVehicles.map((vehicle) => (
                      <option key={vehicle._id} value={vehicle._id}>
                        {vehicle.model} ({vehicle.licensePlate}) - {vehicle.capacity} seats
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="b2c-form-group">
                <label htmlFor="assignedDriver" className="b2c-form-label">
                  Assign Driver
                </label>
                {loadingAssets ? (
                  <select className="b2c-form-input" disabled>
                    <option>Loading drivers...</option>
                  </select>
                ) : (
                  <select
                    id="assignedDriver"
                    name="assignedDriver"
                    value={formData.assignedDriver}
                    onChange={handleChange}
                    className="b2c-form-input"
                  >
                    <option value="">Select driver (optional)</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver._id} value={driver._id}>
                        {driver.name} - {driver.phoneNumber}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="b2c-modal-actions">
            <button type="button" className="b2c-btn b2c-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="b2c-btn b2c-btn-submit" disabled={loading}>
              {loading ? "Creating Schedule..." : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2C_AddScheduleModal;
