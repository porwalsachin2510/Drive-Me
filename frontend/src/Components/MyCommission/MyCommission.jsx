"use client";

import { useState, useEffect, useCallback } from "react";
import api from "../../utils/api";
import "./mycommission.css";

const ROLE_LABELS = {
  B2C_PARTNER: "B2C Partner",
  B2B_PARTNER: "B2B Partner",
  CORPORATE: "Corporate",
};

const STATUS_LABELS = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
};

const formatDate = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

function MyCommission() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/commission/my-commission");
      if (response.data?.success) {
        setData(response.data.data);
      } else {
        setError("Unable to load commission details.");
      }
    } catch (err) {
      console.error("Error fetching commission details:", err);
      setError(
        err.response?.data?.message ||
          "Failed to load your commission details.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="mycommission">
        <div className="mycommission-loading">
          Loading commission details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mycommission">
        <div className="mycommission-error">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const {
    role,
    primary,
    customRules = [],
    emiSettings,
    isDefault,
    notes,
  } = data;

  return (
    <div className="mycommission">
      <header className="mycommission-header">
        <div>
          <h2 className="mycommission-title">My Commission</h2>
          <p className="mycommission-subtitle">
            Commission that Drive Me Go (Admin) charges your account. These
            rates are set by Admin and shown here for full transparency.
          </p>
        </div>
        <span className="mycommission-role-badge">
          {ROLE_LABELS[role] || role}
        </span>
      </header>

      {/* Primary commission */}
      <section className="mycommission-card mycommission-primary">
        <div className="mycommission-primary-top">
          <div>
            <span className="mycommission-card-label">{primary.label}</span>
            <p className="mycommission-card-desc">{primary.description}</p>
          </div>
          <div className="mycommission-rate-pill">
            <span className="mycommission-rate-value">{primary.rate}%</span>
            <span className="mycommission-rate-tag">
              {isDefault ? "Default rate" : "Current rate"}
            </span>
          </div>
        </div>
      </section>

      {/* Custom time-bound rules */}
      <section className="mycommission-card">
        <div className="mycommission-section-head">
          <h3 className="mycommission-section-title">Custom Rate Rules</h3>
          <span className="mycommission-count">
            {customRules.length} {customRules.length === 1 ? "rule" : "rules"}
          </span>
        </div>
        <p className="mycommission-section-note">
          Special rates that apply for a specific time period. When a rule is
          active, it overrides the default rate above.
        </p>

        {customRules.length === 0 ? (
          <div className="mycommission-empty">
            No custom rate rules. Your default rate applies at all times.
          </div>
        ) : (
          <div className="mycommission-table-wrap">
            <table className="mycommission-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Rate</th>
                  <th>Effective From</th>
                  <th>Until</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customRules.map((rule, idx) => (
                  <tr key={`${rule.rateType}-${idx}`}>
                    <td>
                      <div className="mycommission-type-cell">
                        <span className="mycommission-type-label">
                          {rule.label}
                        </span>
                        {rule.description && (
                          <span className="mycommission-type-desc">
                            {rule.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="mycommission-rate-cell">{rule.rate}%</td>
                    <td>{formatDate(rule.effectiveFrom)}</td>
                    <td>
                      {rule.effectiveUntil
                        ? formatDate(rule.effectiveUntil)
                        : "No end date"}
                    </td>
                    <td>
                      <span
                        className={`mycommission-status mycommission-status-${rule.status}`}
                      >
                        {STATUS_LABELS[rule.status] || rule.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* EMI settings (B2B partner only) */}
      {emiSettings && (
        <section className="mycommission-card">
          <h3 className="mycommission-section-title">EMI Payment Terms</h3>
          <p className="mycommission-section-note">
            Applied when a Corporate pays for your contract in EMI installments.
          </p>
          <div className="mycommission-emi-grid">
            <div className="mycommission-emi-item">
              <span className="mycommission-emi-label">
                EMI Commission Rate
              </span>
              <span className="mycommission-emi-value">
                {emiSettings.emiCommissionRate ?? 0}%
              </span>
              <span className="mycommission-emi-hint">
                Deducted from your payout on each installment
              </span>
            </div>
            <div className="mycommission-emi-item">
              <span className="mycommission-emi-label">
                Late Fee Percentage
              </span>
              <span className="mycommission-emi-value">
                {emiSettings.lateFeePercentage ?? 0}%
              </span>
              <span className="mycommission-emi-hint">
                Penalty on overdue EMI payments
              </span>
            </div>
            <div className="mycommission-emi-item">
              <span className="mycommission-emi-label">Grace Period</span>
              <span className="mycommission-emi-value">
                {emiSettings.gracePeriodDays ?? 0} days
              </span>
              <span className="mycommission-emi-hint">
                Before a late fee applies
              </span>
            </div>
            <div className="mycommission-emi-item">
              <span className="mycommission-emi-label">
                Late Fee Commission
              </span>
              <span className="mycommission-emi-value">
                {emiSettings.lateFeeCommissionRate ?? 0}%
              </span>
              <span className="mycommission-emi-hint">
                Admin share of late fees collected
              </span>
            </div>
            <div className="mycommission-emi-item">
              <span className="mycommission-emi-label">Warning Threshold</span>
              <span className="mycommission-emi-value">
                {emiSettings.overdueWarningThreshold ?? 0} EMIs
              </span>
              <span className="mycommission-emi-hint">
                Overdue EMIs before a warning
              </span>
            </div>
            <div className="mycommission-emi-item">
              <span className="mycommission-emi-label">
                Suspension Threshold
              </span>
              <span className="mycommission-emi-value">
                {emiSettings.suspensionThreshold ?? 0} EMIs
              </span>
              <span className="mycommission-emi-hint">
                Overdue EMIs before service suspension
              </span>
            </div>
          </div>
        </section>
      )}

      {notes && (
        <section className="mycommission-card mycommission-notes">
          <h3 className="mycommission-section-title">Notes from Admin</h3>
          <p className="mycommission-notes-text">{notes}</p>
        </section>
      )}
    </div>
  );
}

export default MyCommission;
