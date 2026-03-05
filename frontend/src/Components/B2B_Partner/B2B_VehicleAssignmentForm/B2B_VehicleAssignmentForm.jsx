"use client";

import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAvailableDrivers } from "../../../Redux/slices/driverSlice";
import "./B2B_VehicleAssignmentForm.css";

const B2B_VehicleAssignmentForm = ({ contract, onComplete, onCancel }) => {
  const dispatch = useDispatch();

  const { availableDrivers = [], loading: driversLoading } = useSelector(
    (state) => state.driver || {}
  );

  const [selectedVehicles, setSelectedVehicles] = useState({});
  const [vehicleSettings, setVehicleSettings] = useState({});
  const [routes, setRoutes] = useState({});
  const [driverAssignment, setDriverAssignment] = useState({});
  const [fuelCardNumbers, setFuelCardNumbers] = useState({});
  const [loading, setLoading] = useState(false);

  const vehicles = useMemo(
    () => contract?.vehicles || [],
    [contract?.vehicles]
  );
  const quotation = contract?.quotationId;
  const requiresDriver = quotation?.requirements?.withDriver || false;
  const requiresFuel = quotation?.requirements?.fuelIncluded || false;

  useEffect(() => {
    if (requiresFuel) {
      const newVehicleSettings = {};
      vehicles.forEach((vehicle) => {
        const vehicleTypeId = vehicle.vehicleId._id;
        newVehicleSettings[vehicleTypeId] = {
          mode: "active",
          fuelType: "included",
        };
      });
      setVehicleSettings(newVehicleSettings);
    }
  }, [requiresFuel, vehicles]);

  useEffect(() => {
    if (requiresDriver) {
      dispatch(fetchAvailableDrivers());
    }
  }, [requiresDriver, dispatch]);

  if (!contract) return null;

  const handleVehicleSelectionChange = (vehicleTypeId, quantity) => {
    const maxQuantity =
      vehicles.find((v) => v.vehicleId._id === vehicleTypeId)?.quantity || 0;
    setSelectedVehicles((prev) => ({
      ...prev,
      [vehicleTypeId]: Math.max(0, Math.min(quantity, maxQuantity)),
    }));
  };

  const handleVehicleSettingChange = (vehicleTypeId, setting, value) => {
    setVehicleSettings((prev) => ({
      ...prev,
      [vehicleTypeId]: {
        ...prev[vehicleTypeId],
        [setting]: value,
      },
    }));
  };

  const handleRouteChange = (vehicleTypeId, route) => {
    setRoutes((prev) => ({
      ...prev,
      [vehicleTypeId]: route,
    }));
  };

  const handleDriverChange = (vehicleTypeId, driverId) => {
    setDriverAssignment((prev) => ({
      ...prev,
      [vehicleTypeId]: driverId,
    }));
  };

  const handleFuelCardChange = (vehicleTypeId, cardNumber) => {
    setFuelCardNumbers((prev) => ({
      ...prev,
      [vehicleTypeId]: cardNumber,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const allSelected = vehicles.every((vehicle) => {
        const vehicleTypeId = vehicle.vehicleId._id;
        const selected = selectedVehicles[vehicleTypeId] || 0;
        return selected === vehicle.quantity;
      });

      if (!allSelected) {
        alert("Please assign all required quantities for each vehicle type");
        setLoading(false);
        return;
      }

      if (requiresDriver) {
        const allDriversAssigned = vehicles.every((vehicle) => {
          const vehicleTypeId = vehicle.vehicleId._id;
          return driverAssignment[vehicleTypeId];
        });

        if (!allDriversAssigned) {
          alert("Please assign a driver to all vehicle types");
          setLoading(false);
          return;
        }
      }

      if (requiresFuel) {
        const allFuelCardsProvided = vehicles.every((vehicle) => {
          const vehicleTypeId = vehicle.vehicleId._id;
          return fuelCardNumbers[vehicleTypeId];
        });

        if (!allFuelCardsProvided) {
          alert("Please provide fuel card number for all vehicles");
          setLoading(false);
          return;
        }
      }

      const vehicleAssignments = vehicles.map((vehicle) => {
        const vehicleTypeId = vehicle.vehicleId._id;
        const selectedCount = selectedVehicles[vehicleTypeId] || 0;

        const assignment = {
          vehicleId: vehicleTypeId,
          quantity: selectedCount,
          settings: vehicleSettings[vehicleTypeId] || {},
          route: routes[vehicleTypeId] || "",
        };

        if (requiresDriver) {
          assignment.driverId = driverAssignment[vehicleTypeId];
        }

        if (requiresFuel) {
          assignment.fuelCardNumber = fuelCardNumbers[vehicleTypeId];
        }

        return assignment;
      });

      onComplete(vehicleAssignments);
    } catch (error) {
      console.error("Error submitting assignment:", error);
      alert("Error assigning vehicles");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="b2b-vehicle-assignment-modal-overlay" onClick={onCancel}>
      <div
        className="b2b-vehicle-assignment-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="b2b-vehicle-assignment-header">
          <h2>Assign Vehicles to Contract</h2>
          <button className="b2b-vehicle-assignment-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="b2b-vehicle-assignment-form">
          <div className="b2b-vehicle-assignment-content">
            {vehicles.map((vehicle, index) => {
              const vehicleData = vehicle.vehicleId || {};
              const vehicleTypeId = vehicleData._id;
              const requiredQuantity = vehicle.quantity || 0;
              const selectedCount = selectedVehicles[vehicleTypeId] || 0;
              const photo =
                vehicleData.photos?.[0]?.url || "/diverse-city-street.png";

              return (
                <div
                  key={vehicleTypeId || index}
                  className="b2b-vehicle-assignment-item"
                >
                  <div className="b2b-vehicle-assignment-header-item">
                    <img
                      src={photo || "/placeholder.svg"}
                      alt={vehicleData.vehicleName}
                      className="b2b-vehicle-assignment-image"
                    />
                    <div className="b2b-vehicle-assignment-info">
                      <h3>{vehicleData.vehicleName}</h3>
                      <p className="b2b-vehicle-assignment-category">
                        {vehicleData.vehicleCategory?.replace(/_/g, " ")}
                      </p>
                      <p className="b2b-vehicle-assignment-reg">
                        Registration: {vehicleData.registrationNumber}
                      </p>

                      <div className="b2b-vehicle-assignment-requirements">
                        {requiresDriver && (
                          <span
                            className={`requirement-pill requirement-pill-yes`}
                          >
                            ✓ Driver Included
                          </span>
                        )}
                        {!requiresDriver && (
                          <span
                            className={`requirement-pill requirement-pill-no`}
                          >
                            ✕ No Driver
                          </span>
                        )}

                        {requiresFuel && (
                          <span
                            className={`requirement-pill requirement-pill-yes`}
                          >
                            ✓ Fuel Included
                          </span>
                        )}
                        {!requiresFuel && (
                          <span
                            className={`requirement-pill requirement-pill-no`}
                          >
                            ✕ No Fuel
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="b2b-vehicle-assignment-details">
                    <div className="b2b-vehicle-assignment-quantity">
                      <label>Required Quantity: {requiredQuantity}</label>
                      <div className="quantity-selector">
                        <button
                          type="button"
                          onClick={() =>
                            handleVehicleSelectionChange(
                              vehicleTypeId,
                              selectedCount > 0 ? selectedCount - 1 : 0
                            )
                          }
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={requiredQuantity}
                          value={selectedCount}
                          onChange={(e) =>
                            handleVehicleSelectionChange(
                              vehicleTypeId,
                              Number.parseInt(e.target.value) || 0
                            )
                          }
                          readOnly
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleVehicleSelectionChange(
                              vehicleTypeId,
                              Math.min(selectedCount + 1, requiredQuantity)
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                      <span className="quantity-display">
                        {selectedCount} / {requiredQuantity} assigned
                      </span>
                    </div>

                    {selectedCount > 0 && (
                      <>
                        <div className="b2b-vehicle-assignment-settings">
                          <label>Mode</label>
                          <select
                            value={
                              vehicleSettings[vehicleTypeId]?.mode || "active"
                            }
                            onChange={(e) =>
                              handleVehicleSettingChange(
                                vehicleTypeId,
                                "mode",
                                e.target.value
                              )
                            }
                          >
                            <option value="active">Active</option>
                            <option value="maintenance">Maintenance</option>
                          </select>
                        </div>

                        {requiresDriver && (
                          <div className="b2b-vehicle-assignment-settings">
                            <label>
                              Select Driver <span className="required">*</span>
                            </label>
                            <select
                              value={driverAssignment[vehicleTypeId] || ""}
                              onChange={(e) =>
                                handleDriverChange(
                                  vehicleTypeId,
                                  e.target.value
                                )
                              }
                              required
                            >
                              <option value="">Select Driver</option>
                              {Array.isArray(availableDrivers) &&
                              availableDrivers.length > 0 ? (
                                availableDrivers.map((driver) => (
                                  <option key={driver._id} value={driver._id}>
                                    {driver.name} - {driver.licenseNumber}
                                  </option>
                                ))
                              ) : (
                                <option disabled>No drivers available</option>
                              )}
                            </select>
                            {driversLoading && (
                              <span className="loading-text">
                                Loading drivers...
                              </span>
                            )}

                            {/* {driverAssignment[vehicleTypeId] && (
                              <div className="assignment-source-group">
                                <p className="source-info">
                                  ✓ Driver assigned by B2B Partner
                                </p>
                              </div>
                            )} */}
                          </div>
                        )}

                        {requiresFuel && (
                          <>
                            <div className="b2b-vehicle-assignment-settings">
                              <label>
                                Fuel Included{" "}
                                <span className="required">*</span>
                              </label>
                              <select
                                value={
                                  vehicleSettings[vehicleTypeId]?.fuelType ||
                                  "included"
                                }
                                onChange={(e) =>
                                  handleVehicleSettingChange(
                                    vehicleTypeId,
                                    "fuelType",
                                    e.target.value
                                  )
                                }
                              >
                                <option value="included">Included</option>
                              </select>
                            </div>

                            <div className="b2b-vehicle-assignment-route">
                              <label>
                                Fuel Card Number{" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Enter fuel card number"
                                value={fuelCardNumbers[vehicleTypeId] || ""}
                                onChange={(e) =>
                                  handleFuelCardChange(
                                    vehicleTypeId,
                                    e.target.value
                                  )
                                }
                                required
                              />
                              {/* {fuelCardNumbers[vehicleTypeId] && (
                                <div className="assignment-source-group">
                                  <p className="source-info">
                                    ✓ Fuel card provided by B2B Partner
                                  </p>
                                </div>
                              )} */}
                            </div>
                          </>
                        )}

                        <div className="b2b-vehicle-assignment-route">
                          <label>Assigned Route (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g., Dubai - Abu Dhabi, Daily Commute Route"
                            value={routes[vehicleTypeId] || ""}
                            onChange={(e) =>
                              handleRouteChange(vehicleTypeId, e.target.value)
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="b2b-vehicle-assignment-footer">
            <button
              type="button"
              className="b2b-vehicle-assignment-btn-cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="b2b-vehicle-assignment-btn-submit"
              disabled={loading}
            >
              {loading ? "Assigning..." : "Assign Selected Vehicles"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default B2B_VehicleAssignmentForm;
