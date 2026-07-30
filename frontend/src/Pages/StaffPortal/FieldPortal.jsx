import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  FiTarget,
  FiCreditCard,
  FiPercent,
  FiSearch,
  FiRefreshCw,
  FiX,
  FiBell,
  FiClock,
  FiPlus,
  FiUserPlus,
  FiBriefcase,
} from "react-icons/fi";
import StaffShell from "./StaffShell";
import StaffWallet from "./StaffWallet";
import * as portalAPI from "../../services/demandPortalAPI";
import {
  FIELD_STAGE_OPTIONS,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  ONBOARD_ROLES,
  ONBOARD_ROLES_REQUIRING_TERMS,
  roleForLeadValue,
} from "../../services/demandPortalAPI";
import "./StaffPortal.css";

// GCC dialing codes the platform serves. The onboarding form stamps the new
// account's country from the selected code (same signal registration uses).
const ONBOARD_DIAL_CODES = ["+971", "+965", "+966", "+973", "+968", "+974"];

// Human-readable label for an onboarding role id.
const onboardRoleLabel = (id) =>
  ONBOARD_ROLES.find((r) => r.id === id)?.label || "Commuter";

const money = (n) => `AED ${Number(n || 0).toLocaleString()}`;
const label = (s) => (s || "").replace(/_/g, " ");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "-");
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "-");

const stageBadge = (stage) => {
  const map = {
    ASSIGNED: "sp-badge-blue",
    CONTACTED: "sp-badge-purple",
    FOLLOW_UP: "sp-badge-amber",
    INTERESTED: "sp-badge-purple",
    DOCUMENTATION_PENDING: "sp-badge-amber",
    ONBOARDED: "sp-badge-green",
    ACTIVE: "sp-badge-green",
    LOST: "sp-badge-red",
    NEW: "sp-badge-gray",
  };
  return map[stage] || "sp-badge-gray";
};

const FieldPortal = () => {
  const [tab, setTab] = useState("leads");
  return (
    <StaffShell subtitle="Field / Sales workspace">
      <div className="sp-tabs">
        <button
          className={tab === "leads" ? "active" : ""}
          onClick={() => setTab("leads")}
        >
          <FiTarget /> My Leads
        </button>
        <button
          className={tab === "expenses" ? "active" : ""}
          onClick={() => setTab("expenses")}
        >
          <FiCreditCard /> My Expenses
        </button>
        <button
          className={tab === "commissions" ? "active" : ""}
          onClick={() => setTab("commissions")}
        >
          <FiPercent /> My Commissions
        </button>
        <button
          className={tab === "wallet" ? "active" : ""}
          onClick={() => setTab("wallet")}
        >
          <FiBriefcase /> My Wallet
        </button>
      </div>
      {tab === "leads" && <MyLeads />}
      {tab === "expenses" && <MyExpenses />}
      {tab === "commissions" && <MyCommissions />}
      {tab === "wallet" && <StaffWallet />}
    </StaffShell>
  );
};

