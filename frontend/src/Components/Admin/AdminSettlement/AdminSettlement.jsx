import { getActiveCurrency } from "../../../config/localeConfig";
import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import api from "../../../utils/api";
import "./adminsettlement.css";
import { notify } from "../../../utils/toast";

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
  CALCULATED: "Reconciled",
  PENDING_PAYOUT: "Reconciled",
  SETTLED: "Reconciled",
  DEBT_OUTSTANDING: "Debt Outstanding",
};

// Friendly role names + the revenue source each account type is settled from.
const ROLE_LABELS = {
  B2C_PARTNER: "B2C Partner",
  B2B_PARTNER: "B2B Partner",
  CORPORATE: "Corporate",
};

// B2C earns per passenger ride; B2B earns per contract/EMI payment; a Corporate
// is billed per completed negotiation. The count column means different things
// per role, so label it accordingly.
const activityLabel = (role, count) => {
  const n = count || 0;
  if (role === "B2B_PARTNER") return `${n} ${n === 1 ? "payment" : "payments"}`;
  if (role === "CORPORATE")
    return `${n} ${n === 1 ? "negotiation" : "negotiations"}`;
  return `${n} ${n === 1 ? "ride" : "rides"}`;
};

// Is this row a corporate negotiation-commission receivable (vs a partner payout)?
const isCorporateReceivable = (s) =>
  s?.statementType === "CORPORATE_RECEIVABLE" || s?.role === "CORPORATE";

