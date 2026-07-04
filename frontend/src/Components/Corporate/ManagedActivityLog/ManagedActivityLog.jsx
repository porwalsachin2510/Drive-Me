"use client";

import { useEffect, useState, useCallback } from "react";
import api from "../../../utils/api";
import "./ManagedActivityLog.css";

const ACTION_META = {
  ROUTE_CREATED: { label: "Route created" },
  SCHEDULE_CREATED: { label: "Schedule created" },
  EMPLOYEE_ADDED: { label: "Employee added" },
  INVITATION_SENT: { label: "Invitation sent" },
  TRIPS_GENERATED: { label: "Trips generated" },
  DRIVER_ASSIGNED: { label: "Driver assigned" },
  FUEL_ASSIGNED: { label: "Fuel assigned" },
  ROUTE_ASSIGNED_TO_EMPLOYEE: { label: "Route assigned to employee" },
};

/**
 * Shows the operations a B2B partner performed on behalf of a corporate for a
 * MANAGED-service contract. Used in both the corporate and partner views.
 */
const ManagedActivityLog = ({
  contractId,
  title = "Managed Operations Activity",
}) => {
  const [log, setLog] = useState([]);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchActivity = useCallback(async () => {
    if (!contractId) return;
    try {
      const res = await api.get(`/contracts/${contractId}/managed-activity`);
      const data = res.data?.data || {};
      setLog(data.activityLog || []);
      setServiceCharge(data.serviceCharge || 0);
      setCurrency(data.currency || "");
      setError("");
    } catch (err) {
      console.error("Error loading managed activity:", err);
      setError("Failed to load managed operations activity.");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 8000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  return (
    <div className="managed-activity-log">
      <div className="managed-activity-header">
        <h2>{title}</h2>
        <button
          className="managed-activity-refresh"
          onClick={fetchActivity}
          type="button"
        >
          Refresh
        </button>
      </div>

      <p className="managed-activity-subtitle">
        Operations performed by the B2B partner on your behalf for this managed
        service contract.
      </p>

      <div className="managed-activity-charge">
        <span>Partner Management / Service Charge:</span>
        <strong>
          {currency} {Number(serviceCharge).toFixed(2)}
        </strong>
      </div>

      {loading ? (
        <div className="managed-activity-empty">Loading activity…</div>
      ) : error ? (
        <div className="managed-activity-empty managed-activity-error">
          {error}
        </div>
      ) : log.length === 0 ? (
        <div className="managed-activity-empty">
          No operations have been performed yet.
        </div>
      ) : (
        <ul className="managed-activity-list">
          {log.map((entry, index) => {
            const meta = ACTION_META[entry.action] || {
              label: entry.action,
            };
            const performer =
              entry.performedBy?.companyName ||
              entry.performedBy?.fullName ||
              entry.performedByName ||
              (entry.performedByRole === "B2B_PARTNER"
                ? "B2B Partner"
                : "Corporate");
            return (
              <li key={entry._id || index} className="managed-activity-item">
                <span className="managed-activity-dot" aria-hidden="true" />
                <div className="managed-activity-content">
                  <div className="managed-activity-title">
                    {entry.description || meta.label}
                  </div>
                  <div className="managed-activity-meta">
                    <span
                      className={`managed-activity-badge ${
                        entry.performedByRole === "B2B_PARTNER"
                          ? "partner"
                          : "corporate"
                      }`}
                    >
                      {performer}
                    </span>
                    <span className="managed-activity-time">
                      {entry.createdAt
                        ? new Date(entry.createdAt).toLocaleString()
                        : ""}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ManagedActivityLog;
