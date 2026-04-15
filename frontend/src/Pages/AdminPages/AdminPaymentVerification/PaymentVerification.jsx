"use client";

import { useEffect, useState } from "react";
import api from "../../../utils/api";
import PaymentBreakdown from "../../../Components/Corporate/PaymentBreakdown/PaymentBreakdown";
import "./PaymentVerification.css";

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
    currency: "AED",
  });

  useEffect(() => {
    fetchPendingPayments();
    fetchStats();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/payments/pending');
      setPendingPayments(response.data.payments);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/payments/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleViewDetails = async (paymentId) => {
    try {
      const response = await api.get(`/admin/payments/${paymentId}`);
      setSelectedPayment(response.data.payment);
      setShowModal(true);
    } catch (error) {
      console.error("Error fetching payment details:", error);
    }
  };

  const handleVerification = async (action) => {
    if (action === "REJECT" && !rejectionReason.trim()) {
      alert("Please provide a reason for rejection");
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
      case "PENDING": return "#ffc107";
      case "VERIFIED": return "#28a745";
      case "REJECTED": return "#dc3545";
      default: return "#6c757d"
    }
  };

  const formatCurrency = (amount, currency = null) => {
     const curr = currency || stats.currency || "AED";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
    }).format(amount);
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
                <td>{formatCurrency(payment.amount, payment.currency)}</td>
                <td>{payment.paymentType}</td>
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
                    onClick={() => handleViewDetails(payment._id)}
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
                      selectedPayment.amount,
                      selectedPayment.currency,
                    )}
                  </span>
                </div>
                <div className="drivemego-paymentverification-info-row">
                  <span className="drivemego-paymentverification-label">
                    Type:
                  </span>
                  <span className="drivemego-paymentverification-value">
                    {selectedPayment.paymentType}
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
              </div>

              <PaymentBreakdown payment={selectedPayment} />

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