function AdminSettlement() {
  const now = new Date();
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({
    totalNetPayable: 0,
    totalCommissionCollected: 0,
    totalCommissionDebt: 0,
    totalGrossEarnings: 0,
    activePartners: 0,
    activeCorporates: 0,
    partnerCommissionCollected: 0,
    partnerCommissionDebt: 0,
    corporateCommissionCollected: 0,
    corporateReceivableOutstanding: 0,
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

  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState("all");
  // "all" | "PARTNER_PAYOUT" | "CORPORATE_RECEIVABLE"
  const [filterType, setFilterType] = useState("all");

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
      if (filterType !== "all") params.append("statementType", filterType);
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
    filterType,
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
        notify(response.data.message);
        setPagination((prev) => ({ ...prev, page: 1 }));
        fetchSettlements();
      }
    } catch (err) {
      console.error("Error calculating settlement:", err);
      notify(err.response?.data?.message || "Failed to calculate settlement");
    } finally {
      setActionLoading(false);
    }
  };

  const collectDebt = async () => {
    if (
      !window.confirm(
        "Recover outstanding commission from partners who have available wallet funds, and notify the rest to top up. Continue?",
      )
    ) {
      return;
    }
    try {
      setActionLoading(true);
      const response = await api.post(`/settlement/collect-debt`);
      if (response.data.success) {
        notify(response.data.message);
        fetchSettlements();
      }
    } catch (err) {
      console.error("Error collecting debt:", err);
      notify(err.response?.data?.message || "Failed to run debt collection");
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

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--)
    yearOptions.push(y);

  return (
    <div className="drivemego-st-admin-settlement">
      <div className="drivemego-st-settlement-header">
        <div>
          <h2>Settlement Management</h2>
          <p className="drivemego-st-settlement-subtitle">
            Monthly reconciliation statements &mdash; B2C partners from
            passenger rides, B2B partners from contract &amp; EMI payments, and
            Corporate clients for the negotiation commission they owe the
            platform. Partner commission is collected in real time (payouts are
            handled in the Finance tab); corporate negotiation commission is
            collected when the client pays the negotiated contract. This is a
            read-only earnings statement plus a debt / receivable ledger.
          </p>
        </div>
        <div className="drivemego-st-header-actions">
          <button
            className="drivemego-st-btn-calculate"
            onClick={calculateMonthlySettlement}
            disabled={actionLoading}
          >
            {actionLoading ? "Working..." : "Calculate Monthly Settlement"}
          </button>
          <button
            className="drivemego-st-btn-auto-debit"
            onClick={collectDebt}
            disabled={actionLoading}
          >
            Collect Commission Debt
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="drivemego-st-settlement-filters">
        <div className="drivemego-st-filter-group">
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
        <div className="drivemego-st-filter-group">
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
        <div className="drivemego-st-filter-group">
          <label>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            <option value="all">All</option>
            <option value="CALCULATED">Reconciled</option>
            <option value="DEBT_OUTSTANDING">Debt Outstanding</option>
          </select>
        </div>
        <div className="drivemego-st-filter-group">
          <label>Account Type</label>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            <option value="all">All Accounts</option>
            <option value="PARTNER_PAYOUT">Partners (B2C / B2B)</option>
            <option value="CORPORATE_RECEIVABLE">Corporate Receivables</option>
          </select>
        </div>
      </div>

      {error && <div className="drivemego-st-error-message">{error}</div>}

      {/* Summary Stats */}
      <div className="drivemego-st-settlement-stats">
        <div className="drivemego-st-stat-card">
          <div className="drivemego-st-stat-label">Gross Earnings</div>
          <div className="drivemego-st-stat-value">
            {money(summary.totalGrossEarnings)}
          </div>
        </div>
        <div className="drivemego-st-stat-card">
          <div className="drivemego-st-stat-label">
            Commission (Platform Revenue)
          </div>
          <div className="drivemego-st-stat-value">
            {money(summary.totalCommissionCollected)}
          </div>
        </div>
        <div className="drivemego-st-stat-card drivemego-st-pending">
          <div className="drivemego-st-stat-label">Net Earnings</div>
          <div className="drivemego-st-stat-value">
            {money(summary.totalNetPayable)}
          </div>
        </div>
        <div className="drivemego-st-stat-card drivemego-st-commission">
          <div className="drivemego-st-stat-label">Commission Debt</div>
          <div className="drivemego-st-stat-value">
            {money(summary.totalCommissionDebt)}
          </div>
        </div>
        <div className="drivemego-st-stat-card drivemego-st-partners">
          <div className="drivemego-st-stat-label">Accounts In Period</div>
          <div className="drivemego-st-stat-value">
            {(summary.activePartners || 0) + (summary.activeCorporates || 0)}
          </div>
        </div>
      </div>

      {/* Corporate negotiation-commission breakdown */}
      <div className="drivemego-st-settlement-stats drivemego-st-settlement-stats-corporate">
        <div className="drivemego-st-stat-card">
          <div className="drivemego-st-stat-label">
            Corporate Commission Collected
          </div>
          <div className="drivemego-st-stat-value">
            {money(summary.corporateCommissionCollected)}
          </div>
        </div>
        <div className="drivemego-st-stat-card drivemego-st-commission">
          <div className="drivemego-st-stat-label">
            Corporate Receivable Outstanding
          </div>
          <div className="drivemego-st-stat-value">
            {money(summary.corporateReceivableOutstanding)}
          </div>
        </div>
        <div className="drivemego-st-stat-card drivemego-st-partners">
          <div className="drivemego-st-stat-label">Corporates In Period</div>
          <div className="drivemego-st-stat-value">
            {summary.activeCorporates || 0}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="drivemego-st-settlement-loading">
          Loading settlements...
        </div>
      ) : settlements.length === 0 ? (
        <div className="drivemego-st-no-settlements">
          <p>No settlements to display.</p>
          <p className="drivemego-st-no-settlements-hint">
            Click &quot;Calculate Monthly Settlement&quot; to generate
            statements for the selected period.
          </p>
        </div>
      ) : (
        <div className="drivemego-st-settlements-table">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Period</th>
                <th>Gross / Savings</th>
                <th>Commission</th>
                <th>Net Payable</th>
                <th>Activity</th>
                <th>Debt / Receivable</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div className="drivemego-st-partner-name">
                      {s.partnerName}
                    </div>
                    <div className="drivemego-st-partner-email">
                      {s.partnerEmail}
                    </div>
                  </td>
                  <td>
                    <span className="drivemego-st-badge">
                      {ROLE_LABELS[s.role] || s.role}
                    </span>
                  </td>
                  <td className="drivemego-st-date">
                    {MONTHS[s.month - 1]?.slice(0, 3)} {s.year}
                  </td>
                  <td className="drivemego-st-amount">
                    {money(s.displayGrossEarnings ?? s.grossEarnings)}
                  </td>
                  <td className="drivemego-st-amount drivemego-st-neutral">
                    {money(
                      s.displayCommissionCollected ?? s.commissionCollected,
                    )}
                  </td>
                  <td className="drivemego-st-amount drivemego-st-pending">
                    {isCorporateReceivable(s)
                      ? "—"
                      : money(s.displayNetPayable ?? s.netPayable)}
                  </td>
                  <td className="drivemego-st-amount drivemego-st-neutral">
                    {activityLabel(s.role, s.bookingCount)}
                  </td>
                  <td
                    className={`drivemego-st-amount ${s.commissionDebt > 0 ? "drivemego-st-debt" : "drivemego-st-neutral"}`}
                  >
                    {money(s.displayCommissionDebt ?? s.commissionDebt)}
                  </td>
                  <td>
                    <span
                      className={`drivemego-st-status-badge drivemego-st-status-${s.status?.toLowerCase()}`}
                    >
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="drivemego-st-pagination">
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
