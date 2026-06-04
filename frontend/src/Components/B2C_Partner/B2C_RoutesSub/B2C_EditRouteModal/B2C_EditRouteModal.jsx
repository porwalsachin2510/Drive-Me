/* eslint-disable no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import "./b2c_editroutemodal.css";
import api from "../../../../utils/api";
import useCurrency from "../../../../hooks/useCurrency";

function B2C_EditRouteModal({ route, onClose, onRouteUpdated }) {
  const { formatAmount, getCurrencyDecimals, getCurrencySymbol } =
    useCurrency();
  const [currency, setCurrency] = useState(route?.pricing?.currency || "AED");
  const [decimals, setDecimals] = useState(2);
  const [existingSchedules, setExistingSchedules] = useState([]); // Store ALL schedules
  const [existingSchedule, setExistingSchedule] = useState(null); // Currently selected schedule for editing
  const [selectedScheduleIndex, setSelectedScheduleIndex] = useState(0);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // Helper function to get local date string in YYYY-MM-DD format
  // This avoids timezone shift issues that occur with toISOString()
  const getLocalDateString = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    fromLocation: route?.fromLocation || "",
    toLocation: route?.toLocation || "",
    availableDays: route?.availableDays ||
      route?.schedules?.[0]?.availableDays || [
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
      ],
    oneWayPrice: route?.pricing?.oneWayPrice?.toString() || "",
    roundTripPrice: route?.pricing?.roundTripPrice?.toString() || "",
    monthlyOneWayPrice: route?.pricing?.monthlyOneWayPrice?.toString() || "",
    monthlyRoundTripPrice:
      route?.pricing?.monthlyRoundTripPrice?.toString() || "",
    tripTimes: [
      {
        departureTime: "",
        arrivalTime: "",
        tripType: "One Way",
        outboundStopPoints: [],
        returnStopPoints: [],
        assignedDriver: "",
        assignedVehicle: "",
      },
    ],
    totalSeats: route?.totalSeats?.toString() || "",
    availableSeats: route?.availableSeats?.toString() || "",
    routeStartDate: route?.routeStartDate
      ? getLocalDateString(new Date(route.routeStartDate))
      : "",
    description: route?.description || "",
    tags: route?.tags || [],
    status: route?.status || "Active",
  });

  const [loading, setLoading] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [groupedTags, setGroupedTags] = useState({});
  const [loadingAssets, setLoadingAssets] = useState(true);

  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const tripTypes = ["One Way", "Round Trip"];

  // Helper to convert 24h time to HH:MM format for input
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

  // Fetch user's country and currency, vehicles, drivers, and existing schedule
  useEffect(() => {
    fetchUserCountryAndAssets();
    fetchExistingSchedule();
  }, []);

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

        // Load first schedule by default
        const schedule = schedules[0];
        setExistingSchedule(schedule);
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
    if (schedule.tripTimes && schedule.tripTimes.length > 0) {
      const parsedTripTimes = schedule.tripTimes.map((trip) => ({
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
        // Add trip-level driver and vehicle assignment
        assignedDriver: trip.assignedDriver?._id || trip.assignedDriver || "",
        assignedVehicle:
          trip.assignedVehicle?._id || trip.assignedVehicle || "",
      }));

      setFormData((prev) => ({
        ...prev,
        tripTimes: parsedTripTimes,
        availableDays: schedule.availableDays || prev.availableDays,
      }));
    }
  };

  // Handle selecting a different schedule to edit
  const handleSelectSchedule = (index) => {
    setSelectedScheduleIndex(index);
    setExistingSchedule(existingSchedules[index]);
    loadScheduleIntoForm(existingSchedules[index]);
  };

  const fetchUserCountryAndAssets = async () => {
    try {
      setLoadingAssets(true);

      // Fetch user's country to get currency
      const userResponse = await api.get("/users/me");
      const userCountry = userResponse.data?.user?.country || "KW";

      // Map country to currency
      const countryToCurrency = {
        UAE: "AED",
        KW: "KWD",
        SA: "SAR",
        BH: "BHD",
        OM: "OMR",
        QA: "QAR",
      };

      const userCurrency =
        countryToCurrency[userCountry] || route?.pricing?.currency || "AED";
      const userDecimals = getCurrencyDecimals(userCurrency);

      setCurrency(userCurrency);
      setDecimals(userDecimals);

      // Fetch vehicles, drivers, and tags from B2C partner fleet
      const [vehiclesResponse, driversResponse, tagsResponse] =
        await Promise.all([
          api.get("/b2c-partner/fleet"),
          api.get("/b2c-partner/drivers"),
          api.get("/admin/tags/by-category", { params: { context: "route" } }),
        ]);

      setAvailableVehicles(vehiclesResponse.data.fleet?.vehicles || []);
      setAvailableDrivers(driversResponse.data.drivers || []);
      setAvailableTags(tagsResponse.data.tags || []);
      setGroupedTags(tagsResponse.data.groupedTags || {});
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

  // Handle tag selection toggle
  const handleTagToggle = (tagId) => {
    setFormData((prev) => {
      const updatedTags = prev.tags.includes(tagId)
        ? prev.tags.filter((id) => id !== tagId)
        : [...prev.tags, tagId];
      return { ...prev, tags: updatedTags };
    });
  };

  const handleDayChange = (day) => {
    setFormData((prev) => {
      const updatedDays = prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day];

      const updatedData = { ...prev, availableDays: updatedDays };

      // Recalculate monthly prices when days change
      if (prev.oneWayPrice || prev.roundTripPrice) {
        const { monthlyOneWay, monthlyRoundTrip } = calculateMonthlyPrices(
          updatedData.oneWayPrice,
          updatedData.roundTripPrice,
          updatedDays,
        );

        updatedData.monthlyOneWayPrice = monthlyOneWay;
        updatedData.monthlyRoundTripPrice = monthlyRoundTrip;
      }

      return updatedData;
    });
  };

  // Trip time management functions
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
          assignedDriver: "",
          assignedVehicle: "",
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

  // Stop point management for individual trips
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

  const removeTripTime = (index) => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.filter((_, i) => i !== index),
    }));
  };

  // Auto-calculate monthly prices based on reference prices
  const calculateMonthlyPrices = (
    oneWayPrice,
    roundTripPrice,
    availableDays,
  ) => {
    const daysPerWeek = availableDays.length;
    const weeksPerMonth = 4.33;
    const workingDaysPerMonth = Math.round(daysPerWeek * weeksPerMonth);

    const monthlyOneWay = oneWayPrice
      ? (parseFloat(oneWayPrice) * workingDaysPerMonth).toFixed(2)
      : "";
    const monthlyRoundTrip = roundTripPrice
      ? (parseFloat(roundTripPrice) * workingDaysPerMonth).toFixed(2)
      : "";

    return { monthlyOneWay, monthlyRoundTrip, workingDaysPerMonth };
  };

  // Handle reference price changes - auto-calculate monthly prices
  const handlePriceChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updatedData = { ...prev, [name]: value };

      if (name === "oneWayPrice" || name === "roundTripPrice") {
        const { monthlyOneWay, monthlyRoundTrip } = calculateMonthlyPrices(
          name === "oneWayPrice" ? value : updatedData.oneWayPrice,
          name === "roundTripPrice" ? value : updatedData.roundTripPrice,
          updatedData.availableDays,
        );

        updatedData.monthlyOneWayPrice = monthlyOneWay;
        updatedData.monthlyRoundTripPrice = monthlyRoundTrip;
      }

      return updatedData;
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
        alert("Please add at least one departure time");
        setLoading(false);
        return;
      }

      // Validate round trip times have return times
      const invalidRoundTrips = validTripTimes.filter(
        (trip) => trip.tripType === "Round Trip" && !trip.arrivalTime,
      );
      if (invalidRoundTrips.length > 0) {
        alert("Round trips must have return times");
        setLoading(false);
        return;
      }

      // Calculate seats from first trip's vehicle or use existing values
      const firstTripVehicle = formData.tripTimes.find(
        (t) => t.assignedVehicle,
      )?.assignedVehicle;
      const vehicleForSeats = availableVehicles.find(
        (v) => v._id === firstTripVehicle,
      );
      const calculatedSeats =
        vehicleForSeats?.seatingCapacity || route?.totalSeats || 20;

      // Update route data - include currency in pricing
      const routeData = {
        fromLocation: formData.fromLocation,
        toLocation: formData.toLocation,
        totalSeats: calculatedSeats,
        availableSeats: calculatedSeats,
        pricing: {
          oneWayPrice: parseFloat(formData.oneWayPrice) || 0,
          roundTripPrice: parseFloat(formData.roundTripPrice) || 0,
          monthlyOneWayPrice: parseFloat(formData.monthlyOneWayPrice) || 0,
          monthlyRoundTripPrice:
            parseFloat(formData.monthlyRoundTripPrice) || 0,
          currency: currency,
        },
        routeStartDate: formData.routeStartDate || getLocalDateString(),
        description: formData.description,
        tags: formData.tags || [],
        availableDays: formData.availableDays,
        status: formData.status,
      };

      // Update the route
      const routeResponse = await api.put(
        `/b2c-partner/routes/${route._id}`,
        routeData,
      );

      if (routeResponse.data.success) {
        // Now update or create schedule with trip-level assignments
        const scheduleData = {
          routeId: route._id,
          scheduleName: `${formData.fromLocation} to ${formData.toLocation} Schedule`,
          tripTimes: validTripTimes.map((trip, idx) => ({
            ...trip,
            assignedDriver: formData.tripTimes[idx]?.assignedDriver || null,
            assignedVehicle: formData.tripTimes[idx]?.assignedVehicle || null,
          })),
          availableDays:
            formData.availableDays.length > 0
              ? formData.availableDays
              : ["MON", "TUE", "WED", "THU", "FRI"],
          startDate: formData.routeStartDate || getLocalDateString(),
        };

        if (existingSchedule) {
          // Update existing schedule
          await api.put(
            `/b2c-schedules/schedules/${existingSchedule._id}`,
            scheduleData,
          );
        } else {
          // Create new schedule
          await api.post("/b2c-schedules/schedules", scheduleData);
        }

        alert("Route and Schedule updated successfully!");
        onClose();
        if (onRouteUpdated) onRouteUpdated();
      }
    } catch (error) {
      console.error("Error updating route:", error);
      alert(
        error.response?.data?.message ||
          "Failed to update route. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingAssets || loadingSchedule) {
    return (
      <div className="b2c-modal-overlay">
        <div
          className="b2c-modal-content b2c-edit-route-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="b2c-modal-loading">
            <div className="b2c-loading-spinner"></div>
            <p>Loading route data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="b2c-modal-overlay">
      <div
        className="b2c-modal-content b2c-edit-route-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="b2c-modal-header">
          <h2 className="b2c-modal-title">Edit Route</h2>
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

        <form onSubmit={handleSubmit} className="b2c-modal-form">
          {/* Basic Route Information */}
          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Basic Route Information</h3>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="fromLocation" className="b2c-form-label">
                  From Location *
                </label>
                <input
                  type="text"
                  id="fromLocation"
                  name="fromLocation"
                  placeholder="e.g. Dubai Marina"
                  value={formData.fromLocation}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="toLocation" className="b2c-form-label">
                  To Location *
                </label>
                <input
                  type="text"
                  id="toLocation"
                  name="toLocation"
                  placeholder="e.g. Abu Dhabi City"
                  value={formData.toLocation}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="routeStartDate" className="b2c-form-label">
                  Route Start Date
                </label>
                <input
                  type="date"
                  id="routeStartDate"
                  name="routeStartDate"
                  value={formData.routeStartDate}
                  onChange={handleChange}
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="status" className="b2c-form-label">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="b2c-form-input"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
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
                      className={`b2c-day-btn ${formData.availableDays.includes(day) ? "selected" : ""}`}
                      onClick={() => handleDayChange(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="b2c-form-row full">
              <div className="b2c-form-group">
                <label htmlFor="description" className="b2c-form-label">
                  Route Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Describe your route, landmarks, etc."
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className="b2c-form-input"
                ></textarea>
              </div>
            </div>

            {/* Route Tags Section */}
            {availableTags.length > 0 && (
              <div className="b2c-form-row full">
                <div className="b2c-form-group">
                  <label className="b2c-form-label">Route Tags</label>
                  <p className="b2c-form-help-text">
                    Select tags to help passengers find your route easily.
                  </p>

                  {Object.entries(groupedTags).map(([category, tags]) => (
                    <div key={category} className="b2c-tag-category-group">
                      <span className="b2c-tag-category-label">
                        {category === "route"
                          ? "Route Tags"
                          : category === "promo"
                            ? "Promotional Tags"
                            : category === "general"
                              ? "General Tags"
                              : category.charAt(0).toUpperCase() +
                                category.slice(1) +
                                " Tags"}
                        :
                      </span>
                      <div className="b2c-tags-selector">
                        {tags.map((tag) => (
                          <button
                            key={tag._id}
                            type="button"
                            className={`b2c-tag-btn ${formData.tags.includes(tag._id) ? "selected" : ""}`}
                            onClick={() => handleTagToggle(tag._id)}
                            style={{
                              backgroundColor: formData.tags.includes(tag._id)
                                ? tag.color
                                : "#f3f4f6",
                              color: formData.tags.includes(tag._id)
                                ? tag.textColor
                                : "#374151",
                              borderColor: tag.color,
                            }}
                            title={tag.description || tag.label}
                          >
                            {tag.icon && (
                              <span className="b2c-tag-icon">{tag.icon}</span>
                            )}
                            {tag.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Schedule Selector - Show when multiple schedules exist */}
          {existingSchedules.length > 1 && (
            <div
              className="b2c-form-section b2c-schedule-selector-section"
              style={{
                backgroundColor: "#f0f9ff",
                border: "1px solid #0ea5e9",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <h3
                className="b2c-section-title"
                style={{ color: "#0369a1", marginBottom: "12px" }}
              >
                Select Schedule to Edit ({existingSchedules.length} schedules)
              </h3>
              <p
                className="b2c-section-description"
                style={{ marginBottom: "12px", color: "#0c4a6e" }}
              >
                This route has multiple schedules. Select one to edit its trip
                times and settings.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {existingSchedules.map((sch, index) => (
                  <button
                    key={sch._id}
                    type="button"
                    onClick={() => handleSelectSchedule(index)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border:
                        selectedScheduleIndex === index
                          ? "2px solid #0ea5e9"
                          : "1px solid #cbd5e1",
                      backgroundColor:
                        selectedScheduleIndex === index ? "#e0f2fe" : "#fff",
                      color:
                        selectedScheduleIndex === index ? "#0369a1" : "#374151",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight:
                        selectedScheduleIndex === index ? "600" : "400",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "4px",
                      minWidth: "180px",
                    }}
                  >
                    <span style={{ fontWeight: "600" }}>
                      {sch.scheduleName || `Schedule ${index + 1}`}
                    </span>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      {sch.tripTimes?.[0]?.departureTime || "No time set"}
                      {sch.tripTimes?.[0]?.tripType === "Round Trip" &&
                        sch.tripTimes?.[0]?.arrivalTime && (
                          <> - Return: {sch.tripTimes?.[0]?.arrivalTime}</>
                        )}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color:
                          selectedScheduleIndex === index
                            ? "#0284c7"
                            : "#9ca3af",
                        backgroundColor:
                          selectedScheduleIndex === index
                            ? "#bae6fd"
                            : "#f3f4f6",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {sch.availableDays?.join(", ") || "No days"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trip Times Section */}
          <div className="b2c-form-section">
            <h3 className="b2c-section-title">
              Trip Times
              {existingSchedules.length > 1 && existingSchedule && (
                <span
                  style={{
                    fontWeight: "400",
                    fontSize: "14px",
                    color: "#6b7280",
                    marginLeft: "8px",
                  }}
                >
                  - Editing:{" "}
                  {existingSchedule.scheduleName ||
                    `Schedule ${selectedScheduleIndex + 1}`}
                </span>
              )}
            </h3>
            <p className="b2c-section-description">
              Configure departure times and stop points for this{" "}
              {existingSchedules.length > 1 ? "schedule" : "route"}.
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
                          Time when bus returns from destination
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

                  {/* Stop Points for this specific trip */}
                  <div className="b2c-trip-stop-points">
                    {/* Outbound Stop Points */}
                    <div className="b2c-journey-stop-points">
                      <div className="b2c-stop-points-header">
                        <h5 className="b2c-stop-points-title">
                          🛑 Outbound Stops: {formData.fromLocation} →{" "}
                          {formData.toLocation}
                        </h5>
                        <button
                          type="button"
                          onClick={() => addStopPointToTrip(index, "outbound")}
                          className="b2c-add-stop-btn"
                        >
                          + Add Outbound Stop
                        </button>
                      </div>

                      {tripTime.outboundStopPoints.length === 0 ? (
                        <p className="b2c-no-stops">
                          No outbound stops. Bus will go directly from{" "}
                          {formData.fromLocation} to {formData.toLocation}.
                        </p>
                      ) : (
                        <div className="b2c-stops-list">
                          {tripTime.outboundStopPoints.map(
                            (stop, stopIndex) => (
                              <div key={stopIndex} className="b2c-stop-item">
                                <div className="b2c-stop-number">
                                  {stopIndex + 1}
                                </div>
                                <div className="b2c-stop-details">
                                  <input
                                    type="text"
                                    placeholder="Stop location (e.g., Dubai Mall)"
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
                                    placeholder="Arrival time"
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
                            🔄 Return Stops: {formData.toLocation} →{" "}
                            {formData.fromLocation}
                          </h5>
                          <button
                            type="button"
                            onClick={() => addStopPointToTrip(index, "return")}
                            className="b2c-add-stop-btn"
                          >
                            + Add Return Stop
                          </button>
                        </div>

                        {tripTime.returnStopPoints.length === 0 ? (
                          <p className="b2c-no-stops">
                            No return stops. Bus will go directly from{" "}
                            {formData.toLocation} to {formData.fromLocation}.
                          </p>
                        ) : (
                          <div className="b2c-stops-list">
                            {tripTime.returnStopPoints.map(
                              (stop, stopIndex) => (
                                <div key={stopIndex} className="b2c-stop-item">
                                  <div className="b2c-stop-number">
                                    {stopIndex + 1}
                                  </div>
                                  <div className="b2c-stop-details">
                                    <input
                                      type="text"
                                      placeholder="Stop location (e.g., Sharjah)"
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
                                      placeholder="Arrival time"
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

                  {/* Per-Trip Driver & Vehicle Assignment */}
                  <div
                    className="b2c-trip-assignment"
                    style={{
                      marginTop: "16px",
                      padding: "12px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h5
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#475569",
                        marginBottom: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>📋</span> Trip {index + 1} Assignment *
                    </h5>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "12px",
                      }}
                    >
                      Assign a driver and vehicle for this specific trip time.
                      Drivers marked with 🟢 are available, 🔴 are busy, 🟠 are
                      offline.
                    </p>
                    <div
                      className="b2c-form-row"
                      style={{ display: "flex", gap: "12px" }}
                    >
                      <div className="b2c-form-group" style={{ flex: 1 }}>
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "500",
                            color: "#475569",
                            marginBottom: "4px",
                            display: "block",
                          }}
                        >
                          Driver for Trip {index + 1} *
                        </label>
                        <select
                          value={tripTime.assignedDriver || ""}
                          onChange={(e) =>
                            updateTripTime(
                              index,
                              "assignedDriver",
                              e.target.value,
                            )
                          }
                          className="b2c-form-input"
                          style={{ fontSize: "13px", padding: "8px 10px" }}
                          required
                        >
                          <option value="">Select a driver</option>
                          {availableDrivers.map((driver) => {
                            // Use backend-calculated availability status and message
                            const availabilityStatus =
                              driver.availability?.status ||
                              driver.availabilityStatus ||
                              "available";
                            const availabilityMessage =
                              driver.availability?.message ||
                              driver.availabilityMessage ||
                              "";
                            const availableUntil =
                              driver.availability?.availableUntilDisplay ||
                              driver.availableUntil ||
                              null;

                            const availabilityIcon =
                              availabilityStatus === "available"
                                ? "🟢"
                                : availabilityStatus === "busy"
                                  ? "🔴"
                                  : availabilityStatus === "offline"
                                    ? "🟠"
                                    : "🟠";
                            // Allow selecting available drivers (even if they have upcoming trips)
                            const isDisabled =
                              availabilityStatus !== "available" &&
                              availabilityStatus !== "scheduled";

                            // Build schedule info text - show "Available until X:XX" if applicable
                            // FIXED: Show "Available" even if driver has schedules (without bookings)
                            const scheduleCount =
                              driver.assignedScheduleDetails?.length || 0;
                            const statusText =
                              availabilityStatus === "available"
                                ? availableUntil
                                  ? `- Available until ${availableUntil}`
                                  : scheduleCount > 0
                                    ? "- Available"
                                    : ""
                                : availabilityStatus === "scheduled"
                                  ? `- ${availabilityMessage}`
                                  : availabilityStatus === "busy"
                                    ? `- ${availabilityMessage || "Busy"}`
                                    : availabilityStatus === "offline"
                                      ? "- Offline"
                                      : "- Not Available";

                            return (
                              <option
                                key={driver._id}
                                value={driver._id}
                                disabled={isDisabled}
                                style={{
                                  color: isDisabled ? "#94a3b8" : "inherit",
                                }}
                              >
                                {availabilityIcon} {driver.name} (
                                {driver.phoneNumber}) {statusText}
                              </option>
                            );
                          })}
                        </select>
                        {/* Show selected driver's schedule info */}
                        {tripTime.assignedDriver &&
                          (() => {
                            const selectedDriver = availableDrivers.find(
                              (d) => d._id === tripTime.assignedDriver,
                            );
                            if (
                              selectedDriver?.assignedScheduleDetails?.length >
                              0
                            ) {
                              return (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    padding: "8px 10px",
                                    backgroundColor: "#fef3c7",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    color: "#92400e",
                                    border: "1px solid #fcd34d",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: "600",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    Already assigned to{" "}
                                    {
                                      selectedDriver.assignedScheduleDetails
                                        .length
                                    }{" "}
                                    schedule(s):
                                  </div>
                                  {selectedDriver.assignedScheduleDetails
                                    .slice(0, 3)
                                    .map((sched, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          marginLeft: "8px",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        • {sched.departureTime}
                                        {sched.arrivalTime
                                          ? ` - ${sched.arrivalTime}`
                                          : ""}
                                        : {sched.routeName}
                                        <span
                                          style={{
                                            color: "#a16207",
                                            marginLeft: "4px",
                                          }}
                                        >
                                          (
                                          {sched.availableDays
                                            ?.slice(0, 3)
                                            .join(", ")}
                                          {sched.availableDays?.length > 3
                                            ? "..."
                                            : ""}
                                          )
                                        </span>
                                      </div>
                                    ))}
                                  {selectedDriver.assignedScheduleDetails
                                    .length > 3 && (
                                    <div
                                      style={{
                                        marginLeft: "8px",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      ...and{" "}
                                      {selectedDriver.assignedScheduleDetails
                                        .length - 3}{" "}
                                      more
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                      </div>
                      <div className="b2c-form-group" style={{ flex: 1 }}>
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "500",
                            color: "#475569",
                            marginBottom: "4px",
                            display: "block",
                          }}
                        >
                          Vehicle for Trip {index + 1} *
                        </label>
                        <select
                          value={tripTime.assignedVehicle || ""}
                          onChange={(e) =>
                            updateTripTime(
                              index,
                              "assignedVehicle",
                              e.target.value,
                            )
                          }
                          className="b2c-form-input"
                          style={{ fontSize: "13px", padding: "8px 10px" }}
                          required
                        >
                          <option value="">Select a vehicle</option>
                          {availableVehicles.map((vehicle) => {
                            // Use backend-calculated availability status
                            const vehicleAvailability =
                              vehicle.availabilityStatus || "available";
                            const vehicleAvailableUntil =
                              vehicle.availableUntil || null;
                            const vehicleAvailabilityMessage =
                              vehicle.availabilityMessage || "";

                            const vehicleIcon =
                              vehicleAvailability === "available"
                                ? "🟢"
                                : vehicleAvailability === "busy"
                                  ? "🔴"
                                  : vehicleAvailability === "scheduled"
                                    ? "🟠"
                                    : "🟠";
                            // Allow selecting available vehicles (even if they have upcoming trips)
                            const isVehicleDisabled =
                              vehicleAvailability !== "available" &&
                              vehicleAvailability !== "scheduled";

                            // Build schedule info text - show "Available until X:XX" if applicable
                            // FIXED: Show "Available" even if vehicle has schedules (without bookings)
                            const scheduleCount =
                              vehicle.assignedScheduleDetails?.length || 0;
                            const vehicleStatusText =
                              vehicleAvailability === "available"
                                ? vehicleAvailableUntil
                                  ? `- Available until ${vehicleAvailableUntil}`
                                  : scheduleCount > 0
                                    ? "- Available"
                                    : ""
                                : vehicleAvailability === "busy"
                                  ? `- ${vehicleAvailabilityMessage || "BUSY"}`
                                  : vehicleAvailability === "scheduled"
                                    ? `- ${vehicleAvailabilityMessage}`
                                    : "";

                            return (
                              <option
                                key={vehicle._id}
                                value={vehicle._id}
                                disabled={isVehicleDisabled}
                                style={{
                                  color: isVehicleDisabled
                                    ? "#94a3b8"
                                    : "inherit",
                                }}
                              >
                                {vehicleIcon} {vehicle.model} (
                                {vehicle.licensePlate}) -{" "}
                                {vehicle.seatingCapacity} seats{" "}
                                {vehicleStatusText}
                              </option>
                            );
                          })}
                        </select>
                        {/* Show selected vehicle's schedule info */}
                        {tripTime.assignedVehicle &&
                          (() => {
                            const selectedVehicle = availableVehicles.find(
                              (v) => v._id === tripTime.assignedVehicle,
                            );
                            if (
                              selectedVehicle?.assignedScheduleDetails?.length >
                              0
                            ) {
                              return (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    padding: "8px 10px",
                                    backgroundColor: "#dbeafe",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    color: "#1e40af",
                                    border: "1px solid #93c5fd",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: "600",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    Already assigned to{" "}
                                    {
                                      selectedVehicle.assignedScheduleDetails
                                        .length
                                    }{" "}
                                    schedule(s):
                                  </div>
                                  {selectedVehicle.assignedScheduleDetails
                                    .slice(0, 3)
                                    .map((sched, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          marginLeft: "8px",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        • {sched.departureTime}
                                        {sched.arrivalTime
                                          ? ` - ${sched.arrivalTime}`
                                          : ""}
                                        : {sched.routeName}
                                        <span
                                          style={{
                                            color: "#1d4ed8",
                                            marginLeft: "4px",
                                          }}
                                        >
                                          (
                                          {sched.availableDays
                                            ?.slice(0, 3)
                                            .join(", ")}
                                          {sched.availableDays?.length > 3
                                            ? "..."
                                            : ""}
                                          )
                                        </span>
                                      </div>
                                    ))}
                                  {selectedVehicle.assignedScheduleDetails
                                    .length > 3 && (
                                    <div
                                      style={{
                                        marginLeft: "8px",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      ...and{" "}
                                      {selectedVehicle.assignedScheduleDetails
                                        .length - 3}{" "}
                                      more
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                      </div>
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

          {/* Pricing Section */}
          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Pricing</h3>

            {/* Seat Capacity Info - Auto-calculated from trip vehicles */}
            <div
              className="b2c-info-box"
              style={{
                backgroundColor: "#eff6ff",
                border: "1px solid #93c5fd",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              <p style={{ fontSize: "13px", color: "#1e40af", margin: 0 }}>
                <strong>Seat Capacity:</strong> The total and available seats
                are automatically determined by the vehicle assigned to each
                trip above. Each trip can have a different vehicle with
                different seating capacity.
              </p>
              {formData.tripTimes.some((t) => t.assignedVehicle) && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "#3b82f6",
                  }}
                >
                  {formData.tripTimes.map((trip, idx) => {
                    if (!trip.assignedVehicle) return null;
                    const vehicle = availableVehicles.find(
                      (v) => v._id === trip.assignedVehicle,
                    );
                    return vehicle ? (
                      <div key={idx}>
                        Trip {idx + 1}: {vehicle.model || vehicle.vehicleName} (
                        {vehicle.licensePlate}) - {vehicle.seatingCapacity}{" "}
                        seats
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="oneWayPrice" className="b2c-form-label">
                  One Way Price ({getCurrencySymbol(currency)}) *
                </label>
                <input
                  type="number"
                  id="oneWayPrice"
                  name="oneWayPrice"
                  placeholder="50.00"
                  value={formData.oneWayPrice}
                  onChange={handlePriceChange}
                  required
                  min="0"
                  step={decimals === 3 ? "0.001" : "0.01"}
                  className="b2c-form-input"
                />
                <small className="b2c-form-help">Daily price per trip</small>
              </div>

              <div className="b2c-form-group">
                <label htmlFor="roundTripPrice" className="b2c-form-label">
                  Round Trip Price ({getCurrencySymbol(currency)}) *
                </label>
                <input
                  type="number"
                  id="roundTripPrice"
                  name="roundTripPrice"
                  placeholder="80.00"
                  value={formData.roundTripPrice}
                  onChange={handlePriceChange}
                  required
                  min="0"
                  step={decimals === 3 ? "0.001" : "0.01"}
                  className="b2c-form-input"
                />
                <small className="b2c-form-help">
                  Daily price per round trip
                </small>
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="monthlyOneWayPrice" className="b2c-form-label">
                  Monthly Pass (One Way) ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  id="monthlyOneWayPrice"
                  name="monthlyOneWayPrice"
                  placeholder="Auto-calculated"
                  value={formData.monthlyOneWayPrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="b2c-form-input"
                  readOnly
                />
                <small className="b2c-form-help">Auto-calculated</small>
              </div>

              <div className="b2c-form-group">
                <label className="b2c-form-label">
                  Monthly Pass (Round Trip) ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  id="monthlyRoundTripPrice"
                  name="monthlyRoundTripPrice"
                  placeholder="Auto-calculated"
                  value={formData.monthlyRoundTripPrice}
                  onChange={handleChange}
                  min="0"
                  step={decimals === 3 ? "0.001" : "0.01"}
                  className="b2c-form-input"
                  readOnly
                />
                <small className="b2c-form-help">Auto-calculated</small>
              </div>
            </div>

            {/* Route Preview */}
            <div className="b2c-pricing-preview">
              <h4 className="b2c-preview-title">📋 Route Summary</h4>
              <div className="b2c-preview-grid">
                <div className="b2c-preview-item">
                  <span className="b2c-preview-label">Route:</span>
                  <span className="b2c-preview-value">
                    {formData.fromLocation} → {formData.toLocation}
                  </span>
                </div>
                <div className="b2c-preview-item">
                  <span className="b2c-preview-label">Days:</span>
                  <span className="b2c-preview-value">
                    {formData.availableDays.join(", ")}
                  </span>
                </div>
                <div className="b2c-preview-item">
                  <span className="b2c-preview-label">Total Schedules:</span>
                  <span
                    className="b2c-preview-value"
                    style={{
                      color:
                        existingSchedules.length > 1 ? "#0ea5e9" : "inherit",
                      fontWeight: existingSchedules.length > 1 ? "600" : "400",
                    }}
                  >
                    {existingSchedules.length || 1}
                  </span>
                </div>
                <div className="b2c-preview-item">
                  <span className="b2c-preview-label">
                    Trips per Day (this schedule):
                  </span>
                  <span className="b2c-preview-value">
                    {formData.tripTimes.filter((t) => t.departureTime).length}
                  </span>
                </div>
                <div className="b2c-preview-item">
                  <span className="b2c-preview-label">
                    Total Weekly Trips (this schedule):
                  </span>
                  <span className="b2c-preview-value">
                    {formData.tripTimes.filter((t) => t.departureTime).length *
                      formData.availableDays.length}
                  </span>
                </div>
              </div>

              {/* Show all schedules summary when multiple exist */}
              {existingSchedules.length > 1 && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    backgroundColor: "#f0f9ff",
                    borderRadius: "8px",
                    border: "1px solid #bae6fd",
                  }}
                >
                  <h5
                    style={{
                      margin: "0 0 8px 0",
                      color: "#0369a1",
                      fontSize: "14px",
                    }}
                  >
                    All Schedules Overview:
                  </h5>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {existingSchedules.map((sch, idx) => (
                      <div
                        key={sch._id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 10px",
                          backgroundColor:
                            selectedScheduleIndex === idx ? "#e0f2fe" : "#fff",
                          borderRadius: "6px",
                          border:
                            selectedScheduleIndex === idx
                              ? "1px solid #0ea5e9"
                              : "1px solid #e5e7eb",
                        }}
                      >
                        <span
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            backgroundColor:
                              selectedScheduleIndex === idx
                                ? "#0ea5e9"
                                : "#94a3b8",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span style={{ fontWeight: "500", color: "#334155" }}>
                          {sch.tripTimes?.[0]?.departureTime || "N/A"}
                        </span>
                        {sch.tripTimes?.[0]?.tripType === "Round Trip" &&
                          sch.tripTimes?.[0]?.arrivalTime && (
                            <span style={{ color: "#64748b" }}>
                              - Return: {sch.tripTimes?.[0]?.arrivalTime}
                            </span>
                          )}
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: "11px",
                            backgroundColor: "#f1f5f9",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            color: "#64748b",
                          }}
                        >
                          {sch.tripTimes?.[0]?.tripType || "One Way"}
                        </span>
                        {selectedScheduleIndex === idx && (
                          <span
                            style={{
                              fontSize: "11px",
                              backgroundColor: "#0ea5e9",
                              color: "#fff",
                              padding: "2px 8px",
                              borderRadius: "4px",
                            }}
                          >
                            Editing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.tripTimes.filter((t) => t.departureTime).length > 0 && (
                <div className="b2c-trip-times-preview">
                  <h5 className="b2c-preview-subtitle">
                    🕐 Daily Trip Times
                    {existingSchedules.length > 1
                      ? ` (Schedule ${selectedScheduleIndex + 1})`
                      : ""}
                    :
                  </h5>
                  {formData.tripTimes
                    .filter((t) => t.departureTime)
                    .map((trip, index) => (
                      <div key={index} className="b2c-trip-preview">
                        <div className="b2c-trip-header">
                          <span className="b2c-trip-time">
                            {trip.departureTime}
                            {trip.tripType === "Round Trip" &&
                              trip.arrivalTime &&
                              ` - Return ${trip.arrivalTime}`}
                          </span>
                          <span className="b2c-trip-type">{trip.tripType}</span>
                        </div>

                        {trip.outboundStopPoints.length > 0 && (
                          <div className="b2c-trip-stops-preview">
                            <span className="b2c-stops-label">
                              🛑 Outbound:
                            </span>
                            {trip.outboundStopPoints.map((stop, stopIndex) => (
                              <span
                                key={stopIndex}
                                className="b2c-stop-preview"
                              >
                                {stop.location} ({stop.time})
                              </span>
                            ))}
                          </div>
                        )}

                        {trip.tripType === "Round Trip" &&
                          trip.returnStopPoints.length > 0 && (
                            <div className="b2c-trip-stops-preview">
                              <span className="b2c-stops-label">
                                🔄 Return:
                              </span>
                              {trip.returnStopPoints.map((stop, stopIndex) => (
                                <span
                                  key={stopIndex}
                                  className="b2c-stop-preview"
                                >
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
              {loading ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2C_EditRouteModal;
