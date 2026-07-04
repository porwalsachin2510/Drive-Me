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

const CorporateAssignedVehiclesPage = ({
  embedded = false,
  embeddedContractId = null,
} = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  // When embedded (e.g. a B2B partner managing on behalf of a corporate), the
  // contract id is passed via props instead of router state.
  const contractId = embeddedContractId || location.state?.contractId;

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

  // Managed-service brief context (only used when embedded, i.e. a B2B partner
  // running operations on behalf of the corporate). Lets the partner link the
  // route they are creating to a specific brief route request so it auto-fulfils.
  const [briefRouteItems, setBriefRouteItems] = useState([]);

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
    briefItemId: "",
    // Trip Times - like B2C Partner route creation
    tripTimes: [
      {
        tripNumber: 1,
        departureTime: "",
        tripType: "One Way",
        // Round trip specific time fields
        pickupStartTime: "", // When pickup begins from origin
        pickupEndTime: "", // When pickup ends (arrive at destination)
        returnStartTime: "", // When return trip starts from destination
        returnEndTime: "", // When return trip ends (back at origin)
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

  // State for viewing trip details
  const [showTripDetailsModal, setShowTripDetailsModal] = useState(false);
  const [selectedRouteForDetails, setSelectedRouteForDetails] = useState(null);

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
      // Changed: Extract all routes from all vehicles (routeDetails is now an array)
      const extractedRoutes = [];
      assignedVehicles.forEach((vehicle) => {
        // Handle both array (new) and single object (legacy) formats
        const routeDetailsArray = Array.isArray(vehicle.routeDetails)
          ? vehicle.routeDetails
          : vehicle.routeDetails
            ? [vehicle.routeDetails]
            : [];

        routeDetailsArray.forEach((routeDetail) => {
          if (routeDetail && Object.keys(routeDetail).length > 0) {
            extractedRoutes.push({
              ...routeDetail,
              assignedVehicleId: vehicle._id,
              vehicleName: vehicle.vehicleDetails?.vehicleName,
              registrationNumber: vehicle.vehicleDetails?.registrationNumber,
            });
          }
        });
      });
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

    // Validate trip times - ensure each trip has proper time fields
    for (let i = 0; i < routeForm.tripTimes.length; i++) {
      const trip = routeForm.tripTimes[i];
      if (trip.tripType === "One Way") {
        if (!trip.departureTime) {
          alert(`Trip ${i + 1}: Please enter departure time for One Way trip`);
          return;
        }
      } else if (trip.tripType === "Round Trip") {
        if (
          !trip.pickupStartTime ||
          !trip.pickupEndTime ||
          !trip.returnStartTime ||
          !trip.returnEndTime
        ) {
          alert(
            `Trip ${i + 1}: Please enter all time fields for Round Trip (Pickup Start/End and Return Start/End)`,
          );
          return;
        }
      }
    }

    try {
      const response = await api.post(
        `/contracts/assign-route/${contractId}/${selectedVehicle._id}`,
        routeForm,
      );

      if (response.data.success) {
        alert(
          response.data.briefAutoFulfilled
            ? "Route assigned and linked to the brief. It's now awaiting the corporate's approval."
            : "Route assigned successfully",
        );
        closeModal();
        await fetchAssignedVehicles();
        if (embedded) await fetchBriefRouteItems();
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

  // View trip details handler - shows the trip times already defined in the route
  const openTripDetailsModal = (route) => {
    setSelectedRouteForDetails(route);
    setShowTripDetailsModal(true);
  };

  const closeTripDetailsModal = () => {
    setShowTripDetailsModal(false);
    setSelectedRouteForDetails(null);
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
      briefItemId: "",
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
    // Refresh the brief's outstanding route requests so the partner can link
    // this new route to one of them (only relevant in embedded/on-behalf mode).
    if (embedded) fetchBriefRouteItems();
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedVehicle(null);
  };

  // Load the managed-service brief's route requests so the partner can pick which
  // one this route fulfils. Fetched lazily (embedded mode only). Failures are
  // silent — linking to a brief is optional and never blocks route creation.
  const fetchBriefRouteItems = useCallback(async () => {
    if (!embedded || !contractId) return;
    try {
      const res = await api.get(`/managed-service-brief/${contractId}`);
      if (res.data?.success) {
        setBriefRouteItems(res.data.data.brief?.routeRequests || []);
      }
    } catch (err) {
      // Non-managed contracts / no brief: just skip the selector.
      setBriefRouteItems([]);
    }
  }, [embedded, contractId]);

  // Changed: Returns array of routes (supports multiple routes per vehicle)
  const getAssignedVehicleRoutes = (vehicle) => {
    // Handle both array (new) and single object (legacy) formats
    if (Array.isArray(vehicle.routeDetails)) {
      return vehicle.routeDetails.filter((r) => r && Object.keys(r).length > 0);
    }
    // Legacy format - single routeDetails object
    if (vehicle.routeDetails && Object.keys(vehicle.routeDetails).length > 0) {
      return [vehicle.routeDetails];
    }
    return [];
  };

  // Delete a route
  const handleDeleteRoute = async (vehicleId, routeId) => {
    if (!window.confirm("Are you sure you want to delete this route?")) {
      return;
    }

    try {
      const response = await api.delete(
        `/contracts/${contractId}/vehicles/${vehicleId}/routes/${routeId}`,
      );

      if (response.data.success) {
        alert("Route deleted successfully");
        await fetchAssignedVehicles();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete route");
      console.error("Error deleting route:", err);
    }
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
          tripType: "One Way",
          // Round trip time fields
          pickupStartTime: "",
          pickupEndTime: "",
          returnStartTime: "",
          returnEndTime: "",
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
          if (tripType === "Round Trip") {
            return {
              ...trip,
              tripType: tripType,
              // Clear one-way field when switching to round trip
              departureTime: "",
              // Initialize round trip time fields
              pickupStartTime: trip.pickupStartTime || "",
              pickupEndTime: trip.pickupEndTime || "",
              returnStartTime: trip.returnStartTime || "",
              returnEndTime: trip.returnEndTime || "",
              returnStopPoints: [
                { location: "", time: "" },
                { location: "", time: "" },
              ],
            };
          } else {
            return {
              ...trip,
              tripType: tripType,
              // Clear round trip fields when switching to one-way
              pickupStartTime: "",
              pickupEndTime: "",
              returnStartTime: "",
              returnEndTime: "",
              returnStopPoints: [],
            };
          }
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
      {!embedded && <Navbar activeTab="contracts" setActiveTab={() => {}} />}
      <div className="corporate-assigned-vehicles-container">
        {!embedded && (
          <button
            className="corporate-assigned-vehicles-back-btn"
            onClick={() => navigate("/corporate-profile?tab=contracts")}
          >
            ← Back to Contracts
          </button>
        )}

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
                  const vehicleRoutes = getAssignedVehicleRoutes(vehicle);
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

                      {/* Routes Section - Multiple Routes Support */}
                      <div className="assignment-card routes-section">
                        <div className="assignment-card-header">
                          <span className="assignment-label">
                            Routes ({vehicleRoutes.length})
                          </span>
                          <span
                            className={`status-badge ${
                              vehicleRoutes.length > 0 ? "assigned" : "pending"
                            }`}
                          >
                            {vehicleRoutes.length > 0
                              ? `${vehicleRoutes.length} route(s)`
                              : "pending"}
                          </span>
                        </div>

                        {vehicleRoutes.length > 0 ? (
                          <div className="routes-list">
                            {vehicleRoutes.map((route, index) => (
                              <div
                                key={route._id || index}
                                className="route-item"
                              >
                                <div className="route-item-header">
                                  <span className="route-number">
                                    Route {index + 1}
                                  </span>
                                  <button
                                    className="route-delete-btn"
                                    onClick={() =>
                                      handleDeleteRoute(vehicle._id, route._id)
                                    }
                                    title="Delete this route"
                                  >
                                    ×
                                  </button>
                                </div>
                                <div className="route-item-details">
                                  <p className="route-text">
                                    <strong>From:</strong> {route.fromLocation}
                                  </p>
                                  <p className="route-text">
                                    <strong>To:</strong> {route.toLocation}
                                  </p>
                                  {route.routeStartDate && (
                                    <p className="route-text route-date">
                                      <strong>Date:</strong>{" "}
                                      {new Date(
                                        route.routeStartDate,
                                      ).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="not-assigned">No routes assigned yet</p>
                        )}

                        {/* Always show Add Route button to support multiple routes */}
                        <button
                          className="assign-btn add-route-btn"
                          onClick={() => openRouteModal(vehicle)}
                        >
                          + Add {vehicleRoutes.length > 0 ? "Another " : ""}
                          Route
                        </button>
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

                      {/* View Trip Details Button */}
                      <div className="corporate-assigned-vehicles-route-actions">
                        <button
                          className="corporate-assigned-vehicles-view-details-btn"
                          onClick={() => openTripDetailsModal(route)}
                        >
                          View Trip Details
                        </button>
                        <button
                          className="corporate-assigned-vehicles-delete-route-btn"
                          onClick={() =>
                            handleDeleteRoute(
                              route.assignedVehicleId,
                              route._id,
                            )
                          }
                        >
                          Delete Route
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
          <div className="modal-overlay">
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
          <div className="modal-overlay">
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
          <div className="modal-overlay">
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
          <div className="modal-overlay">
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
                        {/* Trip Type Selector - Always visible */}
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

                        {/* One Way: Single Departure Time */}
                        {trip.tripType === "One Way" && (
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
                        )}
                      </div>

                      {/* Round Trip: 4 Time Fields */}
                      {trip.tripType === "Round Trip" && (
                        <div className="round-trip-times-container">
                          <div className="round-trip-section">
                            <h5 className="round-trip-section-title">
                              <span className="section-icon outbound-icon"></span>
                              Pickup Journey (
                              {routeForm.fromLocation || "Origin"} &rarr;{" "}
                              {routeForm.toLocation || "Destination"})
                            </h5>
                            <div className="form-row">
                              <div className="form-group">
                                <label>Pickup Start Time *</label>
                                <input
                                  type="time"
                                  value={trip.pickupStartTime || ""}
                                  onChange={(e) =>
                                    updateTripTime(
                                      tripIndex,
                                      "pickupStartTime",
                                      e.target.value,
                                    )
                                  }
                                  required
                                />
                                <small className="form-hint">
                                  When vehicle starts picking up employees
                                </small>
                              </div>
                              <div className="form-group">
                                <label>Pickup End Time *</label>
                                <input
                                  type="time"
                                  value={trip.pickupEndTime || ""}
                                  onChange={(e) =>
                                    updateTripTime(
                                      tripIndex,
                                      "pickupEndTime",
                                      e.target.value,
                                    )
                                  }
                                  required
                                />
                                <small className="form-hint">
                                  When vehicle arrives at destination
                                </small>
                              </div>
                            </div>
                          </div>

                          <div className="round-trip-section">
                            <h5 className="round-trip-section-title">
                              <span className="section-icon return-icon"></span>
                              Return Journey (
                              {routeForm.toLocation ||
                                "Destination"} &rarr;{" "}
                              {routeForm.fromLocation || "Origin"})
                            </h5>
                            <div className="form-row">
                              <div className="form-group">
                                <label>Return Start Time *</label>
                                <input
                                  type="time"
                                  value={trip.returnStartTime || ""}
                                  onChange={(e) =>
                                    updateTripTime(
                                      tripIndex,
                                      "returnStartTime",
                                      e.target.value,
                                    )
                                  }
                                  required
                                />
                                <small className="form-hint">
                                  When vehicle departs from destination
                                </small>
                              </div>
                              <div className="form-group">
                                <label>Return End Time *</label>
                                <input
                                  type="time"
                                  value={trip.returnEndTime || ""}
                                  onChange={(e) =>
                                    updateTripTime(
                                      tripIndex,
                                      "returnEndTime",
                                      e.target.value,
                                    )
                                  }
                                  required
                                />
                                <small className="form-hint">
                                  When employees are dropped back
                                </small>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

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

                  {embedded && briefRouteItems.length > 0 && (
                    <div className="form-group">
                      <label>Fulfills brief route request (optional)</label>
                      <select
                        value={routeForm.briefItemId}
                        onChange={(e) =>
                          setRouteForm({
                            ...routeForm,
                            briefItemId: e.target.value,
                          })
                        }
                      >
                        <option value="">— Not linked to a brief item —</option>
                        {briefRouteItems.map((r) => {
                          const done =
                            r.fulfillment?.status === "FULFILLED" &&
                            r.fulfillment?.approvalStatus === "APPROVED";
                          return (
                            <option key={r._id} value={r._id} disabled={done}>
                              {(r.label || "Route request") +
                                (r.fromArea || r.toWorkLocation
                                  ? ` (${r.fromArea || "?"} → ${r.toWorkLocation || "?"})`
                                  : "") +
                                (done ? " — already approved" : "")}
                            </option>
                          );
                        })}
                      </select>
                      <small className="form-hint">
                        Linking auto-marks that brief item fulfilled and sends
                        it to the corporate for approval.
                      </small>
                    </div>
                  )}

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

        {/* Trip Details Modal - Shows the trip times already defined in the route */}
        {showTripDetailsModal && selectedRouteForDetails && (
          <div
            className="corporate-assigned-vehicles-modal-overlay"
            onClick={closeTripDetailsModal}
          >
            <div
              className="corporate-assigned-vehicles-modal-premium"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="corporate-assigned-vehicles-modal-header-premium">
                <h2>Trip Details</h2>
                <button
                  className="corporate-assigned-vehicles-modal-close"
                  onClick={closeTripDetailsModal}
                >
                  X
                </button>
              </div>
              <div className="corporate-assigned-vehicles-modal-form">
                {/* Route Info */}
                <div className="corporate-assigned-vehicles-trip-details-route-info">
                  <h3>
                    {selectedRouteForDetails.fromLocation} to{" "}
                    {selectedRouteForDetails.toLocation}
                  </h3>
                  <p>
                    <strong>Start Date:</strong>{" "}
                    {new Date(
                      selectedRouteForDetails.routeStartDate,
                    ).toLocaleDateString()}
                  </p>
                  {selectedRouteForDetails.totalDistance && (
                    <p>
                      <strong>Distance:</strong>{" "}
                      {selectedRouteForDetails.totalDistance}
                    </p>
                  )}
                  {selectedRouteForDetails.estimatedDuration && (
                    <p>
                      <strong>Duration:</strong>{" "}
                      {selectedRouteForDetails.estimatedDuration}
                    </p>
                  )}
                  {selectedRouteForDetails.availableDays &&
                    selectedRouteForDetails.availableDays.length > 0 && (
                      <p>
                        <strong>Available Days:</strong>{" "}
                        {selectedRouteForDetails.availableDays.join(", ")}
                      </p>
                    )}
                </div>

                {/* Trip Times */}
                <div className="corporate-assigned-vehicles-trip-details-section">
                  <h4>Scheduled Trips</h4>
                  {selectedRouteForDetails.tripTimes &&
                  selectedRouteForDetails.tripTimes.length > 0 ? (
                    <div className="corporate-assigned-vehicles-trip-times-list">
                      {selectedRouteForDetails.tripTimes.map((trip, index) => (
                        <div
                          key={index}
                          className="corporate-assigned-vehicles-trip-time-card"
                        >
                          <div className="corporate-assigned-vehicles-trip-time-header">
                            <span className="corporate-assigned-vehicles-trip-number">
                              Trip {trip.tripNumber || index + 1}
                            </span>
                            <span
                              className={`corporate-assigned-vehicles-trip-type-badge ${trip.tripType === "Round Trip" ? "round-trip" : "one-way"}`}
                            >
                              {trip.tripType || "One Way"}
                            </span>
                          </div>
                          <div className="corporate-assigned-vehicles-trip-time-details">
                            {trip.tripType === "Round Trip" ? (
                              <>
                                <div className="corporate-assigned-vehicles-trip-journey">
                                  <strong>Pickup Journey:</strong>
                                  <p>
                                    {selectedRouteForDetails.fromLocation} to{" "}
                                    {selectedRouteForDetails.toLocation}
                                  </p>
                                  <p>
                                    Start:{" "}
                                    {trip.pickupStartTime ||
                                      trip.departureTime ||
                                      "N/A"}{" "}
                                    | End: {trip.pickupEndTime || "N/A"}
                                  </p>
                                </div>
                                <div className="corporate-assigned-vehicles-trip-journey">
                                  <strong>Return Journey:</strong>
                                  <p>
                                    {selectedRouteForDetails.toLocation} to{" "}
                                    {selectedRouteForDetails.fromLocation}
                                  </p>
                                  <p>
                                    Start:{" "}
                                    {trip.returnStartTime ||
                                      trip.returnDepartureTime ||
                                      "N/A"}{" "}
                                    | End:{" "}
                                    {trip.returnEndTime ||
                                      trip.returnArrivalTime ||
                                      "N/A"}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <div className="corporate-assigned-vehicles-trip-journey">
                                <strong>One Way Journey:</strong>
                                <p>
                                  {selectedRouteForDetails.fromLocation} to{" "}
                                  {selectedRouteForDetails.toLocation}
                                </p>
                                <p>Departure: {trip.departureTime || "N/A"}</p>
                              </div>
                            )}

                            {/* Outbound Stop Points */}
                            {trip.outboundStopPoints &&
                              trip.outboundStopPoints.length > 0 && (
                                <div className="corporate-assigned-vehicles-trip-stops">
                                  <strong>Outbound Stops:</strong>
                                  <ul>
                                    {trip.outboundStopPoints.map(
                                      (stop, idx) => (
                                        <li key={idx}>
                                          {stop.location} - {stop.time}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}

                            {/* Return Stop Points (for Round Trip) */}
                            {trip.tripType === "Round Trip" &&
                              trip.returnStopPoints &&
                              trip.returnStopPoints.length > 0 && (
                                <div className="corporate-assigned-vehicles-trip-stops">
                                  <strong>Return Stops:</strong>
                                  <ul>
                                    {trip.returnStopPoints.map((stop, idx) => (
                                      <li key={idx}>
                                        {stop.location} - {stop.time}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="corporate-assigned-vehicles-no-trips">
                      No trip times defined for this route.
                    </p>
                  )}
                </div>

                {/* Route Notes */}
                {selectedRouteForDetails.routeNotes && (
                  <div className="corporate-assigned-vehicles-trip-details-notes">
                    <h4>Notes</h4>
                    <p>{selectedRouteForDetails.routeNotes}</p>
                  </div>
                )}

                <div className="corporate-assigned-vehicles-modal-form-actions">
                  <button
                    type="button"
                    className="corporate-assigned-vehicles-modal-btn-primary"
                    onClick={closeTripDetailsModal}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default CorporateAssignedVehiclesPage;
