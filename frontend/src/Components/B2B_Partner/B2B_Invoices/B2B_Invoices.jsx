import { getActiveCurrency } from "../../../config/localeConfig";
import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import "./b2b_invoices.css";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A";

const TYPE_LABELS = {
  ADVANCE: "Advance",
  FINAL: "Final",
  INSTALLMENT: "EMI",
  SECURITY_DEPOSIT: "Deposit",
  MONTHLY: "Full",
};

export default function B2B_Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== "all") params.status = filter;
      const response = await api.get("/b2b-partner/invoices", { params });
      if (response.data.success) {
        setInvoices(response.data.data.invoices || []);
        setSummary(response.data.data.summary || null);
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

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getStatusClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "paid") return "b2b-inv-status-paid";
    if (s === "pending" || s === "sent") return "b2b-inv-status-pending";
    if (s === "overdue") return "b2b-inv-status-overdue";
    if (s === "draft") return "b2b-inv-status-default";
    return "b2b-inv-status-default";
  };

  const handleSend = async (inv, isReminder) => {
    try {
      setActionId(inv._id);
      const res = await api.post(`/b2b-partner/invoices/${inv._id}/send`, { isReminder });
      if (res.data.success) {
        showToast(isReminder ? "Reminder sent to client" : "Invoice sent to client");
        await fetchInvoices();
        if (selected?._id === inv._id) setSelected(res.data.data.invoice);
      }
    } catch (err) {
      console.error("Send failed:", err);
      showToast(err.response?.data?.message || "Failed to send invoice", "error");
    } finally {
      setActionId(null);
    }
  };

  const handleDownload = async (inv) => {
    try {
      setActionId(inv._id);
      const res = await api.get(`/b2b-partner/invoices/${inv._id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${inv.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      showToast("Failed to download PDF", "error");
    } finally {
      setActionId(null);
    }
  };

  const currency = summary?.currency || invoices[0]?.currency || getActiveCurrency();

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
        <h2 className="b2b-inv-title">Invoices &amp; Payments</h2>
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

      {/* Summary cards */}
      {summary && (
        <div className="b2b-inv-cards">
          <div className="b2b-inv-card">
            <span className="b2b-inv-card-label">Total Invoiced</span>
            <span className="b2b-inv-card-value">
              {summary.totalInvoiced.toLocaleString()} {currency}
            </span>
          </div>
          <div className="b2b-inv-card">
            <span className="b2b-inv-card-label">Paid</span>
            <span className="b2b-inv-card-value b2b-inv-green">
              {summary.paid.toLocaleString()} {currency}
            </span>
          </div>
          <div className="b2b-inv-card">
            <span className="b2b-inv-card-label">Outstanding</span>
            <span className="b2b-inv-card-value b2b-inv-orange">
              {summary.outstanding.toLocaleString()} {currency}
            </span>
          </div>
          <div className="b2b-inv-card">
            <span className="b2b-inv-card-label">Overdue</span>
            <span className="b2b-inv-card-value b2b-inv-red">
              {summary.overdue.toLocaleString()} {currency}
            </span>
          </div>
        </div>
      )}

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
                <th>Type</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id} onClick={() => setSelected(inv)} className="b2b-inv-row">
                  <td className="b2b-inv-num">{inv.invoiceNumber}</td>
                  <td>{inv.corporateName || "N/A"}</td>
                  <td>
                    <span className="b2b-inv-type">{TYPE_LABELS[inv.type] || inv.type}</span>
                  </td>
                  <td>{inv.billingPeriod?.label || "N/A"}</td>
                  <td className="b2b-inv-amount">
                    {(inv.total || 0).toLocaleString()} {inv.currency}
                  </td>
                  <td>
                    <span className={`b2b-inv-status ${getStatusClass(inv.status)}`}>{inv.status}</span>
                  </td>
                  <td>{formatDate(inv.dueDate)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="b2b-inv-actions">
                      <button
                        className="b2b-inv-act-btn"
                        disabled={actionId === inv._id}
                        onClick={() => handleDownload(inv)}
                        title="Download PDF"
                      >
                        PDF
                      </button>
                      {inv.status !== "PAID" && (
                        <button
                          className="b2b-inv-act-btn primary"
                          disabled={actionId === inv._id}
                          onClick={() => handleSend(inv, !!inv.sentAt)}
                          title={inv.sentAt ? "Send reminder" : "Send invoice"}
                        >
                          {inv.sentAt ? "Remind" : "Send"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="b2b-inv-modal-overlay" onClick={() => setSelected(null)}>
          <div className="b2b-inv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="b2b-inv-modal-head">
              <div>
                <h3 className="b2b-inv-modal-num">{selected.invoiceNumber}</h3>
                <span className={`b2b-inv-status ${getStatusClass(selected.status)}`}>{selected.status}</span>
              </div>
              <button className="b2b-inv-modal-close" onClick={() => setSelected(null)} aria-label="Close">
                &times;
              </button>
            </div>

            <div className="b2b-inv-modal-grid">
              <div>
                <span className="b2b-inv-meta-label">Bill To</span>
                <p className="b2b-inv-meta-val">{selected.corporateName}</p>
              </div>
              <div>
                <span className="b2b-inv-meta-label">Contract</span>
                <p className="b2b-inv-meta-val">{selected.contractNumber || "N/A"}</p>
              </div>
              <div>
                <span className="b2b-inv-meta-label">Issue Date</span>
                <p className="b2b-inv-meta-val">{formatDate(selected.issueDate)}</p>
              </div>
              <div>
                <span className="b2b-inv-meta-label">Due Date</span>
                <p className="b2b-inv-meta-val">{formatDate(selected.dueDate)}</p>
              </div>
              <div>
                <span className="b2b-inv-meta-label">Type</span>
                <p className="b2b-inv-meta-val">{TYPE_LABELS[selected.type] || selected.type}</p>
              </div>
              <div>
                <span className="b2b-inv-meta-label">Billing Period</span>
                <p className="b2b-inv-meta-val">{selected.billingPeriod?.label || "N/A"}</p>
              </div>
            </div>

            <table className="b2b-inv-line-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(selected.lineItems || []).map((li, i) => (
                  <tr key={i}>
                    <td>{li.description}</td>
                    <td>{li.quantity}</td>
                    <td>{(li.unitPrice || 0).toLocaleString()}</td>
                    <td>
                      {(li.amount || 0).toLocaleString()} {selected.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="b2b-inv-modal-totals">
              <div className="b2b-inv-total-row">
                <span>Subtotal</span>
                <span>
                  {(selected.subtotal || 0).toLocaleString()} {selected.currency}
                </span>
              </div>
              {selected.taxRate > 0 && (
                <div className="b2b-inv-total-row">
                  <span>Tax ({selected.taxRate}%)</span>
                  <span>
                    {(selected.taxAmount || 0).toLocaleString()} {selected.currency}
                  </span>
                </div>
              )}
              <div className="b2b-inv-total-row grand">
                <span>Total</span>
                <span>
                  {(selected.total || 0).toLocaleString()} {selected.currency}
                </span>
              </div>
            </div>

            {selected.paidAt && (
              <p className="b2b-inv-paid-note">
                Paid on {formatDate(selected.paidAt)}
                {selected.transactionId ? ` · Txn ${selected.transactionId}` : ""}
              </p>
            )}

            <div className="b2b-inv-modal-actions">
              <button className="b2b-inv-act-btn" onClick={() => handleDownload(selected)} disabled={actionId === selected._id}>
                Download PDF
              </button>
              {selected.status !== "PAID" && (
                <button
                  className="b2b-inv-act-btn primary"
                  onClick={() => handleSend(selected, !!selected.sentAt)}
                  disabled={actionId === selected._id}
                >
                  {selected.sentAt ? "Send Reminder" : "Send Invoice"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`b2b-inv-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
