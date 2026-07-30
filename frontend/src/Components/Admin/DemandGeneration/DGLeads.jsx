import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FiTarget,
  FiPlus,
  FiSearch,
  FiRefreshCw,
  FiX,
  FiEdit2,
  FiTrash2,
  FiUserCheck,
  FiActivity,
  FiTrendingUp,
  FiUpload,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";
import * as demandAPI from "../../../services/demandAPI";

// Format a money amount in the admin's currently selected display currency.
// The backend already converts stored (base-currency) amounts to this currency,
// so here we only apply the right symbol and decimal places.
const formatMoney = (n, currency) => {
  const cur = currency || "AED";
  const decimals = ["KWD", "BHD", "OMR"].includes(cur) ? 3 : 2;
  return `${cur} ${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

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

const stageBadge = (stage) => {
  const map = {
    NEW: "dg-badge-gray",
    ASSIGNED: "dg-badge-blue",
    CONTACTED: "dg-badge-blue",
    FOLLOW_UP: "dg-badge-amber",
    INTERESTED: "dg-badge-purple",
    DOCUMENTATION_PENDING: "dg-badge-amber",
    ONBOARDED: "dg-badge-green",
    ACTIVE: "dg-badge-green",
    LOST: "dg-badge-red",
  };
  return map[stage] || "dg-badge-gray";
};

const emptyForm = {
  name: "",
  leadCategory: "CUSTOMER",
  partnerType: "B2B",
  partnerSubType: "",
  contactPerson: "",
  email: "",
  phone: "",
  company: "",
  source: "Direct",
  campaign: "",
  region: "",
  territory: "",
  estimatedValue: "",
  assignedTo: "",
  nextFollowUpDate: "",
};

const DGLeads = () => {
  // The admin's selected dashboard currency. When it changes, we re-fetch so the
  // backend re-converts every amount into the newly selected currency.
  const activeCurrency = useSelector((s) => s.locale?.currency) || "AED";
  const money = (n) => formatMoney(n, activeCurrency);

  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState({});
  const [employees, setEmployees] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [stageForm, setStageForm] = useState({
    stage: "",
    note: "",
    nextFollowUpDate: "",
    lostReason: "",
  });
  const [assignForm, setAssignForm] = useState({ employeeId: "", note: "" });

  // ---- Bulk import ----
  const fileInputRef = useRef(null);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importCampaign, setImportCampaign] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await demandAPI.getLeads({
        search,
        leadCategory: categoryFilter,
        partnerType: partnerFilter,
        stage: stageFilter,
        assignedTo: assignedFilter,
        limit: 100,
      });
      setLeads(res.data.leads || []);
      setStages(res.data.stages || {});
    } catch (e) {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [
    search,
    categoryFilter,
    partnerFilter,
    stageFilter,
    assignedFilter,
    activeCurrency,
  ]);

  const fetchMeta = useCallback(async () => {
    try {
      const [emp, camp] = await Promise.all([
        // Only FIELD reps (Sales Representatives) can own a lead — finance
        // staff are excluded so they never appear as an assignable option.
        demandAPI.getEmployees({
          status: "ACTIVE",
          portalRole: "FIELD",
          limit: 200,
        }),
        demandAPI.getCampaigns(),
      ]);
      setEmployees(emp.data.employees || []);
      setCampaigns(camp.data.campaigns || camp.data || []);
    } catch (e) {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchLeads, 300);
    return () => clearTimeout(t);
  }, [fetchLeads]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  // Parse a chosen CSV/XLSX file into an array of row objects (header-keyed).
  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportSummary(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          raw: false,
        });
        if (!rows.length) {
          toast.error("The file appears to be empty.");
          return;
        }
        setImportRows(rows);
      } catch (err) {
        console.error("[v0] import parse error:", err);
        toast.error(
          "Could not read the file. Please upload a valid CSV or Excel file.",
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const openImport = () => {
    setImportRows([]);
    setImportFileName("");
    setImportCampaign("");
    setImportSummary(null);
    setShowImport(true);
  };

  const handleImportSubmit = async () => {
    if (!importRows.length) {
      toast.error("Please choose a file with at least one row.");
      return;
    }
    try {
      setImporting(true);
      const res = await demandAPI.bulkImportLeads({
        rows: importRows,
        campaign: importCampaign || null,
        source: "CSV Import",
      });
      setImportSummary(res.summary);
      toast.success(res.message || "Import complete");
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (lead) => {
    setEditing(lead);
    setForm({
      name: lead.name || "",
      leadCategory: lead.leadCategory || "CUSTOMER",
      partnerType: lead.partnerType || "B2B",
      partnerSubType: lead.partnerSubType || "",
      contactPerson: lead.contactPerson || "",
      email: lead.email || "",
      phone: lead.phone || "",
      company: lead.company || "",
      source: lead.source || "Direct",
      campaign: lead.campaign?._id || lead.campaign || "",
      region: lead.region || "",
      territory: lead.territory || "",
      estimatedValue: lead.estimatedValue || "",
      assignedTo: lead.assignedTo?._id || lead.assignedTo || "",
      nextFollowUpDate: lead.nextFollowUpDate
        ? lead.nextFollowUpDate.slice(0, 10)
        : "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Lead name is required");
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...form,
        campaign: form.campaign || null,
        assignedTo: form.assignedTo || null,
        partnerType: form.leadCategory === "PARTNER" ? form.partnerType : null,
      };
      if (editing) {
        await demandAPI.updateLead(editing._id, payload);
        toast.success("Lead updated");
      } else {
        await demandAPI.createLead(payload);
        toast.success("Lead created");
      }
      setShowModal(false);
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save lead");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (lead) => {
    try {
      const res = await demandAPI.getLead(lead._id);
      setDetail(res.data);
      setStageForm({
        stage: res.data.stage,
        note: "",
        nextFollowUpDate: "",
        lostReason: "",
      });
      setAssignForm({ employeeId: res.data.assignedTo?._id || "", note: "" });
      setShowDetail(true);
    } catch (e) {
      toast.error("Failed to load lead details");
    }
  };

  const handleStageUpdate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await demandAPI.updateLeadStage(detail._id, stageForm);
      toast.success(res.message || "Stage updated");
      if (res.commissionsCreated > 0) {
        toast.success(`${res.commissionsCreated} commission(s) auto-generated`);
      }
      const refreshed = await demandAPI.getLead(detail._id);
      setDetail(refreshed.data);
      setStageForm({
        stage: refreshed.data.stage,
        note: "",
        nextFollowUpDate: "",
        lostReason: "",
      });
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update stage");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await demandAPI.assignLead(detail._id, assignForm);
      toast.success("Assignment updated");
      const refreshed = await demandAPI.getLead(detail._id);
      setDetail(refreshed.data);
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (lead) => {
    if (!window.confirm(`Delete lead "${lead.name}"?`)) return;
    try {
      await demandAPI.deleteLead(lead._id);
      toast.success("Lead deleted");
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const catBadge = (lead) => {
    if (lead.leadCategory === "CUSTOMER")
      return <span className="dg-badge dg-badge-blue">Customer</span>;
    return (
      <span className="dg-badge dg-badge-purple">
        {lead.partnerType || "Partner"}
      </span>
    );
  };

  return (
    <div>
      <div className="dg-section-head">
        <div>
          <h2>Lead Management &amp; Workflow</h2>
          <p>
            Capture, assign and move customer &amp; partner leads through the
            acquisition lifecycle.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="dg-btn" onClick={openImport}>
            <FiUpload /> Import Leads
          </button>
          <button className="dg-btn dg-btn-primary" onClick={openCreate}>
            <FiPlus /> New Lead
          </button>
        </div>
      </div>

      {/* Stage summary chips */}
      <div className="dg-chip-row" style={{ marginBottom: 18 }}>
        {Object.keys(STAGE_LABELS).map((s) => (
          <span key={s} className={`dg-badge ${stageBadge(s)}`}>
            {STAGE_LABELS[s]}: {stages[s] || 0}
          </span>
        ))}
      </div>

      <div className="dg-filters">
        <div className="dg-search">
          <FiSearch />
          <input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="dg-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="CUSTOMER">Customer</option>
          <option value="PARTNER">Partner</option>
        </select>
        <select
          className="dg-select"
          value={partnerFilter}
          onChange={(e) => setPartnerFilter(e.target.value)}
        >
          <option value="">All Partner Types</option>
          <option value="B2B">B2B</option>
          <option value="B2C">B2C</option>
          <option value="CORPORATE">Corporate</option>
        </select>
        <select
          className="dg-select"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">All Stages</option>
          {Object.keys(STAGE_LABELS).map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="dg-select"
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
        >
          <option value="">All Employees</option>
          <option value="unassigned">Unassigned</option>
          {employees.map((emp) => (
            <option key={emp._id} value={emp._id}>
              {emp.fullName}
            </option>
          ))}
        </select>
        <button className="dg-btn" onClick={fetchLeads}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="dg-table-wrap">
        {loading ? (
          <div className="dg-loading">
            <div className="dg-spinner" />
            <p>Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="dg-empty">
            <FiTarget />
            <h3>No leads found</h3>
            <p>Create a lead or adjust your filters.</p>
          </div>
        ) : (
          <table className="dg-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Category</th>
                <th>Assigned To</th>
                <th>Stage</th>
                <th>Est. Value</th>
                <th>Next Follow-up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead._id} style={{ cursor: "pointer" }}>
                  <td onClick={() => openDetail(lead)}>
                    <div className="dg-cell-strong">{lead.name}</div>
                    <div className="dg-code">{lead.leadCode}</div>
                    {lead.company && (
                      <div className="dg-cell-muted">{lead.company}</div>
                    )}
                  </td>
                  <td onClick={() => openDetail(lead)}>{catBadge(lead)}</td>
                  <td onClick={() => openDetail(lead)}>
                    {lead.assignedTo ? (
                      lead.assignedTo.fullName
                    ) : (
                      <span className="dg-cell-muted">Unassigned</span>
                    )}
                  </td>
                  <td onClick={() => openDetail(lead)}>
                    <span className={`dg-badge ${stageBadge(lead.stage)}`}>
                      {STAGE_LABELS[lead.stage]}
                    </span>
                  </td>
                  <td onClick={() => openDetail(lead)}>
                    {money(lead.estimatedValue)}
                  </td>
                  <td onClick={() => openDetail(lead)}>
                    {lead.nextFollowUpDate
                      ? new Date(lead.nextFollowUpDate).toLocaleDateString()
                      : "-"}
                  </td>
                  <td>
                    <div className="dg-row-actions">
                      <button
                        className="dg-icon-btn"
                        title="Workflow"
                        onClick={() => openDetail(lead)}
                      >
                        <FiActivity />
                      </button>
                      <button
                        className="dg-icon-btn"
                        title="Edit"
                        onClick={() => openEdit(lead)}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="dg-icon-btn danger"
                        title="Delete"
                        onClick={() => handleDelete(lead)}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <div className="dg-modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="dg-modal dg-modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dg-modal-head">
              <h3>{editing ? "Edit Lead" : "New Lead"}</h3>
              <button
                className="dg-modal-close"
                onClick={() => setShowModal(false)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="dg-modal-body">
                <div className="dg-form-grid">
                  <div className="dg-field">
                    <label>Lead Category *</label>
                    <select
                      value={form.leadCategory}
                      onChange={(e) =>
                        setForm({ ...form, leadCategory: e.target.value })
                      }
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="PARTNER">Partner</option>
                    </select>
                  </div>
                  {form.leadCategory === "PARTNER" && (
                    <>
                      <div className="dg-field">
                        <label>Partner Type</label>
                        <select
                          value={form.partnerType}
                          onChange={(e) =>
                            setForm({ ...form, partnerType: e.target.value })
                          }
                        >
                          <option value="B2B">
                            B2B (Business/Institution)
                          </option>
                          <option value="B2C">
                            B2C (Retail/Agent/Reseller/Individual)
                          </option>
                          <option value="CORPORATE">
                            Corporate (Company account)
                          </option>
                        </select>
                      </div>
                      <div className="dg-field">
                        <label>Sub Type</label>
                        <input
                          placeholder={
                            form.partnerType === "B2B"
                              ? "Business / Institution"
                              : form.partnerType === "CORPORATE"
                                ? "Company / Institution"
                                : "Retail / Agent / Reseller"
                          }
                          value={form.partnerSubType}
                          onChange={(e) =>
                            setForm({ ...form, partnerSubType: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}
                  <div className="dg-field">
                    <label>Name *</label>
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Contact Person</label>
                    <input
                      value={form.contactPerson}
                      onChange={(e) =>
                        setForm({ ...form, contactPerson: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Phone</label>
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Company</label>
                    <input
                      value={form.company}
                      onChange={(e) =>
                        setForm({ ...form, company: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Source</label>
                    <input
                      value={form.source}
                      onChange={(e) =>
                        setForm({ ...form, source: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Campaign</label>
                    <select
                      value={form.campaign}
                      onChange={(e) =>
                        setForm({ ...form, campaign: e.target.value })
                      }
                    >
                      <option value="">None</option>
                      {campaigns.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="dg-field">
                    <label>Assign To</label>
                    <select
                      value={form.assignedTo}
                      onChange={(e) =>
                        setForm({ ...form, assignedTo: e.target.value })
                      }
                      disabled={!!editing}
                    >
                      <option value="">Unassigned</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.fullName}
                          {emp.region ? ` · ${emp.region}` : ""} ·{" "}
                          {emp.activeLeads ?? 0} active
                        </option>
                      ))}
                    </select>
                    <span className="dg-hint">
                      Only Field employees (Sales Representatives) can be
                      assigned leads.
                    </span>
                  </div>
                  <div className="dg-field">
                    <label>Region</label>
                    <input
                      value={form.region}
                      onChange={(e) =>
                        setForm({ ...form, region: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Territory</label>
                    <input
                      value={form.territory}
                      onChange={(e) =>
                        setForm({ ...form, territory: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Estimated Value ({activeCurrency})</label>
                    <input
                      type="number"
                      min="0"
                      value={form.estimatedValue}
                      onChange={(e) =>
                        setForm({ ...form, estimatedValue: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Next Follow-up Date</label>
                    <input
                      type="date"
                      value={form.nextFollowUpDate}
                      onChange={(e) =>
                        setForm({ ...form, nextFollowUpDate: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="dg-modal-foot">
                <button
                  type="button"
                  className="dg-btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dg-btn dg-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / workflow modal */}
      {showDetail && detail && (
        <div className="dg-modal-overlay" onClick={() => setShowDetail(false)}>
          <div
            className="dg-modal dg-modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dg-modal-head">
              <h3>
                {detail.name} <span className="dg-code">{detail.leadCode}</span>
              </h3>
              <button
                className="dg-modal-close"
                onClick={() => setShowDetail(false)}
              >
                <FiX />
              </button>
            </div>
            <div className="dg-modal-body">
              <div className="dg-chip-row" style={{ marginBottom: 16 }}>
                {catBadge(detail)}
                <span className={`dg-badge ${stageBadge(detail.stage)}`}>
                  {STAGE_LABELS[detail.stage]}
                </span>
                {detail.assignedTo && (
                  <span className="dg-badge dg-badge-gray">
                    {detail.assignedTo.fullName}
                  </span>
                )}
              </div>

              <div className="dg-grid-2">
                {/* Assignment */}
                <div className="dg-card">
                  <h3>
                    <FiUserCheck style={{ verticalAlign: "-2px" }} /> Assignment
                  </h3>
                  <form onSubmit={handleAssign}>
                    <div className="dg-field">
                      <label>Assign / Reassign to</label>
                      <select
                        value={assignForm.employeeId}
                        onChange={(e) =>
                          setAssignForm({
                            ...assignForm,
                            employeeId: e.target.value,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.fullName} ({emp.employeeCode})
                            {emp.region ? ` · ${emp.region}` : ""} ·{" "}
                            {emp.activeLeads ?? 0} active
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="dg-field" style={{ marginTop: 10 }}>
                      <label>Note</label>
                      <input
                        value={assignForm.note}
                        onChange={(e) =>
                          setAssignForm({ ...assignForm, note: e.target.value })
                        }
                      />
                    </div>
                    <button
                      type="submit"
                      className="dg-btn dg-btn-primary dg-btn-sm"
                      style={{ marginTop: 12 }}
                      disabled={submitting}
                    >
                      Update Assignment
                    </button>
                  </form>
                </div>

                {/* Stage update */}
                <div className="dg-card">
                  <h3>
                    <FiTrendingUp style={{ verticalAlign: "-2px" }} /> Move
                    Stage
                  </h3>
                  <form onSubmit={handleStageUpdate}>
                    <div className="dg-field">
                      <label>Stage</label>
                      <select
                        value={stageForm.stage}
                        onChange={(e) =>
                          setStageForm({ ...stageForm, stage: e.target.value })
                        }
                      >
                        {Object.keys(STAGE_LABELS).map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="dg-field" style={{ marginTop: 10 }}>
                      <label>Comment / Note</label>
                      <textarea
                        value={stageForm.note}
                        onChange={(e) =>
                          setStageForm({ ...stageForm, note: e.target.value })
                        }
                      />
                    </div>
                    {stageForm.stage === "LOST" && (
                      <div className="dg-field" style={{ marginTop: 10 }}>
                        <label>Lost Reason</label>
                        <input
                          value={stageForm.lostReason}
                          onChange={(e) =>
                            setStageForm({
                              ...stageForm,
                              lostReason: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}
                    <div className="dg-field" style={{ marginTop: 10 }}>
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
                      className="dg-btn dg-btn-primary dg-btn-sm"
                      style={{ marginTop: 12 }}
                      disabled={submitting}
                    >
                      Save Stage
                    </button>
                    {["ONBOARDED"].includes(stageForm.stage) &&
                      !detail.commissionGenerated && (
                        <p className="dg-hint">
                          Moving to Onboarded will auto-generate commissions
                          from active rules.
                        </p>
                      )}
                  </form>
                </div>
              </div>

              {/* Activity timeline */}
              <div className="dg-card" style={{ marginTop: 20 }}>
                <h3>
                  <FiActivity style={{ verticalAlign: "-2px" }} /> Activity
                  Timeline
                </h3>
                <div className="dg-timeline">
                  {[...(detail.activities || [])].reverse().map((a, i) => (
                    <div className="dg-tl-item" key={i}>
                      <div className="dg-tl-dot" />
                      <div className="dg-tl-body">
                        <div className="dg-tl-stage">
                          {STAGE_LABELS[a.stage] || a.stage}
                        </div>
                        <div className="dg-tl-meta">
                          {new Date(a.createdAt).toLocaleString()}
                          {a.employee?.fullName
                            ? ` • ${a.employee.fullName}`
                            : ""}
                          {a.nextFollowUpDate
                            ? ` • Next: ${new Date(a.nextFollowUpDate).toLocaleDateString()}`
                            : ""}
                        </div>
                        {a.note && <div className="dg-tl-note">{a.note}</div>}
                      </div>
                    </div>
                  ))}
                  {(detail.activities || []).length === 0 && (
                    <p className="dg-cell-muted">No activity yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Bulk import modal ===== */}
      {showImport && (
        <div className="dg-modal-overlay" onClick={() => setShowImport(false)}>
          <div
            className="dg-modal dg-modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dg-modal-head">
              <h3>Import Leads (CSV / Excel)</h3>
              <button
                className="dg-modal-close"
                onClick={() => setShowImport(false)}
              >
                <FiX />
              </button>
            </div>
            <div className="dg-modal-body">
              <p className="dg-cell-muted" style={{ marginBottom: 12 }}>
                Upload a CSV or Excel file. Recognized columns:{" "}
                <code>name</code>, <code>phone</code>, <code>email</code>,{" "}
                <code>company</code>, <code>category</code> (Customer/Partner),{" "}
                <code>region</code>, <code>message</code>. Duplicate phone/email
                leads are merged, not re-created.
              </p>

              <div className="dg-field">
                <label>Attribute imported leads to campaign (optional)</label>
                <select
                  value={importCampaign}
                  onChange={(e) => setImportCampaign(e.target.value)}
                >
                  <option value="">No campaign</option>
                  {campaigns.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dg-field">
                <label>File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFilePicked}
                />
                {importFileName && (
                  <span className="dg-cell-muted" style={{ marginTop: 6 }}>
                    {importFileName} — {importRows.length} row(s) detected
                  </span>
                )}
              </div>

              {importRows.length > 0 && (
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table className="dg-table">
                    <thead>
                      <tr>
                        {Object.keys(importRows[0])
                          .slice(0, 6)
                          .map((k) => (
                            <th key={k}>{k}</th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          {Object.keys(importRows[0])
                            .slice(0, 6)
                            .map((k) => (
                              <td key={k}>{String(r[k] ?? "")}</td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importRows.length > 5 && (
                    <p className="dg-cell-muted" style={{ marginTop: 6 }}>
                      Showing first 5 of {importRows.length} rows.
                    </p>
                  )}
                </div>
              )}

              {importSummary && (
                <div className="dg-card" style={{ marginTop: 16 }}>
                  <h3>Import result</h3>
                  <div className="dg-chip-row">
                    <span className="dg-badge dg-badge-green">
                      Created: {importSummary.created}
                    </span>
                    <span className="dg-badge dg-badge-amber">
                      Duplicates merged: {importSummary.duplicates}
                    </span>
                    <span className="dg-badge dg-badge-red">
                      Skipped: {importSummary.skipped}
                    </span>
                  </div>
                  {importSummary.errors?.length > 0 && (
                    <ul
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        color: "#b91c1c",
                        maxHeight: 140,
                        overflowY: "auto",
                      }}
                    >
                      {importSummary.errors.slice(0, 20).map((er, i) => (
                        <li key={i}>
                          Row {er.row}: {er.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="dg-modal-foot">
              <button
                type="button"
                className="dg-btn"
                onClick={() => setShowImport(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="dg-btn dg-btn-primary"
                disabled={importing || importRows.length === 0}
                onClick={handleImportSubmit}
              >
                {importing
                  ? "Importing…"
                  : `Import ${importRows.length || ""} lead(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DGLeads;
