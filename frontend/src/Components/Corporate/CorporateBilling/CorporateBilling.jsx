import { getActiveCurrency } from "../../../config/localeConfig";
import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import "./corporatebilling.css";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A";

const TYPE_LABELS = {
  ADVANCE: "Advance",
  FINAL: "Final",
  INSTALLMENT: "EMI",
  SECURITY_DEPOSIT: "Deposit",
  MONTHLY: "Full",
};

export default function CorporateBilling() {
  const [billingData, setBillingData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("current");
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBillingData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/corporate/billing-report", {
        params: { period },
      });
      if (response.data.success) {
        setBillingData(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching billing data:", err);
      setError("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await api.get("/corporate/invoices");
      if (response.data.success) {
        setInvoices(response.data.data.invoices || []);
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
    }
  }, []);

  useEffect(() => {
    fetchBillingData();
    fetchInvoices();
  }, [fetchBillingData, fetchInvoices]);

  const handlePay = async (inv) => {
    try {
      setActionId(inv._id);
      const res = await api.get(`/corporate/invoices/${inv._id}/payment-redirect`);
      if (res.data.success && res.data.data?.redirectUrl) {
        window.location.href = res.data.data.redirectUrl;
      } else {
        showToast("Could not initiate payment", "error");
        setActionId(null);
      }
    } catch (err) {
      console.error("Payment redirect failed:", err);
      showToast(err.response?.data?.message || "Failed to initiate payment", "error");
      setActionId(null);
    }
  };

  const handleDownload = async (inv) => {
    try {
      setActionId(inv._id);
      const res = await api.get(`/corporate/invoices/${inv._id}/pdf`, { responseType: "blob" });
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

  if (loading) {
    return (
      <div className="corp-billing">
        <div className="corp-billing-loading">Loading billing information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="corp-billing">
        <div className="corp-billing-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="corp-billing">
      <div className="corp-billing-header">
        <h2 className="corp-billing-title">Billing & Invoices</h2>
        <div className="corp-billing-period-select">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="corp-billing-select"
          >
            <option value="current">Current Month</option>
            <option value="last">Last Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {billingData && (
        <div className="corp-billing-summary">
          <div className="corp-billing-card">
            <div className="corp-billing-card-label">Total Billed</div>
            <div className="corp-billing-card-value">
              {billingData.summary?.totalBilled?.toLocaleString() || 0}{" "}
              {billingData.summary?.currency || getActiveCurrency()}
            </div>
          </div>
          <div className="corp-billing-card">
            <div className="corp-billing-card-label">Total Paid</div>
            <div className="corp-billing-card-value corp-billing-green">
              {billingData.summary?.totalPaid?.toLocaleString() || 0}{" "}
              {billingData.summary?.currency || getActiveCurrency()}
            </div>
          </div>
          <div className="corp-billing-card">
            <div className="corp-billing-card-label">Outstanding</div>
            <div className="corp-billing-card-value corp-billing-orange">
              {billingData.summary?.outstanding?.toLocaleString() || 0}{" "}
              {billingData.summary?.currency || getActiveCurrency()}
            </div>
          </div>
          <div className="corp-billing-card">
            <div className="corp-billing-card-label">Active Contracts</div>
            <div className="corp-billing-card-value">
              {billingData.summary?.activeContracts || 0}
            </div>
          </div>
        </div>
      )}

      {/* Contract-wise Breakdown */}
      {billingData?.contractBreakdown?.length > 0 && (
        <div className="corp-billing-section">
          <h3 className="corp-billing-section-title">Contract-wise Breakdown</h3>
          <div className="corp-billing-table-wrap">
            <table className="corp-billing-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Fleet Partner</th>
                  <th>Period</th>
                  <th>Vehicles</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {billingData.contractBreakdown.map((item) => (
                  <tr key={item.contractId}>
                    <td className="corp-billing-contract-num">
                      {item.contractNumber || item.contractId?.slice(-6)}
                    </td>
                    <td>{item.fleetOwnerName || "N/A"}</td>
                    <td>
                      {item.startDate
                        ? new Date(item.startDate).toLocaleDateString()
                        : "N/A"}{" "}
                      -{" "}
                      {item.endDate
                        ? new Date(item.endDate).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td>{item.vehicleCount || 0}</td>
                    <td className="corp-billing-amount">
                      {item.monthlyAmount?.toLocaleString() || 0}{" "}
                      {item.currency || getActiveCurrency()}
                    </td>
                    <td>
                      <span
                        className={`corp-billing-status corp-billing-status-${(
                          item.paymentStatus || "pending"
                        ).toLowerCase()}`}
                      >
                        {item.paymentStatus || "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices */}
      <div className="corp-billing-section">
        <h3 className="corp-billing-section-title">Invoices &amp; Payments</h3>
        {invoices.length === 0 ? (
          <div className="corp-billing-empty">No invoices found</div>
        ) : (
          <div className="corp-billing-table-wrap">
            <table className="corp-billing-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Fleet Partner</th>
                  <th>Type</th>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id || inv.invoiceNumber}>
                    <td className="corp-billing-contract-num">
                      {inv.invoiceNumber}
                    </td>
                    <td>{inv.fleetOwnerName || "N/A"}</td>
                    <td>{TYPE_LABELS[inv.type] || inv.type || "N/A"}</td>
                    <td>{inv.billingPeriod?.label || "N/A"}</td>
                    <td className="corp-billing-amount">
                      {(inv.total ?? inv.amount ?? 0).toLocaleString()}{" "}
                      {inv.currency || getActiveCurrency()}
                    </td>
                    <td>{formatDate(inv.dueDate)}</td>
                    <td>
                      <span
                        className={`corp-billing-status corp-billing-status-${(
                          inv.status || "pending"
                        ).toLowerCase()}`}
                      >
                        {inv.status || "Pending"}
                      </span>
                    </td>
                    <td>
                      <div className="corp-billing-actions">
                        <button
                          className="corp-billing-act-btn"
                          disabled={actionId === inv._id}
                          onClick={() => handleDownload(inv)}
                        >
                          PDF
                        </button>
                        {inv.status !== "PAID" && inv.status !== "DRAFT" && (
                          <button
                            className="corp-billing-act-btn pay"
                            disabled={actionId === inv._id}
                            onClick={() => handlePay(inv)}
                          >
                            {actionId === inv._id ? "Paying..." : "Pay Now"}
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
      </div>

      {toast && <div className={`corp-billing-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
