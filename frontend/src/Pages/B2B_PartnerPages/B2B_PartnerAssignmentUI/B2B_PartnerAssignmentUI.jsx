"use client";

import { useState, useEffect } from "react";
import api from "../../../utils/api";
import { FiCheck, FiTruck, FiAlertCircle, FiChevronDown } from "react-icons/fi";
import "./B2B_PartnerAssignmentUI.css";

const B2B_PartnerAssignmentUI = ({ contractId, contract }) => {
  const [expandedSection, setExpandedSection] = useState("overview");
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [assignedVehicles, setAssignedVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [filterStatus, setFilterStatus] = useState("AVAILABLE");

  console.log("B2B_PartnerAssignmentUI", contract, contractId);
  useEffect(() => {
    fetchVehiclesAndAssignments();
  }, [contractId]);

  const fetchVehiclesAndAssignments = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, assignmentsRes] = await Promise.all([
        api.get(`/api/vehicles/available`),
        api.get(`/api/vehicle-assignments/contract/${contractId}`),
      ]);

      if (vehiclesRes.data.success) {
        setAvailableVehicles(vehiclesRes.data.data.vehicles);
      }

      if (assignmentsRes.data.success) {
        setAssignedVehicles(assignmentsRes.data.assignments);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVehicle = (vehicleId) => {
    setSelectedVehicles((prev) =>
      prev.includes(vehicleId)
        ? prev.filter((id) => id !== vehicleId)
        : [...prev, vehicleId],
    );
  };

  const handleAssignVehicles = async () => {
    try {
      setLoading(true);
      const assignmentData = selectedVehicles.map((vehicleId) => ({
        vehicleId,
        withDriver: false,
        withFuel: true,
        fuelLevel: "FULL",
        withInsurance: true,
        withMaintenance: true,
      }));

      const response = await api.post(
        `/api/vehicle-assignments/${contractId}/assign`,
        {
          assignments: assignmentData,
        },
      );

      if (response.data.success) {
        setSelectedVehicles([]);
        await fetchVehiclesAndAssignments();
        alert("Vehicles assigned successfully!");
      }
    } catch (error) {
      console.error("Error assigning vehicles:", error);
      alert(error.response?.data?.message || "Failed to assign vehicles");
    } finally {
      setLoading(false);
    }
  };

  const filteredAvailable = availableVehicles.filter(
    (v) => v.status === filterStatus,
  );

  // Check if payment condition is met for vehicle assignment
  // For EMI mode: contract just needs to be ACTIVE (no advance payment required)
  // For STANDARD mode: advance payment must be completed
  const isEMIPaymentMode = contract?.financials?.paymentMode === "EMI";
  const isAdvancePaid = !!contract?.financials?.advancePayment?.paidAt;
  const isPaymentConditionMet = isEMIPaymentMode || isAdvancePaid;

  if (contract?.status !== "ACTIVE" || !isPaymentConditionMet) {
    return (
      <div className="fleet-owner-assignment-disabled">
        <FiAlertCircle className="icon" />
        <p>
          {isEMIPaymentMode
            ? "Contract must be active with EMI plan activated to assign vehicles."
            : "Contract must be active with advance payment completed to assign vehicles."}
        </p>
      </div>
    );
  }

  return (
    <div className="fleet-owner-assignment-ui">
      <h2 className="section-title">Vehicle Assignment Management</h2>

      {/* Overview Section */}
      <div
        className="section"
        onClick={() =>
          setExpandedSection(expandedSection === "overview" ? null : "overview")
        }
      >
        <div className="section-header">
          <h3>Overview</h3>
          <FiChevronDown
            className={`chevron ${
              expandedSection === "overview" ? "expanded" : ""
            }`}
          />
        </div>

        {expandedSection === "overview" && (
          <div className="section-content">
            <div className="overview-grid">
              <div className="overview-card">
                <div className="card-value">
                  {contract?.vehicles?.length || 0}
                </div>
                <div className="card-label">Vehicles Required</div>
              </div>
              <div className="overview-card">
                <div className="card-value">{assignedVehicles.length}</div>
                <div className="card-label">Vehicles Assigned</div>
              </div>
              <div className="overview-card">
                <div className="card-value">{availableVehicles.length}</div>
                <div className="card-label">Available Vehicles</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assigned Vehicles Section */}
      {assignedVehicles.length > 0 && (
        <div
          className="section"
          onClick={() =>
            setExpandedSection(
              expandedSection === "assigned" ? null : "assigned",
            )
          }
        >
          <div className="section-header">
            <h3>Assigned Vehicles ({assignedVehicles.length})</h3>
            <FiChevronDown
              className={`chevron ${
                expandedSection === "assigned" ? "expanded" : ""
              }`}
            />
          </div>

          {expandedSection === "assigned" && (
            <div className="section-content">
              <div className="vehicle-list">
                {assignedVehicles.map((assignment) => (
                  <div key={assignment._id} className="vehicle-card assigned">
                    <div className="vehicle-header">
                      <FiTruck className="vehicle-icon" />
                      <div className="vehicle-name">
                        {assignment.vehicleId?.make}{" "}
                        {assignment.vehicleId?.model}
                      </div>
                      <FiCheck className="status-icon success" />
                    </div>
                    <div className="vehicle-details">
                      <p>
                        <strong>License Plate:</strong>{" "}
                        {assignment.vehicleId?.licensePlate}
                      </p>
                      <p>
                        <strong>Status:</strong>{" "}
                        <span className="status-badge assigned-status">
                          {assignment.status}
                        </span>
                      </p>
                      <p>
                        <strong>Assigned Date:</strong>{" "}
                        {new Date(
                          assignment.assignmentDate,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Available Vehicles Section */}
      <div
        className="section"
        onClick={() =>
          setExpandedSection(
            expandedSection === "available" ? null : "available",
          )
        }
      >
        <div className="section-header">
          <h3>Available Vehicles ({filteredAvailable.length})</h3>
          <div className="header-controls">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="AVAILABLE">Available</option>
              <option value="MAINTENANCE">Under Maintenance</option>
            </select>
            <FiChevronDown
              className={`chevron ${
                expandedSection === "available" ? "expanded" : ""
              }`}
            />
          </div>
        </div>

        {expandedSection === "available" && (
          <div className="section-content">
            {filteredAvailable.length === 0 ? (
              <div className="empty-state">
                <FiAlertCircle />
                <p>No available vehicles at the moment</p>
              </div>
            ) : (
              <>
                <div className="vehicle-list">
                  {filteredAvailable.map((vehicle) => (
                    <div
                      key={vehicle._id}
                      className={`vehicle-card ${
                        selectedVehicles.includes(vehicle._id) ? "selected" : ""
                      }`}
                      onClick={() => handleSelectVehicle(vehicle._id)}
                    >
                      <div className="vehicle-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedVehicles.includes(vehicle._id)}
                          onChange={() => {}}
                        />
                      </div>
                      <div className="vehicle-header">
                        <FiTruck className="vehicle-icon" />
                        <div className="vehicle-name">
                          {vehicle.make} {vehicle.model} ({vehicle.year})
                        </div>
                      </div>
                      <div className="vehicle-details">
                        <p>
                          <strong>License Plate:</strong> {vehicle.licensePlate}
                        </p>
                        <p>
                          <strong>Type:</strong> {vehicle.vehicleType}
                        </p>
                        <p>
                          <strong>Seating:</strong> {vehicle.seatingCapacity}
                        </p>
                        <p>
                          <strong>Mileage:</strong> {vehicle.mileage} km
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedVehicles.length > 0 && (
                  <button
                    className="assign-button"
                    onClick={handleAssignVehicles}
                    disabled={loading}
                  >
                    {loading
                      ? "Assigning..."
                      : `Assign ${selectedVehicles.length} Vehicle(s)`}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};;

export default B2B_PartnerAssignmentUI;
