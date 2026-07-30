import React, { useState, useEffect, useCallback } from "react";
import {
  FiCreditCard,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiX,
  FiCheck,
  FiExternalLink,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";
import * as demandAPI from "../../../services/demandAPI";

const CATEGORIES = [
  "TRAVEL",
  "FUEL",
  "MEALS",
  "ACCOMMODATION",
  "MARKETING",
  "OTHER",
];
const catLabel = (c) => c.charAt(0) + c.slice(1).toLowerCase();

const approvalBadge = (s) =>
  ({
    PENDING: "dg-badge-amber",
    APPROVED: "dg-badge-green",
    REJECTED: "dg-badge-red",
  })[s] || "dg-badge-gray";

const emptyForm = {
  employee: "",
  category: "TRAVEL",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  description: "",
  receiptUrl: "",
};

const DGExpenses = () => {
  const activeCurrency = useSelector((s) => s.locale?.currency) || "AED";
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await demandAPI.getExpenses({
        category: categoryFilter,
        approvalStatus: approvalFilter,
        employee: employeeFilter,
      });
      setExpenses(res.data || []);
      setTotalAmount(res.totalAmount || 0);
      setApprovedAmount(res.approvedAmount || 0);
    } catch (e) {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, approvalFilter, employeeFilter, activeCurrency]);

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
    fetchEmployees();
  }, [fetchEmployees]);
  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee || form.amount === "") {
      toast.error("Employee and amount are required");
      return;
    }
    try {
      setSubmitting(true);
      await demandAPI.createExpense(form);
      toast.success("Expense recorded");
      setShowModal(false);
      setForm(emptyForm);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async (exp, status) => {
    let rejectionReason = "";
    if (status === "REJECTED") {
      rejectionReason = window.prompt("Rejection reason (optional):") || "";
    }
    try {
      await demandAPI.updateExpenseApproval(exp._id, {
        approvalStatus: status,
        rejectionReason,
      });
      toast.success(`Expense ${status.toLowerCase()}`);
      fetchExpenses();
    } catch (err) {
      toast.error("Failed to update approval");
    }
  };

  const handlePayment = async (exp) => {
    try {
      await demandAPI.updateExpensePayment(exp._id, "PAID");
      toast.success("Marked paid");
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update payment");
    }
  };

  const handleDelete = async (exp) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await demandAPI.deleteExpense(exp._id);
      toast.success("Deleted");
      fetchExpenses();
    } catch (err) {
      toast.error("Failed to delete");
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
          <h2>Expense Management</h2>
          <p>
            Record, approve and settle acquisition-employee operational
            expenses.
          </p>
        </div>
        <button
          className="dg-btn dg-btn-primary"
          onClick={() => {
            setForm(emptyForm);
            setShowModal(true);
          }}
        >
          <FiPlus /> Record Expense
        </button>
      </div>

      <div className="dg-stats">
        <div className="dg-stat dg-stat-accent-blue">
          <div className="dg-stat-label">Total (filtered)</div>
          <div className="dg-stat-value">{money(totalAmount)}</div>
        </div>
        <div className="dg-stat dg-stat-accent-green">
          <div className="dg-stat-label">Approved</div>
          <div className="dg-stat-value">{money(approvedAmount)}</div>
        </div>
      </div>

      <div className="dg-filters">
        <select
          className="dg-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {catLabel(c)}
            </option>
          ))}
        </select>
        <select
          className="dg-select"
          value={approvalFilter}
          onChange={(e) => setApprovalFilter(e.target.value)}
        >
          <option value="">All Approval</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
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
        <button className="dg-btn" onClick={fetchExpenses}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="dg-table-wrap">
        {loading ? (
          <div className="dg-loading">
            <div className="dg-spinner" />
            <p>Loading...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="dg-empty">
            <FiCreditCard />
            <h3>No expenses</h3>
            <p>Record an expense to get started.</p>
          </div>
        ) : (
          <table className="dg-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Receipt</th>
                <th>Approval</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp._id}>
                  <td>
                    <div className="dg-cell-strong">
                      {exp.employee?.fullName || "-"}
                    </div>
                    <div className="dg-code">{exp.employee?.employeeCode}</div>
                  </td>
                  <td>
                    <span className="dg-badge dg-badge-gray">
                      {catLabel(exp.category)}
                    </span>
                    {exp.description && (
                      <div className="dg-cell-muted">{exp.description}</div>
                    )}
                  </td>
                  <td className="dg-cell-strong">{money(exp.amount)}</td>
                  <td>{new Date(exp.date).toLocaleDateString()}</td>
                  <td>
                    {exp.receiptUrl ? (
                      <a
                        href={exp.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="dg-icon-btn"
                        title="View receipt"
                      >
                        <FiExternalLink />
                      </a>
                    ) : (
                      <span className="dg-cell-muted">-</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`dg-badge ${approvalBadge(exp.approvalStatus)}`}
                    >
                      {exp.approvalStatus}
                    </span>
                    {exp.approvalStatus === "REJECTED" &&
                      exp.rejectionReason && (
                        <div className="dg-cell-muted">
                          {exp.rejectionReason}
                        </div>
                      )}
                  </td>
                  <td>
                    <span
                      className={`dg-badge ${exp.paymentStatus === "PAID" ? "dg-badge-green" : "dg-badge-gray"}`}
                    >
                      {exp.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <div className="dg-row-actions">
                      {exp.approvalStatus === "PENDING" && (
                        <>
                          <button
                            className="dg-btn dg-btn-sm dg-btn-success"
                            onClick={() => handleApproval(exp, "APPROVED")}
                          >
                            Approve
                          </button>
                          <button
                            className="dg-btn dg-btn-sm dg-btn-danger"
                            onClick={() => handleApproval(exp, "REJECTED")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {exp.approvalStatus === "APPROVED" &&
                        exp.paymentStatus === "UNPAID" && (
                          <button
                            className="dg-btn dg-btn-sm"
                            onClick={() => handlePayment(exp)}
                          >
                            <FiCheck /> Pay
                          </button>
                        )}
                      <button
                        className="dg-icon-btn danger"
                        title="Delete"
                        onClick={() => handleDelete(exp)}
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
          <div className="dg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dg-modal-head">
              <h3>Record Expense</h3>
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
                    <label>Employee *</label>
                    <select
                      value={form.employee}
                      onChange={(e) =>
                        setForm({ ...form, employee: e.target.value })
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
                    <label>Category *</label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {catLabel(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="dg-field">
                    <label>Amount ({activeCurrency}) *</label>
                    <input
                      type="number"
                      min="0"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                    />
                  </div>
                  <div className="dg-field">
                    <label>Receipt URL</label>
                    <input
                      value={form.receiptUrl}
                      placeholder="https://..."
                      onChange={(e) =>
                        setForm({ ...form, receiptUrl: e.target.value })
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
                  {submitting ? "Saving..." : "Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DGExpenses;
