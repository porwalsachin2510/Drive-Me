"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getCorporateContracts } from "../../Redux/slices/contractSlice";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import {getTotalVehicleQuantity} from "../../utils/helperutility"
import "./contractmanagement.css";

const ContractManagement = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { contracts, loading, error } = useSelector((state) => state.contract);
  const [filterStatus, setFilterStatus] = useState("all");

  console.log("all Corporate Contracts", contracts);

  useEffect(() => {
    dispatch(getCorporateContracts());
  }, [dispatch]);

  const getStatusClass = (status) => {
    const statusMap = {
      pending: "status-pending",
      "document-uploaded": "status-uploaded",
      "awaiting-signatures": "status-awaiting",
      signed: "status-signed",
      approved: "status-approved",
      rejected: "status-rejected",
      completed: "status-completed",
    };
    return statusMap[status] || "status-default";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredContracts = contracts.filter((contract) => {
    if (filterStatus === "all") return true;
    return contract.status === filterStatus;
  });

  const stats = {
    total: contracts.length,
    pending: contracts.filter((c) => c.status === "pending").length,
    signed: contracts.filter(
      (c) => c.status === "signed" || c.status === "awaiting-signatures"
    ).length,
    approved: contracts.filter((c) => c.status === "approved").length,
    completed: contracts.filter((c) => c.status === "completed").length,
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="drivemego-contractmanagement-corporate-contracts-container">
      <div className="drivemego-contractmanagement-corporate-contracts-header">
        <h1>My Contracts</h1>
        <p>Manage your vehicle rental contracts</p>
      </div>

      {/* Statistics Cards */}
      <div className="drivemego-contractmanagement-corporate-contracts-stats">
        <div className="drivemego-contractmanagement-corporate-stat-card stat-total">
          <div className="drivemego-contractmanagement-stat-icon">📄</div>
          <div className="drivemego-contractmanagement-stat-content">
            <div className="drivemego-contractmanagement-stat-value">
              {stats.total}
            </div>
            <div className="drivemego-contractmanagement-stat-label">
              Total Contracts
            </div>
          </div>
        </div>
        <div className="drivemego-contractmanagement-corporate-stat-card stat-pending">
          <div className="drivemego-contractmanagement-stat-icon">⏳</div>
          <div className="drivemego-contractmanagement-stat-content">
            <div className="drivemego-contractmanagement-stat-value">
              {stats.pending}
            </div>
            <div className="drivemego-contractmanagement-stat-label">
              Pending
            </div>
          </div>
        </div>
        <div className="drivemego-contractmanagement-corporate-stat-card drivemego-contractmanagement-stat-signed">
          <div className="drivemego-contractmanagement-stat-icon">✍️</div>
          <div className="drivemego-contractmanagement-stat-content">
            <div className="drivemego-contractmanagement-stat-value">
              {stats.signed}
            </div>
            <div className="drivemego-contractmanagement-stat-label">
              Signed
            </div>
          </div>
        </div>
        <div className="drivemego-contractmanagement-corporate-stat-card drivemego-contractmanagement-stat-approved">
          <div className="drivemego-contractmanagement-stat-icon">✅</div>
          <div className="drivemego-contractmanagement-stat-content">
            <div className="drivemego-contractmanagement-stat-value">
              {stats.approved}
            </div>
            <div className="drivemego-contractmanagement-stat-label">
              Approved
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="drivemego-contractmanagement-corporate-contracts-filters">
        <button
          className={`drivemego-contractmanagement-filter-tab ${filterStatus === "all" ? "drivemego-contractmanagement-active" : ""}`}
          onClick={() => setFilterStatus("all")}
        >
          All Contracts
        </button>
        <button
          className={`drivemego-contractmanagement-filter-tab ${filterStatus === "pending" ? "drivemego-contractmanagement-active" : ""}`}
          onClick={() => setFilterStatus("pending")}
        >
          Pending
        </button>
        <button
          className={`drivemego-contractmanagement-filter-tab ${
            filterStatus === "awaiting-signatures"
              ? "drivemego-contractmanagement-active"
              : ""
          }`}
          onClick={() => setFilterStatus("awaiting-signatures")}
        >
          Awaiting Signature
        </button>
        <button
          className={`drivemego-contractmanagement-filter-tab ${
            filterStatus === "approved"
              ? "drivemego-contractmanagement-active"
              : ""
          }`}
          onClick={() => setFilterStatus("approved")}
        >
          Approved
        </button>
        <button
          className={`drivemego-contractmanagement-filter-tab ${
            filterStatus === "completed"
              ? "drivemego-contractmanagement-active"
              : ""
          }`}
          onClick={() => setFilterStatus("completed")}
        >
          Completed
        </button>
      </div>

      {/* Contracts List */}
      {error && contracts.length === 0 && (
        <div className="drivemego-contractmanagement-corporate-contracts-error">
          <div className="drivemego-contractmanagement-error-icon">!</div>
          <h3>Error Loading Contracts</h3>
          <p>{error}</p>
        </div>
      )}

      {!error && filteredContracts.length === 0 && (
        <div className="drivemego-contractmanagement-corporate-contracts-empty">
          <div className="drivemego-contractmanagement-empty-icon">📭</div>
          <h3>No Contracts Found</h3>
          <p>
            You don't have any contracts yet. Accept a quotation to create your
            first contract.
          </p>
        </div>
      )}

      {!error && filteredContracts.length > 0 && (
        <div className="drivemego-contractmanagement-corporate-contracts-grid">
          {filteredContracts.map((contract) => (
            <div
              key={contract._id}
              className="drivemego-contractmanagement-corporate-contract-card"
              onClick={() => navigate(`/corporate/contracts/${contract._id}`)}
            >
              <div className="drivemego-contractmanagement-contract-card-header">
                <div className="drivemego-contractmanagement-contract-card-number">
                  Contract #{contract.contractNumber}
                </div>
                <span
                  className={`drivemego-contractmanagement-contract-status-badge ${getStatusClass(
                    contract.status,
                  )}`}
                >
                  {contract.status.replace("-", " ").toUpperCase()}
                </span>
              </div>

              <div className="drivemego-contractmanagement-contract-card-body">
                <div className="drivemego-contractmanagement-contract-card-info">
                  <div className="drivemego-contractmanagement-info-label">
                    Fleet Owner:
                  </div>
                  <div className="drivemego-contractmanagement-info-value">
                    {contract.fleetOwnerId?.companyName ||
                      contract.fleetOwnerId?.fullName}
                  </div>
                </div>

                <div className="drivemego-contractmanagement-contract-card-info">
                  <div className="drivemego-contractmanagement-info-label">
                    Total Amount:
                  </div>
                  <div className="drivemego-contractmanagement-info-value drivemego-contractmanagement-contract-amount">
                    {contract.financials?.currency || "AED"}{" "}
                    {(
                      contract.financials?.totalAmount || contract.totalAmount
                    )?.toFixed(2) || "0.00"}
                  </div>
                </div>

                <div className="drivemego-contractmanagement-contract-card-info">
                  <div className="drivemego-contractmanagement-info-label">
                    Rental Period:
                  </div>
                  <div className="drivemego-contractmanagement-info-value">
                    {formatDate(contract.rentalPeriod?.startDate)} -{" "}
                    {formatDate(contract.rentalPeriod?.endDate)}
                  </div>
                </div>

                <div className="drivemego-contractmanagement-contract-card-info">
                  <div className="drivemego-contractmanagement-info-label">
                    Vehicles:
                  </div>
                  <div className="drivemego-contractmanagement-info-value">
                    {getTotalVehicleQuantity(contract.vehicles) || 0} vehicles
                  </div>
                </div>

                {contract.contractDocument && (
                  <div className="drivemego-contractmanagement-contract-card-document">
                    <span className="drivemego-contractmanagement-document-icon">
                      📎
                    </span>
                    <span>Contract Document Available</span>
                  </div>
                )}
              </div>

              <div className="drivemego-contractmanagement-contract-card-footer">
                <div className="drivemego-contractmanagement-contract-date">
                  Created: {formatDate(contract.createdAt)}
                </div>
                <div className="contract-card-actions">
                  <button className="view-details-btn">View Details</button>
                  {contract.status === "ACTIVE" && (
                    <button
                      className="view-vehicles-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/corporate/assigned-vehicles", {
                          state: { contractId: contract._id },
                        });
                      }}
                    >
                      View Assigned Vehicles
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractManagement;
