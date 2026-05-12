/* eslint-disable no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import "./b2c_addroutemodal.css";
import "./b2c_trip_stops.css";
import api from "../../../../utils/api";
import useCurrency from "../../../../hooks/useCurrency";

function B2C_AddRouteModal({ onClose }) {
  const { formatAmount, getCurrencyDecimals, getCurrencySymbol } =
    useCurrency();
  const [currency, setCurrency] = useState("AED");
  const [decimals, setDecimals] = useState(2);
  const [formData, setFormData] = useState({
    fromLocation: "",
    toLocation: "",
    availableDays: ["MON", "TUE", "WED", "THU", "FRI"],
    oneWayPrice: "",
    roundTripPrice: "",
    monthlyOneWayPrice: "",
    monthlyRoundTripPrice: "",
    tripTimes: [
      {
        departureTime: "",
        arrivalTime: "",
        tripType: "One Way",
        outboundStopPoints: [], // For One Way or Round Trip outbound journey
        returnStopPoints: [], // Only for Round Trip return journey
      },
    ],
    vehicleId: "",
    driverId: "",
    routeStartDate: "",
    description: "",
    tags: [], // Selected tag IDs
  });
  const [loading, setLoading] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [groupedTags, setGroupedTags] = useState({});
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [schedulingConflicts, setSchedulingConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const tripTypes = ["One Way", "Round Trip"];

  // Fetch user's country and currency, then fetch vehicles and drivers
  useEffect(() => {
    fetchUserCountryAndAssets();
  }, []);

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

      const userCurrency = countryToCurrency[userCountry] || "AED";
      const userDecimals = getCurrencyDecimals(userCurrency);

      console.log(
        "[v0] User country:",
        userCountry,
        "Currency:",
        userCurrency,
        "Decimals:",
        userDecimals,
      );

      setCurrency(userCurrency);
      setDecimals(userDecimals);

      // Fetch vehicles, drivers, and tags from B2C partner fleet
      // Use context="route" to get route, promo, and general tags
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
        const { monthlyOneWay, monthlyRoundTrip, workingDaysPerMonth } =
          calculateMonthlyPrices(
            updatedData.oneWayPrice,
            updatedData.roundTripPrice,
            updatedDays,
          );

        updatedData.monthlyOneWayPrice = monthlyOneWay;
        updatedData.monthlyRoundTripPrice = monthlyRoundTrip;
        updatedData.workingDaysPerMonth = workingDaysPerMonth;
      }

      // Check for conflicts when days change
      setTimeout(() => {
        checkConflicts(
          prev.driverId,
          prev.vehicleId,
          prev.tripTimes,
          updatedDays,
        );
      }, 300);

      return updatedData;
    });
  };

  const addStopPoint = () => {
    setFormData((prev) => ({
      ...prev,
      stopPoints: [...prev.stopPoints, { location: "", time: "" }],
    }));
  };

  const updateStopPoint = (index, field, value) => {
    setFormData((prev) => {
      const updatedStopPoints = [...prev.stopPoints];
      updatedStopPoints[index] = {
        ...updatedStopPoints[index],
        [field]: value,
      };
      return { ...prev, stopPoints: updatedStopPoints };
    });
  };

  const removeStopPoint = (index) => {
    setFormData((prev) => ({
      ...prev,
      stopPoints: prev.stopPoints.filter((_, i) => i !== index),
    }));
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
          outboundStopPoints: [], // For One Way or Round Trip outbound journey
          returnStopPoints: [], // Only for Round Trip return journey
        },
      ],
    }));
  };

  const updateTripTime = (index, field, value) => {
    setFormData((prev) => {
      const updatedTripTimes = [...prev.tripTimes];
      updatedTripTimes[index] = { ...updatedTripTimes[index], [field]: value };
      // Check conflicts when departure time changes
      if (field === "departureTime" && value) {
        // Use setTimeout to debounce the conflict check
        setTimeout(() => {
          checkConflicts(
            prev.driverId,
            prev.vehicleId,
            updatedTripTimes,
            prev.availableDays,
          );
        }, 500);
      }
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

  // Check for scheduling conflicts
  const checkConflicts = async (
    driverId,
    vehicleId,
    tripTimes,
    availableDays,
  ) => {
    // Only check if we have driver or vehicle and at least one trip time
    const validTripTimes = tripTimes.filter((t) => t.departureTime);
    if ((!driverId && !vehicleId) || validTripTimes.length === 0) {
      setSchedulingConflicts([]);
      return;
    }

    setCheckingConflicts(true);
    try {
      const response = await api.post("/b2c-schedules/check-conflicts", {
        driverId: driverId || null,
        vehicleId: vehicleId || null,
        tripTimes: validTripTimes,
        availableDays:
          availableDays.length > 0
            ? availableDays
            : ["MON", "TUE", "WED", "THU", "FRI"],
      });

      if (response.data.hasConflicts) {
        setSchedulingConflicts(response.data.conflicts);
      } else {
        setSchedulingConflicts([]);
      }
    } catch (error) {
      console.error("Error checking conflicts:", error);
      setSchedulingConflicts([]);
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Handle vehicle selection change - update seats automatically
  const handleVehicleChange = (e) => {
    const selectedVehicleId = e.target.value;
    const selectedVehicle = availableVehicles.find(
      (v) => v._id === selectedVehicleId,
    );

    setFormData((prev) => {
      const newFormData = {
        ...prev,
        vehicleId: selectedVehicleId,
        // Auto-populate seats from vehicle
        totalSeats: selectedVehicle?.seatingCapacity || 0,
        availableSeats: selectedVehicle?.seatingCapacity || 0,
      };

      // Check conflicts with new vehicle
      checkConflicts(
        prev.driverId,
        selectedVehicleId,
        prev.tripTimes,
        prev.availableDays,
      );

      return newFormData;
    });
  };

  // Handle driver selection change
  const handleDriverChange = (e) => {
    const selectedDriverId = e.target.value;

    setFormData((prev) => {
      const newFormData = {
        ...prev,
        driverId: selectedDriverId,
      };

      // Check conflicts with new driver
      checkConflicts(
        selectedDriverId,
        prev.vehicleId,
        prev.tripTimes,
        prev.availableDays,
      );

      return newFormData;
    });
  };

  // Auto-calculate monthly prices based on reference prices
  const calculateMonthlyPrices = (
    oneWayPrice,
    roundTripPrice,
    availableDays,
  ) => {
    // Calculate working days based on available days selection
    const daysPerWeek = availableDays.length;
    const weeksPerMonth = 4.33; // Average weeks in a month
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

      // Auto-calculate monthly prices when reference prices change
      if (name === "oneWayPrice" || name === "roundTripPrice") {
        const { monthlyOneWay, monthlyRoundTrip, workingDaysPerMonth } =
          calculateMonthlyPrices(
            name === "oneWayPrice" ? value : updatedData.oneWayPrice,
            name === "roundTripPrice" ? value : updatedData.roundTripPrice,
            updatedData.availableDays,
          );

        updatedData.monthlyOneWayPrice = monthlyOneWay;
        updatedData.monthlyRoundTripPrice = monthlyRoundTrip;
        updatedData.workingDaysPerMonth = workingDaysPerMonth;
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

      // Check for scheduling conflicts before creating
      if (formData.driverId || formData.vehicleId) {
        try {
          const conflictCheckResponse = await api.post(
            "/b2c-schedules/check-conflicts",
            {
              driverId: formData.driverId || null,
              vehicleId: formData.vehicleId || null,
              tripTimes: validTripTimes,
              availableDays:
                formData.availableDays.length > 0
                  ? formData.availableDays
                  : ["MON", "TUE", "WED", "THU", "FRI"],
            },
          );

          if (conflictCheckResponse.data.hasConflicts) {
            const conflicts = conflictCheckResponse.data.conflicts;
            const conflictMessages = conflicts
              .map((c) => {
                const resourceType = c.type === "DRIVER" ? "Driver" : "Vehicle";
                return `${resourceType} is already assigned to "${c.existingRoute}" at ${c.conflictingTime} on ${c.overlappingDays?.join(", ")}`;
              })
              .join("\n\n");

            const confirmCreate = window.confirm(
              `Scheduling Conflicts Detected!\n\n${conflictMessages}\n\nDo you still want to continue? The driver/vehicle will be double-booked.`,
            );

            if (!confirmCreate) {
              setLoading(false);
              return;
            }
          }
        } catch (conflictError) {
          console.error("Error checking conflicts:", conflictError);
          // Continue with route creation even if conflict check fails
        }
      }

      // First create route - include currency in pricing
      const routeData = {
        fromLocation: formData.fromLocation,
        toLocation: formData.toLocation,
        totalSeats: parseInt(formData.totalSeats) || 20,
        availableSeats: parseInt(formData.availableSeats) || 20,
        pricing: {
          oneWayPrice: parseFloat(formData.oneWayPrice) || 0,
          roundTripPrice: parseFloat(formData.roundTripPrice) || 0,
          monthlyOneWayPrice: parseFloat(formData.monthlyOneWayPrice) || 0,
          monthlyRoundTripPrice:
            parseFloat(formData.monthlyRoundTripPrice) || 0,
          currency: currency,
        },
        assignedVehicle: formData.vehicleId || null,
        assignedDriver: formData.driverId || null,
        routeStartDate:
          formData.routeStartDate || new Date().toISOString().split("T")[0],
        description: formData.description,
        tags: formData.tags || [], // Include selected tags
      };

      const routeResponse = await api.post("/b2c-schedules/routes", routeData);

      if (routeResponse.data.success) {
        const createdRoute = routeResponse.data.route;

        // Always create schedule with provided trip times
        const scheduleData = {
          routeId: createdRoute._id,
          scheduleName: `${createdRoute.fromLocation} to ${createdRoute.toLocation} Schedule`,
          tripTimes: validTripTimes,
          availableDays:
            formData.availableDays.length > 0
              ? formData.availableDays
              : ["MON", "TUE", "WED", "THU", "FRI"],
          assignedVehicle: formData.vehicleId,
          assignedDriver: formData.driverId,
          startDate:
            formData.routeStartDate || new Date().toISOString().split("T")[0],
          notes: `Auto-created schedule for ${createdRoute.fromLocation} → ${createdRoute.toLocation}`,
        };

        const scheduleResponse = await api.post(
          "/b2c-schedules/schedules",
          scheduleData,
        );

        if (scheduleResponse.data.success) {
          alert(
            "Route and Schedule created successfully! Trips will be generated automatically.",
          );
        }

        onClose();
        // Trigger parent refresh
        if (window.onRouteCreated) {
          window.onRouteCreated();
        } else {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error("Error creating route:", error);

      
      // Handle specific conflict errors from backend
      if (error.response?.data?.conflictDetails) {
        const conflict = error.response.data.conflictDetails;
        const conflictMessage = error.response.data.message || 
          `Scheduling conflict detected! The selected ${conflict.conflictType.includes('DRIVER') ? 'driver' : 'vehicle'} is already assigned to route "${conflict.existingRoute}" at ${conflict.conflictingTime} on ${conflict.overlappingDays?.join(", ")}. Please choose a different time, ${conflict.conflictType.includes('DRIVER') ? 'driver' : 'vehicle'}, or days.`;
        alert(conflictMessage);
      } else if (error.response?.data?.message) {
        // Handle other backend validation errors
        alert(error.response.data.message);
      } else {
        alert("Failed to create route. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="b2c-modal-overlay" onClick={onClose}>
      <div className="b2c-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="b2c-modal-header">
          <h2 className="b2c-modal-title">Add New Route</h2>
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
                  Route Start Date *
                </label>
                <input
                  type="date"
                  id="routeStartDate"
                  name="routeStartDate"
                  value={formData.routeStartDate}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
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
            {/* Route Tags Section - Grouped by Category */}
            {availableTags.length > 0 && (
              <div className="b2c-form-row full">
                <div className="b2c-form-group">
                  <label className="b2c-form-label">Route Tags</label>
                  <p className="b2c-form-help-text">
                    Select tags to help passengers find your route easily. Tags
                    are organized by category.
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

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Trip Times</h3>
            <p className="b2c-section-description">
              Add multiple departure times for this route. Each time will create
              separate trips that passengers can book.
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
                                    className="b2c-stop-location"
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
                                    className="b2c-stop-time"
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
                                      className="b2c-stop-location"
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
                                      className="b2c-stop-time"
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
            <h3 className="b2c-section-title">Pricing & Capacity</h3>

            {/* Vehicle Assignment Section */}
            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="vehicleId" className="b2c-form-label">
                  Assign Vehicle *
                </label>
                <select
                  id="vehicleId"
                  name="vehicleId"
                  value={formData.vehicleId}
                  onChange={handleVehicleChange}
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
                {formData.vehicleId && (
                  <small className="b2c-form-help">
                    Vehicle capacity:{" "}
                    {availableVehicles.find((v) => v._id === formData.vehicleId)
                      ?.seatingCapacity || 0}{" "}
                    seats
                  </small>
                )}
              </div>

              <div className="b2c-form-group">
                <label htmlFor="driverId" className="b2c-form-label">
                  Assign Driver *
                </label>
                <select
                  id="driverId"
                  name="driverId"
                  value={formData.driverId}
                  onChange={handleDriverChange}
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

            {/* Scheduling Conflict Warning */}
            {schedulingConflicts.length > 0 && (
              <div
                className="b2c-conflict-warning"
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fca5a5",
                  borderRadius: "8px",
                  padding: "16px",
                  marginTop: "16px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ marginRight: "8px" }}
                  >
                    <path
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      stroke="#dc2626"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span style={{ fontWeight: "600", color: "#dc2626" }}>
                    Scheduling Conflicts Detected
                  </span>
                </div>
                <ul
                  style={{ margin: "0", paddingLeft: "20px", color: "#7f1d1d" }}
                >
                  {schedulingConflicts.map((conflict, index) => (
                    <li key={index} style={{ marginBottom: "4px" }}>
                      <strong>
                        {conflict.type === "DRIVER" ? "Driver" : "Vehicle"}
                      </strong>{" "}
                      is already assigned to{" "}
                      <strong>{conflict.existingRoute}</strong> at{" "}
                      <strong>{conflict.conflictingTime}</strong> on{" "}
                      <strong>{conflict.overlappingDays?.join(", ")}</strong>
                    </li>
                  ))}
                </ul>
                <p
                  style={{
                    marginTop: "8px",
                    marginBottom: "0",
                    fontSize: "13px",
                    color: "#991b1b",
                  }}
                >
                  Please change the time, driver, vehicle, or available days to
                  avoid double-booking.
                </p>
              </div>
            )}

            {checkingConflicts && (
              <div
                style={{
                  textAlign: "center",
                  padding: "8px",
                  color: "#6b7280",
                }}
              >
                Checking for scheduling conflicts...
              </div>
            )}
            
            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="totalSeats" className="b2c-form-label">
                  Total Seats *
                </label>
                <input
                  type="number"
                  id="totalSeats"
                  name="totalSeats"
                  placeholder="20"
                  value={formData.totalSeats}
                  onChange={handleChange}
                  required
                  min="1"
                  max="50"
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="availableSeats" className="b2c-form-label">
                  Available Seats *
                </label>
                <input
                  type="number"
                  id="availableSeats"
                  name="availableSeats"
                  placeholder="20"
                  value={formData.availableSeats}
                  onChange={handleChange}
                  required
                  min="0"
                  max={formData.totalSeats}
                  className="b2c-form-input"
                />
              </div>
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
                <small className="b2c-form-help">
                  Daily price per trip (used for monthly calculation)
                </small>
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
                  Daily price per round trip (used for monthly calculation)
                </small>
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="monthlyOneWayPrice" className="b2c-form-label">
                  Monthly Pass (One Way) ({getCurrencySymbol(currency)}) *
                </label>
                <input
                  type="number"
                  id="monthlyOneWayPrice"
                  name="monthlyOneWayPrice"
                  placeholder="Auto-calculated"
                  value={formData.monthlyOneWayPrice}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="b2c-form-input"
                  readonly
                />
                <small className="b2c-form-help">
                  Auto-calculated based on daily price and available days
                </small>
              </div>

              <div className="b2c-form-group">
                <label className="b2c-form-label">
                  Monthly Pass (Round Trip) ({getCurrencySymbol(currency)}) *
                </label>
                <input
                  type="number"
                  id="monthlyRoundTripPrice"
                  name="monthlyRoundTripPrice"
                  placeholder="Auto-calculated"
                  value={formData.monthlyRoundTripPrice}
                  onChange={handleChange}
                  required
                  min="0"
                  step={decimals === 3 ? "0.001" : "0.01"}
                  className="b2c-form-input"
                  readonly
                />
                <small className="b2c-form-help">
                  Auto-calculated based on daily price and available days
                </small>
              </div>
            </div>

            <div className="b2c-pricing-preview">
              <h4 className="b2c-preview-title">🎫 Monthly Pass Pricing</h4>
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
                        <div className="b2c-trip-header">
                          <span className="b2c-trip-time">
                            {trip.departureTime}
                            {trip.tripType === "Round Trip" &&
                              trip.arrivalTime &&
                              ` - Return ${trip.arrivalTime}`}
                          </span>
                          <span className="b2c-trip-type">{trip.tripType}</span>
                        </div>

                        {/* Outbound Stops Preview */}
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

                        {/* Return Stops Preview */}
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

              <div className="b2c-pass-info">
                <p className="b2c-pass-text">
                  🚌 Passengers get unlimited travel with monthly pass!
                </p>
                <p className="b2c-pass-text">
                  💳 No daily tickets, only monthly subscriptions
                </p>
                <p className="b2c-pass-text">
                  🔄 Each trip time can be One Way or Round Trip
                </p>
              </div>
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
              {loading ? "Adding Route..." : "Add Route"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2C_AddRouteModal;
