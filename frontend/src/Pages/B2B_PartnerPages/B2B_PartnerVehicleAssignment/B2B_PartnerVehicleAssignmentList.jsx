"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchVehicleAssignments } from "../../../Redux/slices/vehicleAssignmentSlice";
import "./B2B_PartnerVehicleAssignmentList.css";
import DetailRow from "../../../Components/B2B_Partner/B2B_DetailRow/DetailRow";

const B2B_PartnerVehicleAssignmentList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    assignments = [],
    loading,
    error,
  } = useSelector((state) => state.vehicleAssignment);
  const [filter, setFilter] = useState("PENDING_ASSIGNMENT");

  useEffect(() => {
    dispatch(fetchVehicleAssignments());
  }, [dispatch]);

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING_ASSIGNMENT":
        return "#FF9800";
      case "ASSIGNED":
        return "#4CAF50";
      case "IN_USE":
        return "#2196F3";
      case "COMPLETED":
        return "#00BCD4";
      default:
        return "#757575";
    }
  };

  const getStatusText = (status) => {
    return status.replace(/_/g, " ");
  };

  const handleAssignVehicle = (assignmentId) => {
    navigate(`/b2b/vehicle-assignment/${assignmentId}`);
  };

  const filteredAssignments = assignments.filter(
    (assignment) => !filter || assignment.status === filter
  );

  if (loading) {
    return (
      <div className="vehicle-assignment-list-container">
        <div className="loading-spinner">Loading assignments...</div>
      </div>
    );
  }

  return (
    <div className="vehicle-assignment-list-container">
      <div className="vehicle-assignment-list-header">
        <h1>Vehicle Assignments</h1>
        <p className="subtitle">
          Manage and assign vehicles to active contracts
        </p>
      </div>

      <div className="filter-tabs">
        <button
          className={filter === "PENDING_ASSIGNMENT" ? "active" : ""}
          onClick={() => setFilter("PENDING_ASSIGNMENT")}
        >
          Pending Assignment
        </button>
        <button
          className={filter === "ASSIGNED" ? "active" : ""}
          onClick={() => setFilter("ASSIGNED")}
        >
          Assigned
        </button>
        <button
          className={filter === "IN_USE" ? "active" : ""}
          onClick={() => setFilter("IN_USE")}
        >
          In Use
        </button>
        <button
          className={filter === "COMPLETED" ? "active" : ""}
          onClick={() => setFilter("COMPLETED")}
        >
          Completed
        </button>
        <button
          className={!filter ? "active" : ""}
          onClick={() => setFilter("")}
        >
          All
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="assignments-grid">
        {filteredAssignments.length === 0 ? (
          <div className="no-assignments">
            <p>No assignments found for this filter</p>
          </div>
        ) : (
          filteredAssignments.map((assignment) => (
            <div key={assignment._id} className="assignment-card">
              <DetailRow
                label="Vehicle Type"
                value={assignment.contractId?.vehicleType}
              />

              <div className="assignment-card-header">
                <h3>Contract #{assignment.contractId?.contractNumber}</h3>
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(assignment.status) }}
                >
                  {getStatusText(assignment.status)}
                </span>
              </div>

              <div className="assignment-details">
                <div className="detail-row">
                  <span className="label">Corporate Client:</span>
                  <span className="value">
                    {assignment.contractId?.corporateOwnerId?.businessName}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="label">Vehicle Type:</span>
                  <span className="value">
                    {assignment.contractId?.vehicleType}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="label">Quantity:</span>
                  <span className="value">
                    {assignment.assignedVehicles?.length || 0} /{" "}
                    {assignment.contractId?.vehicleQuantity}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="label">Contract Period:</span>
                  <span className="value">
                    {new Date(
                      assignment.contractId?.startDate
                    ).toLocaleDateString()}{" "}
                    -{" "}
                    {new Date(
                      assignment.contractId?.endDate
                    ).toLocaleDateString()}
                  </span>
                </div>

                {assignment.contractId?.includeDriver && (
                  <div className="detail-row">
                    <span className="label">Include Driver:</span>
                    <span className="value">Yes</span>
                  </div>
                )}

                {assignment.contractId?.includeFuel && (
                  <div className="detail-row">
                    <span className="label">Include Fuel:</span>
                    <span className="value">Yes</span>
                  </div>
                )}

                {assignment.assignedVehicles?.length > 0 && (
                  <div className="assigned-vehicles-summary">
                    <h4>Assigned Vehicles:</h4>
                    {assignment.assignedVehicles.map((vehicle, index) => (
                      <div key={index} className="vehicle-summary-item">
                        <span>
                          {vehicle.vehicleId?.make} {vehicle.vehicleId?.model} -{" "}
                          {vehicle.vehicleId?.licensePlate}
                        </span>
                        {vehicle.driverId && (
                          <span className="driver-info">
                            Driver: {vehicle.driverId?.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {assignment.status === "PENDING_ASSIGNMENT" && (
                <button
                  className="assign-button"
                  onClick={() => handleAssignVehicle(assignment._id)}
                >
                  Assign Vehicles
                </button>
              )}

              {assignment.status === "ASSIGNED" && (
                <button
                  className="view-button"
                  onClick={() => handleAssignVehicle(assignment._id)}
                >
                  View Assignment
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default B2B_PartnerVehicleAssignmentList;
