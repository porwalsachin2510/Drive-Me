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
  const [currency, setCurrency] = useState("KWD");
  const [decimals, setDecimals] = useState(3);
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
  });
  const [loading, setLoading] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

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

      const userCurrency = countryToCurrency[userCountry] || "KWD";
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

      // Fetch vehicles and drivers from B2C partner fleet
      const [vehiclesResponse, driversResponse] = await Promise.all([
        api.get("/b2c-partner/fleet"),
        api.get("/b2c-partner/drivers"),
      ]);

      setAvailableVehicles(vehiclesResponse.data.fleet?.vehicles || []);
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

  // Handle vehicle selection change - update seats automatically
  const handleVehicleChange = (e) => {
    const selectedVehicleId = e.target.value;
    const selectedVehicle = availableVehicles.find(
      (v) => v._id === selectedVehicleId,
    );

    setFormData((prev) => ({
      ...prev,
      vehicleId: selectedVehicleId,
      // Auto-populate seats from vehicle
      totalSeats: selectedVehicle?.seatingCapacity || 0,
      availableSeats: selectedVehicle?.seatingCapacity || 0,
    }));
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

      // First create route
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
        },
        assignedVehicle: formData.vehicleId || null,
        assignedDriver: formData.driverId || null,
        routeStartDate:
          formData.routeStartDate || new Date().toISOString().split("T")[0],
        description: formData.description,
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
      alert("Failed to create route. Please try again.");
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
