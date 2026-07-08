"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getRosterTargets,
  listRosterChangeRequests,
  createRosterChangeRequest,
  updateRosterChangeStatus,
  addRosterChangeComment,
} from "../../../services/rosterChangeAPI";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import "./rosterchangerequests.css";

/**
 * RosterChangeRequests
 * --------------------
 * The continuous change-request workflow for a MANAGED contract. The corporate
 * client (mode="corporate") raises structured changes to the live employee
 * roster / routes; the operating B2B partner (mode="partner") drives them
 * through acknowledge -> in-progress -> completed / rejected. On completion the
 * backend applies the change to the live ManagedServiceBrief.
 */

const TYPE_OPTIONS = [
  { value: "ADD_EMPLOYEE", label: "Add employee", group: "employee" },
  { value: "MODIFY_EMPLOYEE", label: "Modify employee", group: "employee" },
  { value: "REMOVE_EMPLOYEE", label: "Remove employee", group: "employee" },
  { value: "ADD_ROUTE", label: "Add route", group: "route" },
  { value: "MODIFY_ROUTE", label: "Modify route", group: "route" },
  { value: "REMOVE_ROUTE", label: "Remove route", group: "route" },
];

const TYPE_LABEL = TYPE_OPTIONS.reduce(
  (acc, t) => ((acc[t.value] = t.label), acc),
  {},
);

const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "URGENT"];

const STATUS_LABEL = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const ADD_TYPES = ["ADD_EMPLOYEE", "ADD_ROUTE"];
const TARGET_TYPES = [
  "REMOVE_EMPLOYEE",
  "MODIFY_EMPLOYEE",
  "REMOVE_ROUTE",
  "MODIFY_ROUTE",
];
const EMPLOYEE_TYPES = ["ADD_EMPLOYEE", "MODIFY_EMPLOYEE", "REMOVE_EMPLOYEE"];

const EMPTY_EMPLOYEE = {
  name: "",
  employeeCode: "",
  email: "",
  phone: "",
  department: "",
  homeAddress: "",
  pickupArea: "",
  workLocation: "",
  shiftLabel: "",
  passMonths: 1,
  preferredRouteLabel: "",
};

