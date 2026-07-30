import React, { useState, useEffect, useCallback } from "react";
import {
  FiFlag,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiX,
  FiLink,
  FiCopy,
  FiRefreshCcw,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";
import * as demandAPI from "../../../services/demandAPI";

const emptyForm = {
  name: "",
  description: "",
  channel: "DIGITAL",
  target: "ALL",
  budget: "",
  incentivePerOnboarding: "",
  targetOnboardings: "",
  region: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  status: "DRAFT",
  autoAssignEnabled: false,
  autoAssignStrategy: "ROUND_ROBIN",
};

const copyToClipboard = async (text, label = "Copied") => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} to clipboard`);
  } catch {
    toast.error("Could not copy. Please copy manually.");
  }
};

const statusBadge = (s) =>
  ({
    DRAFT: "dg-badge-gray",
    ACTIVE: "dg-badge-green",
    PAUSED: "dg-badge-amber",
    COMPLETED: "dg-badge-blue",
  })[s] || "dg-badge-gray";

const DGCampaigns = () => {
  const activeCurrency = useSelector((s) => s.locale?.currency) || "AED";
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [rotating, setRotating] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await demandAPI.getCampaigns();
      setCampaigns(res.data || []);
    } catch (e) {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [activeCurrency]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || "",
      description: c.description || "",
      channel: c.channel || "DIGITAL",
      target: c.target || "ALL",
      budget: c.budget || "",
      incentivePerOnboarding: c.incentivePerOnboarding || "",
      targetOnboardings: c.targetOnboardings || "",
      region: c.region || "",
      startDate: c.startDate ? c.startDate.slice(0, 10) : "",
      endDate: c.endDate ? c.endDate.slice(0, 10) : "",
      status: c.status || "DRAFT",
      autoAssignEnabled: c.autoAssign?.enabled || false,
      autoAssignStrategy: c.autoAssign?.strategy || "ROUND_ROBIN",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    try {
      setSubmitting(true);
      const { autoAssignEnabled, autoAssignStrategy, ...rest } = form;
      const payload = {
        ...rest,
        endDate: form.endDate || null,
        autoAssign: {
          enabled: autoAssignEnabled,
          strategy: autoAssignStrategy,
        },
      };
      if (editing) {
        await demandAPI.updateCampaign(editing._id, payload);
        toast.success("Campaign updated");
      } else {
        await demandAPI.createCampaign(payload);
        toast.success("Campaign created");
      }
      setShowModal(false);
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save campaign");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete campaign "${c.name}"? Leads will be detached.`))
      return;
    try {
      await demandAPI.deleteCampaign(c._id);
      toast.success("Campaign deleted");
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const handleRotateSecret = async () => {
    if (!tracking) return;
    if (
      !window.confirm(
        "Rotate the webhook secret? The old token will stop working immediately.",
      )
    )
      return;
    try {
      setRotating(true);
      const res = await demandAPI.rotateCampaignSecret(tracking._id);
      const newSecret = res.data?.webhookSecret;
      setTracking((t) => ({ ...t, webhookSecret: newSecret }));
      // Reflect the change in the underlying list too.
      setCampaigns((list) =>
        list.map((c) =>
          c._id === tracking._id ? { ...c, webhookSecret: newSecret } : c,
        ),
      );
      toast.success("Webhook secret rotated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to rotate secret");
    } finally {
      setRotating(false);
    }
  };

  const money = (n) => {
    const decimals = ["KWD", "BHD", "OMR"].includes(activeCurrency) ? 3 : 2;
    return `${activeCurrency} ${Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  return (
    <div>
      <div className="dg-section-head">
        <div>
          <h2>Campaign Management</h2>
          <p>
            Group and attribute leads to acquisition campaigns and measure ROI.
          </p>
        </div>
        <button className="dg-btn dg-btn-primary" onClick={openCreate}>
          <FiPlus /> New Campaign
        </button>
      </div>

      <div className="dg-filters">
        <button className="dg-btn" onClick={fetchCampaigns}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="dg-table-wrap">
        {loading ? (
          <div className="dg-loading">
            <div className="dg-spinner" />
            <p>Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="dg-empty">
            <FiFlag />
            <h3>No campaigns yet</h3>
            <p>Create a campaign to start attributing leads.</p>
          </div>
        ) : (
          <table className="dg-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Target</th>
                <th>Budget</th>
                <th>Leads</th>
                <th>Onboarded</th>
                <th>Conv. %</th>
                <th>Cost / Onboarding</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c._id}>
                  <td>
                    <div className="dg-cell-strong">{c.name}</div>
                    {c.region && (
                      <div className="dg-cell-muted">{c.region}</div>
                    )}
                  </td>
                  <td>{c.channel}</td>
                  <td>
                    <span className="dg-badge dg-badge-gray">{c.target}</span>
                  </td>
                  <td>{money(c.budget)}</td>
                  <td>{c.totalLeads ?? 0}</td>
                  <td>{c.onboarded ?? 0}</td>
                  <td>{c.conversionRate ?? 0}%</td>
                  <td>{money(c.costPerOnboarding)}</td>
                  <td>
                    <span className={`dg-badge ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <div className="dg-row-actions">
                      <button
                        className="dg-icon-btn"
                        title="Tracking link & QR"
                        onClick={() => setTracking(c)}
                      >
                        <FiLink />
                        {c.autoAssign?.enabled && (
                          <span className="dg-dot" title="Auto-assign on" />
                        )}
                      </button>
                      <button
                        className="dg-icon-btn"
                        title="Edit"
                        onClick={() => openEdit(c)}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="dg-icon-btn danger"
                        title="Delete"
                        onClick={() => handleDelete(c)}
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

      {showModal && (
        <div className="dg-modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="dg-modal dg-modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dg-modal-head">
              <h3>{editing ? "Edit Campaign" : "New Campaign"}</h3>
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
                  <div className="dg-field full">
                    <label>Name *</label>
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field full">
                    <label>Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Channel</label>
                    <select
                      value={form.channel}
                      onChange={(e) =>
                        setForm({ ...form, channel: e.target.value })
                      }
                    >
                      <option value="DIGITAL">Digital</option>
                      <option value="FIELD">Field</option>
                      <option value="REFERRAL">Referral</option>
                      <option value="TELECALLING">Telecalling</option>
                      <option value="EVENT">Event</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="dg-field">
                    <label>Target</label>
                    <select
                      value={form.target}
                      onChange={(e) =>
                        setForm({ ...form, target: e.target.value })
                      }
                    >
                      <option value="ALL">All</option>
                      <option value="CUSTOMER">Customer</option>
                      <option value="B2B_PARTNER">B2B Partner</option>
                      <option value="B2C_PARTNER">B2C Partner</option>
                      <option value="CORPORATE">Corporate</option>
                    </select>
                  </div>
                  <div className="dg-field">
                    <label>Budget ({activeCurrency})</label>
                    <input
                      type="number"
                      min="0"
                      value={form.budget}
                      onChange={(e) =>
                        setForm({ ...form, budget: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Incentive / Onboarding ({activeCurrency})</label>
                    <input
                      type="number"
                      min="0"
                      value={form.incentivePerOnboarding}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          incentivePerOnboarding: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Target Onboardings</label>
                    <input
                      type="number"
                      min="0"
                      value={form.targetOnboardings}
                      onChange={(e) =>
                        setForm({ ...form, targetOnboardings: e.target.value })
                      }
                    />
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
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) =>
                        setForm({ ...form, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm({ ...form, endDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Status</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="PAUSED">Paused</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>

                  <div className="dg-field full">
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        style={{ width: "auto" }}
                        checked={form.autoAssignEnabled}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            autoAssignEnabled: e.target.checked,
                          })
                        }
                      />
                      <FiUsers /> Auto-assign incoming leads to a field employee
                    </label>
                  </div>
                  {form.autoAssignEnabled && (
                    <div className="dg-field">
                      <label>Assignment strategy</label>
                      <select
                        value={form.autoAssignStrategy}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            autoAssignStrategy: e.target.value,
                          })
                        }
                      >
                        <option value="ROUND_ROBIN">
                          Round-robin (even distribution)
                        </option>
                        <option value="REGION">
                          By region (fallback to round-robin)
                        </option>
                      </select>
                    </div>
                  )}
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

      {tracking && (
        <div className="dg-modal-overlay" onClick={() => setTracking(null)}>
          <div className="dg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dg-modal-head">
              <h3>Tracking &amp; Intake</h3>
              <button
                className="dg-modal-close"
                onClick={() => setTracking(null)}
              >
                <FiX />
              </button>
            </div>
            <div className="dg-modal-body">
              <div className="dg-cell-strong" style={{ marginBottom: 4 }}>
                {tracking.name}
              </div>
              <div className="dg-cell-muted" style={{ marginBottom: 16 }}>
                Auto-assign:{" "}
                {tracking.autoAssign?.enabled
                  ? `On (${tracking.autoAssign.strategy === "REGION" ? "By region" : "Round-robin"})`
                  : "Off"}
              </div>

              {/* Public enquiry link */}
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Public enquiry link
              </label>
              <div style={{ display: "flex", gap: 8, margin: "6px 0 8px" }}>
                <input
                  readOnly
                  value={tracking.publicUrl || ""}
                  style={{ flex: 1 }}
                />
                <button
                  className="dg-btn"
                  type="button"
                  onClick={() =>
                    copyToClipboard(tracking.publicUrl, "Link copied")
                  }
                >
                  <FiCopy /> Copy
                </button>
                <a
                  className="dg-btn"
                  href={tracking.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              </div>

              {/* QR code */}
              {tracking.qrCode && (
                <div style={{ textAlign: "center", margin: "12px 0 16px" }}>
                  <img
                    src={tracking.qrCode || "/placeholder.svg"}
                    alt={`QR code for ${tracking.name} enquiry form`}
                    width={180}
                    height={180}
                    style={{
                      borderRadius: 8,
                      border: "1px solid var(--dg-border, #e5e7eb)",
                    }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <a
                      className="dg-btn"
                      href={tracking.qrCode}
                      download={`${tracking.slug || "campaign"}-qr.png`}
                    >
                      Download QR
                    </a>
                  </div>
                </div>
              )}

              {/* Webhook intake */}
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Webhook URL (Meta / Google Lead Ads / Zapier)
              </label>
              <div style={{ display: "flex", gap: 8, margin: "6px 0 8px" }}>
                <input
                  readOnly
                  value={tracking.webhookUrl || ""}
                  style={{ flex: 1 }}
                />
                <button
                  className="dg-btn"
                  type="button"
                  onClick={() =>
                    copyToClipboard(tracking.webhookUrl, "Webhook URL copied")
                  }
                >
                  <FiCopy /> Copy
                </button>
              </div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Webhook secret (send as Bearer token)
              </label>
              <div style={{ display: "flex", gap: 8, margin: "6px 0 4px" }}>
                <input
                  readOnly
                  value={tracking.webhookSecret || ""}
                  style={{ flex: 1, fontFamily: "monospace" }}
                />
                <button
                  className="dg-btn"
                  type="button"
                  onClick={() =>
                    copyToClipboard(tracking.webhookSecret, "Secret copied")
                  }
                >
                  <FiCopy /> Copy
                </button>
                <button
                  className="dg-btn danger"
                  type="button"
                  disabled={rotating}
                  onClick={handleRotateSecret}
                >
                  <FiRefreshCcw /> {rotating ? "..." : "Rotate"}
                </button>
              </div>
              <p
                className="dg-cell-muted"
                style={{ fontSize: 12, marginTop: 8 }}
              >
                External sources should POST JSON (name, phone, email, category,
                message) to the webhook URL with header{" "}
                <code>Authorization: Bearer &lt;secret&gt;</code>. Leads are
                auto-attributed to this campaign.
              </p>
            </div>
            <div className="dg-modal-foot">
              <button
                type="button"
                className="dg-btn dg-btn-primary"
                onClick={() => setTracking(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DGCampaigns;
