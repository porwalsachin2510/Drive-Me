import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import "./corporatebilling.css";

export default function CorporateBilling() {
  const [billingData, setBillingData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("current");
  const [error, setError] = useState(null);

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
              {billingData.summary?.currency || "KWD"}
            </div>
          </div>
          <div className="corp-billing-card">
            <div className="corp-billing-card-label">Total Paid</div>
            <div className="corp-billing-card-value corp-billing-green">
              {billingData.summary?.totalPaid?.toLocaleString() || 0}{" "}
              {billingData.summary?.currency || "KWD"}
            </div>
          </div>
          <div className="corp-billing-card">
            <div className="corp-billing-card-label">Outstanding</div>
            <div className="corp-billing-card-value corp-billing-orange">
              {billingData.summary?.outstanding?.toLocaleString() || 0}{" "}
              {billingData.summary?.currency || "KWD"}
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
                      {item.currency || "KWD"}
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
        <h3 className="corp-billing-section-title">Recent Invoices</h3>
        {invoices.length === 0 ? (
          <div className="corp-billing-empty">No invoices found</div>
        ) : (
          <div className="corp-billing-table-wrap">
            <table className="corp-billing-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Contract</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id || inv.invoiceNumber}>
                    <td className="corp-billing-contract-num">
                      {inv.invoiceNumber}
                    </td>
                    <td>{inv.contractNumber || "N/A"}</td>
                    <td>
                      {inv.createdAt
                        ? new Date(inv.createdAt).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="corp-billing-amount">
                      {inv.amount?.toLocaleString() || 0}{" "}
                      {inv.currency || "KWD"}
                    </td>
                    <td>
                      <span
                        className={`corp-billing-status corp-billing-status-${(
                          inv.status || "pending"
                        ).toLowerCase()}`}
                      >
                        {inv.status || "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
