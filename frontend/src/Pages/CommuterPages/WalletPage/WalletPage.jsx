/* eslint-disable no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  getWalletBalance,
  getWalletTransactions,
  addFundsToWallet,
  withdrawFromWallet,
} from "../../../Redux/slices/walletSlice";
import PaymentModal from "../../../Components/Payment/PaymentModal";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import "./walletpage.css";

function WalletPage() {
  const dispatch = useDispatch();
  const { wallet, balance, transactions, loading, error } = useSelector(
    (state) => state.wallet,
  );
  const { user } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState("overview");
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    iban: "",
    bankCode: "",
    accountHolderName: "",
    country: user?.country || "UAE",
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    dispatch(getWalletBalance());
    dispatch(getWalletTransactions({ page: 1, limit: 20 }));
  }, [dispatch]);

  const handleAddFunds = () => {
    if (!addFundsAmount || parseFloat(addFundsAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    // Close the amount entry modal and open the payment modal
    setShowAddFundsModal(false);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setAddFundsAmount("");
    dispatch(getWalletBalance());
    dispatch(getWalletTransactions({ page: 1, limit: 20 }));
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    try {
      // Get the appropriate currency based on user's country
      const currency = user?.country === "KW" ? "KWD" : "AED";

      await dispatch(
        withdrawFromWallet({
          ...withdrawForm,
          amount: parseFloat(withdrawForm.amount),
          currency,
          country: user?.country || "UAE",
        }),
      ).unwrap();

      alert(
        "Withdrawal initiated successfully! Your funds will be transferred to your bank account.",
      );
      setShowWithdrawModal(false);
      setWithdrawForm({
        amount: "",
        iban: "",
        bankCode: "",
        accountHolderName: "",
        country: user?.country || "UAE",
      });
      dispatch(getWalletBalance());
      dispatch(getWalletTransactions({ page: 1, limit: 20 }));
    } catch (error) {
      console.error("Withdraw error:", error);
      alert(error || "Withdrawal failed. Please try again.");
    }
  };

  const formatCurrency = (amount) => {
    const currency = user?.country === "KW" ? "KWD" : "AED";
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: currency === "KWD" ? "KWD" : "AED",
      minimumFractionDigits: currency === "KWD" ? 3 : 2,
    }).format(amount);
  };

  const getPaymentMethods = () => {
    const methods = [
      { id: "card", name: "Credit/Debit Card", icon: "💳" },
      { id: "apple_pay", name: "Apple Pay", icon: "🍎" },
      { id: "google_pay", name: "Google Pay", icon: "🤖" },
      { id: "upi", name: "UPI", icon: "📱" },
      { id: "knet", name: "KNET", icon: "🔵" },
      { id: "benefit", name: "Benefit", icon: "🟣" },
      { id: "zaincash", name: "Zain Cash", icon: "🟢" },
    ];

    if (user?.country === "KW") {
      return methods.filter((m) =>
        ["card", "knet", "benefit", "zaincash"].includes(m.id),
      );
    } else {
      return methods.filter((m) =>
        ["card", "apple_pay", "google_pay", "knet"].includes(m.id),
      );
    }
  };

  const getBalanceColor = () => {
    if (balance > 1000) return "#10b981";
    if (balance > 100) return "#f59e0b";
    return "#ef4444";
  };

  // Embedded wallet transactions use types like DEPOSIT/REFUND/WITHDRAWAL (not CREDIT/DEBIT).
  // Money coming IN = credit (+), money going OUT = debit (-).
  const CREDIT_TYPES = [
    "CREDIT",
    "DEPOSIT",
    "REFUND",
    "BOOKING_EARNING",
    "COMMISSION",
    "COMMISSION_REFUND",
    "SECURITY_DEPOSIT_REFUND",
    "TRANSFER_IN",
  ];
  const isCreditTransaction = (transaction) => {
    if (!transaction || !transaction.type) return false;
    return CREDIT_TYPES.includes(transaction.type);
  };
  const signedAmount = (transaction) =>
    isCreditTransaction(transaction)
      ? Math.abs(transaction.amount)
      : -Math.abs(transaction.amount);

  return (
    <>
      <Navbar />
      <div className="drivemego-wp-wallet-page">
        <div className="drivemego-wp-wallet-header">
          <h1>My Wallet</h1>
          <div className="drivemego-wp-wallet-balance-card">
            <div className="drivemego-wp-balance-info">
              <span className="drivemego-wp-balance-label">
                Available Balance
              </span>
              <span
                className="drivemego-wp-balance-amount"
                style={{ color: getBalanceColor() }}
              >
                {loading ? "..." : formatCurrency(balance)}
              </span>
            </div>
            <div className="drivemego-wp-balance-actions">
              <button
                className="drivemego-wp-action-btn drivemego-wp-primary"
                onClick={() => setShowAddFundsModal(true)}
              >
                ➕ Add Funds
              </button>
              <button
                className="drivemego-wp-action-btn drivemego-wp-secondary"
                onClick={() => setShowWithdrawModal(true)}
              >
                💸 Withdraw
              </button>
            </div>
          </div>
        </div>

        <div className="drivemego-wp-wallet-tabs">
          <button
            className={`drivemego-wp-tab-btn ${activeTab === "overview" ? "drivemego-wp-active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`drivemego-wp-tab-btn ${activeTab === "transactions" ? "drivemego-wp-active" : ""}`}
            onClick={() => setActiveTab("transactions")}
          >
            Transactions
          </button>
          <button
            className={`drivemego-wp-tab-btn ${activeTab === "payment-methods" ? "drivemego-wp-active" : ""}`}
            onClick={() => setActiveTab("payment-methods")}
          >
            Payment Methods
          </button>
        </div>

        <div className="drivemego-wp-wallet-content">
          {activeTab === "overview" && (
            <div className="drivemego-wp-overview-section">
              <div className="drivemego-wp-overview-cards">
                <div className="drivemego-wp-overview-card">
                  <div className="drivemego-wp-card-icon">💰</div>
                  <div className="drivemego-wp-card-content">
                    <h3>Total Balance</h3>
                    <p>{formatCurrency(balance)}</p>
                  </div>
                </div>

                <div className="drivemego-wp-overview-card">
                  <div className="drivemego-wp-card-icon">📊</div>
                  <div className="drivemego-wp-card-content">
                    <h3>Total Transactions</h3>
                    <p>{transactions.length}</p>
                  </div>
                </div>

                <div className="drivemego-wp-overview-card">
                  <div className="drivemego-wp-card-icon">📈</div>
                  <div className="drivemego-wp-card-content">
                    <h3>This Month</h3>
                    <p>
                      {formatCurrency(
                        transactions
                          .slice(0, 10)
                          .reduce((sum, t) => sum + signedAmount(t), 0),
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="drivemego-wp-recent-transactions">
                <h3>Recent Transactions</h3>
                <div className="drivemego-wp-transaction-list">
                  {transactions.slice(0, 5).map((transaction, index) => (
                    <div key={index} className="transaction-item">
                      <div className="drivemego-wp-transaction-icon">
                        {isCreditTransaction(transaction) ? "➕" : "➖"}
                      </div>
                      <div className="drivemego-wp-transaction-details">
                        <p className="drivemego-wp-transaction-description">
                          {transaction.description}
                        </p>
                        <span className="drivemego-wp-transaction-date">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div
                        className={`drivemego-wp-transaction-amount ${isCreditTransaction(transaction) ? "drivemego-wp-credit" : "drivemego-wp-debit"}`}
                      >
                        {isCreditTransaction(transaction) ? "+" : "-"}
                        {formatCurrency(Math.abs(transaction.amount))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="drivemego-wp-transactions-section">
              <div className="drivemego-wp-transactions-header">
                <h3>All Transactions</h3>
                <div className="drivemego-wp-transaction-filters">
                  <select className="drivemego-wp-filter-select">
                    <option value="all">All Types</option>
                    <option value="credit">Credits</option>
                    <option value="debit">Debits</option>
                  </select>
                  <select className="drivemego-wp-filter-select">
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
              </div>

              <div className="drivemego-wp-transaction-list">
                {transactions.map((transaction, index) => (
                  <div key={index} className="drivemego-wp-transaction-item">
                    <div className="drivemego-wp-transaction-icon">
                      {isCreditTransaction(transaction) ? "➕" : "➖"}
                    </div>
                    <div className="drivemego-wp-transaction-details">
                      <p className="drivemego-wp-transaction-description">
                        {transaction.description}
                      </p>
                      <span className="drivemego-wp-transaction-date">
                        {new Date(transaction.createdAt).toLocaleDateString()}{" "}
                        at{" "}
                        {new Date(transaction.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div
                      className={`drivemego-wp-transaction-amount ${isCreditTransaction(transaction) ? "drivemego-wp-credit" : "drivemego-wp-debit"}`}
                    >
                      {isCreditTransaction(transaction) ? "+" : "-"}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "payment-methods" && (
            <div className="drivemego-wp-payment-methods-section">
              <h3>Available Payment Methods</h3>
              <div className="drivemego-wp-payment-methods-grid">
                {getPaymentMethods().map((method) => (
                  <div
                    key={method.id}
                    className="drivemego-wp-payment-method-card"
                  >
                    <div className="drivemego-wp-method-icon">
                      {method.icon}
                    </div>
                    <div className="drivemego-wp-method-info">
                      <h4>{method.name}</h4>
                      <p>Available for deposits and withdrawals</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add Funds Modal */}
        {showAddFundsModal && (
          <div
            className="drivemego-wp-modal-overlay"
            onClick={() => setShowAddFundsModal(false)}
          >
            <div
              className="drivemego-wp-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="drivemego-wp-modal-header">
                <h2>Add Funds</h2>
                <button
                  className="drivemego-wp-modal-close"
                  onClick={() => setShowAddFundsModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="drivemego-wp-modal-form">
                <div className="drivemego-wp-form-group">
                  <label>
                    Amount ({user?.country === "KW" ? "KWD" : "AED"})
                  </label>
                  <input
                    type="number"
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    placeholder={`Enter amount in ${user?.country === "KW" ? "KWD" : "AED"}`}
                    required
                    min={user?.country === "KW" ? "0.250" : "1"}
                    step={user?.country === "KW" ? "0.001" : "0.01"}
                  />
                </div>

                <div className="drivemego-wp-modal-actions">
                  <button
                    type="button"
                    className="drivemego-wp-btn-cancel"
                    onClick={() => setShowAddFundsModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="drivemego-wp-btn-primary"
                    onClick={handleAddFunds}
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        <PaymentModal
          isOpen={showPaymentModal && addFundsAmount}
          onClose={() => {
            setShowPaymentModal(false);
            setAddFundsAmount("");
          }}
          amount={addFundsAmount}
          currency={user?.country === "KW" ? "KWD" : "AED"}
          onPaymentSuccess={handlePaymentSuccess}
        />

        {/* Withdraw Modal */}
        {showWithdrawModal && (
          <div
            className="drivemego-wp-modal-overlay"
            onClick={() => setShowWithdrawModal(false)}
          >
            <div
              className="drivemego-wp-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="drivemego-wp-modal-header">
                <h2>Withdraw Funds</h2>
                <button
                  className="drivemego-wp-modal-close"
                  onClick={() => setShowWithdrawModal(false)}
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleWithdraw}
                className="drivemego-wp-modal-form"
              >
                <div className="drivemego-wp-form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    value={withdrawForm.amount}
                    onChange={(e) =>
                      setWithdrawForm({
                        ...withdrawForm,
                        amount: e.target.value,
                      })
                    }
                    placeholder="Enter amount"
                    required
                    min="1"
                    max={balance}
                  />
                </div>

                <div className="drivemego-wp-form-group">
                  <label>Account Holder Name</label>
                  <input
                    type="text"
                    value={withdrawForm.accountHolderName}
                    onChange={(e) =>
                      setWithdrawForm({
                        ...withdrawForm,
                        accountHolderName: e.target.value,
                      })
                    }
                    placeholder="Enter account holder name"
                    required
                  />
                </div>

                <div className="drivemego-wp-form-group">
                  <label>Bank Code</label>
                  <select
                    value={withdrawForm.bankCode}
                    onChange={(e) =>
                      setWithdrawForm({
                        ...withdrawForm,
                        bankCode: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select Bank</option>
                    {user?.country === "KW" ? (
                      <>
                        <option value="NBK">National Bank of Kuwait</option>
                        <option value="KFH">Kuwait Finance House</option>
                        <option value="GULF">Gulf Bank</option>
                        <option value="BOUK">Bank of Kuwait</option>
                      </>
                    ) : (
                      <>
                        <option value="NBD">National Bank of Abu Dhabi</option>
                        <option value="ADCB">Abu Dhabi Commercial Bank</option>
                        <option value="FAB">First Abu Dhabi Bank</option>
                        <option value="EmiratesNBD">Emirates NBD</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="drivemego-wp-form-group">
                  <label>IBAN</label>
                  <input
                    type="text"
                    value={withdrawForm.iban}
                    onChange={(e) =>
                      setWithdrawForm({
                        ...withdrawForm,
                        iban: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder={
                      user?.country === "KW"
                        ? "KW00AAAA0000000000000000"
                        : "AE00 0000 0000 0000 0000 000"
                    }
                    required
                  />
                </div>

                <div className="drivemego-wp-modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowWithdrawModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="drivemego-wp-btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Processing..." : "Withdraw"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}

export default WalletPage;
