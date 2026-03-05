"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchVehicleAssignmentById,
  assignVehiclesToContract,
} from "../../../Redux/slices/vehicleAssignmentSlice";
import api from "../../../utils/api";
import "./B2B_PartnerVehicleAssignmentForm.css";

const B2B_PartnerVehicleAssignmentForm = () => {
  const { assignmentId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { currentAssignment, loading, error } = useSelector(
    (state) => state.vehicleAssignment
  );

  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [searchVehicle, setSearchVehicle] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [searchDriver, setSearchDriver] = useState("");

  useEffect(() => {
    if (assignmentId) {
      dispatch(fetchVehicleAssignmentById(assignmentId));
    }
  }, [assignmentId, dispatch]);

  useEffect(() => {
    if (!currentAssignment) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch available vehicles
        const vehiclesResponse = await api.get(
          `/b2b-operations/vehicles/available`, {
            params: { vehicleType: currentAssignment.contractId?.vehicleType }
          }
        );
        if (isMounted && vehiclesResponse.data?.success) {
          setAvailableVehicles(vehiclesResponse.data.data?.vehicles || vehiclesResponse.data.vehicles || []);
        }

        // Fetch available drivers if needed
        if (currentAssignment.contractId?.includeDriver) {
          const driversResponse = await api.get(`/b2b-operations/drivers/available`);
          if (isMounted && driversResponse.data?.success) {
            setAvailableDrivers(driversResponse.data.data?.drivers || driversResponse.data.drivers || []);
          }
        }

        // Initialize selected vehicles from existing assignment
        if (isMounted && currentAssignment.assignedVehicles?.length > 0) {
          setSelectedVehicles(
            currentAssignment.assignedVehicles.map((v) => ({
              vehicleId: v.vehicleId?._id || v.vehicleId,
              driverId: v.driverId?._id || v.driverId || null,
              fuelCardNumber: v.fuelCardNumber || "",
              assignmentDate: v.assignmentDate || new Date().toISOString(),
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, [currentAssignment]);

  const handleAddVehicle = (vehicle) => {
    if (
      selectedVehicles.length < currentAssignment.contractId?.vehicleQuantity
    ) {
      setSelectedVehicles([
        ...selectedVehicles,
        {
          vehicleId: vehicle._id,
          driverId: null,
          fuelCardNumber: "",
          assignmentDate: new Date().toISOString(),
          vehicleDetails: vehicle,
        },
      ]);
    }
  };

  const handleRemoveVehicle = (index) => {
    setSelectedVehicles(selectedVehicles.filter((_, i) => i !== index));
  };

  const handleDriverChange = (index, driverId) => {
    const updated = [...selectedVehicles];
    updated[index].driverId = driverId;
    setSelectedVehicles(updated);
  };

  const handleFuelCardChange = (index, fuelCardNumber) => {
    const updated = [...selectedVehicles];
    updated[index].fuelCardNumber = fuelCardNumber;
    setSelectedVehicles(updated);
  };

  const handleSubmit = async () => {
    if (
      selectedVehicles.length !== currentAssignment.contractId?.vehicleQuantity
    ) {
      alert(
        `Please select exactly ${currentAssignment.contractId?.vehicleQuantity} vehicle(s)`
      );
      return;
    }

    if (currentAssignment.contractId?.includeDriver) {
      const missingDrivers = selectedVehicles.some((v) => !v.driverId);
      if (missingDrivers) {
        alert("Please assign a driver to all vehicles");
        return;
      }
    }

    if (currentAssignment.contractId?.includeFuel) {
      const missingFuelCards = selectedVehicles.some((v) => !v.fuelCardNumber);
      if (missingFuelCards) {
        alert("Please provide fuel card number for all vehicles");
        return;
      }
    }

    const payload = {
      assignedVehicles: selectedVehicles.map((v) => ({
        vehicleId: v.vehicleId,
        driverId: v.driverId || undefined,
        fuelCardNumber: v.fuelCardNumber || undefined,
        assignmentDate: v.assignmentDate,
      })),
    };

    const result = await dispatch(
      assignVehiclesToContract({ assignmentId, data: payload })
    );

    if (result.meta.requestStatus === "fulfilled") {
      alert("Vehicles assigned successfully!");
      navigate("/b2b/vehicle-assignments");
    }
  };

  const filteredVehicles = availableVehicles.filter(
    (vehicle) =>
      vehicle.make?.toLowerCase().includes(searchVehicle.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchVehicle.toLowerCase()) ||
      vehicle.licensePlate?.toLowerCase().includes(searchVehicle.toLowerCase())
  );

  const filteredDrivers = availableDrivers.filter(
    (driver) =>
      driver.name?.toLowerCase().includes(searchDriver.toLowerCase()) ||
      driver.licenseNumber?.toLowerCase().includes(searchDriver.toLowerCase())
  );

  if (loading) {
    return (
      <div className="vehicle-assignment-form-container">
        <div className="loading-spinner">Loading assignment details...</div>
      </div>
    );
  }

  if (!currentAssignment) {
    return (
      <div className="vehicle-assignment-form-container">
        <div className="error-message">Assignment not found</div>
      </div>
    );
  }

  return (
    <div className="vehicle-assignment-form-container">
      <div className="assignment-form-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Assign Vehicles to Contract</h1>
        <p className="subtitle">
          Contract #{currentAssignment.contractId?.contractNumber}
        </p>
      </div>

      <div className="assignment-form-content">
        <div className="contract-info-section">
          <h2>Contract Details</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Corporate Client:</span>
              <span className="value">
                {currentAssignment.contractId?.corporateOwnerId?.businessName}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Vehicle Type:</span>
              <span className="value">
                {currentAssignment.contractId?.vehicleType}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Quantity Required:</span>
              <span className="value">
                {currentAssignment.contractId?.vehicleQuantity}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Contract Period:</span>
              <span className="value">
                {new Date(
                  currentAssignment.contractId?.startDate
                ).toLocaleDateString()}{" "}
                -{" "}
                {new Date(
                  currentAssignment.contractId?.endDate
                ).toLocaleDateString()}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Include Driver:</span>
              <span className="value">
                {currentAssignment.contractId?.includeDriver ? "Yes" : "No"}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Include Fuel:</span>
              <span className="value">
                {currentAssignment.contractId?.includeFuel ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>

        <div className="assignment-form-grid">
          <div className="available-vehicles-section">
            <h2>Available Vehicles</h2>
            <input
              type="text"
              className="search-input"
              placeholder="Search vehicles..."
              value={searchVehicle}
              onChange={(e) => setSearchVehicle(e.target.value)}
            />
            <div className="vehicles-list">
              {filteredVehicles.map((vehicle) => (
                <div key={vehicle._id} className="vehicle-item">
                  <div className="vehicle-info">
                    <h4>
                      {vehicle.make} {vehicle.model}
                    </h4>
                    <p>License: {vehicle.licensePlate}</p>
                    <p>Year: {vehicle.year}</p>
                    <p className="status-available">Available</p>
                  </div>
                  <button
                    className="add-vehicle-btn"
                    onClick={() => handleAddVehicle(vehicle)}
                    disabled={
                      selectedVehicles.length >=
                        currentAssignment.contractId?.vehicleQuantity ||
                      selectedVehicles.some((v) => v.vehicleId === vehicle._id)
                    }
                  >
                    {selectedVehicles.some((v) => v.vehicleId === vehicle._id)
                      ? "Added"
                      : "Add"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="selected-vehicles-section">
            <h2>
              Selected Vehicles ({selectedVehicles.length} /{" "}
              {currentAssignment.contractId?.vehicleQuantity})
            </h2>
            {selectedVehicles.length === 0 ? (
              <div className="empty-state">
                <p>No vehicles selected yet</p>
                <p className="hint">Select vehicles from the left panel</p>
              </div>
            ) : (
              <div className="selected-vehicles-list">
                {selectedVehicles.map((selected, index) => {
                  const vehicle =
                    selected.vehicleDetails ||
                    availableVehicles.find((v) => v._id === selected.vehicleId);
                  return (
                    <div key={index} className="selected-vehicle-card">
                      <div className="selected-vehicle-header">
                        <h4>
                          {vehicle?.make} {vehicle?.model}
                        </h4>
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveVehicle(index)}
                        >
                          ✕
                        </button>
                      </div>
                      <p className="license-plate">{vehicle?.licensePlate}</p>

                      {currentAssignment.contractId?.includeDriver && (
                        <div className="driver-selection">
                          <label>Assign Driver:</label>
                          <select
                            value={selected.driverId || ""}
                            onChange={(e) =>
                              handleDriverChange(index, e.target.value)
                            }
                          >
                            <option value="">Select Driver</option>
                            {filteredDrivers.map((driver) => (
                              <option
                                key={driver._id}
                                value={driver._id}
                                disabled={selectedVehicles.some(
                                  (v, i) =>
                                    i !== index && v.driverId === driver._id
                                )}
                              >
                                {driver.name} - {driver.licenseNumber}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {currentAssignment.contractId?.includeFuel && (
                        <div className="fuel-card-input">
                          <label>Fuel Card Number:</label>
                          <input
                            type="text"
                            placeholder="Enter fuel card number"
                            value={selected.fuelCardNumber}
                            onChange={(e) =>
                              handleFuelCardChange(index, e.target.value)
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              className="submit-assignment-btn"
              onClick={handleSubmit}
              disabled={
                selectedVehicles.length !==
                currentAssignment.contractId?.vehicleQuantity
              }
            >
              Complete Assignment
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default B2B_PartnerVehicleAssignmentForm;
