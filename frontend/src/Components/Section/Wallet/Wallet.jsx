"use client";
import { useState, useEffect } from "react";
import "./wallet.css";
import api from "../../../utils/api";

export default function Wallet() {
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [addAmount, setAddAmount] = useState("");

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/wallet/balance');
      setWalletData(response.data.data?.wallet || response.data.wallet || { balance: 0 });
      
      const transactionsResponse = await api.get('/wallet/transactions');
      setTransactions(transactionsResponse.data.data?.transactions || transactionsResponse.data.transactions || []);
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    if (!addAmount || parseFloat(addAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      // Create a payment session first, then redirect to payment gateway
      const response = await api.post('/wallet/create-payment-session', {
        amount: parseFloat(addAmount),
        paymentMethod: 'card',
        currency: 'KWD',
      });

      const data = response.data;
      if (data.success && data.data?.paymentSession?.paymentUrl) {
        window.location.href = data.data.paymentSession.paymentUrl;
      } else {
        alert("Failed to create payment session. Please try again.");
      }
    } catch (error) {
      console.error("Error adding funds:", error);
      alert("Failed to add funds. Please try again.");
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case "RIDE_PAYMENT":
        return "🚗";
      case "WALLET_TOPUP":
        return "💰";
      case "REFUND":
        return "↩️";
      case "PENALTY":
        return "⚠️";
      default:
        return "💳";
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case "RIDE_PAYMENT":
      case "PENALTY":
        return "#dc3545";
      case "WALLET_TOPUP":
      case "REFUND":
        return "#28a745";
      default:
        return "#6c757d";
    }
  };

  if (loading) {
    return (
      <div className="wallet-section">
        <h2>My Wallet</h2>
        <div className="loading">Loading wallet data...</div>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="wallet-section">
        <h2>My Wallet</h2>
        <div className="error">Failed to load wallet data</div>
      </div>
    );
  }

  return (
    <div className="wallet-section">
      <h2>My Wallet</h2>

      {/* Wallet Balance Card */}
      <div className="wallet-balance-card">
        <div className="balance-header">
          <h3>Current Balance</h3>
          <div className="balance-amount">
            KWD {walletData.balance?.toFixed(3) || "0.000"}
          </div>
        </div>
        
        <div className="balance-stats">
          <div className="stat-item">
            <span className="stat-label">Last 30 Days</span>
            <span className="stat-value">
              KWD {walletData.last30DaysSpent?.toFixed(3) || "0.000"}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Spent</span>
            <span className="stat-value">
              KWD {walletData.totalSpent?.toFixed(3) || "0.000"}
            </span>
          </div>
        </div>

        <button
          className="add-funds-btn"
          onClick={() => setShowAddFunds(true)}
        >
          + Add Funds
        </button>
      </div>

      {/* Add Funds Modal */}
      {showAddFunds && (
        <div className="modal-overlay">
          <div className="add-funds-modal">
            <div className="modal-header">
              <h3>Add Funds to Wallet</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowAddFunds(false);
                  setAddAmount("");
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Amount (KWD)</label>
                <input
                  type="number"
                  step="0.001"
                  min="1"
                  max="1000"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="amount-input"
                />
              </div>
              <div className="quick-amounts">
                <button
                  onClick={() => setAddAmount("5")}
                  className="quick-amount-btn"
                >
                  KWD 5
                </button>
                <button
                  onClick={() => setAddAmount("10")}
                  className="quick-amount-btn"
                >
                  KWD 10
                </button>
                <button
                  onClick={() => setAddAmount("25")}
                  className="quick-amount-btn"
                >
                  KWD 25
                </button>
                <button
                  onClick={() => setAddAmount("50")}
                  className="quick-amount-btn"
                >
                  KWD 50
                </button>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowAddFunds(false);
                  setAddAmount("");
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={handleAddFunds}
                disabled={!addAmount || parseFloat(addAmount) <= 0}
              >
                Add KWD {addAmount}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions History */}
      <div className="transactions-section">
        <h3>Transaction History</h3>
        
        {transactions.length === 0 ? (
          <div className="no-transactions">
            <div className="no-transactions-icon">📋</div>
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="transactions-list">
            {transactions.map((transaction) => (
              <div key={transaction._id} className="transaction-item">
                <div className="transaction-icon">
                  {getTransactionIcon(transaction.type)}
                </div>
                
                <div className="transaction-details">
                  <div className="transaction-info">
                    <h4>{transaction.description}</h4>
                    <p className="transaction-date">
                      {new Date(transaction.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                  
                  <div className="transaction-amount">
                    <span
                      className="amount"
                      style={{ color: getTransactionColor(transaction.type) }}
                    >
                      {transaction.type === "WALLET_TOPUP" || transaction.type === "REFUND"
                        ? `+KWD ${transaction.amount.toFixed(3)}`
                        : `-KWD ${transaction.amount.toFixed(3)}`}
                    </span>
                    <span className={`status ${transaction.status.toLowerCase()}`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>

                <div className="transaction-reference">
                  <span className="ref-label">Ref:</span>
                  <span className="ref-number">{transaction.reference}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
