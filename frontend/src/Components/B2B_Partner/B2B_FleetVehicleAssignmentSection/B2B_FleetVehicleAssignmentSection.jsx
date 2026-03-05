"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import "./B2B_FleetVehicleAssignmentSection.css";

const B2B_FleetVehicleAssignmentSection = ({
  contract,
  onAssignmentComplete,
}) => {
  // eslint-disable-next-line no-unused-vars
  const dispatch = useDispatch();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!contract) return null;

  const isAdvancePaid = !!contract.financials?.advancePayment?.paidAt;
  const isSecurityDepositPaid = !!contract.financials?.securityDeposit?.paidAt;
  const isActive = contract.status === "ACTIVE";
  const currency = contract.quotationId?.currency || "AED";

  // Check if all vehicles are assigned
  const areAllVehiclesAssigned = contract.vehicles?.every(vehicle => 
    vehicle.assignedVehicles && vehicle.assignedVehicles.length > 0
  );
  const hasSomeVehiclesAssigned = contract.vehicles?.some(vehicle => 
    vehicle.assignedVehicles && vehicle.assignedVehicles.length > 0
  );

  const getPaymentStatus = () => {
    if (!isAdvancePaid) {
      return {
        status: "pending",
        title: "Awaiting Advance Payment",
        message:
          "Corporate owner needs to make advance payment before vehicle assignment",
      };
    }
    if (!isSecurityDepositPaid) {
      return {
        status: "partial",
        title: "Security Deposit Pending",
        message: "Waiting for security deposit confirmation",
      };
    }
    if (isActive) {
      if (areAllVehiclesAssigned) {
        return {
          status: "completed",
          title: "All Vehicles Assigned",
          message: "All requested vehicles have been successfully assigned to the corporate contract.",
        };
      } else if (hasSomeVehiclesAssigned) {
        return {
          status: "partial",
          title: "Partial Vehicle Assignment",
          message: "Some vehicles have been assigned. Complete the assignment for all requested vehicles.",
        };
      } else {
        return {
          status: "ready",
          title: "Ready to Assign Vehicles",
          message:
            "All payments received. You can now assign vehicles from your fleet.",
        };
      }
    }
  };

  const paymentStatus = getPaymentStatus();

  return (
    <div className="b2b-fleet-section">
      <div
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="header-content">
          <h3>Vehicle Assignment Status</h3>
          <p className="header-subtitle">{paymentStatus?.title}</p>
        </div>
        <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="section-content">
          <div className={`status-indicator status-${paymentStatus?.status}`}>
            <span className="status-dot"></span>
            <span className="status-text">{paymentStatus?.message}</span>
          </div>

          <div className="payment-breakdown">
            <h4>Payment Status:</h4>
            <div className="payment-items">
              <div
                className={`payment-item ${isAdvancePaid ? "paid" : "pending"}`}
              >
                <span className="item-icon">{isAdvancePaid ? "✓" : "⏳"}</span>
                <div className="item-details">
                  <span className="item-name">Advance Payment (50%)</span>
                  <span className="item-amount">
                    {currency}{" "}
                    {contract.financials?.advancePayment?.amount?.toFixed(2) ||
                      "0.00"}
                  </span>
                </div>
              </div>

              <div
                className={`payment-item ${
                  isSecurityDepositPaid ? "paid" : "pending"
                }`}
              >
                <span className="item-icon">
                  {isSecurityDepositPaid ? "✓" : "⏳"}
                </span>
                <div className="item-details">
                  <span className="item-name">Security Deposit (10%)</span>
                  <span className="item-note">Refundable</span>
                  <span className="item-amount">
                    {currency}{" "}
                    {contract.financials?.securityDeposit?.amount?.toFixed(2) ||
                      "0.00"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {isActive && !areAllVehiclesAssigned && (
            <div className="assignment-actions">
              <p className="action-message">
                {hasSomeVehiclesAssigned 
                  ? "Continue assigning remaining vehicles to complete the corporate contract."
                  : "Vehicles can now be assigned to corporate employees from your fleet."
                }
              </p>
              <button
                className="btn-assign"
                onClick={() => onAssignmentComplete?.()}
              >
                {hasSomeVehiclesAssigned ? "Continue Vehicle Assignment" : "Proceed to Vehicle Assignment"}
              </button>
            </div>
          )}

          {isActive && areAllVehiclesAssigned && (
            <div className="assignment-completed">
              <div className="completed-icon">✅</div>
              <p className="completed-message">
                All requested vehicles have been successfully assigned to this corporate contract.
              </p>
              <div className="assignment-summary">
                <span className="summary-text">
                  {contract.vehicles?.reduce((total, vehicle) => 
                    total + (vehicle.assignedVehicles?.length || 0), 0
                  )} vehicles assigned across {contract.vehicles?.length || 0} vehicle types
                </span>
              </div>
            </div>
          )}

          {!isActive && (
            <div className="assignment-blocked">
              <p>
                Vehicle assignment is blocked until all payments are received
                from the corporate owner.
              </p>
            </div>
          )}

          <div className="vehicles-info">
            <h4>Vehicle Assignment Status:</h4>
            <div className="vehicles-list">
              {contract.vehicles?.map((vehicle, idx) => {
                const assignedCount = vehicle.assignedVehicles?.length || 0;
                const isFullyAssigned = assignedCount >= vehicle.quantity;
                const isPartiallyAssigned = assignedCount > 0 && assignedCount < vehicle.quantity;
                
                return (
                  <div key={idx} className={`vehicle-item-info ${isFullyAssigned ? 'fully-assigned' : isPartiallyAssigned ? 'partially-assigned' : 'not-assigned'}`}>
                    <span className="qty">{vehicle.quantity}x</span>
                    <span className="name">
                      {vehicle.vehicleId?.vehicleName || "Unknown"}
                    </span>
                    <span className="category">
                      {vehicle.vehicleId?.vehicleCategory?.replace(/_/g, " ")}
                    </span>
                    <span className="assignment-status">
                      {isFullyAssigned ? (
                        <span className="status-badge completed">✓ {assignedCount}/{vehicle.quantity}</span>
                      ) : isPartiallyAssigned ? (
                        <span className="status-badge partial">⏳ {assignedCount}/{vehicle.quantity}</span>
                      ) : (
                        <span className="status-badge pending">○ 0/{vehicle.quantity}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2B_FleetVehicleAssignmentSection;
