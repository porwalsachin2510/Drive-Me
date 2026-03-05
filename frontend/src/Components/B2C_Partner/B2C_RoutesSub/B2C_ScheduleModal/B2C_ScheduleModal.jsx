"use client";

import { useState, useEffect } from "react";
import "./b2c_schedulemodal.css";
import api from "../../../../utils/api";

function B2C_ScheduleModal({ route, onClose, onScheduleCreated }) {
  const [formData, setFormData] = useState({
    routeId: route?._id || "",
    scheduleName: "",
    tripTimes: [{ departureTime: "", arrivalTime: "", tripType: "One Way" }],
    availableDays: ["MON", "TUE", "WED", "THU", "FRI"],
    assignedVehicle: route?.assignedVehicle?._id || "",
    assignedDriver: route?.assignedDriver?._id || "",
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const tripTypes = ["One Way", "Round Trip"];

  // Fetch real vehicles and drivers from API
  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoadingAssets(true);
      
      // Fetch vehicles and drivers from B2C partner fleet
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

  const handleDayChange = (day) => {
    setFormData((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  const addTripTime = () => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: [...prev.tripTimes, { departureTime: "", arrivalTime: "", tripType: "One Way" }],
    }));
  };

  const updateTripTime = (index, field, value) => {
    setFormData((prev) => {
      const updatedTripTimes = [...prev.tripTimes];
      updatedTripTimes[index] = { ...updatedTripTimes[index], [field]: value };
      return { ...prev, tripTimes: updatedTripTimes };
    });
  };

  const removeTripTime = (index) => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate at least one trip time is filled
      const validTripTimes = formData.tripTimes.filter(trip => trip.departureTime);
      if (validTripTimes.length === 0) {
        alert("Please add at least one departure time");
        setLoading(false);
        return;
      }

      const scheduleData = {
        ...formData,
        tripTimes: validTripTimes,
      };
      
      const response = await api.post('/b2c-schedules/schedules', scheduleData);
      
      if (response.data.success) {
        alert("Schedule created successfully! Trips will be generated automatically.");
        onScheduleCreated && onScheduleCreated();
        onClose();
      }
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
          <h2 className="b2c-modal-title">Create Schedule for {route?.fromLocation} → {route?.toLocation}</h2>
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
                <label htmlFor="scheduleName" className="b2c-form-label">
                  Schedule Name *
                </label>
                <input
                  type="text"
                  id="scheduleName"
                  name="scheduleName"
                  placeholder="e.g. Morning Express, Evening Service"
                  value={formData.scheduleName}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="startDate" className="b2c-form-label">
                  Start Date *
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="endDate" className="b2c-form-label">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  min={formData.startDate}
                  className="b2c-form-input"
                />
                <small className="b2c-form-help">Leave empty for ongoing schedule</small>
              </div>
            </div>

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
                      onClick={() => handleDayChange(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Trip Times</h3>
            <p className="b2c-section-description">
              Add multiple departure times for this route. Each time will create separate trips that passengers can book.
            </p>
            
            <div className="b2c-trip-times-container">
              {formData.tripTimes.map((tripTime, index) => (
                <div key={index} className="b2c-trip-time-item">
                  <div className="b2c-trip-time-header">
                    <span className="b2c-trip-time-number">Trip {index + 1}</span>
                    {formData.tripTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTripTime(index)}
                        className="b2c-remove-trip-btn"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  
                  <div className="b2c-form-row">
                    <div className="b2c-form-group">
                      <label className="b2c-form-label">Departure Time *</label>
                      <input
                        type="time"
                        value={tripTime.departureTime}
                        onChange={(e) => updateTripTime(index, "departureTime", e.target.value)}
                        required
                        className="b2c-form-input"
                      />
                    </div>

                    <div className="b2c-form-group">
                      <label className="b2c-form-label">Arrival Time</label>
                      <input
                        type="time"
                        value={tripTime.arrivalTime}
                        onChange={(e) => updateTripTime(index, "arrivalTime", e.target.value)}
                        className="b2c-form-input"
                      />
                      <small className="b2c-form-help">Optional</small>
                    </div>

                    <div className="b2c-form-group">
                      <label className="b2c-form-label">Trip Type</label>
                      <select
                        value={tripTime.tripType}
                        onChange={(e) => updateTripTime(index, "tripType", e.target.value)}
                        className="b2c-form-input"
                      >
                        {tripTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              
              <button
                type="button"
                onClick={addTripTime}
                className="b2c-add-trip-btn"
              >
                + Add Another Trip Time
              </button>
            </div>
          </div>

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Vehicle & Driver Assignment</h3>
            
            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="assignedVehicle" className="b2c-form-label">
                  Assign Vehicle *
                </label>
                <select
                  id="assignedVehicle"
                  name="assignedVehicle"
                  value={formData.assignedVehicle}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                >
                  <option value="">Select Vehicle</option>
                  {availableVehicles.map((vehicle) => (
                    <option key={vehicle._id} value={vehicle._id}>
                      {vehicle.model} ({vehicle.licensePlate}) - {vehicle.seatingCapacity} seats
                    </option>
                  ))}
                </select>
              </div>

              <div className="b2c-form-group">
                <label htmlFor="assignedDriver" className="b2c-form-label">
                  Assign Driver *
                </label>
                <select
                  id="assignedDriver"
                  name="assignedDriver"
                  value={formData.assignedDriver}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                >
                  <option value="">Select Driver</option>
                  {availableDrivers.map((driver) => (
                    <option key={driver._id} value={driver._id}>
                      {driver.name} ({driver.phoneNumber})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Additional Information</h3>
            
            <div className="b2c-form-row full">
              <div className="b2c-form-group">
                <label htmlFor="notes" className="b2c-form-label">
                  Schedule Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  placeholder="Any additional notes about this schedule..."
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  className="b2c-form-input"
                ></textarea>
              </div>
            </div>
          </div>

          <div className="b2c-schedule-preview">
            <h4 className="b2c-preview-title">📅 Schedule Preview</h4>
            <div className="b2c-preview-grid">
              <div className="b2c-preview-item">
                <span className="b2c-preview-label">Route:</span>
                <span className="b2c-preview-value">{route?.fromLocation} → {route?.toLocation}</span>
              </div>
              <div className="b2c-preview-item">
                <span className="b2c-preview-label">Days:</span>
                <span className="b2c-preview-value">{formData.availableDays.join(", ")}</span>
              </div>
              <div className="b2c-preview-item">
                <span className="b2c-preview-label">Trips per Day:</span>
                <span className="b2c-preview-value">{formData.tripTimes.filter(t => t.departureTime).length}</span>
              </div>
              <div className="b2c-preview-item">
                <span className="b2c-preview-label">Total Weekly Trips:</span>
                <span className="b2c-preview-value">
                  {formData.tripTimes.filter(t => t.departureTime).length * formData.availableDays.length}
                </span>
              </div>
            </div>
            
            {formData.tripTimes.filter(t => t.departureTime).length > 0 && (
              <div className="b2c-trip-times-preview">
                <h5 className="b2c-preview-subtitle">🕐 Daily Trip Times:</h5>
                {formData.tripTimes.filter(t => t.departureTime).map((trip, index) => (
                  <div key={index} className="b2c-trip-preview">
                    <span className="b2c-trip-time">
                      {trip.departureTime} {trip.arrivalTime && `- ${trip.arrivalTime}`}
                    </span>
                    <span className="b2c-trip-type">{trip.tripType}</span>
                  </div>
                ))}
              </div>
            )}
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

export default B2C_ScheduleModal;
