import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import "./b2b_invoices.css";

export default function B2B_Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== "all") params.status = filter;
      const response = await api.get("/b2b-partner/invoices", { params });
      if (response.data.success) {
        setInvoices(response.data.data.invoices || []);
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const getStatusClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "paid") return "b2b-inv-status-paid";
    if (s === "pending") return "b2b-inv-status-pending";
    if (s === "overdue") return "b2b-inv-status-overdue";
    return "b2b-inv-status-default";
  };

  if (loading) {
    return (
      <div className="b2b-invoices">
        <div className="b2b-inv-loading">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="b2b-invoices">
      <div className="b2b-inv-header">
        <h2 className="b2b-inv-title">Invoices & Payments</h2>
        <div className="b2b-inv-filters">
          {["all", "paid", "pending", "overdue"].map((f) => (
            <button
              key={f}
              className={`b2b-inv-filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="b2b-inv-error">{error}</div>}

      {invoices.length === 0 ? (
        <div className="b2b-inv-empty">
          <p>No invoices found{filter !== "all" ? ` with status "${filter}"` : ""}.</p>
        </div>
      ) : (
        <div className="b2b-inv-table-wrap">
          <table className="b2b-inv-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Corporate Client</th>
                <th>Contract</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id || inv.invoiceNumber}>
                  <td className="b2b-inv-num">{inv.invoiceNumber}</td>
                  <td>{inv.corporateName || inv.client || "N/A"}</td>
                  <td className="b2b-inv-num">{inv.contractNumber || "N/A"}</td>
                  <td>{inv.billingPeriod || "N/A"}</td>
                  <td className="b2b-inv-amount">
                    {inv.amount?.toLocaleString() || 0} {inv.currency || "KWD"}
                  </td>
                  <td>
                    <span className={`b2b-inv-status ${getStatusClass(inv.status)}`}>
                      {inv.status || "Pending"}
                    </span>
                  </td>
                  <td>
                    {inv.createdAt
                      ? new Date(inv.createdAt).toLocaleDateString()
                      : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {invoices.length > 0 && (
        <div className="b2b-inv-summary">
          <div className="b2b-inv-summary-item">
            <span className="b2b-inv-summary-label">Total Invoiced</span>
            <span className="b2b-inv-summary-value">
              {invoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()} KWD
            </span>
          </div>
          <div className="b2b-inv-summary-item">
            <span className="b2b-inv-summary-label">Paid</span>
            <span className="b2b-inv-summary-value b2b-inv-green">
              {invoices
                .filter((i) => i.status?.toLowerCase() === "paid")
                .reduce((s, i) => s + (i.amount || 0), 0)
                .toLocaleString()}{" "}
              KWD
            </span>
          </div>
          <div className="b2b-inv-summary-item">
            <span className="b2b-inv-summary-label">Outstanding</span>
            <span className="b2b-inv-summary-value b2b-inv-orange">
              {invoices
                .filter((i) => i.status?.toLowerCase() !== "paid")
                .reduce((s, i) => s + (i.amount || 0), 0)
                .toLocaleString()}{" "}
              KWD
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
