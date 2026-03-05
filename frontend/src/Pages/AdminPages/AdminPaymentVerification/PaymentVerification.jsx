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
    totalAmount: 0
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

  const formatCurrency = (amount, currency = 'KWD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="payment-verification">
        <div className="loading">Loading payments...</div>
      </div>
    );
  }

  return (
    <div className="payment-verification">
      <div className="verification-header">
        <h2>Payment Verification</h2>
        <div className="verification-stats">
          <div className="stat-card">
            <span className="stat-number">{stats.totalPending}</span>
            <span className="stat-label">Pending</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.totalVerified}</span>
            <span className="stat-label">Verified</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.totalRejected}</span>
            <span className="stat-label">Rejected</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{formatCurrency(stats.totalAmount)}</span>
            <span className="stat-label">Total Amount</span>
          </div>
        </div>
      </div>

      <div className="payments-table">
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
                <td>{payment.contractId?.contractNumber || 'N/A'}</td>
                <td>{payment.corporateOwnerId?.fullName || 'N/A'}</td>
                <td>{payment.fleetOwnerId?.fullName || 'N/A'}</td>
                <td>{formatCurrency(payment.amount)}</td>
                <td>{payment.paymentType}</td>
                <td>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor(payment.verificationStatus) }}
                  >
                    {payment.verificationStatus}
                  </span>
                </td>
                <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                <td>
                  <button 
                    className="view-btn"
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
        <div className="no-payments">
          <p>No pending payments found</p>
        </div>
      )}

      {/* Payment Details Modal */}
      {showModal && selectedPayment && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Payment Details</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="payment-info">
                <div className="info-row">
                  <span className="label">Payment ID:</span>
                  <span className="value">{selectedPayment._id}</span>
                </div>
                <div className="info-row">
                  <span className="label">Contract:</span>
                  <span className="value">{selectedPayment.contractId?.contractNumber}</span>
                </div>
                <div className="info-row">
                  <span className="label">Corporate Owner:</span>
                  <span className="value">{selectedPayment.corporateOwnerId?.fullName}</span>
                </div>
                <div className="info-row">
                  <span className="label">Fleet Owner:</span>
                  <span className="value">{selectedPayment.fleetOwnerId?.fullName}</span>
                </div>
                <div className="info-row">
                  <span className="label">Amount:</span>
                  <span className="value">{formatCurrency(selectedPayment.amount)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Type:</span>
                  <span className="value">{selectedPayment.paymentType}</span>
                </div>
                <div className="info-row">
                  <span className="label">Status:</span>
                  <span className="value">{selectedPayment.verificationStatus}</span>
                </div>
                <div className="info-row">
                  <span className="label">Created:</span>
                  <span className="value">{new Date(selectedPayment.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <PaymentBreakdown payment={selectedPayment} />

              <div className="verification-actions">
                <div className="action-buttons">
                  <button 
                    className="approve-btn"
                    onClick={() => {
                      setVerificationAction("APPROVE");
                      handleVerification("APPROVE");
                    }}
                  >
                    Approve Payment
                  </button>
                  
                  <button 
                    className="reject-btn"
                    onClick={() => setVerificationAction("REJECT")}
                  >
                    Reject Payment
                  </button>
                </div>

                {verificationAction === "REJECT" && (
                  <div className="rejection-form">
                    <label>Rejection Reason:</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      rows={4}
                    />
                    <div className="rejection-actions">
                      <button 
                        className="cancel-btn"
                        onClick={() => setVerificationAction("")}
                      >
                        Cancel
                      </button>
                      <button 
                        className="confirm-reject-btn"
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
