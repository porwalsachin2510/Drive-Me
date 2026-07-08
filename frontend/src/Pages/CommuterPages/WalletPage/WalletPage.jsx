/* eslint-disable no-unused-vars */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import {
  getWalletBalance,
  getWalletTransactions,
  addFundsToWallet,
  withdrawFromWallet,
} from "../../../Redux/slices/walletSlice";
import PaymentModal from "../../../Components/Payment/PaymentModal";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import { useLocale } from "../../../hooks/useLocale";
import "./walletpage.css";

function WalletPage() {
  const dispatch = useDispatch();
  const { wallet, balance, transactions, loading, error } = useSelector(
    (state) => state.wallet,
  );
  const { user } = useSelector((state) => state.auth);
  // Locale drives currency for display and withdrawal (UAE -> AED, Kuwait -> KWD).
  const locale = useLocale();
  // Prefer the wallet's own currency (the actual stored balance currency),
  // then the user's active locale currency.
  const activeCurrency = wallet?.currency || locale.currency;

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

  // Transactions tab filters
  const [typeFilter, setTypeFilter] = useState("all"); // all | credit | debit
  const [timeFilter, setTimeFilter] = useState("all"); // all | today | week | month

  useEffect(() => {
    dispatch(getWalletBalance());
    dispatch(getWalletTransactions({ page: 1, limit: 100 }));
  }, [dispatch]);

  // Live auto-refresh: keep balance + transactions current without manual reload.
  const refreshWallet = useCallback(
    ({ silent } = {}) => {
      dispatch(getWalletBalance({ silent }));
      dispatch(getWalletTransactions({ page: 1, limit: 100, silent }));
    },
    [dispatch],
  );

  useAutoRefresh(refreshWallet, {
    interval: 20000,
    socketEvents: ["wallet-activity", "new-notification"],
  });

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
    dispatch(getWalletTransactions({ page: 1, limit: 100 }));
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    try {
      await dispatch(
        withdrawFromWallet({
          ...withdrawForm,
          amount: parseFloat(withdrawForm.amount),
          currency: activeCurrency,
          country: user?.country || locale.country,
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
      dispatch(getWalletTransactions({ page: 1, limit: 100 }));
    } catch (error) {
      console.error("Withdraw error:", error);
      alert(error || "Withdrawal failed. Please try again.");
    }
  };

  const formatCurrency = (amount) => {
    const decimals = locale.getCurrencyDecimals(activeCurrency);
    return new Intl.NumberFormat(`en-${locale.isoCode || "AE"}`, {
      style: "currency",
      currency: activeCurrency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
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

    if (locale.country === "KW") {
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

  // The backend now sends an explicit `direction` ("CREDIT" | "DEBIT") for every
  // transaction, computed from the authoritative type/category. Always trust it.
  // (Fallback to a type list only for older payloads that predate the `direction` field.)
  const CREDIT_TYPES = [
    "CREDIT",
    "DEPOSIT",
    "WALLET_TOPUP",
    "REFUND",
    "BOOKING_EARNING",
    "COMMISSION",
    "COMMISSION_REFUND",
    "SECURITY_DEPOSIT_REFUND",
    "TRANSFER_IN",
  ];
  // A "neutral" transaction is one that does NOT move the wallet balance — most
  // importantly a CASH (pay-on-board) fare, which is paid in person to the captain
  // at travel time. The backend flags these with direction "NONE" / affectsWallet
  // false. They appear in the activity feed for history but must NOT be coloured as
  // a debit nor counted in wallet spend totals.
  const isNeutralTransaction = (transaction) => {
    if (!transaction) return false;
    if (transaction.affectsWallet === false) return true;
    return transaction.direction === "NONE";
  };
  const isCreditTransaction = (transaction) => {
    if (!transaction) return false;
    if (isNeutralTransaction(transaction)) return false;
    if (transaction.direction) return transaction.direction === "CREDIT";
    if (!transaction.type) return false;
    return CREDIT_TYPES.includes(transaction.type);
  };
  const signedAmount = (transaction) => {
    if (isNeutralTransaction(transaction)) return 0;
    return isCreditTransaction(transaction)
      ? Math.abs(transaction.amount)
      : -Math.abs(transaction.amount);
  };

  // "This Month" = net movement (credits minus debits) for the current calendar
  // month. Neutral cash pay-on-board fares contribute 0 (see signedAmount).
  const thisMonthNet = () => {
    const now = new Date();
    return transactions
      .filter((t) => {
        const d = new Date(t.createdAt);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, t) => sum + signedAmount(t), 0);
  };

  // Short, human label for how the money moved (Cash / Wallet / Card / Bank / Admin...).
  // The backend now sends `paymentMethod` on every row; fall back gracefully for old rows.
  const getMethodLabel = (transaction) => {
    if (transaction?.paymentMethod) return transaction.paymentMethod;
    if (isCreditTransaction(transaction)) return "Wallet";
    return "Wallet";
  };

  // Apply the "All Types" and "All Time" filters to the full transaction list.
  const getFilteredTransactions = () => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return transactions.filter((t) => {
      // Type filter — neutral (cash pay-on-board) rows are neither credit nor debit.
      if (typeFilter === "credit" && !isCreditTransaction(t)) return false;
      if (
        typeFilter === "debit" &&
        (isCreditTransaction(t) || isNeutralTransaction(t))
      )
        return false;

      // Time filter
      if (timeFilter !== "all") {
        const d = new Date(t.createdAt);
        if (timeFilter === "today" && d < startOfToday) return false;
        if (timeFilter === "week" && d < startOfWeek) return false;
        if (timeFilter === "month" && d < startOfMonth) return false;
      }
      return true;
    });
  };

  const filteredTransactions = getFilteredTransactions();

  return (
    <>
      <Navbar />
      <div className="drivemego-wp-wallet-page">
        {/* Negative balance warning banner */}
        {balance < 0 && (
          <div className="drivemego-wp-negative-balance-warning">
            <div className="drivemego-wp-warning-content">
              <h3>Outstanding Balance Due</h3>
              <p>
                Your wallet has an outstanding balance of{" "}
                <strong>{formatCurrency(Math.abs(balance))}</strong>. This is
                typically from a cancellation fee. You will not be able to make
                new bookings until you add money to clear this balance.
              </p>
              <button
                className="drivemego-wp-warning-action-btn"
                onClick={() => setShowAddFundsModal(true)}
              >
                Add Funds Now
              </button>
            </div>
          </div>
        )}

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
                    <p>{formatCurrency(thisMonthNet())}</p>
                  </div>
                </div>
              </div>

              <div className="drivemego-wp-recent-transactions">
                <h3>Recent Transactions</h3>
                <div className="drivemego-wp-transaction-list">
                  {transactions.slice(0, 5).map((transaction, index) => (
                    <div key={index} className="transaction-item">
                      <div className="drivemego-wp-transaction-icon">
                        {isNeutralTransaction(transaction)
                          ? "💵"
                          : isCreditTransaction(transaction)
                            ? "➕"
                            : "➖"}
                      </div>
                      <div className="drivemego-wp-transaction-details">
                        <p className="drivemego-wp-transaction-description">
                          {transaction.description}
                        </p>
                        <div className="drivemego-wp-transaction-meta">
                          <span className="drivemego-wp-method-badge">
                            {getMethodLabel(transaction)}
                          </span>
                          {isNeutralTransaction(transaction) &&
                            transaction.status && (
                              <span className="drivemego-wp-status-badge">
                                {transaction.status}
                              </span>
                            )}
                          <span className="drivemego-wp-transaction-date">
                            {new Date(
                              transaction.createdAt,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`drivemego-wp-transaction-amount ${
                          isNeutralTransaction(transaction)
                            ? "drivemego-wp-neutral"
                            : isCreditTransaction(transaction)
                              ? "drivemego-wp-credit"
                              : "drivemego-wp-debit"
                        }`}
                      >
                        {isNeutralTransaction(transaction)
                          ? ""
                          : isCreditTransaction(transaction)
                            ? "+"
                            : "-"}
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
                  <select
                    className="drivemego-wp-filter-select"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="credit">Credits</option>
                    <option value="debit">Debits</option>
                  </select>
                  <select
                    className="drivemego-wp-filter-select"
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
              </div>

              <div className="drivemego-wp-transaction-list">
                {filteredTransactions.length === 0 ? (
                  <p className="drivemego-wp-no-transactions">
                    No transactions match the selected filters.
                  </p>
                ) : (
                  filteredTransactions.map((transaction, index) => (
                    <div
                      key={transaction._id || index}
                      className="drivemego-wp-transaction-item"
                    >
                      <div className="drivemego-wp-transaction-icon">
                        {isNeutralTransaction(transaction)
                          ? "💵"
                          : isCreditTransaction(transaction)
                            ? "➕"
                            : "➖"}
                      </div>
                      <div className="drivemego-wp-transaction-details">
                        <p className="drivemego-wp-transaction-description">
                          {transaction.description}
                        </p>
                        <div className="drivemego-wp-transaction-meta">
                          <span className="drivemego-wp-method-badge">
                            {getMethodLabel(transaction)}
                          </span>
                          {transaction.status &&
                            transaction.status !== "COMPLETED" && (
                              <span className="drivemego-wp-status-badge">
                                {transaction.status}
                              </span>
                            )}
                          <span className="drivemego-wp-transaction-date">
                            {new Date(
                              transaction.createdAt,
                            ).toLocaleDateString()}{" "}
                            at{" "}
                            {new Date(
                              transaction.createdAt,
                            ).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`drivemego-wp-transaction-amount ${
                          isNeutralTransaction(transaction)
                            ? "drivemego-wp-neutral"
                            : isCreditTransaction(transaction)
                              ? "drivemego-wp-credit"
                              : "drivemego-wp-debit"
                        }`}
                      >
                        {isNeutralTransaction(transaction)
                          ? ""
                          : isCreditTransaction(transaction)
                            ? "+"
                            : "-"}
                        {formatCurrency(Math.abs(transaction.amount))}
                      </div>
                    </div>
                  ))
                )}
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
                  <label>Amount ({activeCurrency})</label>
                  <input
                    type="number"
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    placeholder={`Enter amount in ${activeCurrency}`}
                    required
                    min={locale.currencyDecimals === 3 ? "0.250" : "1"}
                    step={locale.currencyDecimals === 3 ? "0.001" : "0.01"}
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
          currency={activeCurrency}
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
                    {locale.country === "KW" ? (
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
                      locale.country === "KW"
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
