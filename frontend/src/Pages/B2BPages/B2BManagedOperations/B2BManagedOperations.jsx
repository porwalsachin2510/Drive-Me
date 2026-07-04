/* eslint-disable no-unused-vars */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, {
  setOnBehalfContract,
  clearOnBehalfContract,
} from "../../../utils/api";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import Footer from "../../../Components/Footer/Footer";
import Navbar from "../../../Components/Navbar/Navbar";
import ManagedActivityLog from "../../../Components/Corporate/ManagedActivityLog/ManagedActivityLog";
import ManagedServiceBrief from "../../../Components/Corporate/ManagedServiceBrief/ManagedServiceBrief";
import CorporateAssignedVehiclesPage from "../../CorporatePages/CorporateAssignedVehiclesPage/CorporateAssignedVehiclesPage";
import CorporateEmployeeManagementPage from "../../CorporatePages/CorporateEmployeeManagementPage/CorporateEmployeeManagementPage";
import "./B2BManagedOperations.css";

/**
 * B2B partner workspace for running operations on behalf of a corporate client
 * on a MANAGED-service contract. While this page is mounted, the "on behalf"
 * contract context is set so every API call is scoped to the corporate owner
 * by the backend (resolveCorporateContext middleware). The existing corporate
 * operation pages are reused in embedded mode so behaviour stays identical.
 */
const B2BManagedOperations = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { contractId } = location.state || {};

  const [contract, setContract] = useState(null);
  const [contextReady, setContextReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("brief");

  // Set/clear on-behalf context for the lifetime of this page. Set it
  // synchronously before children mount so their first requests carry it.
  useEffect(() => {
    if (contractId) {
      setOnBehalfContract(contractId);
      setContextReady(true);
    }
    return () => clearOnBehalfContract();
  }, [contractId]);

  const fetchContract = useCallback(async () => {
    if (!contractId) {
      setError("Contract not provided");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await api.get(
        `/contracts/assigned-vehicles/${contractId}`,
      );
      if (response.data.success) {
        setContract(response.data.data.contract);
      } else {
        setError(response.data.message || "Failed to load contract");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error loading contract");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    if (contextReady) fetchContract();
  }, [contextReady, fetchContract]);

  if (loading || !contextReady) {
    return (
      <div className="b2b-managed-ops-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="b2b-managed-ops-error">
        <h3>Unable to open managed operations</h3>
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <>
      <Navbar activeTab="contracts" setActiveTab={() => {}} />
      <div className="b2b-managed-ops-container">
        <button className="b2b-managed-ops-back" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="b2b-managed-ops-header">
          <span className="b2b-managed-ops-badge">Managed Service</span>
          <h1>
            Operations for{" "}
            {contract?.corporateOwnerId?.companyName ||
              contract?.corporateOwnerId?.fullName ||
              "Corporate Client"}
          </h1>
          <p className="b2b-managed-ops-sub">
            Contract: {contract?.contractNumber} — you are performing route,
            schedule, employee and trip operations on behalf of this corporate.
            Everything you do here is visible to them.
          </p>
        </div>

        <div className="b2b-managed-ops-tabs">
          <button
            className={activeTab === "brief" ? "active" : ""}
            onClick={() => setActiveTab("brief")}
          >
            Service Brief
          </button>
          <button
            className={activeTab === "vehicles" ? "active" : ""}
            onClick={() => setActiveTab("vehicles")}
          >
            Vehicles &amp; Routes
          </button>
          <button
            className={activeTab === "employees" ? "active" : ""}
            onClick={() => setActiveTab("employees")}
          >
            Employees &amp; Invitations
          </button>
          <button
            className={activeTab === "activity" ? "active" : ""}
            onClick={() => setActiveTab("activity")}
          >
            Activity Log
          </button>
        </div>

        <div className="b2b-managed-ops-content">
          {activeTab === "brief" && (
            <ManagedServiceBrief contractId={contractId} mode="partner" />
          )}
          {activeTab === "vehicles" && (
            <CorporateAssignedVehiclesPage
              embedded
              embeddedContractId={contractId}
            />
          )}
          {activeTab === "employees" && (
            <CorporateEmployeeManagementPage embedded />
          )}
          {activeTab === "activity" && (
            <ManagedActivityLog contractId={contractId} />
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default B2BManagedOperations;
