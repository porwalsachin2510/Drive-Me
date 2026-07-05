"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getSlaConfig,
  updateSlaConfig,
  getSlaPerformance,
  listComplaints,
  createComplaint,
  updateComplaint,
} from "../../../services/managedServiceAPI";
import "./managedsladashboard.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CATEGORY_OPTIONS = [
  { value: "LATE_PICKUP", label: "Late pickup" },
  { value: "NO_SHOW_VEHICLE", label: "Vehicle no-show" },
  { value: "DRIVER_BEHAVIOR", label: "Driver behaviour" },
  { value: "VEHICLE_CONDITION", label: "Vehicle condition" },
  { value: "ROUTE_ISSUE", label: "Route issue" },
  { value: "OVERCROWDING", label: "Overcrowding" },
  { value: "SAFETY", label: "Safety" },
  { value: "BILLING", label: "Billing" },
  { value: "OTHER", label: "Other" },
];

const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);
const hrs = (v) => (v === null || v === undefined ? "—" : `${v} hrs`);

function Metric({ label, actual, target, unit, ok }) {
  const hasValue = actual !== null && actual !== undefined;
  return (
    <div className={`msla-metric ${hasValue ? (ok ? "ok" : "breach") : "na"}`}>
      <span className="msla-metric-label">{label}</span>
      <span className="msla-metric-value">
        {unit === "hrs" ? hrs(actual) : hasValue ? `${actual}${unit}` : "—"}
      </span>
      <span className="msla-metric-target">
        Target: {unit === "hrs" ? `≤ ${target} hrs` : `≥ ${target}${unit}`}
      </span>
      {hasValue && (
        <span className={`msla-metric-badge ${ok ? "ok" : "breach"}`}>
          {ok ? "Met" : "Breached"}
        </span>
      )}
    </div>
  );
}

