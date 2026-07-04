/* eslint-disable no-unused-vars */
"use client";

import { getActiveCurrency } from "../../../config/localeConfig";
import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import "./AdminWalletManagement.css";
import api from "../../../utils/api";

function AdminWalletManagement() {
  const [activeTab, setActiveTab] = useState("all-wallets");
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState([]);
  const [stats, setStats] = useState({
    totalWallets: 0,
    totalBalance: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    lowBalanceWallets: 0,
    activeWallets: 0,
    walletsByRole: [],
  });
  const [activityFeed, setActivityFeed] = useState([]);
  const [lowBalanceWallets, setLowBalanceWallets] = useState([]);
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Notification Modal
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    reason: "",
    actionRequired: "NONE",
    sendEmail: true,
  });
  const [sendingNotification, setSendingNotification] = useState(false);

  // Wallet Details
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [showWalletDetails, setShowWalletDetails] = useState(false);

  // Adjustment Modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    type: "CREDIT",
    amount: "",
    reason: "",
  });

  // The admin's selected display currency. All amounts are converted to it by
  // the backend, so re-fetch everything whenever it changes.
  const activeCurrency = useSelector((state) => state.locale?.currency);

  useEffect(() => {
    fetchData();
    setupSocketListeners();

    return () => {
      // Cleanup socket listeners
      const socket = api.getSocket();
      if (socket) {
        socket.off("wallet-fund-added");
        socket.off("wallet-withdrawal");
        socket.off("wallet-user-response");
      }
    };
  }, [activeCurrency]);

  useEffect(() => {
    if (activeTab === "all-wallets") {
      fetchWallets();
    } else if (activeTab === "low-balance") {
      fetchLowBalanceWallets();
    } else if (activeTab === "activity") {
      fetchActivityFeed();
    } else if (activeTab === "pending") {
      fetchPendingNotifications();
    }
  }, [activeTab, pagination.page, searchQuery, roleFilter, activeCurrency]);

  const setupSocketListeners = () => {
    const socket = api.getSocket();
    if (socket) {
      // Join admin wallet updates room
      socket.emit("join-admin-wallet-updates");

      // Listen for real-time wallet events
      socket.on("wallet-fund-added", (data) => {
        setActivityFeed((prev) => [
          {
            _id: Date.now(),
            transactionType: "DEPOSIT",
            userName: data.userName,
            userRole: data.userRole,
            amount: data.amount,
            currency: data.currency,
            newBalance: data.newBalance,
            createdAt: new Date(),
            isNew: true,
          },
          ...prev.slice(0, 49),
        ]);

        // Update stats
        setStats((prev) => ({
          ...prev,
          totalBalance: prev.totalBalance + data.amount,
          totalDeposits: prev.totalDeposits + data.amount,
        }));
      });

      socket.on("wallet-withdrawal", (data) => {
        setActivityFeed((prev) => [
          {
            _id: Date.now(),
            transactionType: "WITHDRAWAL",
            userName: data.userName,
            userRole: data.userRole,
            amount: data.amount,
            currency: data.currency,
            newBalance: data.newBalance,
            createdAt: new Date(),
            isNew: true,
          },
          ...prev.slice(0, 49),
        ]);

        setStats((prev) => ({
          ...prev,
          totalBalance: prev.totalBalance - data.amount,
          totalWithdrawals: prev.totalWithdrawals + data.amount,
        }));
      });

      socket.on("wallet-user-response", (data) => {
        // Refresh pending notifications when user responds
        fetchPendingNotifications();
      });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const statsResponse = await api.get("/admin/wallets/stats");
      setStats(statsResponse.data.stats);
      setActivityFeed(statsResponse.data.recentTransactions || []);
      await fetchWallets();
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWallets = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20,
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter && { role: roleFilter }),
      });

      const response = await api.get(`/admin/wallets?${params}`);
      setWallets(response.data.wallets);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error("Error fetching wallets:", error);
    }
  };

  const fetchLowBalanceWallets = async () => {
    try {
      const response = await api.get(
        "/admin/wallets/low-balance?threshold=100",
      );
      setLowBalanceWallets(response.data.wallets);
    } catch (error) {
      console.error("Error fetching low balance wallets:", error);
    }
  };

  const fetchActivityFeed = async () => {
    try {
      const response = await api.get("/admin/wallets/activity-feed?limit=50");
      setActivityFeed(response.data.activities);
    } catch (error) {
      console.error("Error fetching activity feed:", error);
    }
  };

  const fetchPendingNotifications = async () => {
    try {
      const response = await api.get("/admin/wallets/pending-notifications");
      setPendingNotifications(response.data.notifications);
    } catch (error) {
      console.error("Error fetching pending notifications:", error);
    }
  };

  const fetchWalletDetails = async (walletId) => {
    try {
      const response = await api.get(`/admin/wallets/${walletId}`);
      setSelectedWallet(response.data.wallet);
      setShowWalletDetails(true);
    } catch (error) {
      console.error("Error fetching wallet details:", error);
    }
  };

  const handleSendNotification = async () => {
    if (!notificationForm.title || !notificationForm.message) return;

    try {
      setSendingNotification(true);

      if (selectedUsers.length === 1) {
        await api.post("/admin/wallets/send-notification", {
          userId: selectedUsers[0].userId._id || selectedUsers[0].userId,
          ...notificationForm,
        });
      } else if (selectedUsers.length > 1) {
        await api.post("/admin/wallets/send-bulk-notifications", {
          userIds: selectedUsers.map((u) => u.userId._id || u.userId),
          ...notificationForm,
        });
      }

      setShowNotificationModal(false);
      setSelectedUsers([]);
      setNotificationForm({
        title: "",
        message: "",
        reason: "",
        actionRequired: "NONE",
        sendEmail: true,
      });

      // Refresh pending notifications
      fetchPendingNotifications();
    } catch (error) {
      console.error("Error sending notification:", error);
    } finally {
      setSendingNotification(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustmentForm.amount || !adjustmentForm.reason || !selectedWallet)
      return;

    try {
      await api.put(
        `/admin/wallets/${selectedWallet._id}/adjust`,
        adjustmentForm,
      );
      setShowAdjustmentModal(false);
      setAdjustmentForm({ type: "CREDIT", amount: "", reason: "" });
      fetchWalletDetails(selectedWallet._id);
      fetchData();
    } catch (error) {
      console.error("Error adjusting balance:", error);
    }
  };

  const toggleUserSelection = (wallet) => {
    setSelectedUsers((prev) => {
      const exists = prev.find(
        (u) =>
          (u.userId._id || u.userId) === (wallet.userId._id || wallet.userId),
      );
      if (exists) {
        return prev.filter(
          (u) =>
            (u.userId._id || u.userId) !== (wallet.userId._id || wallet.userId),
        );
      }
      return [...prev, wallet];
    });
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === wallets.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers([...wallets]);
    }
  };

  const formatCurrency = (amount, currency = getActiveCurrency()) => {
    const curr = currency || getActiveCurrency();
    const decimals = ["KWD", "BHD", "OMR"].includes(curr) ? 3 : 2;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getBalanceClass = (balance) => {
    if (balance < 50) return "low-balance";
    if (balance < 200) return "medium-balance";
    return "high-balance";
  };

  const getRoleClass = (role) => {
    const roleMap = {
      B2C_PARTNER: "b2c_partner",
      B2B_PARTNER: "b2b_partner",
      CORPORATE: "corporate",
      COMMUTER: "commuter",
      ADMIN: "admin",
    };
    return roleMap[role] || "commuter";
  };

  // A super admin is stored with role "ADMIN" + adminPermissions.isSuperAdmin = true.
  // The backend exposes a flat `isSuperAdmin` flag; fall back to the populated user.
  const isSuperAdminWallet = (wallet) =>
    wallet?.isSuperAdmin === true ||
    (wallet?.role === "ADMIN" &&
      wallet?.userId?.adminPermissions?.isSuperAdmin === true);

  const getRoleLabel = (wallet) => {
    if (isSuperAdminWallet(wallet)) return "SUPER ADMIN";
    return wallet?.role?.replace(/_/g, " ");
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get the dominant currency from wallets or default to AED
  const getDominantCurrency = () => {
    if (wallets.length === 0) return stats.currency || getActiveCurrency();
    // Count currencies from wallets
    const currencyCounts = wallets.reduce((acc, w) => {
      const curr = w.currency || getActiveCurrency();
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});
    // Return the most common currency
    return (
      Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      getActiveCurrency()
    );
  };

  const dominantCurrency = getDominantCurrency();

  const renderStats = () => (
    <div className="wallet-stats-grid">
      <div className="wallet-stat-card">
        <h4>Total Wallets</h4>
        <span className="wallet-stat-value">{stats.totalWallets}</span>
      </div>
      <div className="wallet-stat-card">
        <h4>Total Balance</h4>
        <span className="wallet-stat-value highlight">
          {formatCurrency(
            stats.totalBalance,
            stats.currency || dominantCurrency,
          )}
        </span>
      </div>
      <div className="wallet-stat-card">
        <h4>Total Deposits</h4>
        <span className="wallet-stat-value">
          {formatCurrency(
            stats.totalDeposits,
            stats.currency || dominantCurrency,
          )}
        </span>
      </div>
      <div className="wallet-stat-card">
        <h4>Total Withdrawals</h4>
        <span className="wallet-stat-value">
          {formatCurrency(
            stats.totalWithdrawals,
            stats.currency || dominantCurrency,
          )}
        </span>
      </div>
      <div className="wallet-stat-card">
        <h4>Low Balance Wallets</h4>
        <span className="wallet-stat-value warning">
          {stats.lowBalanceWallets}
        </span>
      </div>
      <div className="wallet-stat-card">
        <h4>Active Wallets</h4>
        <span className="wallet-stat-value">{stats.activeWallets}</span>
      </div>
    </div>
  );

  const renderAllWallets = () => (
    <div className="wallets-section">
      <div className="wallet-filters">
        <input
          type="text"
          className="wallet-search"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="wallet-filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="B2C_PARTNER">B2C Partner</option>
          <option value="B2B_PARTNER">B2B Partner</option>
          <option value="CORPORATE">Corporate</option>
          <option value="COMMUTER">Commuter</option>
          <option value="CORPORATE_EMPLOYEE">Corporate Employee</option>
        </select>
      </div>

      {selectedUsers.length > 0 && (
        <div className="selected-users-bar">
          <span>{selectedUsers.length} user(s) selected</span>
          <div className="bulk-actions">
            <button
              className="action-btn primary"
              onClick={() => setShowNotificationModal(true)}
            >
              Send Notification
            </button>
            <button
              className="action-btn secondary"
              onClick={() => setSelectedUsers([])}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      <div className="wallet-table-container">
        <table className="wallet-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    selectedUsers.length === wallets.length &&
                    wallets.length > 0
                  }
                  onChange={selectAllUsers}
                />
              </th>
              <th>User</th>
              <th>Role</th>
              <th>Balance</th>
              <th>Total Earnings</th>
              <th>Total Withdrawals</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((wallet) => (
              <tr key={wallet._id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedUsers.some(
                      (u) =>
                        (u.userId._id || u.userId) ===
                        (wallet.userId._id || wallet.userId),
                    )}
                    onChange={() => toggleUserSelection(wallet)}
                  />
                </td>
                <td>
                  <div className="user-info">
                    <div className="user-avatar">
                      {wallet.userId?.profileImage ? (
                        <img
                          src={wallet.userId.profileImage}
                          alt={wallet.userId?.fullName}
                        />
                      ) : (
                        getInitials(wallet.userId?.fullName)
                      )}
                    </div>
                    <div className="user-details">
                      <span className="user-name">
                        {wallet.userId?.fullName || "Unknown"}
                      </span>
                      <span className="user-email">{wallet.userId?.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${getRoleClass(wallet.role)}`}>
                    {getRoleLabel(wallet)}
                  </span>
                </td>
                <td>
                  <span
                    className={`balance-cell ${getBalanceClass(wallet.balance)}`}
                  >
                    {formatCurrency(
                      wallet.displayBalance ?? wallet.balance,
                      wallet.displayCurrency || wallet.currency,
                    )}
                  </span>
                </td>
                <td>
                  {formatCurrency(
                    wallet.displayTotalEarnings ?? wallet.totalEarnings,
                    wallet.displayCurrency || wallet.currency,
                  )}
                </td>
                <td>
                  {formatCurrency(
                    wallet.displayTotalWithdrawals ?? wallet.totalWithdrawals,
                    wallet.displayCurrency || wallet.currency,
                  )}
                </td>
                <td>
                  <span
                    className={`status-badge ${wallet.userId?.status?.toLowerCase()}`}
                  >
                    {wallet.userId?.status || "Unknown"}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn secondary"
                      onClick={() => fetchWalletDetails(wallet._id)}
                    >
                      View
                    </button>
                    <button
                      className="action-btn primary"
                      onClick={() => {
                        setSelectedUsers([wallet]);
                        setShowNotificationModal(true);
                      }}
                    >
                      Notify
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {wallets.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">No wallets found</div>
          <h4>No Wallets Found</h4>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            className="pagination-btn"
            disabled={pagination.page >= pagination.pages}
            onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  const renderLowBalanceWallets = () => (
    <div className="wallets-section">
      <div className="wallet-filters">
        <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
          Showing wallets with balance less than 100{" "}
          {wallets[0]?.currency || getActiveCurrency()}
        </p>
        <button
          className="action-btn primary"
          disabled={lowBalanceWallets.length === 0}
          onClick={() => {
            setSelectedUsers(lowBalanceWallets);
            setShowNotificationModal(true);
            setNotificationForm({
              title: "Low Wallet Balance Alert",
              message:
                "Your wallet balance is running low. Please add funds to continue using our services without interruption.",
              reason: "LOW_BALANCE",
              actionRequired: "ADD_FUNDS",
              sendEmail: true,
            });
          }}
        >
          Notify All Low Balance Users
        </button>
      </div>

      <div className="wallet-table-container">
        <table className="wallet-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Balance</th>
              <th>Last Activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lowBalanceWallets.map((wallet) => (
              <tr key={wallet._id}>
                <td>
                  <div className="user-info">
                    <div className="user-avatar">
                      {getInitials(wallet.userId?.fullName)}
                    </div>
                    <div className="user-details">
                      <span className="user-name">
                        {wallet.userId?.fullName || "Unknown"}
                      </span>
                      <span className="user-email">{wallet.userId?.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${getRoleClass(wallet.role)}`}>
                    {getRoleLabel(wallet)}
                  </span>
                </td>
                <td>
                  <span className="balance-cell low-balance">
                    {formatCurrency(
                      wallet.displayBalance ?? wallet.balance,
                      wallet.displayCurrency || wallet.currency,
                    )}
                  </span>
                </td>
                <td>
                  {wallet.transactions?.length > 0
                    ? formatDate(
                        wallet.transactions[wallet.transactions.length - 1]
                          ?.createdAt,
                      )
                    : "No activity"}
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn primary"
                      onClick={() => {
                        setSelectedUsers([wallet]);
                        setShowNotificationModal(true);
                        setNotificationForm({
                          title: "Add Funds to Your Wallet",
                          message:
                            "Your wallet balance is low. Please add funds to avoid service interruption.",
                          reason: "LOW_BALANCE",
                          actionRequired: "ADD_FUNDS",
                          sendEmail: true,
                        });
                      }}
                    >
                      Send Reminder
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lowBalanceWallets.length === 0 && !loading && (
        <div className="empty-state">
          <h4>No Low Balance Wallets</h4>
          <p>All users have sufficient balance</p>
        </div>
      )}
    </div>
  );

  const renderActivityFeed = () => (
    <div className="activity-feed">
      <div className="activity-feed-header">
        <h3>
          <span className="live-indicator"></span>
          Real-Time Activity Feed
        </h3>
        <button className="action-btn secondary" onClick={fetchActivityFeed}>
          Refresh
        </button>
      </div>
      <div className="activity-list">
        {activityFeed.map((activity, index) => (
          <div
            key={activity._id || index}
            className={`activity-item ${activity.isNew ? "new" : ""}`}
          >
            <div
              className={`activity-icon ${activity.transactionType?.toLowerCase()}`}
            >
              {activity.transactionType === "DEPOSIT" && "+"}
              {activity.transactionType === "WITHDRAWAL" && "-"}
              {activity.transactionType === "TRANSFER" && "~"}
            </div>
            <div className="activity-content">
              <div className="activity-title">
                {activity.userName || "User"} - {activity.transactionType}
              </div>
              <div className="activity-description">
                {activity.description ||
                  `${activity.transactionType} of ${formatCurrency(Math.abs(activity.displayAmount ?? activity.amount), activity.displayCurrency || activity.currency)}`}
              </div>
              <div className="activity-meta">
                <span className="activity-time">
                  {formatDate(activity.createdAt)}
                </span>
                <span
                  className={`activity-amount ${activity.amount > 0 ? "positive" : "negative"}`}
                >
                  {activity.amount > 0 ? "+" : ""}
                  {formatCurrency(
                    activity.displayAmount ?? activity.amount,
                    activity.displayCurrency || activity.currency,
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}
        {activityFeed.length === 0 && (
          <div className="empty-state">
            <h4>No Activity Yet</h4>
            <p>Wallet activities will appear here in real-time</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPendingNotifications = () => (
    <div className="wallets-section">
      <div className="wallet-filters">
        <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
          Notifications sent to users that are awaiting response
        </p>
      </div>

      <div className="wallet-table-container">
        <table className="wallet-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Notification</th>
              <th>Action Required</th>
              <th>Sent At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingNotifications.map((notification) => (
              <tr key={notification._id}>
                <td>
                  <div className="user-info">
                    <div className="user-avatar">
                      {getInitials(notification.userId?.fullName)}
                    </div>
                    <div className="user-details">
                      <span className="user-name">
                        {notification.userId?.fullName || "Unknown"}
                      </span>
                      <span className="user-email">
                        {notification.userId?.email}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div>
                    <strong>{notification.title}</strong>
                    <br />
                    <small style={{ color: "#64748b" }}>
                      {notification.message?.slice(0, 50)}...
                    </small>
                  </div>
                </td>
                <td>
                  <span
                    className={`status-badge ${notification.actionRequired === "ADD_FUNDS" ? "pending" : "active"}`}
                  >
                    {notification.actionRequired?.replace(/_/g, " ")}
                  </span>
                </td>
                <td>{formatDate(notification.createdAt)}</td>
                <td>
                  <span
                    className={`status-badge ${notification.userResponseStatus?.toLowerCase()}`}
                  >
                    {notification.userResponseStatus}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn primary"
                      onClick={() => {
                        setSelectedUsers([{ userId: notification.userId }]);
                        setShowNotificationModal(true);
                      }}
                    >
                      Remind
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingNotifications.length === 0 && !loading && (
        <div className="empty-state">
          <h4>No Pending Notifications</h4>
          <p>All sent notifications have been responded to</p>
        </div>
      )}
    </div>
  );

  const renderWalletDetailsModal = () => {
    if (!showWalletDetails || !selectedWallet) return null;

    return (
      <div className="notification-modal-overlay">
        <div className="notification-modal" style={{ maxWidth: "700px" }}>
          <div className="notification-modal-header">
            <h3>Wallet Details</h3>
            <button
              className="close-modal-btn"
              onClick={() => setShowWalletDetails(false)}
            >
              x
            </button>
          </div>

          <div className="wallet-details-header">
            <div className="wallet-user-info">
              <div className="wallet-user-avatar">
                {selectedWallet.userId?.profileImage ? (
                  <img
                    src={selectedWallet.userId.profileImage}
                    alt={selectedWallet.userId?.fullName}
                  />
                ) : (
                  getInitials(selectedWallet.userId?.fullName)
                )}
              </div>
              <div className="wallet-user-details">
                <h4>{selectedWallet.userId?.fullName}</h4>
                <p>{selectedWallet.userId?.email}</p>
                <p>{selectedWallet.userId?.whatsappNumber}</p>
              </div>
            </div>
            <div className="wallet-balance-display">
              <span className="balance-label">Current Balance</span>
              <span className="balance-amount">
                {formatCurrency(
                  selectedWallet.balance,
                  selectedWallet.currency,
                )}
              </span>
            </div>
          </div>

          <div className="wallet-details-body">
            <div className="wallet-info-grid">
              <div className="wallet-info-item">
                <span className="info-label">Role</span>
                <span className="info-value">
                  {getRoleLabel(selectedWallet)}
                </span>
              </div>
              <div className="wallet-info-item">
                <span className="info-label">Currency</span>
                <span className="info-value">{selectedWallet.currency}</span>
              </div>
              <div className="wallet-info-item">
                <span className="info-label">Total Earnings</span>
                <span className="info-value">
                  {formatCurrency(
                    selectedWallet.totalEarnings,
                    selectedWallet.currency,
                  )}
                </span>
              </div>
              <div className="wallet-info-item">
                <span className="info-label">Total Withdrawals</span>
                <span className="info-value">
                  {formatCurrency(
                    selectedWallet.totalWithdrawals,
                    selectedWallet.currency,
                  )}
                </span>
              </div>
              <div className="wallet-info-item">
                <span className="info-label">Security Deposit</span>
                <span className="info-value">
                  {formatCurrency(
                    selectedWallet.securityDepositHeld,
                    selectedWallet.currency,
                  )}
                </span>
              </div>
              <div className="wallet-info-item">
                <span className="info-label">Status</span>
                <span className="info-value">
                  {selectedWallet.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="transactions-section">
              <h4>Recent Transactions</h4>
              <div className="wallet-table-container">
                <table className="wallet-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWallet.transactions
                      ?.slice(-10)
                      .reverse()
                      .map((tx, idx) => (
                        <tr key={idx}>
                          <td>{tx.type}</td>
                          <td
                            className={tx.amount > 0 ? "positive" : "negative"}
                          >
                            {tx.amount > 0 ? "+" : ""}
                            {formatCurrency(tx.amount, selectedWallet.currency)}
                          </td>
                          <td>{tx.description}</td>
                          <td>
                            <span
                              className={`status-badge ${tx.status?.toLowerCase()}`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td>{formatDate(tx.createdAt)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="notification-modal-footer">
            <button
              className="modal-btn cancel"
              onClick={() => {
                setShowAdjustmentModal(true);
              }}
            >
              Adjust Balance
            </button>
            <button
              className="modal-btn send"
              onClick={() => {
                setSelectedUsers([selectedWallet]);
                setShowNotificationModal(true);
                setShowWalletDetails(false);
              }}
            >
              Send Notification
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderNotificationModal = () => {
    if (!showNotificationModal) return null;

    return (
      <div className="notification-modal-overlay">
        <div className="notification-modal">
          <div className="notification-modal-header">
            <h3>
              Send Notification
              {selectedUsers.length > 1 && ` to ${selectedUsers.length} Users`}
            </h3>
            <button
              className="close-modal-btn"
              onClick={() => setShowNotificationModal(false)}
            >
              x
            </button>
          </div>

          <div className="notification-modal-body">
            {selectedUsers.length === 1 && (
              <div className="form-group">
                <label>Recipient</label>
                <div
                  className="user-info"
                  style={{
                    padding: "12px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                  }}
                >
                  <div className="user-avatar">
                    {getInitials(
                      selectedUsers[0].userId?.fullName ||
                        selectedUsers[0]?.userId?.fullName,
                    )}
                  </div>
                  <div className="user-details">
                    <span className="user-name">
                      {selectedUsers[0].userId?.fullName ||
                        selectedUsers[0]?.userId?.fullName}
                    </span>
                    <span className="user-email">
                      {selectedUsers[0].userId?.email ||
                        selectedUsers[0]?.userId?.email}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Notification Title *</label>
              <input
                type="text"
                value={notificationForm.title}
                onChange={(e) =>
                  setNotificationForm({
                    ...notificationForm,
                    title: e.target.value,
                  })
                }
                placeholder="Enter notification title"
              />
            </div>

            <div className="form-group">
              <label>Message *</label>
              <textarea
                value={notificationForm.message}
                onChange={(e) =>
                  setNotificationForm({
                    ...notificationForm,
                    message: e.target.value,
                  })
                }
                placeholder="Enter your message to the user(s)..."
              />
            </div>

            <div className="form-group">
              <label>Reason</label>
              <select
                value={notificationForm.reason}
                onChange={(e) =>
                  setNotificationForm({
                    ...notificationForm,
                    reason: e.target.value,
                  })
                }
              >
                <option value="">Select reason</option>
                <option value="LOW_BALANCE">Low Balance</option>
                <option value="PAYMENT_PENDING">Payment Pending</option>
                <option value="BOOKING_ISSUE">Booking Issue</option>
                <option value="CONTRACT_PAYMENT">Contract Payment Due</option>
                <option value="COMMISSION_DUE">Commission Due</option>
                <option value="GENERAL">General Notification</option>
              </select>
            </div>

            <div className="form-group">
              <label>Action Required</label>
              <select
                value={notificationForm.actionRequired}
                onChange={(e) =>
                  setNotificationForm({
                    ...notificationForm,
                    actionRequired: e.target.value,
                  })
                }
              >
                <option value="NONE">No Action Required</option>
                <option value="ADD_FUNDS">Add Funds to Wallet</option>
                <option value="MAKE_PAYMENT">Make Payment</option>
                <option value="REVIEW_TRANSACTION">Review Transaction</option>
              </select>
            </div>

            <div className="form-group">
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={notificationForm.sendEmail}
                  onChange={(e) =>
                    setNotificationForm({
                      ...notificationForm,
                      sendEmail: e.target.checked,
                    })
                  }
                />
                <label htmlFor="sendEmail">Also send email notification</label>
              </div>
            </div>
          </div>

          <div className="notification-modal-footer">
            <button
              className="modal-btn cancel"
              onClick={() => setShowNotificationModal(false)}
            >
              Cancel
            </button>
            <button
              className="modal-btn send"
              onClick={handleSendNotification}
              disabled={
                !notificationForm.title ||
                !notificationForm.message ||
                sendingNotification
              }
            >
              {sendingNotification
                ? "Sending..."
                : `Send${selectedUsers.length > 1 ? ` to ${selectedUsers.length} Users` : ""}`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAdjustmentModal = () => {
    if (!showAdjustmentModal || !selectedWallet) return null;

    return (
      <div className="notification-modal-overlay">
        <div className="notification-modal">
          <div className="notification-modal-header">
            <h3>Adjust Wallet Balance</h3>
            <button
              className="close-modal-btn"
              onClick={() => setShowAdjustmentModal(false)}
            >
              x
            </button>
          </div>

          <div className="notification-modal-body">
            <div className="form-group">
              <label>Current Balance</label>
              <div
                style={{
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  fontWeight: "600",
                }}
              >
                {formatCurrency(
                  selectedWallet.balance,
                  selectedWallet.currency,
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Adjustment Type *</label>
              <select
                value={adjustmentForm.type}
                onChange={(e) =>
                  setAdjustmentForm({ ...adjustmentForm, type: e.target.value })
                }
              >
                <option value="CREDIT">Credit (Add)</option>
                <option value="DEBIT">Debit (Subtract)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={adjustmentForm.amount}
                onChange={(e) =>
                  setAdjustmentForm({
                    ...adjustmentForm,
                    amount: e.target.value,
                  })
                }
                placeholder="Enter amount"
              />
            </div>

            <div className="form-group">
              <label>Reason *</label>
              <textarea
                value={adjustmentForm.reason}
                onChange={(e) =>
                  setAdjustmentForm({
                    ...adjustmentForm,
                    reason: e.target.value,
                  })
                }
                placeholder="Enter reason for adjustment..."
              />
            </div>
          </div>

          <div className="notification-modal-footer">
            <button
              className="modal-btn cancel"
              onClick={() => setShowAdjustmentModal(false)}
            >
              Cancel
            </button>
            <button
              className="modal-btn send"
              onClick={handleAdjustBalance}
              disabled={!adjustmentForm.amount || !adjustmentForm.reason}
            >
              Apply Adjustment
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "all-wallets":
        return renderAllWallets();
      case "low-balance":
        return renderLowBalanceWallets();
      case "activity":
        return renderActivityFeed();
      case "pending":
        return renderPendingNotifications();
      default:
        return renderAllWallets();
    }
  };

  if (loading && wallets.length === 0) {
    return (
      <div className="admin-wallet-management">
        <div className="loading">Loading wallet data...</div>
      </div>
    );
  }

  return (
    <div className="admin-wallet-management">
      <div className="wallet-header">
        <h2>Wallet Management</h2>
        <div className="wallet-overview">
          <div className="overview-item">
            <span className="overview-label">Total Balance</span>
            <span className="overview-value">
              {formatCurrency(stats.totalBalance)}
            </span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Total Wallets</span>
            <span className="overview-value">{stats.totalWallets}</span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Low Balance</span>
            <span className="overview-value warning">
              {stats.lowBalanceWallets}
            </span>
          </div>
        </div>
      </div>

      {renderStats()}

      <div className="wallet-tabs">
        <button
          className={`wallet-tab ${activeTab === "all-wallets" ? "active" : ""}`}
          onClick={() => setActiveTab("all-wallets")}
        >
          All Wallets
        </button>
        <button
          className={`wallet-tab ${activeTab === "low-balance" ? "active" : ""}`}
          onClick={() => setActiveTab("low-balance")}
        >
          Low Balance
          {stats.lowBalanceWallets > 0 && (
            <span className="badge">{stats.lowBalanceWallets}</span>
          )}
        </button>
        <button
          className={`wallet-tab ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          Activity Feed
        </button>
        <button
          className={`wallet-tab ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending Responses
          {pendingNotifications.length > 0 && (
            <span className="badge">{pendingNotifications.length}</span>
          )}
        </button>
      </div>

      <div className="wallet-content">{renderContent()}</div>

      {renderNotificationModal()}
      {renderWalletDetailsModal()}
      {renderAdjustmentModal()}
    </div>
  );
}

export default AdminWalletManagement;
