import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  FiBriefcase,
  FiSend,
  FiDownload,
  FiRefreshCw,
  FiX,
  FiEye,
  FiEyeOff,
  FiAlertCircle,
  FiCheck,
  FiClock,
  FiXCircle,
} from "react-icons/fi";
import * as portalAPI from "../../services/demandPortalAPI";
import "./StaffPortal.css";

const money = (n) => `AED ${Number(n || 0).toLocaleString()}`;
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "-");

const statusBadge = (status) => {
  const map = {
    PENDING: "sp-badge-amber",
    APPROVED: "sp-badge-blue",
    COMPLETED: "sp-badge-green",
    REJECTED: "sp-badge-red",
  };
  return map[status] || "sp-badge-gray";
};

const StaffWallet = () => {
  const [data, setData] = useState({
    balance: 0,
    currency: "AED",
    totalEarned: 0,
    totalWithdrawn: 0,
    withdrawals: [],
    transactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    bankName: "",
    iban: "",
    accountHolderName: "",
    bankCode: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      setLoading(true);
      const result = await portalAPI.getMyWallet();
      if (result.success) {
        setData(result.data || {});
      } else {
        toast.error(result.message || "Failed to load wallet");
      }
    } catch (error) {
      console.error("[StaffWallet] fetchWallet error:", error);
      toast.error("Network error loading wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(withdrawForm.amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid withdrawal amount");
      return;
    }
    if (amt > (data.balance || 0)) {
      toast.error("Insufficient wallet balance");
      return;
    }
    if (!withdrawForm.bankName?.trim()) {
      toast.error("Bank name is required");
      return;
    }
    if (!withdrawForm.iban?.trim()) {
      toast.error("IBAN / account number is required");
      return;
    }
    if (!withdrawForm.accountHolderName?.trim()) {
      toast.error("Account holder name is required");
      return;
    }

    try {
      setSubmitting(true);
      const result = await portalAPI.requestStaffWithdrawal(withdrawForm);
      if (result.success) {
        toast.success(result.message || "Withdrawal request submitted");
        setShowWithdrawModal(false);
        setWithdrawForm({
          amount: "",
          bankName: "",
          iban: "",
          accountHolderName: "",
          bankCode: "",
        });
        await fetchWallet();
      } else {
        toast.error(result.message || "Failed to submit withdrawal");
      }
    } catch (error) {
      console.error("[StaffWallet] handleWithdrawSubmit error:", error);
      toast.error("Network error submitting withdrawal");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "14px", color: "#999" }}>Loading wallet...</div>
      </div>
    );
  }

  const balance = Number(data.balance || 0);
  const totalEarned = Number(data.totalEarned || 0);

  return (
    <div className="sp-page">
      <div className="sp-wallet-section">
        {/* Balance Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "12px",
            padding: "24px",
            color: "white",
            marginBottom: "24px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
            }}
          >
            <div>
              <div
                style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px" }}
              >
                Wallet Balance
              </div>
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  letterSpacing: "0.5px",
                }}
              >
                {hideBalance ? "•••••" : money(balance)}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "8px" }}>
                Total Earned: {money(totalEarned)}
              </div>
            </div>
            <button
              onClick={() => setHideBalance(!hideBalance)}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                border: "none",
                color: "white",
                padding: "8px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              {hideBalance ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <button
            onClick={() => setShowWithdrawModal(true)}
            style={{
              flex: 1,
              background: "#667eea",
              color: "white",
              border: "none",
              padding: "12px 16px",
              borderRadius: "8px",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "14px",
            }}
          >
            <FiSend /> Request Withdrawal
          </button>
          <button
            onClick={fetchWallet}
            style={{
              background: "#f5f5f5",
              color: "#333",
              border: "none",
              padding: "12px 16px",
              borderRadius: "8px",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "14px",
            }}
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>

        {/* Withdrawal Requests */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: "600",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FiDownload /> Withdrawal Requests
          </div>
          {data.withdrawals && data.withdrawals.length > 0 ? (
            <div
              style={{
                overflowX: "auto",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "#f9f9f9",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    <th style={drivemetableHeaderStyle}>Amount</th>
                    <th style={drivemetableHeaderStyle}>Status</th>
                    <th style={drivemetableHeaderStyle}>Bank Account</th>
                    <th style={drivemetableHeaderStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.withdrawals.map((wr) => (
                    <tr
                      key={wr._id}
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                        "&:hover": { background: "#fafafa" },
                      }}
                    >
                      <td style={drivemetableCellStyle}>{money(wr.amount)}</td>
                      <td style={drivemetableCellStyle}>
                        <span className={statusBadge(wr.status)}>
                          {wr.status}
                        </span>
                      </td>
                      <td
                        style={{
                          ...drivemetableCellStyle,
                          fontSize: "12px",
                          color: "#666",
                        }}
                      >
                        {wr.iban}
                      </td>
                      <td style={drivemetableCellStyle}>
                        {fmtDateTime(wr.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "#999",
                fontSize: "14px",
              }}
            >
              No withdrawal requests yet
            </div>
          )}
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div
          className="sp-modal-overlay"
          onClick={() => setShowWithdrawModal(false)}
        >
          <div
            className="sp-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ margin: 0 }}>Request Withdrawal</h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#999",
                }}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={drivemelabelStyle}>Amount (AED)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={withdrawForm.amount}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, amount: e.target.value })
                  }
                  step="0.01"
                  min="0"
                  style={drivemeinputStyle}
                />
                <div
                  style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}
                >
                  Available: {money(balance)}
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={drivemelabelStyle}>Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g., First Abu Dhabi Bank"
                  value={withdrawForm.bankName}
                  onChange={(e) =>
                    setWithdrawForm({
                      ...withdrawForm,
                      bankName: e.target.value,
                    })
                  }
                  style={drivemeinputStyle}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={drivemelabelStyle}>IBAN / Account Number</label>
                <input
                  type="text"
                  placeholder="e.g., AE070331234567890123456"
                  value={withdrawForm.iban}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, iban: e.target.value })
                  }
                  style={drivemeinputStyle}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={drivemelabelStyle}>Account Holder Name</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={withdrawForm.accountHolderName}
                  onChange={(e) =>
                    setWithdrawForm({
                      ...withdrawForm,
                      accountHolderName: e.target.value,
                    })
                  }
                  style={drivemeinputStyle}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={drivemelabelStyle}>Bank Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., SWIFT code"
                  value={withdrawForm.bankCode}
                  onChange={(e) =>
                    setWithdrawForm({
                      ...withdrawForm,
                      bankCode: e.target.value,
                    })
                  }
                  style={drivemeinputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
                  background: submitting ? "#ccc" : "#667eea",
                  color: "white",
                  border: "none",
                  padding: "12px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                {submitting ? "Submitting..." : "Submit Withdrawal Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const drivemelabelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: "600",
  marginBottom: "6px",
  color: "#333",
};

const drivemeinputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
};

const drivemetableHeaderStyle = {
  textAlign: "left",
  padding: "12px",
  fontSize: "12px",
  fontWeight: "600",
  color: "#666",
};

const drivemetableCellStyle = {
  padding: "12px",
  fontSize: "14px",
  borderBottom: "1px solid #f0f0f0",
};

export default StaffWallet;
