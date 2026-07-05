"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getBillingConfig,
  updateBillingConfig,
  previewOperationalInvoice,
  generateOperationalInvoice,
  listOperationalInvoices,
} from "../../../services/managedServiceAPI";
import "./managedbilling.css";

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

const MODEL_OPTIONS = [
  { value: "PER_TRIP", label: "Per trip" },
  { value: "PER_SEAT", label: "Per seat (per trip)" },
  { value: "PER_KM", label: "Per kilometre" },
  { value: "FIXED_MONTHLY", label: "Fixed monthly" },
];

const money = (v, cur = "AED") =>
  `${cur} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ManagedBilling({ contractId, mode = "corporate" }) {
  const isCorporate = mode === "corporate";
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [config, setConfig] = useState(null);
  const [currency, setCurrency] = useState("AED");
  const [preview, setPreview] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editCfg, setEditCfg] = useState(false);
  const [cfgForm, setCfgForm] = useState(null);
  const [savingCfg, setSavingCfg] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cfgRes, invRes] = await Promise.all([
        getBillingConfig(contractId),
        listOperationalInvoices(contractId),
      ]);
      if (cfgRes.data.success) {
        setConfig(cfgRes.data.data.operationBilling || {});
        setCurrency(cfgRes.data.data.currency || "AED");
      }
      if (invRes.data.success) setInvoices(invRes.data.data.invoices || []);
    } catch (err) {
      console.error("[v0] Failed to load billing data:", err);
      showToast("Failed to load billing data", "error");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    load();
  }, [load]);

  const runPreview = useCallback(async () => {
    try {
      setPreviewing(true);
      const res = await previewOperationalInvoice(contractId, { month, year });
      if (res.data.success) setPreview(res.data.data.preview);
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to preview invoice",
        "error",
      );
    } finally {
      setPreviewing(false);
    }
  }, [contractId, month, year]);

  useEffect(() => {
    if (config?.enabled) runPreview();
  }, [config?.enabled, runPreview]);

  const openEdit = () => {
    setCfgForm({
      enabled: config?.enabled ?? false,
      model: config?.model ?? "PER_TRIP",
      ratePerTrip: config?.ratePerTrip ?? 0,
      ratePerSeat: config?.ratePerSeat ?? 0,
      ratePerKm: config?.ratePerKm ?? 0,
      fixedMonthlyAmount: config?.fixedMonthlyAmount ?? 0,
      managementFeeType: config?.managementFeeType ?? "PERCENT",
      managementFeeValue: config?.managementFeeValue ?? 0,
      taxRatePct: config?.taxRatePct ?? 0,
      billingDay: config?.billingDay ?? 7,
    });
    setEditCfg(true);
  };

  const saveCfg = async () => {
    try {
      setSavingCfg(true);
      const res = await updateBillingConfig(contractId, cfgForm);
      if (res.data.success) {
        setConfig(res.data.data.operationBilling);
        setEditCfg(false);
        showToast("Billing configuration saved");
        load();
        runPreview();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to save configuration",
        "error",
      );
    } finally {
      setSavingCfg(false);
    }
  };

  const generate = async () => {
    if (
      !window.confirm(
        `Generate the operational invoice for ${MONTHS[month - 1]} ${year}?`,
      )
    )
      return;
    try {
      setGenerating(true);
      const res = await generateOperationalInvoice(contractId, { month, year });
      if (res.data.success) {
        showToast("Operational invoice generated");
        load();
        setPreview(null);
        runPreview();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to generate invoice",
        "error",
      );
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="mbill-loading">Loading operational billing…</div>;
  }

  const modelLabel =
    MODEL_OPTIONS.find((m) => m.value === config?.model)?.label ||
    config?.model;

  return (
    <div className="mbill">
      <div className="mbill-header">
        <div>
          <h2 className="mbill-title">Operational Billing</h2>
          <p className="mbill-sub">
            Usage-based managed billing — invoices are generated from real trip
            operations for the month plus a management fee, with SLA penalties
            applied automatically.
          </p>
        </div>
        <div className="mbill-header-actions">
          <select
            className="mbill-select"
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
            <button className="mbill-btn" onClick={openEdit}>
              Configure
            </button>
          )}
        </div>
      </div>

      {!config?.enabled ? (
        <div className="mbill-disabled">
          <p>Operation-based billing is not enabled for this contract.</p>
          {isCorporate && (
            <button className="mbill-btn primary" onClick={openEdit}>
              Set up billing
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Config summary */}
          <div className="mbill-config-summary">
            <div className="mbill-chip">
              <span className="mbill-chip-label">Model</span>
              <span className="mbill-chip-val">{modelLabel}</span>
            </div>
            <div className="mbill-chip">
              <span className="mbill-chip-label">Rate</span>
              <span className="mbill-chip-val">
                {config.model === "PER_TRIP" &&
                  `${money(config.ratePerTrip, currency)} / trip`}
                {config.model === "PER_SEAT" &&
                  `${money(config.ratePerSeat, currency)} / seat`}
                {config.model === "PER_KM" &&
                  `${money(config.ratePerKm, currency)} / km`}
                {config.model === "FIXED_MONTHLY" &&
                  `${money(config.fixedMonthlyAmount, currency)} / month`}
              </span>
            </div>
            <div className="mbill-chip">
              <span className="mbill-chip-label">Management fee</span>
              <span className="mbill-chip-val">
                {config.managementFeeType === "PERCENT"
                  ? `${config.managementFeeValue}%`
                  : money(config.managementFeeValue, currency)}
              </span>
            </div>
            <div className="mbill-chip">
              <span className="mbill-chip-label">Tax</span>
              <span className="mbill-chip-val">{config.taxRatePct || 0}%</span>
            </div>
          </div>

          {/* Preview */}
          <div className="mbill-section">
            <div className="mbill-section-head">
              <h3 className="mbill-section-title">
                Invoice preview — {MONTHS[month - 1]} {year}
              </h3>
              <button
                className="mbill-btn sm"
                disabled={previewing}
                onClick={runPreview}
              >
                {previewing ? "Calculating…" : "Refresh"}
              </button>
            </div>

            {preview?.alreadyGenerated && (
              <div className="mbill-note warn">
                An invoice for this period already exists (
                {preview.existingInvoiceNumber}).
              </div>
            )}

            {previewing ? (
              <div className="mbill-empty">Calculating from operations…</div>
            ) : preview ? (
              <div className="mbill-preview">
                <div className="mbill-usage">
                  <div className="mbill-usage-card">
                    <span className="mbill-usage-val">
                      {preview.usage.trips}
                    </span>
                    <span className="mbill-usage-label">Trips</span>
                  </div>
                  <div className="mbill-usage-card">
                    <span className="mbill-usage-val">
                      {preview.usage.seats}
                    </span>
                    <span className="mbill-usage-label">Seats</span>
                  </div>
                  <div className="mbill-usage-card">
                    <span className="mbill-usage-val">
                      {preview.usage.distanceKm}
                    </span>
                    <span className="mbill-usage-label">Kilometres</span>
                  </div>
                </div>

                <div className="mbill-breakdown">
                  <div className="mbill-line">
                    <span>Operational charge ({modelLabel})</span>
                    <span>{money(preview.operationalAmount, currency)}</span>
                  </div>
                  <div className="mbill-line">
                    <span>Management fee</span>
                    <span>{money(preview.managementFee, currency)}</span>
                  </div>
                  <div className="mbill-line subtotal">
                    <span>Subtotal</span>
                    <span>{money(preview.subtotal, currency)}</span>
                  </div>
                  {preview.slaPenalty > 0 && (
                    <div className="mbill-line penalty">
                      <span>SLA penalty</span>
                      <span>-{money(preview.slaPenalty, currency)}</span>
                    </div>
                  )}
                  <div className="mbill-line">
                    <span>Tax ({config.taxRatePct || 0}%)</span>
                    <span>{money(preview.tax, currency)}</span>
                  </div>
                  <div className="mbill-line total">
                    <span>Total payable</span>
                    <span>{money(preview.total, currency)}</span>
                  </div>
                </div>

                {preview.slaPenalty > 0 && preview.slaBreaches?.length > 0 && (
                  <p className="mbill-penalty-note">
                    Penalty applied for:{" "}
                    {preview.slaBreaches.map((b) => b.label).join(", ")}.
                  </p>
                )}

                {isCorporate &&
                  !preview.alreadyGenerated &&
                  preview.usage.trips >= 0 && (
                    <button
                      className="mbill-btn primary generate"
                      disabled={generating}
                      onClick={generate}
                    >
                      {generating
                        ? "Generating…"
                        : `Generate Invoice — ${money(preview.total, currency)}`}
                    </button>
                  )}
              </div>
            ) : (
              <div className="mbill-empty">No preview available.</div>
            )}
          </div>

          {/* Generated invoices */}
          <div className="mbill-section">
            <h3 className="mbill-section-title">Operational invoices</h3>
            {invoices.length === 0 ? (
              <div className="mbill-empty">
                No operational invoices generated yet.
              </div>
            ) : (
              <div className="mbill-inv-table">
                <div className="mbill-inv-row head">
                  <span>Invoice</span>
                  <span>Period</span>
                  <span>Trips</span>
                  <span>Penalty</span>
                  <span>Total</span>
                  <span>Status</span>
                </div>
                {invoices.map((inv) => (
                  <div key={inv._id} className="mbill-inv-row">
                    <span className="mbill-inv-num">{inv.invoiceNumber}</span>
                    <span>{inv.periodLabel || "—"}</span>
                    <span>{inv.usage?.trips ?? "—"}</span>
                    <span
                      className={inv.usage?.slaPenalty > 0 ? "mbill-pen" : ""}
                    >
                      {inv.usage?.slaPenalty > 0
                        ? `-${money(inv.usage.slaPenalty, currency)}`
                        : "—"}
                    </span>
                    <span className="mbill-inv-total">
                      {money(inv.amount, currency)}
                    </span>
                    <span
                      className={`mbill-status s-${(inv.status || "").toLowerCase()}`}
                    >
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Config editor */}
      {editCfg && cfgForm && (
        <div className="mbill-modal-overlay" onClick={() => setEditCfg(false)}>
          <div className="mbill-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mbill-modal-title">Operational Billing Setup</h3>
            <label className="mbill-check">
              <input
                type="checkbox"
                checked={cfgForm.enabled}
                onChange={(e) =>
                  setCfgForm({ ...cfgForm, enabled: e.target.checked })
                }
              />
              Enable operation-based billing
            </label>

            <label className="mbill-field">
              Billing model
              <select
                value={cfgForm.model}
                onChange={(e) =>
                  setCfgForm({ ...cfgForm, model: e.target.value })
                }
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mbill-modal-grid">
              {cfgForm.model === "PER_TRIP" && (
                <label>
                  Rate per trip ({currency})
                  <input
                    type="number"
                    value={cfgForm.ratePerTrip}
                    onChange={(e) =>
                      setCfgForm({ ...cfgForm, ratePerTrip: e.target.value })
                    }
                  />
                </label>
              )}
              {cfgForm.model === "PER_SEAT" && (
                <label>
                  Rate per seat ({currency})
                  <input
                    type="number"
                    value={cfgForm.ratePerSeat}
                    onChange={(e) =>
                      setCfgForm({ ...cfgForm, ratePerSeat: e.target.value })
                    }
                  />
                </label>
              )}
              {cfgForm.model === "PER_KM" && (
                <label>
                  Rate per km ({currency})
                  <input
                    type="number"
                    value={cfgForm.ratePerKm}
                    onChange={(e) =>
                      setCfgForm({ ...cfgForm, ratePerKm: e.target.value })
                    }
                  />
                </label>
              )}
              {cfgForm.model === "FIXED_MONTHLY" && (
                <label>
                  Fixed monthly ({currency})
                  <input
                    type="number"
                    value={cfgForm.fixedMonthlyAmount}
                    onChange={(e) =>
                      setCfgForm({
                        ...cfgForm,
                        fixedMonthlyAmount: e.target.value,
                      })
                    }
                  />
                </label>
              )}
              <label>
                Management fee type
                <select
                  value={cfgForm.managementFeeType}
                  onChange={(e) =>
                    setCfgForm({
                      ...cfgForm,
                      managementFeeType: e.target.value,
                    })
                  }
                >
                  <option value="PERCENT">Percent of operations</option>
                  <option value="FLAT">Flat amount</option>
                </select>
              </label>
              <label>
                Management fee value
                <input
                  type="number"
                  value={cfgForm.managementFeeValue}
                  onChange={(e) =>
                    setCfgForm({
                      ...cfgForm,
                      managementFeeValue: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Tax rate (%)
                <input
                  type="number"
                  value={cfgForm.taxRatePct}
                  onChange={(e) =>
                    setCfgForm({ ...cfgForm, taxRatePct: e.target.value })
                  }
                />
              </label>
              <label>
                Billing day of month
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={cfgForm.billingDay}
                  onChange={(e) =>
                    setCfgForm({ ...cfgForm, billingDay: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="mbill-modal-actions">
              <button className="mbill-btn" onClick={() => setEditCfg(false)}>
                Cancel
              </button>
              <button
                className="mbill-btn primary"
                disabled={savingCfg}
                onClick={saveCfg}
              >
                {savingCfg ? "Saving…" : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`mbill-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
