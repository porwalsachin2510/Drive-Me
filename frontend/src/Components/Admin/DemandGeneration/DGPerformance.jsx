import React, { useState, useEffect, useCallback } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";
import * as demandAPI from "../../../services/demandAPI";

const STAGE_LABELS = {
  NEW: "New",
  ASSIGNED: "Assigned",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow-up",
  INTERESTED: "Interested",
  DOCUMENTATION_PENDING: "Documentation Pending",
  ONBOARDED: "Onboarded",
  ACTIVE: "Active",
  LOST: "Lost/Rejected",
};

const DGPerformance = () => {
  const activeCurrency = useSelector((s) => s.locale?.currency) || "AED";
  const money = (n) => {
    const decimals = ["KWD", "BHD", "OMR"].includes(activeCurrency) ? 3 : 2;
    return `${activeCurrency} ${Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await demandAPI.getPerformanceDashboard({ from, to });
      setData(res.data);
    } catch (e) {
      toast.error("Failed to load performance dashboard");
    } finally {
      setLoading(false);
    }
  }, [from, to, activeCurrency]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="dg-loading">
        <div className="dg-spinner" />
        <p>Loading performance...</p>
      </div>
    );
  }

  const s = data.summary;
  const maxFunnel = Math.max(1, ...Object.values(data.stageFunnel || {}));

  return (
    <div>
      <div className="dg-section-head">
        <div>
          <h2>Performance Dashboard</h2>
          <p>
            Leads, onboardings, conversion, productivity and campaign /
            territory performance.
          </p>
        </div>
        <div className="dg-filters" style={{ margin: 0 }}>
          <input
            type="date"
            className="dg-select"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="dg-select"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button className="dg-btn" onClick={fetchData}>
            <FiRefreshCw /> Apply
          </button>
        </div>
      </div>

      <div className="dg-stats">
        <div className="dg-stat dg-stat-accent-blue">
          <div className="dg-stat-label">Total Leads</div>
          <div className="dg-stat-value">{s.totalLeads}</div>
          <div className="dg-stat-sub">
            {s.customerLeads} customer • {s.b2bLeads} B2B • {s.b2cLeads} B2C
          </div>
        </div>
        <div className="dg-stat dg-stat-accent-green">
          <div className="dg-stat-label">Customer Onboardings</div>
          <div className="dg-stat-value">{s.customerOnboardings}</div>
        </div>
        <div className="dg-stat dg-stat-accent-green">
          <div className="dg-stat-label">Partner Onboardings</div>
          <div className="dg-stat-value">
            {s.b2bOnboardings + s.b2cOnboardings}
          </div>
          <div className="dg-stat-sub">
            {s.b2bOnboardings} B2B • {s.b2cOnboardings} B2C
          </div>
        </div>
        <div className="dg-stat dg-stat-accent-amber">
          <div className="dg-stat-label">Conversion Rate</div>
          <div className="dg-stat-value">{s.conversionRate}%</div>
        </div>
        <div className="dg-stat dg-stat-accent-amber">
          <div className="dg-stat-label">Pending Follow-ups</div>
          <div className="dg-stat-value">{s.pendingFollowUps}</div>
        </div>
        <div className="dg-stat dg-stat-accent-red">
          <div className="dg-stat-label">Lost / Rejected</div>
          <div className="dg-stat-value">{s.lostTotal}</div>
        </div>
      </div>

      <div className="dg-grid-2">
        {/* Funnel */}
        <div className="dg-card">
          <h3>Lead Stage Funnel</h3>
          <div className="dg-funnel">
            {Object.keys(STAGE_LABELS).map((stage) => {
              const count = data.stageFunnel?.[stage] || 0;
              return (
                <div className="dg-funnel-row" key={stage}>
                  <div className="dg-funnel-label">{STAGE_LABELS[stage]}</div>
                  <div className="dg-funnel-bar">
                    <span style={{ width: `${(count / maxFunnel) * 100}%` }}>
                      {count > 0 ? count : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Territory */}
        <div className="dg-card">
          <h3>Territory Performance</h3>
          {data.territoryPerformance?.length ? (
            <table className="dg-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Leads</th>
                  <th>Onboarded</th>
                  <th>Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {data.territoryPerformance.map((t) => (
                  <tr key={t.region}>
                    <td className="dg-cell-strong">{t.region}</td>
                    <td>{t.leads}</td>
                    <td>{t.onboarded}</td>
                    <td>{t.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="dg-cell-muted">No territory data.</p>
          )}
        </div>
      </div>

      {/* Employee productivity */}
      <div className="dg-card" style={{ marginTop: 20 }}>
        <h3>Employee Productivity &amp; Targets</h3>
        {data.employeeProductivity?.length ? (
          <div
            className="dg-table-wrap"
            style={{ boxShadow: "none", border: "none" }}
          >
            <table className="dg-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Region</th>
                  <th>Assigned</th>
                  <th>Onboarded</th>
                  <th>Conv. %</th>
                  <th>Target</th>
                  <th>Achievement</th>
                </tr>
              </thead>
              <tbody>
                {data.employeeProductivity.map((e) => (
                  <tr key={e._id}>
                    <td>
                      <div className="dg-cell-strong">{e.name}</div>
                      <div className="dg-code">{e.employeeCode}</div>
                    </td>
                    <td>{e.region || "-"}</td>
                    <td>{e.assigned}</td>
                    <td>{e.onboarded}</td>
                    <td>{e.conversionRate}%</td>
                    <td>{e.target}</td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div className="dg-progress">
                          <span
                            style={{
                              width: `${Math.min(100, e.achievement)}%`,
                            }}
                          />
                        </div>
                        <span className="dg-cell-muted">{e.achievement}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dg-cell-muted">No active employees.</p>
        )}
      </div>

      {/* Campaign performance */}
      <div className="dg-card" style={{ marginTop: 20 }}>
        <h3>Campaign Performance</h3>
        {data.campaignPerformance?.length ? (
          <table className="dg-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Leads</th>
                <th>Onboarded</th>
                <th>Budget</th>
              </tr>
            </thead>
            <tbody>
              {data.campaignPerformance.map((c) => (
                <tr key={c._id}>
                  <td className="dg-cell-strong">{c.name}</td>
                  <td>{c.leads}</td>
                  <td>{c.onboarded}</td>
                  <td>{money(c.budget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="dg-cell-muted">No campaigns.</p>
        )}
      </div>
    </div>
  );
};

export default DGPerformance;
