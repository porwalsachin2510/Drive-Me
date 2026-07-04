"use client";

import { getActiveCurrency } from "../../../config/localeConfig";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import "./AdminFinance.css";
import api from "../../../utils/api";

function AdminFinance() {
  const [activeTab, setActiveTab] = useState("payout");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    netEarnings: 0,
    pendingPayouts: 0,
    activeProviders: 0,
    totalTransactions: 0,
    monthlyRevenue: 0,
    commissionEarned: 0,
    securityDeposits: 0,
  });
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [payoutStats, setPayoutStats] = useState({ total: 0, pending: 0 });
  const [transactions, setTransactions] = useState([]);

  // Payment Modal State
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    payout: null,
    gatewayInfo: null,
  });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("MANUAL");
  const [transactionRef, setTransactionRef] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // Reject Modal State
  const [rejectModal, setRejectModal] = useState({ open: false, payout: null });
  const [rejectReason, setRejectReason] = useState("");

  // The admin's selected display currency (drives all amount conversions).
  const activeCurrency = useSelector((state) => state.locale?.currency);

  // Re-fetch whenever the admin switches the dashboard currency so every amount
  // comes back converted from the backend in the newly selected currency.
  useEffect(() => {
    fetchFinanceData();
  }, [activeCurrency]);

  const fetchFinanceData = async () => {
    try {
      setLoading(true);

      // Fetch metrics
      const metricsResponse = await api.get("/admin/finance/metrics");
      setMetrics(metricsResponse.data.metrics);

      // Fetch payout requests
      const payoutsResponse = await api.get("/admin/finance/payouts");
      setPayoutRequests(payoutsResponse.data.payouts || []);
      setPayoutStats(payoutsResponse.data.stats || { total: 0, pending: 0 });

      // Fetch transactions
      const transactionsResponse = await api.get("/admin/finance/transactions");
      setTransactions(transactionsResponse.data.transactions);
    } catch (error) {
      console.error("Error fetching finance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPaymentModal = async (payout) => {
    try {
      setActionLoading(payout._id);

      // Fetch gateway info to know available payment methods
      const response = await api.get(
        `/admin/finance/payouts/${payout._id}/gateway-info`,
      );

      setPaymentModal({
        open: true,
        payout,
        gatewayInfo: response.data.gatewayInfo,
      });
      setSelectedPaymentMethod("MANUAL"); // Default to manual
      setTransactionRef("");
      setAdminNotes("");
    } catch (error) {
      console.error("Error fetching gateway info:", error);
      // Open modal anyway with manual option only
      setPaymentModal({
        open: true,
        payout,
        gatewayInfo: {
          availableOptions: [
            {
              method: "MANUAL",
              label: "Manual Bank Transfer",
              available: true,
            },
          ],
        },
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (payout) => {
    if (
      !window.confirm(
        `Approve withdrawal request of ${formatCurrency(payout.totalAmount, payout.currency)} for ${payout.userInfo?.fullName}?`,
      )
    ) {
      return;
    }

    try {
      setActionLoading(payout._id);
      await api.put(`/admin/finance/payouts/${payout._id}/approve`, {
        adminNotes: "Approved by admin",
      });
      fetchFinanceData();
    } catch (error) {
      console.error("Error approving payout:", error);
      alert(error.response?.data?.message || "Error approving payout");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.payout) return;

    try {
      setActionLoading(rejectModal.payout._id);
      await api.put(`/admin/finance/payouts/${rejectModal.payout._id}/reject`, {
        reason: rejectReason || "Rejected by admin",
      });
      setRejectModal({ open: false, payout: null });
      setRejectReason("");
      fetchFinanceData();
    } catch (error) {
      console.error("Error rejecting payout:", error);
      alert(error.response?.data?.message || "Error rejecting payout");
    } finally {
      setActionLoading(null);
    }
  };

  const handleProcessPayment = async () => {
    if (!paymentModal.payout) return;

    try {
      setActionLoading(paymentModal.payout._id);

      if (selectedPaymentMethod === "MANUAL") {
        // Manual payment - mark as complete with bank reference
        await api.put(
          `/admin/finance/payouts/${paymentModal.payout._id}/complete`,
          {
            transactionReference: transactionRef,
            adminNotes,
          },
        );
      } else {
        // Automatic payment via gateway (STRIPE or TAP)
        const response = await api.put(
          `/admin/finance/payouts/${paymentModal.payout._id}/process-automatic`,
          {
            adminNotes,
          },
        );

        if (!response.data.success && response.data.canProcessManually) {
          alert(
            response.data.message + "\n\nPlease use manual transfer instead.",
          );
          return;
        }
      }

      setPaymentModal({ open: false, payout: null, gatewayInfo: null });
      setTransactionRef("");
      setAdminNotes("");
      setSelectedPaymentMethod("MANUAL");
      fetchFinanceData();

      alert("Payment processed successfully!");
    } catch (error) {
      console.error("Error processing payment:", error);
      alert(error.response?.data?.message || "Error processing payment");
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount, currency = null) => {
    const curr = currency || metrics.currency || getActiveCurrency();
    // Gulf currencies (KWD/BHD/OMR) use 3 decimal places.
    const decimals = ["KWD", "BHD", "OMR"].includes(curr) ? 3 : 2;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "#ffc107";
      case "APPROVED":
        return "#17a2b8";
      case "PROCESSING":
        return "#6f42c1";
      case "COMPLETED":
        return "#28a745";
      case "REJECTED":
        return "#dc3545";
      case "FAILED":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const maskIBAN = (iban) => {
    if (!iban) return "-";
    if (iban.length <= 8) return iban;
    return iban.substring(0, 4) + "****" + iban.substring(iban.length - 4);
  };

  const getCountryFlag = (currency) => {
    const flags = {
      AED: "🇦🇪",
      KWD: "🇰🇼",
      SAR: "🇸🇦",
      BHD: "🇧🇭",
      OMR: "🇴🇲",
      QAR: "🇶🇦",
    };
    return flags[currency] || "🌍";
  };

  const renderPayouts = () => (
    <div className="finance-section">
      <div className="section-header">
        <h3>Withdrawal Requests</h3>
        <div className="payout-stats">
          <div className="stat-card">
            <span className="stat-number">{payoutStats.total}</span>
            <span className="stat-label">Total Requests</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{payoutStats.pending}</span>
            <span className="stat-label">Pending</span>
          </div>
        </div>
      </div>

      {payoutRequests.length === 0 ? (
        <div className="empty-state">
          <p>No withdrawal requests found</p>
        </div>
      ) : (
        <div className="payouts-table">
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>User</th>
                <th>Role</th>
                <th>Amount</th>
                <th>Bank Details</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payoutRequests.map((payout) => (
                <tr key={payout._id}>
                  <td className="request-id">
                    <span className="country-flag">
                      {getCountryFlag(payout.currency)}
                    </span>
                    {payout.requestId}
                  </td>
                  <td>
                    <div className="user-info">
                      <span className="user-name">
                        {payout.userInfo?.fullName ||
                          payout.providerId?.fullName ||
                          "-"}
                      </span>
                      <span className="user-email">
                        {payout.userInfo?.email ||
                          payout.providerId?.email ||
                          ""}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`role-badge role-${payout.type?.toLowerCase()}`}
                    >
                      {payout.type?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="amount-cell">
                    {formatCurrency(
                      payout.displayAmount ?? payout.totalAmount,
                      payout.displayCurrency,
                    )}
                    {payout.displayCurrency &&
                      payout.currency &&
                      payout.displayCurrency !== payout.currency && (
                        <span className="amount-native-hint">
                          {formatCurrency(payout.totalAmount, payout.currency)}
                        </span>
                      )}
                  </td>
                  <td>
                    <div className="bank-info">
                      <span className="bank-name">{payout.bankName}</span>
                      <span className="bank-iban">{maskIBAN(payout.iban)}</span>
                      <span className="account-holder">
                        {payout.accountHolderName}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(payout.status) }}
                    >
                      {payout.status}
                    </span>
                    {payout.paymentMethod && payout.status !== "PENDING" && (
                      <span className="payment-method-badge">
                        {payout.paymentMethod}
                      </span>
                    )}
                  </td>
                  <td>{new Date(payout.createdAt).toLocaleDateString()}</td>
                  <td className="actions-cell">
                    {payout.status === "PENDING" && (
                      <>
                        <button
                          className="approve-btn"
                          onClick={() => handleApprove(payout)}
                          disabled={actionLoading === payout._id}
                        >
                          {actionLoading === payout._id ? "..." : "Approve"}
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => setRejectModal({ open: true, payout })}
                          disabled={actionLoading === payout._id}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {payout.status === "APPROVED" && (
                      <button
                        className="process-payment-btn"
                        onClick={() => handleOpenPaymentModal(payout)}
                        disabled={actionLoading === payout._id}
                      >
                        {actionLoading === payout._id
                          ? "..."
                          : "Process Payment"}
                      </button>
                    )}
                    {payout.status === "PROCESSING" && (
                      <span className="processing-text">
                        Processing via {payout.paymentMethod}...
                      </span>
                    )}
                    {payout.status === "COMPLETED" && (
                      <span className="completed-text">
                        {payout.transactionReference
                          ? `Ref: ${payout.transactionReference}`
                          : "Completed"}
                      </span>
                    )}
                    {payout.status === "REJECTED" && (
                      <span
                        className="rejected-text"
                        title={payout.rejectionReason}
                      >
                        {payout.rejectionReason?.substring(0, 20)}...
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Processing Modal */}
      {paymentModal.open && (
        <div
          className="modal-overlay"
          onClick={() =>
            setPaymentModal({ open: false, payout: null, gatewayInfo: null })
          }
        >
          <div
            className="modal-content payment-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Process Withdrawal Payment</h3>

            <div className="payment-summary">
              <div className="summary-row">
                <span className="label">User:</span>
                <span className="value">
                  {paymentModal.payout?.userInfo?.fullName ||
                    paymentModal.payout?.accountHolderName}
                </span>
              </div>
              <div className="summary-row">
                <span className="label">Amount:</span>
                <span className="value amount">
                  {formatCurrency(
                    paymentModal.payout?.totalAmount,
                    paymentModal.payout?.currency,
                  )}
                </span>
              </div>
              <div className="summary-row">
                <span className="label">Bank:</span>
                <span className="value">{paymentModal.payout?.bankName}</span>
              </div>
              <div className="summary-row">
                <span className="label">IBAN:</span>
                <span className="value">{paymentModal.payout?.iban}</span>
              </div>
              <div className="summary-row">
                <span className="label">Account Holder:</span>
                <span className="value">
                  {paymentModal.payout?.accountHolderName}
                </span>
              </div>
            </div>

            <div className="payment-method-selection">
              <h4>Select Payment Method</h4>
              <p className="subtitle">
                Choose how you want to process this payment
              </p>

              <div className="payment-options">
                {paymentModal.gatewayInfo?.availableOptions?.map((option) => (
                  <div
                    key={option.method}
                    className={`payment-option ${selectedPaymentMethod === option.method ? "selected" : ""} ${!option.available ? "disabled" : ""}`}
                    onClick={() =>
                      option.available &&
                      setSelectedPaymentMethod(option.method)
                    }
                  >
                    <div className="option-header">
                      <div className="option-icon">
                        {option.method === "MANUAL" && (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M3 9h18M3 15h18M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z" />
                          </svg>
                        )}
                        {option.method === "STRIPE" && (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                        {option.method === "TAP" && (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                        )}
                      </div>
                      <div className="option-info">
                        <span className="option-label">{option.label}</span>
                        <span className="option-description">
                          {option.description}
                        </span>
                      </div>
                      <div className="option-radio">
                        <input
                          type="radio"
                          checked={selectedPaymentMethod === option.method}
                          onChange={() =>
                            option.available &&
                            setSelectedPaymentMethod(option.method)
                          }
                          disabled={!option.available}
                        />
                      </div>
                    </div>
                    {!option.available && option.reason && (
                      <div className="option-unavailable-reason">
                        {option.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selectedPaymentMethod === "MANUAL" && (
              <div className="manual-payment-section">
                <div className="form-group">
                  <label>Transaction Reference / Bank Transfer ID</label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="Enter bank transfer reference number"
                  />
                  <span className="helper-text">
                    Enter the reference number from your bank transfer
                  </span>
                </div>
              </div>
            )}

            {(selectedPaymentMethod === "STRIPE" ||
              selectedPaymentMethod === "TAP") && (
              <div className="automatic-payment-section">
                <div className="info-box">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>
                    Payment will be processed automatically via{" "}
                    <strong>{selectedPaymentMethod}</strong>. The user will
                    receive the funds directly to their connected account.
                  </span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Admin Notes (Optional)</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Any notes about this payment"
              />
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() =>
                  setPaymentModal({
                    open: false,
                    payout: null,
                    gatewayInfo: null,
                  })
                }
              >
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={handleProcessPayment}
                disabled={
                  actionLoading ||
                  (selectedPaymentMethod === "MANUAL" && !transactionRef.trim())
                }
              >
                {actionLoading
                  ? "Processing..."
                  : selectedPaymentMethod === "MANUAL"
                    ? "Confirm Manual Payment"
                    : `Pay via ${selectedPaymentMethod}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div
          className="modal-overlay"
          onClick={() => setRejectModal({ open: false, payout: null })}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Withdrawal Request</h3>
            <p>
              Reject withdrawal request of{" "}
              <strong>
                {formatCurrency(
                  rejectModal.payout?.totalAmount,
                  rejectModal.payout?.currency,
                )}
              </strong>{" "}
              from {rejectModal.payout?.userInfo?.fullName}?
            </p>
            <p className="warning-text">
              The amount will be refunded to the user&apos;s wallet.
            </p>
            <div className="form-group">
              <label>Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection"
                required
              />
            </div>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setRejectModal({ open: false, payout: null })}
              >
                Cancel
              </button>
              <button
                className="reject-confirm-btn"
                onClick={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Reject Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTransactions = () => (
    <div className="finance-section">
      <div className="section-header">
        <h3>Transaction History</h3>
        <div className="transaction-stats">
          <div className="stat-card">
            <span className="stat-number">{transactions.length}</span>
            <span className="stat-label">Total Transactions</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {formatCurrency(metrics.totalRevenue)}
            </span>
            <span className="stat-label">Total Revenue</span>
          </div>
        </div>
      </div>

      <div className="transactions-table">
        <table>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Date</th>
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction._id}>
                <td className="transaction-id">{transaction._id}</td>
                <td>{new Date(transaction.createdAt).toLocaleDateString()}</td>
                <td>
                  <span
                    className={`type-badge type-${transaction.type?.toLowerCase()}`}
                  >
                    {transaction.type}
                  </span>
                </td>
                <td className="from-cell">
                  {transaction.from ||
                    transaction.fromName ||
                    transaction.userId?.fullName ||
                    "-"}
                </td>
                <td className="to-cell">
                  {transaction.to || transaction.toName || "-"}
                </td>
                <td className="amount-cell">
                  {formatCurrency(
                    transaction.displayAmount ?? transaction.amount,
                    transaction.displayCurrency,
                  )}
                  {transaction.displayCurrency &&
                    transaction.currency &&
                    transaction.displayCurrency !== transaction.currency && (
                      <span className="amount-native-hint">
                        {formatCurrency(
                          transaction.amount,
                          transaction.currency,
                        )}
                      </span>
                    )}
                </td>
                <td>
                  <span
                    className="status-badge"
                    style={{
                      backgroundColor: getStatusColor(transaction.status),
                    }}
                  >
                    {transaction.status || "COMPLETED"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMetrics = () => (
    <div className="finance-section">
      <div className="section-header">
        <h3>Financial Metrics</h3>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <h4>Total Revenue</h4>
          <span className="metric-value">
            {formatCurrency(metrics.totalRevenue)}
          </span>
          <div className="metric-change positive">+12.5%</div>
        </div>
        <div className="metric-card">
          <h4>Net Earnings</h4>
          <span className="metric-value">
            {formatCurrency(metrics.netEarnings)}
          </span>
          <div className="metric-change positive">+8.3%</div>
        </div>
        <div className="metric-card">
          <h4>Commission Earned</h4>
          <span className="metric-value">
            {formatCurrency(metrics.commissionEarned)}
          </span>
          <div className="metric-change positive">+15.2%</div>
        </div>
        <div className="metric-card">
          <h4>Security Deposits</h4>
          <span className="metric-value">
            {formatCurrency(metrics.securityDeposits)}
          </span>
          <div className="metric-change neutral">0%</div>
        </div>
        <div className="metric-card">
          <h4>Monthly Revenue</h4>
          <span className="metric-value">
            {formatCurrency(metrics.monthlyRevenue)}
          </span>
          <div className="metric-change positive">+5.7%</div>
        </div>
        <div className="metric-card">
          <h4>Active Providers</h4>
          <span className="metric-value">{metrics.activeProviders}</span>
          <div className="metric-change positive">+2</div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "payout":
        return renderPayouts();
      case "transactions":
        return renderTransactions();
      case "metrics":
        return renderMetrics();
      default:
        return renderPayouts();
    }
  };

  if (loading) {
    return (
      <div className="admin-finance">
        <div className="loading">Loading financial data...</div>
      </div>
    );
  }

  return (
    <div className="admin-finance">
      <div className="finance-header">
        <h2>Finance Management</h2>
        <div className="finance-overview">
          <div className="overview-item">
            <span className="overview-label">Total Revenue</span>
            <span className="overview-value">
              {formatCurrency(metrics.totalRevenue)}
            </span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Net Earnings</span>
            <span className="overview-value">
              {formatCurrency(metrics.netEarnings)}
            </span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Pending Payouts</span>
            <span className="overview-value">
              {formatCurrency(metrics.pendingPayouts)}
            </span>
          </div>
        </div>
      </div>

      <div className="finance-tabs">
        <button
          className={`finance-tab ${activeTab === "payout" ? "active" : ""}`}
          onClick={() => setActiveTab("payout")}
        >
          Withdrawals ({payoutStats.pending} pending)
        </button>
        <button
          className={`finance-tab ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          Transactions
        </button>
        <button
          className={`finance-tab ${activeTab === "metrics" ? "active" : ""}`}
          onClick={() => setActiveTab("metrics")}
        >
          Metrics
        </button>
      </div>

      <div className="finance-content">{renderContent()}</div>
    </div>
  );
}

export default AdminFinance;
