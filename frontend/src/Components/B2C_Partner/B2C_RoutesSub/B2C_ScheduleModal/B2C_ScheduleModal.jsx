"use client";

import { useState, useEffect } from "react";
import "./b2c_schedulemodal.css";
import api from "../../../../utils/api";
import { notify } from "../../../../utils/toast";

function B2C_ScheduleModal({ route, onClose, onScheduleCreated }) {
  const [existingSchedules, setExistingSchedules] = useState([]); // Store ALL schedules
  const [existingSchedule, setExistingSchedule] = useState(null); // Currently selected schedule for editing
  const [selectedScheduleIndex, setSelectedScheduleIndex] = useState(0); // Index of selected schedule
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddingNewSchedule, setIsAddingNewSchedule] = useState(false); // Flag for adding new schedule to existing route

  const [formData, setFormData] = useState({
    routeId: route?._id || "",
    scheduleName: "",
    tripTimes: [
      {
        departureTime: "",
        arrivalTime: "",
        tripType: "One Way",
        outboundStopPoints: [],
        returnStopPoints: [],
      },
    ],
    availableDays: ["MON", "TUE", "WED", "THU", "FRI"],
    assignedVehicle: route?.assignedVehicle?._id || "",
    assignedDriver: route?.assignedDriver?._id || route?.driverInfo?._id || "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const tripTypes = ["One Way", "Round Trip"];

  // Helper to convert time to 24h format for inputs
  const convertTo24HourFormat = (timeString) => {
    if (!timeString) return "";

    // If already in HH:MM format
    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }

    // Handle AM/PM format
    const match = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      let [, hours, minutes, period] = match;
      hours = parseInt(hours);

      if (period) {
        if (period.toUpperCase() === "PM" && hours !== 12) {
          hours += 12;
        } else if (period.toUpperCase() === "AM" && hours === 12) {
          hours = 0;
        }
      }

      return `${hours.toString().padStart(2, "0")}:${minutes}`;
    }

    return timeString;
  };

  // Fetch existing schedule for this route
  useEffect(() => {
    fetchExistingSchedule();
  }, [route._id]);

  // Silent polling for real-time driver availability updates
  useEffect(() => {
    // Poll for driver availability every 5 seconds
    const pollDriverAvailability = async () => {
      try {
        const response = await api.get("/b2c-partner/drivers");
        if (response.data.drivers) {
          setAvailableDrivers(response.data.drivers);
        }
      } catch (error) {
        // Silent fail - don't disrupt user experience
      }
    };

    // Start polling interval
    const pollInterval = setInterval(pollDriverAvailability, 5000);

    // Cleanup on unmount
    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  const fetchExistingSchedule = async () => {
    try {
      setLoadingSchedule(true);
      const response = await api.get(
        `/b2c-schedules/schedules?routeId=${route._id}`,
      );

      if (response.data.success && response.data.schedules.length > 0) {
        const schedules = response.data.schedules;
        setExistingSchedules(schedules);

        // Select first schedule by default
        const schedule = schedules[selectedScheduleIndex] || schedules[0];
        setExistingSchedule(schedule);
        setIsEditMode(true);

        // Parse trip times from existing schedule
        loadScheduleIntoForm(schedule);
      }
    } catch (error) {
      console.error("Error fetching existing schedule:", error);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Load a specific schedule into the form
  const loadScheduleIntoForm = (schedule) => {
    const parsedTripTimes = schedule.tripTimes?.map((trip) => ({
      departureTime: convertTo24HourFormat(trip.departureTime),
      arrivalTime: convertTo24HourFormat(trip.arrivalTime) || "",
      tripType: trip.tripType || "One Way",
      outboundStopPoints: (trip.outboundStopPoints || []).map((stop) => ({
        location: stop.location,
        time: convertTo24HourFormat(stop.time),
      })),
      returnStopPoints: (trip.returnStopPoints || []).map((stop) => ({
        location: stop.location,
        time: convertTo24HourFormat(stop.time),
      })),
    })) || [
      {
        departureTime: "",
        arrivalTime: "",
        tripType: "One Way",
        outboundStopPoints: [],
        returnStopPoints: [],
      },
    ];

    setFormData({
      routeId: route._id,
      scheduleName: schedule.scheduleName || "",
      tripTimes: parsedTripTimes,
      availableDays: schedule.availableDays || [
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
      ],
      assignedVehicle:
        schedule.assignedVehicle?._id || schedule.assignedVehicle || "",
      assignedDriver:
        schedule.assignedDriver?._id || schedule.assignedDriver || "",
      startDate: schedule.startDate
        ? new Date(schedule.startDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      endDate: schedule.endDate
        ? new Date(schedule.endDate).toISOString().split("T")[0]
        : "",
      notes: schedule.notes || "",
    });
  };

  // Handle selecting a different schedule to edit
  const handleSelectSchedule = (index) => {
    setSelectedScheduleIndex(index);
    setExistingSchedule(existingSchedules[index]);
    setIsAddingNewSchedule(false);
    loadScheduleIntoForm(existingSchedules[index]);
  };

  // Handle adding a new schedule to the route
  const handleAddNewSchedule = () => {
    setIsAddingNewSchedule(true);
    setIsEditMode(false);
    setExistingSchedule(null);
    // Reset form for new schedule
    setFormData({
      routeId: route?._id || "",
      scheduleName: "",
      tripTimes: [
        {
          departureTime: "",
          arrivalTime: "",
          tripType: "One Way",
          outboundStopPoints: [],
          returnStopPoints: [],
        },
      ],
      availableDays: ["MON", "TUE", "WED", "THU", "FRI"],
      assignedVehicle: route?.assignedVehicle?._id || "",
      assignedDriver:
        route?.assignedDriver?._id || route?.driverInfo?._id || "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      notes: "",
    });
  };

  // Fetch real vehicles and drivers from API
  useEffect(() => {
    fetchAssets();
  }, []);

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
      tripTimes: [
        ...prev.tripTimes,
        {
          departureTime: "",
          arrivalTime: "",
          tripType: "One Way",
          outboundStopPoints: [],
          returnStopPoints: [],
        },
      ],
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

  // Stop point management
  const addStopPointToTrip = (tripIndex, journeyType) => {
    setFormData((prev) => {
      const updatedTripTimes = [...prev.tripTimes];
      const stopArray =
        journeyType === "outbound" ? "outboundStopPoints" : "returnStopPoints";
      updatedTripTimes[tripIndex] = {
        ...updatedTripTimes[tripIndex],
        [stopArray]: [
          ...updatedTripTimes[tripIndex][stopArray],
          { location: "", time: "" },
        ],
      };
      return { ...prev, tripTimes: updatedTripTimes };
    });
  };

  const updateTripStopPoint = (
    tripIndex,
    stopIndex,
    field,
    value,
    journeyType,
  ) => {
    setFormData((prev) => {
      const updatedTripTimes = [...prev.tripTimes];
      const stopArray =
        journeyType === "outbound" ? "outboundStopPoints" : "returnStopPoints";
      const updatedStopPoints = [...updatedTripTimes[tripIndex][stopArray]];
      updatedStopPoints[stopIndex] = {
        ...updatedStopPoints[stopIndex],
        [field]: value,
      };
      updatedTripTimes[tripIndex] = {
        ...updatedTripTimes[tripIndex],
        [stopArray]: updatedStopPoints,
      };
      return { ...prev, tripTimes: updatedTripTimes };
    });
  };

  const removeStopPointFromTrip = (tripIndex, stopIndex, journeyType) => {
    setFormData((prev) => {
      const updatedTripTimes = [...prev.tripTimes];
      const stopArray =
        journeyType === "outbound" ? "outboundStopPoints" : "returnStopPoints";
      updatedTripTimes[tripIndex] = {
        ...updatedTripTimes[tripIndex],
        [stopArray]: updatedTripTimes[tripIndex][stopArray].filter(
          (_, i) => i !== stopIndex,
        ),
      };
      return { ...prev, tripTimes: updatedTripTimes };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate at least one trip time is filled
      const validTripTimes = formData.tripTimes.filter(
        (trip) => trip.departureTime,
      );
      if (validTripTimes.length === 0) {
        notify("Please add at least one departure time");
        setLoading(false);
        return;
      }

      const scheduleData = {
        ...formData,
        tripTimes: validTripTimes,
      };

      let response;
      if (isEditMode && existingSchedule && !isAddingNewSchedule) {
        // Update existing schedule
        response = await api.put(
          `/b2c-schedules/schedules/${existingSchedule._id}`,
          scheduleData,
        );
      } else {
        // Create new schedule (either first schedule or adding another schedule to existing route)
        response = await api.post("/b2c-schedules/schedules", scheduleData);
      }

      if (response.data.success) {
        const message = isAddingNewSchedule
          ? "New schedule added successfully!"
          : isEditMode
            ? "Schedule updated successfully!"
            : "Schedule created successfully!";
        notify(message);
        onScheduleCreated && onScheduleCreated();
        onClose();
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
      notify(
        error.response?.data?.message ||
          "Failed to save schedule. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingAssets || loadingSchedule) {
    return (
      <div className="b2c-modal-overlay">
        <div
          className="b2c-modal-content b2c-schedule-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="b2c-modal-loading">
            <div className="b2c-loading-spinner"></div>
            <p>Loading schedule data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="b2c-modal-overlay">
      <div
        className="b2c-modal-content b2c-schedule-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="b2c-modal-header">
          <h2 className="b2c-modal-title">
            {isAddingNewSchedule ? "Add New" : isEditMode ? "Edit" : "Create"}{" "}
            Schedule for {route?.fromLocation} → {route?.toLocation}
          </h2>
          <button className="b2c-modal-close" onClick={onClose}>
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

        {/* Schedule Selector - Show when multiple schedules exist */}
        {existingSchedules.length > 0 && (
          <div
            className="b2c-schedule-selector"
            style={{
              padding: "16px",
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontWeight: "600",
                color: "#374151",
                marginRight: "8px",
              }}
            >
              Schedules ({existingSchedules.length}):
            </span>
            {existingSchedules.map((sch, index) => (
              <button
                key={sch._id}
                type="button"
                onClick={() => handleSelectSchedule(index)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border:
                    selectedScheduleIndex === index && !isAddingNewSchedule
                      ? "2px solid #3b82f6"
                      : "1px solid #d1d5db",
                  backgroundColor:
                    selectedScheduleIndex === index && !isAddingNewSchedule
                      ? "#eff6ff"
                      : "#fff",
                  color:
                    selectedScheduleIndex === index && !isAddingNewSchedule
                      ? "#1d4ed8"
                      : "#374151",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight:
                    selectedScheduleIndex === index && !isAddingNewSchedule
                      ? "600"
                      : "400",
                }}
              >
                {sch.scheduleName || `Schedule ${index + 1}`}
                <span
                  style={{
                    marginLeft: "6px",
                    fontSize: "11px",
                    color: "#6b7280",
                    fontWeight: "400",
                  }}
                >
                  ({sch.tripTimes?.[0]?.departureTime || "No time"})
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleAddNewSchedule}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: isAddingNewSchedule
                  ? "2px solid #10b981"
                  : "1px dashed #10b981",
                backgroundColor: isAddingNewSchedule ? "#ecfdf5" : "#fff",
                color: "#059669",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: isAddingNewSchedule ? "600" : "400",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Add New Schedule
            </button>
          </div>
        )}

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
                <small className="b2c-form-help">
                  Leave empty for ongoing schedule
                </small>
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label className="b2c-form-label">Available Days *</label>
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
            <h3 className="b2c-section-title">Trip Times & Stops</h3>
            <p className="b2c-section-description">
              Add departure times and stop points for this route.
            </p>

            <div className="b2c-trip-times-container">
              {formData.tripTimes.map((tripTime, index) => (
                <div key={index} className="b2c-trip-time-item">
                  <div className="b2c-trip-time-header">
                    <span className="b2c-trip-time-number">
                      Trip {index + 1}
                    </span>
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
                        onChange={(e) =>
                          updateTripTime(index, "departureTime", e.target.value)
                        }
                        required
                        className="b2c-form-input"
                      />
                    </div>

                    {tripTime.tripType === "Round Trip" && (
                      <div className="b2c-form-group">
                        <label className="b2c-form-label">Return Time *</label>
                        <input
                          type="time"
                          value={tripTime.arrivalTime}
                          onChange={(e) =>
                            updateTripTime(index, "arrivalTime", e.target.value)
                          }
                          required={tripTime.tripType === "Round Trip"}
                          className="b2c-form-input"
                        />
                        <small className="b2c-form-help">
                          Time when bus returns
                        </small>
                      </div>
                    )}

                    <div className="b2c-form-group">
                      <label className="b2c-form-label">Trip Type</label>
                      <select
                        value={tripTime.tripType}
                        onChange={(e) =>
                          updateTripTime(index, "tripType", e.target.value)
                        }
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

                  {/* Stop Points Section */}
                  <div className="b2c-trip-stop-points">
                    {/* Outbound Stop Points */}
                    <div className="b2c-journey-stop-points">
                      <div className="b2c-stop-points-header">
                        <h5 className="b2c-stop-points-title">
                          🛑 Outbound Stops: {route?.fromLocation} →{" "}
                          {route?.toLocation}
                        </h5>
                        <button
                          type="button"
                          onClick={() => addStopPointToTrip(index, "outbound")}
                          className="b2c-add-stop-btn"
                        >
                          + Add Stop
                        </button>
                      </div>

                      {tripTime.outboundStopPoints?.length === 0 ? (
                        <p className="b2c-no-stops">
                          No outbound stops. Bus will go directly.
                        </p>
                      ) : (
                        <div className="b2c-stops-list">
                          {tripTime.outboundStopPoints?.map(
                            (stop, stopIndex) => (
                              <div key={stopIndex} className="b2c-stop-item">
                                <div className="b2c-stop-number">
                                  {stopIndex + 1}
                                </div>
                                <div className="b2c-stop-details">
                                  <input
                                    type="text"
                                    placeholder="Stop location"
                                    value={stop.location}
                                    onChange={(e) =>
                                      updateTripStopPoint(
                                        index,
                                        stopIndex,
                                        "location",
                                        e.target.value,
                                        "outbound",
                                      )
                                    }
                                    className="b2c-stop-location-input"
                                  />
                                  <input
                                    type="time"
                                    value={stop.time}
                                    onChange={(e) =>
                                      updateTripStopPoint(
                                        index,
                                        stopIndex,
                                        "time",
                                        e.target.value,
                                        "outbound",
                                      )
                                    }
                                    className="b2c-stop-time-input"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeStopPointFromTrip(
                                      index,
                                      stopIndex,
                                      "outbound",
                                    )
                                  }
                                  className="b2c-remove-stop-btn"
                                >
                                  ×
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    {/* Return Stop Points (only for Round Trip) */}
                    {tripTime.tripType === "Round Trip" && (
                      <div className="b2c-journey-stop-points">
                        <div className="b2c-stop-points-header">
                          <h5 className="b2c-stop-points-title">
                            🔄 Return Stops: {route?.toLocation} →{" "}
                            {route?.fromLocation}
                          </h5>
                          <button
                            type="button"
                            onClick={() => addStopPointToTrip(index, "return")}
                            className="b2c-add-stop-btn"
                          >
                            + Add Stop
                          </button>
                        </div>

                        {tripTime.returnStopPoints?.length === 0 ? (
                          <p className="b2c-no-stops">
                            No return stops. Bus will return directly.
                          </p>
                        ) : (
                          <div className="b2c-stops-list">
                            {tripTime.returnStopPoints?.map(
                              (stop, stopIndex) => (
                                <div key={stopIndex} className="b2c-stop-item">
                                  <div className="b2c-stop-number">
                                    {stopIndex + 1}
                                  </div>
                                  <div className="b2c-stop-details">
                                    <input
                                      type="text"
                                      placeholder="Stop location"
                                      value={stop.location}
                                      onChange={(e) =>
                                        updateTripStopPoint(
                                          index,
                                          stopIndex,
                                          "location",
                                          e.target.value,
                                          "return",
                                        )
                                      }
                                      className="b2c-stop-location-input"
                                    />
                                    <input
                                      type="time"
                                      value={stop.time}
                                      onChange={(e) =>
                                        updateTripStopPoint(
                                          index,
                                          stopIndex,
                                          "time",
                                          e.target.value,
                                          "return",
                                        )
                                      }
                                      className="b2c-stop-time-input"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeStopPointFromTrip(
                                        index,
                                        stopIndex,
                                        "return",
                                      )
                                    }
                                    className="b2c-remove-stop-btn"
                                  >
                                    ×
                                  </button>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )}
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
                      {vehicle.model} ({vehicle.licensePlate}) -{" "}
                      {vehicle.seatingCapacity} seats
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
                  {availableDrivers.map((driver) => {
                    const availabilityStatus =
                      driver.availability?.status ||
                      driver.availabilityStatus ||
                      "available";
                    const availabilityIcon =
                      availabilityStatus === "available"
                        ? "🟢"
                        : availabilityStatus === "busy"
                          ? "🔴"
                          : availabilityStatus === "offline"
                            ? "🟠"
                            : "🟠";
                    const availabilityText =
                      driver.availability?.message ||
                      (availabilityStatus === "available"
                        ? "Available"
                        : availabilityStatus === "busy"
                          ? "Busy"
                          : availabilityStatus === "offline"
                            ? "Offline"
                            : "Not Available");
                    return (
                      <option key={driver._id} value={driver._id}>
                        {availabilityIcon} {driver.name} ({driver.phoneNumber})
                        - {availabilityText}
                      </option>
                    );
                  })}
                </select>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginTop: "6px",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >
                  <span>🟢 Available</span>
                  <span>🟠 Has upcoming trip</span>
                  <span>🔴 Currently busy</span>
                </div>
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
                <span className="b2c-preview-value">
                  {route?.fromLocation} → {route?.toLocation}
                </span>
              </div>
              <div className="b2c-preview-item">
                <span className="b2c-preview-label">Days:</span>
                <span className="b2c-preview-value">
                  {formData.availableDays.join(", ")}
                </span>
              </div>
              <div className="b2c-preview-item">
                <span className="b2c-preview-label">Trips per Day:</span>
                <span className="b2c-preview-value">
                  {formData.tripTimes.filter((t) => t.departureTime).length}
                </span>
              </div>
              <div className="b2c-preview-item">
                <span className="b2c-preview-label">Total Weekly Trips:</span>
                <span className="b2c-preview-value">
                  {formData.tripTimes.filter((t) => t.departureTime).length *
                    formData.availableDays.length}
                </span>
              </div>
            </div>

            {formData.tripTimes.filter((t) => t.departureTime).length > 0 && (
              <div className="b2c-trip-times-preview">
                <h5 className="b2c-preview-subtitle">🕐 Daily Trip Times:</h5>
                {formData.tripTimes
                  .filter((t) => t.departureTime)
                  .map((trip, index) => (
                    <div key={index} className="b2c-trip-preview">
                      <div className="b2c-trip-preview-header">
                        <span className="b2c-trip-time">
                          {trip.departureTime}{" "}
                          {trip.arrivalTime && `- ${trip.arrivalTime}`}
                        </span>
                        <span className="b2c-trip-type">{trip.tripType}</span>
                      </div>
                      {trip.outboundStopPoints?.length > 0 && (
                        <div className="b2c-trip-stops-preview">
                          <span className="b2c-stops-label">Outbound:</span>
                          {trip.outboundStopPoints.map((stop, i) => (
                            <span key={i} className="b2c-stop-preview">
                              {stop.location} ({stop.time})
                            </span>
                          ))}
                        </div>
                      )}
                      {trip.tripType === "Round Trip" &&
                        trip.returnStopPoints?.length > 0 && (
                          <div className="b2c-trip-stops-preview">
                            <span className="b2c-stops-label">Return:</span>
                            {trip.returnStopPoints.map((stop, i) => (
                              <span key={i} className="b2c-stop-preview">
                                {stop.location} ({stop.time})
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="b2c-modal-actions">
            <button
              type="button"
              className="b2c-btn b2c-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="b2c-btn b2c-btn-submit"
              disabled={loading}
            >
              {loading
                ? "Saving..."
                : isEditMode
                  ? "Update Schedule"
                  : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2C_ScheduleModal;
