import React, { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import "./adminsettlement.css";

function AdminSettlement() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [bankAccount, setBankAccount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });
  // eslint-disable-next-line no-unused-vars
  const [filter, setFilter] = useState("all");

  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/settlement/all?page=${pagination.page}&limit=${pagination.limit}`,
      );

      if (response.data.success) {
        setSettlements(response.data.settlements);
        setPagination((prev) => ({
          ...prev,
          total: response.data.pagination.total,
        }));
        setError(null);
      }
    } catch (err) {
      console.error("Error fetching settlements:", err);
      setError("Failed to load settlements");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const processMonthlySettlement = async () => {
    try {
      setActionLoading(true);
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const response = await api.post(
        `/settlement/monthly-settlement?month=${month}&year=${year}`,
      );

      if (response.data.success) {
        alert(
          `Settlement calculated for ${response.data.settlements.length} partners`,
        );
        fetchSettlements();
      }
    } catch (err) {
      console.error("Error processing settlement:", err);
      alert("Failed to process settlement");
    } finally {
      setActionLoading(false);
    }
  };

  const processAutoDebit = async () => {
    try {
      setActionLoading(true);
      const response = await api.post(`/settlement/auto-debit`);

      if (response.data.success) {
        alert(response.data.message);
        fetchSettlements();
      }
    } catch (err) {
      console.error("Error processing auto-debit:", err);
      alert("Failed to process auto-debit");
    } finally {
      setActionLoading(false);
    }
  };

  const processPayout = async (partnerId) => {
    if (!payoutAmount || !bankAccount) {
      alert("Please fill all required fields");
      return;
    }

    try {
      setActionLoading(true);
      const response = await api.post(`/settlement/payout/${partnerId}`, {
        amount: Number(payoutAmount),
        bankAccount,
        paymentMethod,
      });

      if (response.data.success) {
        alert("Payout processed successfully!");
        setSelectedPayout(null);
        setPayoutAmount("");
        setBankAccount("");
        setPaymentMethod("bank");
        fetchSettlements();
      }
    } catch (err) {
      console.error("Error processing payout:", err);
      alert("Failed to process payout");
    } finally {
      setActionLoading(false);
    }
  };

  const getTotalStats = () => {
    return settlements.reduce(
      (acc, settlement) => ({
        totalBalance: acc.totalBalance + settlement.balance,
        totalPending: acc.totalPending + settlement.pendingAmount,
        totalCommission: acc.totalCommission + settlement.commissionDebt,
      }),
      { totalBalance: 0, totalPending: 0, totalCommission: 0 },
    );
  };

  const stats = getTotalStats();

  if (loading) {
    return <div className="settlement-loading">Loading settlements...</div>;
  }

  return (
    <div className="admin-settlement">
      <div className="settlement-header">
        <h2>Settlement Management</h2>
        <div className="header-actions">
          <button
            className="btn-calculate"
            onClick={processMonthlySettlement}
            disabled={actionLoading}
          >
            Calculate Monthly Settlement
          </button>
          <button
            className="btn-auto-debit"
            onClick={processAutoDebit}
            disabled={actionLoading}
          >
            Process Auto-Debit
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Summary Stats */}
      <div className="settlement-stats">
        <div className="stat-card">
          <div className="stat-label">Total Balance</div>
          <div className="stat-value">{stats.totalBalance.toFixed(2)} AED</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-label">Pending Payout</div>
          <div className="stat-value">{stats.totalPending.toFixed(2)} AED</div>
        </div>
        <div className="stat-card commission">
          <div className="stat-label">Commission Debt</div>
          <div className="stat-value">
            {stats.totalCommission.toFixed(2)} AED
          </div>
        </div>
        <div className="stat-card partners">
          <div className="stat-label">Active Partners</div>
          <div className="stat-value">{settlements.length}</div>
        </div>
      </div>

      {settlements.length === 0 ? (
        <div className="no-settlements">
          <p>No settlements to display</p>
        </div>
      ) : (
        <div className="settlements-table">
          <table>
            <thead>
              <tr>
                <th>Partner Name</th>
                <th>Role</th>
                <th>Balance</th>
                <th>Pending</th>
                <th>Commission</th>
                <th>Earnings</th>
                <th>Last Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((settlement) => (
                <tr key={settlement.partnerId}>
                  <td>{settlement.partnerName}</td>
                  <td>
                    <span className="badge">{settlement.role}</span>
                  </td>
                  <td className="amount">{settlement.balance.toFixed(2)}</td>
                  <td className="amount pending">
                    {settlement.pendingAmount.toFixed(2)}
                  </td>
                  <td className="amount">
                    {settlement.commissionDebt.toFixed(2)}
                  </td>
                  <td className="amount">
                    {settlement.totalEarnings.toFixed(2)}
                  </td>
                  <td className="date">
                    {new Date(settlement.lastUpdated).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      className="btn-payout"
                      onClick={() => {
                        setSelectedPayout(settlement);
                        setPayoutAmount(settlement.pendingAmount.toString());
                      }}
                      disabled={settlement.pendingAmount === 0}
                    >
                      Payout
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payout Modal */}
      {selectedPayout && (
        <div
          className="payout-modal-overlay"
          onClick={() => setSelectedPayout(null)}
        >
          <div className="payout-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Process Payout</h3>
            <div className="modal-content">
              <div className="form-group">
                <label>Partner: {selectedPayout.partnerName}</label>
                <p className="info-text">
                  Pending Amount: {selectedPayout.pendingAmount.toFixed(2)} AED
                </p>
              </div>

              <div className="form-group">
                <label>Payout Amount</label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  max={selectedPayout.pendingAmount}
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="check">Check</option>
                  <option value="wallet">Wallet Transfer</option>
                </select>
              </div>

              <div className="form-group">
                <label>Bank Account / Reference</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Enter bank account or reference number"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setSelectedPayout(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn-process-payout"
                onClick={() => processPayout(selectedPayout.partnerId)}
                disabled={actionLoading || !payoutAmount}
              >
                {actionLoading ? "Processing..." : "Process Payout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="pagination">
          <button
            disabled={pagination.page === 1}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
            }
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of{" "}
            {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <button
            disabled={
              pagination.page >= Math.ceil(pagination.total / pagination.limit)
            }
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
            }
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminSettlement;
