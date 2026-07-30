"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./b2c_createtripmodal.css";
import api from "../../../../utils/api";
import { notify } from "../../../../utils/toast";

function B2C_CreateTripModal({ route, onClose }) {
  const [formData, setFormData] = useState({
    tripDate: "",
    startTime: route?.startTime || "",
    vehicleId: route?.assignedVehicle?._id || "",
    driverId: route?.assignedDriver?._id || "",
    notes: "",
    // Initialize route data properly
    routeId: route?._id || "",
    fromLocation: route?.fromLocation || "",
    toLocation: route?.toLocation || "",
    tripType: route?.tripType || "One Way",
    pricing: route?.pricing || {},
    availableSeats: route?.availableSeats || 0,
  });
  const [loading, setLoading] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // Fetch real vehicles and drivers from API
  useEffect(() => {
    fetchAssets();
  }, []);

  // Initialize form data when route prop changes
  useEffect(() => {
    if (route) {
      setFormData({
        tripDate: "",
        startTime: route.startTime || "",
        vehicleId: route.assignedVehicle?._id || "",
        driverId: route.assignedDriver?._id || "",
        notes: "",
        routeId: route._id || "",
        fromLocation: route.fromLocation || "",
        toLocation: route.toLocation || "",
        tripType: route.tripType || "One Way",
        pricing: route.pricing || {},
        availableSeats: route.availableSeats || 0,
      });
    }
  }, [route]);

  const fetchAssets = async () => {
    try {
      setLoadingAssets(true);

      // Fetch vehicles and drivers from B2C partner fleet
      const [vehiclesResponse, driversResponse] = await Promise.all([
        api.get("/b2c-partner/fleet"),
        api.get("/b2c-partner/drivers"),
      ]);

      // Only Active vehicles can be allocated — hide Maintenance / Inactive.
      setAvailableVehicles(
        (vehiclesResponse.data.fleet?.vehicles || []).filter(
          (v) => v.status === "Active",
        ),
      );
      setAvailableDrivers(driversResponse.data.drivers || []);
    } catch (error) {
      console.error("Error fetching assets:", error);
      // Fallback to empty arrays if API fails
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tripData = {
        routeId: route._id,
        tripDate: formData.tripDate,
        startTime: formData.startTime,
        vehicleId: formData.vehicleId,
        driverId: formData.driverId,
        fromLocation: route.fromLocation,
        toLocation: route.toLocation,
        tripType: route.tripType,
        totalSeats: route.totalSeats,
        availableSeats: route.availableSeats,
        notes: formData.notes,
        pricing: route.pricing,
      };

      // Backend: POST /api/b2c-schedules/schedules (b2cScheduleRoutes.js)
      const response = await api.post("/b2c-schedules/schedules", {
        b2cPartnerId: null, // Will be set by middleware
        routeId: route._id,
        scheduleTime: formData.startTime,
        repeatPattern: "Custom",
        availableDays: [getDayFromDate(formData.tripDate)],
        assignedVehicle: formData.vehicleId,
        assignedDriver: formData.driverId,
        notes: formData.notes,
        isActive: true,
        status: "Active",
      });

      if (response.data.success) {
        onClose();
        // Optionally trigger a refresh of parent component
        window.location.reload();
      }
    } catch (error) {
      console.error("Error creating trip:", error);
      notify("Failed to create trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const getDayFromDate = (dateString) => {
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const date = new Date(dateString);
    return days[date.getDay()];
  };

  return createPortal(
    <div className="route-create-trip-b2c-modal-overlay">
      <div
        className="route-create-trip-b2c-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="route-create-trip-b2c-modal-header">
          <h2 className="route-create-trip-b2c-modal-title">Create New Trip</h2>
          <button
            className="route-create-trip-b2c-modal-close"
            onClick={onClose}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M6 6L18 18"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="route-create-trip-b2c-route-summary">
          <h3>Route Summary</h3>
          <div className="route-create-trip-b2c-summary-content">
            <div className="route-create-trip-b2c-summary-item">
              <span className="route-create-trip-b2c-summary-label">
                Route:
              </span>
              <span className="route-create-trip-b2c-summary-value">
                {formData.fromLocation} → {formData.toLocation}
              </span>
            </div>
            <div className="route-create-trip-b2c-summary-item">
              <span className="route-create-trip-b2c-summary-label">
                Trip Type:
              </span>
              <span className="route-create-trip-b2c-summary-value">
                {formData.tripType}
              </span>
            </div>
            {formData.tripType === "Round Trip" && (
              <div className="route-create-trip-b2c-summary-item">
                <span className="route-create-trip-b2c-summary-label">
                  Return:
                </span>
                <span className="route-create-trip-b2c-summary-value">
                  {route.returnTime || "Not set"}
                </span>
              </div>
            )}
            <div className="route-create-trip-b2c-summary-item">
              <span className="route-create-trip-b2c-summary-label">
                Vehicle:
              </span>
              <span className="route-create-trip-b2c-summary-value">
                {route?.assignedVehicle?.model || "Not Assigned"}
              </span>
            </div>
            <div className="route-create-trip-b2c-summary-item">
              <span className="route-create-trip-b2c-summary-label">
                Driver:
              </span>
              <span className="route-create-trip-b2c-summary-value">
                {route?.assignedDriver?.name || "Not Assigned"}
              </span>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="route-create-trip-b2c-modal-form"
        >
          <div className="route-create-trip-b2c-form-section">
            <h3 className="route-create-trip-b2c-section-title">
              Trip Details
            </h3>

            <div className="route-create-trip-b2c-form-row">
              <div className="route-create-trip-b2c-form-group">
                <label
                  htmlFor="tripDate"
                  className="route-create-trip-b2c-form-label"
                >
                  Trip Date *
                </label>
                <input
                  type="date"
                  id="tripDate"
                  name="tripDate"
                  value={formData.tripDate}
                  onChange={handleChange}
                  required
                  min={getMinDate()}
                  className="route-create-trip-b2c-form-input"
                />
              </div>

              <div className="route-create-trip-b2c-form-group">
                <label
                  htmlFor="startTime"
                  className="route-create-trip-b2c-form-label"
                >
                  Start Time *
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  required
                  className="route-create-trip-b2c-form-input"
                />
              </div>
            </div>

            <div className="route-create-trip-b2c-form-row">
              <div className="route-create-trip-b2c-form-group">
                <label
                  htmlFor="vehicleId"
                  className="route-create-trip-b2c-form-label"
                >
                  Assign Vehicle *
                </label>
                {loadingAssets ? (
                  <select className="route-create-trip-b2c-form-input" disabled>
                    <option>Loading vehicles...</option>
                  </select>
                ) : (
                  <select
                    id="vehicleId"
                    name="vehicleId"
                    value={formData.vehicleId}
                    onChange={handleChange}
                    required
                    className="route-create-trip-b2c-form-input"
                  >
                    <option value="">Select vehicle</option>
                    {availableVehicles.map((vehicle) => (
                      <option key={vehicle._id} value={vehicle._id}>
                        {vehicle.model} ({vehicle.licensePlate}) -{" "}
                        {vehicle.seatingCapacity} seats
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="route-create-trip-b2c-form-group">
                <label
                  htmlFor="driverId"
                  className="route-create-trip-b2c-form-label"
                >
                  Assign Driver *
                </label>
                {loadingAssets ? (
                  <select className="route-create-trip-b2c-form-input" disabled>
                    <option>Loading drivers...</option>
                  </select>
                ) : (
                  <select
                    id="driverId"
                    name="driverId"
                    value={formData.driverId}
                    onChange={handleChange}
                    required
                    className="route-create-trip-b2c-form-input"
                  >
                    <option value="">Select driver</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver._id} value={driver._id}>
                        {driver.name} - {driver.phoneNumber}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="route-create-trip-b2c-form-row full">
              <div className="route-create-trip-b2c-form-group">
                <label
                  htmlFor="notes"
                  className="route-create-trip-b2c-form-label"
                >
                  Additional Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="route-create-trip-b2c-form-input"
                  placeholder="Enter any special instructions or notes for this trip..."
                />
              </div>
            </div>
          </div>

          <div className="route-create-trip-b2c-form-section">
            <h3 className="route-create-trip-b2c-section-title">
              Passenger Notifications
            </h3>

            <div className="route-create-trip-b2c-notification-settings">
              <label className="route-create-trip-b2c-checkbox-label">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  className="route-create-trip-b2c-checkbox"
                />
                <span className="route-create-trip-b2c-checkmark"></span>
                Send 30-minute reminder to passengers
              </label>

              <label className="route-create-trip-b2c-checkbox-label">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  className="route-create-trip-b2c-checkbox"
                />
                <span className="route-create-trip-b2c-checkmark"></span>
                Send trip start notification
              </label>

              <label className="route-create-trip-b2c-checkbox-label">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  className="route-create-trip-b2c-checkbox"
                />
                <span className="route-create-trip-b2c-checkmark"></span>
                Enable real-time location sharing
              </label>
            </div>
          </div>

          <div className="route-create-trip-b2c-modal-actions">
            <button
              type="button"
              className="route-create-trip-b2c-btn route-create-trip-b2c-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="route-create-trip-b2c-btn route-create-trip-b2c-btn-submit"
              disabled={loading}
            >
              {loading ? "Creating Trip..." : "Create Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default B2C_CreateTripModal;
