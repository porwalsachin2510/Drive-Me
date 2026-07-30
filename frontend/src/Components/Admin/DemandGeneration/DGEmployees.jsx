import React, { useState, useEffect, useCallback } from "react";
import {
  FiUsers,
  FiUserPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiRefreshCw,
  FiX,
  FiDollarSign,
  FiPlus,
  FiCopy,
  FiExternalLink,
  FiBriefcase,
  FiSend,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";
import * as demandAPI from "../../../services/demandAPI";

// Absolute URL of the Staff Portal login, shareable with field reps / finance staff.
const getPortalLoginUrl = () =>
  `${typeof window !== "undefined" ? window.location.origin : ""}/staff-login`;

const copyPortalLink = async () => {
  const url = getPortalLoginUrl();
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Portal login link copied");
  } catch {
    toast.error("Could not copy link");
  }
};

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  employeeType: "PERMANENT",
  department: "Sales",
  designation: "",
  reportingManager: "",
  territory: "",
  region: "",
  status: "ACTIVE",
  monthlySalary: "",
  monthlyTarget: "",
  allowances: [],
  hasPortalAccess: false,
  portalRole: "FIELD",
  password: "",
};

const DGEmployees = () => {
  const activeCurrency = useSelector((s) => s.locale?.currency) || "AED";
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showPaySalaryModal, setShowPaySalaryModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [salaryForm, setSalaryForm] = useState({
    monthlySalary: "",
    effectiveDate: "",
    note: "",
    allowances: [],
  });
  const [walletData, setWalletData] = useState(null);
  const [paySalaryForm, setPaySalaryForm] = useState({
    amount: "",
    month: "",
    note: "",
  });
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await demandAPI.getEmployees({
        search,
        status: statusFilter,
        employeeType: typeFilter,
        limit: 100,
      });
      setEmployees(res.data.employees || []);
    } catch (e) {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, activeCurrency]);

  useEffect(() => {
    const t = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(t);
  }, [fetchEmployees]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      fullName: emp.fullName || "",
      email: emp.email || "",
      phone: emp.phone || "",
      employeeType: emp.employeeType || "PERMANENT",
      department: emp.department || "Sales",
      designation: emp.designation || "",
      reportingManager: emp.reportingManager?._id || emp.reportingManager || "",
      territory: emp.territory || "",
      region: emp.region || "",
      status: emp.status || "ACTIVE",
      monthlySalary: emp.monthlySalary || "",
      monthlyTarget: emp.monthlyTarget || "",
      allowances: emp.allowances || [],
      hasPortalAccess: !!emp.hasPortalAccess,
      portalRole: emp.portalRole || "FIELD",
      password: "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) {
      toast.error("Full name and email are required");
      return;
    }
    if (
      form.hasPortalAccess &&
      !editing &&
      (!form.password || form.password.length < 6)
    ) {
      toast.error("Set a password (min 6 chars) to enable portal access");
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...form,
        reportingManager: form.reportingManager || null,
      };
      // Only send a password when one was actually entered (avoids wiping it on edit).
      if (!payload.password) delete payload.password;
      if (editing) {
        await demandAPI.updateEmployee(editing._id, payload);
        toast.success("Employee updated");
      } else {
        await demandAPI.createEmployee(payload);
        toast.success("Employee created");
      }
      setShowModal(false);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save employee");
    } finally {
      setSubmitting(false);
    }
  };

  const openSalary = (emp) => {
    setSelected(emp);
    setSalaryForm({
      monthlySalary: emp.monthlySalary || "",
      effectiveDate: new Date().toISOString().slice(0, 10),
      note: "",
      allowances: emp.allowances || [],
    });
    setShowSalaryModal(true);
  };

  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await demandAPI.updateSalary(selected._id, salaryForm);
      toast.success("Salary updated");
      setShowSalaryModal(false);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update salary");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (emp) => {
    if (
      !window.confirm(
        `Delete ${emp.fullName}? Assigned leads will be unassigned.`,
      )
    )
      return;
    try {
      await demandAPI.deleteEmployee(emp._id);
      toast.success("Employee deleted");
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const openWallet = async (emp) => {
    try {
      setSelected(emp);
      setSubmitting(true);
      const result = await demandAPI.getEmployeeWallet(emp._id);
      if (result.success) {
        setWalletData(result.data);
        setShowWalletModal(true);
      } else {
        toast.error(result.message || "Failed to load wallet");
      }
    } catch (err) {
      toast.error("Failed to load wallet");
    } finally {
      setSubmitting(false);
    }
  };

  const openPaySalary = (emp) => {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    setSelected(emp);
    setPaySalaryForm({ amount: "", month, note: "" });
    setShowPaySalaryModal(true);
  };

  const handlePaySalarySubmit = async (e) => {
    e.preventDefault();
    if (!paySalaryForm.month) {
      toast.error("Month is required");
      return;
    }
    try {
      setSubmitting(true);
      const result = await demandAPI.payEmployeeSalary(selected._id, {
        month: paySalaryForm.month,
        amount: paySalaryForm.amount ? Number(paySalaryForm.amount) : undefined,
        note: paySalaryForm.note,
      });
      if (result.success) {
        toast.success("Salary paid successfully");
        setShowPaySalaryModal(false);
      } else {
        toast.error(result.message || "Failed to pay salary");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to pay salary");
    } finally {
      setSubmitting(false);
    }
  };

  // Allowance editing helpers
  const addAllowance = (key) => {
    if (key === "form")
      setForm((p) => ({
        ...p,
        allowances: [...p.allowances, { type: "", amount: 0 }],
      }));
    else
      setSalaryForm((p) => ({
        ...p,
        allowances: [...p.allowances, { type: "", amount: 0 }],
      }));
  };
  const updateAllowance = (key, idx, field, value) => {
    const setter = key === "form" ? setForm : setSalaryForm;
    setter((p) => {
      const allowances = [...p.allowances];
      allowances[idx] = {
        ...allowances[idx],
        [field]: field === "amount" ? Number(value) : value,
      };
      return { ...p, allowances };
    });
  };
  const removeAllowance = (key, idx) => {
    const setter = key === "form" ? setForm : setSalaryForm;
    setter((p) => ({
      ...p,
      allowances: p.allowances.filter((_, i) => i !== idx),
    }));
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
          <h2>Workforce &amp; Salary Management</h2>
          <p>
            Create acquisition employees, manage salary, allowances and targets.
          </p>
        </div>
        <button className="dg-btn dg-btn-primary" onClick={openCreate}>
          <FiUserPlus /> Add Employee
        </button>
      </div>

      <div className="dg-filters">
        <div className="dg-search">
          <FiSearch />
          <input
            placeholder="Search name, email, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="dg-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select
          className="dg-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="PERMANENT">Permanent</option>
          <option value="TEMPORARY">Temporary/Contract</option>
        </select>
        <button className="dg-btn" onClick={fetchEmployees}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="dg-table-wrap">
        {loading ? (
          <div className="dg-loading">
            <div className="dg-spinner" />
            <p>Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="dg-empty">
            <FiUsers />
            <h3>No employees yet</h3>
            <p>Add your first acquisition employee to get started.</p>
          </div>
        ) : (
          <table className="dg-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Department</th>
                <th>Region / Territory</th>
                <th>Salary</th>
                <th>Target</th>
                <th>Active Leads</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp._id}>
                  <td>
                    <div className="dg-cell-strong">{emp.fullName}</div>
                    <div className="dg-code">{emp.employeeCode}</div>
                    <div className="dg-cell-muted">{emp.email}</div>
                    {emp.hasPortalAccess && (
                      <div
                        style={{
                          marginTop: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className={`dg-badge ${emp.portalRole === "FINANCE" ? "dg-badge-amber" : "dg-badge-blue"}`}
                        >
                          Portal:{" "}
                          {emp.portalRole === "FINANCE" ? "Finance" : "Field"}
                        </span>
                        <button
                          type="button"
                          className="dg-icon-btn"
                          title="Copy Staff Portal login link"
                          onClick={copyPortalLink}
                        >
                          <FiCopy />
                        </button>
                        <a
                          className="dg-icon-btn"
                          title="Open Staff Portal login"
                          href={getPortalLoginUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <FiExternalLink />
                        </a>
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`dg-badge ${emp.employeeType === "PERMANENT" ? "dg-badge-blue" : "dg-badge-amber"}`}
                    >
                      {emp.employeeType === "PERMANENT"
                        ? "Permanent"
                        : "Contract"}
                    </span>
                  </td>
                  <td>
                    <div>{emp.department || "-"}</div>
                    {emp.designation && (
                      <div className="dg-cell-muted">{emp.designation}</div>
                    )}
                  </td>
                  <td>
                    <div>{emp.region || "-"}</div>
                    <div className="dg-cell-muted">{emp.territory || ""}</div>
                  </td>
                  <td>{money(emp.monthlySalary)}</td>
                  <td>{emp.monthlyTarget || 0}</td>
                  <td>{emp.activeLeads ?? 0}</td>
                  <td>
                    <span
                      className={`dg-badge ${emp.status === "ACTIVE" ? "dg-badge-green" : "dg-badge-gray"}`}
                    >
                      {emp.status}
                    </span>
                  </td>
                  <td>
                    <div className="dg-row-actions">
                      <button
                        className="dg-icon-btn"
                        title="Wallet"
                        onClick={() => openWallet(emp)}
                      >
                        <FiBriefcase />
                      </button>
                      <button
                        className="dg-icon-btn"
                        title="Pay Salary"
                        onClick={() => openPaySalary(emp)}
                      >
                        <FiSend />
                      </button>
                      <button
                        className="dg-icon-btn"
                        title="Edit Salary"
                        onClick={() => openSalary(emp)}
                      >
                        <FiDollarSign />
                      </button>
                      <button
                        className="dg-icon-btn"
                        title="Edit"
                        onClick={() => openEdit(emp)}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="dg-icon-btn danger"
                        title="Delete"
                        onClick={() => handleDelete(emp)}
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
              <h3>{editing ? "Edit Employee" : "Add Employee"}</h3>
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
                    <label>Full Name *</label>
                    <input
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={form.email}
                      disabled={!!editing}
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
                    <label>Employee Type</label>
                    <select
                      value={form.employeeType}
                      onChange={(e) =>
                        setForm({ ...form, employeeType: e.target.value })
                      }
                    >
                      <option value="PERMANENT">Permanent</option>
                      <option value="TEMPORARY">Temporary / Contract</option>
                    </select>
                  </div>
                  <div className="dg-field">
                    <label>Department</label>
                    <input
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Designation</label>
                    <input
                      value={form.designation}
                      onChange={(e) =>
                        setForm({ ...form, designation: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Reporting Manager</label>
                    <select
                      value={form.reportingManager}
                      onChange={(e) =>
                        setForm({ ...form, reportingManager: e.target.value })
                      }
                    >
                      <option value="">None</option>
                      {employees
                        .filter((x) => x._id !== editing?._id)
                        .map((x) => (
                          <option key={x._id} value={x._id}>
                            {x.fullName} ({x.employeeCode})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="dg-field">
                    <label>Status</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
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
                    <label>Monthly Salary ({activeCurrency})</label>
                    <input
                      type="number"
                      min="0"
                      value={form.monthlySalary}
                      onChange={(e) =>
                        setForm({ ...form, monthlySalary: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Monthly Target (onboardings)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.monthlyTarget}
                      onChange={(e) =>
                        setForm({ ...form, monthlyTarget: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field full">
                    <label>Allowances</label>
                    {form.allowances.map((a, i) => (
                      <div className="dg-inline-row" key={i}>
                        <input
                          placeholder="Type (e.g. Travel)"
                          value={a.type}
                          onChange={(e) =>
                            updateAllowance("form", i, "type", e.target.value)
                          }
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={a.amount}
                          onChange={(e) =>
                            updateAllowance("form", i, "amount", e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="dg-icon-btn danger"
                          onClick={() => removeAllowance("form", i)}
                        >
                          <FiX />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="dg-btn dg-btn-sm"
                      onClick={() => addAllowance("form")}
                    >
                      <FiPlus /> Add Allowance
                    </button>
                    {editing && (
                      <p className="dg-hint">
                        Note: changing salary here does not create a
                        salary-history entry. Use the salary action for that.
                      </p>
                    )}
                  </div>

                  {/* ===== Staff Portal login ===== */}
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
                        style={{ width: "auto", margin: 0 }}
                        checked={form.hasPortalAccess}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            hasPortalAccess: e.target.checked,
                          })
                        }
                      />
                      Enable Staff Portal login
                    </label>
                    <p className="dg-hint">
                      Lets this person log in at{" "}
                      <a
                        href={getPortalLoginUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontWeight: 600 }}
                      >
                        {getPortalLoginUrl()}
                      </a>{" "}
                      to work their own leads (Field) or pay commissions &amp;
                      expenses (Finance).
                    </p>
                    {form.hasPortalAccess && (
                      <button
                        type="button"
                        className="dg-btn dg-btn-sm"
                        onClick={copyPortalLink}
                        style={{ marginTop: 6 }}
                      >
                        <FiCopy /> Copy portal login link
                      </button>
                    )}
                  </div>
                  {form.hasPortalAccess && (
                    <>
                      <div className="dg-field">
                        <label>Portal Role</label>
                        <select
                          value={form.portalRole}
                          onChange={(e) =>
                            setForm({ ...form, portalRole: e.target.value })
                          }
                        >
                          <option value="FIELD">Field / Sales Rep</option>
                          <option value="FINANCE">Finance Officer</option>
                        </select>
                      </div>
                      <div className="dg-field">
                        <label>
                          {editing ? "Reset Password" : "Password *"}
                        </label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder={
                            editing
                              ? "Leave blank to keep current"
                              : "Min 6 characters"
                          }
                          value={form.password}
                          onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                          }
                        />
                      </div>
                    </>
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

      {/* Salary modal */}
      {showSalaryModal && selected && (
        <div
          className="dg-modal-overlay"
          onClick={() => setShowSalaryModal(false)}
        >
          <div className="dg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dg-modal-head">
              <h3>Salary — {selected.fullName}</h3>
              <button
                className="dg-modal-close"
                onClick={() => setShowSalaryModal(false)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSalarySubmit}>
              <div className="dg-modal-body">
                <div className="dg-form-grid">
                  <div className="dg-field">
                    <label>Monthly Salary ({activeCurrency}) *</label>
                    <input
                      type="number"
                      min="0"
                      value={salaryForm.monthlySalary}
                      onChange={(e) =>
                        setSalaryForm({
                          ...salaryForm,
                          monthlySalary: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Effective Date</label>
                    <input
                      type="date"
                      value={salaryForm.effectiveDate}
                      onChange={(e) =>
                        setSalaryForm({
                          ...salaryForm,
                          effectiveDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="dg-field full">
                    <label>Note</label>
                    <input
                      value={salaryForm.note}
                      placeholder="e.g. Annual increment"
                      onChange={(e) =>
                        setSalaryForm({ ...salaryForm, note: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field full">
                    <label>Allowances</label>
                    {salaryForm.allowances.map((a, i) => (
                      <div className="dg-inline-row" key={i}>
                        <input
                          placeholder="Type"
                          value={a.type}
                          onChange={(e) =>
                            updateAllowance("salary", i, "type", e.target.value)
                          }
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={a.amount}
                          onChange={(e) =>
                            updateAllowance(
                              "salary",
                              i,
                              "amount",
                              e.target.value,
                            )
                          }
                        />
                        <button
                          type="button"
                          className="dg-icon-btn danger"
                          onClick={() => removeAllowance("salary", i)}
                        >
                          <FiX />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="dg-btn dg-btn-sm"
                      onClick={() => addAllowance("salary")}
                    >
                      <FiPlus /> Add Allowance
                    </button>
                  </div>
                </div>

                {selected.salaryHistory?.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                      }}
                    >
                      Salary History
                    </label>
                    <div className="dg-table-wrap" style={{ marginTop: 8 }}>
                      <table className="dg-table">
                        <thead>
                          <tr>
                            <th>Salary</th>
                            <th>Effective</th>
                            <th>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...selected.salaryHistory].reverse().map((h, i) => (
                            <tr key={i}>
                              <td>{money(h.monthlySalary)}</td>
                              <td>
                                {new Date(h.effectiveDate).toLocaleDateString()}
                              </td>
                              <td className="dg-cell-muted">{h.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="dg-modal-foot">
                <button
                  type="button"
                  className="dg-btn"
                  onClick={() => setShowSalaryModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dg-btn dg-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Update Salary"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wallet modal */}
      {showWalletModal && selected && walletData && (
        <div
          className="dg-modal-overlay"
          onClick={() => setShowWalletModal(false)}
        >
          <div className="dg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dg-modal-head">
              <h3>Wallet — {selected.fullName}</h3>
              <button
                className="dg-modal-close"
                onClick={() => setShowWalletModal(false)}
              >
                <FiX />
              </button>
            </div>
            <div className="dg-modal-body" style={{ padding: "20px" }}>
              <div
                style={{
                  background: "#f3f4f6",
                  padding: "16px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "4px",
                  }}
                >
                  Balance
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#1f2937",
                  }}
                >
                  {money(walletData.balance || 0)}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    background: "#f3f4f6",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    Total Earned
                  </div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "bold",
                      marginTop: "4px",
                    }}
                  >
                    {money(walletData.totalEarned || 0)}
                  </div>
                </div>
                <div
                  style={{
                    background: "#f3f4f6",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    Total Withdrawn
                  </div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "bold",
                      marginTop: "4px",
                    }}
                  >
                    {money(walletData.totalWithdrawn || 0)}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#374151",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Withdrawal Requests
                </label>
                {walletData.withdrawals && walletData.withdrawals.length > 0 ? (
                  <div className="dg-table-wrap">
                    <table className="dg-table" style={{ fontSize: "13px" }}>
                      <thead>
                        <tr>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletData.withdrawals.slice(0, 10).map((wr) => (
                          <tr key={wr._id}>
                            <td>{money(wr.amount)}</td>
                            <td>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  color:
                                    wr.status === "COMPLETED"
                                      ? "#10b981"
                                      : wr.status === "PENDING"
                                        ? "#f59e0b"
                                        : "#ef4444",
                                }}
                              >
                                {wr.status}
                              </span>
                            </td>
                            <td>
                              {new Date(wr.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#999",
                      padding: "12px",
                      textAlign: "center",
                    }}
                  >
                    No withdrawal requests
                  </div>
                )}
              </div>
            </div>
            <div className="dg-modal-foot">
              <button
                type="button"
                className="dg-btn"
                onClick={() => setShowWalletModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Salary modal */}
      {showPaySalaryModal && selected && (
        <div
          className="dg-modal-overlay"
          onClick={() => setShowPaySalaryModal(false)}
        >
          <div className="dg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dg-modal-head">
              <h3>Pay Salary — {selected.fullName}</h3>
              <button
                className="dg-modal-close"
                onClick={() => setShowPaySalaryModal(false)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handlePaySalarySubmit}>
              <div className="dg-modal-body">
                <div className="dg-form-grid">
                  <div className="dg-field">
                    <label>Month *</label>
                    <input
                      type="month"
                      value={paySalaryForm.month}
                      onChange={(e) =>
                        setPaySalaryForm({
                          ...paySalaryForm,
                          month: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="dg-field">
                    <label>Amount ({activeCurrency}) (optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Leave blank to use configured salary"
                      value={paySalaryForm.amount}
                      onChange={(e) =>
                        setPaySalaryForm({
                          ...paySalaryForm,
                          amount: e.target.value,
                        })
                      }
                    />
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginTop: "4px",
                      }}
                    >
                      Configured monthly: {money(selected.monthlySalary || 0)}
                    </div>
                  </div>
                  <div className="dg-field full">
                    <label>Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Regular salary"
                      value={paySalaryForm.note}
                      onChange={(e) =>
                        setPaySalaryForm({
                          ...paySalaryForm,
                          note: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="dg-modal-foot">
                <button
                  type="button"
                  className="dg-btn"
                  onClick={() => setShowPaySalaryModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dg-btn dg-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Processing..." : "Pay Salary"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DGEmployees;
