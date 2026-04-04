"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../../utils/api";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import Navbar from "../../../Components/Navbar/Navbar";
import "./B2B_PartnerAssignedVehicles.css";

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
      alert("Please select a driver");
      return;
    }

    try {
      setUpdating(true);
      const response = await api.put(
        `/b2b-partner/contracts/${contractId}/update-driver/${selectedVehicle._id}`,
        { newDriverId: updateForm.newDriverId },
      );

      if (response.data.success) {
        alert("Driver updated successfully across all records");
        closeModal();
        fetchAssignedVehicles();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update driver");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateVehicle = async () => {
    if (!updateForm.newVehicleId) {
      alert("Please select a vehicle");
      return;
    }

    try {
      setUpdating(true);
      const response = await api.put(
        `/b2b-partner/contracts/${contractId}/update-vehicle/${selectedVehicle._id}`,
        { newVehicleId: updateForm.newVehicleId },
      );

      if (response.data.success) {
        alert("Vehicle updated successfully across all records");
        closeModal();
        fetchAssignedVehicles();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update vehicle");
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
      <div className="b2b-assigned-vehicles-container">
        <button
          className="b2b-back-btn"
          onClick={() => navigate("/?tab=contracts")}
        >
          Back to Contracts
        </button>

        <div className="b2b-assigned-vehicles-header">
          <div>
            <h1>Assigned Vehicles</h1>
            <p className="contract-info">
              Contract: {contract?.contractNumber} | Corporate:{" "}
              {contract?.corporateOwnerId?.companyName ||
                contract?.corporateOwnerId?.fullName}
            </p>
          </div>
        </div>

        <div className="b2b-assigned-vehicles-tabs">
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
        </div>

        {/* Vehicles Tab */}
        {activeTab === "vehicles" && (
          <div className="b2b-assigned-vehicles-content">
            {assignedVehicles.length === 0 ? (
              <div className="empty-state">
                <p>No assigned vehicles yet</p>
              </div>
            ) : (
              <div className="vehicles-grid">
                {assignedVehicles.map((vehicle) => (
                  <div key={vehicle._id} className="vehicle-card">
                    <div className="vehicle-card-header">
                      <h3>{vehicle.vehicleDetails?.vehicleName}</h3>
                      <span className="vehicle-category">
                        {vehicle.vehicleDetails?.vehicleCategory}
                      </span>
                    </div>
                    <p className="vehicle-reg">
                      {vehicle.vehicleDetails?.registrationNumber}
                    </p>

                    {/* Driver Section */}
                    <div className="assignment-section">
                      <div className="assignment-header">
                        <span className="assignment-label">Driver</span>
                        <span
                          className={`status-badge ${vehicle.driverId ? "assigned" : "pending"}`}
                        >
                          {vehicle.driverId ? "Assigned" : "Pending"}
                        </span>
                      </div>
                      {vehicle.driverId ? (
                        <div className="assignment-details">
                          <p className="assignment-value">
                            {vehicle.driverId?.name || "Driver"}
                          </p>
                          <p className="assigned-by">
                            Assigned by: {vehicle.driverAssignedBy || "N/A"}
                          </p>
                        </div>
                      ) : (
                        <p className="no-assignment">No driver assigned</p>
                      )}
                      {vehicle.driverAssignedBy === "B2B_PARTNER" && (
                        <button
                          className="update-btn"
                          onClick={() => openUpdateModal(vehicle, "driver")}
                        >
                          Change Driver
                        </button>
                      )}
                    </div>

                    {/* Vehicle Change Section */}
                    <div className="assignment-section">
                      <div className="assignment-header">
                        <span className="assignment-label">Vehicle Status</span>
                      </div>
                      <button
                        className="update-btn"
                        onClick={() => openUpdateModal(vehicle, "vehicle")}
                      >
                        Change Vehicle
                      </button>
                    </div>

                    {/* Route Section */}
                    {vehicle.routeDetails && (
                      <div className="route-section">
                        <div className="route-header">
                          <span className="route-label">Assigned Route</span>
                        </div>
                        <div className="route-details">
                          <p className="route-path">
                            {vehicle.routeDetails.fromLocation} →{" "}
                            {vehicle.routeDetails.toLocation}
                          </p>
                          <p className="route-info">
                            Start:{" "}
                            {formatDate(vehicle.routeDetails.routeStartDate)}
                          </p>
                        </div>
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
          <div className="b2b-routes-content">
            {routes.length === 0 ? (
              <div className="empty-state">
                <p>No routes assigned yet</p>
              </div>
            ) : (
              <div className="routes-grid">
                {routes.map((route) => (
                  <div key={route._id} className="route-card">
                    <div className="route-card-header">
                      <h3>
                        {route.fromLocation} → {route.toLocation}
                      </h3>
                      <span
                        className={`status-badge ${route.status?.toLowerCase()}`}
                      >
                        {route.status}
                      </span>
                    </div>
                    <div className="route-card-body">
                      <div className="route-info-row">
                        <span className="label">Vehicle:</span>
                        <span className="value">
                          {route.vehicleName} ({route.registrationNumber})
                        </span>
                      </div>
                      <div className="route-info-row">
                        <span className="label">Start Date:</span>
                        <span className="value">
                          {formatDate(route.routeStartDate)}
                        </span>
                      </div>
                      <div className="route-info-row">
                        <span className="label">Distance:</span>
                        <span className="value">
                          {route.totalDistance
                            ? `${route.totalDistance} km`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="route-info-row">
                        <span className="label">Duration:</span>
                        <span className="value">
                          {route.estimatedDuration || "N/A"}
                        </span>
                      </div>
                      <div className="route-days">
                        <span className="label">Available Days:</span>
                        <div className="days-badges">
                          {route.availableDays?.map((day) => (
                            <span key={day} className="day-badge">
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
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Change Driver</h3>
                <button className="modal-close" onClick={closeModal}>
                  X
                </button>
              </div>
              <div className="modal-body">
                <p className="modal-info">
                  Changing driver for:{" "}
                  {selectedVehicle.vehicleDetails?.vehicleName}
                </p>
                <p className="modal-warning">
                  This will update the driver across contracts, routes,
                  schedules, and trips.
                </p>
                <div className="form-group">
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
              <div className="modal-footer">
                <button className="cancel-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  className="submit-btn"
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
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Change Vehicle</h3>
                <button className="modal-close" onClick={closeModal}>
                  X
                </button>
              </div>
              <div className="modal-body">
                <p className="modal-info">
                  Current vehicle: {selectedVehicle.vehicleDetails?.vehicleName}
                </p>
                <p className="modal-warning">
                  This will update the vehicle across contracts, routes,
                  schedules, and trips.
                </p>
                <div className="form-group">
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
              <div className="modal-footer">
                <button className="cancel-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  className="submit-btn"
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
