import React, { useState, useEffect, useCallback } from "react";
import {
  FiPercent,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiX,
  FiCheck,
  FiDollarSign,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";
import * as demandAPI from "../../../services/demandAPI";

const TRIGGER_LABELS = {
  CUSTOMER_ONBOARDED: "Per Customer Onboarded",
  B2B_PARTNER_ONBOARDED: "Per B2B Partner Onboarded",
  B2C_PARTNER_ONBOARDED: "Per B2C Partner Onboarded",
  CORPORATE_ONBOARDED: "Per Corporate Onboarded",
  CAMPAIGN_INCENTIVE: "Campaign Incentive",
  MONTHLY_PERFORMANCE: "Monthly Performance",
};

const statusBadge = (s) =>
  ({
    PENDING: "dg-badge-amber",
    APPROVED: "dg-badge-blue",
    PAID: "dg-badge-green",
  })[s] || "dg-badge-gray";

const emptyRule = {
  name: "",
  description: "",
  trigger: "CUSTOMER_ONBOARDED",
  calcType: "FIXED",
  amount: "",
  percentage: "",
  minOnboardings: "",
  active: true,
};

const DGCommissions = () => {
  const activeCurrency = useSelector((s) => s.locale?.currency) || "AED";
  const [tab, setTab] = useState("earned");

  // Rules
  const [rules, setRules] = useState([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState(emptyRule);

  // Earned
  const [commissions, setCommissions] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Manual commission
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    employee: "",
    trigger: "MONTHLY_PERFORMANCE",
    calcType: "FIXED",
    amount: "",
    note: "",
  });

  const fetchRules = useCallback(async () => {
    try {
      const res = await demandAPI.getCommissionRules();
      setRules(res.data || []);
    } catch (e) {
      toast.error("Failed to load rules");
    }
  }, []);

  const fetchCommissions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await demandAPI.getCommissions({
        status: statusFilter,
        employee: employeeFilter,
      });
      setCommissions(res.data || []);
      setTotalAmount(res.totalAmount || 0);
    } catch (e) {
      toast.error("Failed to load commissions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, employeeFilter, activeCurrency]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await demandAPI.getEmployees({
        status: "ACTIVE",
        limit: 200,
      });
      setEmployees(res.data.employees || []);
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchEmployees();
  }, [fetchRules, fetchEmployees]);
  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  // ---- Rule handlers ----
  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm(emptyRule);
    setShowRuleModal(true);
  };
  const openEditRule = (r) => {
    setEditingRule(r);
    setRuleForm({
      name: r.name,
      description: r.description || "",
      trigger: r.trigger,
      calcType: r.calcType,
      amount: r.amount || "",
      percentage: r.percentage || "",
      minOnboardings: r.minOnboardings || "",
      active: r.active,
    });
    setShowRuleModal(true);
  };
  const handleRuleSubmit = async (e) => {
    e.preventDefault();
    if (!ruleForm.name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    try {
      setSubmitting(true);
      if (editingRule) {
        await demandAPI.updateCommissionRule(editingRule._id, ruleForm);
        toast.success("Rule updated");
      } else {
        await demandAPI.createCommissionRule(ruleForm);
        toast.success("Rule created");
      }
      setShowRuleModal(false);
      fetchRules();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save rule");
    } finally {
      setSubmitting(false);
    }
  };
  const handleDeleteRule = async (r) => {
    if (!window.confirm(`Delete rule "${r.name}"?`)) return;
    try {
      await demandAPI.deleteCommissionRule(r._id);
      toast.success("Rule deleted");
      fetchRules();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  // ---- Earned handlers ----
  const handleStatus = async (c, status) => {
    try {
      await demandAPI.updateCommissionStatus(c._id, status);
      toast.success(`Marked ${status.toLowerCase()}`);
      fetchCommissions();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };
  const handleReconcile = async () => {
    if (
      !window.confirm(
        "Backfill commissions for onboarded leads that are missing them? This is safe to run and never creates duplicates.",
      )
    )
      return;
    try {
      setLoading(true);
      const res = await demandAPI.reconcileCommissions();
      toast.success(res.message || "Reconciled commissions");
      fetchCommissions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reconcile");
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteComm = async (c) => {
    if (!window.confirm("Delete this commission?")) return;
    try {
      await demandAPI.deleteCommission(c._id);
      toast.success("Deleted");
      fetchCommissions();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.employee || manualForm.amount === "") {
      toast.error("Employee and amount required");
      return;
    }
    try {
      setSubmitting(true);
      await demandAPI.createCommission(manualForm);
      toast.success("Commission added");
      setShowManualModal(false);
      setManualForm({
        employee: "",
        trigger: "MONTHLY_PERFORMANCE",
        calcType: "FIXED",
        amount: "",
        note: "",
      });
      fetchCommissions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add");
    } finally {
      setSubmitting(false);
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
          <h2>Commission Management</h2>
          <p>
            Configure automatic commission rules and manage earned commissions.
          </p>
        </div>
      </div>

      <div className="dg-subnav" style={{ marginBottom: 20 }}>
        <button
          className={tab === "earned" ? "active" : ""}
          onClick={() => setTab("earned")}
        >
          <FiDollarSign /> Earned Commissions
        </button>
        <button
          className={tab === "rules" ? "active" : ""}
          onClick={() => setTab("rules")}
        >
          <FiPercent /> Commission Rules
        </button>
      </div>

      {tab === "earned" && (
        <>
          <div className="dg-stats">
            <div className="dg-stat dg-stat-accent-blue">
              <div className="dg-stat-label">Total Commissions (filtered)</div>
              <div className="dg-stat-value">{money(totalAmount)}</div>
              <div className="dg-stat-sub">{commissions.length} records</div>
            </div>
          </div>

          <div className="dg-filters">
            <select
              className="dg-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
            </select>
            <select
              className="dg-select"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.fullName}
                </option>
              ))}
            </select>
            <button className="dg-btn" onClick={fetchCommissions}>
              <FiRefreshCw /> Refresh
            </button>
            <button
              className="dg-btn"
              onClick={handleReconcile}
              disabled={loading}
            >
              <FiCheck /> Backfill Missing
            </button>
            <button
              className="dg-btn dg-btn-primary"
              onClick={() => setShowManualModal(true)}
            >
              <FiPlus /> Manual Entry
            </button>
          </div>

          <div className="dg-table-wrap">
            {loading ? (
              <div className="dg-loading">
                <div className="dg-spinner" />
                <p>Loading...</p>
              </div>
            ) : commissions.length === 0 ? (
              <div className="dg-empty">
                <FiDollarSign />
                <h3>No commissions</h3>
                <p>Commissions appear when leads are onboarded.</p>
              </div>
            ) : (
              <table className="dg-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Month</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <div className="dg-cell-strong">
                          {c.employee?.fullName || "-"}
                        </div>
                        <div className="dg-code">
                          {c.employee?.employeeCode}
                        </div>
                      </td>
                      <td>{TRIGGER_LABELS[c.trigger] || c.trigger}</td>
                      <td className="dg-cell-muted">
                        {c.lead
                          ? `${c.lead.name} (${c.lead.leadCode})`
                          : c.campaign?.name || c.note || "-"}
                      </td>
                      <td>{c.month}</td>
                      <td className="dg-cell-strong">{money(c.amount)}</td>
                      <td>
                        <span className={`dg-badge ${statusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <div className="dg-row-actions">
                          {c.status === "PENDING" && (
                            <button
                              className="dg-btn dg-btn-sm"
                              onClick={() => handleStatus(c, "APPROVED")}
                            >
                              Approve
                            </button>
                          )}
                          {c.status === "APPROVED" && (
                            <button
                              className="dg-btn dg-btn-sm dg-btn-success"
                              onClick={() => handleStatus(c, "PAID")}
                            >
                              <FiCheck /> Pay
                            </button>
                          )}
                          <button
                            className="dg-icon-btn danger"
                            title="Delete"
                            onClick={() => handleDeleteComm(c)}
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
        </>
      )}

      {tab === "rules" && (
        <>
          <div className="dg-filters">
            <button className="dg-btn" onClick={fetchRules}>
              <FiRefreshCw /> Refresh
            </button>
            <button className="dg-btn dg-btn-primary" onClick={openCreateRule}>
              <FiPlus /> New Rule
            </button>
          </div>
          <div className="dg-table-wrap">
            {rules.length === 0 ? (
              <div className="dg-empty">
                <FiPercent />
                <h3>No rules</h3>
                <p>Add rules to auto-calculate commissions on onboarding.</p>
              </div>
            ) : (
              <table className="dg-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Trigger</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <div className="dg-cell-strong">{r.name}</div>
                        {r.description && (
                          <div className="dg-cell-muted">{r.description}</div>
                        )}
                      </td>
                      <td>{TRIGGER_LABELS[r.trigger] || r.trigger}</td>
                      <td>{r.calcType === "FIXED" ? "Fixed" : "Percentage"}</td>
                      <td>
                        {r.calcType === "FIXED"
                          ? money(r.amount)
                          : `${r.percentage}%`}
                      </td>
                      <td>
                        <span
                          className={`dg-badge ${r.active ? "dg-badge-green" : "dg-badge-gray"}`}
                        >
                          {r.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="dg-row-actions">
                          <button
                            className="dg-icon-btn"
                            title="Edit"
                            onClick={() => openEditRule(r)}
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            className="dg-icon-btn danger"
                            title="Delete"
                            onClick={() => handleDeleteRule(r)}
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
        </>
      )}

      {/* Rule modal */}
      {showRuleModal && (
        <div
          className="dg-modal-overlay"
          onClick={() => setShowRuleModal(false)}
        >
          <div className="dg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dg-modal-head">
              <h3>{editingRule ? "Edit Rule" : "New Commission Rule"}</h3>
              <button
                className="dg-modal-close"
                onClick={() => setShowRuleModal(false)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleRuleSubmit}>
              <div className="dg-modal-body">
                <div className="dg-form-grid">
                  <div className="dg-field full">
                    <label>Rule Name *</label>
                    <input
                      value={ruleForm.name}
                      onChange={(e) =>
                        setRuleForm({ ...ruleForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field full">
                    <label>Description</label>
                    <input
                      value={ruleForm.description}
                      onChange={(e) =>
                        setRuleForm({
                          ...ruleForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Trigger</label>
                    <select
                      value={ruleForm.trigger}
                      onChange={(e) =>
                        setRuleForm({ ...ruleForm, trigger: e.target.value })
                      }
                    >
                      {Object.keys(TRIGGER_LABELS).map((t) => (
                        <option key={t} value={t}>
                          {TRIGGER_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="dg-field">
                    <label>Calculation</label>
                    <select
                      value={ruleForm.calcType}
                      onChange={(e) =>
                        setRuleForm({ ...ruleForm, calcType: e.target.value })
                      }
                    >
                      <option value="FIXED">Fixed Amount</option>
                      <option value="PERCENTAGE">
                        Percentage of Est. Value
                      </option>
                    </select>
                  </div>
                  {ruleForm.calcType === "FIXED" ? (
                    <div className="dg-field">
                      <label>Amount ({activeCurrency})</label>
                      <input
                        type="number"
                        min="0"
                        value={ruleForm.amount}
                        onChange={(e) =>
                          setRuleForm({ ...ruleForm, amount: e.target.value })
                        }
                      />
                    </div>
                  ) : (
                    <div className="dg-field">
                      <label>Percentage (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={ruleForm.percentage}
                        onChange={(e) =>
                          setRuleForm({
                            ...ruleForm,
                            percentage: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                  {ruleForm.trigger === "MONTHLY_PERFORMANCE" && (
                    <div className="dg-field">
                      <label>Min Onboardings</label>
                      <input
                        type="number"
                        min="0"
                        value={ruleForm.minOnboardings}
                        onChange={(e) =>
                          setRuleForm({
                            ...ruleForm,
                            minOnboardings: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                  <div className="dg-field">
                    <label>Active</label>
                    <select
                      value={ruleForm.active ? "yes" : "no"}
                      onChange={(e) =>
                        setRuleForm({
                          ...ruleForm,
                          active: e.target.value === "yes",
                        })
                      }
                    >
                      <option value="yes">Active</option>
                      <option value="no">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="dg-modal-foot">
                <button
                  type="button"
                  className="dg-btn"
                  onClick={() => setShowRuleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dg-btn dg-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : editingRule ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual commission modal */}
      {showManualModal && (
        <div
          className="dg-modal-overlay"
          onClick={() => setShowManualModal(false)}
        >
          <div className="dg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dg-modal-head">
              <h3>Manual Commission Entry</h3>
              <button
                className="dg-modal-close"
                onClick={() => setShowManualModal(false)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleManualSubmit}>
              <div className="dg-modal-body">
                <div className="dg-form-grid">
                  <div className="dg-field full">
                    <label>Employee *</label>
                    <select
                      value={manualForm.employee}
                      onChange={(e) =>
                        setManualForm({
                          ...manualForm,
                          employee: e.target.value,
                        })
                      }
                    >
                      <option value="">Select employee</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.fullName} ({emp.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="dg-field">
                    <label>Type</label>
                    <select
                      value={manualForm.trigger}
                      onChange={(e) =>
                        setManualForm({
                          ...manualForm,
                          trigger: e.target.value,
                        })
                      }
                    >
                      {Object.keys(TRIGGER_LABELS).map((t) => (
                        <option key={t} value={t}>
                          {TRIGGER_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="dg-field">
                    <label>Amount ({activeCurrency}) *</label>
                    <input
                      type="number"
                      min="0"
                      value={manualForm.amount}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field full">
                    <label>Note</label>
                    <input
                      value={manualForm.note}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, note: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="dg-modal-foot">
                <button
                  type="button"
                  className="dg-btn"
                  onClick={() => setShowManualModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dg-btn dg-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DGCommissions;