const EMPTY_ROUTE = {
  label: "",
  fromArea: "",
  toWorkLocation: "",
  direction: "BOTH",
  headcount: 0,
  pickupWindowStart: "",
  pickupWindowEnd: "",
  preferredVehicleType: "",
  notes: "",
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function RosterChangeRequests({
  contractId,
  mode = "corporate",
}) {
  const isCorporate = mode === "corporate";

  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(null);
  const [viewerRole, setViewerRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  // Raise-request modal state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(null);
  const [targets, setTargets] = useState({ employees: [], routes: [] });
  const [submitting, setSubmitting] = useState(false);

  // Per-request comment drafts
  const [commentDraft, setCommentDraft] = useState({});

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(
    async ({ silent } = {}) => {
      try {
        if (!silent) setLoading(true);
        const res = await listRosterChangeRequests(contractId, {
          status: statusFilter || undefined,
        });
        if (res.data.success) {
          setRequests(res.data.data.requests || []);
          setSummary(res.data.data.summary || null);
          setViewerRole(res.data.data.viewerRole || null);
        }
      } catch (err) {
        console.error("[v0] Failed to load roster change requests:", err);
        if (!silent) {
          showToast(
            err.response?.data?.message || "Failed to load change requests",
            "error",
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [contractId, statusFilter],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Live auto-refresh: change requests move through approval states on the other
  // side (corporate <-> partner), so keep the list current in the background.
  useAutoRefresh(load, {
    interval: 20000,
    enabled: !!contractId,
    socketEvents: ["new-notification"],
    deps: [contractId, statusFilter],
  });

  const openCreate = async () => {
    setForm({
      type: "ADD_EMPLOYEE",
      priority: "NORMAL",
      reason: "",
      requestedEffectiveDate: "",
      targetItemId: "",
      employee: { ...EMPTY_EMPLOYEE },
      route: { ...EMPTY_ROUTE },
    });
    setShowCreate(true);
    try {
      const res = await getRosterTargets(contractId);
      if (res.data.success) setTargets(res.data.data);
    } catch (err) {
      console.error("[v0] Failed to load roster targets:", err);
    }
  };

  const buildPayload = () => {
    const { type } = form;
    const isEmployee = EMPLOYEE_TYPES.includes(type);

    const body = {
      type,
      priority: form.priority,
      reason: form.reason,
      requestedEffectiveDate: form.requestedEffectiveDate || null,
    };

    if (TARGET_TYPES.includes(type)) body.targetItemId = form.targetItemId;

    if (ADD_TYPES.includes(type) || type.startsWith("MODIFY")) {
      if (isEmployee) {
        const e = form.employee;
        body.payload = { ...e, passMonths: Number(e.passMonths) || 0 };
      } else {
        const r = form.route;
        body.payload = { ...r, headcount: Number(r.headcount) || 0 };
      }
    }
    return body;
  };

  const submitCreate = async () => {
    const body = buildPayload();
    // Light client-side validation mirroring the backend rules.
    if (ADD_TYPES.includes(form.type)) {
      if (EMPLOYEE_TYPES.includes(form.type) && !body.payload.name?.trim())
        return showToast("Employee name is required", "error");
      if (!EMPLOYEE_TYPES.includes(form.type) && !body.payload.label?.trim())
        return showToast("Route label is required", "error");
    }
    if (TARGET_TYPES.includes(form.type) && !body.targetItemId)
      return showToast("Select which roster item this change targets", "error");

    try {
      setSubmitting(true);
      const res = await createRosterChangeRequest(contractId, body);
      if (res.data.success) {
        showToast("Change request submitted");
        setShowCreate(false);
        setForm(null);
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to submit change request",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const drive = async (request, status) => {
    let note = "";
    if (status === "REJECTED") {
      note = window.prompt("Reason for rejecting this request:") || "";
      if (!note.trim()) return;
    } else if (status === "COMPLETED") {
      note = window.prompt("Completion note (optional):") || "";
    } else if (status === "CANCELLED") {
      if (!window.confirm(`Cancel request ${request.requestNumber}?`)) return;
    }
    try {
      setBusyId(request._id);
      const res = await updateRosterChangeStatus(contractId, request._id, {
        status,
        note,
      });
      if (res.data.success) {
        showToast(`Request ${STATUS_LABEL[status].toLowerCase()}`);
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to update request",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  const postComment = async (request) => {
    const note = (commentDraft[request._id] || "").trim();
    if (!note) return;
    try {
      setBusyId(request._id);
      const res = await addRosterChangeComment(contractId, request._id, note);
      if (res.data.success) {
        setCommentDraft((d) => ({ ...d, [request._id]: "" }));
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to add comment",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  const isOverdue = (r) => {
    if (!["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"].includes(r.status))
      return false;
    const deadline =
      new Date(r.createdAt).getTime() +
      (r.completeSlaHours || 72) * 3600 * 1000;
    return Date.now() > deadline;
  };

  const partnerActions = (r) => {
    switch (r.status) {
      case "OPEN":
        return [
          { label: "Acknowledge", status: "ACKNOWLEDGED", variant: "" },
          { label: "Start work", status: "IN_PROGRESS", variant: "primary" },
          { label: "Reject", status: "REJECTED", variant: "danger" },
        ];
      case "ACKNOWLEDGED":
        return [
          { label: "Start work", status: "IN_PROGRESS", variant: "primary" },
          { label: "Reject", status: "REJECTED", variant: "danger" },
        ];
      case "IN_PROGRESS":
        return [
          { label: "Mark completed", status: "COMPLETED", variant: "primary" },
          { label: "Reject", status: "REJECTED", variant: "danger" },
        ];
      default:
        return [];
    }
  };

  const corporateActions = (r) =>
    ["OPEN", "ACKNOWLEDGED"].includes(r.status)
      ? [{ label: "Cancel request", status: "CANCELLED", variant: "danger" }]
      : [];

  const actionsFor = (r) =>
    viewerRole === "B2B_PARTNER" ? partnerActions(r) : corporateActions(r);

  if (loading) {
    return <div className="rcr-loading">Loading roster change requests…</div>;
  }

  const isEmployeeForm = form && EMPLOYEE_TYPES.includes(form.type);
  const targetList =
    form && EMPLOYEE_TYPES.includes(form.type)
      ? targets.employees
      : targets.routes;

  return (
    <div className="rcr">
      <div className="rcr-header">
        <div>
          <h2 className="rcr-title">Roster &amp; Route Change Requests</h2>
          <p className="rcr-sub">
            Ongoing changes to the live managed roster — employees join, leave
            and move, and routes get tweaked. Each request is tracked end-to-end
            and applied to the operational brief on completion.
          </p>
        </div>
        {isCorporate && (
          <button className="rcr-btn primary" onClick={openCreate}>
            Raise change request
          </button>
        )}
      </div>

      {summary && (
        <div className="rcr-summary">
          <div className="rcr-stat">
            <span className="rcr-stat-val">{summary.active}</span>
            <span className="rcr-stat-label">Active</span>
          </div>
          <div className="rcr-stat">
            <span className="rcr-stat-val">{summary.open}</span>
            <span className="rcr-stat-label">Open</span>
          </div>
          <div className="rcr-stat">
            <span className="rcr-stat-val">{summary.inProgress}</span>
            <span className="rcr-stat-label">In progress</span>
          </div>
          <div className="rcr-stat">
            <span className="rcr-stat-val">{summary.completed}</span>
            <span className="rcr-stat-label">Completed</span>
          </div>
          <div className={`rcr-stat ${summary.overdue > 0 ? "danger" : ""}`}>
            <span className="rcr-stat-val">{summary.overdue}</span>
            <span className="rcr-stat-label">Overdue</span>
          </div>
        </div>
      )}

      <div className="rcr-filters">
        <button
          className={`rcr-chip ${statusFilter === "" ? "active" : ""}`}
          onClick={() => setStatusFilter("")}
        >
          All
        </button>
        {Object.keys(STATUS_LABEL).map((s) => (
          <button
            key={s}
            className={`rcr-chip ${statusFilter === s ? "active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="rcr-empty">
          {statusFilter
            ? `No ${STATUS_LABEL[statusFilter].toLowerCase()} requests.`
            : isCorporate
              ? "No change requests yet. Raise one to add, modify or remove roster items."
              : "No change requests from the client yet."}
        </div>
      ) : (
        <div className="rcr-list">
          {requests.map((r) => {
            const expanded = expandedId === r._id;
            const overdue = isOverdue(r);
            const acts = actionsFor(r);
            return (
              <div
                key={r._id}
                className={`rcr-card ${overdue ? "overdue" : ""}`}
              >
                <div className="rcr-card-top">
                  <div className="rcr-card-main">
                    <div className="rcr-card-line1">
                      <span className="rcr-num">{r.requestNumber}</span>
                      <span
                        className={`rcr-type t-${r.type.startsWith("ADD") ? "add" : r.type.startsWith("REMOVE") ? "remove" : "modify"}`}
                      >
                        {TYPE_LABEL[r.type]}
                      </span>
                      <span
                        className={`rcr-status s-${r.status.toLowerCase()}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.priority !== "NORMAL" && (
                        <span
                          className={`rcr-prio p-${r.priority.toLowerCase()}`}
                        >
                          {r.priority}
                        </span>
                      )}
                      {overdue && (
                        <span className="rcr-overdue-tag">Overdue</span>
                      )}
                    </div>
                    <div className="rcr-card-desc">
                      {ADD_TYPES.includes(r.type)
                        ? EMPLOYEE_TYPES.includes(r.type)
                          ? `Add employee: ${r.payload?.name || "—"}${r.payload?.department ? ` (${r.payload.department})` : ""}`
                          : `Add route: ${r.payload?.label || "—"}`
                        : `${r.type.startsWith("REMOVE") ? "Remove" : "Modify"}: ${r.targetItemLabel || "roster item"}`}
                    </div>
                    <div className="rcr-card-meta">
                      Raised by {r.raisedByName || "client"} ·{" "}
                      {fmtDateTime(r.createdAt)}
                      {r.requestedEffectiveDate &&
                        ` · Effective ${fmtDate(r.requestedEffectiveDate)}`}
                    </div>
                  </div>
                  <button
                    className="rcr-expand"
                    onClick={() => setExpandedId(expanded ? null : r._id)}
                  >
                    {expanded ? "Hide" : "Details"}
                  </button>
                </div>

                {expanded && (
                  <div className="rcr-card-body">
                    {r.reason && (
                      <div className="rcr-block">
                        <span className="rcr-block-label">Reason</span>
                        <p className="rcr-block-text">{r.reason}</p>
                      </div>
                    )}

                    {(ADD_TYPES.includes(r.type) ||
                      r.type.startsWith("MODIFY")) &&
                      r.payload &&
                      Object.keys(r.payload).length > 0 && (
                        <div className="rcr-block">
                          <span className="rcr-block-label">
                            Change details
                          </span>
                          <div className="rcr-detail-grid">
                            {Object.entries(r.payload)
                              .filter(
                                ([k, v]) =>
                                  k !== "fulfillment" &&
                                  k !== "_id" &&
                                  v !== "" &&
                                  v != null,
                              )
                              .map(([k, v]) => (
                                <div key={k} className="rcr-detail">
                                  <span className="rcr-detail-k">{k}</span>
                                  <span className="rcr-detail-v">
                                    {String(v)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                    {r.resolutionNote && (
                      <div className="rcr-block">
                        <span className="rcr-block-label">Resolution note</span>
                        <p className="rcr-block-text">{r.resolutionNote}</p>
                      </div>
                    )}

                    <div className="rcr-block">
                      <span className="rcr-block-label">Timeline</span>
                      <ul className="rcr-timeline">
                        {(r.timeline || []).map((t, i) => (
                          <li key={i} className="rcr-tl-item">
                            <span
                              className={`rcr-tl-dot d-${(t.status || t.action || "").toLowerCase()}`}
                            />
                            <div className="rcr-tl-body">
                              <div className="rcr-tl-head">
                                <span className="rcr-tl-action">
                                  {t.action === "COMMENT"
                                    ? "Comment"
                                    : STATUS_LABEL[t.status] || t.action}
                                </span>
                                <span className="rcr-tl-by">
                                  {t.byName} (
                                  {t.byRole === "B2B_PARTNER"
                                    ? "Partner"
                                    : "Client"}
                                  ) · {fmtDateTime(t.at)}
                                </span>
                              </div>
                              {t.note && (
                                <p className="rcr-tl-note">{t.note}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Comment box — either party can post while the request is not closed */}
                    {["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"].includes(
                      r.status,
                    ) && (
                      <div className="rcr-comment">
                        <input
                          type="text"
                          placeholder="Add a message…"
                          value={commentDraft[r._id] || ""}
                          onChange={(e) =>
                            setCommentDraft((d) => ({
                              ...d,
                              [r._id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing)
                              postComment(r);
                          }}
                        />
                        <button
                          className="rcr-btn sm"
                          disabled={
                            busyId === r._id ||
                            !(commentDraft[r._id] || "").trim()
                          }
                          onClick={() => postComment(r)}
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {acts.length > 0 && (
                  <div className="rcr-card-actions">
                    {acts.map((a) => (
                      <button
                        key={a.status}
                        className={`rcr-btn ${a.variant}`}
                        disabled={busyId === r._id}
                        onClick={() => drive(r, a.status)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Raise request modal */}
      {showCreate && form && (
        <div className="rcr-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="rcr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="rcr-modal-title">Raise a roster change request</h3>

            <div className="rcr-modal-grid">
              <label className="rcr-field">
                Change type
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value, targetItemId: "" })
                  }
                >
                  <optgroup label="Employees">
                    {TYPE_OPTIONS.filter((t) => t.group === "employee").map(
                      (t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ),
                    )}
                  </optgroup>
                  <optgroup label="Routes">
                    {TYPE_OPTIONS.filter((t) => t.group === "route").map(
                      (t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ),
                    )}
                  </optgroup>
                </select>
              </label>

              <label className="rcr-field">
                Priority
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Target picker for MODIFY / REMOVE */}
            {TARGET_TYPES.includes(form.type) && (
              <label className="rcr-field">
                {isEmployeeForm ? "Which employee?" : "Which route?"}
                <select
                  value={form.targetItemId}
                  onChange={(e) =>
                    setForm({ ...form, targetItemId: e.target.value })
                  }
                >
                  <option value="">Select…</option>
                  {targetList.map((t) => (
                    <option key={t._id} value={t._id}>
                      {isEmployeeForm
                        ? `${t.name}${t.employeeCode ? ` (${t.employeeCode})` : ""}`
                        : t.label}
                    </option>
                  ))}
                </select>
                {targetList.length === 0 && (
                  <span className="rcr-hint">
                    No {isEmployeeForm ? "employees" : "routes"} on the current
                    brief yet.
                  </span>
                )}
              </label>
            )}

            {/* Employee payload fields */}
            {isEmployeeForm && !form.type.startsWith("REMOVE") && (
              <div className="rcr-modal-grid">
                <label>
                  Name{ADD_TYPES.includes(form.type) ? " *" : ""}
                  <input
                    value={form.employee.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: { ...form.employee, name: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Employee code
                  <input
                    value={form.employee.employeeCode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: {
                          ...form.employee,
                          employeeCode: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Department
                  <input
                    value={form.employee.department}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: {
                          ...form.employee,
                          department: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={form.employee.phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: { ...form.employee, phone: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    value={form.employee.email}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: { ...form.employee, email: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Pickup area
                  <input
                    value={form.employee.pickupArea}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: {
                          ...form.employee,
                          pickupArea: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="rcr-col-span">
                  Home address
                  <input
                    value={form.employee.homeAddress}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: {
                          ...form.employee,
                          homeAddress: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Work location
                  <input
                    value={form.employee.workLocation}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: {
                          ...form.employee,
                          workLocation: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Shift
                  <input
                    value={form.employee.shiftLabel}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: {
                          ...form.employee,
                          shiftLabel: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Pass months
                  <input
                    type="number"
                    min="0"
                    value={form.employee.passMonths}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employee: {
                          ...form.employee,
                          passMonths: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
            )}

            {/* Route payload fields */}
            {!isEmployeeForm && !form.type.startsWith("REMOVE") && (
              <div className="rcr-modal-grid">
                <label className="rcr-col-span">
                  Route label{ADD_TYPES.includes(form.type) ? " *" : ""}
                  <input
                    value={form.route.label}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        route: { ...form.route, label: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  From area
                  <input
                    value={form.route.fromArea}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        route: { ...form.route, fromArea: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  To work location
                  <input
                    value={form.route.toWorkLocation}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        route: {
                          ...form.route,
                          toWorkLocation: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Direction
                  <select
                    value={form.route.direction}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        route: { ...form.route, direction: e.target.value },
                      })
                    }
                  >
                    <option value="BOTH">Both ways</option>
                    <option value="PICKUP">Pickup</option>
                    <option value="DROP">Drop</option>
                  </select>
                </label>
                <label>
                  Headcount
                  <input
                    type="number"
                    min="0"
                    value={form.route.headcount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        route: { ...form.route, headcount: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Pickup window start
                  <input
                    type="time"
                    value={form.route.pickupWindowStart}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        route: {
                          ...form.route,
                          pickupWindowStart: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Pickup window end
                  <input
                    type="time"
                    value={form.route.pickupWindowEnd}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        route: {
                          ...form.route,
                          pickupWindowEnd: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Preferred vehicle
                  <input
                    value={form.route.preferredVehicleType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        route: {
                          ...form.route,
                          preferredVehicleType: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="rcr-col-span">
                  Notes
                  <input
                    value={form.route.notes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        route: { ...form.route, notes: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
            )}

            <div className="rcr-modal-grid">
              <label className="rcr-col-span">
                Reason / business context
                <textarea
                  rows={2}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Why is this change needed?"
                />
              </label>
              <label>
                Requested effective date
                <input
                  type="date"
                  value={form.requestedEffectiveDate}
                  onChange={(e) =>
                    setForm({ ...form, requestedEffectiveDate: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="rcr-modal-actions">
              <button className="rcr-btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="rcr-btn primary"
                disabled={submitting}
                onClick={submitCreate}
              >
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`rcr-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
