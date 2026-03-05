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
    <div className="corporate-contracts-container">
      <div className="corporate-contracts-header">
        <h1>My Contracts</h1>
        <p>Manage your vehicle rental contracts</p>
      </div>

      {/* Statistics Cards */}
      <div className="corporate-contracts-stats">
        <div className="corporate-stat-card stat-total">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Contracts</div>
          </div>
        </div>
        <div className="corporate-stat-card stat-pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="corporate-stat-card stat-signed">
          <div className="stat-icon">✍️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.signed}</div>
            <div className="stat-label">Signed</div>
          </div>
        </div>
        <div className="corporate-stat-card stat-approved">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.approved}</div>
            <div className="stat-label">Approved</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="corporate-contracts-filters">
        <button
          className={`filter-tab ${filterStatus === "all" ? "active" : ""}`}
          onClick={() => setFilterStatus("all")}
        >
          All Contracts
        </button>
        <button
          className={`filter-tab ${filterStatus === "pending" ? "active" : ""}`}
          onClick={() => setFilterStatus("pending")}
        >
          Pending
        </button>
        <button
          className={`filter-tab ${
            filterStatus === "awaiting-signatures" ? "active" : ""
          }`}
          onClick={() => setFilterStatus("awaiting-signatures")}
        >
          Awaiting Signature
        </button>
        <button
          className={`filter-tab ${
            filterStatus === "approved" ? "active" : ""
          }`}
          onClick={() => setFilterStatus("approved")}
        >
          Approved
        </button>
        <button
          className={`filter-tab ${
            filterStatus === "completed" ? "active" : ""
          }`}
          onClick={() => setFilterStatus("completed")}
        >
          Completed
        </button>
      </div>

      {/* Contracts List */}
      {error && (
        <div className="corporate-contracts-error">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Contracts</h3>
          <p>{error}</p>
        </div>
      )}

      {!error && filteredContracts.length === 0 && (
        <div className="corporate-contracts-empty">
          <div className="empty-icon">📭</div>
          <h3>No Contracts Found</h3>
          <p>
            You don't have any contracts yet. Accept a quotation to create your
            first contract.
          </p>
        </div>
      )}

      {!error && filteredContracts.length > 0 && (
        <div className="corporate-contracts-grid">
          {filteredContracts.map((contract) => (
            <div
              key={contract._id}
              className="corporate-contract-card"
              onClick={() => navigate(`/corporate/contracts/${contract._id}`)}
            >
              <div className="contract-card-header">
                <div className="contract-card-number">
                  Contract #{contract.contractNumber}
                </div>
                <span
                  className={`contract-status-badge ${getStatusClass(
                    contract.status
                  )}`}
                >
                  {contract.status.replace("-", " ").toUpperCase()}
                </span>
              </div>

              <div className="contract-card-body">
                <div className="contract-card-info">
                  <div className="info-label">Fleet Owner:</div>
                  <div className="info-value">
                    {contract.fleetOwnerId?.companyName ||
                      contract.fleetOwnerId?.fullName}
                  </div>
                </div>

                <div className="contract-card-info">
                  <div className="info-label">Total Amount:</div>
                  <div className="info-value contract-amount">
                    KWD {contract.totalAmount?.toFixed(2)}
                  </div>
                </div>

                <div className="contract-card-info">
                  <div className="info-label">Rental Period:</div>
                  <div className="info-value">
                    {formatDate(contract.rentalPeriod?.startDate)} -{" "}
                    {formatDate(contract.rentalPeriod?.endDate)}
                  </div>
                </div>

                <div className="contract-card-info">
                  <div className="info-label">Vehicles:</div>
                  <div className="info-value">
                    {getTotalVehicleQuantity(contract.vehicles) || 0} vehicles
                  </div>
                </div>

                {contract.contractDocument && (
                  <div className="contract-card-document">
                    <span className="document-icon">📎</span>
                    <span>Contract Document Available</span>
                  </div>
                )}
              </div>

              <div className="contract-card-footer">
                <div className="contract-date">
                  Created: {formatDate(contract.createdAt)}
                </div>
                <button className="view-details-btn">View Details →</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractManagement;
