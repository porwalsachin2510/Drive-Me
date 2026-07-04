import React, { useState, useEffect, useCallback } from "react";
import {
  Save,
  Plus,
  Trash2,
  Clock,
  Percent,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Info,
  Banknote,
} from "lucide-react";
import {
  getCancellationSettings,
  updateCancellationSettings,
  getCashCancellationDues,
  resolveCashCancellationDue,
} from "../../../services/adminAPI";
import "./AdminCancellationSettings.css";

const emptyTier = { label: "", minHoursBeforeTravel: 0, chargePercentage: 0 };

const AdminCancellationSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    freeWindowHoursAfterBooking: 12,
    isActive: true,
    tiers: [],
    notes: "",
    cashPenaltyActive: true,
    blockBookingUntilDueCleared: true,
  });

  // Cash cancellation dues (identity-anchored receivables)
  const [dues, setDues] = useState([]);
  const [duesTotals, setDuesTotals] = useState(null);
  const [duesLoading, setDuesLoading] = useState(false);
  const [duesSearch, setDuesSearch] = useState("");
  const [resolvingId, setResolvingId] = useState(null);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 4000);
  };

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCancellationSettings();
      if (res.success && res.settings) {
        setForm({
          freeWindowHoursAfterBooking:
            res.settings.freeWindowHoursAfterBooking ?? 12,
          isActive: res.settings.isActive !== false,
          tiers: (res.settings.tiers || []).map((t) => ({
            label: t.label || "",
            minHoursBeforeTravel: t.minHoursBeforeTravel ?? 0,
            chargePercentage: t.chargePercentage ?? 0,
          })),
          notes: res.settings.notes || "",
          cashPenaltyActive: res.settings.cashPenaltyActive !== false,
          blockBookingUntilDueCleared:
            res.settings.blockBookingUntilDueCleared !== false,
        });
      }
    } catch (err) {
      console.error("[v0] Error loading cancellation settings:", err);
      showMessage("error", "Failed to load cancellation settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDues = useCallback(async () => {
    try {
      setDuesLoading(true);
      const res = await getCashCancellationDues({
        status: "outstanding",
        search: duesSearch.trim(),
      });
      if (res.success) {
        setDues(res.dues || []);
        setDuesTotals(res.totals || null);
      }
    } catch (err) {
      console.error("[v0] Error loading cash dues:", err);
    } finally {
      setDuesLoading(false);
    }
  }, [duesSearch]);

  useEffect(() => {
    loadSettings();
    loadDues();
  }, [loadSettings, loadDues]);

  const handleResolveDue = async (ledgerId, resolution) => {
    const confirmText =
      resolution === "WAIVED"
        ? "Waive this outstanding due? The commuter will be able to book again without paying."
        : "Mark this due as settled (cash collected)? The commuter will be able to book again.";
    if (!window.confirm(confirmText)) return;
    try {
      setResolvingId(ledgerId);
      const res = await resolveCashCancellationDue(ledgerId, {
        resolution,
        liftCashDisabled: resolution === "SETTLED",
      });
      if (res.success) {
        showMessage("success", res.message || "Due resolved successfully");
        await loadDues();
      }
    } catch (err) {
      console.error("[v0] Error resolving due:", err);
      showMessage(
        "error",
        err.response?.data?.message || "Failed to resolve due",
      );
    } finally {
      setResolvingId(null);
    }
  };

  const handleTierChange = (index, field, value) => {
    setForm((prev) => {
      const tiers = [...prev.tiers];
      tiers[index] = {
        ...tiers[index],
        [field]: field === "label" ? value : value === "" ? "" : Number(value),
      };
      return { ...prev, tiers };
    });
  };

  const addTier = () => {
    setForm((prev) => ({ ...prev, tiers: [...prev.tiers, { ...emptyTier }] }));
  };

  const removeTier = (index) => {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    if (
      form.freeWindowHoursAfterBooking === "" ||
      Number(form.freeWindowHoursAfterBooking) < 0
    ) {
      showMessage("error", "Free window hours must be 0 or more");
      return false;
    }
    if (form.tiers.length === 0) {
      showMessage("error", "Add at least one charge tier");
      return false;
    }
    for (const t of form.tiers) {
      if (!t.label.trim()) {
        showMessage("error", "Every tier needs a label");
        return false;
      }
      if (t.minHoursBeforeTravel === "" || Number(t.minHoursBeforeTravel) < 0) {
        showMessage("error", `Invalid hours for tier "${t.label}"`);
        return false;
      }
      if (
        t.chargePercentage === "" ||
        Number(t.chargePercentage) < 0 ||
        Number(t.chargePercentage) > 100
      ) {
        showMessage("error", `Charge % for "${t.label}" must be 0-100`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        freeWindowHoursAfterBooking: Number(form.freeWindowHoursAfterBooking),
        isActive: form.isActive,
        notes: form.notes,
        tiers: form.tiers.map((t) => ({
          label: t.label.trim(),
          minHoursBeforeTravel: Number(t.minHoursBeforeTravel),
          chargePercentage: Number(t.chargePercentage),
        })),
        cashPenaltyActive: form.cashPenaltyActive,
        blockBookingUntilDueCleared: form.blockBookingUntilDueCleared,
      };
      const res = await updateCancellationSettings(payload);
      if (res.success) {
        showMessage("success", "Cancellation policy saved successfully");
        await loadSettings();
      }
    } catch (err) {
      console.error("[v0] Error saving cancellation settings:", err);
      showMessage(
        "error",
        err.response?.data?.message || "Failed to save cancellation policy",
      );
    } finally {
      setSaving(false);
    }
  };

  // Sorted preview for display (highest hours first)
  const sortedTiers = [...form.tiers].sort(
    (a, b) => Number(b.minHoursBeforeTravel) - Number(a.minHoursBeforeTravel),
  );

  if (loading) {
    return (
      <div className="acs-loading">
        <RefreshCw className="acs-spin" size={28} />
        <p>Loading cancellation policy...</p>
      </div>
    );
  }

  return (
    <div className="acs-container">
      <div className="acs-header">
        <div>
          <h2>Cancellation Policy</h2>
          <p className="acs-subtitle">
            Configure the cancellation charges commuters pay based on how far in
            advance they cancel. These rules apply automatically to every
            booking cancellation.
          </p>
        </div>
        <button className="acs-save-btn" onClick={handleSave} disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save Policy"}
        </button>
      </div>

      {message.text && (
        <div className={`acs-alert acs-alert-${message.type}`}>
          {message.type === "success" ? (
            <CheckCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Master switch + free window */}
      <div className="acs-card">
        <div className="acs-row">
          <div className="acs-field">
            <label className="acs-label">
              <Clock size={15} /> Free Cancellation Window (hours after booking)
            </label>
            <input
              type="number"
              min="0"
              className="acs-input"
              value={form.freeWindowHoursAfterBooking}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  freeWindowHoursAfterBooking:
                    e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
            />
            <span className="acs-hint">
              If a commuter cancels within this many hours of booking, no fee is
              charged.
            </span>
          </div>

          <div className="acs-field">
            <label className="acs-label">Policy Status</label>
            <button
              type="button"
              className={`acs-toggle ${form.isActive ? "on" : "off"}`}
              onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
            >
              <span className="acs-toggle-dot" />
              {form.isActive ? "Active" : "Disabled (no fees charged)"}
            </button>
            <span className="acs-hint">
              When disabled, cancellations are always fully refunded.
            </span>
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className="acs-card">
        <div className="acs-card-head">
          <h3>
            <Percent size={16} /> Time-Based Charge Tiers
          </h3>
          <button className="acs-add-btn" onClick={addTier}>
            <Plus size={15} /> Add Tier
          </button>
        </div>

        <div className="acs-info-box">
          <Info size={15} />
          <span>
            Each tier applies when the hours remaining until travel are at least
            the value you set. The tier with the highest matching threshold is
            used. Set a tier with 0 hours to cover last-minute cancellations.
          </span>
        </div>

        {form.tiers.length === 0 ? (
          <p className="acs-empty">No tiers yet. Add one to get started.</p>
        ) : (
          <div className="acs-tiers">
            <div className="acs-tier-header">
              <span>Label</span>
              <span>Hours before travel (min)</span>
              <span>Charge %</span>
              <span></span>
            </div>
            {form.tiers.map((tier, index) => (
              <div className="acs-tier-row" key={index}>
                <input
                  type="text"
                  className="acs-input"
                  placeholder="e.g. Less than 24 hours before travel"
                  value={tier.label}
                  onChange={(e) =>
                    handleTierChange(index, "label", e.target.value)
                  }
                />
                <input
                  type="number"
                  min="0"
                  className="acs-input"
                  value={tier.minHoursBeforeTravel}
                  onChange={(e) =>
                    handleTierChange(
                      index,
                      "minHoursBeforeTravel",
                      e.target.value,
                    )
                  }
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="acs-input"
                  value={tier.chargePercentage}
                  onChange={(e) =>
                    handleTierChange(index, "chargePercentage", e.target.value)
                  }
                />
                <button
                  className="acs-remove-btn"
                  onClick={() => removeTier(index)}
                  title="Remove tier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live policy summary */}
      <div className="acs-card">
        <h3 className="acs-summary-title">Policy Summary (commuter view)</h3>
        <ul className="acs-summary">
          <li>
            <strong>Free</strong> if cancelled within{" "}
            <strong>{form.freeWindowHoursAfterBooking || 0} hours</strong> of
            booking.
          </li>
          {sortedTiers.map((t, i) => {
            const next = sortedTiers[i + 1];
            const upper = t.minHoursBeforeTravel;
            const range = next
              ? `${next.minHoursBeforeTravel}–${upper}h before travel`
              : `${upper}h or more before travel`;
            const lastTierRange =
              i === sortedTiers.length - 1 && upper === 0
                ? "Less than the next threshold before travel"
                : range;
            return (
              <li key={i}>
                <strong>{t.chargePercentage}%</strong> charge — {t.label}{" "}
                <span className="acs-range">({lastTierRange})</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Cash cancellation policy */}
      <div className="acs-card">
        <div className="acs-card-head">
          <h3>
            <Banknote size={16} /> Cash Cancellation Policy
          </h3>
        </div>
        <div className="acs-info-box">
          <Info size={15} />
          <span>
            For CASH bookings cancelled before the trip the commuter has paid
            nothing, so no fee can be deducted. Instead the fee (computed from
            the tiers above on the full fare) is recorded as an outstanding due
            against the commuter&apos;s registration identity (phone/email). The
            free window and tiers still apply, so an early cancel can still be
            free.
          </span>
        </div>

        <div className="acs-row">
          <div className="acs-field">
            <label className="acs-label">Cash Penalty Status</label>
            <button
              type="button"
              className={`acs-toggle ${form.cashPenaltyActive ? "on" : "off"}`}
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  cashPenaltyActive: !p.cashPenaltyActive,
                }))
              }
            >
              <span className="acs-toggle-dot" />
              {form.cashPenaltyActive
                ? "Active"
                : "Disabled (cash cancels are free)"}
            </button>
            <span className="acs-hint">
              When disabled, cash cancellations never record a due. There is no
              limit on how many times a commuter can cancel — each penalized
              cancellation simply adds to their outstanding due.
            </span>
          </div>
        </div>

        <div className="acs-row">
          <div className="acs-field">
            <label className="acs-label">
              Block new bookings until cleared
            </label>
            <button
              type="button"
              className={`acs-toggle ${form.blockBookingUntilDueCleared ? "on" : "off"}`}
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  blockBookingUntilDueCleared: !p.blockBookingUntilDueCleared,
                }))
              }
            >
              <span className="acs-toggle-dot" />
              {form.blockBookingUntilDueCleared ? "Enabled" : "Disabled"}
            </button>
            <span className="acs-hint">
              When enabled, a commuter with an unpaid cash due cannot make any
              new booking (across any account sharing the same registration
              identity) until it is cleared.
            </span>
          </div>
        </div>
      </div>

      {/* Outstanding cash dues */}
      <div className="acs-card">
        <div className="acs-card-head">
          <h3>
            <Banknote size={16} /> Outstanding Cash Cancellation Dues
          </h3>
          <button
            className="acs-add-btn"
            onClick={loadDues}
            disabled={duesLoading}
          >
            <RefreshCw size={15} className={duesLoading ? "acs-spin" : ""} />{" "}
            Refresh
          </button>
        </div>

        {duesTotals && (
          <div className="acs-dues-summary">
            <div className="acs-dues-stat">
              <span className="acs-dues-stat-value">
                {duesTotals.totalOutstanding}
              </span>
              <span className="acs-dues-stat-label">
                Total Outstanding (KWD)
              </span>
            </div>
            <div className="acs-dues-stat">
              <span className="acs-dues-stat-value">{dues.length}</span>
              <span className="acs-dues-stat-label">Commuters with dues</span>
            </div>
            <div className="acs-dues-stat">
              <span className="acs-dues-stat-value">
                {duesTotals.blockedCount}
              </span>
              <span className="acs-dues-stat-label">Blocked</span>
            </div>
          </div>
        )}

        <div className="acs-dues-search">
          <input
            type="text"
            className="acs-input"
            placeholder="Search by name, email, or phone..."
            value={duesSearch}
            onChange={(e) => setDuesSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadDues();
            }}
          />
          <button className="acs-add-btn" onClick={loadDues}>
            Search
          </button>
        </div>

        {duesLoading ? (
          <p className="acs-empty">Loading dues...</p>
        ) : dues.length === 0 ? (
          <p className="acs-empty">No outstanding cash cancellation dues.</p>
        ) : (
          <div className="acs-dues-table">
            <div className="acs-dues-row acs-dues-row-head">
              <span>Commuter</span>
              <span>Outstanding</span>
              <span>Cancellations</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {dues.map((d) => (
              <div className="acs-dues-row" key={d._id}>
                <span>
                  <strong>{d.lastKnownName || "Unknown"}</strong>
                  <br />
                  <small>{d.lastKnownEmail || d.lastKnownPhone || "—"}</small>
                </span>
                <span className="acs-dues-amount">
                  {d.currency || "KWD"} {Number(d.totalOutstanding).toFixed(2)}
                </span>
                <span>{d.strikeCount || 0}</span>
                <span>
                  {d.isBlocked ? (
                    <span className="acs-badge acs-badge-warn">Blocked</span>
                  ) : (
                    <span className="acs-badge">Due only</span>
                  )}
                </span>
                <span className="acs-dues-actions">
                  <button
                    className="acs-dues-btn acs-dues-btn-settle"
                    disabled={resolvingId === d._id}
                    onClick={() => handleResolveDue(d._id, "SETTLED")}
                  >
                    Mark Paid
                  </button>
                  <button
                    className="acs-dues-btn acs-dues-btn-waive"
                    disabled={resolvingId === d._id}
                    onClick={() => handleResolveDue(d._id, "WAIVED")}
                  >
                    Waive
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="acs-card">
        <label className="acs-label">Internal Notes (optional)</label>
        <textarea
          className="acs-textarea"
          rows={3}
          placeholder="Add any internal context about this policy..."
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
      </div>
    </div>
  );
};

export default AdminCancellationSettings;