/* ---------------- My Leads ---------------- */
const MyLeads = () => {
  const [data, setData] = useState({
    leads: [],
    stages: {},
    newlyAssigned: 0,
    dueFollowUps: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await portalAPI.getMyLeads({ search, stage: stageFilter });
      setData(res.data);
    } catch {
      toast.error("Failed to load your leads");
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter]);

  useEffect(() => {
    const t = setTimeout(fetchLeads, 300);
    return () => clearTimeout(t);
  }, [fetchLeads]);

  const totalLeads = Object.values(data.stages || {}).reduce(
    (a, b) => a + b,
    0,
  );
  const onboarded = (data.stages?.ONBOARDED || 0) + (data.stages?.ACTIVE || 0);

  return (
    <div>
      <div className="sp-stats">
        <div className="sp-stat accent">
          <div className="sp-stat-label">Total Assigned</div>
          <div className="sp-stat-value">{totalLeads}</div>
        </div>
        <div className="sp-stat">
          <div className="sp-stat-label">New (not contacted)</div>
          <div className="sp-stat-value">{data.newlyAssigned}</div>
        </div>
        <div className="sp-stat amber">
          <div className="sp-stat-label">Follow-ups due</div>
          <div className="sp-stat-value">{data.dueFollowUps}</div>
        </div>
        <div className="sp-stat green">
          <div className="sp-stat-label">Onboarded / Active</div>
          <div className="sp-stat-value">{onboarded}</div>
        </div>
      </div>

      {data.newlyAssigned > 0 && (
        <div className="sp-alert-bar">
          <FiBell />
          You have <strong>&nbsp;{data.newlyAssigned}&nbsp;</strong> newly
          assigned lead
          {data.newlyAssigned > 1 ? "s" : ""} waiting to be contacted. Open a
          lead to start working it.
        </div>
      )}

      <div className="sp-toolbar">
        <div className="sp-search">
          <FiSearch />
          <input
            placeholder="Search my leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="sp-select"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">All Stages</option>
          {FIELD_STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <button className="sp-btn" onClick={fetchLeads}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="sp-panel">
        {loading ? (
          <div className="sp-loading">
            <div className="sp-spinner" />
            <p>Loading your leads...</p>
          </div>
        ) : data.leads.length === 0 ? (
          <div className="sp-empty">
            <FiTarget size={28} />
            <h3>No leads yet</h3>
            <p>Leads assigned to you by the admin will appear here.</p>
          </div>
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Category</th>
                  <th>Stage</th>
                  <th>Next Follow-up</th>
                  <th>Est. Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.leads.map((l) => {
                  const overdue =
                    l.nextFollowUpDate &&
                    new Date(l.nextFollowUpDate) <= new Date() &&
                    !["ONBOARDED", "ACTIVE", "LOST"].includes(l.stage);
                  return (
                    <tr key={l._id}>
                      <td>
                        <div className="sp-cell-strong">{l.name}</div>
                        <div className="sp-code">{l.leadCode}</div>
                        {l.contactPerson && (
                          <div className="sp-cell-muted">
                            {l.contactPerson}
                            {l.phone ? ` · ${l.phone}` : ""}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="sp-badge sp-badge-gray">
                          {l.leadCategory === "PARTNER"
                            ? `Partner${l.partnerType ? ` · ${l.partnerType}` : ""}`
                            : "Customer"}
                        </span>
                      </td>
                      <td>
                        <span className={`sp-badge ${stageBadge(l.stage)}`}>
                          {label(l.stage)}
                        </span>
                      </td>
                      <td>
                        {l.nextFollowUpDate ? (
                          <span
                            className={overdue ? "sp-badge sp-badge-red" : ""}
                          >
                            {fmtDate(l.nextFollowUpDate)}
                          </span>
                        ) : (
                          <span className="sp-cell-muted">-</span>
                        )}
                      </td>
                      <td>{money(l.estimatedValue)}</td>
                      <td>
                        <button
                          className="sp-btn sp-btn-sm sp-btn-primary"
                          onClick={() => setSelected(l)}
                        >
                          Work Lead
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <LeadWorkModal
          leadId={selected._id}
          onClose={() => setSelected(null)}
          onSaved={fetchLeads}
        />
      )}
    </div>
  );
};

/* ---------------- Lead Work Modal ---------------- */
const LeadWorkModal = ({ leadId, onClose, onSaved }) => {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("note"); // "note" | "stage"
  const [noteForm, setNoteForm] = useState({ note: "", nextFollowUpDate: "" });
  const [stageForm, setStageForm] = useState({
    stage: "",
    note: "",
    nextFollowUpDate: "",
    lostReason: "",
  });
  const [onboardForm, setOnboardForm] = useState({
    role: "COMMUTER",
    fullName: "",
    email: "",
    countryCode: "+971",
    whatsappNumber: "",
    // Corporate
    companyName: "",
    companyAddress: "",
    tradeLicense: null, // File
    // B2C Partner
    serviceType: "",
    yearsOfExperience: "",
    serviceDescription: "",
    // Partner (B2B/B2C)
    acceptedPaymentMethods: [],
    // Shared
    profileImage: null, // File
    // Terms
    termsAccepted: false,
    termsVersion: "1.0.0",
  });
  const [commissionRange, setCommissionRange] = useState({ min: 0, max: 35 });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await portalAPI.getMyLead(leadId);
      setLead(res.data);
      setStageForm((p) => ({ ...p, stage: res.data.stage }));
      setOnboardForm((p) => ({
        ...p,
        // Default the account role to the one the lead was intended for.
        role: roleForLeadValue(res.data),
        fullName: res.data.contactPerson || res.data.name || "",
        email: res.data.email || "",
        whatsappNumber: res.data.phone || "",
        companyName: res.data.company || "",
      }));
    } catch {
      toast.error("Failed to load lead");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [leadId, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch the disclosed commission range + latest terms version for partner /
  // corporate roles (parity with the public Register page's T&C disclosure).
  useEffect(() => {
    const role = onboardForm.role;
    if (!ONBOARD_ROLES_REQUIRING_TERMS.includes(role)) return;
    let active = true;
    (async () => {
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/terms/latest?role=${role}`,
        );
        const json = await resp.json();
        if (!active || !json?.success || !json.data) return;
        const roleKeyMap = {
          B2C_PARTNER: "b2cPartner",
          B2B_PARTNER: "b2bPartner",
          CORPORATE: "corporate",
        };
        const range = json.data.commissionRange ||
          json.data.commissionRanges?.[roleKeyMap[role]] || { min: 0, max: 35 };
        setCommissionRange(range);
        if (json.data.version) {
          setOnboardForm((p) => ({ ...p, termsVersion: json.data.version }));
        }
      } catch {
        setCommissionRange({ min: 0, max: 35 });
      }
    })();
    return () => {
      active = false;
    };
  }, [onboardForm.role]);

  const submitNote = async (e) => {
    e.preventDefault();
    if (!noteForm.note.trim() && !noteForm.nextFollowUpDate) {
      toast.error("Add a note or a follow-up date");
      return;
    }
    try {
      setSubmitting(true);
      await portalAPI.addMyLeadActivity(leadId, {
        note: noteForm.note,
        nextFollowUpDate: noteForm.nextFollowUpDate || null,
      });
      toast.success("Activity added");
      setNoteForm({ note: "", nextFollowUpDate: "" });
      await load();
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add activity");
    } finally {
      setSubmitting(false);
    }
  };

  const submitStage = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await portalAPI.updateMyLeadStage(leadId, {
        stage: stageForm.stage,
        note: stageForm.note,
        nextFollowUpDate: stageForm.nextFollowUpDate || null,
        lostReason: stageForm.lostReason,
      });
      toast.success(res.message || "Stage updated");
      if (res.commissionsCreated > 0) {
        toast.success(
          `${res.commissionsCreated} commission(s) generated for this onboarding`,
        );
      }
      setStageForm((p) => ({ ...p, note: "", lostReason: "" }));
      await load();
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update stage");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePayment = (method) => {
    setOnboardForm((p) => ({
      ...p,
      acceptedPaymentMethods: p.acceptedPaymentMethods.includes(method)
        ? p.acceptedPaymentMethods.filter((m) => m !== method)
        : [...p.acceptedPaymentMethods, method],
    }));
  };

  const submitOnboard = async (e) => {
    e.preventDefault();
    const role = onboardForm.role;
    if (
      !onboardForm.fullName.trim() ||
      !onboardForm.email.trim() ||
      !onboardForm.whatsappNumber.trim()
    ) {
      toast.error(
        "Full name, email and contact number are required to onboard",
      );
      return;
    }
    // Role-specific client-side validation (mirrors the Register page).
    if (role === "CORPORATE" && !onboardForm.companyName.trim()) {
      toast.error("Company name is required for a Corporate account");
      return;
    }
    if (role === "B2C_PARTNER") {
      if (
        !onboardForm.serviceType.trim() ||
        onboardForm.yearsOfExperience === ""
      ) {
        toast.error(
          "Service type and years of experience are required for a B2C Partner",
        );
        return;
      }
    }
    if (
      (role === "B2B_PARTNER" || role === "B2C_PARTNER") &&
      onboardForm.acceptedPaymentMethods.length === 0
    ) {
      toast.error("Select at least one payment method for this partner");
      return;
    }
    if (
      ONBOARD_ROLES_REQUIRING_TERMS.includes(role) &&
      !onboardForm.termsAccepted
    ) {
      toast.error("The customer/partner must accept the Terms & Conditions");
      return;
    }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("role", role);
      fd.append("fullName", onboardForm.fullName);
      fd.append("email", onboardForm.email);
      fd.append("countryCode", onboardForm.countryCode);
      fd.append("whatsappNumber", onboardForm.whatsappNumber);
      fd.append(
        "acceptedPaymentMethods",
        JSON.stringify(onboardForm.acceptedPaymentMethods),
      );
      if (onboardForm.profileImage)
        fd.append("profileImage", onboardForm.profileImage);

      if (role === "CORPORATE") {
        fd.append("companyName", onboardForm.companyName);
        fd.append("companyAddress", onboardForm.companyAddress);
        if (onboardForm.tradeLicense)
          fd.append("tradeLicense", onboardForm.tradeLicense);
      } else if (role === "B2B_PARTNER") {
        if (onboardForm.companyName)
          fd.append("companyName", onboardForm.companyName);
      } else if (role === "B2C_PARTNER") {
        fd.append("serviceType", onboardForm.serviceType);
        fd.append("yearsOfExperience", onboardForm.yearsOfExperience);
        fd.append("serviceDescription", onboardForm.serviceDescription);
      }

      if (
        ONBOARD_ROLES_REQUIRING_TERMS.includes(role) &&
        onboardForm.termsAccepted
      ) {
        fd.append("termsAccepted", "true");
        fd.append("termsVersion", onboardForm.termsVersion);
      }

      const res = await portalAPI.onboardMyLead(leadId, fd);
      toast.success(res.message || "Lead onboarded");
      if (res.commissionsCreated > 0) {
        toast.success(
          `${res.commissionsCreated} commission(s) generated for this onboarding`,
        );
      }
      await load();
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to onboard lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sp-modal-overlay" onClick={onClose}>
      <div
        className="sp-modal sp-modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sp-modal-head">
          <h3>
            {loading ? "Loading..." : `${lead?.name} · ${lead?.leadCode}`}
          </h3>
          <button className="sp-modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <div className="sp-modal-body">
          {loading || !lead ? (
            <div className="sp-loading">
              <div className="sp-spinner" />
            </div>
          ) : (
            <>
              <div className="sp-lead-meta">
                <div className="item">
                  <div className="k">Stage</div>
                  <div className="v">
                    <span className={`sp-badge ${stageBadge(lead.stage)}`}>
                      {label(lead.stage)}
                    </span>
                  </div>
                </div>
                <div className="item">
                  <div className="k">Contact</div>
                  <div className="v">{lead.contactPerson || "-"}</div>
                </div>
                <div className="item">
                  <div className="k">Phone</div>
                  <div className="v">{lead.phone || "-"}</div>
                </div>
                <div className="item">
                  <div className="k">Email</div>
                  <div className="v">{lead.email || "-"}</div>
                </div>
                <div className="item">
                  <div className="k">Est. Value</div>
                  <div className="v">{money(lead.estimatedValue)}</div>
                </div>
                <div className="item">
                  <div className="k">Next Follow-up</div>
                  <div className="v">{fmtDate(lead.nextFollowUpDate)}</div>
                </div>
              </div>

              <div className="sp-tabs" style={{ marginBottom: 14 }}>
                <button
                  className={mode === "note" ? "active" : ""}
                  onClick={() => setMode("note")}
                >
                  Add Note / Follow-up
                </button>
                <button
                  className={mode === "stage" ? "active" : ""}
                  onClick={() => setMode("stage")}
                >
                  Update Stage
                </button>
              </div>

              {mode === "note" ? (
                <form onSubmit={submitNote}>
                  <div className="sp-field">
                    <label>Note</label>
                    <textarea
                      rows={3}
                      placeholder="What happened on this interaction?"
                      value={noteForm.note}
                      onChange={(e) =>
                        setNoteForm({ ...noteForm, note: e.target.value })
                      }
                    />
                  </div>
                  <div className="sp-field">
                    <label>Next Follow-up Date</label>
                    <input
                      type="date"
                      value={noteForm.nextFollowUpDate}
                      onChange={(e) =>
                        setNoteForm({
                          ...noteForm,
                          nextFollowUpDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    className="sp-btn sp-btn-primary"
                    disabled={submitting}
                  >
                    <FiPlus /> {submitting ? "Saving..." : "Add Activity"}
                  </button>
                </form>
              ) : (
                <form onSubmit={submitStage}>
                  <div className="sp-field">
                    <label>Move to Stage</label>
                    <select
                      value={stageForm.stage}
                      onChange={(e) =>
                        setStageForm({ ...stageForm, stage: e.target.value })
                      }
                    >
                      {FIELD_STAGE_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {stageForm.stage === "ONBOARDED" && !lead.onboardedUser ? (
                    <>
                      <div className="sp-field">
                        <label>Register As (Account Role) *</label>
                        <div className="sp-chip-row">
                          {ONBOARD_ROLES.map((r) => (
                            <button
                              type="button"
                              key={r.id}
                              className={`sp-chip ${onboardForm.role === r.id ? "active" : ""}`}
                              onClick={() =>
                                setOnboardForm((p) => ({ ...p, role: r.id }))
                              }
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                        {onboardForm.role === roleForLeadValue(lead) && (
                          <small className="sp-hint">
                            Pre-selected from what this lead was interested in.
                          </small>
                        )}
                      </div>

                      <div
                        className="sp-alert-bar"
                        style={{ marginBottom: 12 }}
                      >
                        Onboarding registers this lead as a real{" "}
                        <strong>{onboardRoleLabel(onboardForm.role)}</strong>{" "}
                        account. A password-setup email is sent to them and your
                        commission is generated automatically.
                      </div>

                      <div className="sp-field">
                        <label>Full Name *</label>
                        <input
                          value={onboardForm.fullName}
                          placeholder="Account holder name"
                          onChange={(e) =>
                            setOnboardForm({
                              ...onboardForm,
                              fullName: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="sp-field">
                        <label>Email Address *</label>
                        <input
                          type="email"
                          value={onboardForm.email}
                          placeholder="name@example.com"
                          onChange={(e) =>
                            setOnboardForm({
                              ...onboardForm,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="sp-field">
                        <label>WhatsApp / Contact Number *</label>
                        <div className="sp-inline-row">
                          <select
                            className="sp-cc-select"
                            value={onboardForm.countryCode}
                            onChange={(e) =>
                              setOnboardForm({
                                ...onboardForm,
                                countryCode: e.target.value,
                              })
                            }
                          >
                            {ONBOARD_DIAL_CODES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <input
                            value={onboardForm.whatsappNumber}
                            placeholder="50 123 4567"
                            onChange={(e) =>
                              setOnboardForm({
                                ...onboardForm,
                                whatsappNumber: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Profile image (all roles, optional) */}
                      <div className="sp-field">
                        <label>Profile Image (optional)</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            setOnboardForm({
                              ...onboardForm,
                              profileImage: e.target.files?.[0] || null,
                            })
                          }
                        />
                      </div>

                      {/* Corporate-specific fields */}
                      {onboardForm.role === "CORPORATE" && (
                        <>
                          <div className="sp-field">
                            <label>Company Name *</label>
                            <input
                              value={onboardForm.companyName}
                              placeholder="Company / Institution name"
                              onChange={(e) =>
                                setOnboardForm({
                                  ...onboardForm,
                                  companyName: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="sp-field">
                            <label>Company Address</label>
                            <input
                              value={onboardForm.companyAddress}
                              placeholder="Registered address"
                              onChange={(e) =>
                                setOnboardForm({
                                  ...onboardForm,
                                  companyAddress: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="sp-field">
                            <label>Trade License (optional)</label>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) =>
                                setOnboardForm({
                                  ...onboardForm,
                                  tradeLicense: e.target.files?.[0] || null,
                                })
                              }
                            />
                          </div>
                        </>
                      )}

                      {/* B2B partner company name (optional) */}
                      {onboardForm.role === "B2B_PARTNER" && (
                        <div className="sp-field">
                          <label>Company Name</label>
                          <input
                            value={onboardForm.companyName}
                            placeholder="Business / fleet company name"
                            onChange={(e) =>
                              setOnboardForm({
                                ...onboardForm,
                                companyName: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}

                      {/* B2C service provider fields */}
                      {onboardForm.role === "B2C_PARTNER" && (
                        <>
                          <div className="sp-field">
                            <label>Service Type *</label>
                            <select
                              value={onboardForm.serviceType}
                              onChange={(e) =>
                                setOnboardForm({
                                  ...onboardForm,
                                  serviceType: e.target.value,
                                })
                              }
                            >
                              <option value="">Select service type</option>
                              <option value="individual">
                                Individual Vehicle Owner
                              </option>
                              <option value="smallfleet">
                                Small Fleet Owner
                              </option>
                            </select>
                          </div>
                          <div className="sp-field">
                            <label>Years of Experience *</label>
                            <input
                              type="number"
                              min="0"
                              value={onboardForm.yearsOfExperience}
                              placeholder="e.g. 5"
                              onChange={(e) =>
                                setOnboardForm({
                                  ...onboardForm,
                                  yearsOfExperience: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="sp-field">
                            <label>Service Description</label>
                            <textarea
                              rows={2}
                              value={onboardForm.serviceDescription}
                              placeholder="Describe the services offered"
                              onChange={(e) =>
                                setOnboardForm({
                                  ...onboardForm,
                                  serviceDescription: e.target.value,
                                })
                              }
                            />
                          </div>
                        </>
                      )}

                      {/* Payment methods for partner roles */}
                      {(onboardForm.role === "B2B_PARTNER" ||
                        onboardForm.role === "B2C_PARTNER") && (
                        <div className="sp-field">
                          <label>Payment Methods *</label>
                          <div className="sp-chip-row">
                            {PAYMENT_METHODS.map((m) => (
                              <button
                                type="button"
                                key={m}
                                className={`sp-chip ${onboardForm.acceptedPaymentMethods.includes(m) ? "active" : ""}`}
                                onClick={() => togglePayment(m)}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Terms & Conditions for partner/corporate roles */}
                      {ONBOARD_ROLES_REQUIRING_TERMS.includes(
                        onboardForm.role,
                      ) && (
                        <div className="sp-field">
                          <label className="sp-checkbox-line">
                            <input
                              type="checkbox"
                              checked={onboardForm.termsAccepted}
                              onChange={(e) =>
                                setOnboardForm({
                                  ...onboardForm,
                                  termsAccepted: e.target.checked,
                                })
                              }
                            />
                            <span>
                              Customer/partner agrees to the Terms &amp;
                              Conditions (v{onboardForm.termsVersion})
                            </span>
                          </label>
                          <div
                            className="sp-alert-bar"
                            style={{ marginTop: 8 }}
                          >
                            A commission of {commissionRange.min}% to{" "}
                            {commissionRange.max}% may apply based on their
                            transactions.
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        className="sp-btn sp-btn-primary"
                        disabled={submitting}
                        onClick={submitOnboard}
                      >
                        <FiUserPlus />{" "}
                        {submitting ? "Onboarding..." : "Onboard & Register"}
                      </button>
                    </>
                  ) : (
                    <>
                      {stageForm.stage === "LOST" && (
                        <div className="sp-field">
                          <label>Reason for Loss</label>
                          <input
                            value={stageForm.lostReason}
                            placeholder="e.g. Chose a competitor"
                            onChange={(e) =>
                              setStageForm({
                                ...stageForm,
                                lostReason: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                      <div className="sp-field">
                        <label>Note</label>
                        <textarea
                          rows={2}
                          placeholder="Optional note about this stage change"
                          value={stageForm.note}
                          onChange={(e) =>
                            setStageForm({ ...stageForm, note: e.target.value })
                          }
                        />
                      </div>
                      <div className="sp-field">
                        <label>Next Follow-up Date</label>
                        <input
                          type="date"
                          value={stageForm.nextFollowUpDate}
                          onChange={(e) =>
                            setStageForm({
                              ...stageForm,
                              nextFollowUpDate: e.target.value,
                            })
                          }
                        />
                      </div>
                      <button
                        type="submit"
                        className="sp-btn sp-btn-primary"
                        disabled={submitting}
                      >
                        {submitting ? "Saving..." : "Update Stage"}
                      </button>
                    </>
                  )}
                </form>
              )}

              <h4 style={{ margin: "22px 0 12px", fontSize: 14 }}>
                Activity Timeline
              </h4>
              <ul className="sp-timeline">
                {[...(lead.activities || [])].reverse().map((a, i) => (
                  <li key={i}>
                    <div className="t-stage">
                      <span className={`sp-badge ${stageBadge(a.stage)}`}>
                        {label(a.stage)}
                      </span>
                    </div>
                    {a.note && <div className="t-note">{a.note}</div>}
                    <div className="t-meta">
                      {fmtDateTime(a.createdAt)}
                      {a.employee?.fullName ? ` · ${a.employee.fullName}` : ""}
                      {a.nextFollowUpDate
                        ? ` · Next: ${fmtDate(a.nextFollowUpDate)}`
                        : ""}
                    </div>
                  </li>
                ))}
                {(!lead.activities || lead.activities.length === 0) && (
                  <li>
                    <div className="t-meta">No activity yet.</div>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------------- My Expenses ---------------- */
const MyExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [totals, setTotals] = useState({ totalPaid: 0, pendingApproval: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: "TRAVEL",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    receiptUrl: "",
  });

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await portalAPI.getMyExpenses();
      setExpenses(res.data || []);
      setTotals({
        totalPaid: res.totalPaid || 0,
        pendingApproval: res.pendingApproval || 0,
      });
    } catch {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      setSubmitting(true);
      await portalAPI.submitMyExpense(form);
      toast.success("Expense submitted for approval");
      setShowModal(false);
      setForm({
        category: "TRAVEL",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        description: "",
        receiptUrl: "",
      });
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit expense");
    } finally {
      setSubmitting(false);
    }
  };

  const approvalBadge = (s) =>
    ({
      APPROVED: "sp-badge-green",
      REJECTED: "sp-badge-red",
      PENDING: "sp-badge-amber",
    })[s] || "sp-badge-gray";

  return (
    <div>
      <div className="sp-stats">
        <div className="sp-stat green">
          <div className="sp-stat-label">Total Reimbursed</div>
          <div className="sp-stat-value">{money(totals.totalPaid)}</div>
        </div>
        <div className="sp-stat amber">
          <div className="sp-stat-label">Pending Approval</div>
          <div className="sp-stat-value">{money(totals.pendingApproval)}</div>
        </div>
      </div>

      <div className="sp-toolbar">
        <div style={{ flex: 1 }} />
        <button
          className="sp-btn sp-btn-primary"
          onClick={() => setShowModal(true)}
        >
          <FiPlus /> Submit Expense
        </button>
      </div>

      <div className="sp-panel">
        {loading ? (
          <div className="sp-loading">
            <div className="sp-spinner" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="sp-empty">
            <FiCreditCard size={28} />
            <h3>No expenses yet</h3>
            <p>Submit your first travel or field expense for approval.</p>
          </div>
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Approval</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((ex) => (
                  <tr key={ex._id}>
                    <td>{fmtDate(ex.date)}</td>
                    <td>
                      <span className="sp-badge sp-badge-gray">
                        {ex.category}
                      </span>
                    </td>
                    <td className="sp-cell-strong">{money(ex.amount)}</td>
                    <td className="sp-cell-muted">{ex.description || "-"}</td>
                    <td>
                      <span
                        className={`sp-badge ${approvalBadge(ex.approvalStatus)}`}
                      >
                        {ex.approvalStatus}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`sp-badge ${ex.paymentStatus === "PAID" ? "sp-badge-green" : "sp-badge-gray"}`}
                      >
                        {ex.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="sp-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-head">
              <h3>Submit Expense</h3>
              <button
                className="sp-modal-close"
                onClick={() => setShowModal(false)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={submit}>
              <div className="sp-modal-body">
                <div className="sp-form-grid">
                  <div className="sp-field">
                    <label>Category *</label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sp-field">
                    <label>Amount (AED) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="sp-field">
                    <label>Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                    />
                  </div>
                  <div className="sp-field">
                    <label>Receipt URL</label>
                    <input
                      placeholder="Optional link"
                      value={form.receiptUrl}
                      onChange={(e) =>
                        setForm({ ...form, receiptUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="sp-field full">
                    <label>Description</label>
                    <textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="sp-modal-foot">
                <button
                  type="button"
                  className="sp-btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sp-btn sp-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- My Commissions ---------------- */
const MyCommissions = () => {
  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    paid: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await portalAPI.getMyCommissions();
        setCommissions(res.data || []);
        setSummary(
          res.summary || { total: 0, pending: 0, approved: 0, paid: 0 },
        );
      } catch {
        toast.error("Failed to load commissions");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statusBadge = (s) =>
    ({
      PAID: "sp-badge-green",
      APPROVED: "sp-badge-blue",
      PENDING: "sp-badge-amber",
    })[s] || "sp-badge-gray";

  return (
    <div>
      <div className="sp-stats">
        <div className="sp-stat accent">
          <div className="sp-stat-label">Total Earned</div>
          <div className="sp-stat-value">{money(summary.total)}</div>
        </div>
        <div className="sp-stat amber">
          <div className="sp-stat-label">Pending</div>
          <div className="sp-stat-value">{money(summary.pending)}</div>
        </div>
        <div className="sp-stat">
          <div className="sp-stat-label">Approved (unpaid)</div>
          <div className="sp-stat-value">{money(summary.approved)}</div>
        </div>
        <div className="sp-stat green">
          <div className="sp-stat-label">Paid</div>
          <div className="sp-stat-value">{money(summary.paid)}</div>
        </div>
      </div>

      <div className="sp-panel">
        {loading ? (
          <div className="sp-loading">
            <div className="sp-spinner" />
          </div>
        ) : commissions.length === 0 ? (
          <div className="sp-empty">
            <FiPercent size={28} />
            <h3>No commissions yet</h3>
            <p>Commissions appear when you onboard a lead.</p>
          </div>
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Lead / Source</th>
                  <th>Trigger</th>
                  <th>Amount</th>
                  <th>Month</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c._id}>
                    <td>{fmtDate(c.createdAt)}</td>
                    <td>
                      <div className="sp-cell-strong">
                        {c.lead?.name || c.campaign?.name || "-"}
                      </div>
                      {c.lead?.leadCode && (
                        <div className="sp-code">{c.lead.leadCode}</div>
                      )}
                    </td>
                    <td className="sp-cell-muted">{label(c.trigger)}</td>
                    <td className="sp-cell-strong">{money(c.amount)}</td>
                    <td>{c.month}</td>
                    <td>
                      <span className={`sp-badge ${statusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldPortal;
