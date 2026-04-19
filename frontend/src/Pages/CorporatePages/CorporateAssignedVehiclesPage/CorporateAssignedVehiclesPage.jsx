/* eslint-disable no-unused-vars */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../../utils/api";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import Footer from "../../../Components/Footer/Footer";
import Navbar from "../../../Components/Navbar/Navbar";
import "./CorporateAssignedVehiclesPage.css";
import AddDriverModal from "../../../Components/Corporate/AddDriverModal/AddDriverModal";

const CorporateAssignedVehiclesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { contractId } = location.state || {};

  const [contract, setContract] = useState(null);
  const [assignedVehicles, setAssignedVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("vehicles");
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  console.log("assignedVehicles", assignedVehicles);
  const [showAddCorporateDriverModal, setShowAddCorporateDriverModal] =
    useState(false);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [corporateDrivers, setCorporateDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);

  console.log("availableDrivers", availableDrivers);

  const [assignmentForm, setAssignmentForm] = useState({
    driverId: "",
    fuelCardNumber: "",
  });

  const [routeForm, setRouteForm] = useState({
    fromLocation: "",
    toLocation: "",
    routeStartDate: "",
    routeEndDate: "",
    stopPoints: [],
    totalDistance: "",
    estimatedDuration: "",
    availableDays: [],
    routeNotes: "",
    // Trip Times - like B2C Partner route creation
    tripTimes: [
      {
        tripNumber: 1,
        departureTime: "",
        tripType: "One Way",
        outboundStopPoints: [
          { location: "", time: "" },
          { location: "", time: "" },
        ],
        returnStopPoints: [],
      },
    ],
  });

  const [newStopPoint, setNewStopPoint] = useState({
    location: "",
    time: "",
  });

  const [modalType, setModalType] = useState(null);

  // Trip creation state
  const [tripForm, setTripForm] = useState({
    routeId: "",
    tripSchedules: [
      {
        startTime: "",
        endTime: "",
        tripType: "ONE_WAY", // Individual trip type per schedule
        direction: "FORWARD",
      },
    ],
  });
  const [showTripModal, setShowTripModal] = useState(false);

  const fetchCorporateDrivers = useCallback(async () => {
    try {
      const response = await api.get("/corporate/corporate-drivers");
      if (response.data.success) {
        setCorporateDrivers(response.data.drivers || []);
      }
    } catch (err) {
      console.error("Error fetching corporate drivers:", err);
    }
  }, []);

  const fetchAvailableDrivers = async () => {
    try {
      setDriversLoading(true);
      const driversResponse = await api.get(
        `/corporate/available-corporate-driver`,
      );

      console.log("first driversData", driversResponse.data);

      if (driversResponse.data.success) {
        setAvailableDrivers(driversResponse.data.drivers || []);
      }
    } catch (err) {
      console.error("Error fetching drivers", err);
      alert("Failed to load available drivers");
    } finally {
      setDriversLoading(false);
    }
  };

  const fetchAssignedVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/contracts/assigned-vehicles/${contractId}`,
      );

      if (response.data.success) {
        setContract(response.data.data.contract);
        setAssignedVehicles(response.data.data.assignedVehicles || []);
      } else {
        setError(response.data.message || "Failed to fetch assigned vehicles");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Error loading assigned vehicles",
      );
      console.error("Error fetching assigned vehicles:", err);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    if (!contractId) {
      setError("Contract ID not provided");
      setLoading(false);
      return;
    }

    fetchAssignedVehicles();
    fetchCorporateDrivers();
  }, [contractId, fetchAssignedVehicles, fetchCorporateDrivers]);

  useEffect(() => {
    if (assignedVehicles && assignedVehicles.length > 0) {
      const extractedRoutes = assignedVehicles
        .filter(
          (vehicle) =>
            vehicle.routeDetails &&
            Object.keys(vehicle.routeDetails).length > 0,
        )
        .map((vehicle) => ({
          ...vehicle.routeDetails,
          vehicleId: vehicle._id,
          vehicleName: vehicle.vehicleDetails?.vehicleName,
          registrationNumber: vehicle.vehicleDetails?.registrationNumber,
        }));
      setRoutes(extractedRoutes);
    }
  }, [assignedVehicles]);

  const handleAssignmentSubmit = async (e, type) => {
    e.preventDefault();

    if (type === "driver" && !assignmentForm.driverId) {
      alert("Please enter driver ID");
      return;
    }

    if (type === "fuel" && !assignmentForm.fuelCardNumber) {
      alert("Please enter fuel card number");
      return;
    }

    const payload =
      type === "driver"
        ? { driverId: assignmentForm.driverId }
        : { fuelCardNumber: assignmentForm.fuelCardNumber };

    try {
      const response = await api.post(
        `/contracts/assign-driver-fuel/${contractId}/${selectedVehicle._id}`,
        payload,
      );

      if (response.data.success) {
        alert(
          `${type === "driver" ? "Driver" : "Fuel card"} assigned successfully`,
        );
        closeModal();
        await fetchAssignedVehicles();
      }
    } catch (err) {
      alert(err.response?.data?.message || `Failed to assign ${type}`);
      console.error("Error updating assignment:", err);
    }
  };

  const handleRouteSubmit = async (e) => {
    e.preventDefault();

    if (!routeForm.fromLocation || !routeForm.toLocation) {
      alert("Please fill in required route details");
      return;
    }

    try {
      const response = await api.post(
        `/contracts/assign-route/${contractId}/${selectedVehicle._id}`,
        routeForm,
      );

      if (response.data.success) {
        alert("Route assigned successfully");
        closeModal();
        await fetchAssignedVehicles();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to assign route");
      console.error("Error assigning route:", err);
    }
  };

  const handleAddStopPoint = () => {
    if (!newStopPoint.location || !newStopPoint.time) {
      alert("Please fill in location and time for the stop point");
      return;
    }

    setRouteForm({
      ...routeForm,
      stopPoints: [
        ...routeForm.stopPoints,
        { location: newStopPoint.location, time: newStopPoint.time },
      ],
    });

    setNewStopPoint({ location: "", time: "" });
  };

  const handleRemoveStopPoint = (index) => {
    setRouteForm({
      ...routeForm,
      stopPoints: routeForm.stopPoints.filter((_, i) => i !== index),
    });
  };

  // Trip creation handlers
  const handleTripSubmit = async (e) => {
    e.preventDefault();

    if (!tripForm.routeId) {
      alert("Please select a route");
      return;
    }

    try {
      const response = await api.post("/trips/create-from-route", tripForm);

      if (response.data.success) {
        alert(`Created ${response.data.data.trips.length} trips successfully`);
        setShowTripModal(false);
        setTripForm({
          routeId: "",
          tripSchedules: [
            {
              startTime: "",
              endTime: "",
              tripType: "ONE_WAY",
              direction: "FORWARD",
            },
          ],
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create trips");
      console.error("Error creating trips:", err);
    }
  };

  // Get route locations for dynamic direction labels
  const getRouteLocations = () => {
    const route = routes.find((r) => r._id === tripForm.routeId);
    if (route) {
      return {
        from: route.fromLocation,
        to: route.toLocation,
      };
    }
    return { from: "Start Location", to: "End Location" };
  };

  const handleScheduleChange = (index, field, value) => {
    setTripForm((prev) => ({
      ...prev,
      tripSchedules: prev.tripSchedules.map((schedule, i) =>
        i === index ? { ...schedule, [field]: value } : schedule,
      ),
    }));
  };

  const handleTripTypeChangeForSchedule = (index, tripType) => {
    setTripForm((prev) => ({
      ...prev,
      tripSchedules: prev.tripSchedules.map((schedule, i) => {
        if (i === index) {
          if (tripType === "ROUND_TRIP") {
            // For round trip, automatically set both directions
            return {
              ...schedule,
              tripType: tripType,
              direction: "FORWARD", // Round trip always starts with forward
            };
          } else {
            return {
              ...schedule,
              tripType: tripType,
              direction: "FORWARD", // One way only forward
            };
          }
        }
        return schedule;
      }),
    }));
  };

  const addSchedule = () => {
    setTripForm((prev) => ({
      ...prev,
      tripSchedules: [
        ...prev.tripSchedules,
        {
          startTime: "",
          endTime: "",
          tripType: "ONE_WAY",
          direction: "FORWARD",
        },
      ],
    }));
  };

  const removeSchedule = (index) => {
    if (tripForm.tripSchedules.length > 1) {
      setTripForm((prev) => ({
        ...prev,
        tripSchedules: prev.tripSchedules.filter((_, i) => i !== index),
      }));
    }
  };

  const openTripModal = (routeId) => {
    const route = routes.find((r) => r._id === routeId);
    setTripForm((prev) => ({
      ...prev,
      routeId,
      tripSchedules: [
        {
          startTime: "",
          endTime: "",
          tripType: "ONE_WAY",
          direction: "FORWARD",
        },
      ],
    }));
    setShowTripModal(true);
  };

  const openAssignmentModal = (vehicle, type) => {
    setSelectedVehicle(vehicle);
    setModalType(type);
    if (type === "driver" || type === "changeDriver") {
      setAssignmentForm({ ...assignmentForm, driverId: "" });
      fetchAvailableDrivers();
    } else if (type === "fuel") {
      setAssignmentForm({ ...assignmentForm, fuelCardNumber: "" });
    }
  };

  // Handle driver change (update) for CORPORATE assigned drivers
  const handleChangeDriverSubmit = async (e) => {
    e.preventDefault();

    if (!assignmentForm.driverId) {
      alert("Please select a driver");
      return;
    }

    try {
      const response = await api.put(
        `/contracts/update-corporate-driver/${contractId}/${selectedVehicle._id}`,
        { newDriverId: assignmentForm.driverId },
      );

      if (response.data.success) {
        alert("Driver updated successfully across all records");
        closeModal();
        await fetchAssignedVehicles();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update driver");
      console.error("Error updating driver:", err);
    }
  };

  const openRouteModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setModalType("route");
    setRouteForm({
      fromLocation: "",
      toLocation: "",
      routeStartDate: "",
      routeEndDate: "",
      stopPoints: [],
      totalDistance: "",
      estimatedDuration: "",
      availableDays: ["MON", "TUE", "WED", "THU", "FRI"],
      routeNotes: "",
      tripTimes: [
        {
          tripNumber: 1,
          departureTime: "",
          tripType: "One Way",
          outboundStopPoints: [
            { location: "", time: "" },
            { location: "", time: "" },
          ],
          returnStopPoints: [],
        },
      ],
    });
    setNewStopPoint({ location: "", time: "" });
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedVehicle(null);
  };

  const getAssignedVehicleRoute = (vehicle) => {
    return vehicle.routeDetails && Object.keys(vehicle.routeDetails).length > 0
      ? vehicle.routeDetails
      : null;
  };

  const getAssignmentStatus = (vehicle, type) => {
    if (type === "driver") {
      return vehicle.driverId ? "assigned" : "pending";
    }
    if (type === "fuel") {
      return vehicle.fuelCardNumber ? "assigned" : "pending";
    }
  };

  if (loading) {
    return (
      <div className="corporate-assigned-vehicles-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="corporate-assigned-vehicles-error">
        <div className="error-icon">⚠️</div>
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => navigate("/corporate/contracts")}>
          Back to Contracts
        </button>
      </div>
    );
  }

  const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  const toggleDay = (day) => {
    setRouteForm((prev) => {
      const days = prev.availableDays || [];

      return {
        ...prev,
        availableDays: days.includes(day)
          ? days.filter((d) => d !== day)
          : [...days, day],
      };
    });
  };

  // Trip Times Helper Functions
  const addTripTime = () => {
    setRouteForm((prev) => ({
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
    if (routeForm.tripTimes.length > 1) {
      setRouteForm((prev) => ({
        ...prev,
        tripTimes: prev.tripTimes
          .filter((_, i) => i !== index)
          .map((trip, i) => ({ ...trip, tripNumber: i + 1 })),
      }));
    }
  };

  const updateTripTime = (index, field, value) => {
    setRouteForm((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) =>
        i === index ? { ...trip, [field]: value } : trip,
      ),
    }));
  };

  const handleTripTypeChange = (index, tripType) => {
    setRouteForm((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) => {
        if (i === index) {
          return {
            ...trip,
            tripType: tripType,
            returnStopPoints:
              tripType === "Round Trip"
                ? [
                    { location: "", time: "" },
                    { location: "", time: "" },
                  ]
                : [],
          };
        }
        return trip;
      }),
    }));
  };

  const addOutboundStop = (tripIndex) => {
    setRouteForm((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) =>
        i === tripIndex
          ? {
              ...trip,
              outboundStopPoints: [
                ...trip.outboundStopPoints,
                { location: "", time: "" },
              ],
            }
          : trip,
      ),
    }));
  };

  const removeOutboundStop = (tripIndex, stopIndex) => {
    if (routeForm.tripTimes[tripIndex].outboundStopPoints.length > 2) {
      setRouteForm((prev) => ({
        ...prev,
        tripTimes: prev.tripTimes.map((trip, i) =>
          i === tripIndex
            ? {
                ...trip,
                outboundStopPoints: trip.outboundStopPoints.filter(
                  (_, si) => si !== stopIndex,
                ),
              }
            : trip,
        ),
      }));
    }
  };

  const updateOutboundStop = (tripIndex, stopIndex, field, value) => {
    setRouteForm((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) =>
        i === tripIndex
          ? {
              ...trip,
              outboundStopPoints: trip.outboundStopPoints.map((stop, si) =>
                si === stopIndex ? { ...stop, [field]: value } : stop,
              ),
            }
          : trip,
      ),
    }));
  };

  const addReturnStop = (tripIndex) => {
    setRouteForm((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) =>
        i === tripIndex
          ? {
              ...trip,
              returnStopPoints: [
                ...trip.returnStopPoints,
                { location: "", time: "" },
              ],
            }
          : trip,
      ),
    }));
  };

  const removeReturnStop = (tripIndex, stopIndex) => {
    if (routeForm.tripTimes[tripIndex].returnStopPoints.length > 2) {
      setRouteForm((prev) => ({
        ...prev,
        tripTimes: prev.tripTimes.map((trip, i) =>
          i === tripIndex
            ? {
                ...trip,
                returnStopPoints: trip.returnStopPoints.filter(
                  (_, si) => si !== stopIndex,
                ),
              }
            : trip,
        ),
      }));
    }
  };

  const updateReturnStop = (tripIndex, stopIndex, field, value) => {
    setRouteForm((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.map((trip, i) =>
        i === tripIndex
          ? {
              ...trip,
              returnStopPoints: trip.returnStopPoints.map((stop, si) =>
                si === stopIndex ? { ...stop, [field]: value } : stop,
              ),
            }
          : trip,
      ),
    }));
  };

  return (
    <>
      <Navbar activeTab="contracts" setActiveTab={() => {}} />
      <div className="corporate-assigned-vehicles-container">
        <button
          className="corporate-assigned-vehicles-back-btn"
          onClick={() => navigate("/corporate-profile?tab=contracts")}
        >
          ← Back to Contracts
        </button>

        <div className="corporate-assigned-vehicles-header">
          <div>
            <h1>Assigned Vehicles</h1>
            <p className="contract-info">
              Contract: {contract?.contractNumber}
            </p>
          </div>
          <button
            className="corporate-assigned-vehicles-add-btn"
            onClick={() => setShowAddCorporateDriverModal(true)}
          >
            + Add Driver
          </button>
        </div>

        <div className="corporate-assigned-vehicles-tabs">
          <button
            className={`tab-button ${activeTab === "vehicles" ? "active" : ""}`}
            onClick={() => setActiveTab("vehicles")}
          >
            Vehicles ({assignedVehicles.length})
          </button>
          <button
            className={`tab-button ${activeTab === "routes" ? "active" : ""}`}
            onClick={() => setActiveTab("routes")}
          >
            Routes ({routes.length})
          </button>
          <button
            className={`tab-button ${activeTab === "drivers" ? "active" : ""}`}
            onClick={() => setActiveTab("drivers")}
          >
            Drivers ({corporateDrivers.length})
          </button>
        </div>

        {/* Vehicles Tab */}
        {activeTab === "vehicles" && (
          <div className="corporate-assigned-vehicles-content">
            {assignedVehicles.length === 0 ? (
              <div className="empty-state">
                <p>No assigned vehicles yet</p>
              </div>
            ) : (
              <div className="vehicles-grid">
                {assignedVehicles.map((vehicle) => {
                  const vehicleRoute = getAssignedVehicleRoute(vehicle);
                  return (
                    <div key={vehicle._id} className="vehicle-card-premium">
                      <div className="vehicle-card-header-premium">
                        <div className="vehicle-name-badge">
                          <h3>{vehicle.vehicleDetails?.vehicleName}</h3>
                          <span className="vehicle-category-badge">
                            {vehicle.vehicleDetails?.vehicleCategory}
                          </span>
                        </div>
                        <p className="vehicle-reg-premium">
                          {vehicle.vehicleDetails?.registrationNumber}
                        </p>
                      </div>

                      {/* Driver Section */}
                      <div className="assignment-card">
                        <div className="assignment-card-header">
                          <span className="assignment-label">Driver</span>
                          <span
                            className={`status-badge ${getAssignmentStatus(
                              vehicle,
                              "driver",
                            )}`}
                          >
                            {getAssignmentStatus(vehicle, "driver")}
                          </span>
                        </div>
                        {vehicle.driverId ? (
                          <div className="assignment-details">
                            <p className="driver-name">
                              {vehicle.driverId.name}
                            </p>
                            <p className="driver-meta">
                              License: {vehicle.driverId.licenseNumber}
                            </p>
                            <p className="assigned-by-meta">
                              {vehicle.driverAssignedBy === "B2B_PARTNER"
                                ? "🏢 Fleet Owner"
                                : "✓ Self"}
                            </p>
                          </div>
                        ) : (
                          <p className="not-assigned">No driver assigned yet</p>
                        )}
                        {!vehicle.driverId && (
                          <button
                            className="assign-btn"
                            onClick={() =>
                              openAssignmentModal(vehicle, "driver")
                            }
                          >
                            Assign Driver
                          </button>
                        )}
                        {/* Change Driver button - only for drivers assigned by CORPORATE */}
                        {vehicle.driverId &&
                          vehicle.driverAssignedBy === "CORPORATE" && (
                            <button
                              className="change-btn"
                              onClick={() =>
                                openAssignmentModal(vehicle, "changeDriver")
                              }
                            >
                              Change Driver
                            </button>
                          )}
                      </div>

                      {/* Fuel Section */}
                      <div className="assignment-card">
                        <div className="assignment-card-header">
                          <span className="assignment-label">Fuel Card</span>
                          <span
                            className={`status-badge ${getAssignmentStatus(
                              vehicle,
                              "fuel",
                            )}`}
                          >
                            {getAssignmentStatus(vehicle, "fuel")}
                          </span>
                        </div>
                        {vehicle.fuelCardNumber ? (
                          <div className="assignment-details">
                            <p className="fuel-card-number">
                              {vehicle.fuelCardNumber}
                            </p>
                            <p className="assigned-by-meta">
                              {vehicle.fuelAssignedBy === "B2B_PARTNER"
                                ? "🏢 Fleet Owner"
                                : "✓ Self"}
                            </p>
                          </div>
                        ) : (
                          <p className="not-assigned">
                            No fuel card assigned yet
                          </p>
                        )}
                        {!vehicle.fuelCardNumber && (
                          <button
                            className="assign-btn"
                            onClick={() => openAssignmentModal(vehicle, "fuel")}
                          >
                            Add Fuel Card
                          </button>
                        )}
                      </div>

                      {/* Route Section */}
                      <div className="assignment-card">
                        <div className="assignment-card-header">
                          <span className="assignment-label">Route</span>
                          <span
                            className={`status-badge ${
                              vehicleRoute ? "assigned" : "pending"
                            }`}
                          >
                            {vehicleRoute ? "assigned" : "pending"}
                          </span>
                        </div>
                        {vehicleRoute ? (
                          <div className="assignment-details">
                            <p className="route-text">
                              <strong>📍 From:</strong>{" "}
                              {vehicleRoute.fromLocation}
                            </p>
                            <p className="route-text">
                              <strong>📍 To:</strong> {vehicleRoute.toLocation}
                            </p>
                            <p className="route-text">
                              <strong>📅 Date:</strong>{" "}
                              {new Date(
                                vehicleRoute.routeStartDate,
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        ) : (
                          <p className="not-assigned">No route assigned yet</p>
                        )}
                        {!vehicleRoute && (
                          <button
                            className="assign-btn"
                            onClick={() => openRouteModal(vehicle)}
                          >
                            Assign Route
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Routes Tab */}
        {activeTab === "routes" && (
          <div className="corporate-assigned-vehicles-content">
            {routes.length === 0 ? (
              <div className="corporate-assigned-vehicles-empty-state">
                <p>No routes assigned yet</p>
              </div>
            ) : (
              <div className="corporate-assigned-vehicles-routes-grid">
                {routes.map((route) => (
                  <div
                    key={route._id}
                    className="corporate-assigned-vehicles-route-card-premium"
                  >
                    <div className="corporate-assigned-vehicles-route-card-header-premium">
                      <h3>
                        {route.fromLocation} → {route.toLocation}
                      </h3>
                      <span className="corporate-assigned-vehicles-route-status-badge">
                        {route.status}
                      </span>
                    </div>
                    <div className="corporate-assigned-vehicles-route-card-body">
                      <div className="corporate-assigned-vehicles-route-info">
                        <p className="corporate-assigned-vehicles-route-detail">
                          <strong>🚗 Vehicle:</strong> {route.vehicleName} (
                          {route.registrationNumber})
                        </p>
                        <p className="corporate-assigned-vehicles-route-detail">
                          <strong>📅 Start Date:</strong>{" "}
                          {new Date(route.routeStartDate).toLocaleDateString()}
                        </p>
                        <p className="corporate-assigned-vehicles-route-detail">
                          <strong>📏 Distance:</strong> {route.totalDistance} km
                        </p>
                        <p className="corporate-assigned-vehicles-route-detail">
                          <strong>⏳ Duration:</strong>{" "}
                          {route.estimatedDuration}
                        </p>
                        {route.routeNotes && (
                          <p className="corporate-assigned-vehicles-route-detail">
                            <strong>📝 Notes:</strong> {route.routeNotes}
                          </p>
                        )}
                      </div>

                      {/* Create Trips Button */}
                      <div className="corporate-assigned-vehicles-route-actions">
                        <button
                          className="corporate-assigned-vehicles-create-trips-btn"
                          onClick={() => openTripModal(route._id)}
                        >
                          🚀 Create Trips
                        </button>
                      </div>

                      {/* Stop Points */}
                      {route.stopPoints && route.stopPoints.length > 0 && (
                        <div className="corporate-assigned-vehicles-stop-points-display">
                          <strong>🛑 Stop Points:</strong>
                          <div className="corporate-assigned-vehicles-stop-points-list-display">
                            {route.stopPoints.map((stop, idx) => (
                              <div
                                key={idx}
                                className="corporate-assigned-vehicles-stop-point-display"
                              >
                                <span className="corporate-assigned-vehicles-stop-location">
                                  {stop.location}
                                </span>
                                <span className="corporate-assigned-vehicles-stop-time">
                                  {stop.time}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Drivers Tab */}
        {activeTab === "drivers" && (
          <div className="corporate-assigned-vehicles-content">
            {corporateDrivers.length === 0 ? (
              <div className="empty-state">
                <p>No drivers added yet. Click "+ Add Driver" to add one.</p>
              </div>
            ) : (
              <div className="vehicles-grid">
                {corporateDrivers.map((driver) => (
                  <div key={driver._id} className="vehicle-card-premium">
                    <div className="vehicle-card-header-premium">
                      <div className="vehicle-name-badge">
                        <h3>{driver.name}</h3>
                        <span
                          className={`vehicle-category-badge ${driver.status === "AVAILABLE" ? "" : "status-assigned"}`}
                        >
                          {driver.status}
                        </span>
                      </div>
                      <p className="vehicle-reg-premium">{driver.phone}</p>
                    </div>

                    <div className="assignment-card">
                      <div className="assignment-card-header">
                        <span className="assignment-label">
                          License Details
                        </span>
                      </div>
                      <div className="assignment-details">
                        <p>
                          <strong>License No:</strong> {driver.licenseNumber}
                        </p>
                        <p>
                          <strong>License Type:</strong> {driver.licenseType}
                        </p>
                        <p>
                          <strong>Expiry:</strong>{" "}
                          {new Date(driver.licenseExpiry).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="assignment-card">
                      <div className="assignment-card-header">
                        <span className="assignment-label">Personal Info</span>
                      </div>
                      <div className="assignment-details">
                        <p>
                          <strong>Email:</strong> {driver.email}
                        </p>
                        <p>
                          <strong>Nationality:</strong> {driver.nationality}
                        </p>
                        <p>
                          <strong>Experience:</strong>{" "}
                          {driver.experience?.years || 0} years
                        </p>
                        {driver.address?.city && (
                          <p>
                            <strong>City:</strong> {driver.address.city}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="assignment-card">
                      <div className="assignment-card-header">
                        <span className="assignment-label">Ratings</span>
                      </div>
                      <div className="assignment-details">
                        <p>
                          <strong>Average:</strong>{" "}
                          {driver.ratings?.average?.toFixed(1) || "0.0"} / 5
                        </p>
                        <p>
                          <strong>Total Reviews:</strong>{" "}
                          {driver.ratings?.count || 0}
                        </p>
                      </div>
                    </div>
                    </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Driver Assignment Modal */}
        {/* {modalType === "driver" && selectedVehicle && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-premium" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-premium">
                <h2>Assign Driver</h2>
                <button className="modal-close" onClick={closeModal}>
                  ✕
                </button>
              </div>
              <form
                onSubmit={(e) => handleAssignmentSubmit(e, "driver")}
                className="modal-form"
              >
                <div className="form-group">
                  <label>Driver ID *</label>
                  <input
                    type="text"
                    placeholder="Enter driver ID or reference"
                    value={assignmentForm.driverId}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        driverId: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-submit">
                    Assign Driver
                  </button>
                </div>
              </form>
            </div>
          </div>
        )} */}

        {modalType === "driver" && selectedVehicle && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-premium" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-premium">
                <h2>Assign Driver</h2>
                <button className="modal-close" onClick={closeModal}>
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => handleAssignmentSubmit(e, "driver")}
                className="modal-form"
              >
                <div className="form-group">
                  <label>Select Driver *</label>

                  {driversLoading ? (
                    <p>Loading drivers...</p>
                  ) : (
                    <select
                      value={assignmentForm.driverId}
                      onChange={(e) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          driverId: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">-- Select Driver --</option>

                      {availableDrivers.map((driver) => (
                        <option key={driver._id} value={driver._id}>
                          {driver.name} - {driver.licenseNumber}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-submit">
                    Assign Driver
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Driver Modal - For updating CORPORATE assigned drivers */}
        {modalType === "changeDriver" && selectedVehicle && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-premium" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-premium">
                <h2>Change Driver</h2>
                <button className="modal-close" onClick={closeModal}>
                  X
                </button>
              </div>

              <div className="current-driver-info">
                <p>
                  <strong>Current Driver:</strong>{" "}
                  {selectedVehicle.driverId?.name}
                </p>
                <p>
                  <strong>License:</strong>{" "}
                  {selectedVehicle.driverId?.licenseNumber}
                </p>
              </div>

              <form onSubmit={handleChangeDriverSubmit} className="modal-form">
                <div className="form-group">
                  <label>Select New Driver *</label>

                  {driversLoading ? (
                    <p>Loading drivers...</p>
                  ) : (
                    <select
                      value={assignmentForm.driverId}
                      onChange={(e) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          driverId: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">-- Select New Driver --</option>

                      {availableDrivers
                        .filter(
                          (driver) =>
                            driver._id !== selectedVehicle.driverId?._id,
                        )
                        .map((driver) => (
                          <option key={driver._id} value={driver._id}>
                            {driver.name} - {driver.licenseNumber}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <p className="change-driver-note">
                  Note: Changing the driver will update all associated trips,
                  routes, and schedules.
                </p>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-submit btn-change">
                    Change Driver
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Fuel Assignment Modal */}
        {modalType === "fuel" && selectedVehicle && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-premium" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-premium">
                <h2>Add Fuel Card</h2>
                <button className="modal-close" onClick={closeModal}>
                  ✕
                </button>
              </div>
              <form
                onSubmit={(e) => handleAssignmentSubmit(e, "fuel")}
                className="modal-form"
              >
                <div className="form-group">
                  <label>Fuel Card Number *</label>
                  <input
                    type="text"
                    placeholder="Enter fuel card number"
                    value={assignmentForm.fuelCardNumber}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        fuelCardNumber: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-submit">
                    Add Fuel Card
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Route Assignment Modal - Enhanced with Trip Times */}
        {modalType === "route" && selectedVehicle && (
          <div className="modal-overlay" onClick={closeModal}>
            <div
              className="modal-premium modal-large modal-scrollable"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header-premium">
                <h2>Assign Route</h2>
                <button className="modal-close" onClick={closeModal}>
                  &times;
                </button>
              </div>
              <form onSubmit={handleRouteSubmit} className="modal-form">
                {/* Basic Route Information */}
                <div className="route-section">
                  <h3 className="route-section-title">
                    Basic Route Information
                  </h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>From Location *</label>
                      <input
                        type="text"
                        placeholder="e.g., Employee Pickup Area"
                        value={routeForm.fromLocation}
                        onChange={(e) =>
                          setRouteForm({
                            ...routeForm,
                            fromLocation: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>To Location *</label>
                      <input
                        type="text"
                        placeholder="e.g., Office Building"
                        value={routeForm.toLocation}
                        onChange={(e) =>
                          setRouteForm({
                            ...routeForm,
                            toLocation: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Route Start Date *</label>
                      <input
                        type="date"
                        value={routeForm.routeStartDate}
                        onChange={(e) =>
                          setRouteForm({
                            ...routeForm,
                            routeStartDate: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Route End Date (Optional)</label>
                      <input
                        type="date"
                        value={routeForm.routeEndDate}
                        onChange={(e) =>
                          setRouteForm({
                            ...routeForm,
                            routeEndDate: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Available Days *</label>
                    <div className="days-container">
                      {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(
                        (day) => (
                          <button
                            key={day}
                            type="button"
                            className={`day-button ${
                              routeForm.availableDays?.includes(day)
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => toggleDay(day)}
                          >
                            {day}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* Trip Times Section */}
                <div className="route-section trip-times-section">
                  <div className="trip-times-header">
                    <h3 className="route-section-title">Trip Times</h3>
                    <p className="trip-times-description">
                      Add multiple departure times for this route. Each time
                      will create separate trips for employee transport.
                    </p>
                  </div>

                  {routeForm.tripTimes.map((trip, tripIndex) => (
                    <div key={tripIndex} className="trip-time-card">
                      <div className="trip-time-header">
                        <h4>Trip {trip.tripNumber}</h4>
                        {routeForm.tripTimes.length > 1 && (
                          <button
                            type="button"
                            className="btn-remove-trip"
                            onClick={() => removeTripTime(tripIndex)}
                          >
                            &times;
                          </button>
                        )}
                      </div>

                      <div className="form-row">
                        <div className="form-group">
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
                        <div className="form-group">
                          <label>Trip Type</label>
                          <select
                            value={trip.tripType}
                            onChange={(e) =>
                              handleTripTypeChange(tripIndex, e.target.value)
                            }
                          >
                            <option value="One Way">One Way</option>
                            <option value="Round Trip">Round Trip</option>
                          </select>
                        </div>
                        {trip.tripType === "Round Trip" && (
                          <div className="form-group">
                            <label>Return Time *</label>
                            <input
                              type="time"
                              value={trip.returnTime || ""}
                              onChange={(e) =>
                                updateTripTime(
                                  tripIndex,
                                  "returnTime",
                                  e.target.value,
                                )
                              }
                              required
                            />
                            <small className="form-hint">
                              Time when vehicle returns from destination
                            </small>
                          </div>
                        )}
                      </div>

                      {/* Outbound Stops (Morning: Home -> Office) */}
                      <div className="stop-points-container">
                        <div className="stop-points-header">
                          <span className="stop-indicator outbound">
                            Outbound Stops: {routeForm.fromLocation || "Start"}{" "}
                            &rarr; {routeForm.toLocation || "End"}
                          </span>
                          <button
                            type="button"
                            className="btn-add-stop-inline"
                            onClick={() => addOutboundStop(tripIndex)}
                          >
                            + Add Outbound Stop
                          </button>
                        </div>
                        {trip.outboundStopPoints.map((stop, stopIndex) => (
                          <div key={stopIndex} className="stop-point-row">
                            <span className="stop-number">{stopIndex + 1}</span>
                            <input
                              type="text"
                              placeholder="Stop location (e.g., Dubai Mall)"
                              value={stop.location}
                              onChange={(e) =>
                                updateOutboundStop(
                                  tripIndex,
                                  stopIndex,
                                  "location",
                                  e.target.value,
                                )
                              }
                            />
                            <input
                              type="time"
                              value={stop.time}
                              onChange={(e) =>
                                updateOutboundStop(
                                  tripIndex,
                                  stopIndex,
                                  "time",
                                  e.target.value,
                                )
                              }
                            />
                            {trip.outboundStopPoints.length > 2 && (
                              <button
                                type="button"
                                className="btn-remove-stop-inline"
                                onClick={() =>
                                  removeOutboundStop(tripIndex, stopIndex)
                                }
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Return Stops (Evening: Office -> Home) - Only for Round Trip */}
                      {trip.tripType === "Round Trip" && (
                        <div className="stop-points-container return-stops">
                          <div className="stop-points-header">
                            <span className="stop-indicator return">
                              Return Stops: {routeForm.toLocation || "End"}{" "}
                              &rarr; {routeForm.fromLocation || "Start"}
                            </span>
                            <button
                              type="button"
                              className="btn-add-stop-inline return"
                              onClick={() => addReturnStop(tripIndex)}
                            >
                              + Add Return Stop
                            </button>
                          </div>
                          {trip.returnStopPoints.map((stop, stopIndex) => (
                            <div key={stopIndex} className="stop-point-row">
                              <span className="stop-number return">
                                {stopIndex + 1}
                              </span>
                              <input
                                type="text"
                                placeholder="Stop location (e.g., Sharjah)"
                                value={stop.location}
                                onChange={(e) =>
                                  updateReturnStop(
                                    tripIndex,
                                    stopIndex,
                                    "location",
                                    e.target.value,
                                  )
                                }
                              />
                              <input
                                type="time"
                                value={stop.time}
                                onChange={(e) =>
                                  updateReturnStop(
                                    tripIndex,
                                    stopIndex,
                                    "time",
                                    e.target.value,
                                  )
                                }
                              />
                              {trip.returnStopPoints.length > 2 && (
                                <button
                                  type="button"
                                  className="btn-remove-stop-inline"
                                  onClick={() =>
                                    removeReturnStop(tripIndex, stopIndex)
                                  }
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn-add-trip-time"
                    onClick={addTripTime}
                  >
                    + Add Another Trip Time
                  </button>
                </div>

                {/* Additional Details */}
                <div className="route-section">
                  <h3 className="route-section-title">Additional Details</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Total Distance (km)</label>
                      <input
                        type="number"
                        placeholder="Distance in kilometers"
                        value={routeForm.totalDistance}
                        onChange={(e) =>
                          setRouteForm({
                            ...routeForm,
                            totalDistance: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Estimated Duration</label>
                      <input
                        type="text"
                        placeholder="e.g., 2 hours 30 minutes"
                        value={routeForm.estimatedDuration}
                        onChange={(e) =>
                          setRouteForm({
                            ...routeForm,
                            estimatedDuration: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Route Notes</label>
                    <textarea
                      placeholder="Any special instructions or notes for this route"
                      value={routeForm.routeNotes}
                      onChange={(e) =>
                        setRouteForm({
                          ...routeForm,
                          routeNotes: e.target.value,
                        })
                      }
                      rows="3"
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-submit">
                    Assign Route
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAddCorporateDriverModal && (
          <AddDriverModal
            onClose={() => setShowAddCorporateDriverModal(false)}
            onSuccess={() => {
              setShowAddCorporateDriverModal(false);
              fetchCorporateDrivers();
            }}
          />
        )}

        {/* Trip Creation Modal */}
        {showTripModal && (
          <div
            className="corporate-assigned-vehicles-modal-overlay"
            onClick={() => setShowTripModal(false)}
          >
            <div
              className="corporate-assigned-vehicles-modal-premium"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="corporate-assigned-vehicles-modal-header-premium">
                <h2>🚀 Create Trips from Route</h2>
                <button
                  className="corporate-assigned-vehicles-modal-close"
                  onClick={() => setShowTripModal(false)}
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={handleTripSubmit}
                className="corporate-assigned-vehicles-modal-form"
              >
                <div className="corporate-assigned-vehicles-form-group">
                  <label className="corporate-assigned-vehicles-form-label">
                    Trip Schedules
                  </label>
                  <div className="corporate-assigned-vehicles-modal-trip-schedules">
                    {tripForm.tripSchedules.map((schedule, index) => (
                      <div
                        key={index}
                        className="corporate-assigned-vehicles-modal-schedule-item"
                      >
                        <div className="corporate-assigned-vehicles-modal-schedule-header">
                          <span className="corporate-assigned-vehicles-modal-schedule-number">
                            Trip {index + 1}
                          </span>
                          {tripForm.tripSchedules.length > 1 && (
                            <button
                              type="button"
                              className="corporate-assigned-vehicles-modal-remove-schedule-btn"
                              onClick={() => removeSchedule(index)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="corporate-assigned-vehicles-modal-schedule-fields">
                          <div className="corporate-assigned-vehicles-form-group">
                            <label>Trip Type</label>
                            <div className="corporate-assigned-vehicles-modal-trip-type-selector-small">
                              <button
                                type="button"
                                className={`corporate-assigned-vehicles-modal-trip-type-btn-small ${schedule.tripType === "ONE_WAY" ? "corporate-assigned-vehicles-modal-selected" : ""}`}
                                onClick={() =>
                                  handleTripTypeChangeForSchedule(
                                    index,
                                    "ONE_WAY",
                                  )
                                }
                              >
                                🚗 One Way
                              </button>
                              <button
                                type="button"
                                className={`corporate-assigned-vehicles-modal-trip-type-btn-small ${schedule.tripType === "ROUND_TRIP" ? "corporate-assigned-vehicles-modal-selected" : ""}`}
                                onClick={() =>
                                  handleTripTypeChangeForSchedule(
                                    index,
                                    "ROUND_TRIP",
                                  )
                                }
                              >
                                🔄 Round Trip
                              </button>
                            </div>
                          </div>
                          <div className="corporate-assigned-vehicles-modal-form-row">
                            <div className="corporate-assigned-vehicles-form-group">
                              <label>Start Time</label>
                              <input
                                type="time"
                                value={schedule.startTime}
                                onChange={(e) =>
                                  handleScheduleChange(
                                    index,
                                    "startTime",
                                    e.target.value,
                                  )
                                }
                                required
                              />
                            </div>
                            <div className="corporate-assigned-vehicles-form-group">
                              <label>End Time</label>
                              <input
                                type="time"
                                value={schedule.endTime}
                                onChange={(e) =>
                                  handleScheduleChange(
                                    index,
                                    "endTime",
                                    e.target.value,
                                  )
                                }
                                required
                              />
                            </div>
                          </div>
                          <div className="corporate-assigned-vehicles-form-group">
                            <label>Trip Details</label>
                            <div className="corporate-assigned-vehicles-modal-trip-info-display">
                              {(() => {
                                const { from, to } = getRouteLocations();
                                if (schedule.tripType === "ONE_WAY") {
                                  return (
                                    <div className="corporate-assigned-vehicles-modal-trip-info-one-way">
                                      <span className="corporate-assigned-vehicles-modal-trip-icon">
                                        🚗
                                      </span>
                                      <span className="corporate-assigned-vehicles-modal-trip-text">
                                        One Way: {from} → {to}
                                      </span>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="corporate-assigned-vehicles-modal-trip-info-round-trip">
                                      <span className="corporate-assigned-vehicles-modal-trip-icon">
                                        🔄
                                      </span>
                                      <span className="corporate-assigned-vehicles-modal-trip-text">
                                        Round Trip: {from} → {to} → {from}
                                      </span>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="corporate-assigned-vehicles-modal-add-schedule-btn"
                      onClick={addSchedule}
                    >
                      + Add Another Schedule
                    </button>
                  </div>
                </div>
                <div className="corporate-assigned-vehicles-modal-form-actions">
                  <button
                    type="button"
                    className="corporate-assigned-vehicles-modal-btn-secondary"
                    onClick={() => setShowTripModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="corporate-assigned-vehicles-modal-btn-primary"
                  >
                    Create Trips
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};;

export default CorporateAssignedVehiclesPage;
