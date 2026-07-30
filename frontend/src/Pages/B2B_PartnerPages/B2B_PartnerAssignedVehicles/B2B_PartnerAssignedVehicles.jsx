"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../../utils/api";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import Navbar from "../../../Components/Navbar/Navbar";
import "./B2B_PartnerAssignedVehicles.css";
import { notify } from "../../../utils/toast";

const B2B_PartnerAssignedVehicles = () => {
  const { contractId } = useParams();
  const navigate = useNavigate();

  const [contract, setContract] = useState(null);
  const [assignedVehicles, setAssignedVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("vehicles");
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [modalType, setModalType] = useState(null);

  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableVehicles, setAvailableVehicles] = useState([]);

  const [updateForm, setUpdateForm] = useState({
    newDriverId: "",
    newVehicleId: "",
  });
  const [updating, setUpdating] = useState(false);

  const fetchAssignedVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/b2b-partner/contracts/${contractId}/assigned-vehicles`,
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

  const fetchAvailableAssets = async () => {
    try {
      const [driversResponse, vehiclesResponse] = await Promise.all([
        api.get("/b2b/drivers"),
        api.get("/vehicles/my/vehicles"),
      ]);

      setAvailableDrivers(driversResponse.data.drivers || []);
      setAvailableVehicles(vehiclesResponse.data.data?.vehicles || []);
    } catch (err) {
      console.error("Error fetching assets:", err);
    }
  };

  useEffect(() => {
    if (!contractId) {
      setError("Contract ID not provided");
      setLoading(false);
      return;
    }

    fetchAssignedVehicles();
    fetchAvailableAssets();
  }, [contractId, fetchAssignedVehicles]);

  useEffect(() => {
    if (assignedVehicles && assignedVehicles.length > 0) {
      const extractedRoutes = [];

      assignedVehicles.forEach((vehicle) => {
        // routeDetails is an array of route objects (populated from Route model)
        const routeDetailsArray = vehicle.routeDetails || [];

        // Handle both array and single object cases
        const routesArr = Array.isArray(routeDetailsArray)
          ? routeDetailsArray
          : [routeDetailsArray];

        routesArr.forEach((route) => {
          // Skip if route is null/undefined or just an ObjectId string
          if (!route || typeof route === "string" || !route.fromLocation) {
            return;
          }

          extractedRoutes.push({
            ...route,
            vehicleId: vehicle._id,
            vehicleName: vehicle.vehicleDetails?.vehicleName,
            registrationNumber: vehicle.vehicleDetails?.registrationNumber,
          });
        });
      });

      setRoutes(extractedRoutes);
    }
  }, [assignedVehicles]);

  const openUpdateModal = (vehicle, type) => {
    setSelectedVehicle(vehicle);
    setModalType(type);
    setUpdateForm({
      newDriverId: type === "driver" ? vehicle.driverId?._id || "" : "",
      newVehicleId:
        type === "vehicle" ? vehicle.vehicleId?.toString() || "" : "",
    });
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedVehicle(null);
    setUpdateForm({ newDriverId: "", newVehicleId: "" });
  };

  const handleUpdateDriver = async () => {
    if (!updateForm.newDriverId) {
      notify("Please select a driver");
      return;
    }

    try {
      setUpdating(true);
      const response = await api.put(
        `/b2b-partner/contracts/${contractId}/update-driver/${selectedVehicle._id}`,
        { newDriverId: updateForm.newDriverId },
      );

      if (response.data.success) {
        notify("Driver updated successfully across all records");
        closeModal();
        fetchAssignedVehicles();
      }
    } catch (err) {
      notify(err.response?.data?.message || "Failed to update driver");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateVehicle = async () => {
    if (!updateForm.newVehicleId) {
      notify("Please select a vehicle");
      return;
    }

    try {
      setUpdating(true);
      const response = await api.put(
        `/b2b-partner/contracts/${contractId}/update-vehicle/${selectedVehicle._id}`,
        { newVehicleId: updateForm.newVehicleId },
      );

      if (response.data.success) {
        notify("Vehicle updated successfully across all records");
        closeModal();
        fetchAssignedVehicles();
      }
    } catch (err) {
      notify(err.response?.data?.message || "Failed to update vehicle");
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="b2b-assigned-vehicles-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="b2b-assigned-vehicles-error">
        <div className="error-icon">!</div>
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => navigate("/?tab=contracts")}>
          Back to Contracts
        </button>
      </div>
    );
  }

  return (
    <>
      <Navbar activeTab="contracts" setActiveTab={() => {}} />
      <div className="drivemego-b2b-partnerassignedvehiclespage-b2b-assigned-vehicles-container">
        <button
          className="drivemego-b2b-partnerassignedvehiclespage-b2b-back-btn"
          onClick={() => navigate("/?tab=contracts")}
        >
          Back to Contracts
        </button>

        <div className="drivemego-b2b-partnerassignedvehiclespage-b2b-assigned-vehicles-header">
          <div>
            <h1>Assigned Vehicles</h1>
            <p className="drivemego-b2b-partnerassignedvehiclespage-contract-info">
              Contract: {contract?.contractNumber} | Corporate:{" "}
              {contract?.corporateOwnerId?.companyName ||
                contract?.corporateOwnerId?.fullName}
            </p>
          </div>
        </div>

        <div className="drivemego-b2b-partnerassignedvehiclespage-b2b-assigned-vehicles-tabs">
          <button
            className={`drivemego-b2b-partnerassignedvehiclespage-tab-button ${activeTab === "vehicles" ? "drivemego-b2b-partnerassignedvehiclespage-active" : ""}`}
            onClick={() => setActiveTab("vehicles")}
          >
            Vehicles ({assignedVehicles.length})
          </button>
          <button
            className={`drivemego-b2b-partnerassignedvehiclespage-tab-button ${activeTab === "routes" ? "drivemego-b2b-partnerassignedvehiclespage-active" : ""}`}
            onClick={() => setActiveTab("routes")}
          >
            Routes ({routes.length})
          </button>
        </div>

        {/* Vehicles Tab */}
        {activeTab === "vehicles" && (
          <div className="drivemego-b2b-partnerassignedvehiclespage-b2b-assigned-vehicles-content">
            {assignedVehicles.length === 0 ? (
              <div className="drivemego-b2b-partnerassignedvehiclespage-empty-state">
                <p>No assigned vehicles yet</p>
              </div>
            ) : (
              <div className="drivemego-b2b-partnerassignedvehiclespage-vehicles-grid">
                {assignedVehicles.map((vehicle) => (
                  <div
                    key={vehicle._id}
                    className="drivemego-b2b-partnerassignedvehiclespage-vehicle-card"
                  >
                    <div className="drivemego-b2b-partnerassignedvehiclespage-vehicle-card-header">
                      <h3>{vehicle.vehicleDetails?.vehicleName}</h3>
                      <span className="drivemego-b2b-partnerassignedvehiclespage-vehicle-category">
                        {vehicle.vehicleDetails?.vehicleCategory}
                      </span>
                    </div>
                    <p className="drivemego-b2b-partnerassignedvehiclespage-vehicle-reg">
                      {vehicle.vehicleDetails?.registrationNumber}
                    </p>

                    {/* Driver Section */}
                    <div className="drivemego-b2b-partnerassignedvehiclespage-assignment-section">
                      <div className="drivemego-b2b-partnerassignedvehiclespage-assignment-header">
                        <span className="drivemego-b2b-partnerassignedvehiclespage-assignment-label">
                          Driver
                        </span>
                        <span
                          className={`drivemego-b2b-partnerassignedvehiclespage-status-badge ${vehicle.driverId ? "drivemego-b2b-partnerassignedvehiclespage-assigned" : "drivemego-b2b-partnerassignedvehiclespage-pending"}`}
                        >
                          {vehicle.driverId ? "Assigned" : "Pending"}
                        </span>
                      </div>
                      {vehicle.driverId ? (
                        <div className="drivemego-b2b-partnerassignedvehiclespage-assignment-details">
                          <p className="drivemego-b2b-partnerassignedvehiclespage-assignment-value">
                            {vehicle.driverId?.name || "Driver"}
                          </p>
                          <p className="drivemego-b2b-partnerassignedvehiclespage-assigned-by">
                            Assigned by: {vehicle.driverAssignedBy || "N/A"}
                          </p>
                        </div>
                      ) : (
                        <p className="drivemego-b2b-partnerassignedvehiclespage-no-assignment">
                          No driver assigned
                        </p>
                      )}
                      {vehicle.driverAssignedBy === "B2B_PARTNER" && (
                        <button
                          className="drivemego-b2b-partnerassignedvehiclespage-update-btn"
                          onClick={() => openUpdateModal(vehicle, "driver")}
                        >
                          Change Driver
                        </button>
                      )}
                    </div>

                    {/* Vehicle Change Section */}
                    <div className="drivemego-b2b-partnerassignedvehiclespage-assignment-section">
                      <div className="drivemego-b2b-partnerassignedvehiclespage-assignment-header">
                        <span className="drivemego-b2b-partnerassignedvehiclespage-assignment-label">
                          Vehicle Status
                        </span>
                      </div>
                      <button
                        className="drivemego-b2b-partnerassignedvehiclespage-update-btn"
                        onClick={() => openUpdateModal(vehicle, "vehicle")}
                      >
                        Change Vehicle
                      </button>
                    </div>

                    {/* Route Section */}
                    {vehicle.routeDetails &&
                      vehicle.routeDetails.length > 0 && (
                        <div className="drivemego-b2b-partnerassignedvehiclespage-route-section">
                          <div className="drivemego-b2b-partnerassignedvehiclespage-route-header">
                            <span className="drivemego-b2b-partnerassignedvehiclespage-route-label">
                              Assigned Route
                              {vehicle.routeDetails.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          {vehicle.routeDetails.map((route, idx) => (
                            <div
                              key={route._id || idx}
                              className="drivemego-b2b-partnerassignedvehiclespage-route-details"
                            >
                              <p className="drivemego-b2b-partnerassignedvehiclespage-route-path">
                                {route.fromLocation || "N/A"} →{" "}
                                {route.toLocation || "N/A"}
                              </p>
                              <p className="drivemego-b2b-partnerassignedvehiclespage-route-info">
                                Start: {formatDate(route.routeStartDate)}
                              </p>
                              {route.totalDistance && (
                                <p className="drivemego-b2b-partnerassignedvehiclespage-route-info">
                                  Distance: {route.totalDistance} km
                                </p>
                              )}
                              {route.estimatedDuration && (
                                <p className="drivemego-b2b-partnerassignedvehiclespage-route-info">
                                  Duration: {route.estimatedDuration}
                                </p>
                              )}
                              {route.availableDays &&
                                route.availableDays.length > 0 && (
                                  <p className="drivemego-b2b-partnerassignedvehiclespage-route-info">
                                    Days: {route.availableDays.join(", ")}
                                  </p>
                                )}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Routes Tab */}
        {activeTab === "routes" && (
          <div className="drivemego-b2b-partnerassignedvehiclespage-b2b-routes-content">
            {routes.length === 0 ? (
              <div className="drivemego-b2b-partnerassignedvehiclespage-empty-state">
                <p>No routes assigned yet</p>
              </div>
            ) : (
              <div className="drivemego-b2b-partnerassignedvehiclespage-routes-grid">
                {routes.map((route, index) => (
                  <div
                    key={route._id || `route-${index}`}
                    className="drivemego-b2b-partnerassignedvehiclespage-route-card"
                  >
                    <div className="drivemego-b2b-partnerassignedvehiclespage-route-card-header">
                      <h3>
                        {route.fromLocation} → {route.toLocation}
                      </h3>
                      <span
                        className={`drivemego-b2b-partnerassignedvehiclespage-status-badge ${route.status?.toLowerCase()}`}
                      >
                        {route.status}
                      </span>
                    </div>
                    <div className="drivemego-b2b-partnerassignedvehiclespage-route-card-body">
                      <div className="drivemego-b2b-partnerassignedvehiclespage-route-info-row">
                        <span className="drivemego-b2b-partnerassignedvehiclespage-label">
                          Vehicle:
                        </span>
                        <span className="drivemego-b2b-partnerassignedvehiclespage-value">
                          {route.vehicleName} ({route.registrationNumber})
                        </span>
                      </div>
                      <div className="drivemego-b2b-partnerassignedvehiclespage-route-info-row">
                        <span className="drivemego-b2b-partnerassignedvehiclespage-label">
                          Start Date:
                        </span>
                        <span className="drivemego-b2b-partnerassignedvehiclespage-value">
                          {formatDate(route.routeStartDate)}
                        </span>
                      </div>
                      <div className="drivemego-b2b-partnerassignedvehiclespage-route-info-row">
                        <span className="drivemego-b2b-partnerassignedvehiclespage-label">
                          Distance:
                        </span>
                        <span className="drivemego-b2b-partnerassignedvehiclespage-value">
                          {route.totalDistance
                            ? `${route.totalDistance} km`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="drivemego-b2b-partnerassignedvehiclespage-route-info-row">
                        <span className="drivemego-b2b-partnerassignedvehiclespage-label">
                          Duration:
                        </span>
                        <span className="drivemego-b2b-partnerassignedvehiclespage-value">
                          {route.estimatedDuration || "N/A"}
                        </span>
                      </div>
                      <div className="drivemego-b2b-partnerassignedvehiclespage-route-days">
                        <span className="drivemego-b2b-partnerassignedvehiclespage-label">
                          Available Days:
                        </span>
                        <div className="drivemego-b2b-partnerassignedvehiclespage-days-badges">
                          {route.availableDays?.map((day) => (
                            <span
                              key={day}
                              className="drivemego-b2b-partnerassignedvehiclespage-day-badge"
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Update Driver Modal */}
        {modalType === "driver" && selectedVehicle && (
          <div
            className="drivemego-b2b-partnerassignedvehiclespage-modal-overlay"
            onClick={closeModal}
          >
            <div
              className="drivemego-b2b-partnerassignedvehiclespage-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="drivemego-b2b-partnerassignedvehiclespage-modal-header">
                <h3>Change Driver</h3>
                <button
                  className="drivemego-b2b-partnerassignedvehiclespage-modal-close"
                  onClick={closeModal}
                >
                  X
                </button>
              </div>
              <div className="drivemego-b2b-partnerassignedvehiclespage-modal-body">
                <p className="drivemego-b2b-partnerassignedvehiclespage-modal-info">
                  Changing driver for:{" "}
                  {selectedVehicle.vehicleDetails?.vehicleName}
                </p>
                <p className="drivemego-b2b-partnerassignedvehiclespage-modal-warning">
                  This will update the driver across contracts, routes,
                  schedules, and trips.
                </p>
                <div className="drivemego-b2b-partnerassignedvehiclespage-form-group">
                  <label>Select New Driver</label>
                  <select
                    value={updateForm.newDriverId}
                    onChange={(e) =>
                      setUpdateForm({
                        ...updateForm,
                        newDriverId: e.target.value,
                      })
                    }
                  >
                    <option value="">-- Select Driver --</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver._id} value={driver._id}>
                        {driver.name} - {driver.licenseNumber}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="drivemego-b2b-partnerassignedvehiclespage-modal-footer">
                <button
                  className="drivemego-b2b-partnerassignedvehiclespage-cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  className="drivemego-b2b-partnerassignedvehiclespage-submit-btn"
                  onClick={handleUpdateDriver}
                  disabled={updating}
                >
                  {updating ? "Updating..." : "Update Driver"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Vehicle Modal */}
        {modalType === "vehicle" && selectedVehicle && (
          <div
            className="drivemego-b2b-partnerassignedvehiclespage-modal-overlay"
            onClick={closeModal}
          >
            <div
              className="drivemego-b2b-partnerassignedvehiclespage-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="drivemego-b2b-partnerassignedvehiclespage-modal-header">
                <h3>Change Vehicle</h3>
                <button
                  className="drivemego-b2b-partnerassignedvehiclespage-modal-close"
                  onClick={closeModal}
                >
                  X
                </button>
              </div>
              <div className="drivemego-b2b-partnerassignedvehiclespage-modal-body">
                <p className="drivemego-b2b-partnerassignedvehiclespage-modal-info">
                  Current vehicle: {selectedVehicle.vehicleDetails?.vehicleName}
                </p>
                <p className="drivemego-b2b-partnerassignedvehiclespage-modal-warning">
                  This will update the vehicle across contracts, routes,
                  schedules, and trips.
                </p>
                <div className="drivemego-b2b-partnerassignedvehiclespage-form-group">
                  <label>Select New Vehicle</label>
                  <select
                    value={updateForm.newVehicleId}
                    onChange={(e) =>
                      setUpdateForm({
                        ...updateForm,
                        newVehicleId: e.target.value,
                      })
                    }
                  >
                    <option value="">-- Select Vehicle --</option>
                    {availableVehicles.map((vehicle) => (
                      <option key={vehicle._id} value={vehicle._id}>
                        {vehicle.vehicleName} - {vehicle.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="drivemego-b2b-partnerassignedvehiclespage-modal-footer">
                <button
                  className="drivemego-b2b-partnerassignedvehiclespage-cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  className="drivemego-b2b-partnerassignedvehiclespage-submit-btn"
                  onClick={handleUpdateVehicle}
                  disabled={updating}
                >
                  {updating ? "Updating..." : "Update Vehicle"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default B2B_PartnerAssignedVehicles;
