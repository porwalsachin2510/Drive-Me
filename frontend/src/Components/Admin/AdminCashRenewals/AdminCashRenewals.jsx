"use client";

import { useEffect, useState } from "react";
import api from "../../../utils/api";
import "./AdminCashRenewals.css";

function AdminCashRenewals() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [error, setError] = useState("");

  const fetchPendingCashRenewals = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/subscription-settings/admin/pending-cash");
      setRequests(res.data?.data || []);
    } catch (err) {
      console.error("Error fetching pending cash renewals:", err);
      setError("Failed to load pending cash renewals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCashRenewals();
  }, []);

  const handleConfirm = async (req) => {
    const ok = window.confirm(
      `Confirm that you received ${formatCurrency(req.amount)} cash from ${
        req.userName || "this commuter"
      }? This will activate their monthly pass.`,
    );
    if (!ok) return;

    try {
      setConfirmingId(req.userId);
      await api.post("/subscription-settings/admin/confirm-cash", {
        userId: req.userId,
        passId: req.passId,
      });
      await fetchPendingCashRenewals();
    } catch (err) {
      console.error("Error confirming cash renewal:", err);
      alert(
        err?.response?.data?.message ||
          "Failed to confirm the cash renewal. Please try again.",
      );
    } finally {
      setConfirmingId(null);
    }
  };

  const formatCurrency = (amount) => {
    const value = Number(amount) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="acr-container">
      <div className="acr-header">
        <div>
          <h2 className="acr-title">Cash Renewal Requests</h2>
          <p className="acr-subtitle">
            Commuters who chose to pay cash for their monthly pass renewal.
            Confirm once you have collected the cash to activate their pass.
          </p>
        </div>
        <button
          className="acr-refresh-btn"
          onClick={fetchPendingCashRenewals}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="acr-summary">
        <div className="acr-summary-card">
          <span className="acr-summary-value">{requests.length}</span>
          <span className="acr-summary-label">Pending Requests</span>
        </div>
        <div className="acr-summary-card">
          <span className="acr-summary-value">
            {formatCurrency(
              requests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
            )}
          </span>
          <span className="acr-summary-label">Total To Collect</span>
        </div>
      </div>

      {error && <div className="acr-error">{error}</div>}

      {loading ? (
        <div className="acr-loading">Loading cash renewal requests...</div>
      ) : requests.length === 0 ? (
        <div className="acr-empty">
          <p>No pending cash renewal requests right now.</p>
        </div>
      ) : (
        <div className="acr-table-wrapper">
          <table className="acr-table">
            <thead>
              <tr>
                <th>Commuter</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Amount</th>
                <th>Requested At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={`${req.userId}-${req.passId}`}>
                  <td>{req.userName || "N/A"}</td>
                  <td>{req.userEmail || "N/A"}</td>
                  <td>{req.userPhone || "N/A"}</td>
                  <td className="acr-amount">{formatCurrency(req.amount)}</td>
                  <td>{formatDate(req.requestedAt)}</td>
                  <td>
                    <button
                      className="acr-confirm-btn"
                      onClick={() => handleConfirm(req)}
                      disabled={confirmingId === req.userId}
                    >
                      {confirmingId === req.userId
                        ? "Confirming..."
                        : "Confirm Cash Received"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminCashRenewals;
