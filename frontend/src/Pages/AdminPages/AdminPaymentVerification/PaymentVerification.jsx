"use client";

import { getActiveCurrency } from "../../../config/localeConfig";
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import api from "../../../utils/api";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import PaymentBreakdown from "../../../Components/Corporate/PaymentBreakdown/PaymentBreakdown";
import "./PaymentVerification.css";
import { notify } from "../../../utils/toast";

const PaymentVerification = () => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [verificationAction, setVerificationAction] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [stats, setStats] = useState({
    totalPending: 0,
    totalVerified: 0,
    totalRejected: 0,
    totalAmount: 0,
    currency: getActiveCurrency(),
  });

  // Re-fetch when the admin changes the dashboard display currency so amounts
  // come back converted into that currency.
  const activeCurrency = useSelector((state) => state.locale?.currency);

  useEffect(() => {
    fetchPendingPayments();
    fetchStats();
  }, [activeCurrency]);

  const fetchPendingPayments = async ({ silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.get("/admin/payments/pending");
      setPendingPayments(response.data.payments);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Live auto-refresh: new cash/EMI payments land in this queue continuously,
  // so keep it current in the background instead of requiring a manual reload.
  const refreshPayments = useCallback(
    ({ silent } = {}) => {
      fetchPendingPayments({ silent });
      fetchStats();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [activeCurrency],
  );

  useAutoRefresh(refreshPayments, {
    interval: 15000,
    socketEvents: ["new-notification"],
    deps: [activeCurrency],
  });

  const fetchStats = async () => {
    try {
      const response = await api.get("/admin/payments/stats");
      setStats(response.data.stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleViewDetails = async (payment) => {
    // For EMI payments, use the payment object directly since it already has all details
    if (payment.paymentSource === "EMI") {
      setSelectedPayment(payment);
      setShowModal(true);
    } else {
      try {
        const response = await api.get(`/admin/payments/${payment._id}`);
        setSelectedPayment(response.data.payment);
        setShowModal(true);
      } catch (error) {
        console.error("Error fetching payment details:", error);
      }
    }
  };

  const handleVerification = async (action) => {
    if (action === "REJECT" && !rejectionReason.trim()) {
      notify("Please provide a reason for rejection");
      return;
    }

    try {
      await api.put(`/admin/payments/${selectedPayment._id}/verify`, {
        action,
        reason: rejectionReason,
      });

      setShowModal(false);
      setRejectionReason("");
      setSelectedPayment(null);
      fetchPendingPayments();
      fetchStats();
    } catch (error) {
      console.error("Error verifying payment:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "#ffc107";
      case "VERIFIED":
        return "#28a745";
      case "REJECTED":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const formatCurrency = (amount, currency = null) => {
    const curr = currency || stats.currency || getActiveCurrency();
    const decimals = ["KWD", "BHD", "OMR"].includes(curr) ? 3 : 2;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="drivemego-paymentverification-payment-verification">
        <div className="drivemego-paymentverification-loading">
          Loading payments...
        </div>
      </div>
    );
  }

  return (
    <div className="drivemego-paymentverification-payment-verification">
      <div className="drivemego-paymentverification-verification-header">
        <h2>Payment Verification</h2>
        <div className="drivemego-paymentverification-verification-stats">
          <div className="drivemego-paymentverification-stat-card">
            <span className="drivemego-paymentverification-stat-number">
              {stats.totalPending}
            </span>
            <span className="drivemego-paymentverification-stat-label">
              Pending
            </span>
          </div>
          <div className="drivemego-paymentverification-stat-card">
            <span className="drivemego-paymentverification-stat-number">
              {stats.totalVerified}
            </span>
            <span className="drivemego-paymentverification-stat-label">
              Verified
            </span>
          </div>
          <div className="drivemego-paymentverification-stat-card">
            <span className="drivemego-paymentverification-stat-number">
              {stats.totalRejected}
            </span>
            <span className="drivemego-paymentverification-stat-label">
              Rejected
            </span>
          </div>
          <div className="drivemego-paymentverification-stat-card">
            <span className="drivemego-paymentverification-stat-number">
              {formatCurrency(stats.totalAmount)}
            </span>
            <span className="drivemego-paymentverification-stat-label">
              Total Amount
            </span>
          </div>
        </div>
      </div>

      <div className="drivemego-paymentverification-payments-table">
        <table>
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Contract</th>
              <th>Corporate Owner</th>
              <th>Fleet Owner</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Method</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingPayments.map((payment) => (
              <tr key={payment._id}>
                <td>{payment._id}</td>
                <td>{payment.contractId?.contractNumber || "N/A"}</td>
                <td>{payment.corporateOwnerId?.fullName || "N/A"}</td>
                <td>{payment.fleetOwnerId?.fullName || "N/A"}</td>
                <td>
                  {formatCurrency(
                    payment.displayAmount ?? payment.amount,
                    payment.displayCurrency,
                  )}
                  {payment.displayCurrency &&
                    payment.currency &&
                    payment.displayCurrency !== payment.currency && (
                      <span className="drivemego-paymentverification-native-hint">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                    )}
                </td>
                <td>
                  <span
                    className={`drivemego-paymentverification-type-badge ${payment.paymentSource?.toLowerCase() || "regular"}`}
                  >
                    {payment.displayType || payment.paymentType}
                  </span>
                </td>
                <td>
                  <span
                    className={`drivemego-paymentverification-method-badge ${payment.paymentMethod?.toLowerCase()?.replace("_", "-") || "cash"}`}
                  >
                    {payment.paymentMethod === "BANK_TRANSFER"
                      ? "Bank Transfer"
                      : payment.paymentMethod || "CASH"}
                    {payment.paymentProvider && ` (${payment.paymentProvider})`}
                  </span>
                </td>
                <td>
                  <span
                    className="drivemego-paymentverification-status-badge"
                    style={{
                      backgroundColor: getStatusColor(
                        payment.verificationStatus,
                      ),
                    }}
                  >
                    {payment.verificationStatus}
                  </span>
                </td>
                <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="drivemego-paymentverification-view-btn"
                    onClick={() => handleViewDetails(payment)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingPayments.length === 0 && (
        <div className="drivemego-paymentverification-no-payments">
          <p>No pending payments found</p>
        </div>
      )}

      {/* Payment Details Modal */}
      {showModal && selectedPayment && (
        <div className="drivemego-paymentverification-modal-overlay">
          <div className="drivemego-paymentverification-modal">
            <div className="drivemego-paymentverification-modal-header">
              <h3>Payment Details</h3>
              <button
                className="drivemego-paymentverification-close-btn"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <div className="drivemego-paymentverification-modal-content">
              <div className="drivemego-paymentverification-payment-info">
                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Payment ID:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {selectedPayment._id}
                  </span>
                </div>
                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Contract:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {selectedPayment.contractId?.contractNumber}
                  </span>
                </div>
                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Corporate Owner:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {selectedPayment.corporateOwnerId?.fullName}
                  </span>
                </div>
                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Fleet Owner:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {selectedPayment.fleetOwnerId?.fullName}
                  </span>
                </div>
                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Amount:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {formatCurrency(
                      selectedPayment.displayAmount ?? selectedPayment.amount,
                      selectedPayment.displayCurrency,
                    )}
                    {selectedPayment.displayCurrency &&
                      selectedPayment.currency &&
                      selectedPayment.displayCurrency !==
                        selectedPayment.currency && (
                        <span className="drivemego-paymentverification-native-hint">
                          {formatCurrency(
                            selectedPayment.amount,
                            selectedPayment.currency,
                          )}
                        </span>
                      )}
                  </span>
                </div>
                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Type:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {selectedPayment.displayType || selectedPayment.paymentType}
                  </span>
                </div>

                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Status:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {selectedPayment.verificationStatus}
                  </span>
                </div>
                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Created:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {new Date(selectedPayment.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Payment Method:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {selectedPayment.paymentMethod || "CASH"}
                    {selectedPayment.paymentProvider &&
                      ` via ${selectedPayment.paymentProvider}`}
                  </span>
                </div>
                {/* Gateway Payment Details */}
                {selectedPayment.paymentProvider && (
                  <>
                    <div className="drivemego-paymentverification-info-row">
                      <span className="drivemego-paymentverification-label">
                        Payment Status:
                      </span>
                      <span
                        className={`drivemego-paymentverification-value payment-status-${selectedPayment.status?.toLowerCase()}`}
                      >
                        {selectedPayment.status}
                      </span>
                    </div>
                    {selectedPayment.gatewayTransactionId && (
                      <div className="drivemego-paymentverification-info-row">
                        <span className="drivemego-paymentverification-label">
                          Transaction ID:
                        </span>
                        <span className="drivemego-paymentverification-value">
                          {selectedPayment.gatewayTransactionId}
                        </span>
                      </div>
                    )}
                    {selectedPayment.verifiedAt && (
                      <div className="drivemego-paymentverification-info-row">
                        <span className="drivemego-paymentverification-label">
                          Gateway Verified:
                        </span>
                        <span className="drivemego-paymentverification-value">
                          {new Date(
                            selectedPayment.verifiedAt,
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <PaymentBreakdown payment={selectedPayment} />

              {/* Gateway Payment Notice */}
              {selectedPayment.paymentProvider &&
                selectedPayment.status === "COMPLETED" && (
                  <div className="drivemego-paymentverification-gateway-notice">
                    <div className="gateway-notice-icon">&#10003;</div>
                    <div className="gateway-notice-content">
                      <strong>Payment Gateway Verified</strong>
                      <p>
                        This payment was completed via{" "}
                        {selectedPayment.paymentProvider}. Transaction ID:{" "}
                        {selectedPayment.gatewayTransactionId || "N/A"}
                      </p>
                    </div>
                  </div>
                )}

              <div className="drivemego-paymentverification-verification-actions">
                <div className="drivemego-paymentverification-action-buttons">
                  <button
                    className="drivemego-paymentverification-approve-btn"
                    onClick={() => {
                      setVerificationAction("APPROVE");
                      handleVerification("APPROVE");
                    }}
                  >
                    Approve Payment
                  </button>

                  <button
                    className="drivemego-paymentverification-reject-btn"
                    onClick={() => setVerificationAction("REJECT")}
                  >
                    Reject Payment
                  </button>
                </div>

                {verificationAction === "REJECT" && (
                  <div className="drivemego-paymentverification-rejection-form">
                    <label>Rejection Reason:</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      rows={4}
                    />
                    <div className="drivemego-paymentverification-rejection-actions">
                      <button
                        className="drivemego-paymentverification-cancel-btn"
                        onClick={() => setVerificationAction("")}
                      >
                        Cancel
                      </button>
                      <button
                        className="drivemego-paymentverification-confirm-reject-btn"
                        onClick={() => handleVerification("REJECT")}
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentVerification;
