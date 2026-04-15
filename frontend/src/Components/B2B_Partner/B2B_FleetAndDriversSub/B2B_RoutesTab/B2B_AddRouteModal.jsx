"use client";

import { useState, useEffect } from "react";
import "./b2b_addroutemodal.css";
import api from "../../../../utils/api";

function B2B_AddRouteModal({ onClose, onSuccess, contracts }) {
  const [formData, setFormData] = useState({
    contractId: "",
    assignedVehicleId: "",
    fromLocation: "",
    toLocation: "",
    routeStartDate: "",
    routeEndDate: "",
    availableDays: ["MON", "TUE", "WED", "THU", "FRI"],
    totalDistance: "",
    estimatedDuration: "",
    routeNotes: "",
    tripTimes: [
      {
        tripNumber: 1,
        departureTime: "",
        returnTime: "",
        tripType: "One Way",
        outboundStopPoints: [
          { location: "", time: "" },
          { location: "", time: "" },
        ],
        returnStopPoints: [],
      },
    ],
  });

  const [loading, setLoading] = useState(false);
  const [activeContracts, setActiveContracts] = useState([]);
  const [assignedVehicles, setAssignedVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  useEffect(() => {
    if (contracts && contracts.length > 0) {
      const active = contracts.filter(
        (c) =>
          c.status === "ACTIVE" &&
          c.vehicles?.some((v) => v.assignedVehicles?.length > 0),
      );
      setActiveContracts(active);
    }
  }, [contracts]);

  const fetchAssignedVehicles = async (contractId) => {
    if (!contractId) {
      setAssignedVehicles([]);
      return;
    }

    try {
      setLoadingVehicles(true);
      const response = await api.get(
        `/b2b-partner/contracts/${contractId}/assigned-vehicles`,
      );
      if (response.data.success) {
        setAssignedVehicles(response.data.data.assignedVehicles || []);
      }
    } catch (error) {
      console.error("Error fetching assigned vehicles:", error);
      setAssignedVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleContractChange = (e) => {
    const contractId = e.target.value;
    setFormData((prev) => ({
      ...prev,
      contractId,
      assignedVehicleId: "",
    }));
    fetchAssignedVehicles(contractId);
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

  // Trip time management
  const addTripTime = () => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: [
        ...prev.tripTimes,
        {
          tripNumber: prev.tripTimes.length + 1,
          departureTime: "",
          returnTime: "",
          tripType: "One Way",
          outboundStopPoints: [
            { location: "", time: "" },
            { location: "", time: "" },
          ],
          returnStopPoints: [],
        },
      ],
    }));
  };

  const removeTripTime = (index) => {
    if (formData.tripTimes.length > 1) {
      setFormData((prev) => ({
        ...prev,
        tripTimes: prev.tripTimes
          .filter((_, i) => i !== index)
          .map((trip, i) => ({ ...trip, tripNumber: i + 1 })),
      }));
    }
  };

  const updateTripTime = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) => {
        if (i === index) {
          const updated = { ...trip, [field]: value };
          // If changing to Round Trip, add return stops
          if (
            field === "tripType" &&
            value === "Round Trip" &&
            trip.returnStopPoints.length === 0
          ) {
            updated.returnStopPoints = [
              { location: "", time: "" },
              { location: "", time: "" },
            ];
          }
          return updated;
        }
        return trip;
      }),
    }));
  };

  // Stop point management for trips
  const addStopPointToTrip = (tripIndex, journeyType) => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) => {
        if (i === tripIndex) {
          const stopArray =
            journeyType === "outbound"
              ? "outboundStopPoints"
              : "returnStopPoints";
          return {
            ...trip,
            [stopArray]: [...trip[stopArray], { location: "", time: "" }],
          };
        }
        return trip;
      }),
    }));
  };

  const removeStopPointFromTrip = (tripIndex, stopIndex, journeyType) => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) => {
        if (i === tripIndex) {
          const stopArray =
            journeyType === "outbound"
              ? "outboundStopPoints"
              : "returnStopPoints";
          if (trip[stopArray].length > 2) {
            return {
              ...trip,
              [stopArray]: trip[stopArray].filter((_, si) => si !== stopIndex),
            };
          }
        }
        return trip;
      }),
    }));
  };

  const updateTripStopPoint = (
    tripIndex,
    stopIndex,
    field,
    value,
    journeyType,
  ) => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) => {
        if (i === tripIndex) {
          const stopArray =
            journeyType === "outbound"
              ? "outboundStopPoints"
              : "returnStopPoints";
          return {
            ...trip,
            [stopArray]: trip[stopArray].map((stop, si) =>
              si === stopIndex ? { ...stop, [field]: value } : stop,
            ),
          };
        }
        return trip;
      }),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.contractId || !formData.assignedVehicleId) {
        alert("Please select a contract and vehicle");
        setLoading(false);
        return;
      }

      if (!formData.fromLocation || !formData.toLocation) {
        alert("Please fill in route locations");
        setLoading(false);
        return;
      }

      // Validate trip times
      const validTripTimes = formData.tripTimes.filter(
        (trip) => trip.departureTime,
      );
      if (validTripTimes.length === 0) {
        alert("Please add at least one departure time");
        setLoading(false);
        return;
      }

      const response = await api.post(
        `/b2b-partner/contracts/${formData.contractId}/assign-route/${formData.assignedVehicleId}`,
        {
          fromLocation: formData.fromLocation,
          toLocation: formData.toLocation,
          routeStartDate: formData.routeStartDate,
          routeEndDate: formData.routeEndDate,
          availableDays: formData.availableDays,
          totalDistance: parseFloat(formData.totalDistance) || 0,
          estimatedDuration: formData.estimatedDuration,
          routeNotes: formData.routeNotes,
          tripTimes: validTripTimes,
        },
      );

      if (response.data.success) {
        alert("Route created successfully!");
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Error creating route:", error);
      alert(error.response?.data?.message || "Failed to create route");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drivemego-btobarm-b2b-modal-overlay" onClick={onClose}>
      <div
        className="drivemego-btobarm-b2b-add-route-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drivemego-btobarm-b2b-modal-header">
          <h2>Add New Route</h2>
          <button
            className="drivemego-btobarm-b2b-modal-close"
            onClick={onClose}
          >
            X
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="drivemego-btobarm-b2b-route-form"
        >
          {/* Contract & Vehicle Selection */}
          <div className="drivemego-btobarm-b2b-form-section">
            <h3 className="drivemego-btobarm-b2b-section-title">
              Contract & Vehicle
            </h3>
            <div className="drivemego-btobarm-b2b-form-row">
              <div className="drivemego-btobarm-b2b-form-group">
                <label>Select Contract *</label>
                <select
                  name="contractId"
                  value={formData.contractId}
                  onChange={handleContractChange}
                  required
                >
                  <option value="">-- Select Contract --</option>
                  {activeContracts.map((contract) => (
                    <option key={contract._id} value={contract._id}>
                      {contract.contractNumber} -{" "}
                      {contract.corporateOwnerId?.companyName || "Corporate"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="drivemego-btobarm-b2b-form-group">
                <label>Select Vehicle *</label>
                <select
                  name="assignedVehicleId"
                  value={formData.assignedVehicleId}
                  onChange={handleChange}
                  required
                  disabled={!formData.contractId || loadingVehicles}
                >
                  <option value="">
                    {loadingVehicles ? "Loading..." : "-- Select Vehicle --"}
                  </option>
                  {assignedVehicles.map((vehicle) => (
                    <option key={vehicle._id} value={vehicle._id}>
                      {vehicle.vehicleDetails?.vehicleName} -{" "}
                      {vehicle.vehicleDetails?.registrationNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Basic Route Information */}
          <div className="drivemego-btobarm-b2b-form-section">
            <h3 className="drivemego-btobarm-b2b-section-title">
              Basic Route Information
            </h3>
            <div className="drivemego-btobarm-b2b-form-row">
              <div className="drivemego-btobarm-b2b-form-group">
                <label>From Location *</label>
                <input
                  type="text"
                  name="fromLocation"
                  placeholder="e.g., Employee Pickup Area"
                  value={formData.fromLocation}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="drivemego-btobarm-b2b-form-group">
                <label>To Location *</label>
                <input
                  type="text"
                  name="toLocation"
                  placeholder="e.g., Office Building"
                  value={formData.toLocation}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="drivemego-btobarm-b2b-form-row">
              <div className="drivemego-btobarm-b2b-form-group">
                <label>Route Start Date *</label>
                <input
                  type="date"
                  name="routeStartDate"
                  value={formData.routeStartDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="drivemego-btobarm-b2b-form-group">
                <label>Route End Date (Optional)</label>
                <input
                  type="date"
                  name="routeEndDate"
                  value={formData.routeEndDate}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="drivemego-btobarm-b2b-form-group">
              <label>Available Days *</label>
              <div className="drivemego-btobarm-b2b-days-selector">
                {daysOfWeek.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`drivemego-btobarm-b2b-day-btn ${formData.availableDays.includes(day) ? "drivemego-btobarm-selected" : ""}`}
                    onClick={() => handleDayChange(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trip Times */}
          <div className="drivemego-btobarm-b2b-form-section">
            <h3 className="drivemego-btobarm-b2b-section-title">Trip Times</h3>
            <p className="drivemego-btobarm-b2b-section-desc">
              Add multiple departure times for this route. Each time will create
              separate trips for employee transport.
            </p>

            {formData.tripTimes.map((trip, tripIndex) => (
              <div
                key={tripIndex}
                className="drivemego-btobarm-b2b-trip-time-item"
              >
                <div className="drivemego-btobarm-b2b-trip-header">
                  <span className="drivemego-btobarm-b2b-trip-number">
                    Trip {trip.tripNumber}
                  </span>
                  {formData.tripTimes.length > 1 && (
                    <button
                      type="button"
                      className="drivemego-btobarm-b2b-remove-trip-btn"
                      onClick={() => removeTripTime(tripIndex)}
                    >
                      X
                    </button>
                  )}
                </div>

                <div className="drivemego-btobarm-b2b-form-row">
                  <div className="drivemego-btobarm-b2b-form-group">
                    <label>Departure Time *</label>
                    <input
                      type="time"
                      value={trip.departureTime}
                      onChange={(e) =>
                        updateTripTime(
                          tripIndex,
                          "departureTime",
                          e.target.value,
                        )
                      }
                      required
                    />
                  </div>
                  <div className="drivemego-btobarm-b2b-form-group">
                    <label>Trip Type</label>
                    <select
                      value={trip.tripType}
                      onChange={(e) =>
                        updateTripTime(tripIndex, "tripType", e.target.value)
                      }
                    >
                      <option value="One Way">One Way</option>
                      <option value="Round Trip">Round Trip</option>
                    </select>
                  </div>
                </div>

                {trip.tripType === "Round Trip" && (
                  <div className="drivemego-btobarm-b2b-form-row">
                    <div className="drivemego-btobarm-b2b-form-group">
                      <label>Return Time *</label>
                      <input
                        type="time"
                        value={trip.returnTime}
                        onChange={(e) =>
                          updateTripTime(
                            tripIndex,
                            "returnTime",
                            e.target.value,
                          )
                        }
                        required
                      />
                      <small className="drivemego-btobarm-b2b-form-help">
                        Time when vehicle returns from destination
                      </small>
                    </div>
                  </div>
                )}

                {/* Outbound Stop Points */}
                <div className="drivemego-btobarm-b2b-stop-points-section">
                  <div className="drivemego-btobarm-b2b-stop-header">
                    <span className="drivemego-btobarm-b2b-stop-title outbound">
                      Outbound Stops: {formData.fromLocation || "Start"} →{" "}
                      {formData.toLocation || "End"}
                    </span>
                    <button
                      type="button"
                      className="drivemego-btobarm-b2b-add-stop-btn"
                      onClick={() => addStopPointToTrip(tripIndex, "outbound")}
                    >
                      + Add Outbound Stop
                    </button>
                  </div>
                  <div className="drivemego-btobarm-b2b-stop-points-list">
                    {trip.outboundStopPoints.map((stop, stopIndex) => (
                      <div
                        key={stopIndex}
                        className="drivemego-btobarm-b2b-stop-point-row"
                      >
                        <span className="drivemego-btobarm-b2b-stop-index drivemego-btobarm-outbound">
                          {stopIndex + 1}
                        </span>
                        <input
                          type="text"
                          placeholder={`Stop location (e.g., ${stopIndex === 0 ? "Dubai Marina" : "Mall of Emirates"})`}
                          value={stop.location}
                          onChange={(e) =>
                            updateTripStopPoint(
                              tripIndex,
                              stopIndex,
                              "location",
                              e.target.value,
                              "outbound",
                            )
                          }
                        />
                        <input
                          type="time"
                          value={stop.time}
                          onChange={(e) =>
                            updateTripStopPoint(
                              tripIndex,
                              stopIndex,
                              "time",
                              e.target.value,
                              "outbound",
                            )
                          }
                        />
                        {trip.outboundStopPoints.length > 2 && (
                          <button
                            type="button"
                            className="drivemego-btobarm-b2b-remove-stop-btn"
                            onClick={() =>
                              removeStopPointFromTrip(
                                tripIndex,
                                stopIndex,
                                "outbound",
                              )
                            }
                          >
                            X
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return Stop Points (only for Round Trip) */}
                {trip.tripType === "Round Trip" && (
                  <div className="drivemego-btobarm-b2b-stop-points-section">
                    <div className="drivemego-btobarm-b2b-stop-header">
                      <span className="drivemego-btobarm-b2b-stop-title return">
                        Return Stops: {formData.toLocation || "End"} →{" "}
                        {formData.fromLocation || "Start"}
                      </span>
                      <button
                        type="button"
                        className="drivemego-btobarm-b2b-add-stop-btn return"
                        onClick={() => addStopPointToTrip(tripIndex, "return")}
                      >
                        + Add Return Stop
                      </button>
                    </div>
                    <div className="drivemego-btobarm-b2b-stop-points-list">
                      {trip.returnStopPoints.map((stop, stopIndex) => (
                        <div key={stopIndex} className="b2b-stop-point-row">
                          <span className="drivemego-btobarm-b2b-stop-index return">
                            {stopIndex + 1}
                          </span>
                          <input
                            type="text"
                            placeholder={`Return stop location`}
                            value={stop.location}
                            onChange={(e) =>
                              updateTripStopPoint(
                                tripIndex,
                                stopIndex,
                                "location",
                                e.target.value,
                                "return",
                              )
                            }
                          />
                          <input
                            type="time"
                            value={stop.time}
                            onChange={(e) =>
                              updateTripStopPoint(
                                tripIndex,
                                stopIndex,
                                "time",
                                e.target.value,
                                "return",
                              )
                            }
                          />
                          {trip.returnStopPoints.length > 2 && (
                            <button
                              type="button"
                              className="drivemego-btobarm-b2b-remove-stop-btn"
                              onClick={() =>
                                removeStopPointFromTrip(
                                  tripIndex,
                                  stopIndex,
                                  "return",
                                )
                              }
                            >
                              X
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              className="drivemego-btobarm-b2b-add-trip-btn"
              onClick={addTripTime}
            >
              + Add Another Trip Time
            </button>
          </div>

          {/* Additional Details */}
          <div className="drivemego-btobarm-b2b-form-section">
            <h3 className="drivemego-btobarm-b2b-section-title">
              Additional Details
            </h3>
            <div className="drivemego-btobarm-b2b-form-row">
              <div className="drivemego-btobarm-b2b-form-group">
                <label>Total Distance (KM)</label>
                <input
                  type="number"
                  name="totalDistance"
                  placeholder="Distance in kilometers"
                  value={formData.totalDistance}
                  onChange={handleChange}
                />
              </div>
              <div className="drivemego-btobarm-b2b-form-group">
                <label>Estimated Duration</label>
                <input
                  type="text"
                  name="estimatedDuration"
                  placeholder="e.g., 2 hours 30 minutes"
                  value={formData.estimatedDuration}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="drivemego-btobarm-b2b-form-group">
              <label>Route Notes</label>
              <textarea
                name="routeNotes"
                placeholder="Any special instructions or notes for this route"
                value={formData.routeNotes}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="drivemego-btobarm-b2b-form-actions">
            <button
              type="button"
              className="drivemego-btobarm-b2b-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="drivemego-btobarm-b2b-submit-btn"
              disabled={loading}
            >
              {loading ? "Creating..." : "Assign Route"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2B_AddRouteModal;
