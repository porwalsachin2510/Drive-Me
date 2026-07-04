import { getActiveCurrency } from "../../../config/localeConfig";
import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import api from "../../../utils/api";
import "./adminsettlement.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STATUS_LABELS = {
  CALCULATED: "Calculated",
  PENDING_PAYOUT: "Pending Payout",
  SETTLED: "Settled",
  DEBT_OUTSTANDING: "Debt Outstanding",
};

function AdminSettlement() {
  const now = new Date();
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({
    totalNetPayable: 0,
    totalCommissionCollected: 0,
    totalCommissionDebt: 0,
    totalGrossEarnings: 0,
    activePartners: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Currency the admin has chosen to view the dashboard in. The backend already
  // converts every settlement amount + summary total into this currency and
  // returns it as `displayCurrency`, so the UI just needs to render with the
  // right symbol and decimal places.
  const activeCurrency = useSelector((state) => state.locale?.currency);
  const [displayCurrency, setDisplayCurrency] = useState(getActiveCurrency());

  const [selectedPayout, setSelectedPayout] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");

  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState("all");

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterMonth) params.append("month", String(filterMonth));
      if (filterYear) params.append("year", String(filterYear));

      const response = await api.get(`/settlement/all?${params.toString()}`);
      if (response.data.success) {
        setSettlements(response.data.settlements || []);
        setSummary(response.data.summary || summary);
        setDisplayCurrency(
          response.data.displayCurrency ||
            response.data.summary?.currency ||
            getActiveCurrency(),
        );
        setPagination((prev) => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages,
        }));
        setError(null);
      }
    } catch (err) {
      console.error("Error fetching settlements:", err);
      setError("Failed to load settlements");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.page,
    pagination.limit,
    filterStatus,
    filterMonth,
    filterYear,
    activeCurrency,
  ]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const calculateMonthlySettlement = async () => {
    try {
      setActionLoading(true);
      const response = await api.post(
        `/settlement/monthly-settlement?month=${filterMonth}&year=${filterYear}`,
      );
      if (response.data.success) {
        alert(response.data.message);
        setPagination((prev) => ({ ...prev, page: 1 }));
        fetchSettlements();
      }
    } catch (err) {
      console.error("Error calculating settlement:", err);
      alert(err.response?.data?.message || "Failed to calculate settlement");
    } finally {
      setActionLoading(false);
    }
  };

  const collectDebt = async () => {
    if (
      !window.confirm(
        "Notify all partners with outstanding commission balances to settle?",
      )
    ) {
      return;
    }
    try {
      setActionLoading(true);
      const response = await api.post(`/settlement/collect-debt`);
      if (response.data.success) {
        alert(response.data.message);
        fetchSettlements();
      }
    } catch (err) {
      console.error("Error collecting debt:", err);
      alert(err.response?.data?.message || "Failed to run debt collection");
    } finally {
      setActionLoading(false);
    }
  };

  const openPayout = (settlement) => {
    setSelectedPayout(settlement);
    setPayoutAmount(String(settlement.netPayable || 0));
    setAccountHolderName(settlement.partnerName || "");
    setBankName("");
    setIban("");
    setPayoutNotes("");
  };

  const submitPayout = async () => {
    if (!payoutAmount || Number(payoutAmount) <= 0) {
      alert("Please enter a valid payout amount");
      return;
    }
    try {
      setActionLoading(true);
      const response = await api.post(
        `/settlement/payout/${selectedPayout._id}`,
        {
          amount: Number(payoutAmount),
          bankName,
          iban,
          accountHolderName,
          notes: payoutNotes,
        },
      );
      if (response.data.success) {
        alert("Payout processed successfully!");
        setSelectedPayout(null);
        fetchSettlements();
      }
    } catch (err) {
      console.error("Error processing payout:", err);
      alert(err.response?.data?.message || "Failed to process payout");
    } finally {
      setActionLoading(false);
    }
  };

  // KWD/BHD/OMR are 3-decimal currencies; everything else uses 2.
  const decimalsFor = (c) =>
    ["KWD", "BHD", "OMR"].includes((c || "").toUpperCase()) ? 3 : 2;

  // Format an amount that is ALREADY in the admin's selected display currency
  // (summary totals + the per-row display* fields the backend converts).
  const money = (n) =>
    `${Number(n || 0).toFixed(decimalsFor(displayCurrency))} ${displayCurrency}`;

  // Format an amount in its own native currency (used for payout actions, which
  // are processed against the partner's wallet in its native currency).
  const fmtNative = (n, c) => {
    const cur = c || displayCurrency;
    return `${Number(n || 0).toFixed(decimalsFor(cur))} ${cur}`;
  };

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--)
    yearOptions.push(y);

  return (
    <div className="admin-settlement">
      <div className="settlement-header">
        <div>
          <h2>Settlement Management</h2>
          <p className="settlement-subtitle">
            Monthly reconciliation statements for partners. Commission is
            collected in real time at booking; this is the payout &amp; debt
            ledger.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="btn-calculate"
            onClick={calculateMonthlySettlement}
            disabled={actionLoading}
          >
            {actionLoading ? "Working..." : "Calculate Monthly Settlement"}
          </button>
          <button
            className="btn-auto-debit"
            onClick={collectDebt}
            disabled={actionLoading}
          >
            Collect Commission Debt
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="settlement-filters">
        <div className="filter-group">
          <label>Month</label>
          <select
            value={filterMonth}
            onChange={(e) => {
              setFilterMonth(Number(e.target.value));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Year</label>
          <select
            value={filterYear}
            onChange={(e) => {
              setFilterYear(Number(e.target.value));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            <option value="all">All</option>
            <option value="CALCULATED">Calculated</option>
            <option value="PENDING_PAYOUT">Pending Payout</option>
            <option value="SETTLED">Settled</option>
            <option value="DEBT_OUTSTANDING">Debt Outstanding</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Summary Stats */}
      <div className="settlement-stats">
        <div className="stat-card">
          <div className="stat-label">Gross Earnings</div>
          <div className="stat-value">{money(summary.totalGrossEarnings)}</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-label">Pending Payout</div>
          <div className="stat-value">{money(summary.totalNetPayable)}</div>
        </div>
        <div className="stat-card commission">
          <div className="stat-label">Commission Debt</div>
          <div className="stat-value">{money(summary.totalCommissionDebt)}</div>
        </div>
        <div className="stat-card partners">
          <div className="stat-label">Partners In Period</div>
          <div className="stat-value">{summary.activePartners}</div>
        </div>
      </div>

      {loading ? (
        <div className="settlement-loading">Loading settlements...</div>
      ) : settlements.length === 0 ? (
        <div className="no-settlements">
          <p>No settlements to display.</p>
          <p className="no-settlements-hint">
            Click &quot;Calculate Monthly Settlement&quot; to generate
            statements for the selected period.
          </p>
        </div>
      ) : (
        <div className="settlements-table">
          <table>
            <thead>
              <tr>
                <th>Partner</th>
                <th>Role</th>
                <th>Period</th>
                <th>Gross Earnings</th>
                <th>Commission</th>
                <th>Net Payable</th>
                <th>Debt</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div className="partner-name">{s.partnerName}</div>
                    <div className="partner-email">{s.partnerEmail}</div>
                  </td>
                  <td>
                    <span className="badge">{s.role}</span>
                  </td>
                  <td className="date">
                    {MONTHS[s.month - 1]?.slice(0, 3)} {s.year}
                  </td>
                  <td className="amount">
                    {money(s.displayGrossEarnings ?? s.grossEarnings)}
                  </td>
                  <td className="amount neutral">
                    {money(s.displayCommissionCollected ?? s.commissionCollected)}
                  </td>
                  <td className="amount pending">
                    {money(s.displayNetPayable ?? s.netPayable)}
                  </td>
                  <td
                    className={`amount ${s.commissionDebt > 0 ? "debt" : "neutral"}`}
                  >
                    {money(s.displayCommissionDebt ?? s.commissionDebt)}
                  </td>
                  <td>
                    <span
                      className={`status-badge status-${s.status?.toLowerCase()}`}
                    >
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </td>
                  <td>
                    {s.status === "SETTLED" ? (
                      <span className="settled-text">
                        Paid {fmtNative(s.payoutAmount, s.currency)}
                      </span>
                    ) : (
                      <button
                        className="btn-payout"
                        onClick={() => openPayout(s)}
                        disabled={!s.netPayable || s.netPayable <= 0}
                      >
                        Payout
                      </button>
                    )}
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
                  Available for payout:{" "}
                  {fmtNative(
                    selectedPayout.netPayable,
                    selectedPayout.currency || getActiveCurrency(),
                  )}
                </p>
              </div>

              <div className="form-group">
                <label>Payout Amount</label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  max={selectedPayout.netPayable}
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Account Holder Name</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Account holder name"
                />
              </div>

              <div className="form-group">
                <label>Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Bank name"
                />
              </div>

              <div className="form-group">
                <label>IBAN / Account Number</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="IBAN or account number"
                />
              </div>

              <div className="form-group">
                <label>Notes (optional)</label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="Reference or notes"
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
                onClick={submitPayout}
                disabled={actionLoading || !payoutAmount}
              >
                {actionLoading ? "Processing..." : "Process Payout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
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
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            disabled={pagination.page >= pagination.pages}
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
