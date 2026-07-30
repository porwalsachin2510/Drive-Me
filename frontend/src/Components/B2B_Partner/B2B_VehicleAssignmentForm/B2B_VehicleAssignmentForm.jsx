"use client";

import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAvailableDrivers } from "../../../Redux/slices/driverSlice";
import "./B2B_VehicleAssignmentForm.css";
import { notify } from "../../../utils/toast";

const B2B_VehicleAssignmentForm = ({ contract, onComplete, onCancel }) => {
  const dispatch = useDispatch();

  const { availableDrivers = [], loading: driversLoading } = useSelector(
    (state) => state.driver || {},
  );

  // Per-slot state. A "slot" is a single physical vehicle deployment that
  // fulfills one unit of the requested quantity. Each slot has its OWN driver
  // and its OWN fuel card, because in the real world you cannot run two
  // vehicles with one driver or one fuel card.
  // Keyed by `${vehicleTypeId}::${slotIndex}`.
  const [slotDriver, setSlotDriver] = useState({});
  const [slotFuelCard, setSlotFuelCard] = useState({});
  const [slotMode, setSlotMode] = useState({});
  const [slotRoute, setSlotRoute] = useState({});
  const [loading, setLoading] = useState(false);

  const vehicles = useMemo(
    () => contract?.vehicles || [],
    [contract?.vehicles],
  );

  // Drivers already assigned to a vehicle in THIS contract from an earlier
  // save. They must not be selectable again anywhere in the form.
  const alreadyAssignedDriverIds = useMemo(() => {
    const set = new Set();
    vehicles.forEach((v) => {
      (v.assignedVehicles || []).forEach((av) => {
        const did = av.driverId?._id || av.driverId;
        if (did) set.add(String(did));
      });
    });
    return set;
  }, [vehicles]);

  const quotation = contract?.quotationId;
  const requiresDriver = quotation?.requirements?.withDriver || false;
  const requiresFuel = quotation?.requirements?.fuelIncluded || false;

  // How many slots still need to be filled for each vehicle type.
  const remainingByType = useMemo(() => {
    const map = {};
    vehicles.forEach((v) => {
      const typeId = v.vehicleId?._id;
      if (!typeId) return;
      const already = v.assignedVehicles?.length || 0;
      map[typeId] = {
        already,
        remaining: Math.max(0, (v.quantity || 0) - already),
        quantity: v.quantity || 0,
      };
    });
    return map;
  }, [vehicles]);

  useEffect(() => {
    if (requiresDriver) {
      dispatch(fetchAvailableDrivers());
    }
  }, [requiresDriver, dispatch]);

  if (!contract) return null;

  const slotKey = (typeId, index) => `${typeId}::${index}`;

  const handleSlotDriver = (key, driverId) =>
    setSlotDriver((p) => ({ ...p, [key]: driverId }));
  const handleSlotFuel = (key, value) =>
    setSlotFuelCard((p) => ({ ...p, [key]: value }));
  const handleSlotMode = (key, value) =>
    setSlotMode((p) => ({ ...p, [key]: value }));
  const handleSlotRoute = (key, value) =>
    setSlotRoute((p) => ({ ...p, [key]: value }));

  // A driver chosen for one slot cannot be picked in any other slot of this
  // form. Returns the slot label the driver is already used in (or null).
  const driverUsedInAnotherSlot = (driverId, currentKey) => {
    if (!driverId) return null;
    const entry = Object.entries(slotDriver).find(
      ([k, d]) => k !== currentKey && d === driverId,
    );
    return entry ? entry[0] : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const toAssign = [];

      for (const vehicle of vehicles) {
        const typeId = vehicle.vehicleId?._id;
        const info = remainingByType[typeId] || { remaining: 0 };

        for (let i = 0; i < info.remaining; i++) {
          const key = slotKey(typeId, i);
          const driver = slotDriver[key] || "";
          const fuel = slotFuelCard[key] || "";

          // Decide whether this slot is being submitted.
          const started =
            (requiresDriver && !!driver) || (requiresFuel && !!fuel);
          const counted = requiresDriver || requiresFuel ? started : true;
          if (!counted) continue;

          if (requiresDriver && !driver) {
            notify(
              `Please select a driver for every vehicle you are assigning (${vehicle.vehicleId?.vehicleName}).`,
            );
            setLoading(false);
            return;
          }
          if (requiresFuel && !fuel) {
            notify(
              `Please provide a fuel card number for every vehicle you are assigning (${vehicle.vehicleId?.vehicleName}).`,
            );
            setLoading(false);
            return;
          }

          toAssign.push({
            vehicleId: typeId,
            driverId: requiresDriver ? driver : undefined,
            fuelCardNumber: requiresFuel ? fuel : undefined,
            settings: {
              mode: slotMode[key] || "active",
              ...(requiresFuel ? { fuelType: "included" } : {}),
            },
            route: slotRoute[key] || "",
          });
        }
      }

      if (toAssign.length === 0) {
        notify("Please assign at least one vehicle before submitting.");
        setLoading(false);
        return;
      }

      // Driver de-duplication across all slots + against prior saves.
      if (requiresDriver) {
        const driverIds = toAssign.map((a) => a.driverId).filter(Boolean);
        if (new Set(driverIds).size !== driverIds.length) {
          notify(
            "The same driver cannot be assigned to more than one vehicle. Please pick a different driver for each vehicle.",
          );
          setLoading(false);
          return;
        }
        const reused = driverIds.find((id) =>
          alreadyAssignedDriverIds.has(String(id)),
        );
        if (reused) {
          notify(
            "One of the selected drivers is already assigned to another vehicle on this contract. Please choose a different driver.",
          );
          setLoading(false);
          return;
        }
      }

      onComplete(toAssign);
    } catch (error) {
      console.error("Error submitting assignment:", error);
      notify("Error assigning vehicles");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="b2b-vehicle-assignment-modal-overlay">
      <div className="b2b-vehicle-assignment-modal">
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
              const info = remainingByType[vehicleTypeId] || {
                already: 0,
                remaining: 0,
                quantity: vehicle.quantity || 0,
              };
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
                        {requiresDriver ? (
                          <span className="requirement-pill requirement-pill-yes">
                            ✓ Driver Included
                          </span>
                        ) : (
                          <span className="requirement-pill requirement-pill-no">
                            ✕ No Driver
                          </span>
                        )}
                        {requiresFuel ? (
                          <span className="requirement-pill requirement-pill-yes">
                            ✓ Fuel Included
                          </span>
                        ) : (
                          <span className="requirement-pill requirement-pill-no">
                            ✕ No Fuel
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="b2b-vehicle-assignment-qty-summary">
                    <span className="b2b-qty-required">
                      Required Quantity: <strong>{info.quantity}</strong>
                    </span>
                    <span
                      className={`b2b-qty-progress ${
                        info.remaining === 0 ? "complete" : ""
                      }`}
                    >
                      {info.already} / {info.quantity} assigned
                    </span>
                  </div>

                  {info.remaining === 0 ? (
                    <div className="b2b-slot-all-done">
                      ✓ All {info.quantity} vehicle(s) of this type are
                      assigned.
                    </div>
                  ) : (
                    <div className="b2b-slot-list">
                      {Array.from({ length: info.remaining }).map((_, i) => {
                        const key = slotKey(vehicleTypeId, i);
                        const unitNumber = info.already + i + 1;
                        const selectedDriver = slotDriver[key] || "";

                        return (
                          <div className="b2b-slot-card" key={key}>
                            <div className="b2b-slot-title">
                              Vehicle {unitNumber} of {info.quantity}
                            </div>

                            <div className="b2b-slot-fields">
                              <div className="b2b-vehicle-assignment-settings">
                                <label>Mode</label>
                                <select
                                  value={slotMode[key] || "active"}
                                  onChange={(e) =>
                                    handleSlotMode(key, e.target.value)
                                  }
                                >
                                  <option value="active">Active</option>
                                  <option value="maintenance">
                                    Maintenance
                                  </option>
                                </select>
                              </div>

                              {requiresDriver && (
                                <div className="b2b-vehicle-assignment-settings">
                                  <label>
                                    Select Driver{" "}
                                    <span className="required">*</span>
                                  </label>
                                  <select
                                    value={selectedDriver}
                                    onChange={(e) =>
                                      handleSlotDriver(key, e.target.value)
                                    }
                                  >
                                    <option value="">Select Driver</option>
                                    {Array.isArray(availableDrivers) &&
                                    availableDrivers.length > 0 ? (
                                      availableDrivers.map((driver) => {
                                        const usedElsewhere =
                                          !!driverUsedInAnotherSlot(
                                            driver._id,
                                            key,
                                          );
                                        const onContract =
                                          alreadyAssignedDriverIds.has(
                                            String(driver._id),
                                          );
                                        const disabled =
                                          usedElsewhere || onContract;
                                        const icon = onContract
                                          ? "🔒"
                                          : usedElsewhere
                                            ? "🔵"
                                            : "🟢";
                                        const suffix = onContract
                                          ? " (Already on this contract)"
                                          : usedElsewhere
                                            ? " (Assigned to another vehicle)"
                                            : "";
                                        return (
                                          <option
                                            key={driver._id}
                                            value={driver._id}
                                            disabled={disabled}
                                            style={{
                                              color: disabled
                                                ? "#9ca3af"
                                                : "inherit",
                                            }}
                                          >
                                            {icon} {driver.name} -{" "}
                                            {driver.licenseNumber}
                                            {suffix}
                                          </option>
                                        );
                                      })
                                    ) : (
                                      <option disabled>
                                        No drivers available
                                      </option>
                                    )}
                                  </select>
                                  {driversLoading && (
                                    <span className="loading-text">
                                      Loading drivers...
                                    </span>
                                  )}
                                </div>
                              )}

                              {requiresFuel && (
                                <div className="b2b-vehicle-assignment-route">
                                  <label>
                                    Fuel Card Number{" "}
                                    <span className="required">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Enter fuel card number"
                                    value={slotFuelCard[key] || ""}
                                    onChange={(e) =>
                                      handleSlotFuel(key, e.target.value)
                                    }
                                  />
                                </div>
                              )}

                              <div className="b2b-vehicle-assignment-route">
                                <label>Assigned Route (Optional)</label>
                                <input
                                  type="text"
                                  placeholder="e.g., Dubai - Abu Dhabi, Daily Commute Route"
                                  value={slotRoute[key] || ""}
                                  onChange={(e) =>
                                    handleSlotRoute(key, e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {requiresDriver && (
                        <p className="b2b-driver-assign-hint">
                          Each vehicle needs its own driver — a driver can only
                          be assigned to one vehicle in this contract.
                        </p>
                      )}
                    </div>
                  )}
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
