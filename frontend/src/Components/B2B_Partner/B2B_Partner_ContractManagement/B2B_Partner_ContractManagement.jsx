"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getFleetContracts } from "../../../Redux/slices/contractSlice";
import LoadingSpinner from "../../LoadingSpinner/LoadingSpinner";
import "./B2B_Partner_ContractManagement.css";
import { getTotalVehicleQuantity } from "../../../utils/helperutility";

const B2B_Partner_ContractManagement = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { contracts, loading, error } = useSelector((state) => state.contract);
  const [activeTab, setActiveTab] = useState("all");

    console.log("b2b partner contracts", contracts);
  useEffect(() => {
    dispatch(getFleetContracts());
  }, [dispatch]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: "status-pending",
      "document-uploaded": "status-uploaded",
      "corporate-signed": "status-signed",
      approved: "status-approved",
      rejected: "status-rejected",
      completed: "status-completed",
    };
    return statusMap[status?.toLowerCase()] || "status-pending";
  };

  const filterContracts = () => {
    if (!contracts) return [];
    if (activeTab === "all") return contracts;
    return contracts.filter(
      (contract) => contract.status?.toLowerCase() === activeTab
    );
  };

  const filteredContracts = filterContracts();

  const getStats = () => {
    if (!contracts) return { all: 0, pending: 0, approved: 0, completed: 0 };
    return {
      all: contracts.length,
      pending: contracts.filter((c) => c.status === "pending").length,
      approved: contracts.filter((c) => c.status === "approved").length,
      completed: contracts.filter((c) => c.status === "completed").length,
    };
  };

  const stats = getStats();

  if (loading) return <LoadingSpinner />;

  return (
    <div className="b2b-contracts-container">
      <div className="b2b-contracts-header">
        <h1>Contract Requests</h1>
        <p>Manage contract requests from corporate clients</p>
      </div>

      {/* Stats Cards */}
      <div className="b2b-contracts-stats">
        <div className="b2b-contracts-stat-card">
          <div className="b2b-contracts-stat-icon">📋</div>
          <div className="b2b-contracts-stat-content">
            <div className="b2b-contracts-stat-value">{stats.all}</div>
            <div className="b2b-contracts-stat-label">Total Contracts</div>
          </div>
        </div>
        <div className="b2b-contracts-stat-card">
          <div className="b2b-contracts-stat-icon">⏳</div>
          <div className="b2b-contracts-stat-content">
            <div className="b2b-contracts-stat-value">{stats.pending}</div>
            <div className="b2b-contracts-stat-label">Pending</div>
          </div>
        </div>
        <div className="b2b-contracts-stat-card">
          <div className="b2b-contracts-stat-icon">✅</div>
          <div className="b2b-contracts-stat-content">
            <div className="b2b-contracts-stat-value">{stats.approved}</div>
            <div className="b2b-contracts-stat-label">Approved</div>
          </div>
        </div>
        <div className="b2b-contracts-stat-card">
          <div className="b2b-contracts-stat-icon">🎉</div>
          <div className="b2b-contracts-stat-content">
            <div className="b2b-contracts-stat-value">{stats.completed}</div>
            <div className="b2b-contracts-stat-label">Completed</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="b2b-contracts-tabs">
        <button
          className={`b2b-contracts-tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All ({stats.all})
        </button>
        <button
          className={`b2b-contracts-tab ${
            activeTab === "pending" ? "active" : ""
          }`}
          onClick={() => setActiveTab("pending")}
        >
          Pending ({stats.pending})
        </button>
        <button
          className={`b2b-contracts-tab ${
            activeTab === "approved" ? "active" : ""
          }`}
          onClick={() => setActiveTab("approved")}
        >
          Approved ({stats.approved})
        </button>
        <button
          className={`b2b-contracts-tab ${
            activeTab === "completed" ? "active" : ""
          }`}
          onClick={() => setActiveTab("completed")}
        >
          Completed ({stats.completed})
        </button>
      </div>

      {/* Contracts List */}
      {error && (
        <div className="b2b-contracts-error">
          <p>{error}</p>
        </div>
      )}

      {filteredContracts.length === 0 ? (
        <div className="b2b-contracts-empty">
          <div className="b2b-contracts-empty-icon">📄</div>
          <h3>No Contracts Found</h3>
          <p>You don't have any contract requests in this category yet.</p>
        </div>
      ) : (
        <div className="b2b-contracts-grid">
          {filteredContracts.map((contract) => (
            <div
              key={contract._id}
              className="b2b-contracts-card"
              onClick={() => navigate(`/b2b-partner/contracts/${contract._id}`)}
            >
              <div className="b2b-contracts-card-header">
                <h3>Contract #{contract.contractNumber}</h3>
                <span
                  className={`b2b-contracts-status-badge ${getStatusBadgeClass(
                    contract.status
                  )}`}
                >
                  {contract.status?.replace("-", " ").toUpperCase()}
                </span>
              </div>

              <div className="b2b-contracts-card-body">
                <div className="b2b-contracts-info-row">
                  <span className="b2b-contracts-label">Corporate Client:</span>
                  <span className="b2b-contracts-value">
                    {contract.corporateOwnerId?.companyName ||
                      contract.corporateOwnerId?.fullName ||
                      "N/A"}
                  </span>
                </div>

                <div className="b2b-contracts-info-row">
                  <span className="b2b-contracts-label">Total Amount:</span>
                  <span className="b2b-contracts-value contract-amount">
                    KWD {contract.financials?.totalAmount?.toFixed(2) || "0.00"}
                  </span>
                </div>

                <div className="b2b-contracts-info-row">
                  <span className="b2b-contracts-label">Vehicles:</span>
                  <span className="b2b-contracts-value">
                    {getTotalVehicleQuantity(contract?.vehicles)} vehicles
                  </span>
                </div>

                <div className="b2b-contracts-info-row">
                  <span className="b2b-contracts-label">Created:</span>
                  <span className="b2b-contracts-value">
                    {formatDate(contract.createdAt)}
                  </span>
                </div>
              </div>

              <div className="b2b-contracts-card-footer">
                <button className="b2b-contracts-view-btn">
                  View Details →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default B2B_Partner_ContractManagement;