export default function ManagedSLADashboard({
  contractId,
  mode = "corporate",
}) {
  const isCorporate = mode === "corporate";
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [sla, setSla] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [currency, setCurrency] = useState("AED");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSla, setSavingSla] = useState(false);
  const [editSla, setEditSla] = useState(false);
  const [slaForm, setSlaForm] = useState(null);
  const [toast, setToast] = useState(null);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    subject: "",
    description: "",
    category: "OTHER",
    severity: "MEDIUM",
  });
  const [busyId, setBusyId] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cfgRes, perfRes, compRes] = await Promise.all([
        getSlaConfig(contractId),
        getSlaPerformance(contractId, { month, year }),
        listComplaints(contractId),
      ]);
      if (cfgRes.data.success) {
        setSla(cfgRes.data.data.sla || {});
        setCurrency(cfgRes.data.data.currency || "AED");
      }
      if (perfRes.data.success) setPerformance(perfRes.data.data.performance);
      if (compRes.data.success)
        setComplaints(compRes.data.data.complaints || []);
    } catch (err) {
      console.error("[v0] Failed to load SLA data:", err);
      showToast("Failed to load SLA data", "error");
    } finally {
      setLoading(false);
    }
  }, [contractId, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditSla = () => {
    setSlaForm({
      enabled: sla?.enabled ?? false,
      onTimeTargetPct: sla?.onTimeTargetPct ?? 95,
      vehicleAvailabilityTargetPct: sla?.vehicleAvailabilityTargetPct ?? 98,
      complaintResolutionHours: sla?.complaintResolutionHours ?? 24,
      lateThresholdMinutes: sla?.lateThresholdMinutes ?? 10,
      penalty: {
        onTimePerPointPct: sla?.penalty?.onTimePerPointPct ?? 1,
        availabilityPerPointPct: sla?.penalty?.availabilityPerPointPct ?? 1,
        perLateComplaint: sla?.penalty?.perLateComplaint ?? 0,
        maxPenaltyPct: sla?.penalty?.maxPenaltyPct ?? 25,
      },
    });
    setEditSla(true);
  };

  const saveSla = async () => {
    try {
      setSavingSla(true);
      const res = await updateSlaConfig(contractId, slaForm);
      if (res.data.success) {
        setSla(res.data.data.sla);
        setEditSla(false);
        showToast("SLA targets saved");
        load();
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save SLA", "error");
    } finally {
      setSavingSla(false);
    }
  };

  const submitComplaint = async () => {
    if (!complaintForm.subject.trim()) {
      showToast("Please enter a subject", "error");
      return;
    }
    try {
      setBusyId("new");
      const res = await createComplaint(contractId, complaintForm);
      if (res.data.success) {
        setShowComplaintForm(false);
        setComplaintForm({
          subject: "",
          description: "",
          category: "OTHER",
          severity: "MEDIUM",
        });
        showToast("Complaint submitted");
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to submit complaint",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  const changeComplaintStatus = async (complaint, status) => {
    try {
      setBusyId(complaint._id);
      let resolutionNote;
      if (status === "RESOLVED") {
        resolutionNote = window.prompt("Resolution note (optional):") || "";
      }
      const res = await updateComplaint(contractId, complaint._id, {
        status,
        resolutionNote,
      });
      if (res.data.success) {
        showToast(`Complaint marked ${status.toLowerCase()}`);
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to update complaint",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="msla-loading">Loading SLA & performance…</div>;
  }

  const breachMetrics = new Set(
    (performance?.breaches || []).map((b) => b.metric),
  );
  const t = performance?.sla || sla || {};
  const trip = performance?.trip || {};
  const avail = performance?.availability || {};
  const comp = performance?.complaints || {};

  return (
    <div className="msla">
      <div className="msla-header">
        <div>
          <h2 className="msla-title">SLA &amp; Performance</h2>
          <p className="msla-sub">
            Service-level tracking for this managed contract — on-time delivery,
            vehicle availability and complaint resolution against agreed
            targets.
          </p>
        </div>
        <div className="msla-header-actions">
          <select
            className="msla-select"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m} {year}
              </option>
            ))}
          </select>
          {isCorporate && (
            <button className="msla-btn" onClick={openEditSla}>
              Set Targets
            </button>
          )}
        </div>
      </div>

      {/* Health banner */}
      <div
        className={`msla-banner ${performance?.compliant ? "ok" : "breach"}`}
      >
        <div className="msla-banner-score">
          <span className="msla-banner-score-val">
            {performance?.healthScore === null ||
            performance?.healthScore === undefined
              ? "—"
              : `${performance.healthScore}%`}
          </span>
          <span className="msla-banner-score-label">SLA Health</span>
        </div>
        <div className="msla-banner-text">
          {performance?.compliant
            ? "All tracked SLAs are being met for this period."
            : `${performance?.breaches?.length || 0} SLA target(s) breached this period.`}
        </div>
      </div>

      {/* Metrics */}
      <div className="msla-metrics">
        <Metric
          label="On-time performance"
          actual={trip.onTimePct}
          target={t.onTimeTargetPct}
          unit="%"
          ok={!breachMetrics.has("ON_TIME")}
        />
        <Metric
          label="Vehicle availability"
          actual={avail.availabilityPct}
          target={t.vehicleAvailabilityTargetPct}
          unit="%"
          ok={!breachMetrics.has("AVAILABILITY")}
        />
        <Metric
          label="Avg. complaint resolution"
          actual={comp.avgResolutionHours}
          target={t.complaintResolutionHours}
          unit="hrs"
          ok={!breachMetrics.has("COMPLAINT_RESOLUTION")}
        />
      </div>

      {/* Operational detail */}
      <div className="msla-detail-grid">
        <div className="msla-detail-card">
          <span className="msla-detail-label">Completed trips</span>
          <span className="msla-detail-val">{trip.completedTrips ?? 0}</span>
          <span className="msla-detail-sub">
            {trip.lateTrips ?? 0} late · {trip.cancelledTrips ?? 0} cancelled
          </span>
        </div>
        <div className="msla-detail-card">
          <span className="msla-detail-label">Vehicles active</span>
          <span className="msla-detail-val">
            {avail.available ?? 0}/{avail.total ?? 0}
          </span>
          <span className="msla-detail-sub">
            {pct(avail.availabilityPct)} availability
          </span>
        </div>
        <div className="msla-detail-card">
          <span className="msla-detail-label">Complaints</span>
          <span className="msla-detail-val">{comp.total ?? 0}</span>
          <span className="msla-detail-sub">
            {comp.open ?? 0} open · {comp.breached ?? 0} late
          </span>
        </div>
      </div>

      {/* Breaches & penalties */}
      {performance?.breaches?.length > 0 && (
        <div className="msla-section">
          <h3 className="msla-section-title">SLA Breaches</h3>
          <div className="msla-breach-list">
            {performance.breaches.map((b) => (
              <div key={b.metric} className="msla-breach">
                <span className="msla-breach-label">{b.label}</span>
                <span className="msla-breach-nums">
                  Actual{" "}
                  {b.unit === "hrs"
                    ? `${b.actual} hrs`
                    : `${b.actual}${b.unit === "count" ? "" : b.unit}`}
                  {" · "}Target{" "}
                  {b.unit === "hrs"
                    ? `${b.target} hrs`
                    : `${b.target}${b.unit === "count" ? "" : b.unit}`}
                </span>
                <span className="msla-breach-gap">
                  -{b.shortfall}
                  {b.unit === "%" ? "%" : ""}
                </span>
              </div>
            ))}
          </div>
          <p className="msla-breach-note">
            Penalties are applied automatically against this month&apos;s
            operational invoice based on the agreed penalty rules.
          </p>
        </div>
      )}

      {/* Complaints */}
      <div className="msla-section">
        <div className="msla-section-head">
          <h3 className="msla-section-title">Complaints</h3>
          {isCorporate && (
            <button
              className="msla-btn"
              onClick={() => setShowComplaintForm((v) => !v)}
            >
              {showComplaintForm ? "Cancel" : "Raise Complaint"}
            </button>
          )}
        </div>

        {showComplaintForm && (
          <div className="msla-complaint-form">
            <input
              className="msla-input"
              placeholder="Subject"
              value={complaintForm.subject}
              onChange={(e) =>
                setComplaintForm({ ...complaintForm, subject: e.target.value })
              }
            />
            <div className="msla-form-row">
              <select
                className="msla-input"
                value={complaintForm.category}
                onChange={(e) =>
                  setComplaintForm({
                    ...complaintForm,
                    category: e.target.value,
                  })
                }
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                className="msla-input"
                value={complaintForm.severity}
                onChange={(e) =>
                  setComplaintForm({
                    ...complaintForm,
                    severity: e.target.value,
                  })
                }
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="msla-input"
              placeholder="Describe the issue"
              rows={3}
              value={complaintForm.description}
              onChange={(e) =>
                setComplaintForm({
                  ...complaintForm,
                  description: e.target.value,
                })
              }
            />
            <button
              className="msla-btn primary"
              disabled={busyId === "new"}
              onClick={submitComplaint}
            >
              {busyId === "new" ? "Submitting…" : "Submit Complaint"}
            </button>
          </div>
        )}

        {complaints.length === 0 ? (
          <div className="msla-empty">
            No complaints raised for this contract.
          </div>
        ) : (
          <div className="msla-complaint-list">
            {complaints.map((c) => (
              <div key={c._id} className="msla-complaint">
                <div className="msla-complaint-main">
                  <div className="msla-complaint-top">
                    <span
                      className={`msla-sev sev-${c.severity.toLowerCase()}`}
                    >
                      {c.severity}
                    </span>
                    <span className="msla-complaint-subject">{c.subject}</span>
                    <span
                      className={`msla-cstatus s-${c.status.toLowerCase()}`}
                    >
                      {c.status}
                    </span>
                  </div>
                  {c.description && (
                    <p className="msla-complaint-desc">{c.description}</p>
                  )}
                  <p className="msla-complaint-meta">
                    {c.raisedByName} ·{" "}
                    {new Date(c.createdAt).toLocaleDateString()}
                    {c.resolvedAt && (
                      <>
                        {" "}
                        · resolved in {c.resolutionHours} hrs
                        {c.breachedSla ? (
                          <span className="msla-late"> (late)</span>
                        ) : (
                          ""
                        )}
                      </>
                    )}
                  </p>
                  {c.resolutionNote && (
                    <p className="msla-complaint-resolution">
                      Resolution: {c.resolutionNote}
                    </p>
                  )}
                </div>
                {!isCorporate &&
                  c.status !== "RESOLVED" &&
                  c.status !== "CLOSED" && (
                    <div className="msla-complaint-actions">
                      {c.status === "OPEN" && (
                        <button
                          className="msla-btn sm"
                          disabled={busyId === c._id}
                          onClick={() =>
                            changeComplaintStatus(c, "IN_PROGRESS")
                          }
                        >
                          Start
                        </button>
                      )}
                      <button
                        className="msla-btn sm primary"
                        disabled={busyId === c._id}
                        onClick={() => changeComplaintStatus(c, "RESOLVED")}
                      >
                        Resolve
                      </button>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SLA target editor */}
      {editSla && slaForm && (
        <div className="msla-modal-overlay" onClick={() => setEditSla(false)}>
          <div className="msla-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="msla-modal-title">SLA Targets &amp; Penalties</h3>
            <label className="msla-check">
              <input
                type="checkbox"
                checked={slaForm.enabled}
                onChange={(e) =>
                  setSlaForm({ ...slaForm, enabled: e.target.checked })
                }
              />
              Enable SLA tracking &amp; penalties
            </label>

            <div className="msla-modal-grid">
              <label>
                On-time target (%)
                <input
                  type="number"
                  value={slaForm.onTimeTargetPct}
                  onChange={(e) =>
                    setSlaForm({ ...slaForm, onTimeTargetPct: e.target.value })
                  }
                />
              </label>
              <label>
                Availability target (%)
                <input
                  type="number"
                  value={slaForm.vehicleAvailabilityTargetPct}
                  onChange={(e) =>
                    setSlaForm({
                      ...slaForm,
                      vehicleAvailabilityTargetPct: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Complaint resolution (hrs)
                <input
                  type="number"
                  value={slaForm.complaintResolutionHours}
                  onChange={(e) =>
                    setSlaForm({
                      ...slaForm,
                      complaintResolutionHours: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Late threshold (min)
                <input
                  type="number"
                  value={slaForm.lateThresholdMinutes}
                  onChange={(e) =>
                    setSlaForm({
                      ...slaForm,
                      lateThresholdMinutes: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <h4 className="msla-modal-sub">Penalty rules</h4>
            <div className="msla-modal-grid">
              <label>
                On-time penalty (% of bill / point)
                <input
                  type="number"
                  value={slaForm.penalty.onTimePerPointPct}
                  onChange={(e) =>
                    setSlaForm({
                      ...slaForm,
                      penalty: {
                        ...slaForm.penalty,
                        onTimePerPointPct: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Availability penalty (% / point)
                <input
                  type="number"
                  value={slaForm.penalty.availabilityPerPointPct}
                  onChange={(e) =>
                    setSlaForm({
                      ...slaForm,
                      penalty: {
                        ...slaForm.penalty,
                        availabilityPerPointPct: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Per late complaint ({currency})
                <input
                  type="number"
                  value={slaForm.penalty.perLateComplaint}
                  onChange={(e) =>
                    setSlaForm({
                      ...slaForm,
                      penalty: {
                        ...slaForm.penalty,
                        perLateComplaint: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Max penalty (% of bill)
                <input
                  type="number"
                  value={slaForm.penalty.maxPenaltyPct}
                  onChange={(e) =>
                    setSlaForm({
                      ...slaForm,
                      penalty: {
                        ...slaForm.penalty,
                        maxPenaltyPct: e.target.value,
                      },
                    })
                  }
                />
              </label>
            </div>

            <div className="msla-modal-actions">
              <button className="msla-btn" onClick={() => setEditSla(false)}>
                Cancel
              </button>
              <button
                className="msla-btn primary"
                disabled={savingSla}
                onClick={saveSla}
              >
                {savingSla ? "Saving…" : "Save Targets"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`msla-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
